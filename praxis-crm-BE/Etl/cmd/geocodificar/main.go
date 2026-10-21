// Comando geocodificar: corre el geocodificado de las ubicaciones de médicos
// e instituciones contra OpenStreetMap (Nominatim).
//
// Es una CORRIDA ÚNICA, no una etapa del pipeline: con 1888 médicos y 284
// instituciones, y la política de uso de Nominatim que pide 1 request por
// segundo, la corrida completa tarda unos 35 minutos. Meterlo en el ETL
// diario lo haría fallar o abusar del servicio.
//
// Qué hace, en dos pasos:
//
//  1. NORMALIZA el formato. Hoy la columna `direccion` (JSONB) de medico e
//     institucion guarda un objeto suelto, `{"direccion": "HOSPITAL OBRERO"}`,
//     cargado así por el ETL. La app, en cambio, ya espera un ARRAY de
//     ubicaciones: `[{id, direccion, detalle, coords}]` (ver
//     medicoDireccion.ts normalizeUbicaciones). Este comando convierte lo
//     primero en lo segundo, para que cada médico pase a tener una ubicación
//     con su propio id y sus propias coordenadas.
//
//  2. GEOCODIFICA cada ubicación que todavía no tenga `coords` y guarda el
//     resultado. Las que no resuelven quedan sin `coords` y se listan al final
//     para que una persona las revise a mano.
//
// Es idempotente: solo geocodifica lo que no tiene coordenadas. Con
// -rehacer vuelve a geocodificar todo, por ejemplo después de corregir una
// consulta mal formada.
package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/geo"
)

const (
	nominatimURL = "https://nominatim.openstreetmap.org/search"
	// La política de uso de Nominatim exige 1 request por segundo como
	// máximo. Este User-Agent identifica la herramienta, como piden.
	userAgent = "PraxisCRM-ETL/1.0 (geocodificacion de cartera medica)"
	// Pausa mínima entre requests. Con 2172 filas son ~36 minutos.
	intervaloMinimo = 1100 * time.Millisecond
	// Una dirección de la cartera que no sea un nombre real de lugar
	// ("COSSMIL" sí es; "HERNANDEZ VERA" no) no va a resolver. El cutoff
	// de longitud evita gastar requests en textos que no son direcciones.
	minLongitudConsulta = 5
)

type opciones struct {
	databaseURL  string
	rehacer      bool
	limite       int
	ciudad       string
	sinPausa     bool
	mostrarTodos bool
}

func main() {
	var opt opciones
	flag.StringVar(&opt.databaseURL, "database", getEnv("DATABASE_URL", "postgres://localhost:5432/praxis_crm"), "cadena de conexión a la base")
	flag.BoolVar(&opt.rehacer, "rehacer", false, "geocodificar también las que ya tienen coordenadas")
	flag.IntVar(&opt.limite, "limite", 0, "máximo de filas a procesar (0 = todas). Útil para probar")
	flag.StringVar(&opt.ciudad, "ciudad", "", "forzar la ciudad en la consulta, ignorando la del médico")
	flag.BoolVar(&opt.sinPausa, "rapido", false, "sin pausa entre requests (solo para pruebas; viola la política de Nominatim)")
	flag.BoolVar(&opt.mostrarTodos, "todos", false, "listar también las que sí resolvieron")
	flag.Parse()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := pgxpool.New(ctx, opt.databaseURL)
	if err != nil {
		log.Fatalf("error conectando a la base de datos: %v", err)
	}
	defer pool.Close()
	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("base de datos no alcanzable: %v", err)
	}

	g := &geocodificador{
		pool:      pool,
		rehacer:   opt.rehacer,
		ciudad:    opt.ciudad,
		intervalo: intervaloMinimo,
	}
	if opt.sinPausa {
		g.intervalo = 0
	}

	// El rate limit se aplica sobre el cliente HTTP, no sobre la lógica: así
	// no se puede saltar por accidente aunque se agregue una consulta nueva.
	client := &http.Client{Timeout: 20 * time.Second}
	g.cliente = client

	log.Printf("=== inicio del geocodificado ===")
	if err := g.correr(ctx, opt.limite, opt.mostrarTodos); err != nil {
		log.Fatalf("fallo el geocodificado: %v", err)
	}
	log.Printf("=== fin del geocodificado ===")
}

type fila struct {
	tabla     string // "medico" o "institucion"
	id        int
	nombre    string
	ciudad    string
	direccion string
}

type resultado struct {
	ok           int
	normalizadas int
	sinResolver  []fila
	errores      []string
}

type geocodificador struct {
	pool      *pgxpool.Pool
	cliente   *http.Client
	rehacer   bool
	ciudad    string
	intervalo time.Duration
	ultimo    time.Time
}

func (g *geocodificador) correr(ctx context.Context, limite int, mostrarTodos bool) error {
	medicos, err := g.leer(ctx, "medico", "m.persona_id", "m.matricula",
		`COALESCE(m.direccion->>'direccion',''), COALESCE(c.nombre,'')`,
		`FROM medico m JOIN persona p ON p.id = m.persona_id
		 LEFT JOIN ciudad c ON c.id = p.ciudad_id`)
	if err != nil {
		return err
	}

	instituciones, err := g.leer(ctx, "institucion", "i.id", "i.nombre",
		`COALESCE(i.direccion->>'direccion',''), COALESCE(c.nombre,'')`,
		`FROM institucion i LEFT JOIN ciudad c ON c.id = i.ciudad_id`)
	if err != nil {
		return err
	}

	filas := append(medicos, instituciones...)
	log.Printf("[geo] %d médicos + %d instituciones = %d filas por revisar",
		len(medicos), len(instituciones), len(filas))
	if limite > 0 && limite < len(filas) {
		filas = filas[:limite]
		log.Printf("[geo] -limite activo: solo se procesarán las primeras %d", limite)
	}

	res := resultado{}
	for i, f := range filas {
		if ctx.Err() != nil {
			return ctx.Err()
		}

		// Paso 1: el objeto suelto se vuelve el array que la app espera.
		norm, cambiada, err := geo.Normalizar(f.direccion)
		if err != nil {
			res.errores = append(res.errores, fmt.Sprintf("%s %d: %v", f.tabla, f.id, err))
			continue
		}
		if cambiada {
			if err := g.guardar(ctx, f.tabla, f.id, norm); err != nil {
				res.errores = append(res.errores, fmt.Sprintf("%s %d: %v", f.tabla, f.id, err))
				continue
			}
			res.normalizadas++
		}

		// Paso 2: geocodificar lo que aún no tiene pin.
		for j := range norm {
			u := &norm[j]
			if u.Coords != nil && !g.rehacer {
				continue
			}
			if strings.TrimSpace(u.Direccion) == "" {
				continue
			}

			coordenadas, err := g.buscar(ctx, u.Direccion, f.ciudad)
			if err != nil {
				if ctx.Err() != nil {
					return ctx.Err()
				}
				res.errores = append(res.errores, fmt.Sprintf("%s %d (%s): %v", f.tabla, f.id, u.Direccion, err))
				continue
			}
			if coordenadas == nil {
				res.sinResolver = append(res.sinResolver, f)
				if mostrarTodos {
					log.Printf("[geo] %s %d: SIN RESOLVER %q", f.tabla, f.id, u.Direccion)
				}
				continue
			}

			u.Coords = coordenadas
			if err := g.guardar(ctx, f.tabla, f.id, norm); err != nil {
				res.errores = append(res.errores, fmt.Sprintf("%s %d: %v", f.tabla, f.id, err))
				continue
			}
			res.ok++
			log.Printf("[geo] %s %d: %q → %.5f, %.5f", f.tabla, f.id, u.Direccion, (*coordenadas)[0], (*coordenadas)[1])
		}

		if (i+1)%25 == 0 {
			log.Printf("[geo] %d/%d procesadas, %d geocodificadas, %d sin resolver",
				i+1, len(filas), res.ok, len(res.sinResolver))
		}
	}

	g.resumen(res)
	return nil
}

func (g *geocodificador) leer(ctx context.Context, tabla, colID, colNombre, colDir, from string) ([]fila, error) {
	q := fmt.Sprintf(`SELECT %s, %s, %s FROM %s`, colID, colNombre, colDir, from)
	rows, err := g.pool.Query(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("leyendo %s: %w", tabla, err)
	}
	defer rows.Close()

	var out []fila
	for rows.Next() {
		var f fila
		if err := rows.Scan(&f.id, &f.nombre, &f.direccion, &f.ciudad); err != nil {
			return nil, err
		}
		f.tabla = tabla
		out = append(out, f)
	}
	return out, rows.Err()
}

func (g *geocodificador) guardar(ctx context.Context, tabla string, id int, us []geo.Ubicacion) error {
	// Sin 'coords' en el JSON, pgx lo marshalea a null; la app lo lee
	// como "sin pin" y muestra el mapa vacío, que es lo correcto.
	bytes, err := json.Marshal(us)
	if err != nil {
		return err
	}
	key := "persona_id"
	if tabla == "institucion" {
		key = "id"
	}
	q := fmt.Sprintf(`UPDATE %s SET direccion = $1 WHERE %s = $2`, tabla, key)
	if _, err := g.pool.Exec(ctx, q, bytes, id); err != nil {
		return fmt.Errorf("guardando direccion: %w", err)
	}
	return nil
}

// buscar consulta Nominatim y devuelve [lat, lon], o nil si no resolvió.
func (g *geocodificador) buscar(ctx context.Context, direccion, ciudad string) (*[]float64, error) {
	direccion = strings.TrimSpace(direccion)
	if len([]rune(direccion)) < minLongitudConsulta {
		return nil, nil
	}

	// La ciudad acota la búsqueda: "COSSMIL" solo no encuentra nada, pero
	// "COSSMIL, Santa Cruz, Bolivia" sí. Se prioriza el -ciudad del flag,
	// después la ciudad que viene del médico, y por último se intenta
	// deducirla del texto de la dirección.
	buscarCiudad := strings.TrimSpace(g.ciudad)
	if buscarCiudad == "" {
		buscarCiudad = strings.TrimSpace(ciudad)
	}
	if buscarCiudad == "" {
		buscarCiudad = geo.CiudadEnDireccion(direccion)
	}
	consulta := direccion
	if buscarCiudad != "" {
		consulta = fmt.Sprintf("%s, %s, Bolivia", direccion, buscarCiudad)
	}

	if err := g.esperar(ctx); err != nil {
		return nil, err
	}

	q := url.Values{}
	q.Set("q", consulta)
	q.Set("format", "jsonv2")
	q.Set("limit", "1")
	q.Set("countrycodes", "bo") // Bolivia

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, nominatimURL+"?"+q.Encode(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Accept-Language", "es")

	resp, err := g.cliente.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("nominatim respondió %d", resp.StatusCode)
	}

	var resultados []struct {
		Lat string `json:"lat"`
		Lon string `json:"lon"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&resultados); err != nil {
		return nil, err
	}
	if len(resultados) == 0 {
		return nil, nil
	}

	var lat, lon float64
	if _, err := fmt.Sscanf(resultados[0].Lat, "%g", &lat); err != nil {
		return nil, nil
	}
	if _, err := fmt.Sscanf(resultados[0].Lon, "%g", &lon); err != nil {
		return nil, nil
	}
	if lat < -90 || lat > 90 || lon < -180 || lon > 180 {
		return nil, nil
	}
	c := []float64{lat, lon}
	return &c, nil
}

// esperar aplica la pausa entre requests para respetar el rate limit.
func (g *geocodificador) esperar(ctx context.Context) error {
	if g.intervalo <= 0 {
		return nil
	}
	desde := time.Since(g.ultimo)
	if restante := g.intervalo - desde; restante > 0 {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(restante):
		}
	}
	g.ultimo = time.Now()
	return nil
}

func (g *geocodificador) resumen(res resultado) {
	log.Printf("[geo] -------------------------------------------")
	log.Printf("[geo] normalizadas a formato array: %d", res.normalizadas)
	log.Printf("[geo] geocodificadas con éxito:     %d", res.ok)
	log.Printf("[geo] sin resolver (revisar a mano): %d", len(res.sinResolver))
	log.Printf("[geo] errores:                      %d", len(res.errores))

	if len(res.sinResolver) > 0 {
		log.Printf("[geo] --- ubicaciones sin coordenadas ---")
		for _, f := range res.sinResolver {
			log.Printf("[geo]   %s %d | %s | %s", f.tabla, f.id, f.ciudad, f.direccion)
		}
		// Se deja un archivo para que la revisión manual sea workable
		// sin tener que buscar en un log.
		salida := fmt.Sprintf("logs/sin_geocodificar_%s.csv", time.Now().Format("20060102_150405"))
		if err := os.MkdirAll("logs", 0o755); err == nil {
			if err := os.WriteFile(salida, []byte(csvSinResolver(res.sinResolver)), 0o644); err == nil {
				log.Printf("[geo] lista guardada en %s", salida)
			}
		}
	}
	if len(res.errores) > 0 {
		log.Printf("[geo] --- errores ---")
		for _, e := range res.errores {
			log.Printf("[geo]   %s", e)
		}
	}
}

func csvSinResolver(filas []fila) string {
	var b strings.Builder
	b.WriteString("tabla,id,nombre,ciudad,direccion\n")
	for _, f := range filas {
		fmt.Fprintf(&b, "%s,%d,%q,%q,%q\n", f.tabla, f.id, f.nombre, f.ciudad, f.direccion)
	}
	return b.String()
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
