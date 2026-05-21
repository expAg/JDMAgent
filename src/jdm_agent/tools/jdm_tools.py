"""Outils LangChain qui exposent l'API JeuxDeMots à un agent LLM.

Chaque outil renvoie une structure JSON-serializable simple — l'agent
n'a pas à manipuler des objets Pydantic. Les docstrings sont enrichies
par les définitions parsées depuis `relation_definitions.md` pour aider
l'agent à choisir la bonne relation.

Tous les outils utilisent un `JDMClient` injecté via `set_default_client(c)`.
"""
from __future__ import annotations

import threading
from typing import Optional

from langchain_core.tools import StructuredTool, tool

from jdm_agent.client import JDMClient
from jdm_agent.client.relations import describe_relation, parse_relation_definitions


# ---------- Client injectable (thread-safe) ----------

_lock = threading.Lock()
_default_client: Optional[JDMClient] = None


def set_default_client(client: JDMClient) -> None:
    """Injecte le client utilisé par tous les tools."""
    global _default_client
    with _lock:
        _default_client = client


def _client() -> JDMClient:
    global _default_client
    with _lock:
        if _default_client is None:
            _default_client = JDMClient()
        return _default_client


# ---------- Helpers ----------

def _polarity(w: float) -> str:
    """Dérive la polarité du signe du poids (cf. relation_definitions.md §19)."""
    if w < 0:
        return "négation"
    return "affirmation"


def _make_triplet(
    src_display: str, src_id: Optional[str],
    rel: str,
    tgt_display: str, tgt_id: Optional[str],
    w: float,
    annotations: Optional[list[dict]] = None,
) -> dict:
    """Construit un triplet exposé au LLM.

    Phase 9 — ajoute `polarity` (affirmation/négation) et `annotations`.

    Les `*_id` ne sont inclus QUE si le nom est un refinement JDM (= valeur
    informative à passer pour requêter ce sens précis). Pour les termes
    simples, on garde le payload minimal.
    """
    out: dict = {
        "source": src_display,
        "relation": rel,
        "target": tgt_display,
        "w": w,
        "polarity": _polarity(w),
    }
    if src_id is not None:
        out["source_id"] = src_id
    if tgt_id is not None:
        out["target_id"] = tgt_id
    if annotations:
        out["annotations"] = annotations
    return out


def _resolve_targets(client: JDMClient, source_name: str, rel_name: str, result,
                     incoming: bool = False,
                     with_annotations: bool = False) -> list[dict]:
    """Construit la liste de triplets en résolvant les noms d'autres bouts
    ET en décodant tout refinement opaque (`avocat>116477>66699`) en clair.

    Phase 10c — annotations désactivées par défaut (gain de latence ~10×).
    Le LLM peut récupérer les annotations d'un triplet précis via l'outil
    dédié get_triplet_annotations(subject, relation, target).

    Si incoming=True (direction "to"), le terme `source_name` correspond au
    node2 des relations renvoyées, et l'autre bout à exposer est node1.
    """
    idx = result.node_index()

    # Décode le terme racine une fois pour toutes (utilisé en source ou target
    # selon `incoming`).
    src_dec = client.decode_node_name(source_name, local_nodes=idx)
    src_display = src_dec["decoded"]
    src_id_root = source_name if src_dec["is_refinement"] else None

    triplets: list[dict] = []
    # Tri |w| décroissant : positifs forts ET négatifs forts en tête de liste
    for r in sorted(result.relations, key=lambda x: -abs(x.w)):
        other_id = r.node1 if incoming else r.node2
        node = idx.get(other_id)
        if node is None:
            try:
                node = client.node_by_id(other_id)
            except Exception:
                continue
        # Skip les chunks (type 8) — agrégats syntaxiques non exposés en Phase 9.
        if node.type == 8:
            continue
        other_dec = client.decode_node_name(node.name, local_nodes=idx)
        other_display = other_dec["decoded"]
        other_id_str = node.name if other_dec["is_refinement"] else None

        # Lookup annotations (N+1 HTTP, cached)
        annotations: list[dict] = []
        if with_annotations:
            for a in client.get_annotations_for_triplet(r.id):
                annotations.append({"kind": a.kind, "value": a.value, "w": a.w})

        if incoming:
            triplets.append(_make_triplet(
                other_display, other_id_str, rel_name,
                src_display, src_id_root, r.w, annotations,
            ))
        else:
            triplets.append(_make_triplet(
                src_display, src_id_root, rel_name,
                other_display, other_id_str, r.w, annotations,
            ))
    return triplets


def _mw(v: Optional[float], _unused_default: Optional[float] = None) -> Optional[float]:
    """Résout min_weight. Si le LLM ne fournit rien (None), on transmet None
    à JDM — pas de filtre côté serveur, JDM applique son propre défaut.

    Phase 9b — aucun seuil hardcodé : seul le LLM (ou l'utilisateur via les
    CLIs) peut imposer un filtre de poids."""
    return None if v is None else float(v)


def _lim(v: Optional[int], default: int) -> int:
    """Résout limit (cardinalité, distinct du poids)."""
    return default if v is None else int(v)


# ---------- Tools ----------

@tool
def lookup_term(term: str) -> dict:
    """Cherche un terme dans JeuxDeMots et renvoie ses informations de base.

    Renvoie {id, name, decoded, type, weight} ou {error} si le terme n'existe pas.
    Si le terme est un refinement (ex: "avocat>116477>66699"), `name` reste
    l'identifiant brut et `decoded` est la forme lisible ("avocat (personne, juriste)").
    `weight` est le poids global du nœud (popularité dans JDM).
    """
    c = _client()
    try:
        n = c.node_by_name(term)
    except Exception as e:
        return {"error": f"terme inconnu : {term!r} ({e})"}
    dec = c.decode_node_name(n.name)
    return {
        "id": n.id, "name": n.name, "decoded": dec["decoded"],
        "type": n.type, "weight": n.w,
    }


@tool
def get_synonyms(term: str, min_weight: Optional[float] = None, limit: Optional[int] = None) -> list[dict]:
    """Renvoie les synonymes (`r_syn`) d'un terme.

    Synonym (`r_syn`) — termes ayant un sens identique ou très proche
    (ex.: chat | r_syn | matou ; voiture | r_syn | automobile).

    Args:
        term: le terme source (en minuscules, accentué si besoin).
        min_weight: poids minimum pour filtrer le bruit (25 par défaut). Peut être omis.
        limit: nombre maximum de résultats (20 par défaut). Peut être omis.

    Renvoie une liste de triplets [{source, relation, target, w}, ...] triés par poids.
    """
    c = _client()
    rid = c.relation_type_id("r_syn")
    res = c.relations_from(term, types_ids=[rid] if rid else None,
                           min_weight=_mw(min_weight, 0.0), limit=_lim(limit, 20))
    return _resolve_targets(c, term, "r_syn", res)


@tool
def get_antonyms(term: str, min_weight: Optional[float] = None, limit: Optional[int] = None) -> list[dict]:
    """Renvoie les antonymes (`r_anto`) d'un terme.

    Antonym (`r_anto`) — termes de sens opposés (ex.: chaud | r_anto | froid).
    """
    c = _client()
    rid = c.relation_type_id("r_anto")
    res = c.relations_from(term, types_ids=[rid] if rid else None,
                           min_weight=_mw(min_weight, 0.0), limit=_lim(limit, 20))
    return _resolve_targets(c, term, "r_anto", res)


@tool
def get_hypernyms(term: str, min_weight: Optional[float] = None, limit: Optional[int] = None) -> list[dict]:
    """Renvoie les génériques / hyperonymes (`r_isa`) d'un terme.

    Is-A (`r_isa`) — lien de généralisation : le terme cible est une catégorie
    dont le terme source fait partie (ex.: chat | r_isa | mammifère).
    Utile pour répondre "qu'est-ce qu'un X ?".
    """
    c = _client()
    rid = c.relation_type_id("r_isa")
    res = c.relations_from(term, types_ids=[rid] if rid else None,
                           min_weight=_mw(min_weight, 0.0), limit=_lim(limit, 20))
    return _resolve_targets(c, term, "r_isa", res)


@tool
def get_hyponyms(term: str, min_weight: Optional[float] = None, limit: Optional[int] = None) -> list[dict]:
    """Renvoie les spécifiques / hyponymes (`r_hypo`) d'un terme.

    Hyponym (`r_hypo`) — le terme cible est une sous-catégorie ou un exemple
    du terme source (ex.: insecte | r_hypo | mouche).
    Utile pour lister les exemples d'une catégorie.
    """
    c = _client()
    rid = c.relation_type_id("r_hypo")
    res = c.relations_from(term, types_ids=[rid] if rid else None,
                           min_weight=_mw(min_weight, 0.0), limit=_lim(limit, 30))
    return _resolve_targets(c, term, "r_hypo", res)


@tool
def get_parts(term: str, min_weight: Optional[float] = None, limit: Optional[int] = None) -> list[dict]:
    """Renvoie les parties / composants (`r_has_part`) d'un terme.

    Has-Part (`r_has_part`) — la cible est une partie, un constituant ou un
    membre du terme source (ex.: voiture | r_has_part | roue).
    """
    c = _client()
    rid = c.relation_type_id("r_has_part")
    res = c.relations_from(term, types_ids=[rid] if rid else None,
                           min_weight=_mw(min_weight, 0.0), limit=_lim(limit, 30))
    return _resolve_targets(c, term, "r_has_part", res)


@tool
def get_characteristics(term: str, min_weight: Optional[float] = None, limit: Optional[int] = None) -> list[dict]:
    """Renvoie les caractéristiques (`r_carac`) d'un terme.

    Characteristic (`r_carac`) — attributs ou adjectifs qualificatifs typiques
    (ex.: eau | r_carac | liquide ; neige | r_carac | blanche).
    """
    c = _client()
    rid = c.relation_type_id("r_carac")
    res = c.relations_from(term, types_ids=[rid] if rid else None,
                           min_weight=_mw(min_weight, 0.0), limit=_lim(limit, 30))
    return _resolve_targets(c, term, "r_carac", res)


@tool
def get_relations_of_type(
    term: str,
    relation_name: str,
    direction: str = "from",
    min_weight: Optional[float] = None,
    limit: Optional[int] = None,
) -> list[dict]:
    """Renvoie les relations d'un type donné pour un terme, dans une direction.

    Utilise ce tool pour TOUTE relation JDM qui n'a pas son propre outil dédié :
    r_lieu, r_agent, r_patient, r_instr, r_has_color, r_make, r_telic_role,
    r_against, r_sentiment, r_has_conseq, r_has_causatif, r_can_eat, etc.
    (180+ types — voir relation_definitions.md).

    Args:
        term: le terme source ou cible.
        relation_name: nom technique de la relation (commence par "r_", ex. "r_lieu").
        direction: "from" (relations sortantes du terme) ou "to" (entrantes vers lui).
        min_weight: filtrage (25 par défaut).
        limit: max résultats (30 par défaut).
    """
    c = _client()
    rid = c.relation_type_id(relation_name)
    if rid is None:
        return [{"error": f"relation inconnue: {relation_name!r}"}]
    incoming = direction == "to"
    mw, lm = _mw(min_weight, 0.0), _lim(limit, 30)
    if incoming:
        res = c.relations_to(term, types_ids=[rid], min_weight=mw, limit=lm)
    else:
        res = c.relations_from(term, types_ids=[rid], min_weight=mw, limit=lm)
    return _resolve_targets(c, term, relation_name, res, incoming=incoming)


@tool
def get_relations_between(term1: str, term2: str, min_weight: Optional[float] = None) -> list[dict]:
    """Renvoie toutes les relations entre deux termes (term1 → term2).

    Utile pour répondre "quel est le rapport entre A et B ?".
    Les éventuels refinements (ex: "avocat>116477>66699") sont décodés
    en clair ("avocat (personne, juriste)") avec leur ID préservé dans
    `source_id`/`target_id`.
    """
    c = _client()
    res = c.relations_between(term1, term2, min_weight=_mw(min_weight, 0.0))
    idx = res.node_index()
    src_dec = c.decode_node_name(term1, local_nodes=idx)
    tgt_dec = c.decode_node_name(term2, local_nodes=idx)
    src_id = term1 if src_dec["is_refinement"] else None
    tgt_id = term2 if tgt_dec["is_refinement"] else None
    out: list[dict] = []
    for r in sorted(res.relations, key=lambda x: -x.w):
        rname = c.relation_type_name(r.type) or f"type_{r.type}"
        out.append(_make_triplet(
            src_dec["decoded"], src_id, rname,
            tgt_dec["decoded"], tgt_id, r.w,
        ))
    return out


@tool
def disambiguate(term: str) -> list[dict]:
    """Renvoie les sens (raffinements sémantiques) d'un terme polysémique, décodés en clair.

    Utilise ceci quand un mot a plusieurs sens (avocat = fruit | juriste,
    souris = animal | informatique, police = force de l'ordre | typographie, etc.).
    Les IDs internes JDM sont automatiquement résolus en labels humains.

    Renvoie [{sense, sense_id, path, weight}, ...] triés par poids décroissant :
      - `sense`    : forme lisible (ex. "avocat (personne, juriste)") — À CITER À L'UTILISATEUR
      - `sense_id` : identifiant brut JDM (ex. "avocat>116477>66699") —
        à RÉ-UTILISER comme `term` dans les outils suivants pour requêter ce sens précis
      - `path`     : chaîne hiérarchique (["avocat", "personne", "juriste"])
      - `weight`   : pertinence du sens dans JDM

    Workflow typique :
      1. disambiguate("avocat") → tu vois le sens dominant "avocat (personne, juriste)"
         avec sense_id "avocat>116477>66699"
      2. get_synonyms(term="avocat>116477>66699") pour les synonymes du juriste
         (et non du fruit).
    """
    c = _client()
    decoded = c.refinements_decoded(term)
    decoded.sort(key=lambda d: -d.weight)
    return [
        {
            "sense": d.decoded,
            "sense_id": d.name,
            "path": d.path,
            "weight": d.weight,
        }
        for d in decoded
    ]


# ---------- Outils prédicatifs (actanciels / causaux / téliques) ----------

def _predicative_lookup(
    term: str, relation: str, direction: str,
    min_weight: Optional[float], limit: Optional[int],
    default_mw: float = 0.0, default_limit: int = 20,
) -> list[dict]:
    """Helper factor pour tous les outils prédicatifs."""
    c = _client()
    rid = c.relation_type_id(relation)
    if rid is None:
        return [{"error": f"relation {relation!r} introuvable dans JDM"}]
    mw, lm = _mw(min_weight, default_mw), _lim(limit, default_limit)
    incoming = direction == "to"
    if incoming:
        res = c.relations_to(term, types_ids=[rid], min_weight=mw, limit=lm)
    else:
        res = c.relations_from(term, types_ids=[rid], min_weight=mw, limit=lm)
    return _resolve_targets(c, term, relation, res, incoming=incoming)


@tool
def get_agents(verb: str, min_weight: Optional[float] = None, limit: Optional[int] = None) -> list[dict]:
    """Renvoie les SUJETS typiques d'un verbe (`r_agent`).

    Agent (`r_agent`) — entité qui effectue l'action (sujet du verbe).
    Le terme source DOIT être un verbe à l'infinitif.
    Pour un PRÉDICAT NOMINAL DE PROCESSUS (lecture, nettoyage, enseignement,
    chasse, ...), utilise plutôt get_process_agents (qui interroge
    r_processus>agent au lieu de r_agent).
    (ex.: manger | r_agent | chat ; voler | r_agent | oiseau ; courir | r_agent | sportif).
    """
    return _predicative_lookup(verb, "r_agent", "from", min_weight, limit)


@tool
def get_patients(verb: str, min_weight: Optional[float] = None, limit: Optional[int] = None) -> list[dict]:
    """Renvoie les OBJETS typiques d'un verbe (`r_patient`).

    Patient (`r_patient`) — entité qui subit l'action (COD du verbe).
    Le terme source DOIT être un verbe à l'infinitif.
    Pour un PRÉDICAT NOMINAL DE PROCESSUS (découpe, soin, récolte, ...),
    utilise plutôt get_process_patients (qui interroge r_processus>patient).
    (ex.: manger | r_patient | viande ; lire | r_patient | livre ; réparer | r_patient | voiture).
    """
    return _predicative_lookup(verb, "r_patient", "from", min_weight, limit)


@tool
def get_instruments(verb: str, min_weight: Optional[float] = None, limit: Optional[int] = None) -> list[dict]:
    """Renvoie les INSTRUMENTS typiques d'un verbe (`r_instr`).

    Instrument (`r_instr`) — objet utilisé pour réaliser l'action.
    Le terme source DOIT être un verbe à l'infinitif.
    Pour un PRÉDICAT NOMINAL DE PROCESSUS (découpe, transport,
    communication, ...), utilise plutôt get_process_instruments
    (qui interroge r_processus>instr).
    (ex.: couper | r_instr | couteau ; écrire | r_instr | stylo ; peindre | r_instr | pinceau).
    """
    return _predicative_lookup(verb, "r_instr", "from", min_weight, limit)


@tool
def get_locations(term: str, min_weight: Optional[float] = None, limit: Optional[int] = None) -> list[dict]:
    """Renvoie les LIEUX typiques associés à un terme (`r_lieu`).

    Lieu (`r_lieu`) — où se trouve l'objet ou se déroule l'action.
    Le terme source peut être un NOM ou un VERBE à l'infinitif (les deux sont
    valides côté JDM).
    (ex.: carotte | r_lieu | potager ; poisson | r_lieu | mer ;
     étudier | r_lieu | école).
    """
    return _predicative_lookup(term, "r_lieu", "from", min_weight, limit)


@tool
def get_consequences(term: str, min_weight: Optional[float] = None, limit: Optional[int] = None) -> list[dict]:
    """Renvoie les CONSÉQUENCES typiques d'un état ou d'une action (`r_has_conseq`).

    Conséquence (`r_has_conseq`) — effet ou suite directe de A.
    Le terme source peut être un NOM (événement, état) ou un VERBE à l'infinitif.
    (ex.: tomber | r_has_conseq | se blesser ; pluie | r_has_conseq | inondation ;
     étudier | r_has_conseq | réussir).
    """
    return _predicative_lookup(term, "r_has_conseq", "from", min_weight, limit)


@tool
def get_manner(verb: str, min_weight: Optional[float] = None, limit: Optional[int] = None) -> list[dict]:
    """Renvoie les MANIÈRES typiques dont une action s'effectue (`r_manner`).

    Manner (`r_manner`) — adverbe ou locution adverbiale décrivant comment.
    Le terme source DOIT être un PRÉDICAT (une action). Deux formes valides :
      - verbe à l'infinitif : manger, courir, parler
      - prédicat nominal de processus (nom déverbal) : lecture, marche,
        nettoyage, enseignement
    Pour décrire un nom non-prédicatif (objet ou entité statique :
    chat, voiture, ...), utilise plutôt get_characteristics.
    (ex.: manger | r_manner | goulûment ; courir | r_manner | rapidement ;
     lecture | r_manner | attentivement).
    """
    return _predicative_lookup(verb, "r_manner", "from", min_weight, limit)


@tool
def get_telic_role(noun: str, min_weight: Optional[float] = None, limit: Optional[int] = None) -> list[dict]:
    """Renvoie la FONCTION (rôle télique) d'un objet (`r_telic_role`).

    Telic-role (`r_telic_role`) — fonction primaire pour laquelle un objet a été conçu.
    Le terme source DOIT être un NOM (artefact, objet, parfois objet naturel).
    Renvoie des VERBES à l'infinitif (la fonction de l'objet).
    (ex.: couteau | r_telic_role | couper ; chaise | r_telic_role | s'asseoir ;
     lunettes | r_telic_role | voir ; soleil | r_telic_role | éclairer).
    """
    return _predicative_lookup(noun, "r_telic_role", "from", min_weight, limit)


# ---------- Variantes "processus" pour les prédicats nominaux ----------

@tool
def get_process_agents(process_noun: str, min_weight: Optional[float] = None, limit: Optional[int] = None) -> list[dict]:
    """Renvoie les AGENTS typiques d'un PROCESSUS exprimé par un nom (`r_processus>agent`).

    Équivalent nominal de get_agents : pour les verbes à l'infinitif, utilise
    plutôt get_agents (qui interroge r_agent).
    Le terme source DOIT être un nom déverbal de processus / d'événement
    (lecture, nettoyage, enseignement, chasse, opération, ...).
    (ex.: nettoyage | r_processus>agent | technicien de surface ;
     enseignement | r_processus>agent | professeur ;
     chirurgie | r_processus>agent | chirurgien).
    """
    return _predicative_lookup(process_noun, "r_processus>agent", "from", min_weight, limit)


@tool
def get_process_patients(process_noun: str, min_weight: Optional[float] = None, limit: Optional[int] = None) -> list[dict]:
    """Renvoie les PATIENTS typiques d'un PROCESSUS exprimé par un nom (`r_processus>patient`).

    Équivalent nominal de get_patients. Le terme source DOIT être un nom
    déverbal de processus.
    (ex.: découpe | r_processus>patient | viande ;
     soin | r_processus>patient | malade ;
     récolte | r_processus>patient | blé).
    """
    return _predicative_lookup(process_noun, "r_processus>patient", "from", min_weight, limit)


@tool
def get_process_instruments(process_noun: str, min_weight: Optional[float] = None, limit: Optional[int] = None) -> list[dict]:
    """Renvoie les INSTRUMENTS typiques d'un PROCESSUS exprimé par un nom (`r_processus>instr`).

    Équivalent nominal de get_instruments. Le terme source DOIT être un nom
    déverbal de processus.
    (ex.: découpe | r_processus>instr | couteau ;
     transport | r_processus>instr | camion ;
     communication | r_processus>instr | téléphone).
    """
    return _predicative_lookup(process_noun, "r_processus>instr", "from", min_weight, limit)


# ---------- Inverses verbo-nominaux (Phase 10a) ----------
# Pour les questions du type "que peut faire X" / "que peut-on faire à X" / etc.,
# où X est un NOM. Sans ces outils dédiés, le LLM tombe sur get_relations_of_type
# qui est générique et moins lisible.

@tool
def get_actions_of(noun: str, min_weight: Optional[float] = None, limit: Optional[int] = None) -> list[dict]:
    """Renvoie les ACTIONS qu'un sujet peut typiquement effectuer (`r_agent-1`).

    Action-of-agent (`r_agent-1`) — inverse de r_agent. À partir d'un sujet
    (un NOM), liste les verbes que ce sujet peut typiquement faire.
    Le terme source DOIT être un nom commun ou propre désignant un agent
    potentiel. Cible des verbes à l'infinitif.
    (ex.: chat | r_agent-1 | miauler ; oiseau | r_agent-1 | voler ;
     sportif | r_agent-1 | courir).
    """
    return _predicative_lookup(noun, "r_agent-1", "from", min_weight, limit)


@tool
def get_actions_on(noun: str, min_weight: Optional[float] = None, limit: Optional[int] = None) -> list[dict]:
    """Renvoie les ACTIONS que l'on peut typiquement effectuer SUR un objet (`r_patient-1`).

    Action-on-patient (`r_patient-1`) — inverse de r_patient. À partir d'un objet
    (un NOM), liste les verbes dont ce nom peut être le COD typique.
    Le terme source DOIT être un nom (objet, patient potentiel).
    (ex.: pomme | r_patient-1 | manger ; livre | r_patient-1 | lire ;
     voiture | r_patient-1 | réparer).
    """
    return _predicative_lookup(noun, "r_patient-1", "from", min_weight, limit)


@tool
def get_uses_with(noun: str, min_weight: Optional[float] = None, limit: Optional[int] = None) -> list[dict]:
    """Renvoie les ACTIONS que l'on peut typiquement effectuer AVEC un instrument (`r_instr-1`).

    Use-of-instrument (`r_instr-1`) — inverse de r_instr. À partir d'un instrument
    (un NOM), liste les verbes dont ce nom peut être l'instrument typique.
    Complète get_telic_role pour les usages non-définitionnels (un objet peut
    avoir un rôle télique unique mais plusieurs usages instrumentaux variés).
    (ex.: couteau | r_instr-1 | couper ; pierre | r_instr-1 | lapider ;
     stylo | r_instr-1 | écrire).
    """
    return _predicative_lookup(noun, "r_instr-1", "from", min_weight, limit)


@tool
def get_domain_members(domain: str, min_weight: Optional[float] = None, limit: Optional[int] = None) -> list[dict]:
    """Renvoie les TERMES qui relèvent d'un DOMAINE donné (`r_domain-1`).

    Domain-To-Term (`r_domain-1`) — inverse de r_domain. À partir d'un domaine
    de connaissance ou d'activité, liste les termes spécifiques qui en relèvent.
    (ex.: football | r_domain-1 | corner ; chirurgie | r_domain-1 | scalpel ;
     musique | r_domain-1 | octave).
    """
    return _predicative_lookup(domain, "r_domain-1", "from", min_weight, limit)


# ---------- Annotations sémantiques (opt-in) ----------

@tool
def get_triplet_annotations(subject: str, relation: str, target: str) -> list[dict]:
    """Renvoie les annotations sémantiques attachées à un triplet précis.

    À appeler quand tu veux comprendre les nuances d'un triplet particulier :
    nature contrastive, exception, qualification (constitutif, probable, etc.).
    Les outils d'exploration de base ne récupèrent PAS les annotations (raison
    de performance) — cet outil dédié les charge à la demande.

    Mécanisme : à partir du triplet (subject, relation, target), retrouve son
    identifiant interne, puis interroge le nœud d'ancrage `:r{id}` pour
    extraire les annotations (cf. relation_definitions.md §20).

    Args:
        subject:  le terme source du triplet (ex. "chat")
        relation: la relation JDM (ex. "r_isa", "r_has_part")
        target:   le terme cible (ex. "mammifère")

    Renvoie [] si le triplet n'existe pas dans JDM ou n'a aucune annotation.
    Sinon liste de {kind, value, w} :
        - kind  ∈ {"annotation", "context", "exception"}
        - value : le contenu de l'annotation (ex. "contrastif", "constitutif")
        - w     : poids consensuel de cette annotation (signé)
    """
    c = _client()
    # Résoud le triplet pour obtenir son rel_id
    try:
        rid_type = c.relation_type_id(relation)
        if rid_type is None:
            return [{"error": f"relation inconnue : {relation!r}"}]
        res = c.relations_between(subject, target, types_ids=[rid_type], limit=10)
    except Exception:
        return []
    idx = res.node_index()
    # On cherche le triplet dont node2 matche target (ou son décodage)
    matching = None
    target_norm = target.strip().lower()
    for r in res.relations:
        n2 = idx.get(r.node2)
        if n2 is None:
            continue
        if n2.name.strip().lower() == target_norm:
            matching = r
            break
        dec = c.decode_node_name(n2.name, local_nodes=idx)
        if dec["is_refinement"] and dec["decoded"].strip().lower() == target_norm:
            matching = r
            break
    if matching is None:
        return [{"error": f"triplet {subject!r} | {relation} | {target!r} non trouvé"}]
    # Lookup des annotations
    annots = c.get_annotations_for_triplet(matching.id)
    return [{"kind": a.kind, "value": a.value, "w": a.w} for a in annots]


# ---------- Enrichissement actif ----------

@tool
def detect_gaps(
    term: str,
    relations: Optional[list[str]] = None,
    check_asymmetries: bool = True,
) -> list[dict]:
    """Détecte les trous de couverture de JDM pour un terme donné.

    Trois types de gaps :
      - MISSING       : aucun triplet (term, relation, ?) — relation jugée pertinente mais vide
      - LOW_COVERAGE  : très peu de triplets (< 3 avec w≥25)
      - ASYMMETRY     : un triplet A r_xxx B existe MAIS l'inverse B r_inv A manque
                        (utilise 11 paires connues: r_has_part/r_holo, r_isa/r_hypo,
                        r_agent/r_agent-1, r_make/r_product_of, etc.)

    PAS d'appel LLM — déterministe, ~5-15 secondes par terme selon couverture.

    Workflow typique d'enrichissement :
      1. detect_gaps("smartphone") → liste de gaps
      2. (toi, le LLM) → propose des cibles plausibles pour chaque gap, en
         utilisant ta connaissance du français
      3. validate_candidate(term, relation, target) pour chaque proposition →
         garde uniquement celles qui sont "ok" (pas dupliquées, cible existe, non
         contradictoires)

    Args:
        term: terme à analyser.
        relations: relations à inspecter (défaut: jeu standard noun+verb).
                   Exemples: ["r_has_part", "r_carac", "r_telic_role"].
        check_asymmetries: active la détection des inverses manquants (plus coûteux).

    Renvoie [{term, relation, gap_type, severity, detail, related_triples}, ...].
    """
    from jdm_agent.enrich import detect_gaps as _detect

    c = _client()
    gaps = _detect(c, term, target_relations=relations, check_asymmetries=check_asymmetries)
    return [g.model_dump(mode="json") for g in gaps]


@tool
def validate_candidate(term: str, relation: str, target: str) -> dict:
    """Vérifie si un triplet candidat peut/doit être ajouté à JDM.

    Quatre statuts possibles :
      - "ok"           : prêt à soumettre (cible connue, pas duplicate, pas contradictoire)
      - "duplicate"    : le triplet existe déjà dans JDM (rien à ajouter)
      - "unknown_term" : la cible n'existe pas comme nœud JDM (LLM a halluciné un mot
                         absent du graphe ; ne pas soumettre tel quel)
      - "inconsistent" : contradicted par r_isa-incompatible ou similaire

    Utilise cet outil APRÈS avoir proposé toi-même un candidat (à partir de
    `detect_gaps` + ta connaissance), pour éviter de soumettre du bruit ou
    des doublons.

    Args:
        term:     terme source.
        relation: relation JDM (r_xxx).
        target:   terme cible proposé.

    Renvoie un Candidate avec validation_status + validation_note + confidence.
    """
    from jdm_agent.enrich import Candidate
    from jdm_agent.enrich.validators import validate_candidate as _validate

    c = _client()
    cand = Candidate(term=term, relation=relation, target=target,
                     confidence=0.5, source="agent")
    out = _validate(c, cand)
    return out.model_dump(mode="json")


# ---------- Vérification de claims (fact-checking) ----------

@tool
def verify_claim(subject: str, relation: str, object: str, polarity: bool = True) -> dict:
    """Vérifie un triplet factuel contre le graphe JDM (fact-check déterministe).

    Renvoie un verdict structuré avec statut, confiance, évidence et explication.
    PAS d'appel LLM — la décision est entièrement basée sur les données JDM.

    Args:
        subject:  terme source (ex. "baleine", "chat", "sang", verbe à l'infinitif).
        relation: relation JDM (ex. "r_isa", "r_carac", "r_has_color", "r_has_part").
        object:   terme cible (ex. "poisson", "rouge", "roue").
        polarity: True pour affirmation, False pour négation ("ne ... pas").

    Statuts possibles :
      - "supported"    : JDM contient le triplet (ou un proche via synonymie)
      - "contradicted" : JDM contient une information incompatible
                         (typiquement via r_isa-incompatible)
      - "unknown"      : JDM ne dit rien → ne PAS interpréter comme faux

    Renvoie {claim, status, confidence (0-1), explanation, evidence_for, evidence_against}.

    Exemples :
      verify_claim("baleine", "r_isa", "poisson")  → contradicted (mammifère incompatible)
      verify_claim("sang", "r_has_color", "rouge") → supported (w=341)
      verify_claim("xyzzy", "r_isa", "truc")       → unknown
    """
    # Import local pour éviter une dépendance circulaire au chargement du module.
    from jdm_agent.factcheck import Claim
    from jdm_agent.factcheck.verifier import verify_claim as _verify

    c = _client()
    claim = Claim(
        text=f"{subject} | {relation} | {object}",
        subject=subject, relation=relation, object=object, polarity=polarity,
    )
    verdict = _verify(c, claim)
    return verdict.model_dump(mode="json")


# ---------- Découverte ----------

@tool
def list_relation_types(prefix: Optional[str] = None) -> list[dict]:
    """Liste les types de relations JDM disponibles (filtrage optionnel par préfixe).

    Permet à l'agent de découvrir quelles relations existent quand il n'est pas
    sûr du nom. Renvoie [{name, id, help}, ...].
    """
    c = _client()
    out = []
    pfx = prefix or ""
    for rt in c.relation_types():
        if pfx and not rt.name.startswith(pfx):
            continue
        out.append({"name": rt.name, "id": rt.id, "help": (rt.help or "")[:120]})
    return sorted(out, key=lambda d: d["name"])


# ---------- Visualisation de sous-graphe ----------

@tool
def build_subgraph_visualization(
    term: str,
    depth: int = 2,
    top_k_per_relation: int = 6,
    min_weight: Optional[float] = None,
    relations: Optional[list[str]] = None,
    depth2_relations: Optional[list[str]] = None,
    output: str = "html",
    output_path: Optional[str] = None,
) -> dict:
    """Construit un sous-graphe JDM autour d'un terme et le sérialise.

    Très utile pour explorer visuellement l'entourage sémantique d'un concept :
    catégories (r_isa), exemples (r_hypo), parties (r_has_part), lieux,
    caractéristiques, verbes appliqués, etc., sur 1 ou 2 niveaux de profondeur.

    Par défaut, explore les 11 relations standards à la profondeur 1, puis
    un sous-ensemble (has_part, lieu, carac, hypo) à la profondeur 2. Les
    négations (poids négatifs) sont rendues en rouge et préfixées « NON ».

    Args:
        term: le terme racine (ex. "plat asiatique").
        depth: 1 ou 2 (3 max, mais déconseillé — graphe illisible).
        top_k_per_relation: nb max de cibles retenues par relation et par nœud.
        min_weight: poids minimum, None = pas de filtre (JDM décide).
        relations: relations explorées à la profondeur 1. Défaut = jeu standard
                   (r_isa, r_hypo, r_syn, r_anto, r_carac, r_has_part, r_lieu,
                    r_patient-1, r_agent-1, r_domain, r_associated).
        depth2_relations: relations explorées à la profondeur 2.
                          Défaut = (r_has_part, r_lieu, r_carac, r_hypo).
        output: "html" → écrit un fichier HTML autonome (vis-network) et
                renvoie {root, stats, html_path}.
                "json" → renvoie {root, stats, nodes, edges} prêt à embarquer
                dans un rendu côté client.
        output_path: chemin du fichier HTML (défaut = `<slug>_subgraph.html`
                     dans le répertoire courant).

    Renvoie un dict avec :
        - root: terme racine
        - stats: {n_nodes, n_edges, n_negative, relations_used, depth}
        - html_path (output="html") ou nodes/edges (output="json")
    """
    from jdm_agent.viz.subgraph import build_subgraph as _build
    if output not in ("html", "json"):
        return {"error": f"output doit valoir 'html' ou 'json', reçu {output!r}"}
    try:
        return _build(
            term,
            client=_client(),
            depth=depth,
            top_k_per_relation=top_k_per_relation,
            min_weight=min_weight,
            relations=relations,
            depth2_relations=depth2_relations,
            output=output,  # type: ignore[arg-type]
            output_path=output_path,
        )
    except Exception as e:
        return {"error": f"echec construction sous-graphe pour {term!r} : {e}"}


# ---------- Registry ----------

ALL_TOOLS: list[StructuredTool] = [
    lookup_term,
    get_synonyms,
    get_antonyms,
    get_hypernyms,
    get_hyponyms,
    get_parts,
    get_characteristics,
    # Prédicatifs verbaux
    get_agents,
    get_patients,
    get_instruments,
    get_locations,
    get_consequences,
    get_manner,
    get_telic_role,
    # Prédicatifs nominaux (processus)
    get_process_agents,
    get_process_patients,
    get_process_instruments,
    # Inverses verbo-nominaux (« que peut faire X »)
    get_actions_of,
    get_actions_on,
    get_uses_with,
    get_domain_members,
    # Génériques
    get_relations_of_type,
    get_relations_between,
    disambiguate,
    # Fact-checking + annotations
    verify_claim,
    get_triplet_annotations,
    # Enrichissement
    detect_gaps,
    validate_candidate,
    list_relation_types,
    # Visualisation
    build_subgraph_visualization,
]


def build_jdm_tools(
    client: Optional[JDMClient] = None,
    enrich_docstrings: bool = True,
) -> list[StructuredTool]:
    """Renvoie la liste des outils LangChain, optionnellement avec docstrings
    enrichies des définitions tirées de `relation_definitions.md`.
    """
    if client is not None:
        set_default_client(client)
    if not enrich_docstrings:
        return list(ALL_TOOLS)

    docs = parse_relation_definitions()
    suffix_map = {
        "get_synonyms": "r_syn",
        "get_antonyms": "r_anto",
        "get_hypernyms": "r_isa",
        "get_hyponyms": "r_hypo",
        "get_parts": "r_has_part",
        "get_characteristics": "r_carac",
        "get_agents": "r_agent",
        "get_patients": "r_patient",
        "get_instruments": "r_instr",
        "get_locations": "r_lieu",
        "get_consequences": "r_has_conseq",
        "get_manner": "r_manner",
        "get_telic_role": "r_telic_role",
        "get_process_agents": "r_processus>agent",
        "get_process_patients": "r_processus>patient",
        "get_process_instruments": "r_processus>instr",
        "get_actions_of":     "r_agent-1",
        "get_actions_on":     "r_patient-1",
        "get_uses_with":      "r_instr-1",
        "get_domain_members": "r_domain-1",
    }
    for t in ALL_TOOLS:
        rel = suffix_map.get(t.name)
        if rel and docs.get(rel):
            t.description = f"{t.description}\n\n[JDM] {describe_relation(rel, docs)}"
    return list(ALL_TOOLS)
