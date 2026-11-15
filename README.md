# Metis

**A private, offline AI health companion for each astronaut.** Built by team Te Falta Tech for the NASA Space Apps Challenge 2026 (Madrid), challenge 04: *Create Health Monitoring Software for Astronauts on Space Missions*.

Metis learns each crew member's own baseline, watches their vitals, relates sleep to cabin CO₂, guides the crew through a medical emergency step by step, and keeps the flight surgeon on Earth informed across the link delay. Everything runs on the habitat computer: **nothing needs Earth to work.**

> This is a hackathon prototype, not a medical device. The crew is fictional and their vitals are simulated; the blood counts are real (NASA OSDR OSD-569). Metis does not diagnose and never names drugs or doses.

## See it in one minute

No install needed: download [`demo/metis-demo.html`](demo/metis-demo.html) and open it with a double click (Chrome, Edge, Firefox or Safari). It is the whole interface in a single file. Without a server it uses scripted lines and the browser's voice, and says so on screen ("Standalone file · scripted lines"). Details in [demo/LEEME.md](demo/LEEME.md) (Spanish).

## Run the full demo (local AI, voice and speech recognition)

Works on macOS (Apple Silicon) and Linux or WSL2 (x86_64). Windows without WSL2 is not supported. No admin rights, Homebrew, Xcode or apt needed.

```bash
git clone https://github.com/carlosPv-12/metis.git
cd metis
bash instalar.sh        # one time: downloads about 3.7 GB into ~/.local/share/metis/
bash arrancar.sh        # every time: starts everything and opens http://localhost:8000/
```

- **What the installer does:** it downloads a private Python 3.12, the pinned backend dependencies and the models (listed under [Third-party models](#third-party-models)), and checks every file against its SHA-256. If it is interrupted, run it again and it resumes. At the end it starts everything on test ports and prints what works and what does not. To repeat only that check: `bash instalar.sh --comprobar`.
- **To edit the code:** `bash instalar.sh --dev` (adds Node 24 and the frontend dependencies) and `bash arrancar.sh --dev`. Then open **http://localhost:5173/**, which serves the source with live reload.
- **Mind the port:** `http://localhost:8000/` serves the prebuilt single-file demo. After changing the frontend, rebuild it with `python3 demo/construir.py`, or use the `--dev` mode above.
- **No models?** The demo still runs, with scripted lines and the browser's voice. `bash arrancar.sh --no-llm` skips the language model.
- **Tests:** `cd backend && python -m pytest` (needs `backend/requirements-dev.txt`).

More install options (serving the models over a local network, manual install) are in [docs/NOTAS-EQUIPO-14-NOV.md](docs/NOTAS-EQUIPO-14-NOV.md) (Spanish, historical).

## What it does

- **Personal baseline.** Each metric is compared with that person's own band, not a population average.
- **Live vitals and early warning.** When a crew member's vitals drift, Metis asks them if they are okay. If they ask for help, do not answer in 30 seconds, or there is no pulse, it alerts the crew and the medical officer on its own.
- **Guided triage.** A deterministic decision tree with cited sources, hands-free by voice or with buttons. Two flows: a crewmate collapses, and chest pressure in yourself.
- **Voice.** Say "Metis" and talk. An emergency phrase does not need the wake word.
- **Earth messages.** In an emergency Metis sends a message to the flight surgeon on Earth and says so. The crew sees each message, its status and a live countdown; Earth's answer appears on board only when it arrives.
- **Mission environments.** ISS, spacewalk, Moon, Mars (5 to 20 minutes one way) and no link. Without a link, messages wait in a queue and go out when it returns.
- **Ground view.** What the flight surgeon sees: the crew, their vitals, the ship, and the inbox of messages from the ship, with replies that travel back with the delay.
- **Roles and privacy.** A crew member sees only their own health data, the commander sees a summary, the medical officer and Earth see everything. Emergency alerts reach everyone.
- **Sleep × air.** Relates each person's short nights to the CO₂ peaks in their bunk.
- **Ship and medical kit.** Life support, power, radiation and kit stock, all simulated.

## How it works

```
Metis earpiece (concept)  ->  personal Metis  ->  habitat hub  --(link delay)-->  Earth: flight surgeon
```

- `data/`: parameters with a source for each value (`config.json`), the simulated crew generator and the real blood counts.
- `backend/` (FastAPI, no database): vitals, triage, roles, mission link, messages with Earth, voice. Full API with examples in [API.md](API.md) (Spanish).
- `frontend/` (Vite, React, TypeScript): the ship screens and the Ground view.
- `demo/`: the single-file build of the frontend.

**The AI never decides a medical action.** The triage is a fixed tree (`backend/triage_tree.json`), and emergencies, crew status, medication and diagnosis questions are answered by fixed rules. The language model only words the conversational replies, and anything it writes is marked `ai_generated`. If the model is not running, Metis falls back to scripted lines.

More detail, including the earpiece concept and the knowledge graph, in [docs/SOBRE-METIS.md](docs/SOBRE-METIS.md) (Spanish).

## NASA data and sources

| Source | Used for |
|---|---|
| [NASA OSDR OSD-569](https://osdr.nasa.gov/osdr/data/osd/files/569), complete blood counts from Inspiration4 (**real data**) | Blood panel: personal preflight baseline against the first day after return (R+1) |
| NASA Human Research Program, [risks](https://www.nasa.gov/hrp/risks/) and [hazards](https://www.nasa.gov/hrp/hazards/) | The risk named behind each alert and each point on the body |
| [NASA OCHMO-TB-004 Rev D, Carbon Dioxide](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-004-carbon-dioxide.pdf) | Cabin CO₂ limits and early-warning levels |
| [NASA OCHMO-TB-041 Rev A, Sleep Accommodations](https://www.nasa.gov/wp-content/uploads/2023/03/sleep-accomodations-technical-brief-ochmo.pdf) | Recommended sleep |
| [NASA-STD-3001 Vol. 1 Rev C](https://standards.nasa.gov/sites/default/files/standards/NASA/C//nasa-std-3001-vol-1-rev-c-signature.pdf) | Crew Medical Officer role |
| [NASA HRP Evidence Report, Risk of Cardiac Rhythm Problems During Spaceflight](https://ntrs.nasa.gov/citations/20170005625) | Why a rhythm problem needs an ECG to confirm |

Every threshold carries its source in `data/config.json` and is served at `/api/thresholds`; values that are our own assumptions are marked `verified: false`. The full table and the sources of the triage protocols are in [docs/SOBRE-METIS.md](docs/SOBRE-METIS.md).

**Simulated:** the crew (Lena, Marco, Noor, Kenji), their vitals and 30-day history, the ship systems, the medical kit, the link delays and the earpiece, which is a concept and not a built device. **Not medically reviewed:** the triage texts cite their sources but no clinician has reviewed them.

## Third-party models

All run locally and keep their own licenses.

| Model | Role | License |
|---|---|---|
| Qwen3-4B-Instruct-2507 (Q4_K_M) on llama.cpp | Wording of conversational replies | Apache-2.0 |
| Kokoro-82M v1.0 | Voice | Apache-2.0 |
| OpenAI Whisper `base` and `small` on whisper.cpp | Speech recognition; `small` is a second listener used only to catch emergencies | MIT |

Fonts and visual credits are listed in [docs/SOBRE-METIS.md](docs/SOBRE-METIS.md).

## Use of AI

This project was built with AI assistance (Claude, by Anthropic) for code, tests and documentation. Every source file carries the header "Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026". At run time, a local language model words Metis's conversational replies, a local model produces its voice and another one transcribes speech; the Talk screen labels each reply as coming from the local model or from a scripted line. Medical guidance comes from a deterministic tree, not from a model.

## License

Team code under [Apache-2.0](LICENSE). Third-party models, libraries and data keep their own licenses.
