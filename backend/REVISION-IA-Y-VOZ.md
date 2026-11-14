# Revisión de IA y voz (para Carlos y Manuela, sábado 14)

> Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026. Estado del 14-nov, 03:30. Contrato completo: [../API.md](../API.md).

## Qué hay

| Pieza | Archivo | Motor (sin conexión) |
|---|---|---|
| IA que redacta | `llm.py` | llama.cpp `llama-server` (puerto 8081) con Qwen3-4B-Instruct-2507 Q4_K_M (Apache-2.0), 2,5 GB |
| Voz (TTS) | `voice_engine.py` | Kokoro-82M ONNX (Apache-2.0) → Piper → espeak-ng |
| Oído (STT) | `voice_engine.py` | whisper.cpp + modelo `ggml-base` multilingüe, ffmpeg |
| Centralita, eventos, grafo | `station.py` | datos simulados en memoria |
| Triaje | `triage_tree.json` | árbol determinista EN/ES con fuentes |
| API | `main.py` | FastAPI |

Los modelos y binarios viven fuera del brain, en `~/.local/share/metis/` (o `METIS_HOME`): `llama.cpp/`, `models/`, `kokoro/`, `piper/`, `whisper.cpp-src/`. En otro ordenador hay que descargarlos (ver «Instalar en otra máquina»).

## Arrancar

```bash
cd codigo/metis
bash arrancar.sh             # IA local + backend; abre http://localhost:8000/ (demo de un archivo)
bash arrancar.sh --dev       # además Vite (5173) para editar
python3 run_demo.py          # lo mismo con un Python 3.10+ del sistema (Linux)
python3 run_demo.py --no-llm # sin IA: frases de reserva
```
A mano: `cd backend && .venv/bin/uvicorn main:app --port 8000` (Windows: `.venv\Scripts\uvicorn`).

## Probar cada endpoint (curl)

```bash
B=http://localhost:8000
curl $B/api/status                                   # llm.ok, tts.engine, stt.ok
curl -XPOST $B/api/metis/say  -H 'content-type: application/json' -d '{"crew_id":"lena","lang":"en"}'
curl -XPOST $B/api/metis/chat -H 'content-type: application/json' -d '{"crew_id":"lena","lang":"es","message":"Hoy estoy cansada"}'
curl -XPOST $B/api/triage/step -H 'content-type: application/json' -d '{"flow":"companion_collapse","lang":"es"}'
curl -XPOST $B/api/voice/tts  -H 'content-type: application/json' -d '{"text":"Hello Lena","lang":"en"}' -o hola.wav
curl -F audio=@hola.wav $B/api/voice/stt
curl $B/api/station ; curl $B/api/station/events ; curl $B/api/brain/graph ; curl $B/api/thresholds
```
O en el navegador: `http://localhost:8000/docs`.

Latencias medidas el 14-nov con 4 hilos: frase de `say` 1,4-6,9 s (la primera es la más lenta), `chat` 4-5,5 s, TTS 0,9-1,5 s, STT 0,9-1,4 s. Generación ≈ 15 tokens/s.

## Cambios tras la verificación (14-nov, 04:00)

- Triaje del compañero rehecho en el orden de soporte vital básico; compresiones solo si no responde y no respira con normalidad. «Presión intensa» nunca termina sin escalar (nodo `s9`).
- Chat: reglas para emergencias indirectas («fell», «no contesta»…), malestar psicológico grave (`PSYCH`, respuesta cálida que propone CMO y apoyo psicológico de Tierra), medicación (`MEDQ` con nombres de fármaco y sedantes) y peticiones de diagnóstico (`DIAGQ`).
- Centralita: textos legibles EN/ES (`?lang=es` añade `text`), noches fuera de banda calculadas de los datos, retraso con la fuente de Resources (hasta 20 min por sentido; 300 s es el valor del escenario).
- Hemoglobina en g/dL; bandera del hemograma con margen del 5 %; ventana de línea base única (`baseline_window`).

## Qué hay que vigilar

- **El modelo de 4B se equivoca con «más alto / más bajo»** si solo ve números: por eso `facts_for()` le da los hechos ya redactados («HIGHER than usual»). Si cambiáis los datos, mirad que la frase siga siendo cierta.
- **Seguridad**: emergencias y preguntas de medicación las contesta una regla (`EMERGENCY`, `MEDQ` en `llm.py`), nunca el modelo. Cualquier salida con fármacos o dosis (`FORBIDDEN`) o que atribuya algo a NASA se descarta y sale la frase de reserva.
- **No decir «according to NASA»**: prohibido por las directrices de NASA para productos de IA (`raw/2026-11-14--nasa-directrices-imagenes-y-marca.md`, línea 52). Va en el prompt y en el filtro `strip_attribution()`.
- **Triaje**: nadie médico lo ha revisado. Lista de dudas en `investigacion/triaje-validado.md`.

## Qué falta (priorizado)

1. Que un médico (o Manuela con las fuentes) revise los 5 puntos de `investigacion/triaje-validado.md`, sobre todo el posible infratriaje s2 → s4.
2. Que Juan escuche las muestras (`archivos/2026-11-14--muestras-de-voz/`) y elija voz; se cambia con `METIS_VOICE_EN` / `METIS_VOICE_ES`.
3. Precalentar: la primera llamada a TTS carga Kokoro (~1 s más). Antes de grabar el vídeo, llamad una vez a `/api/voice/tts` y a `/api/metis/say`.
4. Guardar los eventos de la centralita en disco (hoy se pierden al reiniciar).
5. Respuesta en streaming del chat (bajaría la espera percibida de ~5 s a ~1 s).
6. Probar en el portátil de la demo **sin red** (wifi apagada) de punta a punta.

## Instalar en otra máquina

Un comando, desde la carpeta del brain (detalle y tabla de modos en [../README.md](../README.md), «Cómo arrancar»):

- **Manuela (Mac Apple Silicon)**, en Terminal: `bash codigo/metis/instalar.sh` (solo probar) o `bash codigo/metis/instalar.sh --dev` (probar y editar). No hace falta Homebrew, Xcode, Python ni Node.
- **Carlos (Ubuntu 24.04 en WSL2)**, en la terminal de Ubuntu: los mismos dos comandos. No hace falta `apt`, `python3-venv` ni `pip`.
- **Sin internet**: Tomás lanza `bash codigo/metis/instalar.sh --servir` y los demás añaden `--desde http://IP-de-Tomás:8765` (el instalador imprime la IP). O `--desde <carpeta>` con una copia (USB).
- Después, cada vez: `bash codigo/metis/arrancar.sh` (abre `http://localhost:8000/`) o `bash codigo/metis/arrancar.sh --dev` (Vite en `http://localhost:5173`).
- Al final el instalador prueba IA, voz, reconocimiento y página en puertos 8790/8791 y dice qué va y qué no. Solo la prueba: `--comprobar`. Registro: `~/.local/share/metis/comprobacion.log`.

Qué queda en `~/.local/share/metis/` (las rutas que ya buscan `run_demo.py`, `llm.py` y `voice_engine.py`), todo con SHA-256 fijado en `../instalar.py` e igual al del portátil de Tomás:

| Pieza | Origen | Licencia |
|---|---|---|
| `llama.cpp/llama-b12373/` | release oficial `ggml-org/llama.cpp` b12373 (`macos-arm64` con Metal; `ubuntu-x64`) | MIT |
| `models/Qwen3-4B-Instruct-2507-Q4_K_M.gguf` | `unsloth/Qwen3-4B-Instruct-2507-GGUF`, commit fijado | Apache-2.0 |
| `kokoro/kokoro-v1.0.onnx`, `kokoro/voices-v1.0.bin` | release `model-files-v1.0` de `thewh1teagle/kokoro-onnx` (la v1.1 falla con kokoro-onnx 0.4.7) | Apache-2.0 |
| `whisper.cpp-src/models/ggml-base.bin` | `ggerganov/whisper.cpp` en Hugging Face, commit fijado | MIT |
| `venv/` | `requirements-lock.txt` (las versiones del venv de Tomás + `pywhispercpp` MIT y `av` BSD-3-Clause) | varias OSI |
| `bin/uv`, `python/` | uv 0.13.6 de `astral-sh/uv` y su Python 3.12 | MIT/Apache-2.0, PSF |
| `node/` (solo `--dev`) | Node v24.22.2 LTS de nodejs.org (`SHASUMS256.txt`) | MIT |

Reconocimiento sin compilar: si no existe `whisper-cli`, `voice_engine.py` usa `pywhispercpp` con el mismo `ggml-base.bin`; si no hay `ffmpeg` (o con `METIS_FFMPEG=off`), decodifica el audio del navegador (webm/opus de Chrome, mp4/aac de Safari) con PyAV. `/api/status` lo dice en `stt.engine` y `stt.decoder`. El camino de Tomás (whisper-cli compilado + ffmpeg) no cambia. Compilar whisper.cpp a mano sigue valiendo: `git clone https://github.com/ggml-org/whisper.cpp ~/.local/share/metis/whisper.cpp-src` y `cmake -B build && cmake --build build -j4 --config Release --target whisper-cli`.

Windows nativo (Juan): no soportado por el instalador; usar WSL2.
