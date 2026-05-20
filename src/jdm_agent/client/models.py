"""Modèles Pydantic pour les réponses de l'API JeuxDeMots.

Les schémas réels ont été inférés à partir de l'OpenAPI publié par
https://jdm-api.demo.lirmm.fr/schema et de réponses observées.
"""
from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class Node(BaseModel):
    """Un nœud du graphe JDM (terme, raffinement, chunk, etc.).

    Les réponses "légères" (incluses dans /relations) ne contiennent que
    id/name/type/w. Les autres champs deviennent None.
    """
    model_config = ConfigDict(extra="allow")

    id: int
    name: str
    type: int
    w: float = 0.0  # weight
    c: Optional[float] = None
    level: Optional[float] = None
    infoid: Optional[int] = None
    creationdate: Optional[str] = None
    touchdate: Optional[str] = None


class Relation(BaseModel):
    """Un triplet (node1) --type--> (node2) avec poids w."""
    model_config = ConfigDict(extra="allow")

    id: int
    node1: int
    node2: int
    type: int
    w: float


class RelationType(BaseModel):
    """Métadonnées d'un type de relation (ex. r_syn, r_isa)."""
    model_config = ConfigDict(extra="allow")

    id: int
    name: str
    gpname: Optional[str] = None
    help: Optional[str] = None
    quot: Optional[float] = None
    quotmin: Optional[float] = None
    quotmax: Optional[float] = None
    price: Optional[int] = None
    playable: Optional[int] = None
    oppos: Optional[int] = None


class NodeType(BaseModel):
    """Métadonnées d'un type de nœud."""
    model_config = ConfigDict(extra="allow")

    id: int
    name: str
    help: Optional[str] = None


class RelationsResult(BaseModel):
    """Réponse de /v0/relations/* : nœuds référencés + relations."""
    model_config = ConfigDict(extra="allow")

    nodes: List[Node] = Field(default_factory=list)
    relations: List[Relation] = Field(default_factory=list)
    request: Optional[dict] = None

    def node_index(self) -> dict[int, Node]:
        """Indexe les nœuds par id pour résoudre rapidement node1/node2."""
        return {n.id: n for n in self.nodes}


class DecodedRefinement(BaseModel):
    """Un raffinement avec son nom interne JDM décodé en clair.

    Le `name` brut suit le schéma `term>cat[>subcat[>...]]` où chaque entier
    est un node_id JDM. `decoded` est la version lisible humain
    (ex.: "avocat (personne, juriste)").
    """
    id: int
    name: str
    decoded: str
    path: List[str]              # ex.: ["avocat", "personne", "juriste"]
    path_ids: List[int]          # ex.: [116477, 66699]
    weight: float = 0.0


class RefinementsResult(BaseModel):
    """Réponse de /v0/refinements/{name}."""
    model_config = ConfigDict(extra="allow")

    nodes: List[Node] = Field(default_factory=list)
    refinements: List[Node] = Field(default_factory=list)
