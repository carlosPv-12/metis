# Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
"""Tests de humo: los endpoints que ya usan las pantallas responden y mantienen su forma (ver ../../API.md)."""


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"


def test_crew(client):
    d = client.get("/api/crew").json()
    ids = {c["id"] for c in d["crew"]}
    assert {"lena", "marco"} <= ids and d["simulated"] is True


def test_crew_one(client):
    d = client.get("/api/crew/lena").json()
    assert len(d["days"]) == 30 and "baseline" in d
    assert client.get("/api/crew/nadie").status_code == 404


def test_blood(client):
    assert client.get("/api/blood").status_code == 200


def test_triage_walk(client):
    r = client.post("/api/triage/step", json={"flow": "companion_collapse", "lang": "es"}).json()
    assert r["deterministic"] is True and r["node"]["type"] == "question"
    nxt = client.post("/api/triage/step", json={"flow": "companion_collapse", "node_id": r["node_id"],
                                                "answer": r["node"]["options"][0]["id"]})
    assert nxt.status_code == 200
    assert client.post("/api/triage/step", json={"flow": "no-existe"}).status_code == 404


def test_say_fallback_without_llm(client):
    d = client.post("/api/metis/say", json={"crew_id": "lena", "lang": "en"}).json()
    assert d["source"] == "fallback" and d["text"]


def test_chat_rules(client):
    d = client.post("/api/metis/chat", json={"message": "Marco just collapsed, he is holding his chest"}).json()
    assert d["source"] == "rule" and d["safety"] == "escalated" and d["suggest_flow"] == "companion_collapse"
    d = client.post("/api/metis/chat", json={"message": "¿Qué pastilla me tomo?", "lang": "es"}).json()
    assert d["source"] == "rule" and d["ai_generated"] is False


def test_status_and_thresholds(client):
    assert client.get("/api/status").status_code == 200
    cat = client.get("/api/thresholds").json()
    assert any(t["id"] == "co2_1h_limit" for t in cat)


def test_station_shape(client):
    st = client.get("/api/station?lang=es").json()
    for k in ("mission_day", "crew", "alerts", "environment", "comms", "headsets", "medkit", "events"):
        assert k in st, k
    assert st["simulated"] is True


def test_events_roundtrip(client):
    ev = client.post("/api/station/events", json={"type": "surgeon_notice", "crew_id": "marco", "payload": {"delay_s": 60}}).json()
    assert ev["status"] == "in_transit" and ev["delay_s"] == 60 and ev["reply_in_s"] > ev["arrives_in_s"]
    assert any(e["id"] == ev["id"] for e in client.get("/api/station/events").json())


def test_graph(client):
    g = client.get("/api/brain/graph").json()
    assert g["nodes"] and g["edges"]
