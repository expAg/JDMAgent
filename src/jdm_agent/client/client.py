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
    Annotation,
    DecodedRefinement,
    Node,
    NodeType,
    RefinementsResult,
    RelationType,
    RelationsResult,
)


DEFAULT_BASE_URL = "https://jdm-api.demo.lirmm.fr"


class JDMError(RuntimeError):
    """Erreur retournée par l'API JDM (statut ≠ 200 après retries)."""


class JDMNotFoundError(JDMError):
    """404 sur l'API JDM : nœud / ressource introuvable.

    Sous-classe spécifique pour permettre aux callers de la catcher et
    traiter comme « résultat vide » (cas typique : `relations_from_to`
    avec une cible absente du graphe → on veut un RelationsResult vide,
    pas une erreur remontée jusqu'au LLM)."""


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
        # Cas particulier : JDM renvoie parfois 500 (au lieu de 404) quand
        # un nœud n'existe pas — le message du body est le même
        # (« Node 'X' not found! »). Avant de retry sur 5xx, on inspecte
        # le body : si c'est manifestement un nœud absent, on traite
        # comme un 404 (JDMNotFoundError, pas de retry).
        body_lc = (r.text or "").lower()
        if r.status_code >= 500 and "not found" in body_lc:
            raise JDMNotFoundError(
                f"GET {path} → {r.status_code} (JDM renvoie 500 sur un nœud "
                f"absent ; traité comme 404) : {r.text[:200]}"
            )
        if r.status_code == 429 or r.status_code >= 500:
            r.raise_for_status()  # déclenchera un retry via tenacity
        if r.status_code == 404:
            # 404 = ressource non trouvée. On lève une exception dédiée
            # que les callers `relations_*` peuvent catcher pour renvoyer
            # un résultat vide (cas légitime : nœud absent du graphe).
            # `node_by_name`, lui, NE catche PAS — son contrat est que
            # l'absence du terme = erreur de l'appelant.
            raise JDMNotFoundError(
                f"GET {path} → 404 : {r.text[:200]}"
            )
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

    def random_term(
        self,
        *,
        id_max: int = 5_000_000,
        id_min: int = 1,
        max_tries: int = 25,
        min_level: float = 60.0,
    ) -> Optional[Node]:
        """Tire un terme au hasard dans JeuxDeMots.

        Implémentation : on demande un bloc de relations au hasard
        (`relations_random`) et on garde le premier NŒUD renvoyé qui ressemble
        à un VRAI terme du lexique : type == 1, nom non vide, pas de chars
        techniques `: # _ | \\ /`, niveau de popularité >= min_level. Les
        raffinements (`avocat>116477>66699`, contenant `>`) sont AUTORISES —
        c'est au caller (cf. tool pick_random_term) d'exposer la forme décodée
        en plus du brut.

        Signature INCHANGÉE (drop-in). `id_min`/`id_max` sont conservés pour
        compat mais ne sont plus utilisés (on ne tire plus par ID) ; `max_tries`
        borne le nombre d'appels au endpoint (un seul suffit en général, il
        renvoie ~100 nœuds).

        Renvoie None si max_tries épuisés sans hit.
        """
        import random as _random
        for _ in range(max_tries):
            try:
                res = self.relations_random(limit=100)
            except Exception:
                continue
            nodes = list(res.nodes)
            if not nodes:
                continue
            _random.shuffle(nodes)
            for n in nodes:
                if n.type != 1:
                    continue
                if not n.name or len(n.name.strip()) < 2:
                    continue
                # NB: `>` retire de la blacklist — les raffinements sont OK.
                if any(ch in n.name for ch in (':', '#', '_', '|', '\\', '/')):
                    continue
                if getattr(n, 'level', 0) is None or float(getattr(n, 'level', 0)) < min_level:
                    continue
                return n
        return None

    def refinements(self, name: str) -> RefinementsResult:
        data = self._cached_get(f"/v0/refinements/{quote(name, safe='')}", ttl=self._ttl_data)
        return RefinementsResult.model_validate(data)

    # -- décodage générique d'un nom (refinement OU terme simple) --
    def decode_node_name(
        self,
        name: str,
        local_nodes: Optional[dict[int, Node]] = None,
    ) -> dict:
        """Décode un nom de nœud JDM (`term>ID[>ID...]`) en forme lisible.

        Idempotent : si le nom n'est PAS un refinement (pas de `>` avec entiers),
        renvoie le nom tel quel. Aucun appel HTTP dans ce cas.

        Si `local_nodes` est fourni (typiquement le dict node_index() d'un
        RelationsResult), les IDs déjà connus localement sont résolus sans
        nouvel appel HTTP — économie cruciale dans les boucles.

        Renvoie :
            {"decoded": str,           # forme lisible humain
             "is_refinement": bool,    # True si le nom contient des IDs JDM
             "path": list[str],        # ["avocat", "personne", "juriste"]
             "path_ids": list[int]}    # [116477, 66699]
        """
        if ">" not in name:
            return {"decoded": name, "is_refinement": False,
                    "path": [name], "path_ids": []}

        parts = name.split(">")
        head = parts[0]
        id_tokens = parts[1:]
        path: list[str] = [head]
        path_ids: list[int] = []
        looks_like_refinement = False

        for tok in id_tokens:
            try:
                nid = int(tok)
            except ValueError:
                # Pas un entier — token textuel, on le garde tel quel,
                # mais ce n'est pas un refinement "standard".
                path.append(tok)
                continue
            looks_like_refinement = True
            path_ids.append(nid)
            lbl: Optional[str] = None
            if local_nodes is not None:
                n = local_nodes.get(nid)
                if n is not None:
                    lbl = n.name
            if lbl is None:
                try:
                    lbl = self.node_by_id(nid).name
                except Exception:
                    lbl = f"<id:{nid}>"
            path.append(lbl)

        if not looks_like_refinement:
            # `>` présent mais aucun ID résolu → on ne décore pas.
            return {"decoded": name, "is_refinement": False,
                    "path": [name], "path_ids": []}

        decoded = f"{head} ({', '.join(path[1:])})" if len(path) > 1 else head
        return {"decoded": decoded, "is_refinement": True,
                "path": path, "path_ids": path_ids}

    def refinements_decoded(self, name: str) -> list[DecodedRefinement]:
        """Renvoie les raffinements en décodant les IDs internes (`>40056>171870`)
        en labels humains via des lookups `node_by_id`.

        Le `weight` exposé est celui de la **relation `r_raff_sem`** qui lie
        le terme racine à son sens raffiné — c'est le score de consensus
        « ce nœud est-il vraiment un sens de `name` ? » qu'affiche le site
        jeuxdemots.org. PAS la popularité brute du nœud raffiné lui-même
        (qui est généralement beaucoup plus faible et trompeuse pour
        classer les sens). Fallback sur le poids du nœud si la relation
        n'est pas disponible.

        Exemple :
            "avocat>116477>66699" → "avocat (personne, juriste)"
            path=["avocat","personne","juriste"], path_ids=[116477, 66699]
        """
        ref = self.refinements(name)
        # Indexe d'abord les nœuds déjà fournis par /refinements pour éviter
        # des aller-retours HTTP supplémentaires sur ceux qu'on connaît déjà.
        local = {n.id: n.name for n in ref.nodes}

        # Récupère les poids r_raff_sem pour avoir le score de consensus
        # de chaque sens (pas la popularité brute du nœud raffiné).
        # Cache disque → après le 1er appel c'est gratuit.
        raff_weights: dict[int, float] = {}
        try:
            rid = self.relation_type_id("r_raff_sem")
            if rid is not None:
                rels = self.relations_from(name, types_ids=[rid])
                for rel in rels.relations:
                    raff_weights[rel.node2] = rel.w
        except Exception:
            pass  # fallback silencieux sur r.w (popularité du nœud)

        out: list[DecodedRefinement] = []
        for r in ref.refinements:
            parts = r.name.split(">")
            head = parts[0]                      # le terme lui-même
            id_tokens = parts[1:]                # liste de "12345"
            path: list[str] = [head]
            path_ids: list[int] = []
            for tok in id_tokens:
                try:
                    nid = int(tok)
                except ValueError:
                    path.append(tok)
                    continue
                path_ids.append(nid)
                lbl = local.get(nid)
                if lbl is None:
                    try:
                        lbl = self.node_by_id(nid).name
                    except Exception:
                        lbl = f"<id:{nid}>"
                path.append(lbl)
            decoded = f"{head} ({', '.join(path[1:])})" if len(path) > 1 else head
            # Poids r_raff_sem (consensus du sens) si dispo, sinon r.w
            # (popularité brute du nœud — fallback de dernier recours).
            true_weight = raff_weights.get(r.id, r.w)
            out.append(DecodedRefinement(
                id=r.id, name=r.name, decoded=decoded,
                path=path, path_ids=path_ids, weight=true_weight,
            ))
        return out

    def term_exists(self, name: str) -> bool:
        """True si le terme (ou raffinement) existe comme nœud JDM.

        L'API JDM répond HTTP 500 pour un terme inconnu ; on convertit ça
        en simple booléen pour ne pas exposer d'erreur serveur à l'UI.
        """
        try:
            self.node_by_name(name)
            return True
        except Exception:
            return False

    def resolve_refinement(self, soft_name: str) -> Optional[str]:
        """Traduit une forme « molle » de raffinement vers le nom brut JDM.

        JDM nomme ses raffinements `terme>ID>ID` (IDs de nœuds). L'utilisateur,
        lui, écrit la forme lisible — `avocat>juriste`, `avocat>personne>juriste`.
        Cette méthode retrouve le nom brut correspondant en appariant les
        indices textuels au chemin décodé de chaque raffinement.

        Renvoie :
            - le nom inchangé si `soft_name` est déjà brut (IDs numériques)
              ou un terme simple sans `>` ;
            - le nom brut JDM (`avocat>116477>66699`) si un raffinement
              correspond ;
            - None si le terme de base n'a aucun raffinement appariable.
        """
        if ">" not in soft_name:
            return soft_name
        parts = [p.strip() for p in soft_name.split(">")]
        base = parts[0]
        hints = [p for p in parts[1:] if p]
        if not hints:
            return base
        # Déjà brut : tous les segments après le terme sont des IDs numériques.
        if all(h.isdigit() for h in hints):
            return soft_name
        try:
            refs = self.refinements_decoded(base)
        except Exception:
            return None

        def _n(s: str) -> str:
            return s.strip().lower()

        hint_n = [_n(h) for h in hints]
        best_name: Optional[str] = None
        best_score = 0
        for r in refs:
            path_n = [_n(p) for p in r.path[1:]]   # segments hors terme de base
            decoded_n = _n(r.decoded)
            score = 0
            for h in hint_n:
                if any(h in p or p in h for p in path_n) or h in decoded_n:
                    score += 1
            if score > best_score:
                best_score = score
                best_name = r.name
        return best_name if best_score > 0 else None

    def resolve_term(self, term: str) -> str:
        """Normalise un terme pour la requête : résout une forme molle de
        raffinement si possible, sinon renvoie le terme tel quel.

        Sans `>` dans le terme : aucun appel HTTP, renvoi immédiat.
        """
        if ">" not in term:
            return term
        resolved = self.resolve_refinement(term)
        return resolved if resolved else term

    # ---------- Annotations (Phase 9) ----------

    # Mapping id de relation d'annotation → 'kind' lisible exposé au LLM
    _ANNOTATION_KINDS = {
        996: "context",     # r_annotation_context
        997: "exception",   # r_annotation_exception
        998: "annotation",  # r_annotation (général)
    }

    def get_annotations_for_triplet(self, rel_id: int) -> list[Annotation]:
        """Récupère les annotations sémantiques attachées au triplet d'id `rel_id`.

        Mécanisme JDM (cf. relation_definitions.md §20) :
            Un nœud d'ancrage existe avec name = f":r{rel_id}". Les annotations
            sortantes sont les relations de type 996/997/998 vers une cible
            lexicale (type 1).

        Renvoie [] si le triplet n'a aucune annotation (JDM répond HTTP 500 dans
        ce cas, qu'on traite gracefully).
        """
        annot_node_name = f":r{rel_id}"
        try:
            # NOTE: JDM a un bug — passer types_ids avec plusieurs valeurs sur un
            # nœud `:r{id}` retourne 500. On récupère TOUT et on filtre Python.
            res = self.relations_from(annot_node_name)
        except Exception:
            # Soit le nœud d'ancrage n'existe pas (triplet jamais annoté → 500),
            # soit réseau. Dans tous les cas : pas d'annotations exploitables.
            return []
        idx = res.node_index()
        out: list[Annotation] = []
        for r in res.relations:
            kind = self._ANNOTATION_KINDS.get(r.type)
            if kind is None:
                continue   # skip r_pos (type 4 "Relation:") et autres
            target = idx.get(r.node2)
            # On ne garde que les annotations dont la cible est un terme lexical
            # (n.type == 1). Skip les structures internes (type 4 etc.).
            if target is None or target.type != 1:
                continue
            out.append(Annotation(kind=kind, value=target.name, w=r.w))
        # Tri par |w| décroissant : annotations les plus consensuelles d'abord
        out.sort(key=lambda a: -abs(a.w))
        return out

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
        try:
            data = self._cached_get(f"/v0/relations/from/{quote(name, safe='')}", ttl=self._ttl_data, params=params)
        except JDMNotFoundError:
            return RelationsResult()  # nœud absent → résultat vide normal
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
        try:
            data = self._cached_get(f"/v0/relations/to/{quote(name, safe='')}", ttl=self._ttl_data, params=params)
        except JDMNotFoundError:
            return RelationsResult()
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
        try:
            data = self._cached_get(path, ttl=self._ttl_data, params=params)
        except JDMNotFoundError:
            # L'un des deux nœuds n'existe pas dans JDM (par ex. cible
            # absente). C'est un cas légitime : pas de relations entre
            # eux = résultat vide, pas une erreur.
            return RelationsResult()
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

    def relations_random(
        self,
        *,
        types_ids: Optional[Sequence[int]] = None,
        not_types_ids: Optional[Sequence[int]] = None,
        min_weight: Optional[float] = None,
        max_weight: Optional[float] = None,
        limit: Optional[int] = None,
        without_nodes: Optional[bool] = None,
    ) -> RelationsResult:
        """Tire un bloc de relations AU HASARD via `/v0/relations/random`.

        Le serveur choisit un offset aléatoire dans la table des relations puis
        renvoie jusqu'à `limit` relations (+ leurs nœuds), filtrées par
        `types_ids` / `min_weight`… C'est LE moyen efficace d'échantillonner le
        graphe (un seul appel HTTP), contrairement au sampling par ID.

        ⚠️ Ce endpoint attend `types_ids` / `not_types_ids` en **paramètres
        répétés** (convention tableau OpenAPI : `types_ids=6&types_ids=5`), PAS
        en CSV comme `/relations/from`. On passe donc des LISTES brutes à httpx
        (qui les sérialise en clés répétées) — surtout pas `_csv`.

        Non caché (chaque appel doit renvoyer un tirage frais) : passe par
        `_get_raw`, pas `_cached_get`.
        """
        params: dict = {}
        if types_ids:
            params["types_ids"] = [int(t) for t in types_ids]
        if not_types_ids:
            params["not_types_ids"] = [int(t) for t in not_types_ids]
        if min_weight is not None:
            params["min_weight"] = min_weight
        if max_weight is not None:
            params["max_weight"] = max_weight
        if limit is not None:
            params["limit"] = int(limit)
        if without_nodes is not None:
            params["without_nodes"] = str(without_nodes).lower()
        try:
            data = self._get_raw("/v0/relations/random", params=params)
        except JDMNotFoundError:
            return RelationsResult()
        if isinstance(data, list):
            data = {"relations": data, "nodes": []}
        res = RelationsResult.model_validate(data)
        # Le serveur IGNORE `limit` (renvoie toujours son bloc plein ~100) : on
        # tronque côté client pour que le paramètre « nombre » soit réel. Les
        # `nodes` restent complets (juste un index — surcoût nul).
        if limit is not None and limit >= 0 and len(res.relations) > limit:
            res.relations = res.relations[:limit]
        return res

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
