#!/usr/bin/env bash
# install.sh — premier deploiement de JDMAgent (app FastAPI / uvicorn).
#
# Idempotent : peut etre relance sans probleme (skip ce qui existe deja).
# A executer depuis la racine du repo APRES git clone + git checkout <branche>.
#
# Pre-requis OS : python3 >= 3.10, python3-venv (sur Debian/Ubuntu :
# `sudo apt install python3-full python3-venv`).
#
# Le frontend est servi tel quel (static/webapp/bundle.jsx est commite) :
# AUCUN build n'est necessaire au deploiement.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

step()  { echo -e "${GREEN}→${RESET} $1"; }
warn()  { echo -e "${YELLOW}!${RESET} $1"; }
err()   { echo -e "${RED}✗${RESET} $1" >&2; }

# Commande de lancement de l'app — point unique a modifier si besoin.
APP_PORT="${APP_PORT:-7860}"
EXEC_START="$SCRIPT_DIR/.venv/bin/uvicorn app_fastapi:app --host 0.0.0.0 --port $APP_PORT"

echo "=== JDMAgent (FastAPI) — Installation ==="
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

# 2. Creer / reparer le venv.
#    Un .venv/ peut exister mais etre casse (interpreteur ou pip absent :
#    `python3 -m venv` echoue parfois a amorcer pip, frequent sur Debian
#    quand python3-venv n'est pas complet). On detecte et on repare.
create_venv() { step "Creation du venv .venv/"; python3 -m venv .venv; }

if [ ! -x ".venv/bin/python" ]; then
    [ -d ".venv" ] && { warn ".venv/ present mais sans interpreteur — recreation"; rm -rf .venv; }
    create_venv
else
    warn "Le venv .venv/ existe deja — on le reutilise"
fi

# pip absent du venv ? on tente ensurepip, sinon on recree.
if ! .venv/bin/python -m pip --version >/dev/null 2>&1; then
    warn "pip absent du venv — tentative de reparation (ensurepip)"
    if ! .venv/bin/python -m ensurepip --upgrade >/dev/null 2>&1; then
        warn "ensurepip indisponible — recreation complete du venv"
        rm -rf .venv
        create_venv
    fi
fi
if ! .venv/bin/python -m pip --version >/dev/null 2>&1; then
    err "Impossible d'obtenir pip dans le venv. Installe le paquet venv de l'OS :"
    err "   sudo apt install -y python3-venv python3-pip"
    err "puis relance ./install.sh"
    exit 1
fi

# 3. Upgrade pip + install des dependances (via 'python -m pip', robuste)
step "Mise a jour de pip"
.venv/bin/python -m pip install --quiet --upgrade pip

step "Installation des dependances (requirements.txt)"
.venv/bin/python -m pip install --quiet -r requirements.txt
echo "   OK ($(.venv/bin/python -m pip list --format=freeze | wc -l) paquets installes)"

# 4. Initialiser le .env si absent
ENV_NEW=0
if [ -f ".env" ]; then
    warn "Le fichier .env existe deja — on ne le touche pas"
else
    step "Copie de .env.example vers .env"
    cp .env.example .env
    ENV_NEW=1
fi

# 5. Verifier les droits d'ecriture sur .env (pour le panneau Config admin)
if [ -f ".env" ] && [ ! -w ".env" ]; then
    warn ".env n'est pas writable par l'utilisateur courant — le panneau"
    warn "Config admin ne pourra pas sauvegarder. Fix : chmod u+w .env"
fi

# 6. Service systemd : creation automatique si systemctl dispo.
# Permet a ./update.sh de restart l'app sans intervention.
SVC_CREATED=0
SVC_PATH="/etc/systemd/system/jdmagent.service"
if command -v systemctl >/dev/null 2>&1; then
    if [ -f "$SVC_PATH" ]; then
        warn "Le service $SVC_PATH existe deja — on ne le touche pas"
    else
        step "Creation du service systemd $SVC_PATH"
        # Pas d'EnvironmentFile : l'app charge .env via python-dotenv au
        # demarrage (WorkingDirectory suffit). systemd ne parse pas les
        # commentaires inline qu'on peut avoir dans .env.
        if sudo tee "$SVC_PATH" > /dev/null <<EOF
[Unit]
Description=JDMAgent (FastAPI / uvicorn)
After=network.target

[Service]
User=root
WorkingDirectory=$SCRIPT_DIR
ExecStart=$EXEC_START
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
        then
            sudo systemctl daemon-reload
            sudo systemctl enable jdmagent >/dev/null 2>&1 || true
            echo "   Service cree + enable (sera lance automatiquement au boot)"
            SVC_CREATED=1
        else
            warn "Echec creation du service (sudo refuse ?). Tu pourras"
            warn "le creer plus tard, ou relancer ./install.sh."
        fi
    fi
fi

# ===== Message final tres visible =====
echo ""
echo -e "${CYAN}${BOLD}===============================================================${RESET}"
echo -e "${CYAN}${BOLD}              INSTALLATION TERMINEE — A FAIRE :                ${RESET}"
echo -e "${CYAN}${BOLD}===============================================================${RESET}"
echo ""
if [ "$ENV_NEW" = "1" ]; then
    echo -e "  ${YELLOW}${BOLD}1.${RESET} ${BOLD}EDITE${RESET} le fichier ${BOLD}.env${RESET} pour y mettre tes cles API :"
    echo -e "         ${BOLD}nano .env${RESET}"
    echo ""
    echo "     Minimum recommande :"
    echo "       - EXPORT_SECRETS_PASSWORD  (panneau Config admin)"
    echo "       - Au moins 1 cle LLM (ANTHROPIC_API_KEY, GOOGLE_API_KEY, etc.)"
    echo "       - JDM_DROPS_API_KEY  (pour soumettre a JeuxDeMots)"
    echo "       - APP_SUBPATH=/MonChemin  (si reverse proxy sous-chemin)"
    echo ""
    NEXT_STEP=2
else
    NEXT_STEP=1
fi

if [ "$SVC_CREATED" = "1" ]; then
    echo -e "  ${YELLOW}${BOLD}${NEXT_STEP}.${RESET} ${BOLD}LANCE${RESET} le service systemd :"
    echo -e "         ${BOLD}sudo systemctl start jdmagent${RESET}"
    echo ""
    echo "     Et pour le surveiller :"
    echo -e "         ${BOLD}sudo systemctl status jdmagent${RESET}"
    echo -e "         ${BOLD}sudo journalctl -u jdmagent -f${RESET}"
else
    echo -e "  ${YELLOW}${BOLD}${NEXT_STEP}.${RESET} ${BOLD}LANCE${RESET} l'app :"
    echo -e "         ${BOLD}.venv/bin/uvicorn app_fastapi:app --host 0.0.0.0 --port $APP_PORT${RESET}"
fi
echo ""
echo "     L'app ecoute sur http://0.0.0.0:$APP_PORT (FastAPI / uvicorn)."
echo "     Acces admin : http://ton-domaine.fr/?admin=1"
echo ""
echo -e "  Pour mettre a jour plus tard : ${BOLD}./update.sh${RESET}"
echo ""
echo -e "${CYAN}${BOLD}===============================================================${RESET}"
echo ""
