"""Cache disque (diskcache) pour les appels JDM.

Deux TTL par défaut :
- meta (types) : long, configurable via JDM_CACHE_TTL_META
- data (nodes/relations) : court, configurable via JDM_CACHE_TTL_DATA

Le cache est désactivable globalement en passant `ttl=None` ou en
construisant un `DiskJSONCache(enabled=False)`.
"""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Any, Optional

import diskcache


class DiskJSONCache:
    """Wrapper léger autour de diskcache avec sérialisation JSON.

    On stocke uniquement des structures JSON-compatibles (dict/list/str/int/float)
    pour rester portable et inspectable.
    """

    def __init__(
        self,
        cache_dir: str | os.PathLike[str] | None = None,
        enabled: bool = True,
    ) -> None:
        cache_dir = cache_dir or os.environ.get("JDM_CACHE_DIR", ".cache/jdm")
        Path(cache_dir).mkdir(parents=True, exist_ok=True)
        self._cache = diskcache.Cache(str(cache_dir))
        self.enabled = enabled
        # Smoke write/read pour confirmer que le dossier est utilisable.
        try:
            self._cache.set("__init_probe__", 1, expire=10)
            ok = self._cache.get("__init_probe__") == 1
            print(f"[cache] dir={cache_dir} writable={ok}", flush=True)
        except Exception as e:
            print(f"[cache] dir={cache_dir} init probe failed: {e!r}", flush=True)

    @staticmethod
    def make_key(namespace: str, *parts: Any, **kwargs: Any) -> str:
        payload = {"ns": namespace, "args": parts, "kw": kwargs}
        blob = json.dumps(payload, sort_keys=True, default=str, ensure_ascii=False)
        return f"{namespace}:{hashlib.sha1(blob.encode('utf-8')).hexdigest()}"

    def get(self, key: str) -> Optional[Any]:
        if not self.enabled:
            return None
        try:
            return self._cache.get(key, default=None)
        except Exception as e:
            # Log au premier échec (mais pas à chaque appel) pour pouvoir
            # diagnostiquer un dossier de cache non writable.
            if not getattr(self, "_get_warned", False):
                print(f"[cache] get failed ({e!r}) — caching disabled for this process",
                      flush=True)
                self._get_warned = True
            return None

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        if not self.enabled:
            return
        try:
            self._cache.set(key, value, expire=ttl)
        except Exception as e:
            if not getattr(self, "_set_warned", False):
                print(f"[cache] set failed ({e!r}) — caching disabled for this process",
                      flush=True)
                self._set_warned = True

    def clear(self) -> None:
        self._cache.clear()

    def close(self) -> None:
        self._cache.close()
