"""Chat de supervision Jarvis (la mascotte orchestratrice).

Expose :
  - build_jarvis_chat_agent : agent LangChain (supervision + JDM lecture)
  - persistence : journal des runs + overlay d'environnement
  - runtime : points d'injection (provider de runs, patches de config)
"""
from jdm_agent.jarvis_chat.agent import build_jarvis_chat_agent
from jdm_agent.jarvis_chat import persistence, runtime

__all__ = ["build_jarvis_chat_agent", "persistence", "runtime"]
