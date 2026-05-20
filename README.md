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

## Phase actuelle : 1 (client JDM)

```python
from jdm_agent.client import JDMClient

c = JDMClient()
node = c.node_by_name("chat")
syns = c.relations_from("chat", types_ids=[c.relation_type_id("r_syn")], limit=20)
for r in syns.relations:
    target = c.node_by_id(r.node2)
    print(target.name, "w=", r.w)
```

## Tests

```bash
pytest
```

## Roadmap

- [x] Phase 0 — Bootstrap
- [x] Phase 1 — Client JDM typé + cache disque
- [ ] Phase 2 — Couche LangChain (tools + agent)
- [ ] Phase 3 — App Q&A NL → JDM
- [ ] Phase 4 — Serveur MCP
- [ ] Phase 5 — Fact-checker
- [ ] Phase 6 — Enrichissement actif
- [ ] Phase 7 — Spike graphe local (DuckDB/NetworkX)

Voir `relation_definitions.md` pour la taxonomie complète des relations JDM (180+).
