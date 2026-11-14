# API de Metis (backend FastAPI, puerto 8000)

> Corrección 2026-11-14 04:00: triaje del compañero rehecho (nodos `c2` sin respuesta, `c2r` con respuesta, `c3b`, `c3r`) y nodo `s9` en el de presión torácica; chat con reglas `PSYCH` (`safety:"escalated"`, `suggest:"cmo_and_psych_support"`) y `DIAGQ`; `/api/station?lang=es` y `/api/station/events?lang=es` añaden `text`; `comms` con `range_max_s:1200`, `scenario_value:true` y fuente principal NASA HRP «Distance from Earth»; `alerts[].nights` calculado de los datos; `baseline_window {start_day:83, end_day:103, days:21, …}` en `/api/crew`, `/api/crew/{id}` y en `baseline_days`/`baseline_band_sd` de `/api/thresholds`; `/api/blood` con hemoglobina en g/dL, `personal_band_margin_pct:5` y `unit_notes`; `/api/voice/voices` sin Piper lessac.

> Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026. Contrato del 14-nov-2026, 03:30. Los ejemplos son respuestas reales del backend (recortadas con «…»). Documentación interactiva: `http://localhost:8000/docs`.

Reglas comunes:
- Todo funciona **sin conexión**. Si falta el modelo de IA o la voz, el endpoint responde con una **reserva** (`source: "fallback"` o motor `espeak-ng`) y nunca un error que rompa la pantalla. Solo `/api/voice/tts` y `/api/voice/stt` devuelven 503 con `{error}` si no hay ningún motor.
- `lang`: `"en"` (inglés americano, por defecto) o `"es"`. Cualquier otro valor se trata como `"en"`.
- La IA **solo redacta**. Las decisiones médicas salen del árbol `backend/triage_tree.json` (`deterministic: true`). Las preguntas sobre medicación y los mensajes que suenan a emergencia los contesta una regla, no el modelo (`source: "rule"`).
- La IA nunca atribuye nada a NASA («according to NASA» y similares están prohibidos en el prompt y se filtran a la salida). Las fuentes se enseñan en pantalla con `sources`, no se pronuncian.
- Datos de tripulantes, centralita, auriculares e inventario: **simulados** (`simulated: true`). Hemograma: real (NASA OSDR OSD-569).

## Existentes (compatibles hacia atrás)

| Método y ruta | Cuerpo | Respuesta |
|---|---|---|
| GET `/api/health` | | `{status, llm_configured, offline_ready}` |
| GET `/api/crew` | | `{co2_limit_mmhg:{value,source}, simulated, crew:[{id,name,role,role_en,today_out_of_band}]}` |
| GET `/api/crew/{id}` (`lena`, `marco`) | | resumen + `baseline` + `days[30]` + `sources` + `role_en` |
| GET `/api/blood` | | hemograma OSD-569 por C001–C004 |
| POST `/api/triage/step` | `{flow, node_id?, answer?, lang?}` | ver abajo |
| POST `/api/metis/say` | `{crew_id?, context?, lang?, topic?}` | ver abajo |

### POST /api/triage/step
`flow`: `companion_collapse` | `self_chest_pressure`. Sin `node_id` empieza. Misma forma que antes (`node.type` = `question` con `text, why, options[{id,label,next}]`, o `result` con `level` (`rojo|naranja|amarillo`), `title, steps, surgeon_summary, warning`), con los textos en el idioma pedido y además `say`, `sources`, `escalate`, `lang`, `deterministic`.

```json
// {"flow":"companion_collapse","node_id":"c5","answer":"si","lang":"en"}
{"flow":"companion_collapse","flow_title":"A crewmate collapses with chest pain","node_id":"c7",
 "node":{"type":"result","level":"rojo","title":"High priority: full rest and immediate call to the CMO and flight surgeon",
  "steps":["Full rest, comfortable position, never leave them alone.","Call the CMO now. Keep the AED and emergency kit next to you.", "…"],
  "surgeon_summary":"Chest pain with warning signs after a collapse. CMO called; summary sent to the flight surgeon.",
  "warning":"Prototype guidance. Steps are anchored to the cited sources but have NOT been reviewed by a physician. …"},
 "offline":true,"lang":"en","say":"Stay with them. I'm calling the medical officer and sending a summary to the flight surgeon.",
 "sources":[{"title":"NASA OCHMO-TB-033 Rev C, Spaceflight Experience and Medical Care","url":"https://www.nasa.gov/wp-content/uploads/2023/07/ochmo-tb-033-spaceflight-experience-medical-care-rev-c.pdf"}, "…"],
 "escalate":true,"deterministic":true}
```

### POST /api/metis/say
`topic` (opcional): `greeting` (por defecto), `sleep_co2`, `offer_checkup` u otra clave de `fallback_lines.json`. `context`: texto extra opcional. El backend calcula los hechos del tripulante (más alto / más bajo que su banda) y el modelo solo los redacta.

```json
// {"crew_id":"lena","lang":"en","topic":"greeting"}
{"text":"Lena, your resting heart rate is higher than usual. How are you feeling today?","source":"llm","latency_ms":1952,"ai_generated":true,"model":"qwen3-4b-instruct-2507","lang":"en"}
// sin IA:
{"text":"Buenos días, Lena. Tu pulso en reposo está más alto de lo habitual y llevas tres noches durmiendo unas cinco horas. ¿Cómo te encuentras?","source":"fallback","latency_ms":4,"ai_generated":false,"lang":"es","fallback_reason":"ConnectError"}
```

## Nuevos

### POST /api/metis/chat
Cuerpo `{crew_id, message, lang, history?:[{role:"user"|"assistant", content}]}` (se usan los 6 últimos). Respuesta `{text, source:"llm"|"fallback"|"rule", latency_ms, safety:"ok"|"escalated", suggest_flow?, lang, ai_generated}`. Como mucho dos frases; nunca diagnostica ni receta.

```json
// {"message":"I feel a bit tired and lonely today."}
{"text":"I know that feeling. Try listening to a short playlist—something with soft music or nature sounds—for five minutes when you wake up.","source":"llm","latency_ms":4230,"safety":"ok","lang":"en","ai_generated":true}
// {"message":"Marco just collapsed, he is holding his chest"}  -> abrir el triaje sugerido
{"text":"That sounds urgent. I'm opening the emergency checklist and alerting your medical officer now.","source":"rule","latency_ms":0,"safety":"escalated","suggest_flow":"companion_collapse","lang":"en","ai_generated":false}
// {"lang":"es","message":"¿Qué pastilla me tomo para dormir mejor?"}
{"text":"No puedo recomendarte medicación. Eso lo decide tu CMO o el cirujano de vuelo; puedo añadir tu pregunta a la nota de hoy.","source":"rule","safety":"ok", "…"}
```

### GET /api/status
```json
{"llm":{"ok":true,"model":"qwen3-4b-instruct-2507","url":"http://127.0.0.1:8081/v1"},
 "tts":{"ok":true,"engine":"kokoro-82m","voices":{"en":"kokoro:af_heart","es":"kokoro:ef_dora"},"loaded":false,"error":null},
 "stt":{"ok":true,"engine":"whisper.cpp","model":"ggml-base.bin"},"offline":true}
```
Sin modelos: `tts.engine = "espeak-ng (fallback)"`, `stt.ok = false`, `llm.ok = false`.

### GET /api/thresholds
Lista de `{id, label_en, label_es, value, unit, rule, source_title, source_url, verified}` (12 entradas, de `data/config.json` → `catalog`). Los supuestos del prototipo llevan `verified:false` y `source_url:""`.
```json
{"id":"co2_1h_limit","label_en":"Cabin CO2 design limit (1-hour average)","label_es":"Límite de diseño de CO2 en cabina (media de 1 h)","value":3.0,"unit":"mmHg","rule":"1-h average ppCO2 <= 3 mmHg (vehicle design limit, not an individual clinical threshold)","source_title":"NASA OCHMO-TB-004 Rev D, Carbon Dioxide (cites NASA-STD-3001 Vol. 2 Rev D [V2 6004])","source_url":"https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-004-carbon-dioxide.pdf","verified":true}
```

### Voz
- GET `/api/voice/voices` → `[{id, label, engine, lang, license}]`, p. ej. `{"id":"kokoro:af_heart","label":"Heart (US English, female)","engine":"kokoro-82m","lang":"en","license":"Apache-2.0 (hexgrad/Kokoro-82M)"}`. Ids: `kokoro:<voz>`, `piper:<voz>`, `espeak:<voz>`.
- POST `/api/voice/tts` `{text, voice?, lang?, speed?}` → `audio/wav` (24 kHz mono con Kokoro). Cabeceras `X-Metis-Engine`, `X-Metis-Voice`, `X-Latency-Ms`. Voz por defecto: `kokoro:af_heart` (EN), `kokoro:ef_dora` (ES). Máx. 600 caracteres.
- POST `/api/voice/stt` multipart, campo `audio` (webm/ogg/wav/mp3), campo opcional `lang` (`en`, `es`, `auto` por defecto) → `{"text":"Lena, your resting heart rate is higher than usual. How are you feeling today?","lang":"en","latency_ms":1207,"engine":"whisper.cpp"}`.

### GET /api/station (centralita)
```json
{"mission_day":112,"simulated":true,
 "crew":[{"id":"lena","name":"Lena","role_en":"Flight engineer (fictional)","role_es":"Ingeniera de vuelo (ficticia)","status":"watch","location":"Crew quarters","hr":66.0,"sleep_h":4.6,"alerts":["resting_hr_bpm","hrv_ms","sleep_h","co2_night_peak_mmhg"],"note_en":"4 metrics outside personal band","note_es":"…"}, "… marco, noor (CMO), kenji"],
 "alerts":[{"id":"lena_baseline","level":"watch","crew_id":"lena","text_en":"…","text_es":"…"}],
 "environment":[{"module":"Crew quarters (bunks)","module_en":"…","module_es":"Camarotes (literas)","co2_mmhg":3.55,"co2_ppm":4670,"temp_c":22.5,"rh_pct":47,"over_limit":true}, "…"],
 "co2_unit_note":"ppm = mmHg / 760 x 1e6, assuming 760 mmHg cabin pressure (our conversion)",
 "comms":{"one_way_delay_s":300,"round_trip_s":600,"link":"delayed","scenario_en":"Deep-space analog (HERA-style 5-minute one-way delay)","mars_range_min":[3,23],"sources":[{"title":"NASA HRP, HERA …","url":"…","verified":true}, "…"]},
 "headsets":[{"crew_id":"lena","name":"Metis earpiece","battery_pct":78,"link":"ok","worn":true}, "…"],
 "medkit":[{"id":"aed","item_en":"AED (automated external defibrillator)","item_es":"Desfibrilador externo automático (DEA)","qty":1,"min":1,"low":false,"source":"Hinkelbein 2020, Rec. 11"}, "…"],
 "packet": null, "events": ["… últimos 20"]}
```
`packet` = último aviso a Tierra con su cuenta atrás (ver eventos).

### GET y POST /api/station/events
POST `{type, crew_id, payload}` → el evento creado. Tipos con texto por defecto: `surgeon_notice`, `triage_summary`, `earth_message` (estos tres llevan cuenta atrás por el retraso), `triage_started`, `triage_result`, `cmo_alert`, `crew_alert`. Se puede pasar `payload.text_en`/`text_es` y `payload.delay_s`. GET → lista, más reciente primero. En memoria: se pierde al reiniciar.
```json
{"id":3,"ts":"2026-11-14T02:23:22+00:00","type":"surgeon_notice","crew_id":"marco","payload":{"flow":"companion_collapse","node_id":"c7"},
 "text_en":"…","text_es":"…","delay_s":300,"arrives_ts":"2026-11-14T02:28:22+00:00","reply_earliest_ts":"2026-11-14T02:33:22+00:00",
 "arrives_in_s":299,"reply_in_s":599,"status":"in_transit"}
```
`status`: `in_transit` → `delivered_awaiting_reply` → `reply_window_open`.

### GET /api/brain/graph
`{nodes:[{id,type,label_en,label_es}], edges:[{source,target,relation}]}`; 42 nodos y 59 aristas. Tipos: `hub`, `ground`, `crew`, `device` (auricular), `ai` (Metis de cada uno), `symptom`, `protocol`, `equipment`, `medication`, `source`. Relaciones: `wears`, `talks_to`, `learns_baseline_of`, `syncs_with`, `delayed_link`, `is_cmo_for`, `triggers`, `may_cause`, `may_worsen`, `evidence`, `flags`, `stocks`, `uses`, `only_via_flight_surgeon`, `cites`, …
