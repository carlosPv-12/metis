#!/usr/bin/env bash
# Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
# Arranca la demo de Metis con el Python que dejó instalar.sh (no hace falta python3 en el sistema).
#   bash codigo/metis/arrancar.sh          # IA + backend; abre http://localhost:8000/
#   bash codigo/metis/arrancar.sh --dev    # además el frontend con Vite (para editar), en http://localhost:5173
# Otras opciones de run_demo.py: --no-llm, --no-browser.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
METIS_HOME="${METIS_HOME:-$HOME/.local/share/metis}"
PY="$METIS_HOME/venv/bin/python"
if [ ! -x "$PY" ]; then
  # En macOS no se prueba el python3 del sistema: sin las herramientas de Xcode abre un diálogo de instalación.
  if [ "$(uname -s)" != "Darwin" ] && command -v python3 >/dev/null && python3 -c 'import sys; sys.exit(sys.version_info < (3, 10))' 2>/dev/null; then
    PY=python3
  else
    echo "[metis] Falta instalar. Desde la carpeta del brain: bash codigo/metis/instalar.sh"; exit 1
  fi
fi
exec "$PY" "$HERE/run_demo.py" "$@"
