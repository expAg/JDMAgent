# Service de résolution de coréférences (français) — CorPipe 25

Service **FastAPI** qui résout les coréférences d'un texte français, **illustre les renvois**
(qui désigne qui) en surlignant chaque chaîne d'une couleur avec une légende interactive,
puis affiche l'**analyse en dépendances universelles (UD)** de chaque phrase.

## Modèle : CorPipe 25 — l'état de l'art

Coréférence assurée par **CorPipe 25** (Milan Straka, ÚFAL Prague), **vainqueur du CRAC 2025
Shared Task on Multilingual Coreference Resolution** (CorefUD 1.3, 17 langues). Encodeur
**mT5-large**. Scores français : **76,3** CoNLL F1 (fr_ancor) / **71,8** (fr_democrat).

Contrairement aux approches par règles (Coreferee) ou aux modèles « personnages » (BookNLP-fr),
CorPipe résout **toutes les mentions** — y compris les **objets** :
*« Le chat a vu la souris et il l'a mangée »* → `Le chat`↔`il`, `la souris`↔`l'`.

> Licence des poids CorPipe 25 : **CC BY-NC-SA 4.0** (usage non commercial).

## Architecture du pipeline

```
texte ─UDPipe 2─▶ CoNLL-U ─CorPipe 25─▶ CoNLL-U annoté (Entity=)
                                       └─udapi─▶ chaînes + arbres UD (displaCy)
```

| Fichier | Rôle |
|---|---|
| `app/corpipe_engine.py` | Charge le modèle CorPipe **une seule fois** ; prédit à la demande |
| `app/coref.py` | UDPipe → CorPipe → parsing udapi (tokens, chaînes, SVG UD) |
| `app/main.py`  | Routes FastAPI (page web + API JSON) |
| `templates/index.html` | Formulaire + chaînes + section UD |
| `static/render.js` | Surlignage coloré des chaînes + légende interactive |
| `corpipe/corpipe25.py` | Script de recherche CorPipe 25 (repo ÚFAL, réutilisé tel quel) |

## Prérequis

- **Python 3.11** (stack NLP ; 3.13 incompatible).
- ~5 Go de modèles téléchargés au premier lancement (mT5-large + poids CorPipe), exécution **CPU**.
- Accès réseau à **UDPipe 2** (LINDAT) pour la tokenisation. ⚠️ Le texte analysé est envoyé à
  ce service académique (Charles University). Pour un usage hors-ligne, remplacer `_udpipe()`
  dans `app/coref.py` par une instance UDPipe locale ou une génération CoNLL-U via spaCy.

## Installation (Windows PowerShell)

```powershell
# 1. Environnement virtuel Python 3.11
& "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe" -m venv .venv

# 2. Dépendances
.\.venv\Scripts\python.exe -m pip install -r requirements.txt

# 3. Modèle spaCy (pour le rendu UD via displaCy uniquement)
.\.venv\Scripts\python.exe -m pip install --no-deps `
  "https://github.com/explosion/spacy-models/releases/download/fr_core_news_lg-3.2.0/fr_core_news_lg-3.2.0-py3-none-any.whl"

# 4. Script CorPipe 25 (si le dossier corpipe/ est absent)
New-Item -ItemType Directory -Force corpipe | Out-Null
Invoke-WebRequest "https://raw.githubusercontent.com/ufal/crac2025-corpipe/main/corpipe25.py" -OutFile corpipe\corpipe25.py
```

## Lancer

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

http://127.0.0.1:8000 — coller un texte, *Analyser*.
**Premier appel** : chargement de mT5-large (~1 min). Ensuite : **~2 s** par texte court (CPU).

## API JSON

```bash
curl -X POST http://127.0.0.1:8000/api/coref \
     -H "Content-Type: application/json" \
     -d '{"text": "Le chat a vu la souris et il l a mangée."}'
```

Réponse : `{ "tokens": [...], "chains": [{"id","label","cat","mentions"}], "ud_svg": "<svg>…" }`.

## Notes techniques

- Le modèle reste **résident en mémoire** (chargé une fois via `lru_cache`) au lieu de relancer
  le script à chaque requête.
- Sur Windows, le `DataLoader` PyTorch est utilisé en mono-processus.
- Piste d'évolution : réentraînement **neurosymbolique** (intégration d'un réseau lexico-sémantique
  type JeuxDeMots) pour améliorer la désambiguïsation sémantique.
