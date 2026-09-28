# ETL del backend Praxis CRM

Proceso batch en Go que **E**xtrae datos de orígenes externos, los **T**ransforma (limpieza, normalización, deduplicación) y los **L**oads (carga) en la base de datos del CRM.

## Estructura de carpetas

```
Etl/
├── cmd/
│   └── etl/            # Punto de entrada. Contiene main.go: dispara el pipeline.
├── internal/           # Código privado del proceso (Go impide importarlo desde fuera).
│   ├── config/         # Lectura de variables de entorno: BD, tamaño de lote, frecuencia.
│   ├── extractor/      # Extracción: lee datos de las fuentes (APIs externas, CSV, BD origen).
│   ├── transformer/    # Transformación: valida, limpia y normaliza los registros extraídos.
│   ├── loader/         # Carga: escribe los registros transformados en la BD destino.
│   ├── pipeline/       # Orquestación: conecta extract → transform → load y controla errores.
│   └── models/         # Structs compartidos que viajan por el pipeline.
├── scripts/            # Scripts auxiliares (SQL ad-hoc, utilidades de mantenimiento).
├── Dockerfile          # Imagen Docker multi-stage para ejecutar el proceso.
├── go.mod / go.sum     # Dependencias del módulo Go.
└── README.md           # Este archivo.
```

## Flujo del pipeline

```
Fuentes → extractor → transformer → loader → BD del CRM
```

Cada etapa está desacoplada detrás de una interfaz (`Extractor`, `Transformer`, `Loader`), lo que permite agregar nuevas fuentes o destinos sin tocar la orquestación.

## Ejecución local

```bash
go run ./cmd/etl
```

## Convenciones

- Una corrida debe ser idempotente: reejecutar no duplica datos.
- Los errores de una etapa abortan el pipeline con contexto (`fmt.Errorf("etapa: %w", err)`).
- Procesar por lotes (`BatchSize`) para no cargar todo en memoria.

## Diferencia con Api/

| | Api | Etl |
|---|---|---|
| Tipo | Servicio HTTP siempre activo | Proceso batch periódico |
| Entrada | Peticiones HTTP | Fuentes de datos externas |
| Salida | Respuestas JSON | Datos cargados en la BD |
