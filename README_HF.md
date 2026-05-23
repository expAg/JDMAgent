---
title: JDMAgent
emoji: 🧠
colorFrom: purple
colorTo: yellow
sdk: gradio
sdk_version: 5.34.0
app_file: app.py
pinned: false
license: mit
short_description: Agent LLM sur JeuxDeMots — graphe lexical du français
tags:
- nlp
- french
- knowledge-graph
- agent
- mcp
- langchain
- factcheck
- neuro-symbolic
---

# JDMAgent — démo interactive

Démonstration publique du projet **[JDMAgent](https://github.com/expAg/JDMAgent)** :
agentification du graphe lexical **[JeuxDeMots](https://www.jeuxdemots.org)**
(~2 millions de nœuds, 180+ relations typées, construit en dix-huit ans de jeu
collaboratif au LIRMM / CNRS) pour les modèles de langue modernes, via
LangChain et le **Model Context Protocol (MCP)**.

L'objectif scientifique : combiner un graphe de connaissance *typé* (la
ressource symbolique de JDM) avec la *créativité linguistique* d'un LLM, en
préservant la traçabilité et le déterminisme là où c'est possible. Trois
positions méthodologiques sous-tendent le projet — graphe typé plutôt que
RAG vectoriel pour la connaissance lexicale, séparation stricte
extraction-LLM / vérification-Python, et inférence symbolique bornée pour la
consolidation. Détails et architecture complète :
[README sur GitHub](https://github.com/expAg/JDMAgent).

---

## Les cinq onglets de cette démo

### 📋 Projet
Présentation synthétique du projet, des choix de design, et des liens vers
la documentation détaillée.

### 🔎 Explorer JDM
Interrogation directe du graphe — **aucun LLM, aucun coût d'API, instantané**.

Tape un terme français (`chat`, `voiture`, `avocat`…), choisis une relation
parmi les plus utiles (synonymes, hyperonymes, parties, caractéristiques,
agents, lieux, etc.), et reçois la liste des triplets triés par poids
décroissant. Pour les termes polysémiques (`avocat`, `souris`, `police`),
l'outil de désambiguïsation propose les sens disponibles et tu peux requêter
le sens précis voulu via son identifiant raffiné.

### ⚖️ Claim checker
Vérification déterministe d'un triplet factuel contre le graphe JDM. Trois
régimes au choix :

- **Effort 0 — contenance stricte** : *« JDM contient-il littéralement ce
  triplet ? »*. Pas d'inférence, réponse rapide.
- **Effort 1 — inférence noyau** : *« ce triplet est-il déductible du graphe ? »*.
  Si la contenance échoue, un moteur d'inférence symbolique enchaîne une
  cascade de schémas (transitivité, déduction par généralisation, élimination
  par classe, contraste antonymique, etc.) bornée par un budget HTTP.
- **Effort 2 — inférence complète** : ajoute la composition curée de
  relations (R₁ ⟸ R₂ ∘ R₃ selon une carte de compositions valides).

Chaque verdict (`supported` / `contradicted` / `unknown`) est accompagné de
la chaîne de preuve — les triplets JDM réels qui le justifient, et le schéma
d'inférence utilisé si le verdict provient d'une déduction. La distinction
contenance / inférence est toujours préservée dans la réponse : un fait
seulement déductible n'est jamais présenté comme un contenu direct de JDM.

### 🕸️ Sous-graphe
Visualisation interactive d'un sous-graphe centré sur un terme, profondeur
configurable. Le rendu utilise vis-network : nœuds colorés par type de
relation entrante, négations en rouge, isolés masquables par seuil de degré,
recadrage par clic, gravité par double-clic. Le HTML est autonome, on peut
le télécharger pour usage hors-ligne.

### 🤖 Agent (BYOK — Bring Your Own Key)
Agent conversationnel pour discuter en langage naturel avec un LLM qui ne
répond qu'avec des triplets JDM cités. Deux providers supportés :

- **Anthropic Claude** (Haiku ou Sonnet) — clé sur
  [console.anthropic.com](https://console.anthropic.com/settings/keys).
- **OpenAI GPT** (4o ou 4o mini) — clé sur
  [platform.openai.com](https://platform.openai.com/api-keys).

La clé reste **en mémoire de session uniquement** : elle n'est ni écrite sur
disque, ni envoyée à un serveur tiers autre que ton provider de LLM, ni
loggée. La fenêtre se ferme, la clé disparaît. Tu paies uniquement ton propre
usage du LLM choisi.

Les onglets **Explorer JDM**, **Claim checker** et **Sous-graphe** ne
requièrent **aucune clé** et ne consomment **aucune API LLM** — uniquement
l'API publique de JeuxDeMots.

---

## Note de performance

Cet espace HF tourne sur le tier gratuit (CPU basic). À la première visite
après ~48 h d'inactivité, attends-toi à un *cold start* de 30 à 60 secondes
le temps que le conteneur redémarre. Une fois lancé, les requêtes sont
rapides grâce au cache disque de l'API JDM.

---

## Pour aller plus loin

Cette démo n'est qu'une vitrine de trois des cinq surfaces du projet. Le
**serveur MCP local** permet d'utiliser les 34 outils JDM directement dans
Claude Code, Claude Desktop, Cursor ou tout autre client compatible MCP, en
une seule commande d'installation et sans frais d'API supplémentaire pour
qui dispose d'un abonnement Claude.

```bash
pip install -e ".[langchain,mcp]"
claude mcp add jdm --scope user -- python -m jdm_agent.mcp.server
```

À partir de là, Claude peut enchaîner les outils JDM dans une conversation :

> *« Pour le sens juridique d'« avocat », liste cinq synonymes plausibles et
> vérifie chacun contre JeuxDeMots. »*

→ `disambiguate(avocat)` → `get_synonyms(avocat>116477>66699)` →
`verify_claim` × 5, avec citation systématique des triplets sources.

Le projet propose en outre un **flux d'enrichissement contributif complet** :
le LLM propose des triplets candidats, le moteur d'inférence symbolique les
consolide contre le graphe existant, et seuls les triplets *déductibles*
sont soumis au endpoint contributif de JDM — fermant la boucle entre
créativité neuronale et garantie logique.

---

## Crédits

- **JeuxDeMots** — Mathieu Lafourcade et l'équipe TEXTE, LIRMM/CNRS.
  <https://www.jeuxdemots.org>
- **Code source, documentation, journal de bord** —
  <https://github.com/expAg/JDMAgent>
- **Guide d'usage complet** —
  [USAGE.md](https://github.com/expAg/JDMAgent/blob/main/USAGE.md)
- **Documentation technique** —
  [DEVELOPMENT.md](https://github.com/expAg/JDMAgent/blob/main/DEVELOPMENT.md)
