# JDM Agent — Documentation technique

Ce document couvre la **dimension développeur** du projet : roadmap, setup dev,
choix techniques, dépannage, performance, contributions. Pour l'utilisation
finale, voir [USAGE.md](USAGE.md). Pour la vision projet, voir
[README.md](README.md).

---

## Roadmap

### Livré

| Phase | Description | Commit |
|---|---|---|
| 0 | Bootstrap projet (pyproject, structure src/, tests, gitignore) | `e9a09b1` |
| 1 | Client JDMClient typé + cache disque diskcache + parser de relations | `e9a09b1` |
| 2 | Couche LangChain — 11 outils initiaux + agent `create_agent` (LangChain 1.x) | `d91c931` |
| 3 | App Q&A CLI + banc d'évaluation + tool args robustness | `cddc15f` |
| 3.5 | Décodage des refinements opaques (`avocat>116477>66699`) + 10 outils prédicatifs | `bed3ac7`, `63ab206` |
| 4 | Serveur MCP via FastMCP (réutilise les 24 outils, transport stdio) | `61830d7` |
| 5 | Fact-checker — extracteur LLM + verifier déterministe + r_isa-incompatible | `40f2f65` |
| 6 | Enrichissement actif — gap detection + LLM propose + validation + CSV | `b2c0c97` |
| 6.5 | Exposition `detect_gaps`/`validate_candidate` via MCP + USAGE.md | `017ab79` |

### À venir

#### Phase 8 — Déploiement public

Trois canaux livrés (artefacts en place dans le repo, déploiement à finaliser
côté plateformes) :

**Canal A — Web demo Gradio sur Hugging Face Spaces**
- Fichier : [`app.py`](app.py) — 3 onglets (Explorer / Fact-checker / Agent BYOK)
- Deps : [`requirements.txt`](requirements.txt) (gradio + langchain-anthropic + core)
- Métadonnées YAML pour HF : [`README_HF.md`](README_HF.md)
- Déploiement (à faire **une fois** depuis ton terminal) :
  ```bash
  # 1. Sur huggingface.co, crée un nouveau Space "jdmagent" (SDK Gradio)
  # 2. Côté local :
  cp README_HF.md README.md.bak    # backup du README de recherche
  cp README_HF.md README.md         # remplace temporairement par le README HF
  git remote add hf https://huggingface.co/spaces/<TON_USER>/jdmagent
  git push hf main
  cp README.md.bak README.md        # restaure
  ```
  Ou alternative propre : pousse seulement les fichiers HF (`app.py`,
  `requirements.txt`, `README_HF.md`→`README.md`, `src/`, `relation_definitions.md`)
  via un sous-arbre git ou un workflow GitHub Actions.

**Canal B — Serveur MCP hébergé (Render free tier)**
- Image Docker : [`Dockerfile`](Dockerfile) (CMD = `streamable-http` sur PORT=$PORT)
- Blueprint Render : [`render.yaml`](render.yaml)
- Ignore : [`.dockerignore`](.dockerignore) (omet tests/docs/Gradio)
- Déploiement :
  1. Sur [render.com](https://dashboard.render.com), `New → Blueprint`
  2. Connecte le repo GitHub
  3. Render détecte `render.yaml` et provisionne `jdmagent-mcp` automatiquement
  4. URL finale type `https://jdmagent-mcp.onrender.com`, endpoint MCP `/mcp`
- Test local :
  ```bash
  docker build -t jdmagent-mcp .
  docker run -p 8080:8080 jdmagent-mcp
  # autre terminal :
  claude mcp add jdm-local --transport http --url http://localhost:8080/mcp
  ```

**Canal C — Notebook Google Colab**
- Fichier : [`notebooks/demo.ipynb`](notebooks/demo.ipynb) (17 cellules, 4 sections)
- Badge déjà dans le README → renvoie sur Colab via l'URL
  `https://colab.research.google.com/github/expAg/JDMAgent/blob/main/notebooks/demo.ipynb`
- Le notebook installe le package via `pip install git+https://github.com/...`
  (le repo doit être public)

**Points d'attention** :
- MCP HTTP transport est récent — vérifier la compatibilité du client Claude
  Code (`claude --version` ≥ la version qui supporte `--transport http`)
- Render free tier : sleep après 15 min, cold start ~30-60 s
- HF Spaces CPU basic : sleep après ~48 h, cold start ~30 s
- BYOK Gradio : la clé reste en mémoire de session uniquement (pas de log)
- Licence à fixer avant publication (MIT recommandé)

#### Phase 7 — Spike graphe local (DuckDB / NetworkX)
Évaluer l'intérêt d'un dump partiel du sous-graphe JDM en local pour les
requêtes multi-saut (path-finding, transitivité r_isa, fermeture
de méronymie). Critères : taille du sous-graphe ciblé, latence,
fraîcheur. Si l'amélioration est ≥ 5× sans complexité prohibitive, intégrer
comme cache de niveau 2 (au-dessus de diskcache HTTP).

#### Améliorations qualité fact-check
- **Vérification transitive** : pour `A r_isa C`, suivre la chaîne
  `A r_isa B r_isa C` jusqu'à profondeur 3
- **Désambiguïsation automatique** : appliquer `disambiguate` au subject
  avant de chercher, et tester chaque sens (au lieu du sens dominant
  implicite)
- **Calibration des seuils** : fitter le seuil `support_min_w` par
  relation sur un corpus annoté

#### Améliorations enrichissement
- **Plus de paires inverses** : compléter `INVERSE_PAIRS` (actuellement 11)
  avec toutes les paires `r_xxx` / `r_xxx-1` du dump complet
- **Tolérance orthographique** dans la validation duplicate (accents,
  pluriels, casse étendue, variantes type "écran-tactile" vs "écran tactile")
- **Enrichissement transitif** : déduire `A r_isa C` candidat si
  `A r_isa B` et `B r_isa C` existent
- **Propositions sans LLM** : générer des candidats à partir des
  co-hyperonymes (frères sémantiques) — détecte les parts manquantes en
  comparant avec des termes de la même famille

#### Demo publique
- Déploiement du serveur MCP en ligne (Anthropic Custom Connectors une
  fois disponibles publiquement)
- Page de démo web (Streamlit ou Gradio) sur Hugging Face Spaces

#### Distribution
- Publication sur PyPI : `pip install jdm-agent`
- Image Docker pour le serveur MCP standalone
- Tutoriels Jupyter pour la communauté linguistique francophone

---

## Setup développement

```bash
git clone https://github.com/expAg/JDMAgent.git
cd JDMAgent

# Virtualenv
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # Linux/macOS

# Installation avec TOUS les extras pour dev
pip install -e ".[dev,langchain,anthropic,openai,ollama,mcp]"

# Tests
pytest

# Lint (optionnel)
ruff check src/ tests/
```

### Structure des fichiers source

```
src/jdm_agent/
├── __init__.py                  # exporte JDMClient
├── client/                       # Couche d'accès (Phase 1)
│   ├── __init__.py
│   ├── cache.py                  # DiskJSONCache (wrapper diskcache)
│   ├── client.py                 # JDMClient (HTTP, retry, cache, decode)
│   ├── models.py                 # Pydantic: Node, Relation, ...
│   └── relations.py              # Parser de relation_definitions.md
├── tools/                        # Couche LangChain (Phases 2 + 6.5)
│   ├── __init__.py
│   ├── jdm_tools.py              # 24 @tool décorés
│   ├── jdm_agent.py              # build_jdm_agent + system prompt + stream()
│   └── llm_factory.py            # get_llm() provider-agnostic
├── mcp/                          # Serveur MCP (Phase 4)
│   ├── __init__.py
│   └── server.py                 # build_server() FastMCP, réutilise ALL_TOOLS
├── factcheck/                    # Fact-checker (Phase 5)
│   ├── __init__.py
│   ├── models.py                 # Claim, Verdict, Report, Status
│   ├── extractor.py              # LLM extracts structured claims
│   ├── verifier.py               # Cascade déterministe vs JDM
│   └── pipeline.py               # factcheck(), factcheck_claims()
├── enrich/                       # Enrichissement (Phase 6)
│   ├── __init__.py
│   ├── models.py                 # Gap, Candidate, GapType
│   ├── detectors.py              # detect_gaps (MISSING/LOW_COV/ASYMMETRY)
│   ├── proposers.py              # propose_candidates via LLM
│   ├── validators.py             # validate_candidate (deterministic)
│   └── pipeline.py               # enrich(), write_candidates_csv()
└── apps/                         # CLIs (Phase 3, 4, 5, 6)
    ├── __init__.py
    ├── _console.py               # UTF-8 fix pour Windows console
    ├── qa_cli.py                 # jdm-qa
    ├── qa_eval.py                # jdm-eval
    ├── diagnose.py               # jdm-diag
    ├── factcheck.py              # jdm-factcheck
    └── enrich.py                 # jdm-enrich

tests/                            # 44 tests passants
├── test_client.py
├── test_relations_parser.py
├── test_tools.py
├── test_agent.py
├── test_mcp_server.py
├── test_factcheck.py
└── test_enrich.py
```

### Points d'extension typiques

| Tu veux ajouter… | Modifier |
|---|---|
| Un nouvel outil exposé au LLM | `tools/jdm_tools.py` (ajouter `@tool` + listing dans `ALL_TOOLS`) |
| Une nouvelle catégorie de gaps | `enrich/detectors.py` (ajouter un `_detect_*` + appel dans `detect_gaps`) |
| Une heuristique de vérification | `factcheck/verifier.py` (étendre la cascade) |
| Un transport MCP différent | `mcp/server.py` (déjà `--transport sse / streamable-http`) |
| Un nouveau provider LLM | `tools/llm_factory.py` (déjà géré par `init_chat_model`) |

---

## Choix techniques significatifs

### Pourquoi LangChain 1.x et `create_agent` ?

LangChain a refondu son API agents en 2025 : `AgentExecutor` + `create_tool_calling_agent` ont disparu au profit de `langchain.agents.create_agent`, qui retourne un graphe LangGraph compilé. Plus simple, mieux maintenu, support natif du streaming, intègre les middlewares.

### Pourquoi Pydantic v2 partout ?

- Validation stricte des réponses API (détecte les évolutions JDM)
- Schemas auto-générés pour LangChain tool calling
- `model_dump(mode='json')` direct pour la sortie MCP
- Compatible avec `with_structured_output` pour l'extracteur de claims

### Pourquoi diskcache et pas Redis / SQLite direct ?

- **Aucune dépendance externe** (pas de serveur à lancer)
- Persistance entre sessions, idéal pour le dev itératif
- API simple `cache.get/set` avec TTL natif
- Performances suffisantes pour notre volume (10k–100k entrées max)

### Pourquoi un serveur MCP qui réutilise les @tool LangChain via `.func` ?

Single source of truth. Chaque outil est défini une fois, décoré `@tool`,
puis :
- LangChain l'utilise tel quel (`StructuredTool`)
- FastMCP attrape `.func` (la fonction Python brute), infère le schéma
  des type hints + docstring

Aucune duplication, l'enrichissement de docstring se propage des deux côtés.

### Pourquoi un fact-checker déterministe et non LLM-as-judge ?

Voir la justification dans le [README](README.md#2-hybride-neural-symbolique-pour-le-fact-checking). Résumé : auditabilité, reproductibilité, indépendance vis-à-vis du modèle.

### Encodage cp1252 dans `relation_definitions.md`

Le fichier a été originellement créé en cp1252 (encodage Windows par défaut),
et nous le conservons tel quel pour ne pas perturber un historique éventuel
de modifications. Le parser (`client/relations.py`) lit explicitement
`encoding="cp1252"`. Tous les autres fichiers sources sont en UTF-8.

### `_console.py` pour Windows

`sys.stdout` par défaut sur Windows utilise cp1252, qui ne sait pas encoder
les caractères Unicode courants (`✓`, `─`, `⏱`, etc.). Le module
[`apps/_console.py`](src/jdm_agent/apps/_console.py) force UTF-8 via
`reconfigure(encoding="utf-8")` au démarrage de chaque entrypoint CLI.

---

## Tests

```bash
pytest                      # tous (44)
pytest tests/test_client.py # un fichier
pytest -k decode            # filtré par nom
pytest -q --tb=line         # plus concis
```

### Convention de mocking

Tous les tests qui interrogent JDM utilisent `respx` (mock côté httpx) pour ne **jamais** appeler le réseau réel. Quelques tests "smoke" font des appels live, ils sont identifiés et skip-ables (cf. `tests/test_relations_parser.py::test_real_relation_definitions_file_parses`).

Pour ajouter un test impliquant le client :

```python
import respx, httpx, pytest
from jdm_agent.client import JDMClient
from jdm_agent.client.cache import DiskJSONCache

BASE = "https://jdm-api.demo.lirmm.fr"

@pytest.fixture
def client(tmp_path):
    return JDMClient(base_url=BASE,
                     cache=DiskJSONCache(cache_dir=tmp_path / "cache"))

@respx.mock
def test_something(client):
    respx.get(f"{BASE}/v0/relations_types").mock(
        return_value=httpx.Response(200, json=[{"id": 5, "name": "r_syn"}])
    )
    # ... assertions
```

---

## Performance

### Cache hit rate

Mesuré sur la session de dev moyenne : > 95 % des appels JDM sont cached
après le premier tour. Temps observé :

- 1er appel `node_by_name("chat")` : ~50–100 ms
- 2e appel : ~0.2 ms (3500× speedup)
- Démarrage MCP server (load des types) : ~300 ms (177 relation_types + 27 node_types)

### Coût des outils par opération

| Opération | HTTP calls (1er appel) | Cached |
|---|---|---|
| `lookup_term` | 1 | 0 |
| `get_synonyms` (terme simple) | 1 | 0 |
| `disambiguate` (avec refinements à décoder) | 1 + N (N = nb d'IDs distincts) | 0 |
| `verify_claim` (r_isa supportée directe) | 1 | 0 |
| `verify_claim` (r_isa contradicted via incomp) | 1 + ~5 (scan hypernyms) | 0 |
| `detect_gaps` (sans asymétrie) | ~7 (1 par relation cible) | 0 |
| `detect_gaps` (avec asymétrie) | ~7 + ~5 × N_targets | 0 |

Pour les batches > 100 termes, prévoir 1–2 s par terme au premier passage,
< 50 ms ensuite (tout cache hit).

### Performance LLM (CPU, Ollama 3B)

- `llama3.2:3b` chargement initial : ~30 s (modèle en RAM)
- Inférence "1 mot" : ~90 s
- 1 tour agent complet (1 outil + réponse) : ~180–270 s

Sur ces ordres de grandeur, le `--verbose` du `qa_cli` est indispensable
pour ne pas avoir l'impression que ça hang.

→ Pour un usage interactif fluide : **utiliser Claude Code via MCP** (LLM
distant rapide, couvert par abo Max).

---

## Dépannage

### Le CLI semble figé pendant 60–120 s

**Cause** : inférence Ollama sur CPU. Le premier appel charge le modèle en
mémoire (~10–30 s), chaque tour LLM ensuite ≈ 60–90 s.

**Solutions** :
- `--verbose` pour voir l'agent travailler en direct (streaming)
- Lancer `jdm-diag` pour confirmer où c'est lent (couches 4 et 5)
- Passer à un modèle plus rapide (cf. tableau plus bas) ou GPU

### `UnicodeEncodeError: 'charmap'`

**Cause** : console Windows en cp1252 (héritage NT). Déjà corrigé par
[`apps/_console.py`](src/jdm_agent/apps/_console.py).

**Solution si tu vois encore l'erreur** :
```powershell
chcp 65001
$env:PYTHONIOENCODING = "utf-8"
```

### `could not connect to a running Ollama instance`

**Cause** : daemon Ollama pas démarré.

**Solution** :
```powershell
# Démarre le serveur dans une fenêtre dédiée
ollama serve
# Vérifie
curl http://localhost:11434/api/version
```

### Le LLM hallucine les triplets sources

**Cause** : modèle trop petit (e.g. llama3.2:3b a ce défaut). Il appelle
les outils correctement mais invente le format de citation.

**Solutions** :
- Passer à un modèle plus capable :
  - `ollama pull qwen2.5:7b` (excellent tool use, ~4 GB)
  - `ollama pull llama3.1:8b` (4.7 GB)
- Ou utiliser l'API Anthropic / OpenAI : modèles cloud, tool calling
  natif robuste, ~2–5 s par tour
- Vérifier que le prompt système précise bien "cite **les triplets
  exacts renvoyés par le tool**" (déjà le cas dans
  [`tools/jdm_agent.py`](src/jdm_agent/tools/jdm_agent.py))

### `claude: command not found`

Le CLI Claude Code n'est pas dans le PATH. Voir le tableau des emplacements
typiques dans [README.md](README.md#installation), ou recharge un nouveau
PowerShell (les modifs de PATH ne s'appliquent qu'aux nouvelles sessions).

### MCP `Failed to connect` / `MCP server didn't respond to initialize`

Possibles causes :
- Python introuvable depuis Claude Code (PATH différent du shell)
  → mettre le chemin absolu de `python.exe` dans la config MCP
- Module `jdm_agent` pas installé dans le Python utilisé
  → vérifier avec `python -c "import jdm_agent; print(jdm_agent.__file__)"`
- Logs : `%APPDATA%\Claude\logs\mcp-jdm-*.log`

### `min_weight: Input should be a valid number` (vieux bug)

Corrigé en Phase 3 (`cddc15f`). Tous les params numériques sont désormais
`Optional[...] = None` avec helpers `_mw()/_lim()` pour résoudre les défauts
côté serveur. Si tu vois encore ce message, fais un `git pull && pip install -e .`.

### Outputs avec `?` à la place des accents

Console non-UTF-8.
```powershell
chcp 65001
$env:PYTHONIOENCODING = "utf-8"
```
Puis relance ta commande Python.

### Le serveur MCP démarre puis se ferme aussitôt

Souvent : quelque chose imprime sur stdout pendant l'init, ce qui casse le
protocole MCP (stdio). Notre code utilise `logging` qui va sur stderr — OK.
Si tu as ajouté du `print()` quelque part dans `mcp/server.py` ou ailleurs
dans la chaîne d'import, vire-le.

Lance le serveur à la main pour confirmer qu'il démarre :
```powershell
python -m jdm_agent.mcp.server
# Doit rester silencieux en attente stdio.
# Ctrl+C pour quitter.
```

### Cache disque obsolète après une modif de JDM

Le cache de relations a un TTL de 1 h (`JDM_CACHE_TTL_DATA`), celui des
meta de 7 jours (`JDM_CACHE_TTL_META`). Pour forcer un refresh complet :

```python
from jdm_agent.client import JDMClient
JDMClient()._cache.clear()
```

Ou supprime `.cache/jdm/`.

---

## Recommandations de modèles selon usage

| Usage | Modèle recommandé | Pourquoi |
|---|---|---|
| Q&A interactif (Claude Code MCP) | **Claude Sonnet 4.5** (via abo Max) | Tool use natif, rapide, couvert |
| Batch fact-check avec LLM extract | **Claude Haiku 4.5** (API) | Bonne extraction structurée, peu cher |
| Enrichissement batch | **Claude Sonnet 4.5** ou **GPT-4o** | Qualité des propositions importe |
| Dev local sans clé API | **qwen2.5:7b** ou **llama3.1:8b** (Ollama) | Tool calling correct |
| Démo offline ultra-rapide | **llama3.2:3b** (Ollama) | Petit mais correct (avec patience) |

---

## Contribuer

### Workflow

1. Fork le repo
2. Crée une branche `feat/ma-feature` ou `fix/mon-bug`
3. Implémente + ajoute des tests (toujours `respx` pour les mocks JDM)
4. `pytest` doit rester 100 % vert
5. Commit avec un message descriptif au format conventionnel :
   - `feat(phase-X): description`
   - `fix: description`
   - `chore: description`
   - `docs: description`
6. PR vers `main`

### Style

- Python 3.10+ (utilise `|` pour les unions de types, `list[X]` au lieu de
  `List[X]`)
- Imports triés (isort-compatible)
- Docstrings en français pour les outils (lues par le LLM !)
- Pas de `print()` dans le code de la chaîne MCP (utiliser `logging`)

### Tests

Tout nouvel outil LangChain doit avoir au moins un test :
- Schéma valide (`args_schema.model_json_schema()`)
- Invocation correcte avec mock (`respx`)
- Format de sortie conforme

Voir `tests/test_tools.py` pour les patterns.

---

## Historique des principaux commits

```
017ab79 feat: expose enrich primitives via MCP + USAGE.md
b2c0c97 feat(phase-6 + mcp): JDM enrichment pipeline + expose verify_claim via MCP
40f2f65 feat(phase-5): JDM fact-checker — deterministic claim verification
63ab206 feat: systematic refinement decoding across all tools (Choix C design)
bed3ac7 feat: decode refinement IDs + 10 predicative tools
3d620a2 feat: live streaming in qa_cli + layered diagnostic + Windows UTF-8 fix
1a3ceed chore: ignore .claude/ session artifacts
cddc15f feat(phase-3): Q&A CLI app + eval bench + tool args robustness
d91c931 feat(phase-2): LangChain tools + agent (provider-agnostic)
e9a09b1 chore: bootstrap JDM Agent project (Phase 0 + Phase 1)
611dc3a Initial commit
```

Voir `git log --oneline` pour la liste complète.
