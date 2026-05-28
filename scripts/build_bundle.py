#!/usr/bin/env python3
"""Concatène les sources React/JSX en un seul `static/webapp/bundle.jsx`.

Le frontend est servi tel-quel par FastAPI (pas de Webpack/Vite ; Babel
standalone compile dans le navigateur). Chaque source en `static/webapp/*.jsx`
est concaténée dans l'ordre déterminé par `FILES`, séparée par un commentaire
`// === webapp/<filename> ===` (préservé pour pouvoir relire le bundle).

Usage :
    python scripts/build_bundle.py

Re-lance ce script à chaque modification d'un des fichiers source listés
ci-dessous. Les onglets supplémentaires doivent être ajoutés dans `FILES`
au bon endroit (ordre = ordre de chargement = ordre d'apparition des
variables globales `window.ViewX`).
"""
from __future__ import annotations

from pathlib import Path

# Ordre de concaténation. shared en premier (helpers utilisés par les
# vues), app.jsx en dernier (ReactDOM.createRoot consomme tout le reste).
FILES = [
    "shared.jsx",
    "views-projet.jsx",
    "views-explorer.jsx",
    "views-claim.jsx",
    "views-subgraph.jsx",
    "views-agent.jsx",
    "views-jarvis.jsx",
    "views-productions.jsx",
    "views-aide.jsx",
    "app.jsx",
]

ROOT = Path(__file__).resolve().parent.parent
WEBAPP = ROOT / "static" / "webapp"
OUT = WEBAPP / "bundle.jsx"


def build() -> int:
    """Concatène les fichiers et écrit le bundle. Renvoie le nombre d'octets écrits."""
    parts: list[str] = []
    for name in FILES:
        src = WEBAPP / name
        if not src.exists():
            raise SystemExit(f"❌ fichier source manquant : {src}")
        parts.append(f"// === webapp/{name} ===")
        parts.append(src.read_text(encoding="utf-8").rstrip("\n"))
        parts.append("")  # ligne vide entre sections
    content = "\n".join(parts) + "\n"
    OUT.write_text(content, encoding="utf-8")
    return len(content.encode("utf-8"))


if __name__ == "__main__":
    n = build()
    print(f"[OK] bundle.jsx regenerated ({n:,} bytes from {len(FILES)} sources)")
