"""Validation et consolidation des candidats proposés.

Deux étapes distinctes :

* `validate_candidate` — validation STRUCTURELLE déterministe, en CONTENANCE
  pure (`verify_claim` à effort 0). Statuts : `unknown_term`, `duplicate`,
  `inconsistent` (triplet déjà nié explicitement dans JDM), `ok`.

* `consolidate_candidate` — consolidation SÉMANTIQUE par INFÉRENCE. Cherche
  si le réseau JDM permet de déduire (ou de réfuter) le triplet. Statuts :
  `consolidated` (déduit → point d'entrée vers la soumission),
  `rejected` (réfuté), `not_consolidated` (silence — pas forcément faux).

Registry d'exclusion (option A — anti-doublons) :
  ContextVar `_EXCLUSION_REGISTRY` qui stocke, par (term, relation), la
  liste normalisée des cibles déjà connues dans JDM (renseignée par
  `list_existing_for_enrichment` au moment du pré-fetch). Quand le LLM
  appelle ensuite `validate_candidate` sur un candidat dont la cible est
  dans cette liste, on court-circuite SANS appeler verify_claim (pas
  d'HTTP, pas d'inférence) et on retourne immédiatement
  validation_status="duplicate" avec un message qui rappelle au LLM
  qu'il avait l'info.

  Le registry vit pendant une invocation agent — encadrer le streaming
  par `with exclusion_context(): ...`. Hors contexte, registry=None et
  toutes les fonctions sont des no-ops (compat 100% avec l'existant).
"""
from __future__ import annotations

import contextvars
import unicodedata
from contextlib import contextmanager
from typing import Optional

# ContextVar — mécanisme principal d'isolation per-run. Le bg driver
# Jarvis fait `_CURRENT_RUN_CTX.set(rctx)` au start, et langchain.agents
# propage la valeur vers les ThreadPoolExecutor des tool workers via
# copy_context(). Si non-set → globals (compat MCP/CLI/tests directs).
_CURRENT_RUN_CTX: contextvars.ContextVar = contextvars.ContextVar(
    "jdm_run_context", default=None,
)


def _active_ctx(explicit: "Optional[RunContext]" = None) -> "Optional[RunContext]":
    """Résolution : explicite > ContextVar > None (globals)."""
    if explicit is not None:
        return explicit
    return _CURRENT_RUN_CTX.get()


@contextmanager
def run_context_active(rctx):
    """Context manager qui pose `rctx` dans la ContextVar puis le restaure.
    Utilisé par le bg driver Jarvis. Sortie auto = restore automatique.
    Note : la ContextVar est PAR THREAD/TASK via copy_context, donc
    plusieurs bg threads chacun avec leur propre rctx ne se marchent
    pas dessus."""
    token = _CURRENT_RUN_CTX.set(rctx)
    try:
        yield rctx
    finally:
        _CURRENT_RUN_CTX.reset(token)

from jdm_agent.client import JDMClient
from jdm_agent.enrich.models import Candidate
from jdm_agent.factcheck import Claim
from jdm_agent.factcheck.models import Status
from jdm_agent.factcheck.verifier import verify_claim


# ---------- Registries partagés thread-safe ----------
#
# IMPORTANT : on N'UTILISE PAS ContextVar pour ces registries. Raison :
# LangChain exécute les tools dans des threads worker (ThreadPoolExecutor)
# qui ne préservent PAS le contexte ContextVar du parent. Résultat :
# register_consolidation() depuis le tool validate_candidate écrivait
# dans un dict isolé du thread, get_consolidation() depuis le tool
# write_submission_file lisait None → tous les triplets skippés
# silencieusement → fichier .enrich vide.
#
# À la place : dict global module-level + Lock. Activé/désactivé par
# `exclusion_context()` via un compteur (pour supporter le nesting).
# Trade-off accepté : pas d'isolation per-user en cas de concurrent
# heavy multi-user — mais les keys sont (term, relation, target) qui
# sont stables, et chaque write_submission_file ne consulte que les
# triplets que SON LLM lui passe → pas de fuite de contenu entre users.
import threading

_REGISTRY_LOCK = threading.RLock()
_EXCLUSION_REGISTRY: Optional[dict] = None
_CONSOLIDATION_REGISTRY: Optional[dict] = None
_CONTEXT_DEPTH = 0  # compteur de nesting d'exclusion_context()

# ---------- Canonical output path (deux modes) ----------
#
# Path canonique d'écriture pour le run courant. Quand non-None :
#   - mode "auto_append" : `register_consolidation` écrit chaque
#     triplet consolidé en APPEND dans ce fichier IMMÉDIATEMENT
#     (streaming temps réel). `write_submission_file` no-op poli
#     pour ce path. Utilisé pour le flow ENRICH où le contenu est
#     calculé par le backend (inférence) et donc captureable côté
#     streaming.
#   - mode "redirect" : `write_submission_file` IGNORE le `path` que
#     le LLM passe et OVERWRITE ce path canonique. Utilisé pour
#     annot/audit/err/stat où le contenu = jugement LLM (non
#     interceptable en streaming). Le LLM compose le contenu, on
#     contrôle où ça va — pas de fragmentation possible peu importe
#     ce que le LLM appelle. Pas de dédup (jugements parallèles
#     légitimes côté err).
#
# Note historique : initialement nommé _CONSOLIDATION_OUTPUT_PATH (ne
# gérait que le mode auto_append). Renommé _CANONICAL_OUTPUT_PATH avec
# wrapper de compat `set_consolidation_output_path`.
_CANONICAL_OUTPUT_PATH: Optional[str] = None
_CANONICAL_OUTPUT_MODE: Optional[str] = None  # "auto_append" | "redirect"
_CONSOLIDATION_OUTPUT_HEADER_WRITTEN: bool = False


# ---------- RunContext (isolation per-run pour Jarvis parallèle) ----------
#
# Problème : les globals ci-dessus + _CONSOLIDATION_REGISTRY sont partagés
# entre tous les runs. Si deux flows Jarvis tournent en parallèle :
#   - L'un set canonical_path/mode → l'autre l'écrase (last setter wins)
#   - register_consolidation écrit dans une registry partagée → mix
#
# Solution : un objet `RunContext` par run, capturé en closure dans les
# tools construits pour ce run (cf. build_jdm_tools_for_run dans
# jdm_tools.py). Le tool lit/écrit dans CE RunContext, pas dans les
# globals — donc isolation parfaite quel que soit le thread d'exécution
# (la closure survit aux ThreadPoolExecutor LangChain).
#
# Les globals restent utilisés pour les cas hors-Jarvis (MCP, CLI, tests
# directs) qui appellent les fonctions de niveau module sans passer par
# un RunContext explicite.

class RunContext:
    """État d'un run Jarvis, capturé en closure par ses tools.

    Porte le canonical_path + mode + les registries (exclusion + consolidation
    + redirect_items). Chaque champ a la même sémantique que son équivalent
    global mais scopé au run. Aucune méthode magique — c'est juste un sac
    de state avec un lock pour la cohérence en multi-thread (les tools
    tournent en worker LangChain, donc cross-thread).

    `redirect_items` : liste accumulative des dicts passés à
    `write_submission_file` en mode redirect, au fil des appels du run.
    Le tool ne fait PAS confiance au LLM pour re-passer la liste complète
    à chaque appel (cassait après une condense d'historique qui wipe les
    ToolMessage précédents) — il accumule ici et écrit l'UNION dans le
    canonical à chaque appel. Le LLM passe juste les nouveaux items ;
    on possède la mémoire.
    """
    __slots__ = (
        "canonical_path", "canonical_mode",
        "consolidation_registry", "exclusion_registry",
        "redirect_items", "redirect_seen_keys",
        "header_written", "lock",
    )

    def __init__(self):
        self.canonical_path: Optional[str] = None
        self.canonical_mode: Optional[str] = None
        self.consolidation_registry: dict = {}
        self.exclusion_registry: dict = {}
        # Accumulation per-run pour redirect mode : ordre d'arrivée
        # préservé, dédup OPTIONNELLE via redirect_seen_keys (peut être
        # désactivée par le caller pour les flows où les dups sont
        # légitimes — ex. err / signalement).
        self.redirect_items: list = []
        self.redirect_seen_keys: set = set()
        self.header_written: bool = False
        self.lock = threading.RLock()

    def set_canonical(self, path: Optional[str], mode: str = "auto_append") -> None:
        """Configure le canonical pour ce run. Cf. doc set_canonical_output_path."""
        if path is not None and mode not in ("auto_append", "redirect"):
            raise ValueError(f"mode must be 'auto_append' or 'redirect', got {mode!r}")
        with self.lock:
            self.canonical_path = path
            self.canonical_mode = mode if path is not None else None
            self.header_written = False

    def merge_redirect_items(self, new_items: list,
                              key_fn=None, dedup: bool = True) -> list:
        """Accumule de nouveaux items dans `redirect_items`.

        - Si `dedup=True` (par défaut) et `key_fn` fourni, ne garde que
          les items dont la clé (`key_fn(item)`) n'est pas déjà dans
          `redirect_seen_keys`. Tuples / strings hashables OK.
        - Si `dedup=False`, append tel quel (cas err/signalement où les
          dups sont sémantiquement légitimes).
        - Si `key_fn=None`, append sans dédup (silencieux).

        Renvoie la LISTE COMPLÈTE accumulée (snapshot, copie) — c'est
        ce que le tool écrira dans le canonical à la place du payload
        seul du LLM.
        """
        with self.lock:
            if dedup and key_fn is not None:
                for it in new_items:
                    try:
                        k = key_fn(it)
                    except Exception:
                        # Si la key fn plante sur un item, on l'append
                        # quand même mais sans le tracer (impossible
                        # à dédupliquer plus tard).
                        self.redirect_items.append(it)
                        continue
                    if k in self.redirect_seen_keys:
                        continue
                    self.redirect_seen_keys.add(k)
                    self.redirect_items.append(it)
            else:
                self.redirect_items.extend(new_items)
            # Retourne une copie pour éviter qu'un caller mute la liste
            # interne pendant qu'on écrit le fichier.
            return list(self.redirect_items)


def _norm_target(s: str) -> str:
    """Normalisation cohérente avec `jdm_tools._norm` utilisé dans
    list_existing_for_enrichment : NFKD + suppression diacritiques +
    lowercase + strip. Doit matcher EXACTEMENT la normalisation stockée."""
    s = unicodedata.normalize("NFKD", s or "")
    return "".join(ch for ch in s if not unicodedata.combining(ch)).lower().strip()


def _norm_key(term: str, relation: str) -> tuple[str, str]:
    return (_norm_target(term), (relation or "").strip().lower())


@contextmanager
def exclusion_context():
    """Active les registries partagés (exclusion + consolidation) pour la
    durée d'une invocation agent.

    Sans ce contexte, les helpers sont des no-ops — le comportement
    précédent (verify_claim a posteriori, explanation custom du LLM)
    est préservé.

    Implémentation : dict module-level + Lock + compteur de nesting.
    Anciennement basé sur ContextVar mais LangChain exécute les tools
    dans des threads worker qui ne préservent pas le ContextVar du
    parent → registry None dans le tool → register/get no-ops →
    fichier .enrich vide. Le dict global avec Lock est cross-thread,
    le compteur supporte le nesting (plusieurs invocations imbriquées
    partagent le même dict, seule la SORTIE la plus externe le vide).
    """
    global _EXCLUSION_REGISTRY, _CONSOLIDATION_REGISTRY, _CONTEXT_DEPTH
    with _REGISTRY_LOCK:
        if _CONTEXT_DEPTH == 0:
            _EXCLUSION_REGISTRY = {}
            _CONSOLIDATION_REGISTRY = {}
        _CONTEXT_DEPTH += 1
    try:
        yield
    finally:
        with _REGISTRY_LOCK:
            _CONTEXT_DEPTH = max(0, _CONTEXT_DEPTH - 1)
            if _CONTEXT_DEPTH == 0:
                _EXCLUSION_REGISTRY = None
                _CONSOLIDATION_REGISTRY = None


# ---------- Registry de consolidation ----------

def _norm_consolidation_key(term: str, relation: str, target: str) -> tuple[str, str, str]:
    return (
        _norm_target(term),
        (relation or "").strip().lower(),
        _norm_target(target),
    )


def set_canonical_output_path(path: Optional[str], mode: str = "auto_append",
                              run_context: Optional[RunContext] = None) -> None:
    """Configure le path canonique d'écriture pour le run courant.

    Si `run_context` est fourni, configure sur ce contexte. Sinon, modifie
    les globals module-level (compat MCP/CLI).

    `mode` :
      - "auto_append" : `register_consolidation` append en streaming
        dans `path` à chaque triplet consolidé. `write_submission_file`
        sur ce path est no-op poli. Utilisé pour ENRICH.
      - "redirect" : `write_submission_file` IGNORE le `path` passé
        par le LLM et OVERWRITE `path`. Utilisé pour annot/audit/err/stat.

    Passer `path=None` désactive le mécanisme (reset du flag header).
    """
    ctx = _active_ctx(run_context)
    if ctx is not None:
        ctx.set_canonical(path, mode)
        return
    global _CANONICAL_OUTPUT_PATH, _CANONICAL_OUTPUT_MODE, _CONSOLIDATION_OUTPUT_HEADER_WRITTEN
    if mode not in ("auto_append", "redirect"):
        raise ValueError(f"mode must be 'auto_append' or 'redirect', got {mode!r}")
    with _REGISTRY_LOCK:
        _CANONICAL_OUTPUT_PATH = path
        _CANONICAL_OUTPUT_MODE = mode if path is not None else None
        _CONSOLIDATION_OUTPUT_HEADER_WRITTEN = False


def get_canonical_output_path(run_context: Optional[RunContext] = None) -> tuple[Optional[str], Optional[str]]:
    """Retourne `(path, mode)` du canonical courant. `(None, None)` si désactivé."""
    ctx = _active_ctx(run_context)
    if ctx is not None:
        with ctx.lock:
            return ctx.canonical_path, ctx.canonical_mode
    with _REGISTRY_LOCK:
        return _CANONICAL_OUTPUT_PATH, _CANONICAL_OUTPUT_MODE


# ---------- Compat wrappers (auto_append uniquement) ----------

def set_consolidation_output_path(path: Optional[str],
                                   run_context: Optional[RunContext] = None) -> None:
    """Compat : pose le canonical en mode auto_append (= comportement
    historique d'enrich). Préfère `set_canonical_output_path(path,
    mode='auto_append')` pour le code neuf."""
    set_canonical_output_path(path, mode="auto_append", run_context=run_context)


def get_consolidation_output_path(run_context: Optional[RunContext] = None) -> Optional[str]:
    """Compat : retourne le path canonical SI mode auto_append, sinon
    None. Sert aux call sites qui ne veulent QUE l'auto-append d'enrich."""
    ctx = _active_ctx(run_context)
    if ctx is not None:
        with ctx.lock:
            if ctx.canonical_mode == "auto_append":
                return ctx.canonical_path
            return None
    with _REGISTRY_LOCK:
        if _CANONICAL_OUTPUT_MODE == "auto_append":
            return _CANONICAL_OUTPUT_PATH
        return None


def get_redirect_output_path(run_context: Optional[RunContext] = None) -> Optional[str]:
    """Retourne le path canonical SI mode redirect, sinon None. Sert à
    `write_submission_file` pour détourner l'écriture LLM."""
    ctx = _active_ctx(run_context)
    if ctx is not None:
        with ctx.lock:
            if ctx.canonical_mode == "redirect":
                return ctx.canonical_path
            return None
    with _REGISTRY_LOCK:
        if _CANONICAL_OUTPUT_MODE == "redirect":
            return _CANONICAL_OUTPUT_PATH
        return None


def _append_consolidation_to_file(term: str, relation: str, target: str,
                                   explanation: str,
                                   run_context: Optional[RunContext] = None) -> None:
    """Écrit une ligne `term | relation | target |  < explanation >`
    en APPEND dans le path canonique (du run_context ou des globals).
    No-op si aucun path n'est défini ou si mode ≠ auto_append.

    Pas de décodage des raffinements ici — le décodage propre est fait
    par la fusion finale via `pipeline.write_submission`.
    """
    # Résout la source de state : run_context ou globals
    ctx = _active_ctx(run_context)
    if ctx is not None:
        with ctx.lock:
            path = ctx.canonical_path
            mode = ctx.canonical_mode
        if path is None or mode != "auto_append":
            return
        try:
            from pathlib import Path as _Path
            p = _Path(path)
            p.parent.mkdir(parents=True, exist_ok=True)
            expl = " ".join((explanation or "").split())
            with ctx.lock:
                write_header = not ctx.header_written
                if write_header:
                    ctx.header_written = True
            with p.open("a", encoding="utf-8") as f:
                if write_header:
                    f.write(
                        "# Soumission JeuxDeMots — fichier d'enrichissement.\n"
                        "# Format : terme | relation | cible | annotation < explication >\n\n"
                    )
                f.write(f"{term} | {relation} | {target} |  < {expl} >\n")
        except Exception:
            pass
        return

    global _CONSOLIDATION_OUTPUT_HEADER_WRITTEN
    if _CANONICAL_OUTPUT_PATH is None or _CANONICAL_OUTPUT_MODE != "auto_append":
        return
    try:
        from pathlib import Path as _Path
        p = _Path(_CANONICAL_OUTPUT_PATH)
        p.parent.mkdir(parents=True, exist_ok=True)
        write_header = not _CONSOLIDATION_OUTPUT_HEADER_WRITTEN
        expl = " ".join((explanation or "").split())
        with p.open("a", encoding="utf-8") as f:
            if write_header:
                f.write(
                    "# Soumission JeuxDeMots — fichier d'enrichissement.\n"
                    "# Format : terme | relation | cible | annotation < explication >\n\n"
                )
                _CONSOLIDATION_OUTPUT_HEADER_WRITTEN = True
            f.write(f"{term} | {relation} | {target} |  < {expl} >\n")
    except Exception:
        pass


def register_consolidation(term: str, relation: str, target: str,
                            explanation: str, schema: Optional[str] = None,
                            run_context: Optional[RunContext] = None) -> None:
    """Stocke l'explication d'inférence pour ce triplet. Appelé par
    `consolidate_candidate` quand le triplet est confirmé.

    Si `run_context` fourni → écrit dans son registry. Sinon → registry
    global (no-op si pas dans exclusion_context())."""
    ctx = _active_ctx(run_context)
    if ctx is not None:
        with ctx.lock:
            key = _norm_consolidation_key(term, relation, target)
            is_new = key not in ctx.consolidation_registry
            ctx.consolidation_registry[key] = {
                "explanation": (explanation or "").strip(),
                "schema": (schema or "").strip(),
            }
        if is_new:
            _append_consolidation_to_file(term, relation, target, explanation,
                                          run_context=run_context)
        return

    with _REGISTRY_LOCK:
        if _CONSOLIDATION_REGISTRY is None:
            return
        key = _norm_consolidation_key(term, relation, target)
        is_new = key not in _CONSOLIDATION_REGISTRY
        _CONSOLIDATION_REGISTRY[key] = {
            "explanation": (explanation or "").strip(),
            "schema": (schema or "").strip(),
        }
        if is_new:
            _append_consolidation_to_file(term, relation, target, explanation)


def get_consolidation(term: str, relation: str, target: str,
                       run_context: Optional[RunContext] = None) -> Optional[dict]:
    """Récupère l'explication d'inférence stockée pour ce triplet."""
    ctx = _active_ctx(run_context)
    if ctx is not None:
        with ctx.lock:
            key = _norm_consolidation_key(term, relation, target)
            return ctx.consolidation_registry.get(key)
    with _REGISTRY_LOCK:
        if _CONSOLIDATION_REGISTRY is None:
            return None
        key = _norm_consolidation_key(term, relation, target)
        return _CONSOLIDATION_REGISTRY.get(key)


def count_consolidations(run_context: Optional[RunContext] = None) -> int:
    """Renvoie le NOMBRE CUMULATIF de triplets consolidés. Renvoie 0 hors
    `exclusion_context()` (registry global None)."""
    ctx = _active_ctx(run_context)
    if ctx is not None:
        with ctx.lock:
            return len(ctx.consolidation_registry)
    with _REGISTRY_LOCK:
        if _CONSOLIDATION_REGISTRY is None:
            return 0
        return len(_CONSOLIDATION_REGISTRY)


def list_consolidations(run_context: Optional[RunContext] = None) -> list[dict]:
    """Renvoie la LISTE des triplets consolidés. Liste vide hors contexte."""
    ctx = _active_ctx(run_context)
    if ctx is not None:
        with ctx.lock:
            return [
                {
                    "term": k[0], "relation": k[1], "target": k[2],
                    "explanation": v.get("explanation", ""),
                    "schema": v.get("schema", ""),
                }
                for k, v in ctx.consolidation_registry.items()
            ]
    with _REGISTRY_LOCK:
        if _CONSOLIDATION_REGISTRY is None:
            return []
        return [
            {
                "term": k[0], "relation": k[1], "target": k[2],
                "explanation": v.get("explanation", ""),
                "schema": v.get("schema", ""),
            }
            for k, v in _CONSOLIDATION_REGISTRY.items()
        ]


def register_exclusion(term: str, relation: str, exclusion_set,
                        run_context: Optional[RunContext] = None) -> None:
    """Stocke la liste de cibles déjà présentes pour (term, relation)."""
    ctx = _active_ctx(run_context)
    if ctx is not None:
        with ctx.lock:
            ctx.exclusion_registry[_norm_key(term, relation)] = set(exclusion_set or [])
        return
    with _REGISTRY_LOCK:
        if _EXCLUSION_REGISTRY is None:
            return
        _EXCLUSION_REGISTRY[_norm_key(term, relation)] = set(exclusion_set or [])


def is_excluded(term: str, relation: str, target: str,
                 run_context: Optional[RunContext] = None) -> Optional[str]:
    """None si la cible n'est pas dans l'exclusion enregistrée, sinon
    un message court qui rappelle au LLM."""
    ctx = _active_ctx(run_context)
    if ctx is not None:
        with ctx.lock:
            excl = ctx.exclusion_registry.get(_norm_key(term, relation))
    else:
        with _REGISTRY_LOCK:
            if _EXCLUSION_REGISTRY is None:
                return None
            excl = _EXCLUSION_REGISTRY.get(_norm_key(term, relation))
    if not excl:
        return None
    if _norm_target(target) in excl:
        return (
            f"Déjà vu lors du pré-fetch `list_existing_for_enrichment("
            f"term='{term}', relation_name='{relation}')`. Tu avais "
            f"la cible « {target} » dans l'exclusion_set — propose autre chose."
        )
    return None


# ---------- Validation et consolidation ----------


def validate_candidate(client: JDMClient, candidate: Candidate,
                        run_context: Optional[RunContext] = None) -> Candidate:
    """Annote le candidat avec validation_status / validation_note.

    Si `run_context` fourni, l'exclusion check lit la registry de CE run
    (pas le global). Sinon → registry global (compat).
    """
    # 1. La cible existe-t-elle dans JDM ?
    try:
        client.node_by_name(candidate.target)
    except Exception:
        candidate.validation_status = "unknown_term"
        candidate.validation_note = f"Le terme {candidate.target!r} n'existe pas dans JDM."
        return candidate

    # 1.5 FAST-PATH option A : si le pré-fetch a été fait pour ce
    # (term, relation) et que la cible y figure, on court-circuite sans
    # appeler verify_claim — message éducatif pour faire reculer le LLM.
    excl_msg = is_excluded(candidate.term, candidate.relation, candidate.target,
                            run_context=run_context)
    if excl_msg:
        candidate.validation_status = "duplicate"
        candidate.validation_note = excl_msg
        return candidate

    # 2. Le triplet existe-t-il déjà ? (= déjà couvert, rien à ajouter)
    # effort=0 : un doublon = littéralement présent — contenance stricte.
    # Cas où on arrive ici : pas de pré-fetch enregistré pour ce couple
    # (LLM a sauté l'étape, ou pre-fetch sur autre relation, etc.) — on
    # paie un appel HTTP de plus à titre de filet de sécurité.
    claim = Claim(
        text=f"{candidate.term} | {candidate.relation} | {candidate.target}",
        subject=candidate.term, relation=candidate.relation, object=candidate.target,
    )
    verdict = verify_claim(client, claim, effort=0)
    if verdict.status == Status.SUPPORTED and verdict.evidence_for:
        ev = verdict.evidence_for[0]
        if ev.target.lower().strip() == candidate.target.lower().strip():
            candidate.validation_status = "duplicate"
            candidate.validation_note = (
                f"Déjà présent : {ev.source} | {ev.relation} | {ev.target} (w={ev.w:.0f})."
            )
            return candidate

    # 3. Incohérence directe ? (triplet explicitement nié dans JDM, w<0)
    if verdict.status == Status.CONTRADICTED:
        candidate.validation_status = "inconsistent"
        candidate.validation_note = f"Contradiction JDM directe : {verdict.explanation}"
        candidate.confidence = min(candidate.confidence, 0.1)
        return candidate

    # 4. OK structurellement
    candidate.validation_status = "ok"
    candidate.validation_note = (
        "Validé structurellement — non-dupliqué, cible connue de JDM, "
        "aucune négation directe."
    )
    return candidate


def consolidate_candidate(client: JDMClient, candidate: Candidate, *,
                          effort: int = 1,
                          budget: Optional[int] = None,
                          run_context: Optional[RunContext] = None) -> Candidate:
    """Consolide un candidat par INFÉRENCE dans le réseau JDM.

    Tente de déduire le triplet à partir du graphe :
      * déduit  → `consolidation_status = "consolidated"` (prêt pour soumission)
      * réfuté  → `"rejected"` (+ confidence abaissée)
      * silence → `"not_consolidated"` (« pas forcément faux » — simplement
        non démontrable par les schémas actuels)

    La chaîne d'inférence devient `consolidation_explanation` (justification
    « oui parce que … » / « non parce que … »).
    """
    from jdm_agent.inference import infer

    res = infer(client, candidate.term, candidate.relation, candidate.target,
                effort=effort, budget=budget)

    if res.is_true:
        candidate.consolidation_status = "consolidated"
        candidate.consolidation_schema = res.fired_schema.value
        candidate.consolidation_explanation = res.explanation
        # Enregistre dans le registry partagé pour que write_submission_file
        # puisse OVERRIDER une éventuelle explanation custom du LLM par
        # cette explication formelle issue du moteur d'inférence.
        register_consolidation(
            candidate.term, candidate.relation, candidate.target,
            res.explanation, res.fired_schema.value,
            run_context=run_context,
        )
    elif res.is_false:
        candidate.consolidation_status = "rejected"
        candidate.consolidation_schema = res.fired_schema.value
        candidate.consolidation_explanation = res.explanation
        candidate.confidence = min(candidate.confidence, 0.1)
    else:
        candidate.consolidation_status = "not_consolidated"
        candidate.consolidation_schema = None
        candidate.consolidation_explanation = (
            "Inférence silencieuse — non démontré dans JDM (pas forcément faux)."
        )
    return candidate
