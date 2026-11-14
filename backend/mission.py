# Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
"""Entorno de la misión y enlace con Tierra (reto 04: «adapt it to different environments»).
Lo elige Ajustes y lo usa todo el backend: cuentas atrás de los paquetes a Tierra, cola si no hay enlace y lo
que dice Metis. Mismos perfiles que frontend/src/link.ts (decisión de Carlos, 14-nov 16:30).
Los retrasos son aproximados, para ilustrar; no son especificaciones de misión."""
import os, threading

PROFILES = {
    "iss": {"one_way_s": 0.6, "mode": "realtime", "en": "ISS", "es": "ISS",
            "note_en": "Near-continuous link: the flight surgeon can join almost live.",
            "note_es": "Enlace casi continuo: el cirujano de vuelo puede entrar casi en directo.",
            "source": "Metis final version (14-nov), section 14: ~600 ms on the ISS"},
    "eva": {"one_way_s": 0.6, "mode": "realtime", "en": "Spacewalk (EVA)", "es": "Paseo espacial (EVA)",
            "note_en": "Crewmember outside: alerts go first to the crew inside and to ground.",
            "note_es": "Tripulante fuera: los avisos van primero a la tripulación de dentro y a Tierra.",
            "source": "Metis final version (14-nov), section 14"},
    "moon": {"one_way_s": 1.3, "mode": "realtime", "en": "Moon", "es": "Luna",
             "note_en": "About 1.3 s each way: conversation is possible but with pauses.",
             "note_es": "Unos 1,3 s de ida: se puede hablar, pero con pausas.",
             "source": "Earth-Moon distance / speed of light (~384,400 km / 299,792 km/s; our calculation)"},
    "mars": {"one_way_s": None, "mode": "delayed", "en": "Mars", "es": "Marte",
             "note_en": "Minutes each way: Metis guides the crew; ground gets a store-and-forward packet.",
             "note_es": "Minutos de ida: Metis guía a la tripulación; Tierra recibe un paquete que se guarda y reenvía.",
             "source": "NASA HRP, Hazard: Distance from Earth: up to 20 minutes one way"},
    "blackout": {"one_way_s": None, "mode": "none", "en": "No link", "es": "Sin enlace",
                 "note_en": "No contact with Earth: packets wait in the queue; the crew relies on Metis and the CMO.",
                 "note_es": "Sin contacto con Tierra: los paquetes esperan en cola; la tripulación cuenta con Metis y el oficial médico.",
                 "source": "Metis final version (14-nov), section 14: solar conjunction, ~2 weeks without commands"},
}
DEFAULT = {"env": "mars", "mars_delay_min": 5}
_state = dict(DEFAULT)
_lock = threading.Lock()


def delay_s():
    """Retraso de ida en segundos, o None si no hay enlace. METIS_DELAY_S fuerza el de Marte (tests)."""
    with _lock:
        env, mins = _state["env"], _state["mars_delay_min"]
    if env == "mars":
        forced = os.environ.get("METIS_DELAY_S")
        return float(forced) if forced else mins * 60.0
    return PROFILES[env]["one_way_s"]


def get():
    with _lock:
        env, mins = _state["env"], _state["mars_delay_min"]
    p, d = PROFILES[env], delay_s()
    return {"env": env, "mars_delay_min": mins, "one_way_delay_s": d, "round_trip_s": None if d is None else 2 * d,
            "link": p["mode"], "label_en": p["en"], "label_es": p["es"], "note_en": p["note_en"], "note_es": p["note_es"],
            "source": p["source"], "profiles": {k: {"one_way_s": v["one_way_s"], "mode": v["mode"], "label_en": v["en"]}
                                                for k, v in PROFILES.items()}}


def set(env, mars_delay_min=None):
    if env not in PROFILES:
        raise ValueError(f"entorno desconocido: {env}")
    with _lock:
        _state["env"] = env
        if mars_delay_min is not None:
            _state["mars_delay_min"] = max(5, min(20, int(round(mars_delay_min))))


def reset():
    with _lock:
        _state.clear(); _state.update(DEFAULT)


def ground_phrase(lang="en"):
    """Qué pasa con el cirujano de vuelo según el enlace; Metis lo añade a sus avisos de emergencia."""
    d, mode = delay_s(), PROFILES[get()["env"]]["mode"]
    if mode == "none":
        return ("There is no link with Earth: the report for the flight surgeon waits in the queue."
                if lang != "es" else "No hay enlace con Tierra: el informe para el cirujano de vuelo espera en cola.")
    if mode == "realtime":
        return ("I'm calling the flight surgeon now; they can join almost live."
                if lang != "es" else "Llamo ya al cirujano de vuelo; puede entrar casi en directo.")
    m = round(d / 60)
    return (f"The report reaches the flight surgeon in about {m} minutes; their answer takes {2 * m}."
            if lang != "es" else f"El informe llega al cirujano de vuelo en unos {m} minutos; su respuesta tarda {2 * m}.")
