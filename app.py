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

# Modèles HF gratuits (utilisent HF_TOKEN du Space — visiteur n'a rien à fournir).
# Prefix "hf:" pour router dans chat_with_agent. Tool-calling supporté.
HF_MODELS = {
    "hf:meta-llama/Llama-3.3-70B-Instruct":
        "Llama 3.3 70B (HF, gratuit, ~5-15s/tour)",
    "hf:Qwen/Qwen2.5-72B-Instruct":
        "Qwen 2.5 72B (HF, gratuit, ~5-15s/tour)",
}
ANTHROPIC_MODELS = {
    "claude-haiku-4-5":   "Claude Haiku 4.5 (BYOK, ~2-4s/tour)",
    "claude-sonnet-4-5":  "Claude Sonnet 4.5 (BYOK, top qualité)",
}
ALL_MODELS = {**HF_MODELS, **ANTHROPIC_MODELS}


def _build_llm(model: str, anthropic_key: str):
    """Instancie le ChatModel selon le modèle choisi.

    - hf:* → HuggingFace Inference API via HF_TOKEN (env var du Space)
    - claude-* → Anthropic via clé visiteur (BYOK)
    Lève ValueError avec message utilisateur explicite si pré-requis manquant.
    """
    if model.startswith("hf:"):
        if not os.environ.get("HF_TOKEN"):
            raise ValueError(
                "Le secret `HF_TOKEN` n'est pas configuré côté Space. "
                "L'option HF gratuite n'est pas disponible. "
                "Utilise une clé Anthropic, ou demande au propriétaire du "
                "Space d'ajouter un HF_TOKEN dans Settings → Variables and secrets."
            )
        repo_id = model.split(":", 1)[1]
        from langchain_huggingface import ChatHuggingFace, HuggingFaceEndpoint
        endpoint = HuggingFaceEndpoint(
            repo_id=repo_id,
            task="text-generation",
            huggingfacehub_api_token=os.environ["HF_TOKEN"],
            max_new_tokens=1024,
            temperature=0.0,
        )
        return ChatHuggingFace(llm=endpoint)

    # Sinon : Anthropic BYOK
    if not anthropic_key.strip():
        raise ValueError(
            "Pour utiliser un modèle Claude, colle ta clé Anthropic ci-dessus. "
            "Tu peux en créer une (gratuit à créer, paiement à l'usage) sur "
            "https://console.anthropic.com/settings/keys — la clé reste dans "
            "ta session, n'est ni sauvegardée ni loggée."
        )
    os.environ["ANTHROPIC_API_KEY"] = anthropic_key.strip()
    from jdm_agent.tools.llm_factory import get_llm
    return get_llm(provider="anthropic", model=model)


def chat_with_agent(message: str, history: list[dict], api_key: str, model: str) -> str:
    if not message.strip():
        return "Pose une question sur la langue française."
    try:
        llm = _build_llm(model, api_key)
    except ValueError as e:
        return f"⚠️ {e}"
    try:
        from jdm_agent.tools.jdm_agent import build_jdm_agent, ask
        agent = build_jdm_agent(client=get_client(), llm=llm)
        out = ask(agent, message)
        answer = out["answer"]
        tool_calls = out.get("tool_calls") or []
        if tool_calls:
            trace = "\n\n---\n*Outils JDM appelés* :"
            for tc in tool_calls:
                args = ", ".join(f"{k}={v!r}" for k, v in (tc.get("args") or {}).items())
                trace += f"\n- `{tc['name']}({args})`"
            return answer + trace
        return answer
    except Exception as e:
        return f"❌ Erreur agent : {e}"


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

        # ----- Tab 3: Agent (HF gratuit OU Anthropic BYOK) -----
        with gr.Tab("🤖 Agent"):
            gr.Markdown(
                "Discute avec un agent qui n'utilise QUE les outils JDM "
                "pour répondre. Chaque réponse cite ses triplets sources.\n\n"
                "**Deux options de modèle** :\n"
                "- 🆓 **HF Inference** (Llama 3.3, Qwen 2.5) — *gratuit*, "
                "utilise le quota d'inférence du Space (aucune clé visiteur). "
                "Légèrement plus lent (~5-15 s/tour).\n"
                "- 💳 **Anthropic Claude** — *BYOK* (Bring Your Own Key). "
                "Crée une clé sur "
                "[console.anthropic.com](https://console.anthropic.com/settings/keys) "
                "et colle-la ci-dessous. Plus rapide / meilleure qualité. "
                "La clé reste en session, n'est ni sauvegardée ni loggée."
            )
            with gr.Row():
                key_in = gr.Textbox(
                    label="Clé API Anthropic (requise seulement pour les modèles Claude)",
                    type="password", placeholder="sk-ant-... (optionnel si tu choisis HF)",
                    scale=3,
                )
                model_in = gr.Dropdown(
                    choices=[(label, key) for key, label in ALL_MODELS.items()],
                    value="hf:meta-llama/Llama-3.3-70B-Instruct",
                    label="Modèle",
                    info="hf:* = gratuit ; claude-* = BYOK Anthropic",
                    scale=2,
                )
            chat = gr.ChatInterface(
                fn=chat_with_agent,
                additional_inputs=[key_in, model_in],
                # Avec additional_inputs, chaque exemple = liste alignée sur
                # [message, key, model]. La clé reste vide ; clique sur un
                # exemple sans clé renverra le message "colle ta clé".
                # Exemples avec modèle HF gratuit par défaut (clé vide OK)
                examples=[
                    ["Quels sont les synonymes de voiture ?", "", "hf:meta-llama/Llama-3.3-70B-Instruct"],
                    ["Le saumon est-il un mammifère selon JDM ?", "", "hf:meta-llama/Llama-3.3-70B-Instruct"],
                    ["Pour le sens juridique de 'avocat', donne-moi 5 synonymes.", "", "hf:meta-llama/Llama-3.3-70B-Instruct"],
                    ["Que peut faire un chat ?", "", "hf:meta-llama/Llama-3.3-70B-Instruct"],
                    ["Quelles sont les composantes typiques d'un smartphone ?", "", "hf:meta-llama/Llama-3.3-70B-Instruct"],
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
