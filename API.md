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

## Roles a bordo y Tierra (14-nov, Carlos)

Decisión: `decisiones/2026-11-14-1630--nave-tierra-roles-y-alcance-del-backend.md` del brain. Código: `backend/roles.py`; toda la política está en `PERMISSIONS` y se puede cambiar si las leyes de protección de datos lo piden.

| Rol | De sí mismo | De los demás | Nave | Avisos |
|---|---|---|---|---|
| `crew` (tripulante) | todo | nada | sí | emergencias escaladas de un compañero y de la nave |
| `commander` | todo | **rasgos principales**: estado, aptitud, pulso, SpO₂, actividad; sin historia, sueño, ánimo ni detalle de avisos | sí | los mismos |
| `cmo` (oficial médico) | todo | todo | sí | los mismos |
| `ground` (Tierra) | — | todo, al momento | sí | todo |

Roles por defecto: Kenji `commander`, Noor `cmo`, Lena y Marco `crew`. Se cambian en Ajustes.

**Parámetro `viewer`** (id de tripulante o `ground`) en `GET /api/station`, `/api/station/events`, `/api/crew`, `/api/crew/{id}`, `/api/vitals` y `/api/vitals/{id}`. **Sin `viewer` se devuelve lo de siempre**, así las pantallas que aún no lo envían no se rompen. Con un `viewer` desconocido, 400. Si no tiene acceso, 403.

- Cada tripulante de la lista lleva `access` (`full` | `summary`), `fitness` y `crew_role`.
- Avisos de un compañero: el CMO y Tierra ven el texto completo. El comandante ve un texto genérico («Marco: watch. The medical officer has the details.»). El tripulante no los ve, **salvo que estén escalados**: entonces le llegan a todos con las instrucciones («Go to Marco now…»).
- Eventos de emergencia (`crew_alert`, `no_pulse`, `collapse`, `cmo_alert`…): a todos.
- Chat: «how is the crew?» y «how is Marco?» respetan el rol de quien pregunta (`crew_id`).

| Método y ruta | Cuerpo | Respuesta |
|---|---|---|
| GET `/api/roles` | | `{roles, defaults, permissions, labels, summary_fields, emergency_events}` |
| PUT `/api/roles` | `{crew_id, role}` (`crew`\|`commander`\|`cmo`) | igual que GET |
| POST `/api/roles/reset` | | igual que GET, con los roles por defecto |
| PUT `/api/crew/{id}/fitness` | `{status: fit\|limited\|unfit, viewer}` | `{status, by: cmo\|ground, ts}`. Solo el CMO o `ground`; si no, 403. Crea el evento `fitness`. |

Ejemplos reales:
```json
// GET /api/station?viewer=kenji  -> crew[marco] (comandante: rasgos principales)
{"id":"marco","name":"Marco","location":"Lab","status":"ok","vitals":{"t":1794670480,"hr_bpm":63.0,"spo2_pct":97.7,"pulse":true,"activity":0},
 "note_en":"Fit for duty.","access":"summary","fitness":{"status":"fit","by":"default","ts":null},"crew_role":"crew"}
// GET /api/station?viewer=lena  -> crew: solo [lena]
// GET /api/crew/marco?viewer=lena  -> 403 {"detail":"solo puedes ver tu propia información; el oficial médico tiene el resto"}
// PUT /api/crew/marco/fitness {"status":"limited","viewer":"noor"}  -> {"status":"limited","by":"cmo","ts":1794670480}
// POST /api/metis/chat {"message":"How is Marco?","crew_id":"lena"}
{"text":"I can only share your own health data. The medical officer can see your crewmates, and I'll tell you straight away if anyone needs help.","source":"rule"}
```

En `frontend/src/api.ts`: `api.station(viewer?)`, `api.vitals(viewer?)`, `api.roles()`, `api.setRole(crew_id, role)`, `api.resetRoles()`, `api.setFitness(crew_id, status, viewer)`, `api.crewAs(id, viewer)`, y los tipos `CrewRole`, `Viewer`, `Access`, `Fitness` y `RolesDoc`. El oído (`voice.tsx`) ya pide las constantes como el dueño del auricular.

**Para Manuela (pantallas)**:
- Ajustes: un selector de rol al lado de cada tripulante (`api.setRole`).
- Pasar `viewer = crewId` en las pantallas de la nave, y `viewer = 'ground'` en la vista de Tierra.
- Pintar `access: 'summary'` con menos detalle.
- Mostrar `fitness` en las tarjetas.

## Entorno de la misión (14-nov, Carlos)

Lo elige Ajustes y lo usa todo el backend (`backend/mission.py`; mismos perfiles que `frontend/src/link.ts`).

| `env` | Retraso de ida | `link` |
|---|---|---|
| `iss` | 0,6 s | `realtime` |
| `eva` | 0,6 s | `realtime` |
| `moon` | 1,3 s | `realtime` |
| `mars` | `mars_delay_min` × 60 (5-20 min; 5 por defecto) | `delayed` |
| `blackout` | — | `none` |

| Método y ruta | Cuerpo | Respuesta |
|---|---|---|
| GET `/api/mission` | | `{env, mars_delay_min, one_way_delay_s, round_trip_s, link, label_en/es, note_en/es, source, profiles}` |
| PUT `/api/mission` | `{env, mars_delay_min?}` | lo mismo más `released`: paquetes en cola que han salido al volver el enlace. Crea el evento `link_change`. |

- **Paquetes hacia Tierra** (`send_flight_surgeon`, `surgeon_notice`, `triage_summary`, `earth_message`): llevan `direction: "to_earth"`, `delay_s`, `sent_ts`, `arrives_ts`, `arrives_in_s`, `reply_in_s` y `status` (`in_transit` → `delivered_awaiting_reply` → `reply_window_open`).
  - Con `blackout` el `status` es `queued_no_link`, con `arrives_in_s: null`.
  - Al volver el enlace, el paquete sale con el retraso del nuevo entorno.
- **`/api/station` → `comms`**: `one_way_delay_s` sigue siendo un número (0 sin enlace, para no romper pantallas). Añade `link`, `env` y `env_label_en/es`.
- **Lo que dice Metis** al avisar a la tripulación cambia según el entorno:
  - ISS: «I'm calling the flight surgeon now…»;
  - Marte: «The report reaches the flight surgeon in about 5 minutes…»;
  - sin enlace: «There is no link with Earth: the report… waits in the queue.»
- **Frontend**: `settings.ts` llama a `api.setMission` al cambiar el entorno, y al cargar toma el del backend, para que todas las pestañas y portátiles muestren lo mismo. Para la cuenta atrás del paquete, mejor `packet.arrives_in_s` y `packet.status` del backend.

## Estado de la nave y botiquín (14-nov, Carlos)

Código: `backend/ship.py`. **Simulado**, pero los rangos llevan fuente (`verified: true`). Lo que no tiene fuente sale como supuesto del prototipo (`verified: false`, por ahora solo la energía).

| Sistema (`id`) | Valor de la demo | Rango / límite | Fuente |
|---|---|---|---|
| `o2` (ppO₂) | ~160 mmHg | 146-178 | NASA ICES-2015-146 |
| `pressure` | ~752 mmHg | 724-770,5 | NASA ICES-2015-146 |
| `co2_quarters` | pico nocturno de la litera de Lena (3,55) | ≤ 3 → **watch** | NASA OCHMO-TB-004 |
| `co2_cabin` | media del resto de módulos | ≤ 3 | NASA OCHMO-TB-004 |
| `water` | ~98 % de recuperación | ≥ 95 | NASA 2023 (Brine Processor) |
| `power` | margen ~4 kW, batería 86 % | ≥ 1 kW | supuesto |
| `radiation` | 112 días × 1,8 mSv/día = 201,6 mSv | 75 % de 600 mSv | NASA/JPL (RAD de Curiosity); límite de carrera 600 mSv |

- GET `/api/ship?viewer=` → `{systems[], worst_status, alerts[], co2_sleep_link, mission}`.
  - Los avisos de la nave (`source: "ship"`) **los ven todos**.
  - `co2_sleep_link` (las noches de CO₂ alto en su litera frente a sus horas de sueño, con la correlación) es **dato de salud de Lena**: solo lo reciben Lena, el CMO y `ground`; los demás reciben `null`.
- `/api/station` añade `ship: {worst_status, alerts}`, y los avisos de la nave van en `alerts`. Ya no sale el aviso antiguo `co2_crew`.
- GET `/api/meds` → botiquín **por categorías** (sin fármacos concretos ni dosis): `qty`, `min`, `low`, `expires_in_days` y `expires_before_mission_end` (misión de 960 días; hoy es el día 112). Incluye también `plans` (planes preaprobados de ejemplo) y `plan_note`.
- Chat:
  - «what can I take for my headache?» / «…to sleep?» / «…for motion sickness?» / «…for my back pain?» → el **plan preaprobado** del cirujano (`source: "rule"`, `plan`, `note`: «Example plan for this demo…»);
  - sin un motivo concreto, la regla de siempre («I can't recommend medication…»);
  - «how is the ship?» → el estado de los sistemas, también durante una emergencia.
- En `frontend/src/api.ts`: `api.ship(viewer?)` y `api.meds()`, y los tipos `ShipSystem`, `ShipState` y `MedKit`.

**Para Manuela (pantallas)**:
- en la centralita, una tarjeta «Ship systems» con los 7 sistemas, su estado y su fuente;
- en el botiquín, las categorías con su caducidad («expires before the end of the mission»);
- en la ficha de Lena (si tienes acceso), el texto de `co2_sleep_link`.

## Vista de Tierra (14-nov, Carlos)

Código: `backend/ground.py`. Decisión: **Tierra lo ve todo al momento**. Lo que **viaja con el retraso** del entorno son los **mensajes**.

| Método y ruta | Cuerpo | Respuesta |
|---|---|---|
| GET `/api/ground` | | `{viewer, realtime_data, crew[], alerts[], vitals[], checks[], ship, mission, inbox[], outbox[], events[], note_en/es}` |
| POST `/api/ground/reply` | `{crew_id?, text_en, text_es?, fitness?, packet_id?}` | el evento creado (`surgeon_reply`, o `ground_message` si no hay `crew_id`) |

- **`inbox`**: paquetes de la nave hacia Tierra (`direction: "to_earth"`), con `name`, `summary_en` (el resumen del triaje para el cirujano o el de las constantes), `status` y `arrives_in_s`. **Al escalar una emergencia de constantes, Metis manda sola un `surgeon_notice`** con el resumen.
- **`outbox`**: respuestas hacia la nave (`direction: "to_ship"`): `status` = `queued_no_link` → `in_transit` → `delivered`.
- **`fitness`** (`fit`, `limited`, `unfit`) en una respuesta: **se aplica a bordo cuando la respuesta llega**, no antes. Queda `by: "ground"`. Sin enlace, espera en cola.
- **Privacidad a bordo**: una respuesta sobre Marco la ven entera Marco y el CMO. El comandante solo ve un aviso genérico y el resto de la tripulación no la ve. Un `ground_message` sin `crew_id` lo ven todos.
- **Voz**: cuando llega una respuesta, Metis la lee en voz alta en los auriculares que pueden verla, por ejemplo «Flight surgeon about Marco: Rest today, no EVA. Status: limited duty.».
- En `frontend/src/api.ts`: `api.ground()`, `api.groundReply({...})`, `api.eventsAs(viewer)`, y los tipos `GroundView` y `Packet`.

**Para Manuela (pantalla de Tierra, con el interruptor Nave / Tierra arriba)**:
- **bandeja** con los paquetes y su cuenta atrás, y lo que contienen;
- **tripulación completa** con constantes, avisos y la relación CO₂ ↔ sueño;
- **sistemas de la nave**;
- un **formulario de respuesta**: texto y aptitud, con aviso de «llega en X min» o «en cola, sin enlace».
- **Tierra no tiene Metis, solo notificaciones** (Carlos, 14-nov): en cualquier ruta que empiece por **`/ground`** el oído no escucha y Metis no habla (`voice.tsx`). La pantalla de Tierra va en `/ground` (Manuela).
- **A bordo, los mensajes de Tierra se ven además de oírse**: aviso verde «From ground» arriba (`VitalsBanner`), que queda hasta que se cierra con la ✕. Se vacía al cambiar de tripulante.
