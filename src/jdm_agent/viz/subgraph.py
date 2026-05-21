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
DEFAULT_RELATIONS: list[str] = [
    "r_isa", "r_hypo", "r_syn", "r_anto",
    "r_carac", "r_has_part", "r_lieu",
    "r_patient-1", "r_agent-1",
    "r_domain", "r_associated",
]

#: Sous-ensemble exploré à la profondeur 2 (limite l'explosion combinatoire).
DEFAULT_DEPTH2_RELATIONS: list[str] = [
    "r_has_part", "r_lieu", "r_carac", "r_hypo",
]


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

#: Palette de couleurs par kind (étend la palette du fichier de référence).
PALETTE: dict[str, dict[str, str]] = {
    "center": {"background": "#212121", "border": "#000"},
    "isa":    {"background": "#e3f2fd", "border": "#1976d2"},
    "hypo":   {"background": "#e8f5e9", "border": "#388e3c"},
    "syn":    {"background": "#f1f8e9", "border": "#558b2f"},
    "anto":   {"background": "#ffebee", "border": "#c62828"},
    "carac":  {"background": "#f3e5f5", "border": "#7b1fa2"},
    "part":   {"background": "#fff3e0", "border": "#ef6c00"},
    "lieu":   {"background": "#e0f7fa", "border": "#00838f"},
    "verb":   {"background": "#fce4ec", "border": "#ad1457"},
    "domain": {"background": "#ede7f6", "border": "#4527a0"},
    "assoc":  {"background": "#eceff1", "border": "#455a64"},
    "d2":     {"background": "#fafafa", "border": "#bdbdbd"},
}


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
    """Construit un nœud vis-network."""
    color = PALETTE.get(kind, PALETTE["assoc"])
    node: dict[str, Any] = {
        "id": node_id,
        "label": label,
        "color": color,
        "shape": "ellipse" if fixed_center else "box",
        "font": {
            "size": 28 if fixed_center else (18 if depth >= 2 else 22),
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
    """Construit une arête vis-network. d2 = pointillés, négation = rouge + NON."""
    is_neg = polarity == "négation"
    is_d2 = depth >= 2
    label = f"NON {relation} {int(round(w))}" if is_neg else f"{relation} {int(round(w))}"
    color = "#c62828" if is_neg else ("#cfcfcf" if is_d2 else "#9e9e9e")
    return {
        "from": from_id,
        "to": to_id,
        "label": label,
        "arrows": "to",
        "font": {"size": 14, "color": "#b71c1c" if is_neg else "#555",
                 "background": "#ffffffcc", "strokeWidth": 0},
        "color": {"color": color},
        "dashes": is_d2,
        "smooth": {"type": "dynamic"},
        "_relation": relation,
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
    top_k_per_relation: int = 6,
    min_weight: Optional[float] = None,
    relations: Optional[list[str]] = None,
    depth2_relations: Optional[list[str]] = None,
    output: Literal["json", "html"] = "html",
    output_path: Optional[str] = None,
) -> dict[str, Any]:
    """Construit un sous-graphe JDM centré sur `term`.

    Args:
        term: terme racine (en français, accentué si besoin).
        client: JDMClient injecté ; un client par défaut sera créé sinon.
        depth: profondeur d'exploration (1 = voisins directs, 2 = voisins de voisins).
        top_k_per_relation: nombre max de cibles retenues par relation et par nœud.
        min_weight: poids minimum (None = pas de filtre, JDM décide).
        relations: relations explorées à la profondeur 1 (défaut = `DEFAULT_RELATIONS`).
        depth2_relations: relations explorées à la profondeur 2 (défaut = `DEFAULT_DEPTH2_RELATIONS`).
        output: "json" → dict `{nodes, edges, ...}` ; "html" → écrit un fichier autonome.
        output_path: chemin d'écriture (si None et output="html", utilise `<slug>_subgraph.html` dans le CWD).

    Returns:
        Dict avec les clés :
        - `root`: terme racine
        - `nodes`: liste de nœuds vis-network (présent si output="json")
        - `edges`: liste d'arêtes vis-network (présent si output="json")
        - `stats`: {n_nodes, n_edges, n_negative, relations_used}
        - `html_path`: chemin du fichier écrit (si output="html")
    """
    c = client or JDMClient()
    rels = list(relations) if relations is not None else list(DEFAULT_RELATIONS)
    d2_rels = list(depth2_relations) if depth2_relations is not None else list(DEFAULT_DEPTH2_RELATIONS)
    depth = max(1, min(int(depth), 3))  # garde-fou : 1..3

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
            kind if depth_lv < 2 else "d2",
            depth=depth_lv,
        ))
        return nid

    # 2) Profondeur 1 : voisins directs de root, une relation à la fois.
    depth1_neighbors: list[tuple[str, str]] = []  # (node_label, kind)
    for rel in rels:
        kind = KIND_OF_REL.get(rel, "assoc")
        for row in _fetch_relation(c, term, rel, top_k_per_relation, min_weight):
            tgt = row["target_display"]
            if tgt == term:
                continue
            nid = _ensure_node(tgt, kind, depth_lv=1)
            edges.append(_build_edge(
                "ROOT", nid, rel, row["w"], row["polarity"], depth=1,
            ))
            depth1_neighbors.append((tgt, kind))

    # 3) Profondeur 2 (optionnelle).
    if depth >= 2:
        # Pour chaque voisin de niveau 1, explorer le sous-ensemble d2_rels.
        for n_label, _kind in depth1_neighbors:
            for rel in d2_rels:
                kind = KIND_OF_REL.get(rel, "assoc")
                rows = _fetch_relation(c, n_label, rel,
                                       max(1, top_k_per_relation // 2),
                                       min_weight)
                for row in rows:
                    tgt = row["target_display"]
                    if tgt == term:
                        # Lien vers la racine : on le matérialise, mais on ne
                        # ré-ajoute pas le noeud.
                        from_id = label_to_id[n_label]
                        edges.append(_build_edge(
                            from_id, "ROOT", rel, row["w"], row["polarity"], depth=2,
                        ))
                        continue
                    nid_to = _ensure_node(tgt, kind, depth_lv=2)
                    from_id = label_to_id[n_label]
                    if from_id == nid_to:
                        continue
                    edges.append(_build_edge(
                        from_id, nid_to, rel, row["w"], row["polarity"], depth=2,
                    ))

    n_negative = sum(1 for e in edges if e.get("_negative"))
    stats = {
        "n_nodes": len(nodes),
        "n_edges": len(edges),
        "n_negative": n_negative,
        "relations_used": rels,
        "depth": depth,
    }

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
            '<span style="background:#f5f5f5;border:1px dashed #9e9e9e;">profondeur 2</span>'
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
