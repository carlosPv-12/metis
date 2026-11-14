# Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
"""Entorno de la misión: el backend usa el retraso elegido en Ajustes (ISS, EVA, Luna, Marte 5-20 min, sin enlace)."""
import pytest
import mission
import roles
import station
import vitals


@pytest.fixture(autouse=True)
def clean(monkeypatch):
    monkeypatch.delenv("METIS_DELAY_S", raising=False)   # aquí queremos los valores reales de cada entorno
    mission.reset(); vitals.reset(); roles.reset()
    yield
    mission.reset(); vitals.reset(); roles.reset()


def test_default_is_mars_5_min(client):
    m = client.get("/api/mission").json()
    assert m["env"] == "mars" and m["one_way_delay_s"] == 300 and m["link"] == "delayed"
    assert client.get("/api/station").json()["comms"]["one_way_delay_s"] == 300


@pytest.mark.parametrize("env,delay,link", [("iss", 0.6, "realtime"), ("eva", 0.6, "realtime"), ("moon", 1.3, "realtime"),
                                            ("blackout", None, "none")])
def test_profiles_match_frontend(client, env, delay, link):
    m = client.put("/api/mission", json={"env": env}).json()
    assert m["one_way_delay_s"] == delay and m["link"] == link
    c = client.get("/api/station").json()["comms"]
    assert c["link"] == link and c["env"] == env


def test_mars_delay_slider(client):
    assert client.put("/api/mission", json={"env": "mars", "mars_delay_min": 20}).json()["one_way_delay_s"] == 1200
    assert client.put("/api/mission", json={"env": "mars", "mars_delay_min": 99}).json()["mars_delay_min"] == 20
    assert client.put("/api/mission", json={"env": "jupiter"}).status_code == 400


def test_packet_uses_environment_delay(client):
    client.put("/api/mission", json={"env": "mars", "mars_delay_min": 10})
    ev = client.post("/api/station/events", json={"type": "send_flight_surgeon", "crew_id": "marco", "payload": {}}).json()
    assert ev["delay_s"] == 600 and ev["status"] == "in_transit" and ev["direction"] == "to_earth"


def test_no_link_queues_and_releases(client):
    client.put("/api/mission", json={"env": "blackout"})
    ev = client.post("/api/station/events", json={"type": "send_flight_surgeon", "crew_id": "marco", "payload": {}}).json()
    assert ev["status"] == "queued_no_link" and ev["arrives_in_s"] is None
    r = client.put("/api/mission", json={"env": "iss"}).json()
    assert r["released"] >= 1
    sent = next(e for e in station.events() if e["id"] == ev["id"])
    assert sent["delay_s"] == 0.6 and sent["status"] != "queued_no_link"


@pytest.mark.parametrize("env,phrase", [("iss", "almost live"), ("mars", "about 5 minutes"), ("blackout", "no link with Earth")])
def test_metis_says_what_happens_with_ground(env, phrase):
    import main
    mission.set(env)
    T = 1_800_000_000.0
    vitals.set_scenario("marco", "collapse", now=T)
    c = next(k for k in vitals.snapshot(main.crew_doc(), now=T + 10)["checks"] if k["crew_id"] == "marco")
    assert phrase in c["instructions_en"]
