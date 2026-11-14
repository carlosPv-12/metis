#!/usr/bin/env bash
# Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
# Instalador de la demo completa de Metis (IA, voz y reconocimiento, sin conexión).
# macOS (Apple Silicon) y Linux/WSL2 x86_64. Solo necesita bash y curl.
#
#   bash codigo/metis/instalar.sh                         # desde la carpeta del brain; baja todo de internet
#   bash codigo/metis/instalar.sh --desde http://IP:8765  # modelos desde el portátil de Tomás (red local)
#   bash codigo/metis/instalar.sh --desde /Volumes/USB/metis   # o desde una copia en una carpeta
#   bash codigo/metis/instalar.sh --servir                # en el portátil de Tomás: sirve sus modelos en la red local
#   bash codigo/metis/instalar.sh --comprobar             # solo la comprobación final
#
# Este script solo consigue uv (binario oficial de astral-sh, MIT/Apache-2.0) en METIS_HOME/bin;
# uv pone Python 3.12 y el resto lo hace instalar.py. Todo queda en METIS_HOME (por defecto
# ~/.local/share/metis); nada se instala en el sistema ni pide contraseña.
set -euo pipefail

UV_VERSION="0.13.6"
METIS_HOME="${METIS_HOME:-$HOME/.local/share/metis}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

case "$(uname -s)-$(uname -m)" in
  Darwin-arm64)   UV_TARGET="aarch64-apple-darwin";      UV_SHA="60fbd5c8a1ed681845eea28d9d622fcde03c51e91a43465b64a1e17db1ed3472" ;;
  Darwin-x86_64)  UV_TARGET="x86_64-apple-darwin";       UV_SHA="63ba17fdda55ad1a230d4b37fc6017ffa10c23688c83818bd3bfdf914c652a02" ;;
  Linux-x86_64)   UV_TARGET="x86_64-unknown-linux-gnu";  UV_SHA="f29c3e94ffabd7e6f3ba521dba169a9b7ec12100bf3257087f0f24f6123f3645" ;;
  Linux-aarch64)  UV_TARGET="aarch64-unknown-linux-gnu"; UV_SHA="229e194255c7958d86d56e8790d969a6f74736592133f0dfd0076f754c642c1d" ;;
  MINGW*|MSYS*|CYGWIN*)
    echo "[metis] Windows nativo no está soportado. Instala WSL2 (en PowerShell: wsl --install -d Ubuntu-24.04),"
    echo "        pon el brain dentro de Ubuntu y ejecuta este mismo comando allí."
    exit 1 ;;
  *) echo "[metis] Sistema no soportado: $(uname -s) $(uname -m). Funciona en macOS (Apple Silicon) y Linux/WSL2 x86_64."; exit 1 ;;
esac

command -v curl >/dev/null || { echo "[metis] Falta curl. En Ubuntu/WSL: sudo apt install -y curl"; exit 1; }

sha256_of() {
  if command -v sha256sum >/dev/null; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi
}

UV="$METIS_HOME/bin/uv"
if [ ! -x "$UV" ] || ! "$UV" --version 2>/dev/null | grep -q " $UV_VERSION"; then
  echo "[metis] Descargando uv $UV_VERSION (gestor de Python, ~15 MB)…"
  mkdir -p "$METIS_HOME/bin" "$METIS_HOME/descargas"
  TGZ="$METIS_HOME/descargas/uv-$UV_TARGET-$UV_VERSION.tar.gz"
  curl -fL --retry 3 --progress-bar -o "$TGZ" \
    "https://github.com/astral-sh/uv/releases/download/$UV_VERSION/uv-$UV_TARGET.tar.gz"
  GOT="$(sha256_of "$TGZ")"
  if [ "$GOT" != "$UV_SHA" ]; then
    rm -f "$TGZ"
    echo "[metis] El archivo de uv no coincide con su SHA-256 (esperado $UV_SHA, recibido $GOT). Vuelve a intentarlo."
    exit 1
  fi
  tar -xzf "$TGZ" -C "$METIS_HOME/bin" --strip-components 1 "uv-$UV_TARGET/uv"
  chmod +x "$UV"
fi

# Python gestionado por uv, dentro de METIS_HOME (no toca el Python del sistema).
export UV_PYTHON_INSTALL_DIR="$METIS_HOME/python"
export UV_CACHE_DIR="$METIS_HOME/cache/uv"
export UV_PYTHON_PREFERENCE="only-managed"
export METIS_HOME METIS_UV="$UV"
"$UV" python install 3.12 --quiet
exec "$UV" run --quiet --no-project --python 3.12 -- python "$HERE/instalar.py" "$@"
