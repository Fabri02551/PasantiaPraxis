FROM node:22-alpine AS build
WORKDIR /app

# Vite incrusta las variables VITE_* en el bundle durante el build, así que
# llegan por build args (docker-compose.yml los interpola desde el .env raíz).
# El ENV solo existe para el paso de compilación: la app servida por nginx no
# lee variables en runtime.
ARG VITE_API_URL=
ARG VITE_MAP_TILE_URL=https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
ENV VITE_API_URL=$VITE_API_URL \
    VITE_MAP_TILE_URL=$VITE_MAP_TILE_URL

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine AS production
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
