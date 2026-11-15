# Metis — esqueleto del prototipo (NASA Space Apps 2026, reto 04)

Compañero IA privado para cada astronauta: aprende su línea base, cruza sueño × CO2 de cabina, hace triaje guiado (también «un compañero se desploma con dolor torácico») y deja resumen para el cirujano de vuelo. **Funciona sin conexión.** Plan: `notas/2026-11-14--metis-aterrizado.md` del brain.

> Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026.

## Cómo arrancar

**Ver la demo sin instalar nada**: abre `demo/metis-demo.html` con doble clic (Chrome, Edge, Firefox o Safari). Es la demo entera en un solo archivo: todas las pantallas, el triaje completo, EN/ES y el modo director. Sin servidor, Metis usa frases guionizadas (lo indica la etiqueta «Standalone file · scripted lines»), la voz del navegador y nada de micrófono. Con el backend en marcha, `http://localhost:8000/` sirve ese mismo archivo, pero con la IA, la voz y el reconocimiento de voz locales. Para regenerarlo después de cambiar el frontend: `python3 demo/construir.py` (necesita Node 20+). Detalles en [demo/LEEME.md](demo/LEEME.md).

**Un solo comando** instala la demo completa (IA, voz y reconocimiento reales, sin conexión) en macOS (Apple Silicon) y en Linux/WSL2 x86_64, sin Homebrew, sin Xcode, sin apt y sin contraseña. Abre **Terminal** (Mac) o **Ubuntu** (WSL), entra en la carpeta del brain (`cd` + arrastrar la carpeta a la ventana) y pega:

| Quién | Solo probar la demo | Probar y editar el código |
|---|---|---|
| Manuela (Mac) y Carlos (WSL2) | `bash codigo/metis/instalar.sh` | `bash codigo/metis/instalar.sh --dev` |
| Si Tomás está sirviendo los modelos en la misma wifi | `bash codigo/metis/instalar.sh --desde http://IP:8765` | `… --desde http://IP:8765 --dev` |
| Arrancar después (cada vez) | `bash codigo/metis/arrancar.sh` → abre `http://localhost:8000/` | `bash codigo/metis/arrancar.sh --dev` → `http://localhost:5173` |

- **Qué hace**: baja `uv` (gestor de Python de astral-sh, MIT/Apache-2.0), que pone Python 3.12; luego `instalar.py` deja en `~/.local/share/metis/` llama.cpp b12373, Qwen3-4B-Instruct-2507 Q4_K_M (2,5 GB), Kokoro v1.0, `ggml-base.bin` de whisper y un venv con las versiones exactas de `backend/requirements-lock.txt`. Con `--dev`, además Node 24 LTS oficial en `~/.local/share/metis/node/` y `npm ci` en `frontend/` (`node_modules` no viaja por Syncthing). Cada archivo se comprueba con su SHA-256 (los mismos que los de Tomás); si se corta, se vuelve a pegar el mismo comando y sigue donde iba.
- **Cuánto**: se bajan unos 3,2 GB (3,0 GB de modelos; el resto, Python y dependencias) y ocupa ~3,5 GB en disco; con `--dev`, +0,2 GB de Node y +0,3 GB de `node_modules`. Medido aquí el 14-nov: 65 s con los modelos desde otro proceso en la misma máquina; por wifi depende de la red (a 10 MB/s, ~6 min).
- **Al final** arranca todo en puertos de prueba (8790/8791) y dice en claro qué FUNCIONA y qué NO VA (IA, voz, reconocimiento, página), con el siguiente paso. Repetir solo la comprobación: `bash codigo/metis/instalar.sh --comprobar`.
- **Sin internet en la sede**: en el portátil de Tomás, `bash codigo/metis/instalar.sh --servir` sirve sus modelos en solo lectura por la red local mientras está abierto y escribe el comando exacto (con su IP) para los demás. También vale una carpeta o USB: `--desde /ruta/a/la/copia`. Lo que no esté en la fuente se baja de internet.
- **Windows sin WSL**: no está soportado; el script lo dice y manda a WSL2.
- **Carlos (WSL2)**: el navegador es el de Windows; `arrancar.sh` lo abre con `wslview`/`explorer.exe` y, si no puede, imprime la URL. `http://localhost:8000/` llega a WSL por el reenvío de WSL2 (si no, `METIS_HOST=0.0.0.0 bash codigo/metis/arrancar.sh`).
- **Editar**: frontend en `frontend/src/` (Vite recarga solo con `arrancar.sh --dev`); backend en `backend/` (el venv es `~/.local/share/metis/venv/`; a mano: `cd backend && ~/.local/share/metis/venv/bin/uvicorn main:app --reload --port 8000`). Para usar el Node instalado en otra terminal: `export PATH="$HOME/.local/share/metis/node/bin:$PATH"`.
- **Reconocimiento de voz sin compilar**: si no hay `whisper-cli`, el backend usa `pywhispercpp` (ruedas precompiladas de whisper.cpp, MIT) con el mismo `ggml-base.bin`; si no hay `ffmpeg`, decodifica el audio del navegador con PyAV (BSD-3-Clause; FFmpeg LGPL dentro de la rueda). En el portátil de Tomás sigue el camino de siempre (whisper-cli + ffmpeg).

`run_demo.py` (lo que lanza `arrancar.sh`; en Linux con Python 3.10+ también `python3 run_demo.py`, en Windows `py run_demo.py`): si existe `demo/metis-demo.html` arranca solo IA local + backend y abre `http://localhost:8000/` (sin Node); con `--dev` arranca también Vite como antes. Opciones: `--no-llm`, `--no-browser`. Variables: `METIS_HOME`, `METIS_VENV`, `METIS_THREADS`, puertos `METIS_*_PORT`, `METIS_NGL` (capas en GPU; 99 por defecto en Mac Apple Silicon, Metal).

A mano, sin instalador (Linux con Python 3.10+ y Node 20.19+), desde `codigo/metis/`:

```bash
python3 data/generate_crew.py && python3 data/blood_osd569.py      # datos (stdlib, semilla fija)
cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements-lock.txt && .venv/bin/uvicorn main:app --port 8000
cd frontend && npm ci && npm run dev                                 # en otra terminal; proxy /api -> 8000
```
Sin modelos la demo funciona igual con frases de reserva y la voz del navegador.

## IA y voz sin conexión (14-nov, 03:30)

- Arranque rápido de todo: `python3 run_demo.py` (IA local + backend + frontend). Contrato de la API con ejemplos reales: [API.md](API.md). Guía de revisión: [backend/REVISION-IA-Y-VOZ.md](backend/REVISION-IA-Y-VOZ.md).
- IA: llama.cpp `llama-server` en :8081 con Qwen3-4B-Instruct-2507 Q4_K_M (Apache-2.0); `METIS_LLM_URL` vale por defecto `http://127.0.0.1:8081/v1`. Solo redacta; emergencias y medicación las contesta una regla.
- Voz: Kokoro-82M (Apache-2.0; `af_heart` EN, `ef_dora` ES) con reserva espeak-ng; oído: whisper.cpp `base`. Modelos en `~/.local/share/metis/` (fuera del brain).
- Umbrales con fuente en `data/config.json` → `catalog` (`/api/thresholds`); ya no queda ningún «PENDIENTE».

## Arquitectura

1. `data/`: `config.json` (parámetros + `source` por valor) -> `generate_crew.py` -> `crew_lena.json` (Lena y Marco, 30 días, deriva de 3 noches en Lena). `blood_osd569.py` -> `blood_osd569.json` (hemograma real).
2. `backend/main.py` (FastAPI): sirve esos JSON, el triaje y la frase de Metis. Sin base de datos.
3. Triaje = árbol determinista `backend/triage_tree.json`. **La IA nunca decide la acción médica; solo redacta.**
4. `/api/metis/say` llama a un endpoint compatible OpenAI en localhost; si falla, devuelve la frase guionizada.
5. `frontend/` (Vite + React + TS): 6 pantallas placeholder que consumen la API; contratos en `src/api.ts`.
6. `voice/`: adaptador STT/TTS con stub; el modelo lo elige Juan.
7. Los textos del triaje son de EJEMPLO («PENDIENTE DE VALIDAR CON FUENTES NASA») y sin diagnósticos ni dosis.
8. Valores de `config.json` marcados `PENDIENTE: nasa-fuentes-verificadas`: son plausibles, no citas.
   Corrección 2026-11-14: ya no queda ningún PENDIENTE; cada valor lleva su fuente o está marcado como supuesto (`verified:false`). Los textos del triaje son bilingües y llevan fuentes (ver `investigacion/triaje-validado.md`); siguen sin revisión médica.
9. Datos de Lena y Marco: simulados y ficticios. Hemograma: real, NASA OSDR OSD-569 (Inspiration4).
10. No hay logos de NASA ni claves en el repo.

## Contratos de la API (tipos en `frontend/src/api.ts`)

| Método y ruta | Cuerpo | Respuesta |
|---|---|---|
| GET `/api/health` | | `{status, llm_configured, offline_ready}` |
| GET `/api/crew` | | `{co2_limit_mmhg:{value,source}, simulated, crew:[{id,name,role,today_out_of_band}]}` |
| GET `/api/crew/{id}` (`lena`, `marco`) | | resumen + `baseline{metric:{mean,sd,band_low,band_high}}` + `days[30]` + `sources` |
| GET `/api/blood` | | por C001–C004: analitos con línea base, R+1, rango de referencia y banderas |
| POST `/api/triage/step` | `{flow, node_id?, answer?}` (`flow`: `companion_collapse` \| `self_chest_pressure`; sin `node_id` = empezar) | `{node_id, node}`; `node.type` = `question` (`text`, `why`, `options[{id,label,next}]`) o `result` (`level`, `title`, `steps`, `surgeon_summary`, `warning`) |
| POST `/api/metis/say` | `{topic, context?}` (`topic` = clave de `fallback_lines.json`) | `{text, source: llm\|fallback, ai_generated}` |

## Qué falta (TODO)

- **Carlos (front)**: diseño final de las 6 pantallas (marcadas con `TODO` en `src/screens/`); figura humana SVG clicable; subtítulos; selector nave/base lunar; estado sin conexión; botón de micrófono; resumen del cirujano «en cola por retraso»; marca visible de contenido generado por IA.
- **Manuela (back)**: guardar el resumen del triaje (endpoint nuevo); guion/textos de reserva; revisar el árbol de triaje y sus textos con las fuentes; en `/api/metis/say` enviar contexto real (último día de Lena); declarar en pantalla qué sale de un LLM.
- **Juan (voz)**: elegir e implementar STT y TTS locales en `voice/` (ver `voice/README.md`).
- **Investigación de umbrales (pendiente)**: sustituir todo `PENDIENTE: nasa-fuentes-verificadas` en `data/config.json` (y el límite de CO2) por valores citados, o declararlos como supuestos; validar el árbol de triaje con fuentes NASA/HRP.
- **Equipo**: probar la demo sin red en el portátil; congelar funciones el domingo 14:00.

## Licencia

Código del equipo bajo [Apache-2.0](LICENSE). Los modelos, bibliotecas y datos de terceros conservan su propia licencia (por ejemplo, Qwen3-4B-Instruct-2507 y Kokoro-82M, Apache-2.0; datos NASA OSDR OSD-569).

## Uso de IA

Este esqueleto se generó con asistencia de IA (Claude, de Anthropic), como exige la guía 2026 («Code and data: Must acknowledge SI generation in descriptive text and metadata»). Cada archivo de código lleva la cabecera «Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026». En ejecución, la IA local solo redacta frases (`/api/metis/say` marca `ai_generated`); el triaje es un árbol determinista. Los datos de los tripulantes son simulados; el hemograma es real (NASA OSDR OSD-569). Metis no diagnostica.
