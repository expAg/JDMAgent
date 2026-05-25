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
                     with_annotations: bool = False,
                     limit: Optional[int] = None) -> list[dict]:
    """Construit la liste de triplets en résolvant les noms d'autres bouts
    ET en décodant tout refinement opaque (`avocat>116477>66699`) en clair.

    Phase 10c — annotations désactivées par défaut (gain de latence ~10×).
    Le LLM peut récupérer les annotations d'un triplet précis via l'outil
    dédié get_triplet_annotations(subject, relation, target).

    Si incoming=True (direction "to"), le terme `source_name` correspond au
    node2 des relations renvoyées, et l'autre bout à exposer est node1.

    IMPORTANT — bug API JDM : `/v0/relations/from?limit=N` tronque AVANT le
    tri par poids, donc passer `limit` à l'API fait perdre les triplets les
    plus forts (cf. guitare/r_isa : sans tri, "instrument de musique" w=1000
    disparaît alors que c'est le top hit). Solution : on ne passe JAMAIS
    `limit` à l'API, on récupère tout, on trie par |w| ici, puis on tronque
    via le paramètre `limit` de cette fonction.
    """
    idx = result.node_index()

    # Décode le terme racine une fois pour toutes (utilisé en source ou target
    # selon `incoming`).
    src_dec = client.decode_node_name(source_name, local_nodes=idx)
    src_display = src_dec["decoded"]
    src_id_root = source_name if src_dec["is_refinement"] else None

    triplets: list[dict] = []
    # Tri |w| décroissant : positifs forts ET négatifs forts en tête de liste.
    # On itère sur TOUT (l'API n'est plus tronquée) puis on tronque à la fin.
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
    # Tronque APRÈS le tri par poids (cf. note ci-dessus sur le bug API JDM).
    if limit is not None and limit > 0:
        triplets = triplets[:limit]
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
    lm = _lim(limit, 20)
    res = c.relations_from(term, types_ids=[rid] if rid else None,
                           min_weight=_mw(min_weight, 0.0))
    return _resolve_targets(c, term, "r_syn", res, limit=lm)


@tool
def get_antonyms(term: str, min_weight: Optional[float] = None, limit: Optional[int] = None) -> list[dict]:
    """Renvoie les antonymes (`r_anto`) d'un terme.

    Antonym (`r_anto`) — termes de sens opposés (ex.: chaud | r_anto | froid).
    """
    c = _client()
    rid = c.relation_type_id("r_anto")
    lm = _lim(limit, 20)
    res = c.relations_from(term, types_ids=[rid] if rid else None,
                           min_weight=_mw(min_weight, 0.0))
    return _resolve_targets(c, term, "r_anto", res, limit=lm)


@tool
def get_hypernyms(term: str, min_weight: Optional[float] = None, limit: Optional[int] = None) -> list[dict]:
    """Renvoie les génériques / hyperonymes (`r_isa`) d'un terme.

    Is-A (`r_isa`) — lien de généralisation : le terme cible est une catégorie
    dont le terme source fait partie (ex.: chat | r_isa | mammifère).
    Utile pour répondre "qu'est-ce qu'un X ?".
    """
    c = _client()
    rid = c.relation_type_id("r_isa")
    lm = _lim(limit, 20)
    res = c.relations_from(term, types_ids=[rid] if rid else None,
                           min_weight=_mw(min_weight, 0.0))
    return _resolve_targets(c, term, "r_isa", res, limit=lm)


@tool
def get_hyponyms(term: str, min_weight: Optional[float] = None, limit: Optional[int] = None) -> list[dict]:
    """Renvoie les spécifiques / hyponymes (`r_hypo`) d'un terme.

    Hyponym (`r_hypo`) — le terme cible est une sous-catégorie ou un exemple
    du terme source (ex.: insecte | r_hypo | mouche).
    Utile pour lister les exemples d'une catégorie.
    """
    c = _client()
    rid = c.relation_type_id("r_hypo")
    lm = _lim(limit, 30)
    res = c.relations_from(term, types_ids=[rid] if rid else None,
                           min_weight=_mw(min_weight, 0.0))
    return _resolve_targets(c, term, "r_hypo", res, limit=lm)


@tool
def get_parts(term: str, min_weight: Optional[float] = None, limit: Optional[int] = None) -> list[dict]:
    """Renvoie les parties / composants (`r_has_part`) d'un terme.

    Has-Part (`r_has_part`) — la cible est une partie, un constituant ou un
    membre du terme source (ex.: voiture | r_has_part | roue).
    """
    c = _client()
    rid = c.relation_type_id("r_has_part")
    lm = _lim(limit, 30)
    res = c.relations_from(term, types_ids=[rid] if rid else None,
                           min_weight=_mw(min_weight, 0.0))
    return _resolve_targets(c, term, "r_has_part", res, limit=lm)


@tool
def get_characteristics(term: str, min_weight: Optional[float] = None, limit: Optional[int] = None) -> list[dict]:
    """Renvoie les caractéristiques (`r_carac`) d'un terme.

    Characteristic (`r_carac`) — attributs ou adjectifs qualificatifs typiques
    (ex.: eau | r_carac | liquide ; neige | r_carac | blanche).
    """
    c = _client()
    rid = c.relation_type_id("r_carac")
    lm = _lim(limit, 30)
    res = c.relations_from(term, types_ids=[rid] if rid else None,
                           min_weight=_mw(min_weight, 0.0))
    return _resolve_targets(c, term, "r_carac", res, limit=lm)


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

    Pratique en flux d'enrichissement : si la relation ciblée n'a pas
    d'outil dédié, c'est le bon outil pour jeter un œil rapide à ce qui
    existe déjà avant de proposer (évite les doublons).

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
        res = c.relations_to(term, types_ids=[rid], min_weight=mw)
    else:
        res = c.relations_from(term, types_ids=[rid], min_weight=mw)
    return _resolve_targets(c, term, relation_name, res, incoming=incoming, limit=lm)


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
        res = c.relations_to(term, types_ids=[rid], min_weight=mw)
    else:
        res = c.relations_from(term, types_ids=[rid], min_weight=mw)
    return _resolve_targets(c, term, relation, res, incoming=incoming, limit=lm)


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

    Manner (`r_manner`) — adverbe ou locution adverbiale décrivant COMMENT 
    peut on faire l'action du terme source.
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
        # Pas de limit côté API (cf. bug : JDM tronque AVANT le tri par poids).
        # Le volume est de toute façon faible (relations entre 2 termes précis).
        res = c.relations_between(subject, target, types_ids=[rid_type])
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
    min_coverage: int = 3,
) -> list[dict]:
    """Détecte les trous de couverture de JDM pour un terme donné.

    ⚠️ TERME OBLIGATOIRE — RÈGLE NON-NÉGOCIABLE :
    Si l'utilisateur a indiqué SEULEMENT une relation (ex. « détecte les
    trous pour r_holo », « r_telic_role »...) SANS donner de terme, NE LUI
    DEMANDE PAS de terme. NE LUI POSE PAS DE QUESTION. À la place :
      1. tire toi-même un mot français au hasard. VARIE VRAIMENT — d'un
         essai à l'autre, et d'une session à l'autre. La langue française
         et JDM sont infiniment riches : ne te limite à aucun registre,
         change de domaine, de longueur, de niveau d'abstraction ;
      2. vérifie qu'il existe dans JDM via `lookup_term` ;
      3. appelle `detect_gaps` dessus avec la relation demandée ;
      4. si le terme n'est pas dans JDM OU si tu ne trouves pas au moins
         3 gaps intéressants, RECOMMENCE avec un AUTRE mot (registre
         différent) — itère silencieusement, max 6-8 essais, et ne montre
         que le résultat final exploitable.
    Cette règle prime sur tout réflexe de « clarifier avec l'utilisateur ».

    Trois types de gaps :
      - MISSING         : aucun triplet (term, relation, ?) — relation jugée
                          pertinente mais vide.
      - NEGATIVE_FILLED : que des triplets négatifs (JDM a regardé et dit non).
      - LOW_COVERAGE    : moins de `min_coverage` triplets positifs.

    PAS d'appel LLM côté tool — déterministe. Outil de DIAGNOSTIC.
    Il N'EST PAS une étape obligatoire du flux de soumission (on peut
    proposer des triplets sans passer par lui).

    Args:
        term: terme à analyser (tiré au hasard par TOI si l'utilisateur
              n'en a pas donné — cf. règle ci-dessus).
        relations: relations à inspecter (défaut: jeu standard noun+verb).
                   Exemples: ["r_has_part", "r_carac", "r_telic_role"].
        min_coverage: une relation à < N triplets positifs est signalée
                      (monter pour aussi remonter les relations bien fournies).

    Renvoie [{term, relation, gap_type, severity, detail}, ...].
    """
    from jdm_agent.enrich import detect_gaps as _detect

    c = _client()
    gaps = _detect(c, term, target_relations=relations,
                   min_to_consider=int(min_coverage))
    return [g.model_dump(mode="json") for g in gaps]


@tool
def validate_candidate(term: str, relation: str, target: str,
                       inference_effort: int = 1) -> dict:
    """Vérifie un triplet candidat — étape 4 du flux d'enrichissement.

    Fait TOUT le contrôle en UN seul appel — ne t'arrête jamais à mi-chemin :

      ÉTAPE 1 — validation structurelle (déterministe) :
        * "unknown_term" : la cible n'existe pas comme nœud JDM → à rejeter
        * "duplicate"    : le triplet est déjà dans JDM → rien à ajouter
        * "inconsistent" : JDM nie directement le triplet → à rejeter
        * "ok"           : structurellement recevable → on passe à l'étape 2

      ÉTAPE 2 — CONSOLIDATION par inférence (si l'étape 1 donne "ok") :
        le réseau JDM permet-il de DÉDUIRE ce triplet ?
        * "consolidated"     : déduit → PRÊT POUR SOUMISSION
        * "rejected"         : réfuté par inférence → à rejeter
        * "not_consolidated" : non démontré (pas forcément faux, mais
                               PAS prêt pour soumission en l'état)

    RÈGLE ABSOLUE : un triplet n'est soumettable QUE si
    `ready_for_submission` vaut true. La validation structurelle « ok » seule
    NE SUFFIT PAS — ne déclare jamais un candidat « prêt » sans consolidation.

    Args:
        term:     terme source (ou `sense_id` raffiné si polysémique — voir
                  enrichment_workflow étape 2).
        relation: relation JDM (r_xxx).
        target:   terme cible (idem term).
        inference_effort: effort du moteur d'inférence pour la consolidation
                          (1 = noyau, 2 = complet).

    Renvoie {validation_status, validation_note, consolidation_status,
    consolidation_schema, consolidation_explanation, ready_for_submission,
    next_step, confidence}. `next_step` indique explicitement quoi faire.
    """
    from jdm_agent.enrich import Candidate
    from jdm_agent.enrich.validators import (
        consolidate_candidate as _consolidate,
        validate_candidate as _validate,
    )

    c = _client()
    cand = Candidate(term=term, relation=relation, target=target,
                     confidence=0.5, source="agent")
    cand = _validate(c, cand)
    if cand.is_valid():
        cand = _consolidate(c, cand, effort=int(inference_effort))

    out = cand.model_dump(mode="json")
    ready = cand.is_valid() and cand.is_consolidated()
    out["ready_for_submission"] = ready
    if ready:
        out["next_step"] = (
            "PRÊT — inclure dans le fichier de soumission au format "
            "`terme|relation|cible|annotation < explication >` en reprenant "
            "`consolidation_explanation` comme explication."
        )
    elif cand.validation_status == "duplicate":
        out["next_step"] = (
            f"À REJETER (duplicate) : {cand.validation_note} — "
            "⚠️ ATTENTION : un duplicate ici, c'est que tu N'AS PAS pré-fetché "
            f"`{cand.term} | {cand.relation} | ?` avant de proposer (ou que "
            "ton pré-fetch a été tronqué par un outil de consultation). "
            "ARRÊTE ton batch maintenant, appelle "
            f"`list_existing_for_enrichment(term='{cand.term}', "
            f"relation_name='{cand.relation}')` (exhaustif par construction), "
            "récupère `exclusion_set`, et reprends en proposant HORS de cette "
            "liste. Sinon tu vas tourner en rond."
        )
    elif cand.validation_status in ("unknown_term", "inconsistent"):
        out["next_step"] = f"À REJETER ({cand.validation_status}) : {cand.validation_note}"
    elif cand.consolidation_status == "rejected":
        out["next_step"] = f"À REJETER (réfuté par inférence) : {cand.consolidation_explanation}"
    else:
        out["next_step"] = (
            "NON CONSOLIDÉ — l'inférence n'a pas pu démontrer ce triplet. "
            "Pas prêt pour soumission (ne pas l'inclure)."
        )
    # Garde persistante : rappel injecté dans CHAQUE réponse pour discipliner
    # le flux. Le LLM le voit à chaque appel, c'est conçu pour qu'il ne
    # « tourne en rond » jamais — même s'il a oublié de pré-fetcher au début.
    out["prefetch_reminder"] = (
        f"As-tu appelé `list_existing_for_enrichment(term='{cand.term}', "
        f"relation_name='{cand.relation}')` AVANT de proposer ? Si non OU "
        "si tu as utilisé get_synonyms/get_parts/etc. (qui tronquent), "
        "fais-le maintenant — c'est l'outil dédié au pré-fetch exhaustif, "
        "il renvoie `exclusion_set` complet sans seuil de poids ni limite "
        "basse. Sans ça tu gaspilles des appels sur des doublons."
    )
    return out


@tool
def list_existing_for_enrichment(term: str, relation_name: str) -> dict:
    """Liste EXHAUSTIVE des triplets existants pour `(term, relation)` —
    OUTIL DE PRÉ-FETCH dédié au flux d'enrichissement.

    Usage : à appeler AVANT toute proposition de candidats pour ce couple
    (term, relation). Renvoie TOUT ce que JDM contient (positifs, négatifs,
    faibles, forts), sans seuil de poids, jusqu'à `limit_cap` entrées.
    C'est ta LISTE D'EXCLUSION : ne propose ensuite QUE des cibles HORS
    de `exclusion_set`.

    Différence avec `get_synonyms` / `get_parts` / `get_relations_of_type` :
    ceux-là sont des outils de CONSULTATION optimisés pour répondre à
    l'utilisateur (top-N par poids, seuils conservateurs). Ils tronquent
    silencieusement — un `get_synonyms("joyeux")` peut louper `enjoué` à
    w=278 si la limite par défaut le coupe. Pour pré-fetcher en
    enrichissement, c'est piégeur : tu crois avoir la liste complète,
    tu proposes des doublons, tu tournes en rond.

    Ce tool, lui, est calibré pour l'EXHAUSTIVITÉ (et donc pour la
    fiabilité de l'exclusion) — c'est son SEUL job.

    Args:
        term: terme source (forme générique ou raffinée `avocat>116477>66699`).
        relation_name: relation JDM (`r_isa`, `r_has_part`, `r_lieu`…).

    Renvoie {term, relation, count, targets, exclusion_set} où
    `exclusion_set` est la liste plate des cibles déjà présentes
    (normalisées en minuscules, sans accents — prêtes pour matcher tes
    propositions).
    """
    import unicodedata

    def _norm(s: str) -> str:
        s = unicodedata.normalize("NFKD", s)
        return "".join(ch for ch in s if not unicodedata.combining(ch)).lower().strip()

    c = _client()
    rid = c.relation_type_id(relation_name)
    if rid is None:
        return {
            "term": term, "relation": relation_name,
            "error": f"Relation inconnue : {relation_name!r}. "
                     "Vérifie le nom via `list_relation_types`.",
            "count": 0, "targets": [], "exclusion_set": [],
        }

    LIMIT_CAP = 500
    MIN_W = -1e9  # tout, négatifs compris
    try:
        res = c.relations_from(term, types_ids=[rid],
                               min_weight=MIN_W, limit=LIMIT_CAP)
    except Exception as e:
        return {
            "term": term, "relation": relation_name,
            "error": f"Échec du pré-fetch : {e}",
            "count": 0, "targets": [], "exclusion_set": [],
        }

    targets = _resolve_targets(c, term, relation_name, res, incoming=False)
    exclusion = sorted({_norm(t.get("target") or "") for t in targets if t.get("target")})
    return {
        "term": term,
        "relation": relation_name,
        "count": len(targets),
        "targets": targets,         # triplets complets avec polarité / poids
        "exclusion_set": exclusion, # liste plate normalisée pour matching rapide
        "note": (
            f"{len(exclusion)} cible(s) existante(s) — propose UNIQUEMENT des "
            "cibles hors de `exclusion_set`. Si tu proposes quand même quelque "
            "chose qui y figure, tu auras un verdict 'duplicate' en validation."
        ),
    }


@tool
def enrichment_workflow() -> dict:
    """Renvoie le flux canonique à suivre pour TOUTE demande d'enrichissement JDM.

    ⚡ POINT D'ENTRÉE OBLIGATOIRE — appelle ce tool en TOUT PREMIER dès qu'on te
    demande de PROPOSER / SUGGÉRER / AJOUTER / ENRICHIR des triplets dans JDM
    (que la demande mentionne un terme, une relation, les deux, ou rien). Il
    n'a aucun coût (renvoyé instantanément, pas d'appel HTTP) et te donne la
    marche à suivre exacte — y compris les règles qui évitent de gaspiller des
    appels d'outils.

    Renvoie un dict avec :
      - title    : intitulé du flux
      - steps    : liste ordonnée des étapes (ordre, nom, description, tool)
      - rules    : règles transversales (correction sémantique, polysémie,
                   ready_for_submission, etc.)
      - if_no_term : que faire si l'utilisateur n'a donné qu'une relation
    """
    return {
        "STOP_AVANT_DE_PROPOSER": (
            "⛔ PRÉ-FETCH OBLIGATOIRE. Pour CHAQUE couple (terme, relation) que "
            "tu vas enrichir, AVANT de générer le moindre candidat, appelle "
            "`list_existing_for_enrichment(term, relation_name)`. C'est UN seul "
            "tool, dédié et exhaustif (limit haute, pas de seuil de poids — "
            "contrairement à get_synonyms/get_parts/etc. qui tronquent "
            "silencieusement). Tu reçois `exclusion_set` (liste plate "
            "normalisée des cibles déjà présentes) et tu proposes UNIQUEMENT "
            "hors de cette liste. Sans ce pré-fetch tu vas TOURNER EN ROND : "
            "vu en pratique sur un batch — 65 candidats proposés, 60+ "
            "duplicates parce que les outils de consultation classiques "
            "tronquaient (joyeux r_syn enjoué à w=278 raté par get_synonyms "
            "défaut, etc.). Ne lance JAMAIS de batch de validations avant "
            "d'avoir pré-fetché avec `list_existing_for_enrichment`."
        ),
        "DIVERSITÉ": (
            "🌿 Le but de l'enrichissement est la VARIÉTÉ — pas la quantité, "
            "pas le scolaire. La langue française est ouverte et libre, "
            "explore-la largement. Évite le réflexe « espèces d'animaux, "
            "variétés de plantes, sous-types de minéraux » qui est très "
            "scolaire et déjà bien renseigné dans JDM (taxonomies "
            "biologiques denses). Ce n'est pas interdit, mais c'est le "
            "domaine où JDM a le moins besoin de toi.\n\n"
            "Diversifie sur DEUX axes simultanément :\n"
            "  • RELATIONS : ne te limite pas à types de relations communes les ~180 relations "
            "(cf. `list_relation_types`). Une relation rare bien remplie "
            "vaut mieux qu'une connaissance triviale.\n"
            "  • TERMES (sources ET cibles) : Pas de cloisons : abstractions, événements, états" 
            ", processus, "
            "objets, "
            "métiers, lieux, sentiments, rituels, "
            "techniques, savoir-faire, gestes, sensations…" 
            "Cette liste n'est pas une ré&férence mais sert à te faire comprendre que TOUS les concepts, idées sont permis. Sors des objets"
            "du quotidien et des noms communs.\n"
            "Si tu te surprends à proposer une 5ᵉ taxonomie de mammifères "
            "ou de fleurs, BLOQUE et change radicalement de domaine.\n\n"
            "🎯 PERTINENCE > consolidation facile. Un triplet doit être "
            "SPÉCIFIQUE au terme source pour avoir de la valeur — pas juste "
            "vrai par héritage d'une classe MAIS ultra-générique et non pertinent. Exemple"
            " qui n'auront AUCUN intérêt :\n"
            "  ✗ tatoueur r_agent-1 marcher / observer / écouter / méditer / sauter / jeûner\n"
            "Ces triplets se consolident trivialement, mais ils n'apportent "
            "RIEN à JDM : ils sont vrais de N'IMPORTE QUEL humain. Ce qui a "
            "de la valeur, c'est ce qui se rapporte au terme en propre :\n"
            "  ✓ tatoueur r_agent-1 dessiner / encrer / piquer la peau\n"
            "Règle simple : C'EST TOI qui dois proposer du contenu pertinent. ready_for_submission=true "
            "n'est pas un sauf-conduit ; tu gardes le filtre éditorial de ta connaissance du monde.\n\n"
            "🚫 NE GAME PAS la consolidation. Ne choisis JAMAIS des termes ou "
            "des cibles parce que tu sais qu'ils vont consolider facilement "
            "via un schéma précis (typiquement deduction_isa par une classe "
            "générique). Cette stratégie produit du volume sans valeur et "
            "BIAISE la variété : si tous tes candidats consolident via la "
            "même classe-pivot, tu n'as proposé qu'UN "
            "trait générique × N étiquettes — pas N enrichissements distincts. "
            "Choisis d'abord le triplet pour sa PERTINENCE linguistique et conceptuelle, "
            "ensuite seulement tu laisses la consolidation décider.\n"
            "🎯 itérer jusqu'à atteindre le nombre demandé, ne pas s'arrêter parce que l'objectif n'est pas atteignable avec facilité."
        ),
        "title": "Flux d'enrichissement JDM (à suivre dans cet ordre)",
        "steps": [
            {
                "order": 1,
                "name": "Pré-fetch exhaustif de l'existant",
                "description": (
                    "Pour chaque couple (terme, relation) que tu vas enrichir, "
                    "appelle `list_existing_for_enrichment(term, relation_name)`. "
                    "Tu reçois `exclusion_set` (liste plate normalisée des "
                    "cibles déjà présentes) et tu proposes UNIQUEMENT hors de "
                    "cette liste. N'utilise PAS get_synonyms/get_parts/etc. "
                    "ici : ces outils de consultation tronquent silencieusement "
                    "(top-N par poids, seuils conservateurs) et te font louper "
                    "des cibles fortes mais hors du top — résultat : tu "
                    "proposes des doublons sans le savoir."
                ),
                "tool": "list_existing_for_enrichment",
            },
            {
                "order": 2,
                "name": "Désambiguïsation si polysémique",
                "description": (
                    "Si le terme OU la cible que tu vas proposer a plusieurs "
                    "sens (avocat, souris, police, chat, livre, sens, vol, "
                    "glace, etc.), désambiguïse via `disambiguate`, CHOISIS "
                    "toi-même le sens visé, et passe le `sense_id` raffiné "
                    "(forme brute `avocat>116477>66699`) à validate_candidate. "
                    "Pas la forme générique. C'est ta décision sémantique."
                ),
                "tool": "disambiguate",
            },
            {
                "order": 3,
                "name": "Proposition",
                "description": (
                    "Génère tes candidats HORS de la liste d'exclusion du "
                    "pré-fetch. La correction sémantique est TA responsabilité, "
                    "pas celle de JDM : tes triplets doivent être linguistiquement "
                    "et factuellement justes selon ta connaissance du français. "
                    "Si tu as repéré une erreur ou bizarrerie dans JDM en "
                    "pré-fetchant, NE t'aligne PAS — propose ce qui est correct. "
                    "JDM n'est pas un oracle parfait, tu contribues pour "
                    "l'améliorer."
                ),
                "tool": "(pas d'appel — génération interne)",
            },
            {
                "order": 4,
                "name": "Validation + consolidation (un seul appel)",
                "description": (
                    "Pour CHAQUE candidat (raffiné si polysémique), appelle "
                    "`validate_candidate(term, relation, target, "
                    "inference_effort=2)` — TOUJOURS `inference_effort=2` "
                    "dans le flux d'enrichissement, pour donner au moteur "
                    "d'inférence sa pleine couverture (cascade complète, "
                    "schémas plus rares activés) et maximiser le taux de "
                    "consolidation. C'est `validate_candidate` qui fait la "
                    "validation structurelle (unknown_term / duplicate / "
                    "inconsistent / ok) ET la consolidation par inférence "
                    "(consolidated / rejected / not_consolidated) en UN "
                    "seul appel. Ne retiens pour la soumission QUE les "
                    "candidats dont `ready_for_submission` vaut true. La "
                    "validation structurelle « ok » seule NE SUFFIT PAS."
                ),
                "tool": "validate_candidate (inference_effort=2)",
            },
            {
                "order": 5,
                "name": "Écriture (et soumission optionnelle) du fichier",
                "description": (
                    "Appelle `write_submission_file(triplets=[...], "
                    "path='<term>.enrich', upload=...)` avec la liste des "
                    "candidats consolidés (PAS raw_content ici — c'est le "
                    "MODE TRIPLETS canonique).\n\n"
                    "⚠️ CRUCIAL : `triplets=[]` produit un fichier VIDE — "
                    "c'est une ERREUR GRAVE. Tu DOIS accumuler au fur et "
                    "à mesure du flux les candidats dont "
                    "`ready_for_submission=true` et les passer ici. Si "
                    "tu n'as rien à soumettre (aucun candidat consolidé), "
                    "dis-le dans le chat et N'APPELLE PAS write_submission_file.\n\n"
                    "Chaque triplet est un dict {term, relation, target, "
                    "annotation, explanation}. L'ANNOTATION et "
                    "l'EXPLICATION sont DEUX champs distincts — ne les "
                    "confonds pas. Les raffinements bruts sont décodés "
                    "automatiquement (`avocat>116477>66699` → "
                    "`avocat (personne, juriste)`).\n\n"
                    "SOUMISSION AUTOMATIQUE (opt-in) : `upload=True` POST "
                    "au LLMDrops sous un nom standardisé. Clé via env "
                    "`JDM_DROPS_API_KEY` ou param `api_key=`."
                ),
                "tool": "write_submission_file (mode triplets)",
            },
        ],
        "rules": [
            "Tout ce que tu énonces (relation, triplet, verdict, gap) provient "
            "d'un appel d'outil JDM réel — pas de simulation.",
            "Les noms de relations s'orthographient PRÉCISÉMENT comme JDM les "
            "définit (r_isa, r_anto, r_has_part, r_object>mater, r_has_conseq, "
            "etc.) ; pas d'invention depuis ta mémoire — utilise `list_relation_types` "
            "si tu as un doute.",
            "DIVERSITÉ avant volume : varie les relations (au-delà de "
            "r_isa/r_has_part/r_carac) ET les termes (sors des animaux, "
            "plantes, taxonomies scolaires — JDM y est déjà très dense). "
            "Une r_telic_role rare bien remplie vaut mieux qu'une 10ᵉ r_isa.",
            "PERTINENCE > consolidation : un triplet vrai par héritage d'une "
            "classe générique (personne, individu, être humain, animal, "
            "chose, objet…) est trivial et n'apporte rien à JDM. Si la "
            "chaîne de consolidation passe par une telle classe pivot, "
            "REJETTE le triplet même si ready_for_submission=true. Tu "
            "gardes le filtre éditorial — ce qui caractérise un métier, "
            "c'est ce qu'il fait EN PROPRE, pas ce que fait n'importe "
            "quelle personne.",
            "NE GAME PAS la consolidation : ne choisis jamais des termes ou "
            "des cibles parce qu'ils consolident facilement via un schéma "
            "précis. Cette stratégie biaise la variété (N étiquettes pour "
            "un seul trait générique ≠ N enrichissements distincts).",
            "Consolidation TOUJOURS à `inference_effort=2` dans le flux "
            "d'enrichissement — pleine couverture du moteur d'inférence.",
            "Un triplet n'est soumettable QUE si `ready_for_submission` vaut "
            "true (consolidation_status == 'consolidated'). Pas d'exception.",
            "Tu désambiguïses et choisis le sens TOI-MÊME — passe le sense_id "
            "raffiné à validate_candidate, pas la forme générique.",
            "Le pré-fetch sert UNIQUEMENT à éviter les doublons. Il ne remplace "
            "PAS ton jugement sémantique et tu ne t'alignes JAMAIS sur les "
            "erreurs que JDM contient.",
        ],
        "if_no_term": (
            "Si l'utilisateur n'a donné qu'une relation (ex. « enrichis r_holo » "
            "ou « propose des triplets pour r_telic_role »), c'est À TOI de "
            "fournir le terme. Tire un mot français au hasard (vraie variété "
            "— ne te limite à aucun registre, varie domaine / longueur / niveau "
            "d'abstraction d'un essai à l'autre et d'une session à l'autre), "
            "vérifie qu'il existe dans JDM via `lookup_term`. Si le mot n'est "
            "pas dans JDM ou si tu n'obtiens rien d'intéressant après "
            "pré-fetch, recommence avec un AUTRE mot. NE demande JAMAIS le "
            "terme à l'utilisateur."
        ),
    }


@tool
def audit_workflow() -> dict:
    """Renvoie le flux canonique pour TOUTE demande d'audit sémantique JDM.

    ⚡ POINT D'ENTRÉE OBLIGATOIRE — appelle ce tool en TOUT PREMIER dès qu'on
    te demande d'AUDITER / VÉRIFIER / CONTRÔLER la répartition des sens
    d'un terme polysémique dans JDM. Zéro coût.
    """
    return {
        "title": "Flux d'audit JDM — confusion entre sens raffinés",
        "intent": (
            "Détecter les CONFUSIONS entre sens raffinés d'un terme "
            "polysémique. Principe JDM : le terme générique (sans "
            "raffinement) hérite normalement des relations du SENS "
            "PREMIER (le sens dominant, poids `r_raff_sem` le plus "
            "fort). Si des relations propres à un sens NON-PREMIER "
            "(2e, 3e, … par poids) apparaissent dans le générique, "
            "c'est une CONTAMINATION à signaler. Inversement : si le "
            "sens classé 1er par r_raff_sem n'est pas celui qui devrait "
            "intuitivement être premier (selon ton jugement de "
            "francophone), c'est aussi à signaler."
        ),
        "steps": [
            {
                "order": 1,
                "name": "Choisir/recevoir un terme polysémique",
                "description": (
                    "Si l'utilisateur a fourni un terme, vérifie sa "
                    "polysémie via `disambiguate`. S'il n'en a pas "
                    "fourni, TIRE toi-même un mot français au hasard "
                    "et varié (varie domaine, registre, longueur d'un "
                    "essai à l'autre), vérifie qu'il existe via "
                    "`lookup_term` puis qu'il est polysémique via "
                    "`disambiguate`. Si non polysémique → autre tirage. "
                    "Max 6-8 essais avant de proposer le résultat."
                ),
                "tool": "lookup_term + disambiguate",
            },
            {
                "order": 2,
                "name": "Lister TOUS les sens par poids r_raff_sem",
                "description": (
                    "Appelle `disambiguate(term)`. Tu obtiens la liste "
                    "ordonnée des sens par poids `r_raff_sem` (consensus "
                    "des joueurs sur « ce nœud est un sens de term »). "
                    "Le 1er est le SENS DOMINANT (premier). Tous les "
                    "autres sont des SENS NON-PREMIERS (2e, 3e, 4e…). "
                    "Tu prends TOUS les sens significatifs, pas seulement "
                    "le top — c'est dans les sens minoritaires qu'on "
                    "trouve les contaminations les plus intéressantes."
                ),
                "tool": "disambiguate",
            },
            {
                "order": 3,
                "name": "Inventaire des triplets sur le terme générique",
                "description": (
                    "Choisis les relations à auditer — celles précisées "
                    "par l'utilisateur si fournies, sinon celles que tu "
                    "décides toi-même (variées, COUVRE UN NOMBRE "
                    "SUFFISANT de types pour un audit représentatif, "
                    "`list_relation_types` pour les découvrir). Pour "
                    "chacune, appelle "
                    "`get_relations_of_type(term, relation_name)` sur la "
                    "FORME NUE du terme et garde tous les triplets."
                ),
                "tool": "list_relation_types + get_relations_of_type",
            },
            {
                "order": 4,
                "name": "Inventaire par sens NON-PREMIER",
                "description": (
                    "Pour CHAQUE sens NON-PREMIER (2e, 3e, … par poids "
                    "r_raff_sem — donc tous SAUF le 1er), appelle "
                    "`get_relations_of_type(sense_id, relation_name)` "
                    "sur les mêmes relations qu'à l'étape 3. Garde ces "
                    "inventaires pour les comparer au générique. C'est "
                    "ces relations-LÀ qu'on cherche à détecter dans le "
                    "générique (= contamination par un sens minoritaire)."
                ),
                "tool": "get_relations_of_type",
            },
            {
                "order": 5,
                "name": "Détecter les contaminations",
                "description": (
                    "Compare l'inventaire du terme générique (étape 3) "
                    "avec ceux des sens non-premiers (étape 4). Pour "
                    "CHAQUE triplet du générique qui apparaît AUSSI dans "
                    "un sens non-premier (et pas chez le sens premier), "
                    "c'est une CONTAMINATION à signaler. Format :\n"
                    "  « le terme `<X>` a la relation `<Y>` → `<Z>` du "
                    "raffinement `<sens_n>` (sens n°<N> par poids "
                    "r_raff_sem), mais ce n'est pas le sens premier de "
                    "<X> ; ce trait propre à <sens_n> ne devrait pas "
                    "être attaché au générique. »\n"
                    "Tu utilises ton jugement de francophone : si un "
                    "triplet du générique appartient sémantiquement au "
                    "sens 1er ou est commun à tous les sens, il est "
                    "LEGITIME — ne le flag pas."
                ),
                "tool": "(jugement sémantique + comparaison)",
            },
            {
                "order": 6,
                "name": "Vérifier l'ordre des sens (sens premier discutable ?)",
                "description": (
                    "Indépendamment des contaminations, regarde le "
                    "CLASSEMENT que disambiguate te renvoie. Le 1er "
                    "sens (poids r_raff_sem le plus fort) est-il "
                    "vraiment, intuitivement, le sens dominant du "
                    "terme en français contemporain ? Si non, ajoute "
                    "un signalement dédié de la forme :\n"
                    "  « le sens premier de `<X>` selon r_raff_sem est "
                    "`<sens_actuel>` mais en français contemporain ce "
                    "devrait plutôt être `<sens_attendu>` (justification "
                    "courte). »"
                ),
                "tool": "(jugement linguistique)",
            },
            {
                "order": 7,
                "name": "Score de santé + commentaire factuel (META)",
                "description": (
                    "Calcule un SCORE DE SANTÉ /10 pour ce terme dans "
                    "JDM : 10 = aucune contamination, sens premier "
                    "incontestable ; 5 = quelques contaminations sur "
                    "sens minoritaires, sens premier discutable ; 0 = "
                    "générique très contaminé, ordre des sens incohérent. "
                    "Puis rédige UN commentaire FACTUEL et BREF (3-4 "
                    "lignes max) qui justifie ce score : combien de "
                    "contaminations, par quels sens, défauts saillants. "
                    "PAS de dissertation, PAS de définitions, PAS de "
                    "redondance avec les signalements."
                ),
                "tool": "(synthèse factuelle)",
            },
            {
                "order": 8,
                "name": "Écriture du fichier .audit",
                "description": (
                    "Construis la CHAÎNE DE TEXTE COMPLÈTE du fichier "
                    ".audit avec les 3 sections, puis passe-la dans "
                    "`raw_content=` (pas dans `triplets=`) : \n"
                    "`write_submission_file(triplets=[], "
                    "path='<term>_audit.audit', upload=..., "
                    "raw_content='''=== SENS ===\\n...''')`\n\n"
                    "Format strict du raw_content :\n\n"
                    "  === SENS ===\n"
                    "  sense_id | poids_r_raff_sem | label\n"
                    "  ... (une ligne par sens trouvé via disambiguate)\n"
                    "\n"
                    "  === SIGNALEMENTS ===\n"
                    "  term | relation | target | type | sens_concerné | justification\n"
                    "  ... (une ligne par contamination ou sens-premier-discutable)\n"
                    "\n"
                    "  === META ===\n"
                    "  Score de santé : N/10\n"
                    "  <commentaire factuel 3-4 lignes max>\n"
                    "\n"
                    "où `type` ∈ { contamination_sens_non_premier, "
                    "sens_premier_discutable }. Justification = UNE phrase "
                    "courte. Les séparateurs `=== … ===` sont OBLIGATOIRES.\n\n"
                    "⚠️ Si tu appelles avec raw_content vide, le fichier "
                    "sera vide — ERREUR. Tu DOIS construire la chaîne "
                    "complète avant l'appel.\n\n"
                    "SOUMISSION optionnelle : `upload=True` si demandé."
                ),
                "tool": "write_submission_file (mode raw_content)",
            },
        ],
        "rules": [
            "Le LLM utilise son JUGEMENT linguistique — pas besoin de "
            "vérifier chaque hypothèse par un appel d'outil supplémentaire.",
            "Le SENS PREMIER = celui de plus fort poids `r_raff_sem`.",
            "Examine TOUS les sens non-premiers, pas top-N arbitraire.",
            "Le fichier .audit est FACTUEL — sections délimitées, "
            "lignes pipe-separated, META court (score + 3-4 lignes max). "
            "PAS de dissertation, PAS de définitions.",
            "Ne crée PAS de triplets nouveaux — l'audit examine l'existant.",
            "Les séparateurs `=== SENS / SIGNALEMENTS / META ===` "
            "sont OBLIGATOIRES.",
        ],
    }


@tool
def gap_detection_workflow() -> dict:
    """Renvoie le flux canonique pour TOUTE demande de DÉTECTION DE TROUS.

    ⚡ POINT D'ENTRÉE OBLIGATOIRE — appelle ce tool en TOUT PREMIER dès qu'on
    te demande de DÉTECTER / TROUVER / IDENTIFIER les TROUS, MANQUES ou
    LACUNES de couverture d'un terme dans JDM. Zéro coût.
    """
    return {
        "title": "Flux de détection de trous JDM",
        "intent": (
            "Identifier ce qui MANQUE dans JDM pour un terme donné, sur "
            "un ensemble de relations cibles. Ne propose PAS de triplets "
            "nouveaux (c'est l'enrichissement) — flag juste ce qui est "
            "ABSENT, NÉGATIVEMENT-REMPLI, ou SOUS-COUVERT."
        ),
        "steps": [
            {
                "order": 1,
                "name": "Vérifier que le terme existe",
                "description": (
                    "Appelle `lookup_term(term)`. Si KO, dis-le et arrête. "
                    "Si le terme est polysémique (plusieurs sens forts), "
                    "demande à l'utilisateur (ou choisis par défaut le "
                    "sens dominant) AVANT de continuer — un gap sur un "
                    "sens raffiné est plus exploitable qu'un gap sur "
                    "le terme générique."
                ),
                "tool": "lookup_term",
            },
            {
                "order": 2,
                "name": "Détecter les trous",
                "description": (
                    "Appelle `detect_gaps(term, target_relations=[…], "
                    "min_to_consider=…)`. Tu reçois une liste de `Gap` "
                    "typés MISSING (aucun triplet ni positif ni négatif) "
                    "/ NEGATIVE_FILLED (que des triplets négatifs — JDM "
                    "a regardé et dit non) / LOW_COVERAGE (< N triplets "
                    "positifs). Si l'utilisateur n'a fourni aucune "
                    "relation cible, choisis-les toi-même (variées, "
                    "`list_relation_types` pour les découvrir)."
                ),
                "tool": "list_relation_types + detect_gaps",
            },
            {
                "order": 3,
                "name": "Synthèse + propositions d'action",
                "description": (
                    "Rédige une synthèse courte en français : « pour "
                    "« <terme> », JDM a N triplets MISSING sur ces "
                    "relations, M NEGATIVE_FILLED, K LOW_COVERAGE ». "
                    "Pour CHAQUE gap intéressant, propose explicitement "
                    "3 actions à l'utilisateur :\n"
                    "  • Enrichir ce trou (orientation Enrichissement)\n"
                    "  • Auditer ce terme (orientation Audit)\n"
                    "  • Stats sur ce terme/relation (orientation Stats)\n\n"
                    "Le format de présentation doit lister chaque gap "
                    "sous la forme `term | relation | type_de_gap` pour "
                    "que la UI puisse parser et générer les boutons."
                ),
                "tool": "(pas d'appel — synthèse)",
            },
        ],
        "rules": [
            "Pas d'écriture de fichier — c'est un flow de DÉCOUVERTE.",
            "Si le terme est polysémique, propose toujours de désambiguïser "
            "AVANT de détecter — un gap par sens est plus actionnable.",
            "Sortie structurée pour permettre le routage UI (chaque gap "
            "doit être identifiable par term + relation + type).",
            "Si aucun gap n'est trouvé, dis-le clairement — c'est aussi "
            "une information utile.",
        ],
    }


@tool
def signalement_workflow() -> dict:
    """Renvoie le flux canonique pour TOUTE demande de SIGNALEMENT d'erreur.

    ⚡ POINT D'ENTRÉE OBLIGATOIRE — appelle ce tool en TOUT PREMIER dès qu'on
    te demande de SIGNALER / REPORTER / FLAGGER des erreurs ou des
    triplets suspects dans JDM. Zéro coût.
    """
    return {
        "title": "Flux de signalement de triplets suspects JDM",
        "intent": (
            "Parcourir les triplets d'un terme (et éventuellement d'une "
            "relation précise) et flagger ceux qui te paraissent SUSPECTS "
            "selon ton jugement linguistique de francophone. Le but est "
            "de SUGGÉRER des points de vigilance au mainteneur JDM — pas "
            "d'asséner des erreurs prouvées. Ta suspicion VAUT, même sans "
            "vérification d'outil concluante."
        ),
        "steps": [
            {
                "order": 1,
                "name": "Cadrer le scan",
                "description": (
                    "Si une (ou plusieurs) relation a été fournie, "
                    "restreins le scan à elle(s). Sinon, choisis toi-même "
                    "les relations à scanner (variées, COUVRE UN NOMBRE "
                    "SUFFISANT de types pour un scan représentatif). Si "
                    "le terme est polysémique, traite chaque sens raffiné "
                    "séparément."
                ),
                "tool": "list_relation_types (si besoin)",
            },
            {
                "order": 2,
                "name": "Inventaire des triplets",
                "description": (
                    "Pour chaque relation ciblée, appelle "
                    "`get_relations_of_type(term, relation_name)`. "
                    "Récupère TOUS les triplets (pas seulement le top)."
                ),
                "tool": "get_relations_of_type",
            },
            {
                "order": 3,
                "name": "Flag selon ton jugement (avec grille de signaux)",
                "description": (
                    "Parcours la liste et flag ce qui te paraît suspect. "
                    "TU UTILISES TON INTUITION DE FRANCOPHONE — pas "
                    "besoin de vérifier chaque suspect par un outil. "
                    "Voici la GRILLE DE SIGNAUX qui aident à voir :\n\n"
                    "  SIGNAUX SÉMANTIQUES (jugement linguistique pur) :\n"
                    "  • triplet bizarre par rapport au sens du terme\n"
                    "    (ex: « chat r_carac liquide »)\n"
                    "  • polarité visiblement inverse à l'attendu\n"
                    "    (ex: « chat r_isa végétal » avec w>0 fort)\n"
                    "  • cible incompatible catégoriellement\n"
                    "    (ex: « animal r_has_color juriste »)\n"
                    "  • annotation contrastive/exception attendue mais "
                    "absente (ex: baleine r_isa mammifère sans "
                    "exception côté poisson)\n\n"
                    "  SIGNAUX STRUCTURELS (opt-in, si tu veux vérifier) :\n"
                    "  • duplicate entre raffinements (même triplet sur 2 "
                    "sens dont un seul est plausible)\n"
                    "  • poids négatif fort sur un fait sémantiquement vrai\n"
                    "  • poids positif fort sur un fait sémantiquement faux\n\n"
                    "Tu peux t'aider de `verify_claim(effort=2)`, "
                    "`get_triplet_annotations`, etc. si une vérification "
                    "te paraît utile — mais ce n'est PAS obligatoire. "
                    "C'est une SOUMISSION DE SUSPECTS, pas d'erreurs prouvées."
                ),
                "tool": "(jugement + outils opt-in)",
            },
            {
                "order": 4,
                "name": "Écriture du fichier .err",
                "description": (
                    "Construis la CHAÎNE DE TEXTE COMPLÈTE du fichier "
                    ".err (une ligne d'en-tête + une ligne par suspect) "
                    "puis passe-la dans `raw_content=` (pas dans "
                    "`triplets=`) :\n"
                    "`write_submission_file(triplets=[], "
                    "path='<term>_signal.err', upload=..., "
                    "raw_content='''term | relation | target | "
                    "catégorie_suspect | justification\\n...''')`\n\n"
                    "Format strict du raw_content :\n\n"
                    "  term | relation | target | catégorie_suspect | justification\n"
                    "  ... (une ligne par suspect, max ~20) ...\n\n"
                    "où `catégorie_suspect` ∈ { sémantique, polarité, "
                    "catégorie_cible, annotation_oubliée, duplicate_sens, "
                    "poids_anormal, autre } et `justification` est UNE "
                    "phrase claire en français.\n\n"
                    "⚠️ raw_content vide = fichier vide = ERREUR. Si tu "
                    "n'as rien trouvé de suspect, dis-le dans le chat et "
                    "n'appelle pas write_submission_file.\n\n"
                    "SOUMISSION optionnelle : `upload=True` si l'utilisateur "
                    "le demande."
                ),
                "tool": "write_submission_file (mode raw_content)",
            },
        ],
        "rules": [
            "Le LLM signale ce qui LUI paraît suspect — sa suspicion vaut, "
            "même sans preuve d'outil. C'est utile au mainteneur.",
            "Chaque suspect DOIT être catégorisé (catégorie_suspect "
            "parmi la liste) et justifié en UNE phrase courte.",
            "Pas de seuil arbitraire pour décider quoi flagger — l'humain "
            "tri ensuite. Mais limite à ~20 suspects max par run pour "
            "éviter le bruit.",
            "Pas d'invention de triplet : on flag UNIQUEMENT ce qui "
            "existe déjà dans JDM (sortie de get_relations_of_type).",
        ],
    }


@tool
def stats_workflow() -> dict:
    """Renvoie le flux canonique pour TOUTE demande de STATISTIQUES JDM.

    ⚡ POINT D'ENTRÉE OBLIGATOIRE — appelle ce tool en TOUT PREMIER dès qu'on
    te demande des STATS / COMPTER / MESURER / DISTRIBUTION pour un terme
    ou une relation dans JDM. Zéro coût.
    """
    return {
        "title": "Flux de statistiques JDM (par terme et/ou par relation)",
        "intent": (
            "Produire un compte rendu chiffré sur la couverture, la "
            "distribution de poids et le ratio positif/négatif pour : "
            "(a) un terme sur un ensemble de relations, OU (b) une "
            "relation seule sur ses top triplets. Sortie : tableau "
            "structuré + petit graphe (côté UI)."
        ),
        "steps": [
            {
                "order": 1,
                "name": "Identifier le mode",
                "description": (
                    "Si un TERME est fourni → mode PAR_TERME (étape 2a). "
                    "Si une RELATION est fournie (sans terme) → mode "
                    "PAR_RELATION (étape 2b). Si les DEUX → fais les "
                    "deux modes en séquence."
                ),
                "tool": "(pas d'appel)",
            },
            {
                "order": 2,
                "name": "Mode PAR_TERME",
                "description": (
                    "Si un terme est fourni : choisis toi-même les "
                    "relations à examiner (variées, `list_relation_types` "
                    "pour les découvrir). Pour chaque relation choisie, "
                    "appelle `list_existing_for_enrichment(term, "
                    "relation_name)` — c'est EXHAUSTIF (pas de seuil ni "
                    "de limite, contrairement à get_*). Compte nb total, "
                    "nb positif, nb négatif, max(w), min(w), mean(w) par "
                    "relation."
                ),
                "tool": "list_relation_types + list_existing_for_enrichment",
            },
            {
                "order": 3,
                "name": "Mode PAR_RELATION",
                "description": (
                    "Si une relation est fournie sans terme : appelle "
                    "`list_relation_types` pour confirmer le `r_*` exact, "
                    "puis appelle `get_relations_of_type` sur quelques "
                    "termes-pivots variés (animal, objet, action, sentiment, "
                    "lieu…) pour estimer la distribution typique. Limite "
                    "à 5-8 termes-pivots — au-delà tu épuises ton budget."
                ),
                "tool": "list_relation_types + get_relations_of_type",
            },
            {
                "order": 4,
                "name": "Synthèse structurée (2 tableaux + observations)",
                "description": (
                    "Produis DEUX vues complémentaires sous forme de "
                    "tableaux markdown, plus de brèves observations.\n\n"
                    "  1) TABLEAU par RELATION :\n"
                    "     `relation | n_total | n_pos | n_neg | max_w | min_w | mean_w`\n"
                    "     une ligne par relation examinée.\n\n"
                    "  2) TABLEAU par TERMES RENCONTRÉS (= targets) :\n"
                    "     `target | nb_occurrences | nb_relations_distinctes | poids_total | poids_max`\n"
                    "     top 20 par fréquence (puis poids agrégé). Permet "
                    "de voir quels termes reviennent comme cible et où la "
                    "couverture se concentre.\n\n"
                    "  Puis 3-5 OBSERVATIONS clés en prose BRÈVES et "
                    "FACTUELLES (« r_X sur-représentée », « cible Y dans "
                    "6 relations différentes ») — pas de dissertation."
                ),
                "tool": "(synthèse — pas d'appel)",
            },
            {
                "order": 5,
                "name": "Écriture du fichier .stat",
                "description": (
                    "Construis la CHAÎNE DE TEXTE COMPLÈTE du fichier "
                    ".stat (3 sections) puis passe-la dans `raw_content=` "
                    "(pas dans `triplets=`) :\n"
                    "`write_submission_file(triplets=[], "
                    "path='<term>_stats.stat', upload=..., "
                    "raw_content='''=== TABLEAU PAR RELATION ===\\n...''')`\n\n"
                    "Format strict du raw_content, TROIS sections :\n\n"
                    "  === TABLEAU PAR RELATION ===\n"
                    "  relation | n_total | n_pos | n_neg | max_w | min_w | mean_w\n"
                    "  ... (une ligne par relation)\n"
                    "\n"
                    "  === TABLEAU PAR TERMES RENCONTRÉS ===\n"
                    "  target | nb_occurrences | nb_relations_distinctes | poids_total | poids_max\n"
                    "  ... (top 20 cibles)\n"
                    "\n"
                    "  === META ===\n"
                    "  <3-5 observations clés brèves et factuelles>\n"
                    "\n"
                    "PAS de dissertation, PAS de redondance avec les "
                    "tableaux. Les séparateurs `=== … ===` sont OBLIGATOIRES.\n\n"
                    "⚠️ raw_content vide = fichier vide = ERREUR.\n\n"
                    "SOUMISSION optionnelle : `upload=True` si demandé."
                ),
                "tool": "write_submission_file (mode raw_content)",
            },
        ],
        "rules": [
            "Mode PAR_TERME : utilise `list_existing_for_enrichment` "
            "(exhaustif), PAS `get_synonyms`/`get_parts` qui tronquent.",
            "Mode PAR_RELATION : limite-toi à 5-8 termes-pivots — c'est "
            "une estimation, pas un census complet.",
            "COUVRE un nombre SUFFISANT de types de relations (≥ 8-12 "
            "différents si pas de relation imposée) — qualité statistique.",
            "Rends TOUJOURS les 2 tableaux (par relation ET par termes "
            "rencontrés) — pas un seul.",
            "Le fichier .stat est FACTUEL — tableaux pipe-separated, "
            "META court (3-5 observations max). PAS de dissertation.",
            "Les séparateurs `=== … ===` sont OBLIGATOIRES.",
            "Le cache disque rend les stats incrémentales gratuites au "
            "2e appel sur les mêmes termes.",
        ],
    }


@tool
def write_submission_file(
    triplets: list[dict],
    path: str = "soumission_jdm.txt",
    upload: bool = False,
    model_name: str = "",
    api_key: str = "",
    raw_content: str = "",
) -> dict:
    """Écrit le fichier de soumission JDM (.txt) et — sur demande — le
    SOUMET automatiquement au endpoint LLMDrops de JDM.

    DEUX MODES D'ÉCRITURE :

    1) Mode TRIPLETS (par défaut, `raw_content=""`) — pour
       l'enrichissement (.enrich). On passe une liste de triplets dicts
       et le tool écrit le fichier au format pipe :
           term | relation | target | annotation < explanation >

    2) Mode RAW (`raw_content="..."`) — pour audit (.audit), signalement
       (.err), statistiques (.stat). Le paramètre `triplets` est ignoré ;
       le `raw_content` est écrit TEL QUEL dans le fichier. À utiliser
       quand le format de sortie n'est PAS la table de triplets pipe
       canonique mais un format multi-sections (=== SENS === / ===
       SIGNALEMENTS === / === META === pour audit, etc.). Le LLM
       CONSTRUIT lui-même la chaîne complète avec les séparateurs
       attendus par le workflow correspondant.

    ⚠️ NE JAMAIS appeler ce tool avec `triplets=[]` ET `raw_content=""`
    en même temps — un fichier vide est une erreur grave qui signifie
    que tu n'as rien accumulé pendant le flux. Si tu n'as VRAIMENT rien
    trouvé à proposer, dis-le dans le chat et n'appelle pas ce tool.

    Mode TRIPLETS — chaque triplet est un dict à champs SÉPARÉS et
    DISTINCTS — ne les confonds pas :
      - "term", "relation", "target" : le triplet (obligatoires).
      - "annotation" : tag sémantique OPTIONNEL (constitutif, contrastif,
        …). CE N'EST PAS l'explication.
      - "explanation" : justification en langage naturel. CE N'EST PAS
        l'annotation.
    Les raffinements bruts (`avocat>116477>66699`) sont décodés
    automatiquement avant écriture.

    SOUMISSION AUTOMATIQUE au LLMDrops (opt-in) :
      - `upload=True` : POST le fichier après écriture. Le nom uploadé
        est `{HHhMM}_{DD-MM-YY}_automatic_submission_from_{model}.{ext}`
        où `.ext` est dérivée du `path` (.enrich / .audit / .err / .stat).
      - `model_name` : nom EXACT du LLM (claude-opus-4-7, gemini-3.1-…).
        ⚠️ Ne DEVINE PAS ; si pas sûr, laisse vide.
      - `api_key`    : clé API LLMDrops. Vide → env `JDM_DROPS_API_KEY`.

    Args:
        triplets: liste de dicts (mode triplets, ignoré si raw_content fourni).
        path: chemin du fichier de sortie (extension détermine le type).
        upload: True pour soumettre au LLMDrops après écriture.
        model_name: nom du LLM source pour le filename uploadé.
        api_key: clé API LLMDrops (override env JDM_DROPS_API_KEY).
        raw_content: contenu brut à écrire tel quel (mode RAW).

    Renvoie {path, count, lines?, upload?}.
    """
    from jdm_agent.enrich import Candidate
    from jdm_agent.enrich.pipeline import _decoded, write_submission as _write_sub

    # Mode RAW : on écrit le contenu tel quel (audit / err / stat)
    if raw_content and raw_content.strip():
        from pathlib import Path as _Path
        p = _Path(path)
        try:
            p.write_text(raw_content, encoding="utf-8")
        except OSError as e:
            return {"path": path, "count": 0, "error": f"Écriture impossible : {e}"}
        out: dict = {
            "path": path,
            "count": raw_content.count("\n") + 1,
            "mode": "raw",
        }
    else:
        # Mode TRIPLETS canonique
        c = _client()
        cands: list = []
        for t in triplets:
            if not (t.get("term") and t.get("relation") and t.get("target")):
                continue
            cands.append(Candidate(
                term=str(t["term"]), relation=str(t["relation"]), target=str(t["target"]),
                annotation=str(t.get("annotation") or ""),
                consolidation_explanation=str(t.get("explanation") or ""),
                confidence=0.7, source="agent",
                validation_status="ok", consolidation_status="consolidated",
            ))
        n = _write_sub(path, cands, client=c)
        out = {
            "path": path, "count": n,
            "lines": [
                f"{_decoded(cd.term, c)} | {cd.relation} | {_decoded(cd.target, c)} | "
                f"{cd.annotation} < {' '.join(cd.consolidation_explanation.split())} >"
                for cd in cands
            ],
            "mode": "triplets",
        }

    if upload:
        from jdm_agent.enrich.uploader import submit_to_jdm
        out["upload"] = submit_to_jdm(
            path,
            api_key=api_key or None,
            model_name=model_name or None,
        )
    return out


# ---------- Vérification de claims (fact-checking) ----------

@tool
def verify_claim(subject: str, relation: str, object: str,
                 polarity: bool = True, effort: int = 0,
                 bypass_containment: bool = False) -> dict:
    """Vérifie un triplet factuel contre le graphe JDM (déterministe, sans LLM).

    DEUX RÉGIMES, choisis par `effort` — réfléchis bien à la question posée :

    * **effort = 0 (CONTENANCE — défaut)** : « JDM CONTIENT-IL ce triplet ? ».
      Lookup direct strict. Si le triplet exact n'est pas dans JDM → "unknown".
      Utilise-le quand l'utilisateur demande si une information EST DANS JDM,
      si JDM INCLUT / CONTIENT un fait. NE JAMAIS répondre « oui » à une telle
      question parce qu'on a pu inférer le fait : contenir = l'avoir littéralement.

    * **effort = 1** : « ce fait est-il VRAI / DÉDUCTIBLE selon JDM ? ».
      Lookup direct d'abord ; si JDM est silencieux, le moteur d'inférence
      (schémas noyau) tente de déduire ou réfuter le triplet. Utilise-le quand
      la question est « est-ce vrai », « peut-on déduire », « fait émergent ».

    * **effort = 2** : idem effort 1 avec la cascade d'inférence complète
      (plus lent, plus de schémas).

    Un verdict obtenu par inférence porte `inference_schema` (non nul) et son
    `explanation` précise que JDM ne contient pas directement le triplet — la
    déduction n'est jamais présentée comme de la contenance.

    Args:
        subject:  terme source (ex. "baleine", "chat", verbe à l'infinitif).
        relation: relation JDM (ex. "r_isa", "r_carac", "r_has_part").
        object:   terme cible (ex. "poisson", "rouge", "roue").
        polarity: True pour affirmation, False pour négation ("ne ... pas").
        effort:   0 contenance (défaut) · 1 + inférence noyau · 2 + inférence complète.
        bypass_containment: si True (et effort ≥ 1), lance l'inférence MÊME si
            le triplet est déjà présent directement dans JDM — pour obtenir la
            chaîne de déduction d'un fait pourtant connu. Défaut False.

    Statuts : "supported" / "contradicted" / "unknown" (unknown ≠ faux).
    Renvoie {claim, status, confidence, explanation, evidence_for,
    evidence_against, inference_schema, inference_proof}.
    """
    from jdm_agent.factcheck import Claim
    from jdm_agent.factcheck.verifier import verify_claim as _verify

    c = _client()
    claim = Claim(
        text=f"{subject} | {relation} | {object}",
        subject=subject, relation=relation, object=object, polarity=polarity,
    )
    verdict = _verify(c, claim, effort=int(effort),
                      bypass_containment=bool(bypass_containment))
    return verdict.model_dump(mode="json")


@tool
def infer(subject: str, relation: str, object: str, effort: int = 1) -> dict:
    """Tente de DÉDUIRE un triplet par inférence dans le réseau JDM.

    À utiliser quand on cherche explicitement à raisonner — « peut-on déduire
    que… », « est-ce un fait émergent », inférence libre non couverte par une
    vérification de claim factuelle. Pour vérifier une claim factuelle simple,
    préfère `verify_claim` (qui regarde d'abord la contenance directe).

    Cet outil NE consulte PAS le triplet direct : il enchaîne des schémas
    d'inférence (relation inverse, implication, déduction par généralisation,
    transitivité, élimination par classe, etc.) et renvoie la CHAÎNE DE PREUVE.

    Args:
        subject, relation, object: le triplet à inférer (relation = nom JDM r_xxx).
        effort: 1 = schémas noyau (rapide) · 2 = cascade complète.

    Renvoie {subject, relation, object, signed_weight (>0 vrai, <0 faux,
    0 silence), fired_schema, proof [chaîne de triplets], confidence,
    explanation, lookups_used}.
    """
    from jdm_agent.inference import infer as _infer

    c = _client()
    res = _infer(c, subject, relation, object, effort=int(effort))
    return res.model_dump(mode="json")


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
    depth: int = 1,
    top_k_per_relation: int = 3,
    top_k_depth2: Optional[int] = None,
    top_k_depth3: Optional[int] = None,
    top_k_depth4: Optional[int] = None,
    min_weight: Optional[float] = None,
    relations: Optional[list[str]] = None,
    depth2_relations: Optional[list[str]] = None,
    depth3_relations: Optional[list[str]] = None,
    depth4_relations: Optional[list[str]] = None,
    output: str = "html",
    output_path: Optional[str] = None,
) -> dict:
    """Construit un sous-graphe JDM autour d'un terme et le sérialise.

    Très utile pour explorer visuellement l'entourage sémantique d'un concept :
    catégories (r_isa), exemples (r_hypo), parties (r_has_part), lieux,
    caractéristiques, verbes appliqués, etc., sur 1 à 4 niveaux de profondeur.

    Sélection de relations indépendante PAR NIVEAU : à chaque profondeur tu
    peux choisir un sous-ensemble différent. Par défaut, le scope se rétrécit
    progressivement pour contenir l'explosion combinatoire.

    Args:
        term: le terme racine (ex. "plat asiatique").
        depth: 1 à 4 (au-delà = illisible et lent).
        top_k_per_relation: nb max de cibles retenues par relation et par nœud.
        min_weight: poids minimum, None = pas de filtre (JDM décide).
        relations: relations explorées à la profondeur 1. Défaut =
                   r_isa, r_hypo, r_syn, r_anto, r_carac, r_has_part, r_lieu, r_domain.
        depth2_relations: relations à la profondeur 2.
                          Défaut = r_isa, r_carac, r_has_part, r_lieu.
        depth3_relations: relations à la profondeur 3.
                          Défaut = r_isa, r_has_part, r_carac.
        depth4_relations: relations à la profondeur 4.
                          Défaut = r_isa, r_carac.
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
            depth3_relations=depth3_relations,
            depth4_relations=depth4_relations,
            top_k_depth2=top_k_depth2,
            top_k_depth3=top_k_depth3,
            top_k_depth4=top_k_depth4,
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
    # Fact-checking + inférence + annotations
    verify_claim,
    infer,
    get_triplet_annotations,
    # Enrichissement + autres flows guidés (Phase 13)
    enrichment_workflow,
    audit_workflow,
    gap_detection_workflow,
    signalement_workflow,
    stats_workflow,
    list_existing_for_enrichment,
    detect_gaps,
    validate_candidate,
    write_submission_file,
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

    Phase 13 — toute la liste est passée par `apply_budget_wrapping` :
    si une invocation agent est encapsulée dans `budget_context(N)`
    (côté Jarvis), chaque appel d'outil consomme une unité ; au-delà
    de N, les tools renvoient le sentinel `BUDGET_EXHAUSTED` et le
    LLM stoppe proprement (cf. règle 15). Sans contexte, les tools
    s'exécutent librement — zéro régression sur les flows existants.
    """
    if client is not None:
        set_default_client(client)
    if not enrich_docstrings:
        from jdm_agent.tools.budget import apply_budget_wrapping
        return apply_budget_wrapping(list(ALL_TOOLS))

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
    from jdm_agent.tools.budget import apply_budget_wrapping
    return apply_budget_wrapping(list(ALL_TOOLS))
