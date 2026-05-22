"""Pipeline complet de l'enrichissement : term(s) → gaps → candidats → validation → rapport."""
from __future__ import annotations

import csv
from pathlib import Path
from typing import Any, Iterable, List, Optional

from jdm_agent.client import JDMClient
from jdm_agent.enrich.detectors import detect_gaps
from jdm_agent.enrich.models import Candidate, Gap
from jdm_agent.enrich.proposers import propose_candidates
from jdm_agent.enrich.validators import consolidate_candidate, validate_candidate


def enrich(
    terms: Iterable[str],
    *,
    client: Optional[JDMClient] = None,
    llm: Optional[Any] = None,
    target_relations: Optional[Iterable[str]] = None,
    check_asymmetries: bool = True,
    propose: bool = True,
    validate: bool = True,
    consolidate: bool = False,
    inference_effort: int = 1,
    max_per_gap: int = 10,
) -> tuple[list[Gap], list[Candidate]]:
    """Détecte les gaps des termes et (optionnellement) propose des candidats.

    Args:
        terms: itérable de termes JDM (mots simples ou refinements).
        client: JDMClient (créé par défaut).
        llm: ChatModel pour la proposition. Inutile si propose=False.
        target_relations: relations à inspecter (défaut: jeu standard noun + verb).
        check_asymmetries: lance la détection des relations inverses manquantes.
        propose: appelle le LLM pour proposer des candidats par gap.
        validate: validation structurelle de chaque candidat (cible existe ? duplicate ?).
        consolidate: consolidation par INFÉRENCE des candidats validés (coût HTTP).
        inference_effort: effort du moteur d'inférence pour la consolidation (1 ou 2).
        max_per_gap: nombre max de candidats demandés au LLM par gap.

    Returns:
        (gaps, candidates) — chaque candidate est annotée (validation +
        éventuellement consolidation).
    """
    if client is None:
        client = JDMClient()

    gaps: list[Gap] = []
    for term in terms:
        gaps.extend(detect_gaps(client, term,
                                target_relations=target_relations,
                                check_asymmetries=check_asymmetries))

    candidates: list[Candidate] = []
    if propose:
        if llm is None:
            raise ValueError("propose=True nécessite un `llm` (ChatModel LangChain).")
        for g in gaps:
            for c in propose_candidates(g, llm, max_candidates=max_per_gap):
                if validate:
                    c = validate_candidate(client, c)
                # Consolidation par inférence : uniquement les candidats
                # structurellement valides (inutile d'inférer un doublon ou
                # un terme inconnu).
                if consolidate and c.is_valid():
                    c = consolidate_candidate(client, c, effort=inference_effort)
                candidates.append(c)

    return gaps, candidates


def write_candidates_csv(path: str | Path, candidates: Iterable[Candidate]) -> None:
    """Émet le CSV de travail (tous les candidats, avec validation + consolidation)."""
    path = Path(path)
    fields = ["term", "relation", "target", "confidence",
              "validation_status", "consolidation_status", "consolidation_schema",
              "rationale", "validation_note", "consolidation_explanation", "source"]
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for c in candidates:
            w.writerow({
                "term": c.term, "relation": c.relation, "target": c.target,
                "confidence": f"{c.confidence:.2f}",
                "validation_status": c.validation_status or "",
                "consolidation_status": c.consolidation_status or "",
                "consolidation_schema": c.consolidation_schema or "",
                "rationale": c.rationale,
                "validation_note": c.validation_note,
                "consolidation_explanation": c.consolidation_explanation,
                "source": c.source,
            })


def write_submission(path: str | Path, candidates: Iterable[Candidate], *,
                     only_consolidated: bool = False) -> int:
    """Écrit le fichier de soumission JDM au format `A|R|B|annotation`.

    Un seul fichier, deux sections :
      * CONSOLIDÉS : candidats confirmés par inférence — chaque ligne porte
        une explication ``term|relation|target|annotation < explication >``.
      * À REVOIR : candidats proposés, structurellement valides, non réfutés
        mais non consolidés (« pas forcément faux ») — ``term|relation|target|annotation``.

    Args:
        path: chemin du fichier de soumission.
        candidates: candidats (idéalement passés par validate + consolidate).
        only_consolidated: si True, n'écrit que la section CONSOLIDÉS.

    Returns:
        Le nombre de candidats consolidés écrits.
    """
    cands = list(candidates)
    # Section soumission : on n'écrit QUE des candidats structurellement
    # valides (ni doublon, ni terme inconnu, ni nié directement).
    consolidated = [c for c in cands if c.is_consolidated() and c.is_valid()]
    a_revoir = [
        c for c in cands
        if c.is_valid() and not c.is_consolidated()
        and c.consolidation_status != "rejected"
    ]

    lines: list[str] = [
        "# Soumission JeuxDeMots — triplets candidats au format A|R|B|annotation",
        "# Généré par jdm_agent.enrich. L'API JDM étant en lecture seule, ce",
        "# fichier est un point d'entrée pour une contribution manuelle/modérée.",
        "",
        f"## CONSOLIDÉS ({len(consolidated)}) — confirmés par inférence dans le réseau",
    ]
    for c in consolidated:
        expl = " ".join(c.consolidation_explanation.split())
        lines.append(f"{c.term}|{c.relation}|{c.target}|{c.annotation} < {expl} >")

    if not only_consolidated:
        lines += [
            "",
            f"## À REVOIR ({len(a_revoir)}) — proposés, non réfutés, non consolidés "
            "(pas forcément faux)",
        ]
        for c in a_revoir:
            lines.append(f"{c.term}|{c.relation}|{c.target}|{c.annotation}")

    Path(path).write_text("\n".join(lines) + "\n", encoding="utf-8")
    return len(consolidated)
