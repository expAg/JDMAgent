---
title: JDMAgent
emoji: 🇫🇷
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
---

# JDMAgent — démo Hugging Face Spaces

Démo interactive du projet **[JDMAgent](https://github.com/expAg/JDMAgent)** :
agentification du graphe lexical [JeuxDeMots](https://www.jeuxdemots.org) (~2 M nœuds, 180+ relations typées)
pour les LLM modernes via LangChain + MCP.

## 3 onglets

- 🔎 **Explorer JDM** — sans LLM : interroge le graphe (synonymes, hyperonymes, parties, caractéristiques, agents, lieux, etc.) + désambiguïsation des polysémiques (avocat → fruit / juriste / couleur)
- ⚖️ **Fact-checker** — vérification déterministe d'un triplet : `supported` / `contradicted` / `unknown` avec triplets justificatifs
- 🤖 **Agent** — conversationnel (BYOK — Bring Your Own Key) :
  - **Anthropic Claude** (Haiku ou Sonnet) — clé sur [console.anthropic.com](https://console.anthropic.com/settings/keys)
  - **OpenAI GPT** (4o ou 4o mini) — clé sur [platform.openai.com](https://platform.openai.com/api-keys)

  La clé reste en session, n'est ni sauvegardée ni loggée. Tu paies uniquement ton propre usage.

Les onglets **Explorer** et **Fact-checker** fonctionnent **sans aucune clé** —
ils n'utilisent aucun LLM, juste l'API publique de JeuxDeMots.

## Crédits

- **JeuxDeMots** : M. Lafourcade et l'équipe TEXTE, LIRMM/CNRS.
- **Code source** : <https://github.com/expAg/JDMAgent>
- **Doc utilisateur** : [USAGE.md](https://github.com/expAg/JDMAgent/blob/main/USAGE.md)
- **Pour brancher dans Claude Code/Desktop natif** : voir le serveur MCP dans la doc du repo.
