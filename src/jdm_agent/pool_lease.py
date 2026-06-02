"""Pool de clés Gemini avec check-out / check-in par run.

Contrairement au mécanisme sticky historique (`_CURRENT_GEMINI_KEY` global
dans `app.py` — une seule clé active partagée par tous les runs), ce
module permet d'ATTRIBUER une clé distincte à chaque run actif quand
plusieurs runs tournent en parallèle. Idée : maximiser le throughput
en évitant que deux runs se battent sur le même quota PerMinute.

Sémantique :
    acquire_key(model, run_id, app)
        → renvoie la clé du pool optimale pour ce run :
          1. clé non occupée (load = 0), non blown pour ce modèle,
             non invalide → pick la 1ʳᵉ
          2. sinon, clé valide avec le min de runs occupants
          3. sinon (toutes blown/invalides) → None
        Mark la clé acquise : run_id ajouté à _LEASES[key].

    release_key(run_id)
        → retire run_id de TOUS les sets _LEASES (idempotent).
          Appelé dans le finally du run.

Implémentation :
    dict module-level `_LEASES: dict[str, set[str]]` (key → set(run_ids))
    + threading.Lock. Cross-thread safe.

Activation :
    Le wiring n'est armé QUE si le caller (jarvis.py) passe
    `pool_active=True` au run_jarvis_agent. Sinon, on retombe sur le
    pick sticky historique — comportement strictement inchangé hors
    pool mode.
"""
from __future__ import annotations

import threading
from typing import Optional, Set, Dict


# Registry partagé entre threads. Lock pour atomicité acquire/release.
_LEASES: Dict[str, Set[str]] = {}
_LOCK = threading.Lock()


def _load(key: str) -> int:
    """Nombre de runs occupants actuellement cette clé."""
    s = _LEASES.get(key)
    return len(s) if s is not None else 0


def acquire_key(model: str, run_id: str, app) -> Optional[str]:
    """Acquiert une clé du pool pour `run_id`.

    Args:
        model:  modèle Gemini ciblé (pour skip les blown today).
        run_id: identifiant unique du run (UUID de bg-runs idéalement).
                Servira de clé d'identification pour release_key.
        app:    référence au module `app.py` (qui détient
                `_parse_google_keys`, `_INVALID_KEYS`, `_BLOWN_TODAY`,
                `_today_utc_str`). Passé en injection pour éviter
                l'import circulaire (`app.py` importe ce module
                dans l'autre sens si besoin).

    Returns:
        La clé acquise (string), ou None si aucune n'est utilisable.
    """
    keys = app._parse_google_keys()
    if not keys:
        return None
    today = app._today_utc_str()
    invalid = app._INVALID_KEYS
    blown = app._BLOWN_TODAY

    def _usable(k: str) -> bool:
        if k in invalid:
            return False
        if blown.get((k, model, today), False):
            return False
        return True

    usable = [k for k in keys if _usable(k)]
    if not usable:
        return None

    with _LOCK:
        # 1. Cherche une clé libre (0 occupant)
        free = [k for k in usable if _load(k) == 0]
        chosen: Optional[str] = None
        if free:
            chosen = free[0]
        else:
            # 2. Sinon : load-min parmi les usable (1ʳᵉ ex aequo dans
            #    l'ordre du pool, donc déterministe et stable)
            chosen = min(usable, key=_load)
        _LEASES.setdefault(chosen, set()).add(run_id)
        return chosen


def release_key(run_id: str) -> None:
    """Retire `run_id` de tous les sets de leases. Idempotent : si
    le run n'avait pas acquis de clé (ex. pool désactivé), no-op."""
    if not run_id:
        return
    with _LOCK:
        for key, occupants in list(_LEASES.items()):
            if run_id in occupants:
                occupants.discard(run_id)
                # Optionnel : nettoyer les entrées vides pour garder
                # le dict petit. Pas critique (les clés du pool sont
                # rares, ~4-8 typiquement).
                if not occupants:
                    _LEASES.pop(key, None)


def snapshot_leases() -> Dict[str, int]:
    """Diagnostic : renvoie {key: nb_runs_occupants} (clés masquées
    pour log éventuel). Utilisé par /api/pool/status si besoin."""
    with _LOCK:
        return {k: len(v) for k, v in _LEASES.items()}
