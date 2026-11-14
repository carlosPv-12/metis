# Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
"""Configuración común: sin IA (frases de reserva), retraso de 1 s y el backend importable."""
import os, pathlib, sys

os.environ["METIS_LLM_URL"] = ""
os.environ.setdefault("METIS_DELAY_S", "1")
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="session")
def client():
    import main
    return TestClient(main.app)
