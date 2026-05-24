"""Compteur d'appels d'outils par invocation d'agent (Phase 13).

Permet de borner la durée d'un flow agent (notamment Jarvis ›
Enrichissement) à N appels d'outils. Au-delà du seuil, les tools
renvoient un sentinel `BUDGET_EXHAUSTED` qui invite le LLM à
consolider et arrêter — cf. règle 15 du SYSTEM_PROMPT.

Mécanisme : `ContextVar` thread-local → chaque invocation agent crée
son propre budget via `with budget_context(N): agent.invoke(...)`.
Sans contexte actif, le budget est illimité (comportement historique,
zéro régression sur les flows existants).

Les **workflow tools** (`enrichment_workflow`, `audit_workflow`, …)
sont exclus du compteur : ils renvoient un dict statique sans coût
réseau ni LLM, et leur appel est obligatoire en début de flow.
"""
from __future__ import annotations

import functools
import inspect
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from typing import Iterator, Optional


# Sentinel renvoyé par les tools quand le budget est dépassé. Le LLM
# est instruit (cf. règle 15) de stopper et de consolider sans tenter
# d'autre appel. Ne pas modifier la clé `BUDGET_EXHAUSTED` — utilisée
# par le prompt.
def _exhausted_payload(limit: int) -> dict:
    return {
        "BUDGET_EXHAUSTED": True,
        "limit": limit,
        "message": (
            f"Budget d'appels d'outils atteint ({limit}). ARRÊTE "
            "immédiatement de proposer ou d'explorer. Compose ta "
            "réponse finale avec ce qui a été consolidé jusque-là, "
            "mentionne à l'utilisateur que le budget a été atteint, "
            "et propose-lui de relancer avec un budget plus large si "
            "nécessaire. Ne tente PAS d'autre appel d'outil."
        ),
    }


@dataclass
class ToolBudget:
    """Compteur d'appels d'outils pour une invocation agent.

    Attributs :
        limit    : nombre max d'appels comptés (None = illimité).
        count    : compteur courant (incrémenté à chaque appel compté).
        exhausted: True dès que `count > limit`.
    """
    limit: Optional[int] = None
    count: int = 0
    exhausted: bool = False

    def check_and_increment(self) -> bool:
        """Tente de consommer une unité de budget.

        Renvoie True si l'appel est dans le budget (le tool s'exécute),
        False si le budget est dépassé (le wrapper renvoie alors le
        sentinel `_exhausted_payload`).

        Le compteur est incrémenté dans TOUS les cas — un appel hors
        budget compte aussi (transparence du suivi).
        """
        self.count += 1
        if self.limit is None:
            return True
        if self.count > self.limit:
            self.exhausted = True
            return False
        return True


# Variable contextuelle : un budget par invocation agent (thread-safe
# et compatible asyncio). default=None → pas de contexte → budget
# illimité (les flows non-Jarvis ne sont pas affectés).
_current_budget: ContextVar[Optional[ToolBudget]] = ContextVar(
    "jdm_tool_budget", default=None
)


def get_current_budget() -> Optional[ToolBudget]:
    """Renvoie le budget actif, ou None s'il n'y a pas de contexte.

    Utilisé par le wrapper dans `build_jdm_tools()` pour décider si
    un appel doit être compté ou laissé passer librement.
    """
    return _current_budget.get()


@contextmanager
def budget_context(limit: Optional[int]) -> Iterator[ToolBudget]:
    """Active un budget pour la durée du bloc `with`.

    Usage type (côté Gradio / Jarvis) :
        with budget_context(limit=25) as budget:
            for chunk in agent.stream({"messages": [HumanMessage(...)]}):
                ...
            print(f"{budget.count} appels d'outils effectués")
            if budget.exhausted:
                print("Le budget a été dépassé.")

    `limit=None` ou `limit<=0` désactive la limite (budget illimité).
    """
    if limit is not None and limit <= 0:
        limit = None
    budget = ToolBudget(limit=limit)
    token = _current_budget.set(budget)
    try:
        yield budget
    finally:
        _current_budget.reset(token)


# Noms (préfixes/suffixes) de tools EXCLUS du compteur — ils sont
# zéro-coût (renvoient un dict statique) ou indispensables au flow.
_NON_BUDGETED_SUFFIXES = ("_workflow",)
_NON_BUDGETED_NAMES = frozenset({
    # Les workflow tools (préfixes suffisamment couverts par le suffix)
    # mais on peut ajouter ici tout outil qu'on souhaite exempter
    # explicitement à l'avenir.
})


def is_budgeted(tool_name: str) -> bool:
    """Renvoie True si l'appel à ce tool doit consommer du budget."""
    if tool_name in _NON_BUDGETED_NAMES:
        return False
    if any(tool_name.endswith(s) for s in _NON_BUDGETED_SUFFIXES):
        return False
    return True


def apply_budget_wrapping(tools: list) -> list:
    """Wrap une liste de tools LangChain pour respecter le budget.

    Pour chaque tool qui doit être compté (`is_budgeted(name)`), on
    remplace sa fonction `func` par un wrapper qui :
      1. consulte le budget courant (`get_current_budget()`)
      2. si None → exécute librement (comportement historique)
      3. si présent et `check_and_increment()` renvoie False →
         renvoie le sentinel `_exhausted_payload(limit)` SANS exécuter
      4. sinon → exécute la fonction originale

    Les tools exemptés (workflow tools) restent inchangés.

    Mutation in-place de la liste, retour de la même liste pour
    chaînage. Idempotent : un tool déjà wrappé n'est pas re-wrappé
    (sentinel `__budgeted__ = True` posé sur le wrapper).
    """
    for t in tools:
        if not is_budgeted(t.name):
            continue
        if getattr(t.func, "__budgeted__", False):
            continue
        original = t.func

        def _make_wrapper(orig, name):
            @functools.wraps(orig)
            def wrapper(*args, **kwargs):
                budget = get_current_budget()
                if budget is None:
                    # Pas de contexte budget → exécution libre
                    return orig(*args, **kwargs)
                if not budget.check_and_increment():
                    return _exhausted_payload(budget.limit)
                return orig(*args, **kwargs)
            # functools.wraps copie __module__/__name__/__qualname__/
            # __doc__/__annotations__/__wrapped__ — c'est indispensable
            # pour que FastMCP + pydantic puissent dériver le schéma
            # JSON des arguments (sinon : KeyError au schema-gen).
            # On force aussi __signature__ pour les introspecteurs qui
            # ne suivent pas __wrapped__.
            try:
                wrapper.__signature__ = inspect.signature(orig)
            except (TypeError, ValueError):
                pass
            wrapper.__budgeted__ = True
            return wrapper

        t.func = _make_wrapper(original, t.name)
    return tools
