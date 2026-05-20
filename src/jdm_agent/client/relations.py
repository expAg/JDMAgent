"""Parseur de `relation_definitions.md` (cp1252) — référence éditoriale des
relations JDM, enrichie manuellement.

Permet d'injecter une description naturelle + des exemples dans les docstrings
des tools LangChain, pour aider l'agent à choisir la bonne relation.

Format attendu (préservé strictement) :

    ### Display Name (`r_xxx`)
    Description sur une ou plusieurs lignes.
    * source | r_xxx | cible
    * source | r_xxx | cible
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


@dataclass(frozen=True)
class RelationDoc:
    code: str                 # ex. "r_syn"
    display_name: str         # ex. "Synonym"
    description: str
    examples: tuple[tuple[str, str, str], ...] = field(default_factory=tuple)


_HEADER_RE = re.compile(r"^###\s+(?P<title>.+?)\s*\(`(?P<code>r_[A-Za-z0-9_>\-/]+)`\)\s*$")
_EXAMPLE_RE = re.compile(r"^\*\s+(?P<a>.+?)\s*\|\s*(?P<rel>r_[A-Za-z0-9_>\-/]+)\s*\|\s*(?P<b>.+?)\s*$")


def _default_path() -> Path:
    return Path(__file__).resolve().parents[3] / "relation_definitions.md"


def parse_relation_definitions(path: Optional[str | Path] = None,
                               encoding: str = "cp1252") -> dict[str, RelationDoc]:
    """Parse le markdown en {code: RelationDoc}.

    `encoding` cp1252 par défaut (encodage historique du fichier).
    Renvoie un dict vide si le fichier n'existe pas (mode non-bloquant pour les tests).
    """
    p = Path(path) if path else _default_path()
    if not p.is_file():
        return {}

    docs: dict[str, RelationDoc] = {}
    current_code: Optional[str] = None
    current_title: str = ""
    current_desc: list[str] = []
    current_examples: list[tuple[str, str, str]] = []

    def flush() -> None:
        nonlocal current_code, current_title, current_desc, current_examples
        if current_code is None:
            return
        docs[current_code] = RelationDoc(
            code=current_code,
            display_name=current_title.strip(),
            description=" ".join(s.strip() for s in current_desc).strip(),
            examples=tuple(current_examples),
        )
        current_code = None
        current_title = ""
        current_desc = []
        current_examples = []

    for raw_line in p.read_text(encoding=encoding, errors="replace").splitlines():
        line = raw_line.rstrip()
        if not line:
            continue
        m = _HEADER_RE.match(line)
        if m:
            flush()
            current_code = m.group("code")
            current_title = m.group("title")
            continue
        if current_code is None:
            continue
        ex = _EXAMPLE_RE.match(line)
        if ex:
            current_examples.append((ex.group("a"), ex.group("rel"), ex.group("b")))
            continue
        if line.startswith("#"):
            # Nouvelle section non liée à une relation : on flushe.
            flush()
            continue
        if not line.startswith("*"):
            current_desc.append(line)

    flush()
    return docs


def describe_relation(code: str,
                      docs: Optional[dict[str, RelationDoc]] = None) -> str:
    """Construit une description compacte pour docstring d'un tool LangChain."""
    docs = docs if docs is not None else parse_relation_definitions()
    d = docs.get(code)
    if d is None:
        return f"Relation JDM `{code}` (description non documentée localement)."
    lines = [f"{d.display_name} (`{d.code}`) — {d.description}"]
    for a, r, b in d.examples[:3]:
        lines.append(f"  ex.: {a} | {r} | {b}")
    return "\n".join(lines)
