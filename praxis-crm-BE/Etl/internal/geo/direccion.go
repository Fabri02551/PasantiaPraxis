// Paquete geo: el formato de la columna `direccion` (JSONB) de medico e
// institucion, y cómo se fusiona lo que trae la cartera con lo que ya está en
// la base.
//
// Está aquí, y no duplicado dentro de cada comando, porque hay dos programas
// que necesitan hablar EXACTAMENTE el mismo idioma:
//
//   - cmd/geocodificar, que convierte el objeto suelto en el array de
//     ubicaciones con id y coordenadas.
//   - internal/stages, el ETL diario, que actualiza la dirección desde el CSV
//     de cartera.
//
// Si cada uno tuviera su propia copia, pasarían un tiempo discrepando y el
// ETL terminaría pisando las coordenadas que el geocodificador escribió.
package geo

import (
	"encoding/json"
	"fmt"
	"strings"
)

// Ubicacion es una entrada de `direccion[]`. Tiene el mismo shape que la app
// (ver medicoDireccion.ts normalizeUbicaciones), para que no haya dos formatos
// conviviendo en el mismo JSONB.
type Ubicacion struct {
	ID        string     `json:"id"`
	Direccion string     `json:"direccion"`
	Detalle   string     `json:"detalle,omitempty"`
	Coords    *[]float64 `json:"coords,omitempty"`
}

// Normalizar convierte el `direccion` guardado en el array de ubicaciones que
// la app ya espera.
//
// Acepta las tres formas que hay en la base por el historial de cargas:
//
//	{"direccion": "HOSPITAL OBRERO"}   objeto suelto (lo que escribe el ETL)
//	[{...}, {...}]                      array (lo que escribe el admin/geocodificador)
//	"texto plano"                       cargas muy viejas
//
// Devuelve el array normalizado y si hubo que cambiar algo.
func Normalizar(raw string) ([]Ubicacion, bool, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" || raw == "{}" || raw == "null" {
		return nil, false, nil
	}

	var parseado any
	if err := json.Unmarshal([]byte(raw), &parseado); err != nil {
		// No es JSON: es texto plano de una carga vieja.
		return []Ubicacion{{ID: "u1", Direccion: raw}}, true, nil
	}

	switch v := parseado.(type) {
	case string:
		return []Ubicacion{{ID: "u1", Direccion: v}}, true, nil

	case map[string]any:
		direccion, _ := v["direccion"].(string)
		detalle, _ := v["detalle"].(string)
		// "0" es el valor centinela del CSV de cartera para "sin
		// institución": no es una dirección y geocodificarlo gastaría un
		// request para no encontrar nada.
		if SinDatos(direccion) {
			return nil, false, nil
		}
		u := Ubicacion{ID: "u1", Direccion: direccion, Detalle: detalle}
		u.Coords = LeerCoords(v["coords"])
		return []Ubicacion{u}, true, nil

	case []any:
		var out []Ubicacion
		for _, item := range v {
			obj, ok := item.(map[string]any)
			if !ok {
				continue
			}
			direccion, _ := obj["direccion"].(string)
			if direccion == "" {
				direccion, _ = obj["hospital"].(string)
			}
			detalle, _ := obj["detalle"].(string)
			if SinDatos(direccion) && SinDatos(detalle) {
				continue
			}
			id, _ := obj["id"].(string)
			if id == "" {
				// El id tiene que ser estable: es lo que guarda
				// visita.ubicacion_destino_id para saber en qué
				// consultorio se estuvo.
				//
				// Se numera DESPUÉS de filtrar, sobre el largo de lo
				// que queda, no sobre el índice original. Si no, un
				// `{"direccion":"0"}` al principio corría la
				// numeración y el médico con un solo consultorio
				// terminaba con "u2" en vez de "u1".
				id = fmt.Sprintf("u%d", len(out)+1)
			}
			out = append(out, Ubicacion{
				ID:        id,
				Direccion: direccion,
				Detalle:   detalle,
				Coords:    LeerCoords(obj["coords"]),
			})
		}
		return out, false, nil

	default:
		return nil, false, nil
	}
}

// SinDatos indica que un texto de dirección no sirve: vacío o el centinela "0"
// con el que el CSV de cartera marca "sin institución".
func SinDatos(s string) bool {
	t := strings.TrimSpace(s)
	return t == "" || t == "0"
}

// LeerCoords solo acepta un [lat, lon] de dos números finitos dentro de rango.
// Cualquier otra cosa (array vacío, null, texto, [999, 999]) se trata como "no
// hay pin", para no guardar basura que después se dibuje en el mapa.
func LeerCoords(v any) *[]float64 {
	arr, ok := v.([]any)
	if !ok || len(arr) != 2 {
		return nil
	}
	lat, ok1 := arr[0].(float64)
	lon, ok2 := arr[1].(float64)
	if !ok1 || !ok2 {
		return nil
	}
	if lat < -90 || lat > 90 || lon < -180 || lon > 180 {
		return nil
	}
	// (0,0) es el golfo de Guinea: el DEFAULT_COORDS que usaba la app antes.
	// No es la ubicación real de nadie.
	if lat == 0 && lon == 0 {
		return nil
	}
	c := []float64{lat, lon}
	return &c
}

// Fusionar combina la dirección que trae el CSV de cartera con la que ya está
// en la base, y devuelve el JSONB a guardar.
//
// Es la pieza que evita que el ETL diario borre el trabajo del geocodificador.
// La regla depende de cuántas ubicaciones haya:
//
//   - 0 en la base: se crea una con el texto de la cartera.
//   - 1 en la base: se actualiza el texto y SE CONSERVAN id, detalle y coords.
//     El CSV trae un solo texto por médico o institución, así que no puede
//     desarmonizar una lista de varias.
//   - 2 o más: la base gana. Un humano cargó varias ubicaciones a mano; el CSV
//     no sabe de ellas y pisarlas sería perder información.
//
// Si la cartera trae el centinela "0" y la base ya tiene una ubicación real, se
// conserva la de la base: "0" significa "el CSV no trae dato", no "borrá esto".
func Fusionar(existenteRaw, textoCartera string) (string, error) {
	textoCartera = strings.TrimSpace(textoCartera)

	existentes, _, err := Normalizar(existenteRaw)
	if err != nil {
		// Si lo que hay guardado no se puede parsear, no se pisa a ciegas:
		// se deja como estaba y el geocodificador lo normaliza después.
		return existenteRaw, nil
	}

	// Varias ubicaciones: manda la base.
	if len(existentes) > 1 {
		b, err := json.Marshal(existentes)
		if err != nil {
			return "", err
		}
		return string(b), nil
	}

	// El CSV no trae nada y la base tampoco: no hay qué guardar.
	if SinDatos(textoCartera) {
		if len(existentes) == 0 {
			return "{}", nil
		}
		b, err := json.Marshal(existentes)
		if err != nil {
			return "", err
		}
		return string(b), nil
	}

	if len(existentes) == 0 {
		b, err := json.Marshal([]Ubicacion{{ID: "u1", Direccion: textoCartera}})
		if err != nil {
			return "", err
		}
		return string(b), nil
	}

	// Una sola ubicación: se actualiza el texto, se conserva todo lo demás.
	u := existentes[0]
	u.Direccion = textoCartera
	b, err := json.Marshal([]Ubicacion{u})
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// CiudadEnDireccion deduce la ciudad del texto de la dirección. Se usa solo
// cuando la persona no tiene ciudad asignada, pero la dirección la menciona
// ("AV. BLANCO GALINDO KM 2.5, QUILLACOLLO").
func CiudadEnDireccion(direccion string) string {
	ciudades := []string{
		"la paz", "santa cruz", "cochabamba", "tarija", "sucre",
		"oruro", "potosí", "potosi", "beni", "pando", "chuquisaca",
		"quillacollo", "montero", "vacas", "tupiza", "villazón", "villazon",
	}
	d := strings.ToLower(direccion)
	for _, c := range ciudades {
		if strings.Contains(d, c) {
			return strings.ToUpper(c[:1]) + c[1:]
		}
	}
	return ""
}
