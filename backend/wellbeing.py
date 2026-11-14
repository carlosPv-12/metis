# Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
"""Registros de bienestar («How I feel»): se guardan a bordo, en el backend, y no solo en el navegador.

Privacidad (la decide cada tripulante):
  · El propio tripulante ve todos sus registros, con sus notas.
  · Tierra (cirujano de vuelo) solo ve los registros que el tripulante ha enviado, y la nota solo si la incluyó.
  · De lo demás, Tierra recibe como mucho un resumen ya calculado, según el nivel que elija el tripulante
    (none / summary / signals). Nunca las respuestas ni las notas privadas.
  · Nadie más a bordo (comandante, CMO, compañeros) ve los registros: si alguien necesita ayuda, lo pide él.
Se guarda en un JSON fuera del brain (METIS_STATE_DIR, por defecto ~/.local/share/metis/state/)."""
import json, os, pathlib, threading, time, uuid

STATE_DIR = pathlib.Path(os.path.expanduser(os.environ.get("METIS_STATE_DIR", "~/.local/share/metis/state")))
FILE = STATE_DIR / "wellbeing.json"
MAX_PER_CREW = 200
SHARE_LEVELS = ("none", "summary", "signals")
# Cada uno elegiría distinto: valores de partida de los personajes de la demo (los mismos que tenía el frontend).
SHARE_DEFAULT = {"lena": "signals", "marco": "summary", "noor": "summary", "kenji": "none"}

# Cuestionario activo. Las respuestas se validan contra él; cambiarlo aquí cambia lo que acepta la API.
INSTRUMENT = {
    "id": "metis_v1",
    "note_en": "Prototype items written by the team; not a validated instrument.",
    "scale": [1, 5],
    "questions": ["mood", "energy", "stress", "sleep", "connected"],
}
TAGS = ("homesick", "workload", "crew", "tired", "calm", "focused", "bored", "worried")

_lock = threading.Lock()
_state = None  # {"checkins": [...], "share": {crew_id: level}}


def _load():
    global _state
    if _state is None:
        try:
            _state = json.loads(FILE.read_text("utf-8"))
        except (OSError, ValueError):
            _state = {}
        _state.setdefault("checkins", []); _state.setdefault("share", {})
    return _state


def _save():
    try:
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        tmp = FILE.with_suffix(".tmp")
        tmp.write_text(json.dumps(_state, ensure_ascii=False), "utf-8")
        tmp.replace(FILE)            # escritura atómica: un corte no deja el archivo a medias
    except OSError:
        pass                         # sin disco escribible: sigue en memoria


def reset():
    """Borra todo (tests y modo director)."""
    global _state
    with _lock:
        _state = {"checkins": [], "share": {}}
        _save()


def validate(answers: dict, tags: list):
    lo, hi = INSTRUMENT["scale"]
    qs = INSTRUMENT["questions"]
    if set(answers) != set(qs):
        raise ValueError(f"respuestas esperadas: {', '.join(qs)}")
    for k, v in answers.items():
        if not isinstance(v, int) or isinstance(v, bool) or not lo <= v <= hi:
            raise ValueError(f"{k}: valor fuera de la escala {lo}-{hi}")
    bad = [t for t in tags if t not in TAGS]
    if bad:
        raise ValueError(f"etiquetas desconocidas: {', '.join(bad)}")


def add(crew_id: str, answers: dict, tags: list | None = None, note: str = "", shared: bool = False, note_shared: bool = False):
    tags = list(dict.fromkeys(tags or []))
    validate(answers, tags)
    c = {"id": uuid.uuid4().hex[:12], "ts": int(time.time() * 1000), "crew_id": crew_id, "instrument": INSTRUMENT["id"],
         "answers": dict(answers), "tags": tags, "note": (note or "").strip()[:2000],
         "shared": bool(shared), "note_shared": bool(shared and note_shared)}
    with _lock:
        s = _load()
        mine = [x for x in s["checkins"] if x["crew_id"] == crew_id]
        if len(mine) >= MAX_PER_CREW:                  # se queda con los últimos de cada persona
            drop = {x["id"] for x in mine[: len(mine) - MAX_PER_CREW + 1]}
            s["checkins"] = [x for x in s["checkins"] if x["id"] not in drop]
        s["checkins"].append(c)
        _save()
    return dict(c)


def get(checkin_id: str):
    with _lock:
        return next((dict(x) for x in _load()["checkins"] if x["id"] == checkin_id), None)


def share(checkin_id: str, with_note: bool = False):
    """El tripulante envía a Tierra un registro que antes era privado. No se puede «des-enviar»."""
    with _lock:
        for x in _load()["checkins"]:
            if x["id"] == checkin_id:
                x["shared"] = True
                x["note_shared"] = x["note_shared"] or bool(with_note)
                _save()
                return dict(x)
    return None


def _for_viewer(c: dict, viewer: str):
    if viewer == c["crew_id"]:
        return dict(c)
    if viewer == "ground" and c["shared"]:
        out = {k: v for k, v in c.items() if k != "note"}
        if c["note_shared"]:
            out["note"] = c["note"]
        return out
    return None


def checkins(crew_id: str, viewer: str):
    """Registros de una persona, del más nuevo al más viejo, filtrados para quien mira."""
    with _lock:
        mine = [x for x in _load()["checkins"] if x["crew_id"] == crew_id]
    out = [y for y in (_for_viewer(x, viewer) for x in reversed(mine)) if y]
    return out


def latest_private(crew_id: str):
    """Último registro completo, SOLO para cálculos del backend (resumen para Tierra). No se devuelve tal cual."""
    with _lock:
        mine = [x for x in _load()["checkins"] if x["crew_id"] == crew_id]
    return dict(mine[-1]) if mine else None


Q_LABEL = {"mood": ("mood", "ánimo"), "energy": ("energy", "energía"), "stress": ("calm (no stress)", "calma (sin estrés)"),
           "sleep": ("sleep quality", "calidad del sueño"), "connected": ("feeling connected", "conexión con los demás")}
TAG_LABEL = {"homesick": ("missing home", "echo de menos casa"), "workload": ("workload", "carga de trabajo"),
             "crew": ("crew relations", "relación con la tripulación"), "tired": ("tired", "cansancio"), "calm": ("calm", "tranquilidad"),
             "focused": ("focused", "concentración"), "bored": ("monotony", "monotonía"), "worried": ("worried", "preocupación")}


def text(c: dict, name: str):
    """Texto del paquete para el cirujano de vuelo (EN, ES). La nota solo va si el tripulante la incluyó."""
    out = []
    for i, (head, on_mind, note_l) in enumerate((("Wellbeing check-in from", "On my mind", "Note"),
                                                 ("Registro de bienestar de", "Lo que tengo en la cabeza", "Nota"))):
        parts = ", ".join(f"{Q_LABEL.get(q, (q, q))[i]} {v}/{INSTRUMENT['scale'][1]}" for q, v in c["answers"].items())
        tags = f". {on_mind}: {', '.join(TAG_LABEL.get(t, (t, t))[i] for t in c['tags'])}" if c["tags"] else ""
        note = f". {note_l}: “{c['note']}”" if c.get("note_shared") and c.get("note") else ""
        out.append(f"{head} {name}: {parts}{tags}{note}")
    return tuple(out)


def share_level(crew_id: str) -> str:
    with _lock:
        return _load()["share"].get(crew_id) or SHARE_DEFAULT.get(crew_id, "summary")


def set_share_level(crew_id: str, level: str):
    if level not in SHARE_LEVELS:
        raise ValueError(f"nivel desconocido: {level}")
    with _lock:
        _load()["share"][crew_id] = level
        _save()
    return level
