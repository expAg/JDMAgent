// View: Aide — installation, usage, MCP, soumission format.
// Mêmes textes que la branche deploy-self / app.py:AIDE_MD.

const AIDE_MD = `# 🛠️ Aide & Installation

## 1. Naviguer dans la démo

| Onglet | Ce qu'il fait | Clé API ? |
|---|---|---|
| 📋 **Projet** | Présentation, liens code source | Aucune |
| 🔎 **Explorer JDM** | Table de triplets pour un terme/relation, déterministe | Aucune |
| ⚖️ **Claim checker** | SUPPORTED / CONTRADICTED / UNKNOWN sur un triplet, déterministe | Aucune |
| 🕸️ **Sous-graphe** | Visualisation vis-network interactive du voisinage | Aucune |
| 🤖 **Agent** | Chat libre avec un agent LLM qui utilise les 34 outils JDM | Gemini hébergé gratuit, ou BYOK Claude / GPT |
| 🦾 **Jarvis** | Flows guidés par formulaires (5 sous-onglets) | Gemini hébergé gratuit ; clé LLMDrops si tu veux pousser vers JDM |
| 🛠️ **Aide** | Ce document | — |

## 2. Jarvis en détail — 5 flows guidés

Tous les sous-onglets Jarvis partagent un **bandeau** en haut :
- **Clé API LLMDrops** (optionnel) : override l'env \`JDM_DROPS_API_KEY\` pour les uploads.
- **Modèle LLM** : Gemini 3.1 Flash Lite par défaut (500 requêtes/jour gratuites). BYOK Claude / GPT possibles si tu colles ta clé.
- **Budget d'appels d'outils** : 10 / 25 / 50 / 100 / illimité. Au-delà, le LLM reçoit un sentinel et arrête proprement en consolidant ce qu'il a.

### 🌱 Enrichissement
Propose et consolide de nouveaux triplets pour un terme.
- **Form** : terme, relation cible (optionnelle), nombre cible de triplets, varier les relations, itérer jusqu'au but, soumettre directement.
- **Output** : chatbot avec le raisonnement + le fichier \`.enrich\` écrit.
- **Workflow** : \`enrichment_workflow()\` (pré-fetch → désambiguïsation → proposition → validation+consolidation par inférence → écriture).

### 🔍 Audit
Audit sémantique de la répartition des sens d'un terme polysémique.
- **Form** : terme, relation cible optionnelle, soumettre directement.
- **Output** : verdict par triplet du terme générique (LEGITIME / DEVRAIT_ETRE_CONTRASTIF / NON_CONTRASTIF / NEGATIVE) + section META narrative.
- **Workflow** : \`audit_workflow()\`.

### 🕳️ Détection de trous
Identifie les trous de couverture (MISSING / NEGATIVE_FILLED / LOW_COVERAGE).
- **Form** : terme, relations à examiner (vide = défauts), seuil LOW_COVERAGE.
- **Output gauche** : tableau des gaps trouvés (déterministe, instantané) + dropdown pour router un gap → boutons **→ Enrichir** / **→ Auditer** / **→ Stats** qui pré-remplissent les autres sous-onglets et basculent l'onglet.
- **Output droite** : synthèse narrative de l'agent.
- **Workflow** : \`gap_detection_workflow()\`.

### ⚠️ Signalement
Le LLM utilise son **jugement linguistique** pour flagger les triplets suspects (pas besoin de preuve d'outil).
- **Form** : terme, relation optionnelle, soumettre directement.
- **Output** : fichier \`.err\` avec catégorie de suspicion et justification.
- **Workflow** : \`signalement_workflow()\`.

### 📊 Stats
Statistiques de couverture par terme et/ou par relation.
- **Form** : terme (mode PAR_TERME), relation (mode PAR_RELATION) — au moins un des deux.
- **Output** : tableau (n_total, n_pos, n_neg, max_w, min_w, mean_w par relation) + 3-5 observations clés.
- **Workflow** : \`stats_workflow()\`.

## 3. Obtenir les clés API

| Clé | Où ? | Coût | Quand l'utiliser |
|---|---|---|---|
| **Gemini** | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | Gratuit (500 req/jour pour 3.1 Flash Lite) | Pré-configurée côté HF Space, rien à faire pour toi |
| **LLMDrops JDM** | jeuxdemots.org (contacter M. Lafourcade) | Gratuit sur demande | Soumettre \`.enrich\` / \`.audit\` / \`.err\` directement à JDM |
| **Anthropic (Claude)** | [console.anthropic.com](https://console.anthropic.com) | Payant ($) | BYOK Claude dans Agent / Jarvis |
| **OpenAI (GPT)** | [platform.openai.com](https://platform.openai.com/api-keys) | Payant ($) | BYOK GPT dans Agent / Jarvis |

⚠️ **Sécurité** : les clés que tu colles dans l'UI ne sont **jamais persistées** côté serveur — elles vivent uniquement le temps de ton onglet navigateur.

## 4. Installation locale (déployer la même app ailleurs)

\`\`\`bash
# 1. Cloner le repo
git clone https://github.com/expAg/JDMAgent.git
cd JDMAgent

# 2. Créer un environnement Python isolé (venv)
python3 -m venv .venv

# 3. Activer le venv
source .venv/bin/activate          # Linux / macOS
# .venv\\Scripts\\activate           # Windows

# 4. Installer les dépendances
pip install --upgrade pip
pip install -r requirements.txt

# 5. Configurer les clés API
cp .env.example .env
# édite .env : GOOGLE_API_KEYS (CSV) / ANTHROPIC_API_KEY / OPENAI_API_KEY /
# JDM_DROPS_API_KEY / APP_SUBPATH (si reverse-proxy)

# 6. Lancer l'app — écoute sur http://0.0.0.0:7860
uvicorn app_fastapi:app --host 0.0.0.0 --port 7860
\`\`\`

Ensuite, dans ton navigateur → <http://localhost:7860>.

**Sous reverse-proxy** : si Apache/Nginx route un sous-chemin (ex. \`/Jarvis/\`),
mets \`APP_SUBPATH=/Jarvis\` dans \`.env\` — le frontend injecte automatiquement
\`<base href>\` et les fetch API se résolvent correctement.

**Sur Debian 12 / Ubuntu 24.04 (PEP 668)** : pip refuse d'installer hors venv —
le venv ci-dessus est donc **obligatoire**.

## 5. Serveur MCP — utiliser les outils JDM dans Claude Code / Cursor

\`\`\`bash
claude mcp add jdm "python -m jdm_agent.mcp.server"
claude mcp list
\`\`\`

Ensuite, depuis Claude Code : « Donne-moi les synonymes de voiture dans JDM » → l'agent appelle automatiquement les outils MCP exposés.

## 6. Format des fichiers de soumission

Tous les fichiers produits par Jarvis suivent un **format pipe** :

\`\`\`
# .enrich (proposition de triplets)
term | relation | target | annotation < explication chaîne d'inférence >

# .audit (deux sections séparées par === META ===)
=== PROPOSITIONS ===
term | relation | target | annotation | verdict | justification
...
=== META ===
<compte rendu narratif sur la confusion / propagation des sens>

# .err (suspects flaggés par le LLM)
term | relation | target | catégorie_suspect | justification
\`\`\`

Le LLM produit ces fichiers en local. Pour les pousser à JDM, soit :
- coche **Soumettre directement** dans le formulaire (la clé \`JDM_DROPS_API_KEY\` doit être configurée) ;
- ou télécharge le fichier puis poste-le manuellement sur le formulaire LLMDrops de jeuxdemots.org.

## 7. Liens utiles

- **Code source** : <https://github.com/expAg/JDMAgent>
- **API JeuxDeMots** : <https://jdm-api.demo.lirmm.fr>
- **JeuxDeMots (site)** : <https://www.jeuxdemots.org>
- **USAGE.md détaillé** : <https://github.com/expAg/JDMAgent/blob/main/USAGE.md>
- **DEVELOPMENT.md** : <https://github.com/expAg/JDMAgent/blob/main/DEVELOPMENT.md>
`;

function ViewAide() {
  const html = React.useMemo(() => {
    if (typeof window !== 'undefined' && window.marked) {
      window.marked.setOptions({ gfm: true, breaks: false });
      return window.marked.parse(AIDE_MD);
    }
    return '<pre>' + AIDE_MD + '</pre>';
  }, []);

  return (
    <PageShell>
      <div className="jdm-prose"
        dangerouslySetInnerHTML={{ __html: html }} />
    </PageShell>
  );
}

window.ViewAide = ViewAide;
