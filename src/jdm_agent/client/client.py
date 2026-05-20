"""Client typé pour l'API JeuxDeMots (https://jdm-api.demo.lirmm.fr).

Améliorations vs api-test.py :
- Pas d'effet de bord à l'import (chargement lazy des types).
- httpx.Client avec timeout et retry exponentiel (tenacity).
- Cache disque (diskcache) par défaut, TTL configurable par catégorie.
- Modèles Pydantic stricts.
- Support de tous les paramètres du schema OpenAPI (types_ids, min_weight,
  limit, offset, without_nodes, etc.).
"""
from __future__ import annotations

import os
from typing import Iterable, Optional, Sequence
from urllib.parse import quote

import httpx
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from jdm_agent.client.cache import DiskJSONCache
from jdm_agent.client.models import (
    Node,
    NodeType,
    RefinementsResult,
    RelationType,
    RelationsResult,
)


DEFAULT_BASE_URL = "https://jdm-api.demo.lirmm.fr"


class JDMError(RuntimeError):
    """Erreur retournée par l'API JDM (statut ≠ 200 après retries)."""


def _csv(values: Optional[Iterable[int]]) -> Optional[str]:
    """Sérialise une liste d'ids en query param 'id1,id2,...'."""
    if values is None:
        return None
    return ",".join(str(v) for v in values)


class JDMClient:
    """Client typé pour l'API REST JDM.

    Utilisation :
        c = JDMClient()
        node = c.node_by_name("chat")
        syns = c.relations_from("chat", types_ids=[c.relation_type_id("r_syn")])
    """

    def __init__(
        self,
        base_url: Optional[str] = None,
        timeout: Optional[float] = None,
        cache: Optional[DiskJSONCache] = None,
        cache_ttl_meta: Optional[int] = None,
        cache_ttl_data: Optional[int] = None,
    ) -> None:
        self.base_url = (base_url or os.environ.get("JDM_BASE_URL", DEFAULT_BASE_URL)).rstrip("/")
        timeout = timeout if timeout is not None else float(os.environ.get("JDM_TIMEOUT", "15"))
        self._http = httpx.Client(base_url=self.base_url, timeout=timeout)
        self._cache = cache if cache is not None else DiskJSONCache()
        self._ttl_meta = cache_ttl_meta if cache_ttl_meta is not None else int(
            os.environ.get("JDM_CACHE_TTL_META", str(7 * 24 * 3600))
        )
        self._ttl_data = cache_ttl_data if cache_ttl_data is not None else int(
            os.environ.get("JDM_CACHE_TTL_DATA", "3600")
        )
        self._relation_types_by_id: dict[int, RelationType] = {}
        self._relation_types_by_name: dict[str, RelationType] = {}
        self._node_types_by_id: dict[int, NodeType] = {}
        self._meta_loaded = False

    # ---------- HTTP layer ----------

    @retry(
        reraise=True,
        stop=stop_after_attempt(4),
        wait=wait_exponential(multiplier=0.5, min=0.5, max=8),
        retry=retry_if_exception_type((httpx.TransportError, httpx.HTTPStatusError)),
    )
    def _get_raw(self, path: str, params: Optional[dict] = None) -> dict | list:
        params = {k: v for k, v in (params or {}).items() if v is not None}
        r = self._http.get(path, params=params)
        if r.status_code == 429 or r.status_code >= 500:
            r.raise_for_status()  # déclenchera un retry via tenacity
        if r.status_code != 200:
            raise JDMError(f"GET {path} → {r.status_code} : {r.text[:200]}")
        return r.json()

    def _cached_get(
        self,
        path: str,
        *,
        ttl: int,
        params: Optional[dict] = None,
    ) -> dict | list:
        key = DiskJSONCache.make_key("GET", path, params or {})
        cached = self._cache.get(key)
        if cached is not None:
            return cached
        data = self._get_raw(path, params=params)
        self._cache.set(key, data, ttl=ttl)
        return data

    # ---------- Metadata (lazy, cached long) ----------

    def _ensure_meta(self) -> None:
        if self._meta_loaded:
            return
        rels = self._cached_get("/v0/relations_types", ttl=self._ttl_meta)
        nodes = self._cached_get("/v0/nodes_types", ttl=self._ttl_meta)
        for raw in rels:
            rt = RelationType.model_validate(raw)
            self._relation_types_by_id[rt.id] = rt
            self._relation_types_by_name[rt.name] = rt
        # /v0/nodes_types peut renvoyer list ou dict — normalise.
        node_iter = nodes if isinstance(nodes, list) else nodes.values()
        for raw in node_iter:
            nt = NodeType.model_validate(raw)
            self._node_types_by_id[nt.id] = nt
        self._meta_loaded = True

    def relation_types(self) -> list[RelationType]:
        self._ensure_meta()
        return list(self._relation_types_by_id.values())

    def node_types(self) -> list[NodeType]:
        self._ensure_meta()
        return list(self._node_types_by_id.values())

    def relation_type(self, name_or_id: str | int) -> Optional[RelationType]:
        self._ensure_meta()
        if isinstance(name_or_id, int):
            return self._relation_types_by_id.get(name_or_id)
        return self._relation_types_by_name.get(name_or_id)

    def relation_type_id(self, name: str) -> Optional[int]:
        rt = self.relation_type(name)
        return rt.id if rt else None

    def relation_type_name(self, type_id: int) -> Optional[str]:
        rt = self.relation_type(type_id)
        return rt.name if rt else None

    # ---------- Nodes ----------

    def node_by_id(self, node_id: int) -> Node:
        data = self._cached_get(f"/v0/node_by_id/{node_id}", ttl=self._ttl_data)
        return Node.model_validate(data)

    def node_by_name(self, name: str) -> Node:
        data = self._cached_get(f"/v0/node_by_name/{quote(name, safe='')}", ttl=self._ttl_data)
        return Node.model_validate(data)

    def refinements(self, name: str) -> RefinementsResult:
        data = self._cached_get(f"/v0/refinements/{quote(name, safe='')}", ttl=self._ttl_data)
        return RefinementsResult.model_validate(data)

    # ---------- Relations ----------

    def _relations_params(
        self,
        types_ids: Optional[Sequence[int]] = None,
        not_types_ids: Optional[Sequence[int]] = None,
        min_weight: Optional[float] = None,
        max_weight: Optional[float] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
        without_nodes: Optional[bool] = None,
    ) -> dict:
        return {
            "types_ids": _csv(types_ids),
            "not_types_ids": _csv(not_types_ids),
            "min_weight": min_weight,
            "max_weight": max_weight,
            "limit": limit,
            "offset": offset,
            "without_nodes": str(without_nodes).lower() if without_nodes is not None else None,
        }

    def relations_from(
        self,
        name: str,
        types_ids: Optional[Sequence[int]] = None,
        not_types_ids: Optional[Sequence[int]] = None,
        min_weight: Optional[float] = None,
        max_weight: Optional[float] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
        without_nodes: Optional[bool] = None,
    ) -> RelationsResult:
        params = self._relations_params(types_ids, not_types_ids, min_weight, max_weight, limit, offset, without_nodes)
        data = self._cached_get(f"/v0/relations/from/{quote(name, safe='')}", ttl=self._ttl_data, params=params)
        return RelationsResult.model_validate(data)

    def relations_to(
        self,
        name: str,
        types_ids: Optional[Sequence[int]] = None,
        not_types_ids: Optional[Sequence[int]] = None,
        min_weight: Optional[float] = None,
        max_weight: Optional[float] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
        without_nodes: Optional[bool] = None,
    ) -> RelationsResult:
        params = self._relations_params(types_ids, not_types_ids, min_weight, max_weight, limit, offset, without_nodes)
        data = self._cached_get(f"/v0/relations/to/{quote(name, safe='')}", ttl=self._ttl_data, params=params)
        return RelationsResult.model_validate(data)

    def relations_between(
        self,
        name1: str,
        name2: str,
        types_ids: Optional[Sequence[int]] = None,
        min_weight: Optional[float] = None,
        limit: Optional[int] = None,
        without_nodes: Optional[bool] = None,
    ) -> RelationsResult:
        params = self._relations_params(
            types_ids=types_ids, min_weight=min_weight, limit=limit, without_nodes=without_nodes
        )
        path = f"/v0/relations/from/{quote(name1, safe='')}/to/{quote(name2, safe='')}"
        data = self._cached_get(path, ttl=self._ttl_data, params=params)
        return RelationsResult.model_validate(data)

    def relations_by_type(
        self,
        type_id: int,
        min_weight: Optional[float] = None,
        max_weight: Optional[float] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
    ) -> RelationsResult:
        params = {
            "min_weight": min_weight,
            "max_weight": max_weight,
            "limit": limit,
            "offset": offset,
        }
        data = self._cached_get(f"/v0/relations/by_type_id/{type_id}", ttl=self._ttl_data, params=params)
        # by_type_id ne renvoie pas forcément de `nodes`; on tolère.
        if isinstance(data, list):
            data = {"relations": data, "nodes": []}
        return RelationsResult.model_validate(data)

    # ---------- High-level helpers ----------

    def synonyms(self, name: str, min_weight: float = 25.0, limit: int = 30) -> list[Node]:
        """Renvoie les nœuds synonymes (r_syn) du terme, triés par poids décroissant."""
        rsyn = self.relation_type_id("r_syn")
        res = self.relations_from(name, types_ids=[rsyn] if rsyn is not None else None,
                                  min_weight=min_weight, limit=limit)
        idx = res.node_index()
        nodes = [idx[r.node2] for r in res.relations if r.node2 in idx]
        nodes.sort(key=lambda n: -n.w)
        return nodes

    def hypernyms(self, name: str, min_weight: float = 25.0, limit: int = 30) -> list[Node]:
        """Renvoie les hyperonymes (r_isa) du terme."""
        risa = self.relation_type_id("r_isa")
        res = self.relations_from(name, types_ids=[risa] if risa is not None else None,
                                  min_weight=min_weight, limit=limit)
        idx = res.node_index()
        return [idx[r.node2] for r in res.relations if r.node2 in idx]

    def close(self) -> None:
        self._http.close()
        self._cache.close()

    def __enter__(self) -> "JDMClient":
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()
