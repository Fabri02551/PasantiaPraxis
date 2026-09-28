# Etapa 1: compilación
FROM node:22-alpine AS build
WORKDIR /app

# Las dependencias van en su propia capa, separadas del codigo. Asi si
# solo cambian archivos de src/ la capa de npm queda cacheada y el
# build no reinstala 300 paquetes.
#
# --mount=type=cache reutiliza la cache de npm entre builds: la primera
# vez descarga, las siguientes usan la carpeta aunque la capa se
# invalide. (Es una funcion de BuildKit, que ya viene por defecto.)
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

COPY . .

# "build" es "tsc -b && vite build": si hay un error de tipos el build
# falla aca y no se llega a construir una imagen rota.
RUN npm run build

# Etapa 2: nginx sirviendo los archivos estaticos
FROM nginx:1.27-alpine AS production

# nginx.conf es un server block (no el config principal), asi que va a
# conf.d/default.conf, que es donde el include del http{ } lo lee.
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

# El index.html y los assets quedan con el owner de root pero en modo
# 644, asi que el worker de nginx los puede leer igual.
RUN chown -R nginx:nginx /usr/share/nginx/html

# wget es el de busybox, ya viene en la imagen. Se chequea /healthz (que
# declara nginx.conf) y no "/" para no depender de que la API responda.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
