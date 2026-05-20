# JDM Agent — Guide d'usage

Ce projet expose JeuxDeMots de **trois manières complémentaires**, à choisir
selon ton mode de travail.

## TL;DR — Quel canal pour quelle tâche ?

| Tâche | Canal recommandé | Pourquoi |
|---|---|---|
| Exploration interactive du graphe | **Claude Code + MCP** | Conversation naturelle, Claude oriente les outils |
| Vérifier une affirmation factuelle | Claude Code (`verify_claim`) ou `jdm-factcheck` | MCP pour ad-hoc, CLI pour batch |
| Auditer un texte (anti-hallucination) | **`jdm-factcheck --text`** | Pipeline LLM extraction + verifier déterministe |
| Trouver les gaps d'un terme | Claude Code (`detect_gaps`) ou `jdm-enrich --no-propose` | Identique côté fonction |
| Enrichir tout un domaine | **`jdm-enrich -o csv`** | Batch + CSV final pour modération JDM |
| Intégrer dans un autre programme | **Python API** (`from jdm_agent.client import JDMClient`) | API typée |
| CI/CD : refuser un build si claim contredit | **`jdm-factcheck --stdin`** (exit code 3) | Scriptable |

---

# 1. Mode interactif : Claude Code + MCP

C'est le canal **par défaut** pour explorer et raisonner sur JDM. Une fois le
serveur MCP enregistré (`claude mcp add jdm --scope user -- python -m jdm_agent.mcp.server`),
tu disposes de **24 outils** invocables par conversation.

### Les outils en 3 familles

#### A. Lookup / exploration (10 outils — Q&A classique)

| Outil | Quand l'utiliser | Exemple |
|---|---|---|
| `lookup_term(term)` | Vérifier qu'un mot existe + voir son ID/poids | « JDM connaît-il "métavers" ? » |
| `get_synonyms(term)` | Reformulation, dictionnaire de synonymes | « synonymes de voiture » |
| `get_antonyms(term)` | Antonymes | « contraire de "chaud" » |
| `get_hypernyms(term)` | Catégorisation montante (« qu'est-ce qu'un X ? ») | « qu'est-ce qu'un chat ? » |
| `get_hyponyms(term)` | Catégorisation descendante (« exemples de X ») | « exemples d'insectes » |
| `get_parts(term)` | Composition / méronymie | « parties d'une voiture » |
| `get_characteristics(term)` | Attributs/adjectifs typiques | « caractéristiques de l'eau » |
| `get_relations_of_type(term, relation, direction)` | Toute relation rare (les 180+ autres) | « r_has_topic de restaurant » |
| `get_relations_between(t1, t2)` | « Quel rapport entre A et B ? » | « lien chat ↔ internet » |
| `disambiguate(term)` | **OBLIGATOIRE pour les polysémiques** | « sens de "avocat" » |

#### B. Prédicatifs (10 outils — verbes & rôles thématiques)

| Outil | Argument typique | Exemple |
|---|---|---|
| `get_agents(verb)` | verbe à l'infinitif | « qui mange ? » → manger r_agent |
| `get_patients(verb)` | verbe | « que mange-t-on ? » |
| `get_instruments(verb)` | verbe | « avec quoi on coupe ? » |
| `get_locations(term)` | nom OU verbe | « où va le poisson ? » ou « où se passe étudier ? » |
| `get_causes(term)` | nom ou verbe | « cause de la fatigue ? » |
| `get_consequences(term)` | nom ou verbe | « conséquence de la pluie ? » |
| `get_purpose(verb)` | verbe | « pourquoi court-on ? » |
| `get_manner(verb)` | verbe | « comment mange-t-on ? » |
| `get_telic_role(noun)` | nom | « à quoi sert un couteau ? » |
| `get_agentive_role(noun)` | nom | « comment fabrique-t-on un livre ? » |

#### C. Fact-check & Enrichissement (4 outils)

| Outil | Usage |
|---|---|
| `verify_claim(subject, relation, object, polarity=True)` | Vérification déterministe d'un triplet |
| `detect_gaps(term, relations=None)` | Identifie ce qui manque autour d'un terme |
| `validate_candidate(term, relation, target)` | Vérifie si un triplet proposé est nouveau, valide |
| `list_relation_types(prefix=None)` | Explore les 180+ types disponibles |

### Patterns d'utilisation dans Claude Code

#### Pattern 1 : Question simple
Tu poses, Claude appelle 1 outil, te réponds :
> *« Quels sont les antonymes de "grand" ? »*

#### Pattern 2 : Pipeline polysémique (3 appels chaînés)
> *« Donne-moi les synonymes du sens juridique de "avocat". »*

Claude va :
1. `disambiguate("avocat")` → trouve `sense_id="avocat>116477>66699"` (juriste)
2. `get_synonyms(term="avocat>116477>66699")` → synonymes du juriste
3. Cite les triplets décodés

#### Pattern 3 : Fact-check sur le vif
> *« La baleine est un poisson, est-ce vrai d'après JDM ? »*

→ Claude appelle `verify_claim("baleine", "r_isa", "poisson")` et te montre :
`CONTRADICTED conf=0.91 (mammifère + r_isa-incompatible poisson)`.

#### Pattern 4 : Enrichissement assisté (le plus puissant)
> *« Pour "smartphone", trouve les gaps de couverture JDM et propose-moi 3 triplets r_has_part valides à ajouter. »*

Claude va :
1. `detect_gaps("smartphone", ["r_has_part"])` → identifie le déficit
2. Propose mentalement des composants (écran, processeur, batterie, capteur, etc.)
3. `validate_candidate("smartphone", "r_has_part", "écran tactile")` × N
4. Te rend une liste validée prête à soumettre à JDM

Tu deviens un **modérateur JDM augmenté** — c'est exactement la valeur visée par
Phase 6.

### Inviter Claude à adopter un comportement particulier

Mets dans le `CLAUDE.md` à la racine de ton repo (Claude Code le lit
automatiquement à chaque démarrage de session) :

```markdown
# Style JDM pour cette session

Quand l'utilisateur pose une question sur le français, tu DOIS utiliser
les outils `jdm__*`. Cite systématiquement les triplets sous la forme
`source | relation | target (w=...)`. Pour les termes polysémiques, commence
par `disambiguate`. Si JDM ne contient pas l'information, dis-le explicitement
sans inventer.
```

Tu peux maintenir plusieurs `CLAUDE.md` dans des sous-dossiers pour différents
"modes" (ex: `recherche/CLAUDE.md`, `enrichissement/CLAUDE.md`).

---

# 2. Mode batch / scripting : les 6 CLIs

Quand tu sors de l'interactif (corpus, automation, CI), utilise les commandes.
Toutes affichent UTF-8 proprement sur Windows (`apps/_console.py` force
l'encodage au démarrage).

## `jdm-qa` — Q&A REPL avec streaming

```powershell
# REPL interactif
jdm-qa --provider ollama --model llama3.2:3b --verbose

# Question unique
jdm-qa -q "synonymes de voiture" --verbose
```

**Sortie** : conversationnelle en couleurs sur le terminal. Avec `--verbose`,
chaque appel d'outil s'affiche en direct (timing + payload).

## `jdm-eval` — Banc de 10 questions types

```powershell
jdm-eval --provider ollama --model llama3.2:3b --show-tools --limit 5
```

**Sortie** : score qualitatif, identifie les régressions quand tu changes de modèle.

## `jdm-diag` — Diagnostic en couches

```powershell
jdm-diag --provider ollama --model llama3.2:3b
```

**Sortie** : timing à chaque couche (client HTTP, cache, Ollama, inférence, agent).
À lancer quand quelque chose semble bloqué — confirme rapidement si c'est le réseau,
le LLM, ou un bug.

## `jdm-factcheck` — Vérification d'affirmations

### Trois modes d'invocation

```powershell
# Mode 1 : claim direct (instantané, sans LLM)
jdm-factcheck --claim "baleine r_isa poisson"
jdm-factcheck --claim "sang r_has_color rouge" --claim "chat r_isa mammifère"

# Mode 2 : texte libre (LLM extrait les claims)
jdm-factcheck --text "La baleine est un poisson géant qui vit en mer." \
              --provider anthropic --model claude-sonnet-4-5

# Mode 3 : batch stdin
echo "baleine r_isa poisson
chat r_isa mammifère
voiture r_has_part roue" | jdm-factcheck --stdin --json > rapport.json
```

### Lecture du rapport

Sortie standard (terminal) :
```
=== Rapport (3 claim(s)) ===
  ✓ supported    : 1
  ✗ contradicted : 1
  ? unknown      : 1

✗ [CONTRADICTED] `baleine | r_isa | poisson`  (conf=0.91)
   → JDM contredit : `baleine | r_isa | mammifère` (w=266) et
     `mammifère | r_isa-incompatible | poisson` (w=35).
   - baleine | r_isa | mammifère (w=266)
   - mammifère | r_isa-incompatible | poisson (w=35)
```

Codes de sortie utiles en CI/CD :
- `0` : aucune contradiction (build OK)
- `3` : au moins une `CONTRADICTED` détectée (build FAIL)
- `1`/`2` : erreur d'usage ou d'init LLM

### Sortie `--json` (machine-readable)

```json
{
  "text": "La baleine est un poisson...",
  "verdicts": [
    {
      "claim": {"text": "...", "subject": "baleine", "relation": "r_isa", "object": "poisson", "polarity": true},
      "status": "contradicted",
      "confidence": 0.906,
      "explanation": "...",
      "evidence_for": [],
      "evidence_against": [
        {"source": "baleine", "relation": "r_isa", "target": "mammifère", "w": 266.0, "source_id": null, "target_id": null},
        {"source": "mammifère", "relation": "r_isa-incompatible", "target": "poisson", "w": 35.0, ...}
      ]
    }
  ]
}
```

Parse avec `jq` :
```powershell
jdm-factcheck --claim "baleine r_isa poisson" --json | jq '.verdicts[].status'
# → "contradicted"
```

## `jdm-enrich` — Détection de gaps + propositions

```powershell
# Détection pure (instantanée, gratuite — pas de LLM)
jdm-enrich --terms smartphone tablette --no-propose

# Pipeline complet : gaps → LLM propose → validation → CSV
jdm-enrich --terms smartphone --provider anthropic --model claude-sonnet-4-5 \
           -o candidats.csv

# Batch sur un domaine entier
echo "smartphone
tablette
ordinateur portable
montre connectée" > tech.txt
jdm-enrich --terms-file tech.txt --provider anthropic --model claude-haiku-4-5 \
           --max-per-gap 5 -o tech_candidats.csv
```

### Lecture du CSV de sortie

Colonnes : `term | relation | target | confidence | validation_status | rationale | validation_note | source`

| validation_status | Que faire ? |
|---|---|
| `ok` | À soumettre à la modération JDM, prioritaire |
| `duplicate` | Déjà présent — confirme le bon fonctionnement du LLM |
| `unknown_term` | LLM a halluciné un mot. Soit l'ajouter à JDM d'abord, soit reformuler |
| `inconsistent` | Contradiction détectée. À NE PAS soumettre tel quel |

Filtrer avec PowerShell :
```powershell
Import-Csv candidats.csv | Where-Object validation_status -eq "ok" | Format-Table
```

Ou avec Python/pandas :
```python
import pandas as pd
df = pd.read_csv("candidats.csv")
ok = df[df.validation_status == "ok"].sort_values("confidence", ascending=False)
print(f"{len(ok)} candidats à soumettre")
ok.to_csv("a_soumettre.csv", index=False)
```

## MCP hébergé (distant) — sans rien installer

Si tu ne veux pas lancer le serveur en local, une instance hébergée publiquement
sera disponible (voir [DEVELOPMENT.md](DEVELOPMENT.md) section Phase 8 pour
les détails de déploiement). Une fois en ligne :

```bash
# Claude Code — transport HTTP
claude mcp add jdm-remote --transport http --url https://jdmagent.onrender.com/mcp

# Claude Desktop — claude_desktop_config.json
# {
#   "mcpServers": {
#     "jdm-remote": {
#       "url": "https://jdmagent.onrender.com/mcp",
#       "transport": "streamable-http"
#     }
#   }
# }
```

→ Avantage : zéro install côté toi. Inconvénient : cold start ~30-60 s sur
free tier après inactivité (les 2 premières requêtes lentes, le reste rapide
grâce au cache disque côté serveur).

## `jdm-mcp` — Serveur MCP local (n'est pas un CLI à lancer manuellement)

Démarré automatiquement par Claude Code. Pour debug :
```powershell
jdm-mcp           # bloque en lecture stdio
```
Si ça hang en silence c'est normal — il attend des messages MCP. Ctrl+C pour quitter.

---

# 3. Mode programmatique : Python API

Pour intégrer dans un autre script, notebook, ou serveur :

## Client bas niveau

```python
from jdm_agent.client import JDMClient

with JDMClient() as c:
    n = c.node_by_name("chat")           # Node Pydantic
    syns = c.synonyms("chat", min_weight=30)  # list[Node]
    rels = c.relations_from("voiture",
                            types_ids=[c.relation_type_id("r_has_part")],
                            min_weight=50, limit=20)
    # rels.relations : list[Relation] ; rels.node_index() : dict[int, Node]

    # Refinements décodés (Phase 5)
    senses = c.refinements_decoded("avocat")
    for s in senses:
        print(s.decoded, s.weight)       # "avocat (personne, juriste)" 356
```

## Fact-checker programmatique

```python
from jdm_agent.factcheck import Claim, factcheck_claims, verify_claim
from jdm_agent.client import JDMClient

claims = [
    Claim(text="le sang est rouge", subject="sang", relation="r_has_color", object="rouge"),
    Claim(text="la baleine est un poisson", subject="baleine", relation="r_isa", object="poisson"),
]
report = factcheck_claims(claims)
print(report.summary())                  # {"total": 2, "supported": 1, "contradicted": 1, ...}

for v in report.verdicts:
    print(v.status, v.confidence, v.explanation)
```

## Enrichissement programmatique

```python
from jdm_agent.enrich import detect_gaps, validate_candidate, Candidate
from jdm_agent.client import JDMClient

c = JDMClient()
gaps = detect_gaps(c, "smartphone", check_asymmetries=True)
for g in gaps:
    print(g.gap_type, g.term, g.relation, g.detail)

# Validation manuelle d'une proposition humaine
cand = Candidate(term="smartphone", relation="r_has_part", target="écran tactile",
                 confidence=0.95, source="manual")
validated = validate_candidate(c, cand)
print(validated.validation_status, validated.validation_note)
```

## Pipeline complet en un appel

```python
from jdm_agent.enrich import enrich
from jdm_agent.tools.llm_factory import get_llm

llm = get_llm(provider="anthropic", model="claude-sonnet-4-5")
gaps, candidates = enrich(
    terms=["smartphone", "tablette"],
    llm=llm,
    target_relations=["r_has_part", "r_carac", "r_telic_role"],
    propose=True,
    validate=True,
)
print(f"{len(gaps)} gaps, {len(candidates)} candidats")
ok = [c for c in candidates if c.is_valid()]
print(f"  dont {len(ok)} prêts à soumettre")
```

---

# 4. Tableau croisé : quoi via quoi ?

| Capacité | Claude Code MCP | CLI | Python API |
|---|---|---|---|
| Q&A interactive | ✅ idéal | ❌ pas adapté | ❌ trop bas niveau |
| Lookup ponctuel | ✅ rapide | ⚠️ via `jdm-qa -q` | ✅ |
| Vérifier 1 triplet | ✅ `verify_claim` | ✅ `jdm-factcheck --claim` | ✅ `verify_claim()` |
| Vérifier un texte | ⚠️ pas natif (mais demande à Claude d'extraire d'abord) | ✅ `jdm-factcheck --text` | ✅ `factcheck()` |
| Détecter gaps | ✅ `detect_gaps` | ✅ `jdm-enrich --no-propose` | ✅ `detect_gaps()` |
| Proposer candidats | ✅ Claude propose, tu valides | ✅ via LLM externe | ✅ `propose_candidates()` |
| Valider 1 candidat | ✅ `validate_candidate` | ⚠️ implicite via `jdm-enrich` | ✅ `validate_candidate()` |
| Batch 100+ termes | ❌ context limité | ✅ `jdm-enrich --terms-file` | ✅ idéal |
| Intégration CI/CD | ❌ | ✅ exit codes propres | ✅ |
| Exploration créative | ✅ idéal | ⚠️ | ⚠️ |

---

# 5. Workflows-types

## Workflow A — Réviseur lexical assisté

Tu travailles sur un texte (livre, article, fiche pédagogique).

1. **Dans Claude Code** : *« vérifie le texte suivant contre JDM : ‹colle› »*
   - Claude extrait mentalement les claims, appelle `verify_claim` × N, te liste
     les contradictions à corriger.
2. **CLI fallback batch** : `jdm-factcheck --text "$(cat article.md)" --json > audit.json`
   - Tu obtiens un audit machine-readable archivable.

## Workflow B — Ontologie d'un domaine

Tu construis le vocabulaire d'un sujet (tech, médecine, droit…).

1. Liste tes termes dans `domaine.txt`.
2. `jdm-enrich --terms-file domaine.txt --no-propose` → audit gratuit des trous.
3. Si trous nombreux : `jdm-enrich --terms-file domaine.txt --provider anthropic
   --model claude-sonnet-4-5 -o candidats.csv` → propositions LLM validées.
4. Filtre `validation_status == "ok"`, revue humaine sur ~50–100 lignes.
5. Soumets à la modération JDM.

## Workflow C — Anti-hallucination d'un LLM externe

Tu utilises ChatGPT/Gemini ailleurs et veux vérifier ses sorties françaises.

1. Copie sa réponse dans un fichier.
2. `jdm-factcheck --text "$(cat reponse.txt)" --provider anthropic --model claude-haiku-4-5 --json > audit.json`
3. `jq '.verdicts[] | select(.status=="contradicted")' audit.json` → uniquement les claims fausses.

## Workflow D — Recherche linguistique exploratoire

Tu cherches à comprendre la sémantique d'un mot ou d'une famille.

1. **Dans Claude Code** : conversation libre.
2. *« Pour le mot "chat", liste tous ses sens, puis pour chacun donne 3 synonymes,
   3 hyperonymes, 3 caractéristiques typiques. »*
3. Claude appelle disambiguate → get_synonyms/hypernyms/characteristics × N sens.
4. Tu lis directement la réponse structurée dans le chat — pas d'export nécessaire
   si c'est de la recherche ponctuelle.

## Workflow E — Audit de cohérence

Tu veux vérifier la cohérence d'un mini-corpus de règles métier.

1. Écris tes règles au format `subject r_xxx object`, une par ligne, dans `rules.txt`.
2. `cat rules.txt | jdm-factcheck --stdin --json > audit.json`
3. Si exit code = 3, ton corpus contient au moins une contradiction.
4. Idéal en pre-commit hook ou GitHub Actions.

---

# 6. Comment voir les sorties — résumé

| Format | Comment lire |
|---|---|
| Terminal coloré | direct, lisibilité humaine. Pipe vers `Out-File -Encoding utf8` pour archiver. |
| CSV (`-o candidats.csv`) | Excel, `Import-Csv`, `pandas.read_csv()` |
| JSON (`--json`) | `jq`, `python -m json.tool`, `Get-Content ... | ConvertFrom-Json` |
| Logs MCP | `%APPDATA%\Claude\logs\mcp*.log` (debug du serveur) |
| Cache disque JDM | `.cache/jdm/` (SQLite + fichiers). Inspectable mais opaque ; `JDMClient().cache.clear()` pour purger. |

---

# 7. Connexion à ton abo Max — rappel

- **Claude Code + MCP** : LLM = ton abo Max → **0 € de plus**
- **CLI `jdm-qa` / `jdm-eval` / `jdm-factcheck --text` / `jdm-enrich --provider …`** :
  - Avec `--provider ollama` → **0 €** mais ~90 s/inférence sur CPU
  - Avec `--provider anthropic` → **~$0.05–0.30 par question** (API séparée)
- **CLI `*-factcheck --claim` / `*-enrich --no-propose`** : **0 €**, pas de LLM utilisé

Donc pour usage quotidien sans frais : reste dans Claude Code via MCP. Réserve l'API
Anthropic aux batch jobs où tu veux la qualité Sonnet/Haiku à la vitesse réseau.
