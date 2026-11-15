# Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
"""Roles y permisos a bordo, y la vista de Tierra (decisión de Carlos, 14-nov 16:30; ver decisiones/ del brain).

  · Tripulante: solo su información; avisos de emergencia de un compañero y de la nave.
  · Comandante: los rasgos principales de todos (estado, aptitud, pulso y SpO2), sin el detalle médico.
  · Oficial médico (CMO): todo de todos.
  · Tierra (cirujano de vuelo y control de misión): todo, al momento.
  · Todos: la información de la nave.

Toda la política está en PERMISSIONS: si las leyes de protección de datos lo piden, se cambia aquí y nada más.
Sin `viewer` en la petición, la API devuelve lo de siempre (compatibilidad con pantallas que aún no lo envían)."""
import threading, time

ROLES = ("crew", "commander", "cmo")
DEFAULT_ROLES = {"lena": "crew", "marco": "crew", "noor": "cmo", "kenji": "commander"}
LABEL = {"crew": ("Crewmember", "Tripulante"), "commander": ("Commander", "Comandante"),
         "cmo": ("Crew Medical Officer", "Oficial médico"), "ground": ("Ground (flight surgeon)", "Tierra (cirujano de vuelo)")}

# Qué ve cada rol de sí mismo y de los demás: "full" = todo, "summary" = rasgos principales, "none" = nada.
PERMISSIONS = {
    "crew":      {"self": "full", "others": "none",    "ship": True},
    "commander": {"self": "full", "others": "summary", "ship": True},
    "cmo":       {"self": "full", "others": "full",    "ship": True},
    "ground":    {"self": "full", "others": "full",    "ship": True},
}
# Lo que llega a TODOS aunque no puedan ver el detalle médico de esa persona: hay que actuar.
EMERGENCY_EVENTS = {"crew_alert", "alert_crew", "no_pulse", "collapse", "cmo_alert", "alert_commander",
                    "send_flight_surgeon", "triage_started", "ship_fault"}
# Mensajes a Tierra de una emergencia: todos ven QUE se ha enviado y cuándo llega, no el detalle médico (Carlos, 15-nov:
# «no veo los mensajes que mando ni los que llegan a la tierra»). El detalle sigue siendo del afectado, el CMO y Tierra.
EMERGENCY_PACKETS = {"surgeon_notice", "send_flight_surgeon"}
# Envíos a Tierra que NO son emergencias: el chequeo de «How I feel» y el informe diario son privados.
PRIVATE_KINDS = {"wellbeing", "daily_report"}
TRANSPORT = ("direction", "status", "delay_s", "sent_ts", "arrives_ts", "reply_earliest_ts", "arrives_in_s", "reply_in_s", "queued")
PACKET_TEXT = ("Emergency message to the flight surgeon on Earth (medical details with the medical officer)",
               "Mensaje de emergencia al cirujano de vuelo, en Tierra (el detalle médico lo tiene el oficial médico)")
SUMMARY_VITALS = ("t", "hr_bpm", "spo2_pct", "pulse", "activity")   # «rasgos principales» para el comandante
FITNESS = ("fit", "limited", "unfit")

_roles = dict(DEFAULT_ROLES)
_fitness: dict[str, dict] = {}
_lock = threading.Lock()


class Forbidden(Exception):
    pass


def roles():
    with _lock:
        return dict(_roles)


def set_role(cid, role):
    if role not in ROLES:
        raise ValueError(f"rol desconocido: {role}")
    with _lock:
        _roles[cid] = role


def reset():
    with _lock:
        _roles.clear(); _roles.update(DEFAULT_ROLES); _fitness.clear()


def role_of(viewer):
    """viewer: id de tripulante o "ground". None = sin filtro (compatibilidad)."""
    if viewer is None:
        return None
    if viewer == "ground":
        return "ground"
    with _lock:
        if viewer not in _roles:
            raise KeyError(viewer)
        return _roles[viewer]


def access(viewer, target):
    """'full' | 'summary' | 'none' de `viewer` sobre los datos médicos de `target`."""
    r = role_of(viewer)
    if r is None:
        return "full"
    return PERMISSIONS[r]["self" if viewer == target else "others"]


def fitness(cid):
    with _lock:
        return dict(_fitness.get(cid, {"status": "fit", "by": "default", "ts": None}))


def set_fitness(cid, status, viewer):
    """Apto / limitado / no apto: lo deciden el CMO o Tierra, nunca la IA."""
    if status not in FITNESS:
        raise ValueError(f"aptitud desconocida: {status}")
    r = role_of(viewer)
    if r not in ("cmo", "ground"):
        raise Forbidden("solo el oficial médico o Tierra deciden la aptitud")
    with _lock:
        _fitness[cid] = {"status": status, "by": r, "ts": int(time.time())}


# ---------- filtros ----------

FIT_NOTE = {"fit": ("Fit for duty.", "Apto para el servicio."), "limited": ("Limited duty.", "Servicio limitado."),
            "unfit": ("Not fit for duty.", "No apto para el servicio.")}


def _summary_crew_item(c):
    keep = ("id", "name", "role", "role_en", "role_es", "location", "status", "simulated")
    out = {k: c[k] for k in keep if k in c}
    if "vitals" in c and c["vitals"]:
        out["vitals"] = {k: c["vitals"][k] for k in SUMMARY_VITALS if k in c["vitals"]}
    if "hr" in c:
        out["hr"] = c["hr"]
    # La nota sale de la aptitud que decidió el CMO o Tierra, no de las constantes.
    en, es = FIT_NOTE[fitness(c["id"])["status"]]
    if c.get("status") not in (None, "ok"):
        en, es = en + " Details with the medical officer.", es + " El detalle lo tiene el oficial médico."
    out["note_en"], out["note_es"] = en, es
    out["access"] = "summary"
    return out


def filter_crew_items(items, viewer):
    out = []
    for c in items:
        a = access(viewer, c["id"])
        if a == "none":
            continue
        item = dict(c) if a == "full" else _summary_crew_item(c)
        item.setdefault("access", "full")
        item["fitness"] = fitness(c["id"])
        item["crew_role"] = _roles.get(c["id"])
        out.append(item)
    return out


def crew_detail(doc_item, viewer):
    a = access(viewer, doc_item["id"])
    if a == "none":
        raise Forbidden("solo puedes ver tu propia información; el oficial médico tiene el resto")
    if a == "summary":
        return {**_summary_crew_item(doc_item), "fitness": fitness(doc_item["id"]), "crew_role": _roles.get(doc_item["id"])}
    return {**doc_item, "access": "full", "fitness": fitness(doc_item["id"]), "crew_role": _roles.get(doc_item["id"])}


def _generic(level, name):
    return (f"{name}: {level}. The medical officer has the details.", f"{name}: {level}. El detalle lo tiene el oficial médico.")


def filter_alerts(alerts, viewer):
    out = []
    for a in alerts:
        cid = a.get("crew_id")
        if not cid or a.get("source") == "ship":
            out.append(a); continue                        # la nave: para todos
        acc = access(viewer, cid)
        if acc == "full" or a.get("level") == "alarm":
            out.append(a)                                  # sin pulso: todos tienen que saberlo
        elif acc == "summary":
            en, es = _generic(a.get("level", "watch"), a.get("name") or cid.capitalize())
            out.append({k: v for k, v in a.items() if k in ("id", "crew_id", "level", "source")} | {"text_en": en, "text_es": es})
    return out


def _private(e):
    """Un envío a Tierra que no es emergencia (bienestar, informe diario): no cuenta como aviso para todos."""
    return ((e.get("payload") or {}).get("kind") in PRIVATE_KINDS)


def filter_events(events, viewer):
    out = []
    for e in events:
        cid, typ = e.get("crew_id"), e.get("type")
        # Lo que viene de Tierra no existe a bordo hasta que llega: ni el texto ni el aviso de que está en camino
        # (si no, la tripulación leería la respuesta antes de que pase el retraso del enlace).
        if viewer != "ground" and e.get("direction") == "to_ship" and e.get("status") != "delivered":
            continue
        a = access(viewer, cid) if cid else "full"
        if not cid or a == "full" or (typ in EMERGENCY_EVENTS and typ not in EMERGENCY_PACKETS and not _private(e)):
            out.append(e)
        elif typ in EMERGENCY_PACKETS and not _private(e) and e.get("direction") == "to_earth":
            # mensaje de EMERGENCIA a Tierra: se ve que existe y cuándo llega; el texto médico, no.
            # Un chequeo de bienestar o un informe diario no pasan por aquí: no se anuncian como emergencia.
            out.append({k: v for k, v in e.items() if k in ("id", "ts", "type", "crew_id", *TRANSPORT)}
                       | {"text_en": PACKET_TEXT[0], "text_es": PACKET_TEXT[1]})
        elif a == "summary":
            out.append({k: v for k, v in e.items() if k in ("id", "ts", "type", "crew_id")}
                       | {"text_en": "Health notice (details with the medical officer)", "text_es": "Aviso de salud (detalle con el oficial médico)"})
    return out


def filter_vitals(snap, viewer):
    if viewer is None:
        return snap
    crew = []
    for c in snap["crew"]:
        a = access(viewer, c["id"])
        if a == "full":
            crew.append({**c, "access": "full"})
        elif a == "summary":
            crew.append({"id": c["id"], "name": c["name"], "status": c["status"], "access": "summary",
                         "now": {k: c["now"][k] for k in SUMMARY_VITALS if k in c["now"]}})
    checks = []
    for k in snap.get("checks", []):
        if access(viewer, k["crew_id"]) == "full":
            checks.append(k)
        elif k["state"] == "escalated":   # emergencia de un compañero: a todos, con qué hacer
            checks.append({f: k.get(f) for f in ("crew_id", "name", "level", "state", "reason", "escalated_at",
                                                 "instructions_en", "instructions_es")})
    # Una emergencia ya escalada se ve en todos los auriculares, con qué hacer (no con el detalle médico).
    esc = {k["crew_id"]: k for k in snap.get("checks", []) if k["state"] == "escalated"}
    alerts = filter_alerts(snap["alerts"], viewer)
    seen = {a.get("crew_id") for a in alerts if a.get("level") == "alarm" or access(viewer, a.get("crew_id")) == "full"}
    for cid, k in esc.items():
        if cid not in seen:
            alerts = [a for a in alerts if a.get("crew_id") != cid] + [{
                "id": f"emergency:{cid}:{k.get('escalated_at')}", "crew_id": cid, "level": "alarm" if k.get("reason") == "no_pulse" else "warning",
                "rule": "escalated", "text_en": k.get("instructions_en"), "text_es": k.get("instructions_es"), "source": "vitals"}]
    return {**snap, "crew": crew, "alerts": alerts, "checks": checks,
            "viewer": {"id": viewer, "role": role_of(viewer)}}


def permissions_doc():
    return {"roles": roles(), "defaults": DEFAULT_ROLES, "permissions": PERMISSIONS,
            "labels": {k: {"en": v[0], "es": v[1]} for k, v in LABEL.items()},
            "summary_fields": list(SUMMARY_VITALS), "emergency_events": sorted(EMERGENCY_EVENTS),
            "note_en": "Policy is configurable (privacy law may restrict access further).",
            "note_es": "La política se puede cambiar (las leyes de protección de datos pueden limitar más el acceso)."}
