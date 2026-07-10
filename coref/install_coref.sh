#!/usr/bin/env bash
# install_coref.sh — deploiement du service coref (coreference + analyse
# syntaxique) comme service SEPARE, ecoutant en local sur 8901. L'app JDMAgent
# le proxifie (TOOLS_COREF_URL / TOOLS_SYNTAX_URL). A executer depuis coref/.
#
# ATTENTION : deps lourdes (torch, transformers). Le modele CorPipe (mT5-large)
# est telecharge de HuggingFace au 1er appel de coreference (~qq Go de disque +
# internet). L'analyse syntaxique, elle, est legere (UDPipe distant + displaCy).
#
# Pre-requis OS : python3 >= 3.10, python3-venv, git (pour la dep udapi).
# Idempotent : relancable sans risque.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

GREEN='\033[0;32m'; YELLOW='\033[0;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
step() { echo -e "${GREEN}->${RESET} $1"; }
warn() { echo -e "${YELLOW}!${RESET} $1"; }
err()  { echo -e "${RED}x${RESET} $1" >&2; }

COREF_PORT="${COREF_PORT:-8901}"
EXEC_START="$SCRIPT_DIR/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port $COREF_PORT"

echo "=== Service coref — Installation ==="
echo "Repo : $SCRIPT_DIR   Port : $COREF_PORT"
echo ""

# 1. git (dep udapi installee depuis GitHub)
command -v git >/dev/null 2>&1 || { err "git introuvable — requis pour la dep udapi (apt install git)."; exit 1; }

# 2. Choix de l'interpreteur : Python >= 3.10 (deps modernisees : spacy 3.8 a des
#    wheels jusqu'a 3.13). On prend le python3 systeme s'il convient.
py_ver()  { "$1" -c 'import sys;print("%d.%d"%sys.version_info[:2])' 2>/dev/null; }
py_ge310(){ "$1" -c 'import sys;raise SystemExit(0 if sys.version_info[:2]>=(3,10) else 1)' 2>/dev/null; }

PYBIN=""
for c in python3 python3.13 python3.12 python3.11 python3.10; do
    command -v "$c" >/dev/null 2>&1 && py_ge310 "$c" && { PYBIN="$c"; break; }
done
if [ -z "$PYBIN" ]; then
    err "Aucun Python >= 3.10 trouve. Installe-en un (apt install python3-full python3-venv)."
    exit 1
fi
step "Interpreteur : $PYBIN ($(py_ver "$PYBIN"))"

# 3. venv (creation / reparation). Recree si l'existant est sur un Python
#    incompatible (ex. une tentative precedente en 3.13).
create_venv() { step "Creation du venv .venv/ avec $PYBIN"; "$PYBIN" -m venv .venv; }
if [ -x ".venv/bin/python" ] && py_ge310 ".venv/bin/python"; then
    warn "venv .venv/ deja present (Python $(py_ver .venv/bin/python)) — reutilise"
else
    [ -d ".venv" ] && { warn ".venv/ absent/casse/incompatible — recreation"; rm -rf .venv; }
    create_venv
fi
if ! .venv/bin/python -m pip --version >/dev/null 2>&1; then
    warn "pip absent du venv — ensurepip"
    .venv/bin/python -m ensurepip --upgrade >/dev/null 2>&1 || { rm -rf .venv; create_venv; }
fi
.venv/bin/python -m pip --version >/dev/null 2>&1 || {
    err "pip indisponible. Installe : sudo apt install -y python3-venv python3-pip"; exit 1; }

# 3. deps (lourdes)
step "Mise a jour de pip"
.venv/bin/python -m pip install --quiet --upgrade pip
step "Installation des dependances (requirements.txt) — peut etre long (torch...)"
.venv/bin/python -m pip install -r requirements.txt
echo "   OK ($(.venv/bin/python -m pip list --format=freeze | wc -l) paquets)"

# 4. service systemd coref.service (ecoute LOCAL 127.0.0.1 : proxifie par l'app)
SVC_PATH="/etc/systemd/system/coref.service"
if command -v systemctl >/dev/null 2>&1; then
    if [ -f "$SVC_PATH" ]; then
        warn "$SVC_PATH existe deja — on ne le touche pas"
    else
        step "Creation du service systemd $SVC_PATH"
        if sudo tee "$SVC_PATH" > /dev/null <<EOF
[Unit]
Description=Service coref (coreference CorPipe25 + analyse syntaxique UD)
After=network.target

[Service]
User=root
WorkingDirectory=$SCRIPT_DIR
ExecStart=$EXEC_START
Restart=on-failure
RestartSec=5
# Cache HuggingFace (poids du modele) : persiste entre redemarrages.
Environment=HF_HOME=$SCRIPT_DIR/.hf-cache

[Install]
WantedBy=multi-user.target
EOF
        then
            sudo systemctl daemon-reload
            sudo systemctl enable coref >/dev/null 2>&1 || true
            echo "   Service cree + enable"
        else
            warn "Echec creation du service (sudo refuse ?)."
        fi
    fi
fi

echo ""
echo -e "${CYAN}${BOLD}=====================================================${RESET}"
echo -e "${CYAN}${BOLD}         COREF INSTALLE — A FAIRE :                  ${RESET}"
echo -e "${CYAN}${BOLD}=====================================================${RESET}"
echo ""
echo -e "  ${YELLOW}${BOLD}1.${RESET} Lance le service :   ${BOLD}sudo systemctl start coref${RESET}"
echo -e "  ${YELLOW}${BOLD}2.${RESET} Verifie (leger)  :   ${BOLD}curl -s -X POST http://127.0.0.1:$COREF_PORT/api/syntax \\
        -H 'Content-Type: application/json' -d '{\"text\":\"Le chat dort.\"}'${RESET}"
echo ""
echo "  L'app JDMAgent proxifie deja ce service via TOOLS_COREF_URL /"
echo "  TOOLS_SYNTAX_URL (defaut http://127.0.0.1:$COREF_PORT/...). Si l'app"
echo "  tourne sur la meme machine, rien a changer dans son .env."
echo ""
echo "  Logs : sudo journalctl -u coref -f"
echo "  Note : la 1re requete de COREFERENCE telecharge mT5-large (long)."
echo ""
