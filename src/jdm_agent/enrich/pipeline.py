"""Pipeline complet de l'enrichissement : term(s) → gaps → candidats → validation → rapport."""
from __future__ import annotations

import csv
from pathlib import Path
from typing import Any, Iterable, List, Optional

from jdm_agent.client import JDMClient
from jdm_agent.enrich.detectors import detect_gaps
from jdm_agent.enrich.models import Candidate, Gap
from jdm_agent.enrich.proposers import propose_candidates
from jdm_agent.enrich.validators import validate_candidate


def enrich(
    terms: Iterable[str],
    *,
    client: Optional[JDMClient] = None,
    llm: Optional[Any] = None,
    target_relations: Optional[Iterable[str]] = None,
    check_asymmetries: bool = True,
    propose: bool = True,
    validate: bool = True,
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
        validate: chaque candidat est vérifié contre JDM (cible existe ? duplicate ?).
        max_per_gap: nombre max de candidats demandés au LLM par gap.

    Returns:
        (gaps, candidates) — chaque candidate.validation_status est annoté si validate=True.
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
                candidates.append(c)

    return gaps, candidates


def write_candidates_csv(path: str | Path, candidates: Iterable[Candidate]) -> None:
    """Émet le CSV final à soumettre à la modération JDM."""
    path = Path(path)
    fields = ["term", "relation", "target", "confidence", "validation_status",
              "rationale", "validation_note", "source"]
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for c in candidates:
            w.writerow({
                "term": c.term, "relation": c.relation, "target": c.target,
                "confidence": f"{c.confidence:.2f}",
                "validation_status": c.validation_status or "",
                "rationale": c.rationale,
                "validation_note": c.validation_note,
                "source": c.source,
            })
