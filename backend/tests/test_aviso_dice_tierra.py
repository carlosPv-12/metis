# Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
"""En una emergencia, Metis dice que ha enviado un mensaje al cirujano de vuelo EN TIERRA (Carlos, 15-nov:
«en la emergencia no dice nada de mensaje mandado a la tierra»)."""
import pytest
import main
import mission
import vitals

T = 1_950_000_000.0


@pytest.fixture(autouse=True)
def clean(monkeypatch):
    monkeypatch.delenv("METIS_DELAY_S", raising=False)
    mission.reset(); vitals.reset()
    yield
    mission.reset(); vitals.reset()


@pytest.mark.parametrize("env,en,es", [
    ("iss", "I've sent a message to the flight surgeon on Earth; they can join almost live.", "He enviado un mensaje al cirujano de vuelo, en Tierra"),
    ("mars", "I've sent a message to the flight surgeon on Earth: it arrives in about 5 minutes, and their answer takes 10.", "llega en unos 5 minutos"),
    ("blackout", "There is no link with Earth right now: my message to the flight surgeon on Earth is queued", "queda en cola"),
])
def test_frase_de_tierra_segun_enlace(env, en, es):
    mission.set(env)
    assert mission.ground_phrase("en").startswith(en) and es in mission.ground_phrase("es")


def test_retraso_corto_en_segundos(monkeypatch):
    monkeypatch.setenv("METIS_DELAY_S", "20")
    assert "about 20 seconds, and their answer takes 40" in mission.ground_phrase("en")


def test_el_aviso_de_desplome_dice_tierra():
    vitals.set_scenario("marco", "collapse", now=T)
    snap = vitals.snapshot(main.crew_doc(), now=T + 10)
    c = next(x for x in snap["checks"] if x["crew_id"] == "marco")
    assert c["state"] == "escalated"
    assert "flight surgeon on Earth" in c["instructions_en"] and "cirujano de vuelo, en Tierra" in c["instructions_es"]


# ---------- quién ve el mensaje a Tierra (roles.filter_events) ----------
def _packets(client, viewer, since):
    return [e for e in client.get(f"/api/station/events?viewer={viewer}").json() if e.get("direction") and int(e["id"]) > since]


def _since():
    import station
    evs = station.events()
    return int(evs[0]["id"]) if evs else 0


@pytest.mark.parametrize("viewer,detail", [("lena", False), ("kenji", False), ("noor", True), ("marco", True), ("ground", True)])
def test_todos_ven_que_se_envio_el_mensaje_de_emergencia(client, viewer, detail):
    since = _since()
    vitals.set_scenario("marco", "collapse", now=T)
    vitals.snapshot(main.crew_doc(), now=T + 10)
    p = next(e for e in _packets(client, viewer, since) if e["type"] == "surgeon_notice")
    assert p["direction"] == "to_earth" and p["status"] == "in_transit" and p["arrives_ts"]     # se ve que va a Tierra y cuándo llega
    assert ("no pulse" in p["text_en"]) == detail                                                  # el detalle médico, solo quien puede
    if not detail:
        assert "payload" not in p and p["text_en"].startswith("Emergency message to the flight surgeon on Earth")


@pytest.mark.parametrize("viewer,visible", [("marco", True), ("noor", True), ("lena", False), ("kenji", True)])
def test_el_chequeo_de_bienestar_no_es_una_emergencia(client, viewer, visible):
    since = _since()
    client.post("/api/station/events", json={"type": "send_flight_surgeon", "crew_id": "marco",
                                             "payload": {"kind": "wellbeing", "text_en": "Marco feels low today."}})
    ps = [e for e in _packets(client, viewer, since) if e["type"] == "send_flight_surgeon"]
    assert bool(ps) == visible
    if viewer in ("lena", "kenji") and ps:
        assert "Marco feels low" not in ps[0]["text_en"]                                           # el comandante: sin detalle
