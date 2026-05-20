"""Force la sortie console en UTF-8 (Windows cp1252 plante sinon sur ✓ ─ ⏱ …).

À importer en TOUT premier dans chaque entrypoint d'app.
"""
from __future__ import annotations

import io
import sys


def setup_console() -> None:
    for stream_name in ("stdout", "stderr"):
        stream = getattr(sys, stream_name, None)
        if stream is None:
            continue
        # Python 3.7+: TextIOWrapper.reconfigure(encoding=...)
        reconf = getattr(stream, "reconfigure", None)
        if reconf is not None:
            try:
                reconf(encoding="utf-8", errors="replace")
                continue
            except Exception:
                pass
        # Fallback : enveloppe le buffer brut.
        buffer = getattr(stream, "buffer", None)
        if buffer is not None:
            try:
                setattr(sys, stream_name, io.TextIOWrapper(buffer, encoding="utf-8",
                                                            errors="replace", line_buffering=True))
            except Exception:
                pass


setup_console()
