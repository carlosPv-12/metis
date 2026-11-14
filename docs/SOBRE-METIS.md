# Sobre Metis

Este documento reúne lo que antes estaba en las pantallas **«Cómo funciona»** y **«Datos NASA»** de la web. Se
ha sacado de la app para que la interfaz quede centrada en la tripulación.

> Metis no diagnostica ni receta. Las decisiones médicas salen de un árbol de triaje determinista con fuentes.
> La tripulación es ficticia y sus constantes son simuladas; el hemograma es real (NASA OSDR OSD-569).

---

## 1. Cómo funciona Metis

Cada tripulante tiene su Metis privado, que corre en el ordenador del hábitat. **Nada necesita a Tierra para
funcionar.**

### Arquitectura: todo en local

```
Auricular Metis  ──►  Metis personal  ──►  Centralita  ──(retraso de la luz)──►  Tierra · cirujano de vuelo
```

| Pieza | Qué es |
|---|---|
| **Auricular Metis** | Conducción ósea · micrófono · sensor PPG (concepto) |
| **Metis personal** | LLM local · voz · línea base personal |
| **Centralita** | Vista de la tripulación · alertas · botiquín |
| **Tierra · cirujano de vuelo** | Guardar y reenviar con el retraso de la luz (5:00 min de ida en el escenario de la demo; hasta 20 min en una misión a Marte) |

La IA redacta y habla. Las acciones médicas salen de un árbol de triaje determinista con fuentes.

La app indica arriba a la derecha si está **en línea** (conectada al ordenador del hábitat: IA, voz y
reconocimiento de voz locales) o en **modo autónomo** (sin ese ordenador: frases guionizadas, el árbol de triaje
local y la voz del navegador).

### El «brain» de Metis: grafo de conocimiento

Cómo se conecta el Metis de cada tripulante con la centralita, el botiquín, el conocimiento de NASA y Tierra
(43 nodos y 60 relaciones; se sirve en `GET /api/brain/graph`).

- **Tripulación:** Lena, Marco, Noor (oficial médica de la tripulación) y Kenji (comandante). Cada uno **lleva**
  su auricular Metis, que **habla con** su Metis personal; ese Metis **aprende la línea base** de su tripulante y
  **se sincroniza** con la centralita del hábitat.
- **Centralita ↔ Tierra:** enlace con retraso hacia el cirujano de vuelo.
- **Botiquín de la centralita:** DEA, parches de DEA de larga caducidad, sistema de sujeción médica, dispositivo
  supraglótico para vía aérea, aspirador manual, pulsioxímetro, tensiómetro y paquete de medicación (su contenido
  sigue la lista del cirujano de vuelo; solo se usa **a través de** él).
- **Síntomas y protocolos:**
  - *Desplome* y *dolor u opresión torácica* activan el protocolo **«Un compañero se desploma con dolor
    torácico»** (usa DEA, parches, sujeción, vía aérea y aspirador).
  - *Dolor u opresión torácica* activa **«Noto presión en el pecho»** (usa el pulsioxímetro).
  - *CO₂ de cabina alto* puede causar *cefalea* y *fatiga* y puede empeorar el *sueño corto*.
  - El Metis de Lena señala hoy: sueño corto, CO₂ de cabina alto y pulso en reposo sobre su línea base.
- **Fuentes citadas por los protocolos:** NASA OCHMO-TB-033 Rev C; NASA-STD-3001 Vol. 1 Rev C [V1 3006]; ERC
  Guidelines 2021 (Olasveengen et al.); Hurst et al. (NTRS 20070030123); Hinkelbein et al. 2020; NASA HRP Evidence
  Report on cardiac rhythm (NTRS 20170005625); Bacal & Redmond, *Code Blue On Orbit* (NTRS 20110011323);
  NASA OCHMO-TB-004 Rev D (CO₂); Barger et al. 2014 (sueño).

### Auricular Metis (concepto)

Altavoz de conducción ósea · dos micrófonos direccionales · PPG en el oído (pulso) y temperatura de piel · enlace
corto con el nodo del hábitat · par intercambiable para que uno cargue mientras se lleva el otro.
**Aún no hay prototipo físico.**

---

## 2. Datos de NASA que usa Metis

Cada umbral y referencia en pantalla lleva su fuente. Las constantes de la tripulación son simuladas; el
hemograma es real.

### Fuentes

| Fuente | Para qué se usa |
|---|---|
| **NASA Human Research Program**, riesgos y peligros (pestaña *Resources* del reto) — [nasa.gov/hrp/risks](https://www.nasa.gov/hrp/risks/) · [nasa.gov/hrp/hazards](https://www.nasa.gov/hrp/hazards/) | Nombre del riesgo detrás de cada alerta y de cada punto del cuerpo. |
| **NASA OSDR OSD-569**, hemograma completo de Inspiration4 — [osdr.nasa.gov/osdr/data/osd/files/569](https://osdr.nasa.gov/osdr/data/osd/files/569) · **datos reales** | Hemograma real con línea base personal y rangos de referencia: línea base antes del vuelo (3 extracciones) frente al primer día tras volver (R+1). |

### Umbrales y referencias (`GET /api/thresholds`)

| Referencia | Regla | Valor | Fuente | ¿Verificado? |
|---|---|---|---|---|
| Límite de diseño de CO₂ en cabina (media de 1 h) | media de 1 h de ppCO₂ ≤ 3 mmHg (límite de diseño del vehículo, no un umbral clínico individual) | 3,0 mmHg | [NASA OCHMO-TB-004 Rev D, Carbon Dioxide](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-004-carbon-dioxide.pdf) (cita NASA-STD-3001 Vol. 2 Rev D [V2 6004]) | Sí |
| Regla de vuelo de la ISS (media de 24 h) | la ISS mantiene la media de 24 h en ≤ 3,00 mmHg desde la regla de vuelo de 2016 | 3,0 mmHg | [NASA OCHMO-TB-004 Rev D](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-004-carbon-dioxide.pdf) | Sí |
| Aviso temprano: media de 7 días para riesgo de cefalea < 1 % | media de 7 días por debajo de 2,5 mmHg | 2,5 mmHg | [NASA OCHMO-TB-004 Rev D](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-004-carbon-dioxide.pdf) | Sí |
| Síntomas descritos (fatiga, malestar, peor sueño, náuseas) | descritos por encima de 4,5 mmHg | 4,5 mmHg | [NASA OCHMO-TB-004 Rev D](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-004-carbon-dioxide.pdf) | Sí |
| Sueño medio en la ISS | 6,09 ± 0,67 h (actigrafía, 21 tripulantes de la ISS) | 6,09 h/noche | [Barger et al. 2014, Lancet Neurology](https://pmc.ncbi.nlm.nih.gov/articles/PMC4188436/) | Sí |
| Sueño recomendado | 7–9 h recomendadas; en el espacio se duerme unas 6 h | 7–9 h/noche | [NASA OCHMO-TB-041 Rev A, Sleep Accommodations](https://www.nasa.gov/wp-content/uploads/2023/03/sleep-accomodations-technical-brief-ochmo.pdf) | Sí |
| Pulso en reposo en vuelo (grupo de referencia) | 60,0 ± 10,6 lpm en vuelo; 55,2 ± 8,4 tumbado antes del vuelo; sin diferencia antes/durante (n = 9) | 60,0 lpm | [Hughson et al. 2017, J Appl Physiol, tabla 1](https://pmc.ncbi.nlm.nih.gov/articles/PMC5792103/) | Sí |
| Confirmar una arritmia requiere ECG | los sensores de pulso pueden detectar intervalos R-R anómalos; confirmarlo requiere ECG | ECG | [NASA HRP Evidence Report, Risk of Cardiac Rhythm Problems During Spaceflight (2017)](https://ntrs.nasa.gov/citations/20170005625) | Sí |
| Oficiales médicos de tripulación por vehículo (mínimo) | formar al menos a dos tripulantes por vehículo como CMO | 2 CMO | [NASA-STD-3001 Vol. 1 Rev C [V1 3006]](https://standards.nasa.gov/sites/default/files/standards/NASA/C//nasa-std-3001-vol-1-rev-c-signature.pdf) | Sí |
| Banda de variabilidad cardiaca (HRV) | no hay un valor abierto y verificado de HRV en vuelo; solo banda personal | sintético (ms) | Supuesto del prototipo Metis (sin fuente publicada) | **No** |
| Banda de la línea base personal | media personal ± 2 DE de los primeros 21 días | 2,0 DE | Supuesto del prototipo Metis (sin fuente publicada) | **No** |
| Días para aprender la línea base | elección del prototipo | 21 días | Supuesto del prototipo Metis (sin fuente publicada) | **No** |

### Línea base personal

La banda de cada tripulante es su **media personal ± 2 DE de los primeros 21 días** de datos (días 83–103 de la
misión, del 14-oct al 3-nov de 2026 en los datos simulados). Es un supuesto del prototipo, no un estándar de NASA.

### Hemograma real (NASA OSDR OSD-569)

Tripulación de Inspiration4. Para cada analito se compara la **línea base antes del vuelo** (3 extracciones) con el
**primer día tras volver (R+1)**, marcando qué valores salen de la banda personal y cuáles del rango de
referencia. Los datos se sirven en `GET /api/blood` y siguen visibles en la pantalla **Tendencias** de la app.

---

## 3. Créditos de recursos visuales

| Recurso | Origen | Licencia |
|---|---|---|
| Cuerpos 3D de mujer y hombre (`frontend/src/assets/metis-body-*.glb`) | [Blender Studio — Human Base Meshes](https://www.blender.org/download/demo-files/#assets) (v1.4.1, `body_female_realistic` / `body_male_realistic`), exportados a glTF y reducidos a ~60 000 triángulos | CC0 (dominio público) |
| Ilustraciones 2D del busto (`frontend/src/assets/metis-body-*.webp`, solo si el navegador no tiene WebGL) | Generadas con IA para Metis | Propias del proyecto |
| Tipografías Fira Sans, Overpass y Fira Code | Guía de marca de NASA Space Apps, vía Fontsource | SIL OFL 1.1 |

---

*Generado con asistencia de IA (Claude) — Te Falta Tech, NASA Space Apps 2026.*
