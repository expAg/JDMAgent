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

import os
import shutil
import subprocess
from pathlib import Path

# Ordre de concaténation. shared en premier (helpers utilisés par les
# vues), app.jsx en dernier (ReactDOM.createRoot consomme tout le reste).
FILES = [
    "shared.jsx",
    "hero-animation.jsx",   # ajouté du handoff designer (mode LIVE / Projet hero)
    "views-projet.jsx",
    "views-explorer.jsx",
    "views-claim.jsx",
    "views-subgraph.jsx",
    "views-agent.jsx",
    "views-chat.jsx",
    "views-jarvis.jsx",
    "views-productions.jsx",
    "views-outils.jsx",
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


# Modules chargés par index.html (mêmes noms que _JS_MODULES côté serveur).
_PRECOMPILE = ["tweaks-panel.jsx", "jarvis-banner.jsx", "bundle.jsx"]


def precompile() -> bool:
    """Transpile les .jsx en .js (JSX → React.createElement) via esbuild, si présent.

    Sans --bundle : chaque fichier reste un script GLOBAL (pas de module) → mêmes
    sémantiques qu'aujourd'hui (React en global UMD, partage via window). Résultat :
    plus de Babel dans le navigateur → chargement quasi instantané. Le serveur bascule
    automatiquement sur les .js s'ils existent (cf. _use_precompiled_js dans
    app_fastapi.py) ; sinon il garde le chemin Babel.

    esbuild est un binaire AUTONOME (Go) — pas besoin de node. On le cherche via la
    variable d'env ESBUILD (chemin direct), puis le PATH. Binaire téléchargeable :
    npm i -g esbuild, OU le tarball @esbuild/<plateforme> sur registry.npmjs.org."""
    exe = os.environ.get("ESBUILD") or shutil.which("esbuild")
    if not exe or not Path(exe).exists() and not shutil.which(exe):
        print("[i] esbuild introuvable (ni $ESBUILD ni PATH) → .js NON régénérés. "
              "Les .js committés restent servis ; installe esbuild pour les rebâtir.")
        return False
    for name in _PRECOMPILE:
        src, out = WEBAPP / name, WEBAPP / (name[:-1])   # .jsx → .js
        cmd = [exe, str(src), "--loader:.jsx=jsx",
               "--jsx-factory=React.createElement", "--jsx-fragment=React.Fragment",
               "--charset=utf8", "--target=es2019", f"--outfile={out}"]
        subprocess.run(cmd, check=True)
        print(f"[OK] {out.name} ({out.stat().st_size:,} octets)")
    return True


if __name__ == "__main__":
    n = build()
    print(f"[OK] bundle.jsx regenerated ({n:,} bytes from {len(FILES)} sources)")
    precompile()
