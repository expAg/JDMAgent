"""Phase IV (compétition) — saillance pour la re-résolution des pronoms.

Inspiré des hiérarchies de saillance (Lappin & Leass, Hobbs ; thèse §1.4.2, §2.3.3).
Le score est calculé sur l'ENTITÉ (ses mentions récentes), pas une seule mention :
un pronom sujet récompense une entité introduite comme sujet, même si sa dernière
mention est un possessif. CorPipe fournit un prior ; JDM (J2+) s'ajoute ici.
"""
SUBJECT = {"nsubj", "nsubj:pass", "csubj"}
OBJECT = {"obj", "iobj", "obl:arg"}
RECENCY_WINDOW = 2          # phrases


def _role(m):
    return m["head"].udeprel


def agree(p, cand):
    """Accord genre/nombre/personne, en utilisant le genre/nombre précalculés
    (récupérés du déterminant si le nom ne les porte pas)."""
    for k in ("gender", "number"):
        a, b = p.get(k), cand.get(k)
        if a and b and a != b:
            return False
    pa, pb = p["head"].feats.get("Person"), cand["head"].feats.get("Person")
    if pa and pb and pa != pb:
        return False
    return True


def salience(p, prev_mentions, is_corpipe_origin):
    """Score de l'entité (via ses mentions antérieures `prev_mentions`) pour `p`.

    Renvoie None si incompatible (accord), sinon un score réel.
    """
    if not prev_mentions:
        return None
    closest = max(prev_mentions, key=lambda m: m["pos"])
    if not agree(p, closest):
        return None

    recent = [m for m in prev_mentions if abs(p["sent"] - m["sent"]) <= RECENCY_WINDOW]
    pr = _role(p)
    s = 0.0

    # Parallélisme de rôle (sur les mentions récentes de l'entité)
    if pr in SUBJECT and any(_role(m) in SUBJECT for m in recent):
        s += 2.5
    elif pr in OBJECT and any(_role(m) in OBJECT for m in recent):
        s += 1.0
    # Saillance intrinsèque : l'entité a une mention sujet récente
    if any(_role(m) in SUBJECT for m in recent):
        s += 1.0
    # Antécédent par nom propre (entité bien identifiée)
    if any(m["head"].upos == "PROPN" for m in recent):
        s += 0.5
    # Récence (distance en phrases à la mention la plus proche)
    s += max(0.0, 1.5 - 0.5 * abs(p["sent"] - closest["sent"]))
    # Prior neuronal CorPipe (modéré : il se trompe parfois sur les pronoms)
    if is_corpipe_origin:
        s += 0.8
    return s
