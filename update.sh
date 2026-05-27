#!/usr/bin/env bash
# update.sh — pull les derniers commits + reinstall les deps qui ont change.
#
# A executer depuis la racine du repo. Suppose qu'install.sh a deja
# tourne (venv .venv/ present).
#
# Apres update : tu dois redemarrer manuellement l'app (Ctrl+C + relance).
# Python ne hot-reload pas le code.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
RESET='\033[0m'

step()  { echo -e "${GREEN}→${RESET} $1"; }
warn()  { echo -e "${YELLOW}!${RESET} $1"; }
err()   { echo -e "${RED}✗${RESET} $1" >&2; }

echo "=== JDMAgent — Update ==="
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

if [ "$LOCAL" = "$REMOTE" ]; then
    echo "   Deja a jour ($LOCAL)"
    NO_UPDATE=1
else
    NO_UPDATE=0
    step "Pull des nouveaux commits"
    git pull --ff-only origin "$BRANCH"
fi

# 5. Reinstall des deps si requirements.txt a change OU si premiere update
if [ "$NO_UPDATE" = "0" ]; then
    if git diff --name-only "$LOCAL" "$REMOTE" | grep -q "^requirements.txt$"; then
        step "requirements.txt a change → re-install"
        .venv/bin/pip install --quiet --upgrade pip
        .venv/bin/pip install --quiet -r requirements.txt
        echo "   OK"
    else
        echo "   requirements.txt inchange, skip pip install"
    fi
fi

echo ""
echo -e "${GREEN}=== Update termine ===${RESET}"

if [ "$NO_UPDATE" = "0" ]; then
    echo ""
    warn "L'app Python ne hot-reload pas. Redemarre manuellement :"
    echo "   1. Ctrl+C dans le terminal qui fait tourner l'app"
    echo "   2. .venv/bin/python app.py"
fi
