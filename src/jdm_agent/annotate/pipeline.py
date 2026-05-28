"""Pipeline complet du flow Annotation.

Entrée : un terme (+ relation optionnelle), ou aucun (tirage random côté
LLM en amont). Sortie : fichier `.annot` avec deux sections :

    SECTION PRINCIPALE
      sujet|relation|objet|annotation < justification >
      ...

    =====SIGNALEMENT=====
      # triplets où le LLM diverge de JDM
      sujet|relation|objet|JDM:<annot_jdm>|LLM:<annot_llm> < argument contre >
      ...

Le LLM utilise son jugement linguistique — pas de consolidation par
inférence (volontaire : on qualifie un lien existant, pas un nouveau).
"""
from __future__ import annotations

from pathlib import Path
from typing import Any, Iterable, List, Optional

from jdm_agent.annotate.models import AnnotationProposal, parse_category
from jdm_agent.annotate.proposer import propose_annotations
from jdm_agent.client import JDMClient


# Relations principales explorées par défaut quand aucune relation n'est
# fournie — cohérent avec les autres flows (audit, signalement…).
DEFAULT_ANNOTATION_RELATIONS = (
    "r_isa", "r_has_part", "r_carac", "r_telic_role",
    "r_lieu", "r_anto", "r_syn",
)


def _fetch_triplets_for_term(
    client: JDMClient,
    term: str,
    relations: Iterable[str],
    *,
    top_k: int = 8,
    include_rel_ids: bool = True,
) -> List[dict]:
    """Récupère des triplets (sujet, relation, objet) sortants d'un terme,
    pour chaque relation. Le top-K est appliqué par relation (poids
    décroissant).

    Renvoie une liste de dicts :
        { subject: str, relation: str, target: str,
          weight: float, rel_id: int }

    Les nœuds cibles sont déjà décodés via `client.decode_node_name`
    (raffinement `>91594` → `(instrument de musique)`).
    """
    out: List[dict] = []
    # Décode le sujet si raffiné (pour qu'il s'affiche correctement dans le .annot)
    try:
        subj_display = client.decode_node_name(term).get("decoded") or term
    except Exception:
        subj_display = term

    for rel in relations:
        rel_id = client.relation_type_id(rel)
        if rel_id is None:
            continue
        try:
            res = client.relations_from(
                term, types_ids=[rel_id], limit=int(top_k),
            )
        except Exception:
            continue

        idx = res.node_index()
        # Trie par |w| décroissant et garde top_k
        rels_sorted = sorted(res.relations, key=lambda r: -abs(r.w))[:top_k]
        for r in rels_sorted:
            target_node = idx.get(r.node2)
            if target_node is None:
                continue
            try:
                tgt_display = (
                    client.decode_node_name(target_node.name).get("decoded")
                    or target_node.name
                )
            except Exception:
                tgt_display = target_node.name
            entry = {
                "subject": subj_display,
                "relation": rel,
                "target": tgt_display,
                "weight": float(r.w),
            }
            if include_rel_ids:
                # `id` JDM unique de la relation — nécessaire pour
                # `get_annotations_for_triplet`.
                entry["rel_id"] = int(getattr(r, "id", 0)) or 0
            out.append(entry)
    return out


def _fetch_existing_annotation(
    client: JDMClient, rel_id: int,
) -> Optional[str]:
    """Renvoie l'annotation JDM existante (texte brut) pour le triplet
    d'`rel_id`, ou None s'il n'y en a pas.

    On filtre sur les annotations dont la valeur tombe dans notre
    taxonomie 4-catégories (les autres = contexte, sont ignorées —
    elles ne sont pas comparables à notre choix).
    """
    if not rel_id:
        return None
    try:
        annots = client.get_annotations_for_triplet(rel_id)
    except Exception:
        return None
    for a in annots:
        cat = parse_category(a.value)
        if cat is not None:
            return cat.value  # canonisé (ex. "non spécifique")
    return None


def annotate(
    *,
    client: Optional[JDMClient] = None,
    llm: Any = None,
    term: Optional[str] = None,
    relations: Optional[Iterable[str]] = None,
    top_k_per_relation: int = 8,
    triplets: Optional[List[dict]] = None,
) -> List[AnnotationProposal]:
    """Orchestration du flow d'annotation.

    Args:
        client: JDMClient (créé par défaut).
        llm: LangChain BaseChatModel. Obligatoire (l'annotation est une
            tâche LLM par essence).
        term: terme racine à annoter. Si None, alors `triplets` doit être
            fourni (tirage côté appelant — typiquement l'agent qui pioche
            aléatoirement dans ses outils).
        relations: relations à inspecter quand `term` est donné. Défaut :
            jeu standard noun + verb (`DEFAULT_ANNOTATION_RELATIONS`).
        top_k_per_relation: nombre de triplets par relation à annoter.
        triplets: liste pré-fetchée de dicts `{subject, relation, target}`
            (alternative à `term`). Utile pour l'agent ou les tests.

    Returns:
        Liste de `AnnotationProposal` (toutes — annotables ou non,
        désaccords inclus). L'écriture du fichier sépare les sections.
    """
    if llm is None:
        raise ValueError("annotate() nécessite un `llm` (ChatModel LangChain).")
    if client is None:
        client = JDMClient()

    # 1. Construit la liste de triplets à annoter
    if triplets is None:
        if not term:
            raise ValueError("annotate() nécessite soit `term`, soit `triplets`.")
        rels = list(relations or DEFAULT_ANNOTATION_RELATIONS)
        triplets = _fetch_triplets_for_term(
            client, term, rels, top_k=top_k_per_relation,
        )
    if not triplets:
        return []

    # 2. Pré-fetch les annotations JDM existantes (par index de triplet)
    existing_by_idx: dict[int, str] = {}
    for i, t in enumerate(triplets):
        rid = int(t.get("rel_id", 0) or 0)
        if rid:
            ex = _fetch_existing_annotation(client, rid)
            if ex:
                existing_by_idx[i] = ex

    # 3. Demande au LLM d'annoter (jugement linguistique pur)
    proposals = propose_annotations(
        triplets, llm, existing_jdm_by_index=existing_by_idx,
    )
    return proposals


def write_annotation_file(
    path: str | Path,
    proposals: Iterable[AnnotationProposal],
) -> dict:
    """Écrit le fichier .annot avec deux sections.

    Section principale : triplets ANNOTÉS par le LLM (catégorie non vide).
    Section SIGNALEMENT : triplets dont l'annotation LLM DIFFÈRE de
    l'annotation JDM existante (le LLM remet en question l'existant).

    Format ligne section principale :
        sujet|relation|objet|annotation < justification >

    Format ligne section signalement :
        sujet|relation|objet|JDM:<existant>|LLM:<proposé> < argument contre >

    Returns:
        Dict `{n_annotated, n_signalement, n_skipped, path}` — stats utiles
        pour l'appelant (CLI / UI).
    """
    proposals = list(proposals)
    annotated = [p for p in proposals if p.is_annotable() and not p.disagrees_with_jdm()]
    signalements = [p for p in proposals if p.is_annotable() and p.disagrees_with_jdm()]
    skipped = [p for p in proposals if not p.is_annotable()]

    def _esc(s: str) -> str:
        # Évite que les pipes dans un label ne cassent le parsing JDM côté
        # serveur. On les remplace par /.
        return (s or "").replace("|", "/").strip()

    lines: list[str] = [
        f"# Annotation JeuxDeMots — {len(annotated)} triplet(s) annoté(s)"
        f" + {len(signalements)} signalement(s)"
        f" ({len(skipped)} triplet(s) non annotable(s) — ignoré(s)).",
        "# Section principale — format : "
        "sujet|relation|objet|annotation < justification >",
        "# Section SIGNALEMENT — format : "
        "sujet|relation|objet|JDM:<existant>|LLM:<proposé> < argument contre >",
        "",
    ]
    for p in annotated:
        cat = p.category.value if p.category else ""
        just = " ".join((p.justification or "").split())
        lines.append(
            f"{_esc(p.subject)}|{p.relation}|{_esc(p.target)}|{cat} < {just} >"
        )

    if signalements:
        lines.append("")
        lines.append("=====SIGNALEMENT=====")
        lines.append(
            "# Triplets dont l'annotation LLM diffère de celle déjà"
            " présente dans JDM."
        )
        for p in signalements:
            cat = p.category.value if p.category else ""
            arg = " ".join((p.justification or "").split())
            jdm = (p.existing_jdm or "").strip()
            lines.append(
                f"{_esc(p.subject)}|{p.relation}|{_esc(p.target)}"
                f"|JDM:{jdm}|LLM:{cat} < {arg} >"
            )

    Path(path).write_text("\n".join(lines) + "\n", encoding="utf-8")
    return {
        "n_annotated": len(annotated),
        "n_signalement": len(signalements),
        "n_skipped": len(skipped),
        "path": str(path),
    }
