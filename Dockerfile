# Dockerfile pour le serveur MCP JDMAgent en HTTP streamable.
# Cible : déploiement sur Render free tier, Fly.io, ou tout PaaS Docker.
#
# Usage local :
#   docker build -t jdmagent-mcp .
#   docker run -p 8080:8080 jdmagent-mcp
#
# Le serveur expose les 27 outils MCP via le transport streamable-http.
# URL endpoint : http://localhost:8080/mcp
FROM python:3.12-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Copy minimal install metadata first (better layer caching).
COPY pyproject.toml ./
COPY src/ ./src/
COPY relation_definitions.md ./

# Install with MCP extras (no LangChain LLM providers needed — clients bring their own LLM).
RUN pip install -e ".[mcp]"

# Render injects PORT env var; default to 8080 for local docker run.
ENV PORT=8080
EXPOSE 8080

# Healthcheck stays simple — tries an MCP handshake against the bound port.
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request,os; urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\",\"8080\")}/mcp', timeout=5)" || exit 1

CMD ["sh", "-c", "python -m jdm_agent.mcp.server --transport streamable-http --host 0.0.0.0 --port ${PORT}"]
