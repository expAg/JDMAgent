"""Fact-checker JeuxDeMots.

Vérifie des affirmations factuelles en français contre le graphe JDM.

Usage haut niveau :
    from jdm_agent.factcheck import factcheck

    report = factcheck("La baleine est un poisson. Le chat mange des souris.")
    for v in report.verdicts:
        print(v.claim.text, "→", v.status)
"""
from jdm_agent.factcheck.models import Claim, Verdict, Report, Status, Evidence
from jdm_agent.factcheck.verifier import verify_claim
from jdm_agent.factcheck.extractor import extract_claims
from jdm_agent.factcheck.pipeline import factcheck, factcheck_claims

__all__ = [
    "Claim", "Verdict", "Report", "Status", "Evidence",
    "verify_claim", "extract_claims", "factcheck", "factcheck_claims",
]
