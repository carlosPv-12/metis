# Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
"""Vista de Tierra: todo al momento; los mensajes viajan con el retraso del entorno; la aptitud se aplica al llegar."""
import time
import pytest
import mission
import roles
import station
import vitals


@pytest.fixture(autouse=True)
def clean(monkeypatch):
    monkeypatch.delenv("METIS_DELAY_S", raising=False)
    mission.reset(); roles.reset(); vitals.reset()
    yield
    mission.reset(); roles.reset(); vitals.reset()


def test_ground_sees_everything_live(client):
    g = client.get("/api/ground").json()
    assert g["viewer"]["role"] == "ground" and g["realtime_data"] is True
    assert len(g["crew"]) == 4 and all(c["access"] == "full" for c in g["crew"])
    assert len(g["vitals"]) == 4 and g["ship"]["co2_sleep_link"] is not None and g["mission"]["env"] == "mars"


def test_triage_packet_reaches_inbox_with_summary(client):
    client.post("/api/station/events", json={"type": "send_flight_surgeon", "crew_id": "marco",
                                             "payload": {"flow": "companion_collapse", "node_id": "c7", "level": "rojo"}})
    p = client.get("/api/ground").json()["inbox"][0]
    assert p["type"] == "send_flight_surgeon" and p["name"] == "Marco" and p["status"] == "in_transit"
    assert p["delay_s"] == 300 and "CMO" in p["summary_en"]                    # resumen del triaje para el cirujano


def test_escalation_sends_packet_to_earth(client):
    T = 1_800_000_000.0
    import main
    vitals.set_scenario("marco", "collapse", now=T)
    vitals.snapshot(main.crew_doc(), now=T + 10)
    p = next(e for e in client.get("/api/ground").json()["inbox"] if e["type"] == "surgeon_notice")
    assert p["crew_id"] == "marco" and "no pulse" in p["text_en"]


def test_reply_travels_and_fitness_applies_on_arrival(client):
    mission.set("iss")                                                         # 0,6 s de ida
    r = client.post("/api/ground/reply", json={"crew_id": "marco", "text_en": "Rest today, no EVA.", "fitness": "limited"}).json()
    assert r["direction"] == "to_ship" and r["status"] == "in_transit" or r["arrives_in_s"] == 0
    assert roles.fitness("marco")["status"] == "fit"                           # todavía no ha llegado
    time.sleep(0.8)
    st = client.get("/api/station?viewer=noor").json()
    marco = next(c for c in st["crew"] if c["id"] == "marco")
    assert marco["fitness"] == {"status": "limited", "by": "ground", "ts": marco["fitness"]["ts"]}
    ev = next(e for e in st["events"] if e["type"] == "surgeon_reply")
    assert ev["status"] == "delivered" and ev["text_en"].startswith("Flight surgeon about Marco: Rest today") and "limited duty" in ev["text_en"]


def test_reply_waits_in_queue_with_no_link(client):
    mission.set("blackout")
    r = client.post("/api/ground/reply", json={"crew_id": "marco", "text_en": "Rest.", "fitness": "unfit"}).json()
    assert r["status"] == "queued_no_link"
    client.get("/api/station")
    assert roles.fitness("marco")["status"] == "fit"                           # sin enlace no llega nada
    client.put("/api/mission", json={"env": "iss"})                            # vuelve el enlace
    time.sleep(0.8)
    client.get("/api/station")
    assert roles.fitness("marco")["status"] == "unfit"


@pytest.mark.parametrize("viewer,visible,detail", [("marco", True, True), ("noor", True, True), ("kenji", True, False), ("lena", False, False)])
def test_reply_respects_privacy_on_board(client, viewer, visible, detail):
    mission.set("iss")
    client.post("/api/ground/reply", json={"crew_id": "marco", "text_en": "Rest today, no EVA."})
    time.sleep(0.8)
    evs = [e for e in client.get(f"/api/station/events?viewer={viewer}").json() if e["type"] == "surgeon_reply"]
    assert bool(evs) == visible
    if evs:
        assert ("Rest today" in evs[0]["text_en"]) == detail


def test_message_to_all_crew(client):
    mission.set("iss")
    client.post("/api/ground/reply", json={"text_en": "Comm pass in 10 minutes."})
    time.sleep(0.8)
    ev = next(e for e in client.get("/api/station/events?viewer=lena").json() if e["type"] == "ground_message")
    assert ev["text_en"] == "Message from ground: Comm pass in 10 minutes."


def test_bad_reply(client):
    assert client.post("/api/ground/reply", json={"crew_id": "nadie", "text_en": "x"}).status_code == 404
    assert client.post("/api/ground/reply", json={"crew_id": "marco", "text_en": "x", "fitness": "maybe"}).status_code == 400
    assert client.post("/api/ground/reply", json={"crew_id": "marco", "text_en": "  "}).status_code == 400
