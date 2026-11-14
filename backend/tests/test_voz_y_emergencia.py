# Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
"""Emergencias por texto, limpieza del STT y respuestas habladas al triaje (manos libres)."""
import pytest
import llm
from voice_answer import clean_transcript, match_option

YN = [{"id": "si", "label_en": "Yes", "label_es": "Sí"}, {"id": "no", "label_en": "No", "label_es": "No"}]
TIME = [{"id": "lt10", "label_en": "Less than 10 minutes", "label_es": "Menos de 10 minutos"},
        {"id": "gt10", "label_en": "More than 10 minutes", "label_es": "Más de 10 minutos"}]


@pytest.mark.parametrize("msg", ["My chest feels tight", "My chest feels tied.", "my chest is really tight", "tightness in my chest",
                                 "His chest hurts", "chest pain", "Me duele el pecho", "Marco collapsed",
                                 "Marco is colapsed", "Marco Kojapsed", "Marco is down", "Emergency!", "Mayday, mayday"])
def test_emergency_detected(msg):
    assert llm.EMERGENCY.search(msg)


@pytest.mark.parametrize("msg", ["I feel tired", "My head hurts a bit", "I slept badly", "the download is complete", "I feel down today", "calm down", "a couple of apps"])
def test_not_emergency(msg):
    assert not llm.EMERGENCY.search(msg)


def test_chat_escalates_tight_chest(client):
    d = client.post("/api/metis/chat", json={"message": "My chest feels tight"}).json()
    assert d["safety"] == "escalated" and d["suggest_flow"] == "self_chest_pressure" and d["source"] == "rule"


@pytest.mark.parametrize("raw,clean", [("[BLANK_AUDIO]", ""), (" (music) ", ""), ("[ Silence ] yes", "yes"), ("Hello", "Hello")])
def test_clean_transcript(raw, clean):
    assert clean_transcript(raw) == clean


@pytest.mark.parametrize("said,state,want", [
    ("Yes", False, "si"), ("yeah", False, "si"), ("Sí.", False, "si"), ("claro que sí", False, "si"),
    ("No", False, "no"), ("nope", False, "no"), ("No, only gasping", True, "no"),
    ("He is not breathing", True, "no"), ("he isn't responding", True, "no"), ("no respira", True, "no"),
    ("he is breathing", True, "si"), ("sí, respira", True, "si"),
    ("I'm breathing", False, None),            # en «¿te cuesta respirar?» no es un sí
    ("yes, he's not breathing", True, None),   # contradictorio: se repite la pregunta
    ("I don't know", False, None), ("no sé", False, None), ("[BLANK_AUDIO]", False, None), ("banana", False, None),
])
def test_yes_no(said, state, want):
    assert match_option(said, YN, state) == want


@pytest.mark.parametrize("said,want", [("about five minutes", "lt10"), ("20 minutes", "gt10"), ("more than ten", "gt10"),
                                       ("less than ten", "lt10"), ("una hora", "gt10"), ("hace poco", "lt10"), ("no sé", None)])
def test_duration(said, want):
    assert match_option(said, TIME) == want


def test_triage_voice_advances(client):
    r = client.post("/api/triage/voice", json={"flow": "companion_collapse", "node_id": "c1", "text": "No, he doesn't respond", "lang": "en"}).json()
    assert r["understood"] and r["answer"] == "no" and r["node_id"] != "c1"
    same = client.post("/api/triage/step", json={"flow": "companion_collapse", "node_id": "c1", "answer": "no"}).json()
    assert r["node_id"] == same["node_id"]  # mismo destino que con el botón


def test_triage_voice_reprompts(client):
    r = client.post("/api/triage/voice", json={"flow": "companion_collapse", "node_id": "c1", "text": "[BLANK_AUDIO]", "lang": "es"}).json()
    assert r["understood"] is False and r["node_id"] == "c1" and "sí o no" in r["say"]


def test_triage_voice_bad_node(client):
    assert client.post("/api/triage/voice", json={"flow": "companion_collapse", "node_id": "zzz", "text": "yes"}).status_code == 400


@pytest.mark.parametrize("said,want", [
    ("Alert the crew", ["alert_crew"]), ("call the commander", ["alert_commander"]),
    ("avisa al oficial médico", ["alert_commander"]), ("send it to the flight surgeon", ["send_flight_surgeon"]),
    ("avisa a la tripulación y a Tierra", ["alert_crew", "send_flight_surgeon"]), ("alert everyone", ["alert_crew", "alert_commander", "send_flight_surgeon"]),
    ("avisa a todos", ["alert_crew", "alert_commander", "send_flight_surgeon"]), ("what time is it", []), ("[BLANK_AUDIO]", []),
])
def test_commands(said, want):
    from voice_answer import match_commands
    assert match_commands(said) == want


def test_triage_command_endpoint(client):
    r = client.post("/api/triage/command", json={"text": "Yes, please", "lang": "en"}).json()
    assert r["confirm"] is True and r["actions"] == []
    r = client.post("/api/triage/command", json={"text": "No", "lang": "en"}).json()
    assert r["confirm"] is False
    r = client.post("/api/triage/command", json={"text": "sí, avisa al comandante", "lang": "es"}).json()
    assert r["confirm"] is True and r["actions"] == ["alert_commander"]


@pytest.mark.parametrize("said,wake,rest", [
    # transcripciones reales de whisper (14-nov) para «Metis, …»
    ("Meti's I slept badly.", True, "I slept badly."), ("Medis, I slept badly.", True, "I slept badly."),
    ("Hey, Meti's, how is my heart rate?", True, "how is my heart rate?"), ("Hey, Medys, how is my heart rate?", True, "how is my heart rate?"),
    ("Maddie's.", True, ""), ("Meti's.", True, ""), ("Me tiis como he dormido.", True, "como he dormido."),
    ("Metís como he dormido.", True, "como he dormido."), ("Oye, Meti's.", True, ""), ("¡Oh, y metis!", True, ""),
    ("Metis", True, ""), ("METIS, call the commander", True, "call the commander"),
    ("I slept badly", False, None), ("the matrix is great", False, None), ("we need more data on Metis", False, None),
    ("", False, None), ("[BLANK_AUDIO]", False, None),
])
def test_wake(said, wake, rest):
    from voice_answer import match_wake
    w, r = match_wake(said)
    assert w == wake and (rest is None or r == rest)


def test_wake_endpoint(client):
    d = client.post("/api/voice/wake", json={"text": "Hey Meti's, how did I sleep?"}).json()
    assert d["wake"] and d["command"] == "how did I sleep?" and not d["emergency"]
    d = client.post("/api/voice/wake", json={"text": "Marco collapsed!"}).json()
    assert not d["wake"] and d["emergency"]          # emergencia sin palabra de activación
    d = client.post("/api/voice/wake", json={"text": "lunch is ready"}).json()
    assert not d["wake"] and not d["emergency"] and d["command"] == ""


@pytest.mark.parametrize("said,end", [
    ("Thanks, Meti's, Tatsari.", True), ("Thanks Metis", True), ("thank you", True), ("That's all.", True), ("Finish.", True),
    ("Gracias Metis", True), ("Eso es todo", True), ("Terminar", True), ("Adiós", True), ("ok bye", True),
    ("Thanks, and how did I sleep last night?", False), ("I feel tired", False), ("How is my heart rate?", False), ("", False),
])
def test_end(said, end):
    from voice_answer import match_end
    assert match_end(said) == end
