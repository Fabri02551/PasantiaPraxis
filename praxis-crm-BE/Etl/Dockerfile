# Etapa 1: compilación
FROM golang:1.27-alpine AS build

WORKDIR /app

COPY go.mod go.sum* ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /bin/etlinit ./cmd/etlinit

# Etapa 2: imagen final con los CSV y el binario
FROM alpine:3.20

RUN addgroup -S app && adduser -S app -G app

COPY --from=build /bin/etlinit /usr/local/bin/etlinit

# Los CSV que se cargan en la primera corrida. Se copian de la etapa de build
# para que la imagen final no traiga tools ni código fuente.
COPY --from=build /app/src /app/src

# El pipeline escribe aquí el log de cada corrida.
RUN mkdir -p /app/logs && chown -R app:app /app

USER app
WORKDIR /app

ENTRYPOINT ["etlinit"]