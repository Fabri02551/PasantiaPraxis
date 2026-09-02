# Etapa 1: compilación
FROM golang:1.26-alpine AS build

WORKDIR /app

COPY go.mod go.sum* ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /bin/api ./cmd/api

# Etapa 2: imagen final mínima
FROM alpine:3.20

RUN addgroup -S app && adduser -S app -G app

COPY --from=build /bin/api /usr/local/bin/api

USER app
EXPOSE 8080

ENTRYPOINT ["api"]
