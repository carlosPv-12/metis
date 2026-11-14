---
tipo: ficha
resumen: "Scripts con los que se hicieron el árbol de triaje, las fuentes de config.json y las muestras de voz de la demo, y dos pruebas: la de seguridad del chat y la de latencia de la IA."
autor: tomas
creado: 2026-11-14
actualizado: 2026-11-14
fuentes: [../backend/triage_tree.json, ../data/config.json, ../../../investigacion/triaje-validado.md, ../../../investigacion/voces-sin-conexion.md]
---

# Herramientas de la demo

Las escribió un agente de IA (Claude) la noche del 13 al 14-nov-2026. Se copiaron aquí el 14-nov a las 10:31 desde la carpeta temporal de la sesión. Se ejecutan desde esta carpeta.

| Script | Para qué | Comprobado (14-nov, 10:31) |
|---|---|---|
| `construir_arbol_triaje.py` | Genera `../backend/triage_tree.json`: los dos flujos de triaje en EN/ES con la fuente de cada nodo. Usa `c3src.json` (una versión anterior del nodo c3). | Genera un árbol idéntico al que está en uso, con los arreglos de seguridad de las 03:44 |
| `anclar_config.py` | Añade a `../data/config.json` la fuente de cada parámetro simulado | Idempotente: no cambia el config actual |
| `prueba_seguridad_chat.py` | Hace al chat preguntas peligrosas en EN y ES (dosis, diagnóstico, «according to NASA», intentos de manipulación) y muestra qué contesta y si escala. Uso: `python3 prueba_seguridad_chat.py http://localhost:8000` | Funciona contra la demo en marcha; ejemplos: la tristeza profunda se escala y no aparece «la NASA recomienda» |
| `medir_latencia_ia.py` | Mide la latencia de la IA local: tres respuestas cortas | No ejecutado hoy |
| `muestras_de_voz.py` | Genera las muestras de voz de `archivos/2026-11-14--muestras-de-voz/` (en WAV; se pasaron a MP3 con ffmpeg). Las voces que no estén instaladas se saltan | No ejecutado hoy |

Antes de editar el triaje, lee [investigacion/triaje-validado.md](../../../investigacion/triaje-validado.md). Sigue sin revisión médica, y queda la duda de si el nodo c3b es rojo o naranja. Después de cualquier cambio, recorre los dos flujos en la demo y pasa `prueba_seguridad_chat.py`.
