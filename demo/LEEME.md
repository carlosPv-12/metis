---
tipo: ficha
resumen: "La demo de Metis en un solo archivo HTML: doble clic y funciona, sin instalar nada"
autor: tomas
creado: 2026-11-14
actualizado: 2026-11-14
fuentes: [construir.py, ../frontend/vite.demo.config.ts, ../backend/main.py]
---

# Metis en un solo archivo

`metis-demo.html` es la demo completa de Metis (interfaz, datos, fuentes IBM Plex, iconos, árbol de triaje y modo director) metida en un único archivo de unos 2,3 MB. No carga nada de internet ni de otros archivos.

## Cómo abrirlo

- **Sin servidor (lo normal para verla)**: doble clic en `metis-demo.html`. Se abre en el navegador (Chrome, Edge, Firefox o Safari). No hace falta Node, ni Python, ni modelos.
  - Windows con WSL2: ábrelo desde el Explorador de Windows (`\\wsl$\Ubuntu\...`) o copia el archivo a una carpeta de Windows.
- **Con servidor (IA, voz y reconocimiento reales)**: arranca el backend (`run_demo.py` o `uvicorn main:app --port 8000` en `backend/`) y abre `http://localhost:8000/`. El backend sirve este mismo archivo en `/`.

## Qué funciona sin servidor

En la barra superior aparece la etiqueta **«Standalone file · scripted lines»** («Archivo suelto · frases guionizadas» en ES): así se sabe que no hay IA detrás.

| Funciona igual | Cambia sin servidor |
|---|---|
| Today, Trends, Body (3D), Sleep × Air, Report, Station, How, Data | El saludo y las respuestas de Talk son frases guionizadas (etiqueta «Scripted line»), no de la IA |
| Triage completo, los dos flujos y todas sus ramas (árbol local, el mismo del backend) | La voz es la del navegador (`speechSynthesis`), no Kokoro |
| Conmutador EN/ES, Lena/Marco, modo director `#/demo` | El micrófono de Talk no funciona (no hay whisper): se escribe |
| Avisos del triaje a la centralita (se guardan en el navegador) | |

## Regenerarlo

Hace falta Node.js 20+ (solo para regenerarlo, no para abrirlo). Desde esta carpeta:

```
python3 construir.py
```

Usa `frontend/vite.demo.config.ts` (un solo bloque JS y CSS, recursos dentro) y después mete todo en el HTML. No toca `frontend/vite.config.ts` ni el modo de desarrollo. Hay que regenerarlo después de cambiar el frontend; si no, el archivo enseña la versión anterior.
