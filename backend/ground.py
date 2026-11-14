# Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
"""Vista de Tierra (cirujano de vuelo y control de misión). Decisión de Carlos, 14-nov 16:30:
  · Tierra ve TODO, al momento: tripulación completa, constantes, avisos, nave y entorno (en la demo no se simula
    el retraso de los datos).
  · Lo que sí viaja con el retraso del entorno son los MENSAJES: los paquetes de la nave (bandeja) y las respuestas
    del cirujano hacia la nave. Sin enlace, esperan en cola.
  · La aptitud que decide el cirujano (apto / limitado / no apto) se aplica a bordo cuando su respuesta LLEGA."""
import roles
import station

FITNESS_TEXT = {"fit": ("fit for duty", "apto"), "limited": ("limited duty", "servicio limitado"), "unfit": ("not fit for duty", "no apto")}


def apply_delivered():
    """Aplica la aptitud de las respuestas del cirujano que ya han llegado a la nave (una sola vez)."""
    for e in station.events():
        p = e.get("payload") or {}
        if e["type"] == "surgeon_reply" and e.get("status") == "delivered" and p.get("fitness") and not p.get("applied"):
            roles.set_fitness(e["crew_id"], p["fitness"], "ground")
            station.mark(e["id"], applied=True)


def _summary_for(e, tree):
    """Qué contiene un paquete: el resumen para el cirujano del triaje, o el de las constantes."""
    p = e.get("payload") or {}
    if p.get("flow") and p.get("node_id"):
        node = tree["flows"].get(p["flow"], {}).get("nodes", {}).get(p["node_id"], {})
        if node.get("surgeon_summary_en") or node.get("surgeon_summary"):
            return node.get("surgeon_summary_en") or node.get("surgeon_summary")
    return p.get("summary_en") or e.get("text_en")


def overview(station_view, vitals_view, ship_view, mission_view, tree, names):
    evs = station.events()
    inbox = [{**e, "name": names.get(e.get("crew_id"), e.get("crew_id")), "summary_en": _summary_for(e, tree)}
             for e in evs if e.get("direction") == "to_earth"]
    outbox = [{**e, "name": names.get(e.get("crew_id"), e.get("crew_id"))} for e in evs if e.get("direction") == "to_ship"]
    return {"viewer": {"id": "ground", "role": "ground"}, "realtime_data": True,
            "crew": station_view["crew"], "alerts": station_view["alerts"], "vitals": vitals_view["crew"],
            "checks": vitals_view.get("checks", []), "ship": ship_view, "mission": mission_view,
            "inbox": inbox, "outbox": outbox, "events": evs[:30],
            "note_en": "Ground sees crew and ship data live in this demo; messages travel with the link delay.",
            "note_es": "En esta demo Tierra ve los datos de tripulación y nave al momento; los mensajes viajan con el retraso del enlace."}


def reply(crew_id, text_en, text_es=None, fitness=None, packet_id=None, name=None):
    """Mensaje del cirujano a la nave sobre un tripulante (o a todos si crew_id es None)."""
    if fitness is not None and fitness not in FITNESS_TEXT:
        raise ValueError(f"aptitud desconocida: {fitness}")
    who = name or (crew_id or "").capitalize()
    fe, fs = FITNESS_TEXT.get(fitness, ("", ""))
    head_en = f"Flight surgeon about {who}: " if crew_id else "Message from ground: "
    head_es = f"Cirujano de vuelo sobre {who}: " if crew_id else "Mensaje de Tierra: "
    t_en = head_en + text_en.strip() + (f" Status: {fe}." if fitness else "")
    t_es = head_es + (text_es or text_en).strip() + (f" Estado: {fs}." if fitness else "")
    return station.add_event("surgeon_reply" if crew_id else "ground_message", crew_id,
                             {"fitness": fitness, "packet_id": packet_id, "from": "ground"}, t_en, t_es)
