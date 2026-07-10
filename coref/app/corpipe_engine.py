"""Moteur CorPipe 25 résident : charge le modèle UNE fois, prédit à la demande.

CorPipe 25 (ÚFAL, vainqueur CRAC 2025) — SOTA multilingue/français de coréférence.
On réutilise les classes du script de recherche `corpipe25.py` sans relancer son `main()`
(donc sans recharger mT5-large à chaque appel).
"""
import json
import os
import sys
import argparse
from functools import lru_cache

import huggingface_hub
import torch

# Le script de recherche se trouve dans corpipe/ (un cran au-dessus de app/)
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_CORPIPE_DIR = os.path.join(_ROOT, "corpipe")
if _CORPIPE_DIR not in sys.path:
    sys.path.insert(0, _CORPIPE_DIR)

import minnt          # noqa: E402
import transformers   # noqa: E402
import corpipe25 as cp  # noqa: E402  (script CorPipe 25)

MODEL_ID = "ufal/corpipe25-corefud1.3-large-251101"
OUT_DIR = os.path.join(_CORPIPE_DIR, "serve")
SEED, THREADS = 42, 4


@lru_cache(maxsize=1)
def _engine():
    """Charge tokenizer + modèle CorPipe (mT5-large) une seule fois."""
    print("[coref] chargement du moteur CorPipe (premier appel, one-time)…", flush=True)
    os.makedirs(OUT_DIR, exist_ok=True)
    minnt.startup(SEED, THREADS)

    # Récupère le checkpoint + sa configuration d'entraînement (comme dans main())
    print(f"[coref] récupération du checkpoint {MODEL_ID} (téléchargement si absent)…", flush=True)
    path = MODEL_ID if os.path.exists(MODEL_ID) else huggingface_hub.snapshot_download(MODEL_ID)
    print(f"[coref] checkpoint prêt : {path}", flush=True)
    with open(os.path.join(path, "options.json")) as f:
        opts = {k: v for k, v in json.load(f).items()
                if k in ["batch_size", "depth", "encoder", "right", "segment", "treebanks"]}
    args = argparse.Namespace(**opts)
    args = cp.parser.parse_args(["--exp", OUT_DIR], namespace=args)
    args.load = [path]
    args.logdir = OUT_DIR

    # Tokenizer (les modèles mT5 partagent le tokenizer mt5-xl)
    enc = args.encoder
    tok_name = ("google/mt5-xl" if "mt5" in enc else
                "google/umt5-xl" if "umt5" in enc else
                "google/t5gemma-l-l-ul2" if "t5gemma" in enc else enc)
    tokenizer = transformers.AutoTokenizer.from_pretrained(tok_name, legacy=False)
    tokenizer.add_special_tokens({"additional_special_tokens":
        [cp.Dataset.TOKEN_EMPTY] + ([cp.Dataset.TOKEN_CLS] if tokenizer.cls_token_id is None else [])})

    with open(os.path.join(path, "tags.txt")) as f:
        tags = [ln.rstrip("\r\n") for ln in f]
    tags_map = {t: i for i, t in enumerate(tags)}

    print("[coref] construction du modèle + chargement des poids (RAM CPU)…", flush=True)
    model = cp.Model(tokenizer, tags, args)
    model.load_weights(os.path.join(path, "model.pt"))
    print("[coref] moteur CorPipe prêt.", flush=True)
    return model, tokenizer, tags_map, args


def _warmup():
    """Force le chargement du modèle (utile pour un warm-up au démarrage)."""
    _engine()


def predict_conllu(in_conllu_path: str) -> str:
    """Annote un fichier CoNLL-U avec la coréférence ; renvoie le chemin de sortie."""
    model, tokenizer, tags_map, args = _engine()
    test = cp.Dataset(in_conllu_path, tokenizer)
    loader = torch.utils.data.DataLoader(
        test.dataset(tags_map, False, args),
        batch_size=args.batch_size,
        collate_fn=cp.Dataset.padded_batch(False),
    )
    model.process(0, [(test, loader)], evaluate=False)
    base = os.path.splitext(os.path.basename(in_conllu_path))[0]
    return os.path.join(OUT_DIR, f"{base}.00.conllu")
