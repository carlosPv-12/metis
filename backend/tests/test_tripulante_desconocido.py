# Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
"""Preguntar por alguien que no está a bordo: Metis dice que no es de la tripulación (regla fija, sin IA).
Antes la IA contestaba que esa persona estaba bien (Carlos, 15-nov)."""
import pytest


@pytest.mark.parametrize("msg,who", [("How is David?", "David"), ("how's David doing?", "David"), ("Is David okay?", "David"),
                                     ("Metis, how is Sarah?", "Sarah")])
def test_nombre_desconocido_en(client, msg, who):
    d = client.post("/api/metis/chat", json={"message": msg, "crew_id": "lena", "lang": "en"}).json()
    assert d["source"] == "rule" and d["ai_generated"] is False and d["unknown_person"] == who
    assert d["text"] == f"{who} isn't part of this crew. On board are Lena, Marco, Noor and Kenji. Ask me about any of them."


def test_nombre_desconocido_es(client):
    d = client.post("/api/metis/chat", json={"message": "¿Cómo está David?", "crew_id": "lena", "lang": "es"}).json()
    assert d["source"] == "rule" and d["text"].startswith("David no es de esta tripulación. A bordo están Lena, Marco, Noor y Kenji.")


@pytest.mark.parametrize("msg", ["How is Marco?", "How is the crew?", "Is Lena okay?", "How is it going?", "How is my sleep?",
                                 "How is the ship?", "How is Earth?", "Is it bad?"])
def test_no_salta_con_tripulantes_ni_frases_normales(client, msg):
    d = client.post("/api/metis/chat", json={"message": msg, "crew_id": "kenji", "lang": "en"}).json()
    assert "unknown_person" not in d


# ---------- revisión del 15-nov ----------
@pytest.mark.parametrize("msg", ["Is Tylenol safe to take?", "Is Ibuprofen okay with this?", "Is Monday a rest day?", "My name is Carlos"])
def test_no_secuestra_medicacion_ni_otras_preguntas(client, msg):
    d = client.post("/api/metis/chat", json={"message": msg, "crew_id": "lena", "lang": "en"}).json()
    assert "unknown_person" not in d and "part of this crew" not in d["text"]


def test_medicacion_manda_sobre_el_nombre(client):
    # «Is Ibuprofen okay» casa con la regla del nombre, pero la de medicación va antes
    d = client.post("/api/metis/chat", json={"message": "Is Ibuprofen okay, what dose?", "crew_id": "lena", "lang": "en"}).json()
    assert d["source"] == "rule" and "medication" in d.get("note", "") and "unknown_person" not in d


@pytest.mark.parametrize("msg,real", [("How is Marko?", "Marco"), ("How is Lina?", "Lena"), ("How is Kenzie?", "Kenji"), ("How is Nor?", "Noor")])
def test_nombre_mal_transcrito_es_el_tripulante(client, msg, real):
    d = client.post("/api/metis/chat", json={"message": msg, "crew_id": "noor", "lang": "en"}).json()   # Noor (CMO) ve a todos
    assert "unknown_person" not in d and d["source"] == "rule" and d["text"].startswith(real + ":")
