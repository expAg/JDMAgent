---
title: JDMAgent
emoji: 🇫🇷
colorFrom: purple
colorTo: yellow
sdk: gradio
sdk_version: 4.44.1
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
- 🤖 **Agent (BYOK)** — conversationnel avec un LLM Claude qui n'utilise QUE JDM pour répondre. **Apporte ta propre clé Anthropic**, elle reste dans ta session.

## Crédits

- **JeuxDeMots** : M. Lafourcade et l'équipe TEXTE, LIRMM/CNRS.
- **Code source** : <https://github.com/expAg/JDMAgent>
- **Doc utilisateur** : [USAGE.md](https://github.com/expAg/JDMAgent/blob/main/USAGE.md)
- **Pour brancher dans Claude Code/Desktop natif** : voir le serveur MCP dans la doc du repo.
