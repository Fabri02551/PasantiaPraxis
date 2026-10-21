#!/usr/bin/env bash
# Genera el certificado de desarrollo que necesita el nginx para servir HTTPS.
#
# Por qué HTTPS y no HTTP: la API de geolocalización del navegador
# (navigator.geolocation) solo se entrega en un contexto seguro, es decir HTTPS o
# localhost. Sin esto, el visitador nunca ve el permiso de ubicación y la
# auditoría de visitas no tiene con qué trabajar.
#
# mkcert en lugar de un openssl pelado: crea una CA local, la instala en el
# trust store del sistema y del navegador, y emite un certificado que los
# navegadores aceptan sin cartel de advertencia. Un self-signed a mano
# obligaría a hacer clic en "avanzar" en cada visita y el warning asusta.
#
# Uso:  ./scripts/dev-certs.sh
# Si cambia la IP de la máquina, volvé a correrlo: el CN del certificado
# lleva la IP y si no coincide el navegador lo rechaza.
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIR_CERTS="$RAIZ/certs"

if ! command -v mkcert >/dev/null 2>&1; then
  echo "mkcert no está instalado."
  echo "  Arch:  sudo pacman -S mkcert"
  echo "  Debian: sudo apt install mkcert   (o descargarlo de github.com/FiloSottile/mkcert)"
  exit 1
fi

mkdir -p "$DIR_CERTS"

# La IP de la LAN es la que usa el visitador desde el celular. Sin ella, entrar
# por https://192.168.x.x daría un error de nombre aunque el certificado sea
# válido para localhost.
IPS=()
while read -r ip; do
  IPS+=("$ip")
done < <(ip -4 addr show scope global 2>/dev/null | grep -oP 'inet \K[\d.]+')

echo "Generando certificado para: localhost 127.0.0.1 ${IPS[*]:-}"
echo

mkcert -install
mkcert -cert-file "$DIR_CERTS/praxis.crt" -key-file "$DIR_CERTS/praxis.key" \
  localhost 127.0.0.1 "${IPS[@]}"

# La clave no debería estar en el repo. Si algún día alguien la versiona, el
# permiso la delata.
chmod 600 "$DIR_CERTS/praxis.key"
chmod 644 "$DIR_CERTS/praxis.crt"

echo
echo "Listo. Certificados en certs/"
echo "Levantá la app con HTTPS:  docker compose up -d"
echo "Entrá por https://localhost:3000"
echo
echo "El certificado caduca en 2 años. Para renovarlo, corré este script de nuevo."
