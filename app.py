"""Gradio web demo of JDMAgent for Hugging Face Spaces.

Three tabs:
  1. Explorer JDM (no LLM, instant)
  2. Fact-checker (deterministic on direct claims, BYOK for text extraction)
  3. Agent JDM (BYOK conversational)

The user brings their own Anthropic API key for the LLM-powered tabs.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# Ensure local sources are importable on HF Spaces (no `pip install -e .` there).
_root = Path(__file__).parent
sys.path.insert(0, str(_root / "src"))

import gradio as gr
import pandas as pd

from jdm_agent.client import JDMClient
from jdm_agent.factcheck import Claim, verify_claim
from jdm_agent.factcheck.models import Status
from jdm_agent.viz import DEFAULT_RELATIONS, build_subgraph


# ---------- Shared client (cached, lazy) ----------
_client: JDMClient | None = None


def get_client() -> JDMClient:
    global _client
    if _client is None:
        _client = JDMClient()
    return _client


# ---------- Tab 1: Explorer JDM ----------

# Mapping of nice labels to (relation_name, optional helper)
EXPLORE_RELATIONS = {
    "Synonymes (r_syn)": "r_syn",
    "Antonymes (r_anto)": "r_anto",
    "Hyperonymes — 'est un' (r_isa)": "r_isa",
    "Hyponymes — 'exemples de' (r_hypo)": "r_hypo",
    "Parties / composants (r_has_part)": "r_has_part",
    "Caractéristiques (r_carac)": "r_carac",
    "Couleurs (r_has_color)": "r_has_color",
    "Lieux typiques (r_lieu)": "r_lieu",
    "Agents typiques (r_agent) — verbe": "r_agent",
    "Patients typiques (r_patient) — verbe": "r_patient",
    "Instruments (r_instr) — verbe": "r_instr",
    "Rôle télique — à quoi sert (r_telic_role)": "r_telic_role",
    "Causes (r_has_causatif)": "r_has_causatif",
    "Conséquences (r_has_conseq)": "r_has_conseq",
    "But (r_but)": "r_but",
    "Manière (r_manner) — verbe / processus": "r_manner",
}


def explore(term: str, relation_label: str, min_weight: float, limit: int) -> tuple[pd.DataFrame, str]:
    if not term.strip():
        return pd.DataFrame(), "Renseigne un terme."
    c = get_client()
    rel_name = EXPLORE_RELATIONS[relation_label]
    rid = c.relation_type_id(rel_name)
    if rid is None:
        return pd.DataFrame(), f"Relation inconnue : {rel_name!r}"

    try:
        res = c.relations_from(term, types_ids=[rid],
                               min_weight=float(min_weight), limit=int(limit))
    except Exception as e:
        return pd.DataFrame(), f"Erreur API JDM : {e}"

    idx = res.node_index()
    rows: list[dict] = []
    for r in sorted(res.relations, key=lambda x: -x.w):
        node = idx.get(r.node2)
        if node is None:
            try:
                node = c.node_by_id(r.node2)
            except Exception:
                continue
        dec = c.decode_node_name(node.name, local_nodes=idx)
        rows.append({
            "source": term,
            "relation": rel_name,
            "target": dec["decoded"],
            "w": round(r.w, 1),
            "target_id (si raffinement)": node.name if dec["is_refinement"] else "",
        })
    if not rows:
        msg = (f"Aucun triplet `{term} | {rel_name} | ?` (w ≥ {min_weight:.0f}). "
               f"Essaie un seuil plus bas, ou un autre terme.")
        return pd.DataFrame(), msg
    df = pd.DataFrame(rows)
    return df, f"{len(rows)} triplet(s) trouvé(s)."


def disambiguate_term(term: str) -> tuple[pd.DataFrame, str]:
    if not term.strip():
        return pd.DataFrame(), "Renseigne un terme polysémique (avocat, souris, police, ...)."
    c = get_client()
    try:
        senses = c.refinements_decoded(term)
    except Exception as e:
        return pd.DataFrame(), f"Erreur : {e}"
    senses.sort(key=lambda s: -s.weight)
    if not senses:
        return pd.DataFrame(), f"Aucun sens raffiné trouvé pour {term!r} (terme probablement monosémique)."
    rows = [
        {"sens (décodé)": s.decoded, "poids": round(s.weight, 1), "id JDM": s.name}
        for s in senses[:30]
    ]
    return pd.DataFrame(rows), f"{len(rows)} sens trouvés."


# ---------- Tab 2: Fact-checker ----------

CLAIM_RELATIONS = [
    "r_isa", "r_hypo", "r_carac", "r_has_color", "r_has_part",
    "r_agent", "r_patient", "r_instr", "r_lieu",
    "r_has_causatif", "r_has_conseq", "r_but", "r_telic_role",
]


def factcheck_one(subject: str, relation: str, object_: str) -> tuple[str, str]:
    if not (subject.strip() and object_.strip()):
        return "—", "Renseigne un sujet et un objet."
    c = get_client()
    claim = Claim(text=f"{subject} | {relation} | {object_}",
                  subject=subject.strip(), relation=relation, object=object_.strip())
    try:
        v = verify_claim(c, claim)
    except Exception as e:
        return "—", f"Erreur : {e}"

    ICONS = {Status.SUPPORTED: "✅", Status.CONTRADICTED: "❌", Status.UNKNOWN: "❓"}
    icon = ICONS[v.status]
    status_md = (f"## {icon} {v.status.value.upper()}\n\n"
                 f"**Confiance** : {v.confidence:.2f}\n\n"
                 f"**Explication** : {v.explanation}")

    lines = []
    if v.evidence_for:
        lines.append("**✓ Évidences en faveur**")
        for e in v.evidence_for:
            lines.append(f"- `{e.source} | {e.relation} | {e.target}` (w = {e.w:.0f})")
    if v.evidence_against:
        lines.append("\n**✗ Évidences contraires**")
        for e in v.evidence_against:
            lines.append(f"- `{e.source} | {e.relation} | {e.target}` (w = {e.w:.0f})")
    return status_md, "\n".join(lines) if lines else "*(aucun triplet cité)*"


# ---------- Tab 3: Agent (HF Inference gratuit OU Anthropic BYOK) ----------

ANTHROPIC_MODELS = {
    "claude-haiku-4-5":   "Claude Haiku 4.5 (BYOK Anthropic, rapide, peu cher)",
    "claude-sonnet-4-5":  "Claude Sonnet 4.5 (BYOK Anthropic, top qualité)",
}
OPENAI_MODELS = {
    "gpt-4o-mini": "GPT-4o mini (BYOK OpenAI, rapide, peu cher)",
    "gpt-4o":      "GPT-4o (BYOK OpenAI, meilleure qualité)",
}
ALL_MODELS = {**ANTHROPIC_MODELS, **OPENAI_MODELS}


def _build_llm(model: str, api_key: str):
    """Instancie le ChatModel selon le modèle choisi.

    - claude-*   → Anthropic via clé visiteur (BYOK, sk-ant-...)
    - gpt-*      → OpenAI via clé visiteur (BYOK, sk-...)

    Lève ValueError avec message utilisateur explicite si la clé manque.
    """
    if model.startswith("claude-"):
        if not api_key.strip():
            raise ValueError(
                "Pour utiliser un modèle Claude, colle ta clé Anthropic "
                "(sk-ant-...) ci-dessus. Crée-en une sur "
                "https://console.anthropic.com/settings/keys — la clé reste "
                "dans ta session, n'est ni sauvegardée ni loggée."
            )
        os.environ["ANTHROPIC_API_KEY"] = api_key.strip()
        from jdm_agent.tools.llm_factory import get_llm
        return get_llm(provider="anthropic", model=model)

    if model.startswith("gpt-"):
        if not api_key.strip():
            raise ValueError(
                "Pour utiliser un modèle GPT, colle ta clé OpenAI (sk-...) "
                "ci-dessus. Crée-en une sur "
                "https://platform.openai.com/api-keys — la clé reste dans "
                "ta session, n'est ni sauvegardée ni loggée."
            )
        os.environ["OPENAI_API_KEY"] = api_key.strip()
        from jdm_agent.tools.llm_factory import get_llm
        return get_llm(provider="openai", model=model)

    raise ValueError(f"Modèle inconnu : {model!r}")


def _history_to_lc(history: list[dict], current_user_message: str) -> list:
    """Convertit l'historique Gradio (format messages) en messages LangChain.

    Filtre les traces de tools / messages vides / erreurs des tours précédents
    pour ne garder que les vraies bulles user/assistant utiles au contexte.
    """
    from langchain_core.messages import AIMessage, HumanMessage

    lc: list = []
    for h in history or []:
        role = h.get("role")
        content = (h.get("content") or "").strip()
        if not content or content.startswith("⚠️") or content.startswith("❌"):
            continue
        if role == "user":
            lc.append(HumanMessage(content=content))
        elif role == "assistant":
            # On nettoie les "Outils JDM appelés" en fin de message pour
            # garder un historique conversationnel propre.
            answer_only = content.split("\n\n---\n*Outils JDM appelés*")[0].strip()
            if answer_only:
                lc.append(AIMessage(content=answer_only))
    lc.append(HumanMessage(content=current_user_message))
    return lc


def chat_with_agent(message: str, history: list[dict], api_key: str, model: str):
    """Générateur de streaming pour ChatInterface.

    Yields la trace progressive (appels d'outils + résultats) puis le message
    final. Chaque yield écrase complètement la dernière bulle assistant.

    Le paramètre `history` est passé à l'agent pour conserver le contexte
    conversationnel (multi-tours).
    """
    if not message.strip():
        yield "Pose une question sur la langue française."
        return
    try:
        llm = _build_llm(model, api_key)
    except ValueError as e:
        yield f"⚠️ {e}"
        return

    from jdm_agent.tools.jdm_agent import build_jdm_agent
    from langchain_core.messages import AIMessage, ToolMessage

    progress_lines: list[str] = ["*🧠 Réflexion en cours…*"]
    tool_traces: list[str] = []
    final_answer = ""

    yield "\n".join(progress_lines)

    try:
        agent = build_jdm_agent(client=get_client(), llm=llm)
        for chunk in agent.stream(
            {"messages": _history_to_lc(history, message)},
            stream_mode="updates",
        ):
            # chunk = dict {node_name: {"messages": [msg, ...]}}
            for _node_name, payload in chunk.items():
                msgs = (payload or {}).get("messages") or []
                for m in msgs:
                    if isinstance(m, AIMessage):
                        tcs = getattr(m, "tool_calls", []) or []
                        if tcs:
                            # L'agent décide d'appeler un ou plusieurs outils
                            for tc in tcs:
                                args = ", ".join(
                                    f"{k}={v!r}" for k, v in (tc.get("args") or {}).items()
                                )
                                line = f"🔧 `{tc['name']}({args})`"
                                progress_lines.append(line)
                                tool_traces.append(f"- `{tc['name']}({args})`")
                            yield "\n".join(progress_lines)
                        else:
                            # Réponse finale du modèle (pas d'autres tool calls)
                            final_answer = m.content or ""
                    elif isinstance(m, ToolMessage):
                        content = (m.content or "")
                        preview = content[:140].replace("\n", " ")
                        if len(content) > 140:
                            preview += "…"
                        progress_lines.append(
                            f"✓ *{m.name}* renvoie {len(content)} chars : `{preview}`"
                        )
                        yield "\n".join(progress_lines)
    except Exception as e:
        yield f"❌ Erreur agent : {e}"
        return

    # Sortie finale : la réponse synthétique + trace condensée des outils
    out = final_answer or "*(réponse vide)*"
    if tool_traces:
        out += "\n\n---\n*Outils JDM appelés* :\n" + "\n".join(tool_traces)
    yield out


# ---------- UI ----------

THEME = gr.themes.Soft(primary_hue="violet", secondary_hue="amber")

INTRO_MD = """# JDMAgent — Démo interactive

Explore, vérifie et enrichis le graphe lexical **JeuxDeMots** (~2 M nœuds, 180+ relations)
sans rien installer.

- **Onglet 1** : explorer le graphe (synonymes, hyperonymes, caractéristiques, etc.)
- **Onglet 2** : vérifier une affirmation factuelle contre JDM (déterministe, sans LLM)
- **Onglet 3** : converser avec un agent Claude qui n'utilise QUE JDM (apporte ta clé Anthropic)

Code source : [expAg/JDMAgent](https://github.com/expAg/JDMAgent) ·
Documentation : [USAGE.md](https://github.com/expAg/JDMAgent/blob/main/USAGE.md)
"""


# ---------- Tab 4: Sous-graphe (visualisation) ----------

import html as _html_mod
import tempfile


def viz_subgraph(term: str, depth: float, top_k: float, selected_relations: list[str]):
    """Construit un sous-graphe et renvoie un iframe HTML + des stats."""
    term = (term or "").strip()
    if not term:
        return "", "⚠️ Saisis un terme."
    rels = selected_relations if selected_relations else None
    try:
        # Écrit dans /tmp (HF Spaces) puis lit le fichier pour le réintégrer
        # dans une iframe srcdoc (rendu autonome, scripts vis-network OK).
        with tempfile.NamedTemporaryFile(
            suffix=".html", delete=False, mode="w", encoding="utf-8"
        ) as tmp:
            out_path = tmp.name
        res = build_subgraph(
            term,
            client=get_client(),
            depth=int(depth),
            top_k_per_relation=int(top_k),
            relations=rels,
            output="html",
            output_path=out_path,
        )
        html_text = Path(res["html_path"]).read_text(encoding="utf-8")
        esc = _html_mod.escape(html_text, quote=True)
        iframe = (
            f'<iframe srcdoc="{esc}" '
            f'style="width:100%;height:700px;border:1px solid #ddd;border-radius:8px;"></iframe>'
        )
        s = res["stats"]
        status = (
            f"✓ **{s['n_nodes']} nœuds**, **{s['n_edges']} arêtes** "
            f"(dont **{s['n_negative']} négations** en rouge) — profondeur {s['depth']}"
        )
        return iframe, status
    except Exception as e:
        return "", f"❌ Erreur : {e}"


with gr.Blocks(theme=THEME, title="JDMAgent Demo") as demo:
    gr.Markdown(INTRO_MD)

    with gr.Tabs():

        # ----- Tab 1: Explorer -----
        with gr.Tab("🔎 Explorer JDM"):
            gr.Markdown(
                "Choisis un **terme** et une **relation**. JDM répond avec les "
                "triplets correspondants, triés par poids `w` (consensus)."
            )
            with gr.Row():
                term_in = gr.Textbox(label="Terme", value="chat",
                                     placeholder="ex: voiture, chat, manger…")
                rel_in = gr.Dropdown(list(EXPLORE_RELATIONS.keys()),
                                     value="Hyperonymes — 'est un' (r_isa)",
                                     label="Relation à explorer")
            with gr.Row():
                mw_in = gr.Slider(0, 500, value=25, step=5, label="Poids min (w ≥)")
                lim_in = gr.Slider(5, 100, value=20, step=5, label="Limite de résultats")
            explore_btn = gr.Button("Explorer", variant="primary")
            explore_status = gr.Markdown()
            explore_df = gr.Dataframe(label="Triplets trouvés",
                                       headers=["source", "relation", "target", "w", "target_id (si raffinement)"],
                                       interactive=False)
            explore_btn.click(explore,
                               inputs=[term_in, rel_in, mw_in, lim_in],
                               outputs=[explore_df, explore_status])

            gr.Markdown("---\n### Désambiguïsation des termes polysémiques")
            gr.Markdown(
                "Pour un mot ayant plusieurs sens (avocat, souris, police…), "
                "JDM stocke des **raffinements** : on les décode automatiquement "
                "en français lisible."
            )
            with gr.Row():
                dis_in = gr.Textbox(label="Terme polysémique", value="avocat",
                                    placeholder="ex: avocat, souris, police, chat…")
                dis_btn = gr.Button("Désambiguïser", variant="secondary")
            dis_status = gr.Markdown()
            dis_df = gr.Dataframe(label="Sens trouvés",
                                   headers=["sens (décodé)", "poids", "id JDM"],
                                   interactive=False)
            dis_btn.click(disambiguate_term, inputs=[dis_in],
                          outputs=[dis_df, dis_status])

        # ----- Tab 2: Fact-checker -----
        with gr.Tab("⚖️ Fact-checker"):
            gr.Markdown(
                "Vérifie une affirmation factuelle contre JDM. La vérification est "
                "**déterministe** (pas de LLM) — basée sur les triplets réellement "
                "présents dans le graphe + détection des incompatibilités explicites."
            )
            with gr.Row():
                fc_subject = gr.Textbox(label="Sujet", value="baleine",
                                        placeholder="ex: baleine, sang, voiture…")
                fc_relation = gr.Dropdown(CLAIM_RELATIONS, value="r_isa", label="Relation")
                fc_object = gr.Textbox(label="Objet / Cible", value="poisson",
                                       placeholder="ex: poisson, rouge, roue…")
            fc_btn = gr.Button("Vérifier", variant="primary")
            fc_status = gr.Markdown()
            fc_evidence = gr.Markdown()
            fc_btn.click(factcheck_one,
                         inputs=[fc_subject, fc_relation, fc_object],
                         outputs=[fc_status, fc_evidence])
            gr.Examples(
                examples=[
                    ["baleine", "r_isa", "poisson"],
                    ["chat", "r_isa", "mammifère"],
                    ["sang", "r_has_color", "rouge"],
                    ["voiture", "r_has_part", "roue"],
                    ["couteau", "r_telic_role", "couper"],
                    ["saumon", "r_isa", "mammifère"],
                ],
                inputs=[fc_subject, fc_relation, fc_object],
            )

        # ----- Tab 3: Sous-graphe (visualisation interactive) -----
        with gr.Tab("🕸️ Sous-graphe"):
            gr.Markdown(
                "Visualise le voisinage sémantique d'un terme dans JDM en graphe "
                "interactif (vis-network). Le nœud central est fixé ; les voisins "
                "directs sont colorés par type de relation, ceux de profondeur 2 "
                "en gris pointillés. **Les négations (poids négatif) apparaissent "
                "en rouge** et préfixées « NON » — JDM affirme explicitement que "
                "ce triplet est faux."
            )
            with gr.Row():
                viz_term = gr.Textbox(label="Terme racine", value="plat asiatique",
                                      placeholder="ex: chat, polyphonie, voiture…",
                                      scale=3)
                viz_depth = gr.Slider(1, 3, value=2, step=1, label="Profondeur",
                                      scale=1)
                viz_topk = gr.Slider(3, 12, value=6, step=1,
                                     label="Top-K par relation", scale=1)
            viz_relations = gr.CheckboxGroup(
                choices=DEFAULT_RELATIONS,
                value=DEFAULT_RELATIONS,
                label="Relations explorées (profondeur 1)",
            )
            viz_btn = gr.Button("Construire le sous-graphe", variant="primary")
            viz_status = gr.Markdown()
            viz_out = gr.HTML(label="Visualisation")
            viz_btn.click(
                viz_subgraph,
                inputs=[viz_term, viz_depth, viz_topk, viz_relations],
                outputs=[viz_out, viz_status],
            )
            gr.Examples(
                examples=[
                    ["plat asiatique", 2, 6],
                    ["polyphonie", 2, 6],
                    ["chat", 1, 8],
                    ["voiture", 2, 5],
                ],
                inputs=[viz_term, viz_depth, viz_topk],
            )

        # ----- Tab 4: Agent (BYOK Anthropic / OpenAI) -----
        with gr.Tab("🤖 Agent"):
            gr.Markdown(
                "Discute avec un agent qui n'utilise QUE les outils JDM "
                "pour répondre. Chaque réponse cite ses triplets sources.\n\n"
                "**Apporte ta propre clé** (BYOK — Bring Your Own Key) :\n"
                "- 💳 **Anthropic Claude** — clé sur "
                "[console.anthropic.com](https://console.anthropic.com/settings/keys). "
                "Rapide, top qualité, ~0.05–0.30 $ par session.\n"
                "- 💳 **OpenAI GPT** — clé sur "
                "[platform.openai.com](https://platform.openai.com/api-keys). "
                "Function-calling très mature, ~0.01–0.10 $ par session avec gpt-4o-mini.\n\n"
                "*La clé reste en session, n'est ni sauvegardée ni loggée. "
                "Tu paies uniquement ton propre usage chez le provider choisi.*\n\n"
                "💡 *Tu peux aussi explorer JDM sans clé dans les onglets "
                "**Explorer** et **Fact-checker** — ils n'utilisent aucun LLM.*"
            )
            with gr.Row():
                key_in = gr.Textbox(
                    label="Clé API (Anthropic sk-ant-... ou OpenAI sk-...)",
                    type="password",
                    placeholder="sk-ant-... ou sk-...",
                    scale=3,
                )
                model_in = gr.Dropdown(
                    choices=[(label, key) for key, label in ALL_MODELS.items()],
                    value="claude-haiku-4-5",
                    label="Modèle",
                    info="claude-* = BYOK Anthropic · gpt-* = BYOK OpenAI",
                    scale=2,
                )
            chat = gr.ChatInterface(
                fn=chat_with_agent,
                additional_inputs=[key_in, model_in],
                # Chatbot agrandi : 600 px de haut au lieu du défaut (~360 px).
                # Les exemples sous l'input deviennent visibles en scrollant.
                chatbot=gr.Chatbot(
                    height=600,
                    type="messages",
                    show_label=False,
                    avatar_images=(None, None),
                ),
                # Avec additional_inputs, chaque exemple = liste alignée sur
                # [message, key, model]. La clé reste vide pour les exemples ;
                # sans clé, l'utilisateur aura le message d'erreur informatif.
                examples=[
                    ["Quels sont les synonymes de voiture ?", "", "claude-haiku-4-5"],
                    ["Le saumon est-il un mammifère selon JDM ?", "", "claude-haiku-4-5"],
                    ["Pour le sens juridique de 'avocat', donne-moi 5 synonymes.", "", "claude-haiku-4-5"],
                    ["Que peut faire un chat ?", "", "claude-haiku-4-5"],
                    ["Quelles sont les composantes typiques d'un smartphone ?", "", "claude-haiku-4-5"],
                ],
                cache_examples=False,
                type="messages",
            )

    gr.Markdown(
        "---\n*Données : [JeuxDeMots](https://www.jeuxdemots.org) — "
        "M. Lafourcade, équipe TEXTE, LIRMM/CNRS. "
        "Projet open-source : [GitHub](https://github.com/expAg/JDMAgent).*"
    )


if __name__ == "__main__":
    # HF Spaces : bind explicite sur 0.0.0.0 (sinon Gradio essaye localhost
    # qui n'est pas joignable dans le conteneur) et port standard 7860.
    demo.launch(server_name="0.0.0.0", server_port=7860)
