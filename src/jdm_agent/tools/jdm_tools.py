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


# ---------- Helpers de présentation pour l'agent ----------

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
def get_synonyms(term: str, min_weight: float = 25.0, limit: int = 20) -> list[dict]:
    """Renvoie les synonymes (`r_syn`) d'un terme.

    Synonym (`r_syn`) — termes ayant un sens identique ou très proche
    (ex.: chat | r_syn | matou ; voiture | r_syn | automobile).

    Args:
        term: le terme source (en minuscules, accentué si besoin).
        min_weight: poids minimum pour filtrer le bruit (25 par défaut).
        limit: nombre maximum de résultats.

    Renvoie une liste de triplets [{source, relation, target, w}, ...] triés par poids.
    """
    c = _client()
    rid = c.relation_type_id("r_syn")
    res = c.relations_from(term, types_ids=[rid] if rid else None,
                           min_weight=min_weight, limit=limit)
    return _resolve_targets(c, term, "r_syn", res)


@tool
def get_antonyms(term: str, min_weight: float = 25.0, limit: int = 20) -> list[dict]:
    """Renvoie les antonymes (`r_anto`) d'un terme.

    Antonym (`r_anto`) — termes de sens opposés (ex.: chaud | r_anto | froid).
    """
    c = _client()
    rid = c.relation_type_id("r_anto")
    res = c.relations_from(term, types_ids=[rid] if rid else None,
                           min_weight=min_weight, limit=limit)
    return _resolve_targets(c, term, "r_anto", res)


@tool
def get_hypernyms(term: str, min_weight: float = 25.0, limit: int = 20) -> list[dict]:
    """Renvoie les génériques / hyperonymes (`r_isa`) d'un terme.

    Is-A (`r_isa`) — lien de généralisation : le terme cible est une catégorie
    dont le terme source fait partie (ex.: chat | r_isa | mammifère).
    Utile pour répondre "qu'est-ce qu'un X ?".
    """
    c = _client()
    rid = c.relation_type_id("r_isa")
    res = c.relations_from(term, types_ids=[rid] if rid else None,
                           min_weight=min_weight, limit=limit)
    return _resolve_targets(c, term, "r_isa", res)


@tool
def get_hyponyms(term: str, min_weight: float = 25.0, limit: int = 30) -> list[dict]:
    """Renvoie les spécifiques / hyponymes (`r_hypo`) d'un terme.

    Hyponym (`r_hypo`) — le terme cible est une sous-catégorie ou un exemple
    du terme source (ex.: insecte | r_hypo | mouche).
    Utile pour lister les exemples d'une catégorie.
    """
    c = _client()
    rid = c.relation_type_id("r_hypo")
    res = c.relations_from(term, types_ids=[rid] if rid else None,
                           min_weight=min_weight, limit=limit)
    return _resolve_targets(c, term, "r_hypo", res)


@tool
def get_parts(term: str, min_weight: float = 25.0, limit: int = 30) -> list[dict]:
    """Renvoie les parties / composants (`r_has_part`) d'un terme.

    Has-Part (`r_has_part`) — la cible est une partie, un constituant ou un
    membre du terme source (ex.: voiture | r_has_part | roue).
    """
    c = _client()
    rid = c.relation_type_id("r_has_part")
    res = c.relations_from(term, types_ids=[rid] if rid else None,
                           min_weight=min_weight, limit=limit)
    return _resolve_targets(c, term, "r_has_part", res)


@tool
def get_characteristics(term: str, min_weight: float = 25.0, limit: int = 30) -> list[dict]:
    """Renvoie les caractéristiques (`r_carac`) d'un terme.

    Characteristic (`r_carac`) — attributs ou adjectifs qualificatifs typiques
    (ex.: eau | r_carac | liquide ; neige | r_carac | blanche).
    """
    c = _client()
    rid = c.relation_type_id("r_carac")
    res = c.relations_from(term, types_ids=[rid] if rid else None,
                           min_weight=min_weight, limit=limit)
    return _resolve_targets(c, term, "r_carac", res)


@tool
def get_relations_of_type(
    term: str,
    relation_name: str,
    direction: str = "from",
    min_weight: float = 25.0,
    limit: int = 30,
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
        min_weight: filtrage.
        limit: max résultats.
    """
    c = _client()
    rid = c.relation_type_id(relation_name)
    if rid is None:
        return [{"error": f"relation inconnue: {relation_name!r}"}]
    incoming = direction == "to"
    if incoming:
        res = c.relations_to(term, types_ids=[rid], min_weight=min_weight, limit=limit)
    else:
        res = c.relations_from(term, types_ids=[rid], min_weight=min_weight, limit=limit)
    return _resolve_targets(c, term, relation_name, res, incoming=incoming)


@tool
def get_relations_between(term1: str, term2: str, min_weight: float = 5.0) -> list[dict]:
    """Renvoie toutes les relations entre deux termes (term1 → term2).

    Utile pour répondre "quel est le rapport entre A et B ?".
    """
    c = _client()
    res = c.relations_between(term1, term2, min_weight=min_weight)
    out: list[dict] = []
    for r in sorted(res.relations, key=lambda x: -x.w):
        rname = c.relation_type_name(r.type) or f"type_{r.type}"
        out.append({"source": term1, "relation": rname, "target": term2, "w": r.w})
    return out


@tool
def disambiguate(term: str) -> list[dict]:
    """Renvoie les raffinements sémantiques d'un terme polysémique.

    Utilise ceci quand un mot a plusieurs sens (avocat = fruit | juriste,
    souris = animal | informatique, etc.). Renvoie la liste des sens
    spécifiques disponibles dans JDM.
    """
    c = _client()
    ref = c.refinements(term)
    return [{"name": n.name, "id": n.id, "weight": n.w} for n in ref.refinements]


@tool
def list_relation_types(prefix: str = "") -> list[dict]:
    """Liste les types de relations JDM disponibles (filtrage optionnel par préfixe).

    Permet à l'agent de découvrir quelles relations existent quand il n'est pas
    sûr du nom. Renvoie [{name, id, help}, ...].
    """
    c = _client()
    out = []
    for rt in c.relation_types():
        if prefix and not rt.name.startswith(prefix):
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
    # Annotation discrète : on ajoute une ligne en fin de description des tools
    # qui pointent sur une relation précise. Les tools StructuredTool sont
    # immutables côté schema, mais leur `description` est modifiable.
    suffix_map = {
        "get_synonyms": "r_syn",
        "get_antonyms": "r_anto",
        "get_hypernyms": "r_isa",
        "get_hyponyms": "r_hypo",
        "get_parts": "r_has_part",
        "get_characteristics": "r_carac",
    }
    for t in ALL_TOOLS:
        rel = suffix_map.get(t.name)
        if rel and docs.get(rel):
            t.description = f"{t.description}\n\n[JDM] {describe_relation(rel, docs)}"
    return list(ALL_TOOLS)
