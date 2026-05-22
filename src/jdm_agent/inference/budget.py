"""Budget d'appels HTTP pour borner le coût d'une inférence.

Chaque appel `relations_from` au graphe JDM consomme une unité. Quand le
plafond est atteint, `BudgetExhausted` est levée — le moteur l'attrape et
renvoie un résultat silencieux plutôt que de laisser filer une exception.
"""
from __future__ import annotations


class BudgetExhausted(RuntimeError):
    """Levée quand le budget d'appels JDM d'une inférence est épuisé."""


class LookupBudget:
    """Compte les appels JDM consommés et coupe net au plafond."""

    def __init__(self, limit: int) -> None:
        self.limit: int = max(1, int(limit))
        self.used: int = 0

    @property
    def remaining(self) -> int:
        return max(0, self.limit - self.used)

    def can_afford(self, n: int = 1) -> bool:
        return self.used + n <= self.limit

    def spend(self, n: int = 1) -> None:
        """Consomme `n` unités ; lève BudgetExhausted si on dépasse."""
        self.used += n
        if self.used > self.limit:
            raise BudgetExhausted(f"budget épuisé ({self.used}/{self.limit})")
