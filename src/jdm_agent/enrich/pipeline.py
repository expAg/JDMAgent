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
    min_coverage: int = 3,
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
        min_coverage: une relation ayant STRICTEMENT MOINS de `min_coverage`
            triplets positifs est signalée (MISSING si 0, LOW_COVERAGE sinon).
            Au-delà, la relation est considérée couverte. Monter cette valeur
            pour enrichir aussi des relations déjà bien fournies.

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
                                check_asymmetries=check_asymmetries,
                                min_to_consider=min_coverage))

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


def write_submission(path: str | Path, candidates: Iterable[Candidate]) -> int:
    """Écrit le fichier de soumission JDM — UNIQUEMENT les triplets consolidés.

    Le fichier ne contient QUE les candidats confirmés par inférence
    (`consolidation_status == "consolidated"`) et structurellement valides.
    Les candidats non consolidés (silence de l'inférence) ou réfutés ne sont
    PAS écrits : un fichier de soumission doit être propre et directement
    soumettable.

    Format d'une ligne : ``terme|relation|cible|annotation < explication >``
    où l'explication est la chaîne d'inférence qui justifie le triplet.

    Returns:
        Le nombre de triplets consolidés écrits.
    """
    consolidated = [
        c for c in candidates if c.is_consolidated() and c.is_valid()
    ]
    lines: list[str] = [
        f"# Soumission JeuxDeMots — {len(consolidated)} triplet(s) consolidé(s) "
        "par inférence dans le réseau.",
        "# Format : terme|relation|cible|annotation < explication >",
        "",
    ]
    for c in consolidated:
        expl = " ".join(c.consolidation_explanation.split())
        lines.append(f"{c.term}|{c.relation}|{c.target}|{c.annotation} < {expl} >")

    Path(path).write_text("\n".join(lines) + "\n", encoding="utf-8")
    return len(consolidated)
