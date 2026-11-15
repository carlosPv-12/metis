# Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
"""Prueba de punta a punta: cuando hay una emergencia, la nave manda un paquete a Tierra y Tierra lo recibe.
Cubre las tres fuentes de emergencia (constantes: sin pulso, pide ayuda, no contesta; triaje: botón y voz)
y los tres tipos de enlace (casi en directo, con retraso, sin enlace). Tierra se lee siempre por /api/ground."""
import time
import pytest
import main
import mission
import roles
import station
import vitals

T = 1_900_000_000.0


@pytest.fixture(autouse=True)
def clean(monkeypatch):
    monkeypatch.setenv("METIS_DELAY_S", "1")          # Marte a 1 s de ida para no esperar minutos
    mission.reset(); roles.reset(); vitals.reset()
    yield
    mission.reset(); roles.reset(); vitals.reset()


def _last_id():
    evs = station.events()
    return evs[0]["id"] if evs else 0


def _inbox(client, since, type_=None):
    """Paquetes que han llegado a la bandeja de Tierra desde el evento `since`."""
    return [p for p in client.get("/api/ground").json()["inbox"]
            if p["id"] > since and (type_ is None or p["type"] == type_)]


def _wait_delivered(client, since, type_, timeout=4.0):
    t0 = time.time()
    while time.time() - t0 < timeout:
        ps = _inbox(client, since, type_)
        if ps and ps[0]["status"] in ("delivered_awaiting_reply", "reply_window_open"):
            return ps[0]
        time.sleep(0.1)
    raise AssertionError(f"no llegó a Tierra: {_inbox(client, since, type_)}")


# ---------- emergencias de constantes (escalado automático) ----------
def test_desplome_sin_pulso_llega_a_tierra(client):
    mission.set("iss")
    since = _last_id()
    vitals.set_scenario("marco", "collapse", now=T)
    vitals.snapshot(main.crew_doc(), now=T + 10)
    p = _wait_delivered(client, since, "surgeon_notice")
    assert p["crew_id"] == "marco" and p["name"] == "Marco" and p["direction"] == "to_earth"
    assert p["payload"]["reason"] == "no_pulse" and "no pulse" in p["text_en"]
    assert p["delay_s"] == pytest.approx(0.6)
    # a bordo también salta el aviso a la tripulación y al oficial médico
    tipos = {e["type"] for e in station.events() if e["id"] > since}
    assert {"crew_alert", "cmo_alert", "surgeon_notice"} <= tipos


def test_pide_ayuda_llega_a_tierra(client):
    since = _last_id()
    vitals.set_scenario("marco", "deterioration", ramp_s=30, now=T)
    vitals.snapshot(main.crew_doc(), now=T + 60)                # ya fuera de banda: Metis le pregunta
    assert vitals.checkin("marco", "I'm not okay, help", now=T + 61)["answer"] == "help"
    vitals.snapshot(main.crew_doc(), now=T + 62)
    p = _wait_delivered(client, since, "surgeon_notice")
    assert p["crew_id"] == "marco" and p["payload"]["reason"] == "help" and "asked for help" in p["text_en"]


def test_no_contesta_llega_a_tierra(client):
    since = _last_id()
    vitals.set_scenario("marco", "deterioration", ramp_s=30, now=T)
    vitals.snapshot(main.crew_doc(), now=T + 60)
    assert not [e for e in station.events() if e["id"] > since and e["type"] == "surgeon_notice"]  # aún en plazo
    vitals.snapshot(main.crew_doc(), now=T + 60 + vitals.CHECKIN_TIMEOUT_S + 1)
    p = _wait_delivered(client, since, "surgeon_notice")
    assert p["payload"]["reason"] == "no_answer" and "not answering" in p["text_en"]


# ---------- emergencias de triaje (botón y voz) ----------
def test_boton_del_triaje_llega_a_tierra_con_retraso_de_marte(client, monkeypatch):
    monkeypatch.setenv("METIS_DELAY_S", "2")
    since = _last_id()
    r = client.post("/api/station/events", json={"type": "send_flight_surgeon", "crew_id": "marco",
                                                 "payload": {"flow": "companion_collapse", "node_id": "c7", "level": "rojo",
                                                             "reporter": "noor"}}).json()
    assert r["direction"] == "to_earth" and r["status"] == "in_transit" and r["delay_s"] == 2.0
    assert _inbox(client, since, "send_flight_surgeon")[0]["status"] == "in_transit"   # todavía en camino
    p = _wait_delivered(client, since, "send_flight_surgeon")
    assert p["id"] == r["id"] and p["summary_en"] and "CMO" in p["summary_en"]           # resumen del triaje para el cirujano


def test_orden_de_voz_avisa_a_tierra(client):
    for frase in ("send it to the flight surgeon", "call Houston", "avisa a Tierra"):
        acts = client.post("/api/triage/command", json={"text": frase}).json()["actions"]
        assert "send_flight_surgeon" in acts, frase


# ---------- sin enlace y respuesta de Tierra ----------
def test_sin_enlace_espera_en_cola_y_sale_al_volver(client):
    mission.set("blackout")
    since = _last_id()
    vitals.set_scenario("marco", "collapse", now=T)
    vitals.snapshot(main.crew_doc(), now=T + 10)
    p = _inbox(client, since, "surgeon_notice")[0]
    assert p["status"] == "queued_no_link" and p["arrives_in_s"] is None
    client.put("/api/mission", json={"env": "iss"})              # vuelve el enlace
    p = _wait_delivered(client, since, "surgeon_notice")
    assert p["crew_id"] == "marco"


def test_tierra_contesta_al_paquete_y_la_respuesta_llega_a_bordo(client):
    mission.set("iss")
    since = _last_id()
    pkt = client.post("/api/station/events", json={"type": "send_flight_surgeon", "crew_id": "marco",
                                                   "payload": {"flow": "companion_collapse", "node_id": "c7"}}).json()
    _wait_delivered(client, since, "send_flight_surgeon")
    r = client.post("/api/ground/reply", json={"crew_id": "marco", "text_en": "Keep CPR going, AED now.",
                                               "fitness": "unfit", "packet_id": pkt["id"]}).json()
    assert r["direction"] == "to_ship"
    time.sleep(0.8)
    ev = next(e for e in client.get("/api/station?viewer=noor").json()["events"] if e["id"] == r["id"])
    assert ev["status"] == "delivered" and ev["payload"]["packet_id"] == pkt["id"]
    assert roles.fitness("marco")["status"] == "unfit"
