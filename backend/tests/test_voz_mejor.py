# Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
"""Palabra de activación con voz real (Carlos, 15-nov): «Metis» sin la «s», detrás de un trozo de ruido,
y frases que whisper se inventa con silencio."""
import pytest
from voice_answer import clean_transcript, match_end, match_wake


@pytest.mark.parametrize("said,rest", [
    ("Meti.", ""), ("Medici.", ""), ("Medi, how is the crew?", "how is the crew?"), ("Hey, Maddie, how is Lena?", "how is Lena?"),
    ("But I'm not in a hurry. Meti's, Marco is bad.", "Marco is bad."),         # ruido pegado delante
    ("Thanks for watching! Metis, help", "help"),
])
def test_despierta_con_variantes_reales(said, rest):
    assert match_wake(said) == (True, rest)


@pytest.mark.parametrize("said", ["social media is great", "Meta, the company", "mate", "Mete la bolsa", "the matrix is great",
                                  "we need more data on Metis", "I slept badly. Media.", "Metal is heavy", "Madrid"])
def test_no_despierta_con_palabras_parecidas(said):
    assert match_wake(said)[0] is False


@pytest.mark.parametrize("raw,clean", [
    ("Thank you for your time, and I'll see you next time.", ""), ("Thanks for watching!", ""),
    ("Thank you for your time. Thank you.", "Thank you."), ("Subtítulos realizados por la comunidad de Amara.org", ""),
    ("Thank you.", "Thank you."), ("Thank you, Metis, how is Marco?", "Thank you, Metis, how is Marco?"),
])
def test_quita_frases_inventadas_por_whisper(raw, clean):
    assert clean_transcript(raw) == clean


def test_frase_inventada_no_cierra_la_conversacion():
    assert match_end("Thank you for your time, and I'll see you next time.") is False
    assert match_end("Thank you.") is True                                       # un «gracias» de verdad sí la cierra


def test_wake_por_la_api(client):
    d = client.post("/api/voice/wake", json={"text": "But I'm not in a hurry. Meti, how is Kenji?"}).json()
    assert d["wake"] is True and d["command"] == "how is Kenji?"
