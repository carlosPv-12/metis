# voice/ — adaptador de voz

> Actualización 2026-11-14 03:30: la voz ya está implementada en `../backend/voice_engine.py` (Kokoro-82M para TTS, whisper.cpp para STT) y expuesta en `/api/voice/*`. Este adaptador queda como interfaz de referencia. Juan elige la voz final con las muestras de `archivos/2026-11-14--muestras-de-voz/` (ver `investigacion/voces-sin-conexion.md`).

Requisito: **STT y TTS locales, sin conexión** en el portátil de la demo.

- `adapter.py` define `STT.transcribe(wav, lang)` y `TTS.speak(text, lang)` y trae stubs (`StubSTT`, `StubTTS`).
- Juan elige el modelo y reemplaza los stubs (por ejemplo whisper.cpp / Vosk para STT; Piper u otro para TTS: decisión de Juan, no está tomada).
- **No usar la Web Speech API de Chrome para reconocimiento como solución: envía audio a la nube, no es offline.** Solo vale como stub de desarrollo, y debe quedar marcado así en el código.
- Contrato: español, audio 16 kHz mono; si falla, el frontend cae a entrada por texto.
- Pendiente de conectar: endpoints en `backend/main.py` y el botón de micrófono en `frontend/src/screens/Greeting.tsx`.

Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
