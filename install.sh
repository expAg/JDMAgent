#!/usr/bin/env bash
# install.sh — premier deploiement de JDMAgent (branche deploy-self)
#
# Idempotent : peut etre relance sans probleme (skip ce qui existe deja).
# A executer depuis la racine du repo apres git clone + git checkout deploy-self.
#
# Pre-requis OS : python3 >= 3.10, python3-venv (sur Debian/Ubuntu :
# `sudo apt install python3-full python3-venv`).
#
# Apres install : edite le .env (clés API + EXPORT_SECRETS_PASSWORD)
# puis lance avec : .venv/bin/python app.py

set -euo pipefail

# Se positionne dans le repertoire du script (racine du repo)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Couleurs pour la lisibilite
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
RESET='\033[0m'

step()  { echo -e "${GREEN}→${RESET} $1"; }
warn()  { echo -e "${YELLOW}!${RESET} $1"; }
err()   { echo -e "${RED}✗${RESET} $1" >&2; }

echo "=== JDMAgent — Installation ==="
echo "Repo : $SCRIPT_DIR"
echo ""

# 1. Verifier python3
step "Verification de python3"
if ! command -v python3 >/dev/null 2>&1; then
    err "python3 introuvable. Installe-le d'abord (apt install python3-full)."
    exit 1
fi
PYVER=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
echo "   python3 = $PYVER"

# 2. Creer le venv si absent
if [ -d ".venv" ]; then
    warn "Le venv .venv/ existe deja — on le reutilise"
else
    step "Creation du venv .venv/"
    python3 -m venv .venv
fi

# 3. Upgrade pip + install des dependances
step "Mise a jour de pip"
.venv/bin/pip install --quiet --upgrade pip

step "Installation des dependances (requirements.txt)"
.venv/bin/pip install --quiet -r requirements.txt
echo "   OK ($(.venv/bin/pip list --format=freeze | wc -l) paquets installes)"

# 4. Initialiser le .env si absent
if [ -f ".env" ]; then
    warn "Le fichier .env existe deja — on ne le touche pas"
else
    step "Copie de .env.example vers .env"
    cp .env.example .env
    warn "Edite maintenant .env pour y mettre tes cles API :"
    echo "   nano .env   (ou ton editeur prefere)"
    echo ""
    echo "   Minimum recommande :"
    echo "     - EXPORT_SECRETS_PASSWORD (pour le panneau Config admin)"
    echo "     - Au moins une cle de provider LLM (ANTHROPIC_API_KEY,"
    echo "       OPENAI_API_KEY, GOOGLE_API_KEY, GROQ_API_KEY, etc.)"
    echo "     - JDM_DROPS_API_KEY si tu veux soumettre a JeuxDeMots"
    echo "     - APP_SUBPATH=/MonChemin si servie sous un sous-chemin reverse proxy"
fi

# 5. Verifier les droits d'ecriture sur .env (pour le panneau Config admin)
if [ -f ".env" ] && [ ! -w ".env" ]; then
    warn ".env n'est pas writable par l'utilisateur courant — le panneau"
    warn "Config admin ne pourra pas sauvegarder. Fix : chmod u+w .env"
fi

echo ""
echo -e "${GREEN}=== Installation terminee ===${RESET}"
echo ""
echo "Pour lancer l'app :"
echo "   .venv/bin/python app.py"
echo ""
echo "Pour mettre a jour plus tard :"
echo "   ./update.sh"
