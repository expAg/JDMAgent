"""Client JeuxDeMots (rezo-dump) avec cache disque.

Accès en lecture au réseau lexico-sémantique JDM via l'API rezo-dump publique.
Format : lignes `e;id;'nom';type;poids` (nœuds) et `r;rid;n1;n2;reltype;poids;...`
(relations). Encodage ISO-8859-1. Les poids négatifs = relation supposée fausse.

Tout est mis en cache sur disque (le graphe est stable). En cas d'absence de
réseau, on renvoie une liste vide → la couche sémantique reste *défaisable*.
"""
import json
import os
import re
import urllib.parse
import urllib.request

BASE = "https://www.jeuxdemots.org/rezo-dump.php"
RELID = {
    "r_isa": 6, "r_anto": 7, "r_agent": 13, "r_patient": 14, "r_lieu": 15,
    "r_carac": 17, "r_telic_role": 37, "r_has_magn": 20, "r_cohypo": 78,
}
_CACHE_DIR = os.path.join(os.path.dirname(__file__), ".jdm_cache")
os.makedirs(_CACHE_DIR, exist_ok=True)

_E = re.compile(r"^e;(\d+);'([^']*)';(\d+);")
_R = re.compile(r"^r;\d+;(\d+);(\d+);(\d+);(-?\d+);")


def _fetch_raw(term: str) -> str:
    url = BASE + "?" + urllib.parse.urlencode(
        {"gotermsubmit": "Chercher", "gotermrel": term, "rel": ""})
    with urllib.request.urlopen(url, timeout=30) as resp:
        return resp.read().decode("iso-8859-1", errors="replace")


def relations(term: str, reltype: str):
    """Renvoie [(cible, poids), ...] pour `term --reltype--> cible`, triées par poids.

    Résultat mis en cache par (terme, reltype). Liste vide si terme/réseau absent.
    """
    rid = RELID[reltype]
    key = re.sub(r"[^\w-]", "_", f"{term}__{reltype}")
    cache = os.path.join(_CACHE_DIR, key + ".json")
    if os.path.exists(cache):
        with open(cache, encoding="utf-8") as f:
            return [tuple(x) for x in json.load(f)]

    out = []
    try:
        raw = _fetch_raw(term)
        names, src_ids = {}, set()
        for line in raw.splitlines():
            m = _E.match(line)
            if m:
                nid, name = m.group(1), m.group(2)
                names[nid] = name
                if name.lower() == term.lower():
                    src_ids.add(nid)
        for line in raw.splitlines():
            m = _R.match(line)
            if not m:
                continue
            n1, n2, rt, w = m.group(1), m.group(2), int(m.group(3)), int(m.group(4))
            if rt == rid and n1 in src_ids and n2 in names:
                out.append((names[n2], w))
        out.sort(key=lambda x: -x[1])
    except Exception:
        out = []

    with open(cache, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False)
    return out


def weight(term: str, reltype: str, target: str):
    """Poids de la relation term--reltype-->target, ou None si absente."""
    t = target.lower()
    for name, w in relations(term, reltype):
        if name.lower() == t:
            return w
    return None
