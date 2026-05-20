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
- 🤖 **Agent** — conversationnel, trois options de modèle :
  - **HF Inference** (gratuit) : Llama 3.3 70B ou Qwen 2.5 72B via le quota du Space. Aucune clé visiteur requise.
  - **Anthropic Claude** (BYOK) : qualité/rapidité supérieures.
  - **OpenAI GPT** (BYOK) : function-calling très mature.

  Pour les options BYOK, la clé reste en session, n'est ni sauvegardée ni loggée.

## Configuration (pour le propriétaire du Space)

L'onglet Agent utilise `HF_TOKEN` côté serveur pour appeler l'Inference API HF.
Va dans **Settings → Variables and secrets** et ajoute :
- Nom : `HF_TOKEN`
- Valeur : un token HF Read (gratuit, sur https://huggingface.co/settings/tokens)

Sans ce secret, seul le mode BYOK Anthropic fonctionnera dans l'onglet Agent.
Les onglets Explorer et Fact-checker fonctionnent sans aucune config.

## Crédits

- **JeuxDeMots** : M. Lafourcade et l'équipe TEXTE, LIRMM/CNRS.
- **Code source** : <https://github.com/expAg/JDMAgent>
- **Doc utilisateur** : [USAGE.md](https://github.com/expAg/JDMAgent/blob/main/USAGE.md)
- **Pour brancher dans Claude Code/Desktop natif** : voir le serveur MCP dans la doc du repo.
