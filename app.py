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

# Force le cache disque dans /tmp/jdm_cache : sur HF Spaces le CWD (/app)
# est monté en read-only ou avec un overlay qui fait silencieusement échouer
# les écritures diskcache → chaque requête refait l'aller-retour HTTP.
# /tmp est toujours writable et persistant pendant toute la durée de vie
# du conteneur (les requêtes successives partagent donc le cache).
os.environ.setdefault("JDM_CACHE_DIR", "/tmp/jdm_cache")

import gradio as gr
import pandas as pd

from jdm_agent.client import JDMClient
from jdm_agent.factcheck import Claim, verify_claim
from jdm_agent.factcheck.models import Status
from jdm_agent.viz import (
    DEFAULT_DEPTH2_RELATIONS,
    DEFAULT_DEPTH3_RELATIONS,
    DEFAULT_DEPTH4_RELATIONS,
    DEFAULT_RELATIONS,
    build_subgraph,
)


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


def explore(term: str, relation_label: str, min_weight: float,
            limit: int, with_annotations: bool) -> tuple[pd.DataFrame, str]:
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
        # Annotations sémantiques (constitutif, contrastif, exception, ...)
        # fetchées à la demande — N+1 HTTP par relation, mais elles sont
        # cachées par diskcache.
        annot_str = ""
        if with_annotations:
            try:
                anns = c.get_annotations_for_triplet(r.id)
                if anns:
                    annot_str = " ; ".join(
                        f"{a.value} (w={int(round(a.w))})" for a in anns
                    )
            except Exception:
                annot_str = ""
        rows.append({
            "source": term,
            "relation": rel_name,
            "target": dec["decoded"],
            "w": round(r.w, 1),
            "annotations": annot_str,
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


# Régimes de vérification proposés à l'utilisateur (effort du moteur).
EFFORT_CHOICES = {
    "0 — Contenance (JDM contient-il ?)": 0,
    "1 — + inférence (noyau)": 1,
    "2 — + inférence (complète)": 2,
}


def factcheck_one(subject: str, relation: str, object_: str,
                  effort_label: str, bypass: bool) -> tuple[str, str]:
    if not (subject.strip() and object_.strip()):
        return "—", "Renseigne un sujet et un objet."
    effort = EFFORT_CHOICES.get(effort_label, 0)
    c = get_client()
    claim = Claim(text=f"{subject} | {relation} | {object_}",
                  subject=subject.strip(), relation=relation, object=object_.strip())
    try:
        v = verify_claim(c, claim, effort=effort, bypass_containment=bool(bypass))
    except Exception as e:
        return "—", f"Erreur : {e}"

    ICONS = {Status.SUPPORTED: "✅", Status.CONTRADICTED: "❌", Status.UNKNOWN: "❓"}
    icon = ICONS[v.status]
    # Origine du verdict : contenance directe ou inférence.
    if v.inference_schema:
        origin = f"🧠 *Verdict obtenu par **inférence** (schéma `{v.inference_schema}`)*"
    elif v.status != Status.UNKNOWN:
        origin = "📦 *Verdict obtenu par **contenance directe** dans JDM*"
    else:
        origin = ""
    status_md = (f"## {icon} {v.status.value.upper()}\n\n"
                 f"{origin}\n\n"
                 f"**Confiance** : {v.confidence:.2f}\n\n"
                 f"**Explication** : {v.explanation}")

    lines = []
    # Chaîne de preuve de l'inférence (« oui/non parce que … »).
    if v.inference_proof:
        lines.append("**🔗 Chaîne de déduction**")
        for e in v.inference_proof:
            lines.append(f"- `{e.source} | {e.relation} | {e.target}` (w = {e.w:.0f})")
        lines.append("")
    if v.evidence_for and not v.inference_proof:
        lines.append("**✓ Évidences en faveur**")
        for e in v.evidence_for:
            lines.append(f"- `{e.source} | {e.relation} | {e.target}` (w = {e.w:.0f})")
    if v.evidence_against and not v.inference_proof:
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

PROJET_MD = """# JDMAgent — Démo interactive

Explore, vérifie, visualise et enrichis le graphe lexico-sémantique
**JeuxDeMots** (LIRMM/CNRS, ~2 M nœuds, 180+ relations) sans rien installer.

## Que peux-tu faire dans cette démo ?

- **🔎 Explorer JDM** — choisis un terme et une relation, vois les triplets
  correspondants triés par poids consensuel. Annotations sémantiques
  (constitutif, contrastif, exception, …) optionnelles. Désambiguïsation
  des termes polysémiques (avocat, souris, police…).
- **⚖️ Claim checker** — vérifie une affirmation factuelle contre JDM de
  façon **déterministe** (sans LLM) : SUPPORTED / CONTRADICTED / UNKNOWN
  avec citations des triplets utilisés.
- **🕸️ Sous-graphe** — visualisation interactive (vis-network) du
  voisinage sémantique d'un terme, jusqu'à profondeur 4, sélection de
  relations indépendante par niveau, négations en rouge.
- **🤖 Agent** — conversation avec un agent (Claude ou GPT, BYOK) qui
  n'utilise QUE les outils JDM et cite ses sources.

## Le projet en bref

- Couche client typée (`JDMClient`) sur l'[API JeuxDeMots](https://jdm-api.demo.lirmm.fr)
  + cache disque + retry exponentiel.
- 30 outils MCP exposés à n'importe quel client (Claude Code/Desktop,
  Cursor, etc.) via [FastMCP](https://github.com/jlowin/fastmcp).
- Pipeline fact-check déterministe + détection de gaps + proposition
  LLM de triplets candidats (toujours en lecture seule sur JDM).
- Visualisation sous-graphe HTML autonome (vis-network) avec sélection
  de relations par niveau, palette par famille de relation et opacité
  progressive.

**Données** : JeuxDeMots — Mathieu Lafourcade, équipe TEXTE, LIRMM/CNRS.

**Liens** :
[Code source](https://github.com/expAg/JDMAgent) ·
[USAGE.md](https://github.com/expAg/JDMAgent/blob/main/USAGE.md) ·
[Notebook Colab](https://colab.research.google.com/github/expAg/JDMAgent/blob/main/notebooks/demo.ipynb)
"""


# ---------- Tab 4: Sous-graphe (visualisation) ----------

import base64 as _b64
import tempfile

# Répertoire des sous-graphes produits — autorisé en lecture par Gradio
# (cf. demo.launch(allowed_paths=[VIZ_DIR])).
VIZ_DIR = Path(tempfile.gettempdir()) / "jdm_viz"
VIZ_DIR.mkdir(parents=True, exist_ok=True)


def viz_subgraph(term: str, depth: float,
                 top_k: float, top_k_d2: float, top_k_d3: float, top_k_d4: float,
                 selected_relations: list[str],
                 selected_depth2_relations: list[str],
                 selected_depth3_relations: list[str],
                 selected_depth4_relations: list[str]):
    """Construit un sous-graphe et renvoie (status, html_inline, file_for_download).

    Stratégie multi-fallback :
    - **HTML inline** via iframe data:base64 (marche si DOMPurify autorise data:)
    - **Téléchargement** du même fichier via gr.File (toujours dispo, plan B sûr)
    - Logs côté serveur (visibles dans HF Spaces) pour diagnostic en cas d'écran blanc.
    """
    term = (term or "").strip()
    if not term:
        return "⚠️ Saisis un terme.", "", None
    rels = selected_relations if selected_relations else None
    d2_rels = selected_depth2_relations if selected_depth2_relations else None
    d3_rels = selected_depth3_relations if selected_depth3_relations else None
    d4_rels = selected_depth4_relations if selected_depth4_relations else None
    try:
        cache_key = (term, depth, top_k, top_k_d2, top_k_d3, top_k_d4,
                     tuple(rels or ()), tuple(d2_rels or ()),
                     tuple(d3_rels or ()), tuple(d4_rels or ()))
        out_path = VIZ_DIR / f"viz_{abs(hash(cache_key)) % 10**8}.html"
        print(f"[viz] term={term!r} depth={depth} "
              f"top_k=[{top_k},{top_k_d2},{top_k_d3},{top_k_d4}] "
              f"rels={rels} d2={d2_rels} d3={d3_rels} d4={d4_rels}", flush=True)
        res = build_subgraph(
            term,
            client=get_client(),
            depth=int(depth),
            top_k_per_relation=int(top_k),
            top_k_depth2=int(top_k_d2),
            top_k_depth3=int(top_k_d3),
            top_k_depth4=int(top_k_d4),
            relations=rels,
            depth2_relations=d2_rels,
            depth3_relations=d3_rels,
            depth4_relations=d4_rels,
            output="html",
            output_path=str(out_path),
        )
        s = res["stats"]
        print(f"[viz] generated {s['n_nodes']} nodes / {s['n_edges']} edges -> {out_path}",
              flush=True)
        html_text = out_path.read_text(encoding="utf-8")
        b64 = _b64.b64encode(html_text.encode("utf-8")).decode("ascii")
        iframe = (
            f'<iframe src="data:text/html;base64,{b64}" '
            f'style="width:100%;height:910px;border:1px solid #ddd;'
            f'border-radius:8px;background:#fff;display:block;" '
            f'sandbox="allow-scripts allow-same-origin"></iframe>'
        )
        status = (
            f"✅ **{s['n_nodes']} nœuds**, **{s['n_edges']} arêtes** "
            f"(dont **{s['n_negative']} négations** en rouge) — profondeur {s['depth']}.\n\n"
            f"*Si le graphe ne s'affiche pas inline ci-dessous, "
            f"télécharge le fichier HTML et ouvre-le dans ton navigateur.*"
        )
        return status, iframe, str(out_path)
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        print(f"[viz] ERROR: {e}\n{tb}", flush=True)
        return f"❌ Erreur : {e}\n\n```\n{tb}\n```", "", None


with gr.Blocks(theme=THEME, title="JDMAgent Demo") as demo:

    with gr.Tabs():

        # ----- Tab 0: Projet (description et liens) -----
        with gr.Tab("📋 Projet"):
            gr.Markdown(PROJET_MD)

        # ----- Tab 1: Explorer -----
        with gr.Tab("🔎 Explorer JDM"):
            with gr.Row():
                term_in = gr.Textbox(label="Terme", value="chat",
                                     placeholder="ex: voiture, chat, manger…")
                rel_in = gr.Dropdown(list(EXPLORE_RELATIONS.keys()),
                                     value="Hyperonymes — 'est un' (r_isa)",
                                     label="Relation à explorer")
            with gr.Row():
                mw_in = gr.Slider(0, 1000, value=25, step=5, label="Poids min (w ≥)")
                lim_in = gr.Slider(5, 100, value=20, step=5, label="Limite de résultats")
                annot_in = gr.Checkbox(value=True, label="Inclure les annotations")
            explore_btn = gr.Button("Explorer", variant="primary")
            explore_status = gr.Markdown()
            explore_df = gr.Dataframe(
                label="Triplets trouvés",
                headers=["source", "relation", "target", "w", "annotations", "target_id (si raffinement)"],
                interactive=False,
            )
            explore_btn.click(explore,
                               inputs=[term_in, rel_in, mw_in, lim_in, annot_in],
                               outputs=[explore_df, explore_status])

            gr.Markdown("---\n### Désambiguïsation des termes polysémiques")
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

        # ----- Tab 2: Claim checker -----
        with gr.Tab("⚖️ Claim checker"):
            with gr.Row():
                fc_subject = gr.Textbox(label="Sujet", value="baleine",
                                        placeholder="ex: baleine, sang, voiture…")
                fc_relation = gr.Dropdown(CLAIM_RELATIONS, value="r_isa", label="Relation")
                fc_object = gr.Textbox(label="Objet / Cible", value="poisson",
                                       placeholder="ex: poisson, rouge, roue…")
            fc_effort = gr.Radio(
                choices=list(EFFORT_CHOICES.keys()),
                value="0 — Contenance (JDM contient-il ?)",
                label="Régime de vérification",
                info="Contenance = JDM contient-il littéralement le triplet ? "
                     "Inférence = peut-on le déduire du réseau si JDM est silencieux ?",
            )
            fc_bypass = gr.Checkbox(
                value=False,
                label="Forcer l'inférence même si le triplet est déjà dans JDM",
                info="Bypass de la contenance : montre la chaîne de déduction "
                     "d'un fait pourtant déjà connu (effort ≥ 1 requis).",
            )
            fc_btn = gr.Button("Vérifier", variant="primary")
            fc_status = gr.Markdown()
            fc_evidence = gr.Markdown()
            fc_btn.click(factcheck_one,
                         inputs=[fc_subject, fc_relation, fc_object, fc_effort, fc_bypass],
                         outputs=[fc_status, fc_evidence])
            gr.Examples(
                examples=[
                    ["baleine", "r_isa", "poisson", "0 — Contenance (JDM contient-il ?)"],
                    ["chat", "r_isa", "mammifère", "0 — Contenance (JDM contient-il ?)"],
                    ["sang", "r_has_color", "rouge", "0 — Contenance (JDM contient-il ?)"],
                    ["baleine", "r_isa", "poisson", "1 — + inférence (noyau)"],
                    ["couteau", "r_telic_role", "couper", "1 — + inférence (noyau)"],
                    ["saumon", "r_isa", "mammifère", "1 — + inférence (noyau)"],
                ],
                inputs=[fc_subject, fc_relation, fc_object, fc_effort],
            )

        # ----- Tab 3: Sous-graphe (visualisation interactive) -----
        with gr.Tab("🕸️ Sous-graphe"):
            with gr.Row():
                viz_term = gr.Textbox(label="Terme racine", value="plat asiatique",
                                      placeholder="ex: chat, polyphonie, voiture…",
                                      scale=3)
                viz_depth = gr.Slider(1, 4, value=1, step=1, label="Profondeur",
                                      scale=1)
            # Palette commune à cocher pour les 4 niveaux. Par défaut le
            # même top-K (3) partout ; l'utilisateur peut le tordre par
            # niveau (utile pour ne pas exploser au-delà du 1er anneau).
            _ALL_REL_CHOICES = DEFAULT_RELATIONS + [
                r for r in ("r_syn", "r_anto", "r_patient-1", "r_agent-1", "r_associated")
                if r not in DEFAULT_RELATIONS
            ]
            _DEFAULT_TOPK = 3
            # Sélection de relations + top-K par niveau — repliée par défaut.
            # Les rangées des niveaux 2/3/4 ne sont visibles que si la
            # profondeur sélectionnée les atteint (cf. viz_depth.change).
            with gr.Accordion("⚙️ Réglages par niveau (top-K + relations)",
                              open=False):
                # Niveau 1 — toujours visible (min depth = 1).
                with gr.Row():
                    viz_topk = gr.Slider(1, 15, value=_DEFAULT_TOPK, step=1,
                                         label="Top-K niveau 1")
                viz_relations = gr.CheckboxGroup(
                    choices=_ALL_REL_CHOICES,
                    value=DEFAULT_RELATIONS,
                    label="Niveau 1 — voisins directs du terme",
                )
                # Niveau 2 — visible si profondeur ≥ 2.
                with gr.Group(visible=False) as viz_level2_group:
                    with gr.Row():
                        viz_topk_d2 = gr.Slider(1, 15, value=_DEFAULT_TOPK, step=1,
                                                label="Top-K niveau 2")
                    viz_depth2_relations = gr.CheckboxGroup(
                        choices=_ALL_REL_CHOICES,
                        value=DEFAULT_DEPTH2_RELATIONS,
                        label="Niveau 2 — voisins de voisins",
                    )
                # Niveau 3 — visible si profondeur ≥ 3.
                with gr.Group(visible=False) as viz_level3_group:
                    with gr.Row():
                        viz_topk_d3 = gr.Slider(1, 15, value=_DEFAULT_TOPK, step=1,
                                                label="Top-K niveau 3")
                    viz_depth3_relations = gr.CheckboxGroup(
                        choices=_ALL_REL_CHOICES,
                        value=DEFAULT_DEPTH3_RELATIONS,
                        label="Niveau 3",
                    )
                # Niveau 4 — visible si profondeur = 4.
                with gr.Group(visible=False) as viz_level4_group:
                    with gr.Row():
                        viz_topk_d4 = gr.Slider(1, 15, value=_DEFAULT_TOPK, step=1,
                                                label="Top-K niveau 4")
                    viz_depth4_relations = gr.CheckboxGroup(
                        choices=_ALL_REL_CHOICES,
                        value=DEFAULT_DEPTH4_RELATIONS,
                        label="Niveau 4 (déconseillé sauf cas ciblé)",
                    )

            # Wire visibility : afficher seulement les niveaux ≤ profondeur.
            def _update_levels_visibility(d):
                d = int(d)
                return (
                    gr.update(visible=d >= 2),
                    gr.update(visible=d >= 3),
                    gr.update(visible=d >= 4),
                )

            viz_depth.change(
                _update_levels_visibility,
                inputs=[viz_depth],
                outputs=[viz_level2_group, viz_level3_group, viz_level4_group],
            )
            viz_btn = gr.Button("Construire le sous-graphe", variant="primary")
            viz_status = gr.Markdown()
            viz_file = gr.File(label="Télécharger le HTML interactif",
                               interactive=False)
            # elem_id pour pouvoir scroller vers cette zone après génération.
            viz_out = gr.HTML(label="Visualisation (inline)", elem_id="viz-output")
            # Gradio 5 : le paramètre js= sur .click() s'exécute AVANT fn
            # (sa valeur de retour remplace les inputs). Pour lancer du JS
            # APRÈS la génération, on chaîne via .then() avec fn=None.
            _scroll_js = (
                "() => { setTimeout(() => { "
                "const el = document.getElementById('viz-output'); "
                "if (el) el.scrollIntoView({behavior:'smooth', block:'start'}); "
                "}, 100); }"
            )
            viz_btn.click(
                viz_subgraph,
                inputs=[viz_term, viz_depth,
                        viz_topk, viz_topk_d2, viz_topk_d3, viz_topk_d4,
                        viz_relations, viz_depth2_relations,
                        viz_depth3_relations, viz_depth4_relations],
                outputs=[viz_status, viz_out, viz_file],
            ).then(fn=None, inputs=None, outputs=None, js=_scroll_js)

        # ----- Tab 4: Agent (BYOK Anthropic / OpenAI) -----
        with gr.Tab("🤖 Agent"):
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
    # ssr_mode=False : désactive le rendu côté serveur de Gradio 5. Sinon
    # Gradio tente un health-check sur localhost qui échoue dans le conteneur
    # HF Spaces ("When localhost is not accessible, a shareable link must be
    # created"). On garde le rendu client classique, ça marche partout.
    demo.launch(server_name="0.0.0.0", server_port=7860,
                allowed_paths=[str(VIZ_DIR)],
                ssr_mode=False)
