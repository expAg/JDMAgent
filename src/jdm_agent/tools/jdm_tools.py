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

def _triplet(source: str, relation: str, target_name: str, w: float) -> dict:
    return {"source": source, "relation": relation, "target": target_name, "w": w}


def _resolve_targets(client: JDMClient, source_name: str, rel_name: str, result,
                     incoming: bool = False) -> list[dict]:
    """Construit la liste de triplets en résolvant les noms d'autres bouts.

    Si incoming=True (direction "to"), le terme source est node2 et l'autre bout
    à résoudre est node1.
    """
    idx = result.node_index()
    triplets: list[dict] = []
    for r in sorted(result.relations, key=lambda x: -x.w):
        other_id = r.node1 if incoming else r.node2
        node = idx.get(other_id)
        if node is None:
            try:
                node = client.node_by_id(other_id)
            except Exception:
                continue
        if incoming:
            triplets.append(_triplet(node.name, rel_name, source_name, r.w))
        else:
            triplets.append(_triplet(source_name, rel_name, node.name, r.w))
    return triplets


def _mw(v: Optional[float], default: float) -> float:
    """Résout min_weight (accepte None venant du LLM)."""
    return default if v is None else float(v)


def _lim(v: Optional[int], default: int) -> int:
    """Résout limit (accepte None venant du LLM)."""
    return default if v is None else int(v)


# ---------- Tools ----------

@tool
def lookup_term(term: str) -> dict:
    """Cherche un terme dans JeuxDeMots et renvoie ses informations de base.

    Renvoie {id, name, type, weight} ou {error} si le terme n'existe pas.
    Utile pour vérifier qu'un mot est connu du graphe avant de l'interroger plus
    en profondeur. `weight` est le poids global du nœud (popularité dans JDM).
    """
    try:
        n = _client().node_by_name(term)
    except Exception as e:
        return {"error": f"terme inconnu : {term!r} ({e})"}
    return {"id": n.id, "name": n.name, "type": n.type, "weight": n.w}


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
                           min_weight=_mw(min_weight, 25.0), limit=_lim(limit, 20))
    return _resolve_targets(c, term, "r_syn", res)


@tool
def get_antonyms(term: str, min_weight: Optional[float] = None, limit: Optional[int] = None) -> list[dict]:
    """Renvoie les antonymes (`r_anto`) d'un terme.

    Antonym (`r_anto`) — termes de sens opposés (ex.: chaud | r_anto | froid).
    """
    c = _client()
    rid = c.relation_type_id("r_anto")
    res = c.relations_from(term, types_ids=[rid] if rid else None,
                           min_weight=_mw(min_weight, 25.0), limit=_lim(limit, 20))
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
                           min_weight=_mw(min_weight, 25.0), limit=_lim(limit, 20))
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
                           min_weight=_mw(min_weight, 25.0), limit=_lim(limit, 30))
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
                           min_weight=_mw(min_weight, 25.0), limit=_lim(limit, 30))
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
                           min_weight=_mw(min_weight, 25.0), limit=_lim(limit, 30))
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
    mw, lm = _mw(min_weight, 25.0), _lim(limit, 30)
    if incoming:
        res = c.relations_to(term, types_ids=[rid], min_weight=mw, limit=lm)
    else:
        res = c.relations_from(term, types_ids=[rid], min_weight=mw, limit=lm)
    return _resolve_targets(c, term, relation_name, res, incoming=incoming)


@tool
def get_relations_between(term1: str, term2: str, min_weight: Optional[float] = None) -> list[dict]:
    """Renvoie toutes les relations entre deux termes (term1 → term2).

    Utile pour répondre "quel est le rapport entre A et B ?".
    """
    c = _client()
    res = c.relations_between(term1, term2, min_weight=_mw(min_weight, 5.0))
    out: list[dict] = []
    for r in sorted(res.relations, key=lambda x: -x.w):
        rname = c.relation_type_name(r.type) or f"type_{r.type}"
        out.append({"source": term1, "relation": rname, "target": term2, "w": r.w})
    return out


@tool
def disambiguate(term: str) -> list[dict]:
    """Renvoie les sens (raffinements sémantiques) d'un terme polysémique, décodés en clair.

    Utilise ceci quand un mot a plusieurs sens (avocat = fruit | juriste,
    souris = animal | informatique, police = force de l'ordre | typographie, etc.).
    Les IDs internes JDM sont automatiquement résolus en labels humains.

    Renvoie [{name, decoded, path, weight}, ...] où :
      - `decoded` est la forme lisible (ex. "avocat (personne, juriste)")
      - `path` est la chaîne hiérarchique (["avocat", "personne", "juriste"])
      - `name` est l'identifiant brut JDM (ex. "avocat>116477>66699")
    Tu DOIS utiliser `decoded` pour citer les sens à l'utilisateur, jamais `name`.
    """
    c = _client()
    decoded = c.refinements_decoded(term)
    decoded.sort(key=lambda d: -d.weight)
    return [
        {
            "decoded": d.decoded,
            "path": d.path,
            "weight": d.weight,
            "name": d.name,        # gardé pour traçabilité éventuelle
        }
        for d in decoded
    ]


# ---------- Outils prédicatifs (actanciels / causaux / téliques) ----------

def _predicative_lookup(
    term: str, relation: str, direction: str,
    min_weight: Optional[float], limit: Optional[int],
    default_mw: float = 25.0, default_limit: int = 20,
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
    (ex.: manger | r_agent | chat ; voler | r_agent | oiseau ; courir | r_agent | sportif).
    """
    return _predicative_lookup(verb, "r_agent", "from", min_weight, limit)


@tool
def get_patients(verb: str, min_weight: Optional[float] = None, limit: Optional[int] = None) -> list[dict]:
    """Renvoie les OBJETS typiques d'un verbe (`r_patient`).

    Patient (`r_patient`) — entité qui subit l'action (COD du verbe).
    Le terme source DOIT être un verbe à l'infinitif.
    (ex.: manger | r_patient | viande ; lire | r_patient | livre ; réparer | r_patient | voiture).
    """
    return _predicative_lookup(verb, "r_patient", "from", min_weight, limit)


@tool
def get_instruments(verb: str, min_weight: Optional[float] = None, limit: Optional[int] = None) -> list[dict]:
    """Renvoie les INSTRUMENTS typiques d'un verbe (`r_instr`).

    Instrument (`r_instr`) — objet utilisé pour réaliser l'action.
    Le terme source DOIT être un verbe à l'infinitif.
    (ex.: couper | r_instr | couteau ; écrire | r_instr | stylo ; peindre | r_instr | pinceau).
    """
    return _predicative_lookup(verb, "r_instr", "from", min_weight, limit)


@tool
def get_locations(term: str, min_weight: Optional[float] = None, limit: Optional[int] = None) -> list[dict]:
    """Renvoie les LIEUX typiques associés à un terme (`r_lieu`).

    Lieu (`r_lieu`) — où se trouve l'objet ou se déroule l'action.
    Marche pour nom (carotte | r_lieu | potager) ou verbe (étudier | r_lieu | école).
    """
    return _predicative_lookup(term, "r_lieu", "from", min_weight, limit)


@tool
def get_causes(term: str, min_weight: Optional[float] = None, limit: Optional[int] = None) -> list[dict]:
    """Renvoie les CAUSES possibles d'un état ou d'une action (`r_has_causatif`).

    Cause (`r_has_causatif`) — origine ou cause de A.
    (ex.: blessure | r_has_causatif | chute ; fatigue | r_has_causatif | travail ; fumée | r_has_causatif | feu).
    """
    return _predicative_lookup(term, "r_has_causatif", "from", min_weight, limit)


@tool
def get_consequences(term: str, min_weight: Optional[float] = None, limit: Optional[int] = None) -> list[dict]:
    """Renvoie les CONSÉQUENCES typiques d'un état ou d'une action (`r_has_conseq`).

    Conséquence (`r_has_conseq`) — effet ou suite directe de A.
    (ex.: tomber | r_has_conseq | se blesser ; pluie | r_has_conseq | inondation).
    """
    return _predicative_lookup(term, "r_has_conseq", "from", min_weight, limit)


@tool
def get_purpose(term: str, min_weight: Optional[float] = None, limit: Optional[int] = None) -> list[dict]:
    """Renvoie le BUT d'une action ou d'un objet (`r_but`).

    Purpose (`r_but`) — objectif visé par l'action.
    (ex.: courir | r_but | santé ; travailler | r_but | argent ; dormir | r_but | récupérer).
    """
    return _predicative_lookup(term, "r_but", "from", min_weight, limit)


@tool
def get_manner(verb: str, min_weight: Optional[float] = None, limit: Optional[int] = None) -> list[dict]:
    """Renvoie les MANIÈRES typiques dont une action s'effectue (`r_manner`).

    Manner (`r_manner`) — adverbe ou locution adverbiale décrivant comment.
    (ex.: manger | r_manner | goulûment ; courir | r_manner | rapidement).
    """
    return _predicative_lookup(verb, "r_manner", "from", min_weight, limit)


@tool
def get_telic_role(noun: str, min_weight: Optional[float] = None, limit: Optional[int] = None) -> list[dict]:
    """Renvoie la FONCTION (rôle télique) d'un objet (`r_telic_role`).

    Telic-role (`r_telic_role`) — fonction primaire pour laquelle un objet a été conçu.
    (ex.: couteau | r_telic_role | couper ; chaise | r_telic_role | s'asseoir ; lunettes | r_telic_role | voir).
    """
    return _predicative_lookup(noun, "r_telic_role", "from", min_weight, limit)


@tool
def get_agentive_role(noun: str, min_weight: Optional[float] = None, limit: Optional[int] = None) -> list[dict]:
    """Renvoie les verbes qui CRÉENT un objet (rôle agentif) (`r_agentif_role`).

    Agentif-role (`r_agentif_role`) — verbes transitifs donnant naissance à l'entité.
    (ex.: maison | r_agentif_role | construire ; livre | r_agentif_role | rédiger).
    """
    return _predicative_lookup(noun, "r_agentif_role", "from", min_weight, limit)


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


# ---------- Registry ----------

ALL_TOOLS: list[StructuredTool] = [
    lookup_term,
    get_synonyms,
    get_antonyms,
    get_hypernyms,
    get_hyponyms,
    get_parts,
    get_characteristics,
    # Prédicatifs
    get_agents,
    get_patients,
    get_instruments,
    get_locations,
    get_causes,
    get_consequences,
    get_purpose,
    get_manner,
    get_telic_role,
    get_agentive_role,
    # Génériques
    get_relations_of_type,
    get_relations_between,
    disambiguate,
    list_relation_types,
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
        "get_causes": "r_has_causatif",
        "get_consequences": "r_has_conseq",
        "get_purpose": "r_but",
        "get_manner": "r_manner",
        "get_telic_role": "r_telic_role",
        "get_agentive_role": "r_agentif_role",
    }
    for t in ALL_TOOLS:
        rel = suffix_map.get(t.name)
        if rel and docs.get(rel):
            t.description = f"{t.description}\n\n[JDM] {describe_relation(rel, docs)}"
    return list(ALL_TOOLS)
