"""Application FastAPI : formulaire de saisie + visualisation des coréférences."""
from pathlib import Path

from fastapi import FastAPI, Request, Form
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from .coref import resolve, syntax

BASE_DIR = Path(__file__).resolve().parent.parent

app = FastAPI(title="Résolution de coréférences (français)")


@app.middleware("http")
async def _no_cache(request: Request, call_next):
    """Empêche le navigateur de servir une ancienne version de la page."""
    resp = await call_next(request)
    resp.headers["Cache-Control"] = "no-store, must-revalidate"
    return resp
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=BASE_DIR / "templates")


@app.on_event("startup")
def _warmup_model():
    """Charge mT5-large UNE fois au démarrage, en tâche de fond (sérialisé par le
    verrou de corpipe_engine). Ainsi aucune requête ne déclenche un 2ᵉ chargement
    concurrent : la 1re requête trouve le modèle prêt ou attend le même chargement."""
    import threading
    from .corpipe_engine import get_engine
    threading.Thread(target=get_engine, daemon=True, name="corpipe-warmup").start()

EXEMPLE = (
    "Marie a appelé son frère parce qu'elle voulait lui rendre les clés. "
    "Il les avait oubliées chez elle hier soir."
)


@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    return templates.TemplateResponse(
        "index.html", {"request": request, "text": EXEMPLE, "result": None}
    )


@app.post("/", response_class=HTMLResponse)
def analyse(request: Request, text: str = Form(...)):
    result = resolve(text)
    return templates.TemplateResponse(
        "index.html", {"request": request, "text": text, "result": result}
    )


@app.post("/api/coref")
def api_coref(payload: dict):
    """Point d'entrée JSON pur (pour intégration programmatique)."""
    return resolve(payload.get("text", ""))


@app.post("/api/syntax")
def api_syntax(payload: dict):
    """Analyse syntaxique seule (dépendances UD), sans coréférence — léger."""
    return syntax(payload.get("text", ""))
