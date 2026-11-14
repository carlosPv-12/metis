# Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
"""Interfaz de voz de Metis. Juan elige el modelo offline e implementa estas dos clases.
El backend aún NO las llama: conectar (p. ej. endpoint /api/voice/*) cuando haya implementación."""
from abc import ABC, abstractmethod

class STT(ABC):
    @abstractmethod
    def transcribe(self, wav_bytes: bytes, lang: str = "es") -> str:
        """Audio 16 kHz mono PCM -> texto. DEBE funcionar sin conexión."""

class TTS(ABC):
    @abstractmethod
    def speak(self, text: str, lang: str = "es") -> bytes:
        """Texto -> audio WAV. DEBE funcionar sin conexión."""

class StubSTT(STT):
    def transcribe(self, wav_bytes: bytes, lang: str = "es") -> str:
        return "me noto presión en el pecho"  # STUB: texto fijo de la demo

class StubTTS(TTS):
    def speak(self, text: str, lang: str = "es") -> bytes:
        return b""  # STUB: sin audio; el frontend muestra solo subtítulo
