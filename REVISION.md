---
tipo: nota
resumen: "Guía para que Carlos y Manuela revisen y mejoren las pantallas de la demo de Metis el sábado: arranque, recorrido, qué es simulado, fallos conocidos e ideas priorizadas."
autor: tomas
creado: 2026-11-14
actualizado: 2026-11-14
fuentes: [README.md, ../../notas/2026-11-14--metis-aterrizado.md, ../../investigacion/umbrales-nasa-verificados.md]
---

# Revisión de las pantallas de Metis (sábado 14)

> Pantallas escritas por un agente de IA (Claude) la noche del 13 al 14 de noviembre. Capturas de referencia en `../../archivos/2026-11-14--capturas-demo/`.

## 1. Cómo arrancar en vuestro ordenador

Actualizado el 14-nov a las 10:45. Tres niveles; los comandos se pegan en Terminal (Mac) o en Ubuntu (WSL) desde la carpeta del brain:

1. **Solo ver, sin instalar nada**: doble clic en `demo/metis-demo.html`. Están todas las pantallas, el triaje y el modo director, con frases guionizadas y la voz del navegador. Carlos, desde WSL: `explorer.exe codigo/metis/demo/metis-demo.html`.
2. **La demo completa** (IA, voz Kokoro y micrófono, sin conexión): `bash codigo/metis/instalar.sh` una vez (unos 3,2 GB; si Tomás sirve los modelos en la misma wifi, añade `--desde http://IP:8765`). Después, cada vez, `bash codigo/metis/arrancar.sh`, que abre `http://localhost:8000/`.
3. **Editar el código**: `bash codigo/metis/instalar.sh --dev` (añade Node 24 y `npm ci`) y luego `bash codigo/metis/arrancar.sh --dev`, que abre `http://localhost:5173/` con recarga en caliente. Si cambias `frontend/src/`, regenera el archivo del punto 1 con `python3 codigo/metis/demo/construir.py`.

Detalle, opciones y problemas frecuentes: [docs/NOTAS-EQUIPO-14-NOV.md](docs/NOTAS-EQUIPO-14-NOV.md), apartado «Cómo arrancar». Mac y WSL reales no se han probado todavía: si algo falla, copiad el mensaje del instalador a Tomás.

En el portátil de Tomás sigue funcionando lo de siempre: el backend con `.venv/bin/uvicorn main:app --port 8000 --reload` desde `backend/` y el frontend con `npm run dev` desde `frontend/`, en `http://localhost:5173/`. Idioma: botón **EN/ES** arriba a la derecha (o `#/today?lang=es`). Tripulante: botón **Lena/Marco** en la cabecera.

**Si el backend no responde o le falta un endpoint, ninguna pantalla se rompe**: cada llamada tiene datos de reserva locales (`src/fallback.ts`, `../data/*.json`, `../backend/triage_tree.json` y su traducción `src/triage_en.ts`). Eso también significa que una pantalla puede verse bien aunque el backend esté caído: para saber qué está usando, mira la pestaña Network del navegador.

## 2. Recorrido de prueba (10 minutos)

| # | Ruta | Qué comprobar |
|---|---|---|
| 1 | `#/today` | Saludo de Metis (etiqueta «Local LLM» o «Scripted line»), botón Listen (voz por `/api/voice/tts`; si falla, voz del navegador), 4 desviaciones con su banda personal, auricular, retraso con Tierra. |
| 2 | `#/trends` | 4 gráficas de 30 días con la banda personal sombreada y la línea NASA discontinua; **pasa el ratón por la leyenda de la línea NASA** para ver la fuente. Abajo, hemograma real OSD-569 (pestañas C001–C004). |
| 3 | `#/body` | Cuerpo 3D holográfico que gira solo; arrastra para girarlo. Pulsa cada punto (corazón, oído/auricular, pulmones, sueño, ojos/SANS, huesos, músculo): panel con medida, línea base y riesgo HRP. Ojos, huesos y músculo dicen «no lo mide Metis» a propósito. Sin WebGL sale un mapa 2D. |
| 4 | `#/talk` | Escribe o pulsa una sugerencia. «Marco collapsed» o «My chest feels tight» deben mostrar el botón rojo «Open triage now». Mantén pulsado el micrófono para hablar (necesita `/api/voice/stt`). |
| 5 | `#/triage` | Dos flujos. Pasos grandes, cronómetro, frase hablada, fuentes, y los botones «Alert crew», «Alert commander / CMO», «Send to flight surgeon». |
| 6 | `#/station` | Abre en otra pestaña. Tras pulsar «Alert crew» en el triaje, Marco pasa a **Alarma** y el evento aparece en el registro (refresco cada 2,5 s); «Send to flight surgeon» arranca la cuenta atrás del paquete. |
| 7 | `#/sleep-air`, `#/report` | Cruce sueño × CO₂ con correlación calculada; informe para el cirujano con botón de envío. |
| 8 | `#/how`, `#/data` | Arquitectura, grafo de conocimiento (pasa el ratón por un nodo), auricular 3D «Concept»; tabla de umbrales NASA con fuente y estado de verificación. |
| 9 | `#/demo` | Historia de 30 s en tiempo real. Espacio = pausa; flechas = ±1 s; barra inferior para saltar. |

## 3. Modo director para grabar el vídeo

- `#/demo` reproduce en tiempo real. `#/demo?capture=1` **no avanza solo** y pinta un lienzo fijo de 1920×1080 en la esquina superior izquierda.
- En la consola del navegador: `window.__metisDemo.seek(12000)` deja la pantalla exactamente en el segundo 12; también `play()`, `pause()`, `t()` y `duration` (30000).
- Sin JavaScript: `#/demo?capture=1&t=12000` abre directamente en ese instante (sirve para Chrome sin cabeza con `--screenshot`).
- Todo lo que se ve es función del tiempo `t`; las animaciones CSS están desactivadas en modo captura. Idioma del vídeo: añade `&lang=es` para la versión en español.
- Guion (textos en `src/i18n.ts`, `DEMO_LINES` y `DEMO_UI`): 0–6 s chequeo de Lena; 6–10 s Marco se desploma; 10–19 s triaje por voz; 19–25 s centralita y paquete a Tierra; 25–30 s cierre «Metis — a companion that never loses signal.»

## 4. Qué es real y qué es simulado

- **Simulado y ficticio**: Lena, Marco, Noor y Kenji; constantes de 30 días; estado de la estación, auriculares y botiquín; el retraso de 5 min es un escenario (análogo HERA, con fuente en `/api/station`); el auricular es un **concepto** sin prototipo.
- **Real**: hemograma de Inspiration4 (NASA OSDR OSD-569); umbrales NASA con fuente (CO₂ 3 mmHg, sueño en vuelo 6,09 h, pulso en vuelo 60 lpm, 2 CMO por vehículo), los mismos de `investigacion/umbrales-nasa-verificados.md`; nombres de riesgos y peligros HRP.
- **Pendiente de validar**: los textos del árbol de triaje (marcados «Example content — pending validation against NASA sources»).

## 5. Fallos conocidos (14-nov, 03:30)

- A las 03:30 todos los endpoints del contrato respondían 200 (estado, umbrales, estación, eventos, grafo, chat, voz). Si el backend cae, las pantallas pasan solas a los datos de reserva; en ese caso los eventos de la centralita se guardan en el `localStorage` del navegador y solo se ven entre pestañas del **mismo** navegador.
- El modo director tiene su propio guion y datos (no llama a la API), para que el vídeo sea siempre igual. Usa el retraso de 5:00 y los nombres de la tripulación del backend (Kenji comandante, Noor CMO); si el backend los cambia, hay que cambiarlos también en `src/screens/Demo.tsx` y `src/i18n.ts`.
- La primera respuesta del LLM local puede tardar varios segundos («Metis is thinking…»); si pasa de 30 s, Talk responde con una frase guionizada.
- Si Vite no recoge un cambio (pasa con la sincronización de Syncthing), guarda otra vez el archivo o reinicia `npm run dev`.
- Los nombres de módulo de la centralita (Crew quarters, Lab…) no se traducen al español.
- El paquete JS pesa ~1,4 MB (three.js + recharts); no afecta a la demo local.
- Por debajo de ~1100 px de ancho la cabecera no cabe bien (la demo está pensada para 1280×800 y 1920×1080).

## 6. Ideas de mejora, por prioridad

1. **Grabar el vídeo** con el modo director y revisar que cada subtítulo se lee entero (inglés).
2. Validar con fuentes los textos del triaje y quitar «example step / pending».
3. Probar la voz real (STT y TTS locales) en el portátil de la demo, sin red.
4. Cuerpo 3D: suavizar la silueta (menos «muñeco articulado») y añadir un modo «comparar con ayer».
5. Centralita: traducir nombres de módulo y añadir un aviso sonoro al recibir una alerta.
6. Today: aprovechar el hueco inferior en 1920×1080 con «plan del día» (ejercicio, siguiente contacto con Tierra).
7. Dividir el paquete JS (carga diferida de three.js) si se publica en web.

## 7. Cambios tras la verificación independiente (14-nov, ~03:50)

- Un solo dato por cosa: rol de Marco («Non-medical crewmember» / «Tripulante no médico»), batería del auricular de Lena (78 %, la misma en el modo director, Today y la centralita), tripulación Kenji (comandante) y Noor (CMO).
- Retraso con Tierra: junto a «5:00 min» sale «Today’s delay · up to 20 min one-way on a Mars mission»; al pasar el ratón, el escenario de la API y la fuente (NASA HRP, peligro «Distance from Earth»). Lee `scenario_en/es` y `range_max_s` de `/api/station` si existen; si no, 20 min de reserva.
- Línea base: Trends y NASA data muestran el periodo de `baseline_window` de la API; si no viene, lo construyen con los umbrales `baseline_days` y `baseline_band_sd` de `/api/thresholds` (no hay cifras escritas a mano).
- Traducciones ES añadidas: módulos y ubicaciones, «límite», «enlace/débil», unidades, reglas de los umbrales (si la API no trae `rule_es`, usa `ES_RULE` de `src/i18n.ts`), fuente «Supuesto del prototipo Metis», correlación de Sueño × Aire, analitos y unidades del hemograma, leyenda del grafo.
- Sin «—» como dato: paquete médico «none/ninguno»; la columna de caducidad del botiquín solo aparece si algún elemento la trae.
- Report to ground rotula el hemograma: «Reference: real Inspiration4 crew blood counts (NASA OSDR OSD-569) — not Lena’s».
- Reloj del hábitat simulado (07:02 del día 112 al abrir la app, avanza en tiempo real) en toda la app, coherente con «Good morning».
- Body: las etiquetas que se saldrían por la derecha se colocan a la izquierda del punto.
- Modo director: subtítulos sin tapar el eje ni el rótulo del auricular (rótulo arriba); triaje alineado con el árbol nuevo del backend (ver informe).
