#!/usr/bin/env bash
# update.sh — pull les derniers commits + reinstall les deps qui ont change.
#
# A executer depuis la racine du repo. Suppose qu'install.sh a deja
# tourne (venv .venv/ present).
#
# App FastAPI / uvicorn : aucun build front necessaire (bundle commite).
# Apres update : si un service systemd `jdmagent` est detecte, on
# restart automatiquement. Sinon, on affiche comment relancer / creer le
# service (Python ne hot-reload pas en prod).

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

APP_PORT="${APP_PORT:-7860}"

echo "=== JDMAgent (FastAPI) — Update ==="
echo "Repo : $SCRIPT_DIR"
echo ""

# 1. Verifier le venv
if [ ! -d ".venv" ]; then
    err "Pas de venv .venv/ trouve. Lance d'abord ./install.sh"
    exit 1
fi

# 2. Branche courante
BRANCH=$(git rev-parse --abbrev-ref HEAD)
step "Branche courante : $BRANCH"

# 3. Garde-fou : refuser si modifs non commitees (sauf .env qui est gitignore)
if ! git diff --quiet || ! git diff --cached --quiet; then
    err "Modifs locales non commitees detectees. Stash ou commit d'abord :"
    git status --short
    exit 1
fi

# 4. Fetch + comparer
step "git fetch origin"
git fetch --quiet origin

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$BRANCH" 2>/dev/null || echo "")

if [ -z "$REMOTE" ]; then
    err "La branche $BRANCH n'existe pas sur origin"
    exit 1
fi

NO_UPDATE=0
if [ "$LOCAL" = "$REMOTE" ]; then
    echo "   Deja a jour ($LOCAL)"
    NO_UPDATE=1
else
    step "Pull des nouveaux commits"
    git pull --ff-only origin "$BRANCH"
fi

# 5. Reinstall des deps si requirements.txt a change
DEPS_CHANGED=0
if [ "$NO_UPDATE" = "0" ]; then
    if git diff --name-only "$LOCAL" "$REMOTE" | grep -q "^requirements.txt$"; then
        step "requirements.txt a change → re-install"
        .venv/bin/pip install --quiet --upgrade pip
        .venv/bin/pip install --quiet -r requirements.txt
        echo "   OK"
        DEPS_CHANGED=1
    else
        echo "   requirements.txt inchange, skip pip install"
    fi
fi

# 6. Tentative de restart automatique
RESTART_DONE=0
RESTART_METHOD=""

SVC_PATH=""
for p in /etc/systemd/system/jdmagent.service /lib/systemd/system/jdmagent.service /usr/lib/systemd/system/jdmagent.service; do
    if [ -f "$p" ]; then
        SVC_PATH="$p"
        break
    fi
done

if [ -n "$SVC_PATH" ] && command -v systemctl >/dev/null 2>&1; then
    if [ "$NO_UPDATE" = "0" ]; then
        step "Service systemd detecte : $SVC_PATH"
        if systemctl restart jdmagent 2>/dev/null; then
            RESTART_DONE=1
            RESTART_METHOD="systemctl restart jdmagent (sans sudo)"
        elif sudo -n systemctl restart jdmagent 2>/dev/null; then
            RESTART_DONE=1
            RESTART_METHOD="sudo systemctl restart jdmagent (sudo sans mdp)"
        else
            warn "Impossible de restart sans sudo interactif."
            warn "Lance manuellement : sudo systemctl restart jdmagent"
        fi
    fi
fi

# Cas 2 : process uvicorn detecte (foreground/background)
if [ "$RESTART_DONE" = "0" ] && [ "$NO_UPDATE" = "0" ]; then
    APP_PID=$(pgrep -f "uvicorn.*app_fastapi:app" 2>/dev/null | head -1 || true)
    if [ -n "$APP_PID" ]; then
        warn "Process 'uvicorn app_fastapi:app' en cours (PID $APP_PID)."
        warn "Restart automatique pas tente — ca dependrait de comment tu"
        warn "as lance l'app (foreground terminal, nohup, tmux, screen…)."
    fi
fi

# ===== Message final tres visible =====
echo ""
echo -e "${CYAN}${BOLD}===============================================================${RESET}"
if [ "$NO_UPDATE" = "1" ]; then
    echo -e "${CYAN}${BOLD}              DEJA A JOUR — RIEN A FAIRE                       ${RESET}"
elif [ "$RESTART_DONE" = "1" ]; then
    echo -e "${CYAN}${BOLD}              UPDATE TERMINE + APP REDEMARREE                  ${RESET}"
else
    echo -e "${CYAN}${BOLD}              UPDATE TERMINE — A FAIRE :                       ${RESET}"
fi
echo -e "${CYAN}${BOLD}===============================================================${RESET}"
echo ""

if [ "$NO_UPDATE" = "1" ]; then
    echo "  Pas de nouveau commit a recuperer."
elif [ "$RESTART_DONE" = "1" ]; then
    echo -e "  ${GREEN}${BOLD}✓ App redemarree via :${RESET} $RESTART_METHOD"
    if [ "$DEPS_CHANGED" = "1" ]; then
        echo "  + dependances mises a jour."
    fi
else
    echo -e "  ${YELLOW}${BOLD}!${RESET} ${BOLD}REDEMARRE L'APP MANUELLEMENT${RESET} :"
    echo ""
    echo "     1. Ctrl+C dans le terminal qui fait tourner l'app"
    echo -e "     2. ${BOLD}.venv/bin/uvicorn app_fastapi:app --host 0.0.0.0 --port $APP_PORT${RESET}"
    if [ "$DEPS_CHANGED" = "1" ]; then
        echo ""
        echo -e "  ${YELLOW}!${RESET} Note : les dependances ont aussi change → relance"
        echo "        obligatoire pour qu'elles soient chargees."
    fi
    echo ""
    echo "  Pour automatiser ce restart, relance ./install.sh (il cree le"
    echo "  service systemd 'jdmagent'). Apres ca, ./update.sh restart seul."
fi
echo ""
echo -e "${CYAN}${BOLD}===============================================================${RESET}"
echo ""
