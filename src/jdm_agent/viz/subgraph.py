"""Construit un sous-graphe JDM autour d'un terme racine, sérialisable en
JSON ou en HTML interactif (vis-network).

Spécification : voir `subgraph_visualization_howto.md` à la racine du dépôt.
Fichier de référence (rendu cible) : `plat_asiatique_subgraph.html`.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Literal, Optional

from jdm_agent.client import JDMClient
from jdm_agent.viz.template import HTML_TEMPLATE


# ---------- Paramètres par défaut (recette du howto) ----------

#: Jeu standard de relations explorées à la profondeur 1.
#: Sélection calibrée pour des sous-graphes lisibles (8 relations) — exclut
#: par défaut les inverses verbo-nominaux (patient-1, agent-1) et r_associated,
#: trop bruyants en exploration générale. Le LLM/utilisateur peut les
#: rajouter explicitement quand pertinent.
DEFAULT_RELATIONS: list[str] = [
    "r_isa", "r_hypo", "r_syn", "r_anto",
    "r_carac", "r_has_part", "r_lieu", "r_domain",
]

#: Sous-ensemble exploré à la profondeur 2 (limite l'explosion combinatoire).
#: Garde r_isa pour permettre la remontée catégorielle au 2nd niveau.
DEFAULT_DEPTH2_RELATIONS: list[str] = [
    "r_isa", "r_carac", "r_has_part", "r_lieu",
]

#: Profondeur 3 — encore plus étroit pour éviter le bruit.
DEFAULT_DEPTH3_RELATIONS: list[str] = [
    "r_isa", "r_has_part", "r_carac",
]

#: Profondeur 4 — uniquement la remontée catégorielle + caractérisation.
DEFAULT_DEPTH4_RELATIONS: list[str] = [
    "r_isa", "r_carac",
]

#: Opacité appliquée aux nœuds et aux arêtes par profondeur. Decroissance
#: linéaire bornée pour garder le niveau 4 encore visible.
OPACITY_BY_DEPTH: dict[int, float] = {0: 1.0, 1: 1.0, 2: 0.65, 3: 0.42, 4: 0.28}


# ---------- Mapping relation → couleur / "kind" CSS ----------

#: Type de nœud dérivé de la relation entrante (pour la palette de couleurs).
KIND_OF_REL: dict[str, str] = {
    "r_isa": "isa",
    "r_hypo": "hypo",
    "r_syn": "syn",
    "r_anto": "anto",
    "r_carac": "carac",
    "r_has_part": "part",
    "r_lieu": "lieu",
    "r_patient-1": "verb",
    "r_agent-1": "verb",
    "r_domain": "domain",
    "r_associated": "assoc",
}

#: Palette niveau 1 (voisins directs — couleurs saturées identifiables).
PALETTE: dict[str, dict[str, str]] = {
    "center": {"background": "#212121", "border": "#000"},
    "isa":    {"background": "#e3f2fd", "border": "#1976d2"},
    "hypo":   {"background": "#e8f5e9", "border": "#388e3c"},
    "syn":    {"background": "#f1f8e9", "border": "#558b2f"},
    "anto":   {"background": "#ffebee", "border": "#c62828"},
    "carac":  {"background": "#f3e5f5", "border": "#7b1fa2"},
    "part":   {"background": "#ffe1c2", "border": "#a04500"},  # terracotta sombre — orange neon retiré (illisible sur fond clair)
    "lieu":   {"background": "#e0f7fa", "border": "#00838f"},
    "verb":   {"background": "#fce4ec", "border": "#ad1457"},
    "domain": {"background": "#ede7f6", "border": "#4527a0"},
    "assoc":  {"background": "#eceff1", "border": "#455a64"},
    "d2":     {"background": "#fafafa", "border": "#bdbdbd"},  # fallback générique
}

#: Palette niveau 2 — fond quasi-blanc avec un soupçon de teinte, bordure
#: pastel claire. Contraste nettement renforcé vs niveau 1 tout en gardant
#: l'identité visuelle de la famille de relation.
PALETTE_D2: dict[str, dict[str, str]] = {
    "isa":    {"background": "#fbfdff", "border": "#bbdefb"},
    "hypo":   {"background": "#fbfdfa", "border": "#c8e6c9"},
    "syn":    {"background": "#fcfdf7", "border": "#dcedc8"},
    "anto":   {"background": "#fffafb", "border": "#ffcdd2"},
    "carac":  {"background": "#fcf8fc", "border": "#e1bee7"},
    "part":   {"background": "#fef1de", "border": "#d99a6c"},  # terracotta pastel — assorti à la nouvelle couleur niveau 1
    "lieu":   {"background": "#f8fcfd", "border": "#b2ebf2"},
    "verb":   {"background": "#fef7fa", "border": "#f8bbd0"},
    "domain": {"background": "#faf7fc", "border": "#d1c4e9"},
    "assoc":  {"background": "#fafbfc", "border": "#cfd8dc"},
}

#: Couleur d'arête niveau 1 par kind (= bordure niveau 1 mais sans wrapping dict).
EDGE_COLOR: dict[str, str] = {k: PALETTE[k]["border"] for k in PALETTE if k not in ("center", "d2")}

#: Couleur d'arête niveau 2 par kind (= bordure niveau 2).
EDGE_COLOR_D2: dict[str, str] = {k: PALETTE_D2[k]["border"] for k in PALETTE_D2}


def _palette_for(kind: str, depth: int) -> dict[str, str]:
    """Renvoie la couleur de fond/bordure adaptée au kind et à la profondeur."""
    if depth >= 2:
        return PALETTE_D2.get(kind, PALETTE["d2"])
    return PALETTE.get(kind, PALETTE["assoc"])


def _edge_color(kind: str, depth: int, negative: bool) -> str:
    """Couleur d'arête : rouge pour négation, teinte de la famille sinon.
    Le niveau 1 utilise la teinte saturée, tout niveau ≥ 2 la version pastel
    (l'opacité progressive distingue ensuite d2/d3/d4)."""
    if negative:
        return "#c62828" if depth < 2 else "#ef9a9a"
    if depth >= 2:
        return EDGE_COLOR_D2.get(kind, "#cfcfcf")
    return EDGE_COLOR.get(kind, "#9e9e9e")


def _opacity_for(depth: int) -> float:
    return OPACITY_BY_DEPTH.get(depth, OPACITY_BY_DEPTH[4])


# ---------- Slug pour nom de fichier ----------

_SLUG_RE = re.compile(r"[^a-z0-9]+")


def _slugify(text: str) -> str:
    s = text.lower().strip()
    s = _SLUG_RE.sub("_", s)
    return s.strip("_") or "subgraph"


# ---------- Coeur : construction du graphe ----------

def _fetch_relation(
    client: JDMClient,
    term: str,
    rel: str,
    top_k: int,
    min_weight: Optional[float],
) -> list[dict[str, Any]]:
    """Récupère les triplets pour une relation donnée, depuis le terme `term`.

    Renvoie la liste tronquée à `top_k` (par |w| décroissant), avec
    `{target_display, target_id, w, polarity}`.
    """
    rid = client.relation_type_id(rel)
    if rid is None:
        return []
    try:
        result = client.relations_from(
            term, types_ids=[rid],
            min_weight=min_weight,
            limit=max(top_k * 2, 20),  # marge pour pouvoir filtrer ensuite
        )
    except Exception:
        return []

    idx = result.node_index()
    out: list[dict[str, Any]] = []
    for r in sorted(result.relations, key=lambda x: -abs(x.w)):
        node = idx.get(r.node2)
        if node is None:
            try:
                node = client.node_by_id(r.node2)
            except Exception:
                continue
        if node.type == 8:  # chunks (agrégats syntaxiques) — exclus
            continue
        dec = client.decode_node_name(node.name, local_nodes=idx)
        out.append({
            "target_display": dec["decoded"],
            "target_id": node.name,
            "w": r.w,
            "polarity": "négation" if r.w < 0 else "affirmation",
        })
        if len(out) >= top_k:
            break
    return out


def _build_node(
    node_id: str,
    label: str,
    kind: str,
    depth: int,
    fixed_center: bool = False,
) -> dict[str, Any]:
    """Construit un nœud vis-network. Le centre garde sa couleur dédiée ;
    les autres nœuds prennent une palette plus claire à partir du niveau 2
    (même teinte que le niveau 1, mais visiblement adoucie). L'opacité du
    nœud décroît avec la profondeur (cf. OPACITY_BY_DEPTH)."""
    if fixed_center:
        color = PALETTE["center"]
    else:
        color = _palette_for(kind, depth)
    opacity = _opacity_for(depth)
    # Taille de police : 28 au centre, 22 au niveau 1, 17 ensuite ;
    # +1 pour le niveau 2 pour ne pas trop pénaliser le 1er anneau d2.
    if fixed_center:
        font_size = 28
    elif depth >= 3:
        font_size = 16
    elif depth == 2:
        font_size = 18
    else:
        font_size = 22
    node: dict[str, Any] = {
        "id": node_id,
        "label": label,
        "color": color,
        "opacity": opacity,
        "shape": "ellipse" if fixed_center else "box",
        "font": {
            "size": font_size,
            "color": "#fff" if fixed_center else "#222",
            "face": "system-ui",
        },
        "margin": 12,
        "widthConstraint": {"maximum": 220},
        "_depth": depth,
        "_kind": kind,
    }
    if fixed_center:
        node["x"] = 0
        node["y"] = 0
        node["fixed"] = {"x": True, "y": True}
        node["mass"] = 5
    return node


def _build_edge(
    from_id: str,
    to_id: str,
    relation: str,
    w: float,
    polarity: str,
    depth: int,
) -> dict[str, Any]:
    """Construit une arête vis-network.

    - Couleur du trait ET de l'étiquette = teinte de la famille de relation
      (r_isa → bleu, r_hypo → vert, ...), avec une variante plus claire au
      niveau 2.
    - Opacité dépend du niveau : 1.0 au niveau 1, 0.55 au niveau 2 — d'où
      un effet "voisinage immédiat saturé / extensions estompées".
    - Négation = rouge (saturé au niveau 1, pâle au niveau 2), label
      préfixé « NON ».
    - Niveau 2 = pointillés (en plus de la teinte adoucie).
    """
    is_neg = polarity == "négation"
    is_d2 = depth >= 2
    kind = KIND_OF_REL.get(relation, "assoc")
    label = f"NON {relation} {int(round(w))}" if is_neg else f"{relation} {int(round(w))}"
    color = _edge_color(kind, depth, is_neg)
    opacity = _opacity_for(depth)
    # Couleur du label : même teinte que le trait pour lier visuellement,
    # avec un léger fond blanc pour rester lisible par-dessus les nœuds.
    font_color = color
    return {
        "from": from_id,
        "to": to_id,
        "label": label,
        "arrows": "to",
        "font": {
            "size": 13 if is_d2 else 14,
            "color": font_color,
            "background": "#bcbfc2ee",
            "strokeWidth": 0,
        },
        # vis-network supporte color: { color, opacity }
        "color": {"color": color, "opacity": opacity},
        "dashes": is_d2,
        "smooth": {"type": "dynamic"},
        "_relation": relation,
        "_kind": kind,
        "_weight": w,
        "_polarity": polarity,
        "_negative": is_neg,
        "_depth": depth,
    }


def build_subgraph(
    term: str,
    *,
    client: Optional[JDMClient] = None,
    depth: int = 2,
    top_k_per_relation: int = 3,
    min_weight: Optional[float] = None,
    relations: Optional[list[str]] = None,
    depth2_relations: Optional[list[str]] = None,
    depth3_relations: Optional[list[str]] = None,
    depth4_relations: Optional[list[str]] = None,
    output: Literal["json", "html"] = "html",
    output_path: Optional[str] = None,
) -> dict[str, Any]:
    """Construit un sous-graphe JDM centré sur `term`.

    Args:
        term: terme racine (en français, accentué si besoin).
        client: JDMClient injecté ; un client par défaut sera créé sinon.
        depth: profondeur d'exploration (1..4 ; au-delà = illisible).
        top_k_per_relation: nombre max de cibles retenues par relation et par nœud.
        min_weight: poids minimum (None = pas de filtre, JDM décide).
        relations: relations explorées à la profondeur 1 (défaut = `DEFAULT_RELATIONS`).
        depth2_relations: relations à la profondeur 2 (défaut = `DEFAULT_DEPTH2_RELATIONS`).
        depth3_relations: relations à la profondeur 3 (défaut = `DEFAULT_DEPTH3_RELATIONS`).
        depth4_relations: relations à la profondeur 4 (défaut = `DEFAULT_DEPTH4_RELATIONS`).
        output: "json" → dict `{nodes, edges, ...}` ; "html" → écrit un fichier autonome.
        output_path: chemin d'écriture (si None et output="html", utilise `<slug>_subgraph.html` dans le CWD).

    Returns:
        Dict avec les clés :
        - `root`: terme racine
        - `nodes`: liste de nœuds vis-network (présent si output="json")
        - `edges`: liste d'arêtes vis-network (présent si output="json")
        - `stats`: {n_nodes, n_edges, n_negative, relations_used, depth}
        - `html_path`: chemin du fichier écrit (si output="html")
    """
    c = client or JDMClient()
    depth = max(1, min(int(depth), 4))  # garde-fou : 1..4

    # Sélection effective par profondeur.
    rels_by_depth: dict[int, list[str]] = {
        1: list(relations) if relations is not None else list(DEFAULT_RELATIONS),
        2: list(depth2_relations) if depth2_relations is not None else list(DEFAULT_DEPTH2_RELATIONS),
        3: list(depth3_relations) if depth3_relations is not None else list(DEFAULT_DEPTH3_RELATIONS),
        4: list(depth4_relations) if depth4_relations is not None else list(DEFAULT_DEPTH4_RELATIONS),
    }

    # 1) Nœud central
    root_node = _build_node("ROOT", term, "center", depth=0, fixed_center=True)
    nodes: list[dict[str, Any]] = [root_node]
    edges: list[dict[str, Any]] = []
    # Index pour dédupliquer les nœuds par identifiant lisible (label décodé).
    label_to_id: dict[str, str] = {term: "ROOT"}
    next_uid = [0]

    def _ensure_node(label: str, kind: str, depth_lv: int) -> str:
        if label in label_to_id:
            return label_to_id[label]
        next_uid[0] += 1
        nid = f"N{next_uid[0]}"
        label_to_id[label] = nid
        nodes.append(_build_node(
            nid, label,
            kind,  # garde la teinte de la famille ; _palette_for éclaircit au niveau 2
            depth=depth_lv,
        ))
        return nid

    # Boucle généralisée sur les profondeurs 1..depth. À chaque tour on
    # garde la liste des nœuds tout juste ajoutés pour itérer dessus au
    # tour suivant.
    current_layer: list[tuple[str, str]] = [(term, "center")]
    for d in range(1, depth + 1):
        rels_for_d = rels_by_depth.get(d, [])
        # Limiter doucement la cardinalité au-delà du niveau 2 pour contenir
        # l'explosion combinatoire — mais pas trop, l'utilisateur a déjà
        # choisi top_k_per_relation et la sélection de relations à ce niveau.
        top_k_d = top_k_per_relation if d <= 2 else max(1, top_k_per_relation // 2)
        next_layer: list[tuple[str, str]] = []
        for parent_label, _parent_kind in current_layer:
            parent_id = label_to_id.get(parent_label, "ROOT")
            for rel in rels_for_d:
                kind = KIND_OF_REL.get(rel, "assoc")
                rows = _fetch_relation(c, parent_label, rel, top_k_d, min_weight)
                for row in rows:
                    tgt = row["target_display"]
                    if tgt == term:
                        # Lien retour vers la racine : on matérialise l'arête
                        # mais on ne ré-ajoute pas le nœud.
                        edges.append(_build_edge(
                            parent_id, "ROOT", rel, row["w"], row["polarity"], depth=d,
                        ))
                        continue
                    is_new = tgt not in label_to_id
                    nid_to = _ensure_node(tgt, kind, depth_lv=d)
                    if parent_id == nid_to:
                        continue
                    edges.append(_build_edge(
                        parent_id, nid_to, rel, row["w"], row["polarity"], depth=d,
                    ))
                    if is_new:
                        next_layer.append((tgt, kind))
        current_layer = next_layer
        if not current_layer:
            break

    n_negative = sum(1 for e in edges if e.get("_negative"))
    stats = {
        "n_nodes": len(nodes),
        "n_edges": len(edges),
        "n_negative": n_negative,
        "relations_used": rels_by_depth[1],
        "relations_by_depth": {d: rels_by_depth[d] for d in range(1, depth + 1)},
        "depth": depth,
    }
    rels = rels_by_depth[1]  # legacy alias pour la légende ci-dessous

    result: dict[str, Any] = {"root": term, "stats": stats}

    if output == "json":
        result["nodes"] = nodes
        result["edges"] = edges
        return result

    # output == "html"
    legend_chips = [
        f'<span style="background:#212121;color:#fff;">{term}</span>',
    ]
    for rel in rels:
        kind = KIND_OF_REL.get(rel, "assoc")
        bg = PALETTE.get(kind, PALETTE["assoc"])["background"]
        legend_chips.append(f'<span style="background:{bg};">{rel}</span>')
    if depth >= 2:
        legend_chips.append(
            '<span style="background:#f5f5f5;border:1px dashed #9e9e9e;">profondeur ≥ 2 (pointillés, opacité décroissante)</span>'
        )
    legend_chips.append(
        '<span style="background:#ffebee;color:#c62828;border:1px solid #c62828;">négation</span>'
    )

    html = (
        HTML_TEMPLATE
        .replace("{{TITLE}}", f"« {term} » — sous-graphe JDM (profondeur {depth})")
        .replace(
            "{{SUBTITLE}}",
            "Nœud central fixé. Voisins niveau 1 en couleur (par type de relation), "
            "niveau 2 en gris clair pointillé, négations en rouge. Molette = zoom, glisser = déplacer.",
        )
        .replace("{{LEGEND}}", "".join(legend_chips))
        .replace("{{NODES_JSON}}", json.dumps(nodes, ensure_ascii=False))
        .replace("{{EDGES_JSON}}", json.dumps(edges, ensure_ascii=False))
    )

    if output_path is None:
        output_path = f"{_slugify(term)}_subgraph.html"
    p = Path(output_path)
    p.write_text(html, encoding="utf-8")
    result["html_path"] = str(p.resolve())
    return result
