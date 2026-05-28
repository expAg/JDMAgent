// View: Projet — landing page with the canonical project description.
// Le contenu vit ici en tant que template string Markdown (mêmes textes
// que la branche deploy-self / app.py:PROJET_MD). Rendu via marked.js.

const PROJET_MD = `# Jarvis-web : Accès web à l'agent JeuxDeMots

**Objectif** : agentification de [JeuxDeMots](https://www.jeuxdemots.org)
(LIRMM/CNRS, ~2 M nœuds, 180+ relations typées) pour les LLM modernes via
**LangChain** et le **Model Context Protocol**.

## Que peux-tu faire sur cette page ?

- **🔎 Explorer JDM** — choisis un terme et une relation, vois les triplets
  triés par poids consensuel. Annotations sémantiques (constitutif,
  contrastif, exception, …) optionnelles. Désambiguïsation des termes
  polysémiques (avocat, souris, police…).
- **⚖️ Claim checker** — vérifie une affirmation factuelle contre JDM de
  façon **déterministe** (sans LLM) : SUPPORTED / CONTRADICTED / UNKNOWN
  avec citations des triplets utilisés.
- **🕸️ Sous-graphe** — visualisation interactive (vis-network) du
  voisinage sémantique d'un terme jusqu'à profondeur 4, sélection de
  relations indépendante par niveau, négations en rouge.
- **🤖 Agent** — conversation avec un agent (Gemini hébergé gratuit, ou
  BYOK Claude/GPT) qui n'utilise QUE les outils JDM et cite ses sources.
- **🦾 Jarvis** — flux guidés par formulaires (zéro prompt à taper) :
  - <small>🌱</small> *Enrichissement* — propose et consolide de nouveaux triplets (\`.enrich\`)
  - <small>🔍</small> *Audit* — détecte les contaminations par les sens non-premiers (\`.audit\`)
  - <small>🕳️</small> *Détection de trous* — flagge MISSING / NEGATIVE / LOW_COVERAGE
  - <small>⚠️</small> *Signalement* — flagge les triplets suspects au LLM (\`.err\`)
  - <small>📊</small> *Statistiques* — couverture par relation et par termes rencontrés (\`.stat\`)

## Le projet en bref

- Couche client typée (\`JDMClient\`) sur l'[API JeuxDeMots](https://jdm-api.demo.lirmm.fr)
  + cache disque + retry exponentiel.
- ~35 outils MCP exposés à n'importe quel client (Claude Code/Desktop,
  Cursor, etc.) via [FastMCP](https://github.com/jlowin/fastmcp).
- Pipeline fact-check déterministe + détection de gaps + **moteur
  d'inférence symbolique borné** pour la consolidation des candidats avant
  soumission au canal contributif LLMDrops de JDM.
- Visualisation sous-graphe HTML autonome (vis-network) avec sélection de
  relations par niveau, palette par famille de relation et opacité
  progressive.

**Données** : JeuxDeMots — Mathieu Lafourcade, équipe TEXTE, LIRMM/CNRS.

**Liens** :
[Code source & README](https://github.com/expAg/JDMAgent) ·
[USAGE.md](https://github.com/expAg/JDMAgent/blob/main/USAGE.md) ·
[Notebook Colab](https://colab.research.google.com/github/expAg/JDMAgent/blob/main/notebooks/demo.ipynb)
`;

function ViewProjet({ goto }) {
  // marked.js est chargé en CDN dans index.html. On le configure une
  // seule fois (parse GFM tables + auto links).
  const html = React.useMemo(() => {
    if (typeof window !== 'undefined' && window.marked) {
      window.marked.setOptions({ gfm: true, breaks: false });
      return window.marked.parse(PROJET_MD);
    }
    return '<pre>' + PROJET_MD + '</pre>';
  }, []);

  return (
    <PageShell>
      <div className="jdm-prose"
        dangerouslySetInnerHTML={{ __html: html }} />
    </PageShell>
  );
}

window.ViewProjet = ViewProjet;
