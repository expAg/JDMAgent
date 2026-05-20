# JDMAgent

Projet d'agentification du RLS **JeuxDeMots** : client typé, cache disque, outils LangChain
et serveur MCP pour exploiter le graphe lexical via les LLM modernes.

## Architecture (en couches)

```
apps (qa_cli, factcheck, enrich)
  ↓
tools (LangChain @tool) + llm_factory
  ↓
client (JDMClient + cache disque + Pydantic + relations.md parser)
  ↓
JDM REST API (https://jdm-api.demo.lirmm.fr)
```

## Installation

```bash
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -e ".[dev,langchain,anthropic,mcp]"
cp .env.example .env
```

## Démarrage rapide

### Client bas niveau

```python
from jdm_agent.client import JDMClient

c = JDMClient()
node = c.node_by_name("chat")
syns = c.relations_from("chat", types_ids=[c.relation_type_id("r_syn")], limit=20)
for r in syns.relations:
    target = c.node_by_id(r.node2)
    print(target.name, "w=", r.w)
```

### Agent Q&A (CLI)

```bash
# Avec Anthropic (clé requise)
export ANTHROPIC_API_KEY=...
python -m jdm_agent.apps.qa_cli

# Avec Ollama local (modèle compatible tool-calling)
ollama pull llama3.2:3b
python -m jdm_agent.apps.qa_cli --provider ollama --model llama3.2:3b

# Question unique
python -m jdm_agent.apps.qa_cli -q "synonymes de voiture"
```

### Banc d'évaluation

```bash
python -m jdm_agent.apps.qa_eval --provider ollama --model llama3.2:3b --show-tools
```

### Serveur MCP (Claude Desktop / Claude Code / Cursor)

Expose les 21 outils JDM à n'importe quel client MCP. Lancement standalone :

```bash
python -m jdm_agent.mcp.server      # ou: jdm-mcp
```

**Configuration côté Claude Desktop** (`%APPDATA%\Claude\claude_desktop_config.json`) :

```json
{
  "mcpServers": {
    "jdm": {
      "command": "python",
      "args": ["-m", "jdm_agent.mcp.server"]
    }
  }
}
```

**Configuration côté Claude Code** (`~/.claude.json`, dans `mcpServers`) :

```json
"jdm": {
  "command": "python",
  "args": ["-m", "jdm_agent.mcp.server"]
}
```

Une fois branché, demande au LLM des requêtes du type *« utilise JDM pour me dire
les synonymes de voiture »* ou *« avec JDM, quels sont les sens du mot avocat ? »*.

## Tests

```bash
pytest
```

## Roadmap

- [x] Phase 0 — Bootstrap
- [x] Phase 1 — Client JDM typé + cache disque
- [x] Phase 2 — Couche LangChain (tools + agent)
- [x] Phase 3 — App Q&A NL → JDM (+ raffinements décodés, outils prédicatifs)
- [x] Phase 4 — Serveur MCP
- [ ] Phase 5 — Fact-checker
- [ ] Phase 6 — Enrichissement actif
- [ ] Phase 7 — Spike graphe local (DuckDB/NetworkX)

Voir `relation_definitions.md` pour la taxonomie complète des relations JDM (180+).
