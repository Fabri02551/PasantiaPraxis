package geo

import (
	"reflect"
	"testing"
)

func TestNormalizar(t *testing.T) {
	casos := []struct {
		nombre   string
		entrada  string
		quiere   []Ubicacion
		cambiada bool
	}{
		{
			nombre:   "objeto suelto del ETL",
			entrada:  `{"direccion":"HOSPITAL OBRERO","detalle":"Piso 3"}`,
			quiere:   []Ubicacion{{ID: "u1", Direccion: "HOSPITAL OBRERO", Detalle: "Piso 3"}},
			cambiada: true,
		},
		{
			nombre:   "sentinel 0 se descarta",
			entrada:  `{"direccion":"0"}`,
			quiere:   nil,
			cambiada: false,
		},
		{
			nombre:   "sentinel 0 con espacios",
			entrada:  `{"direccion":" 0 "}`,
			quiere:   nil,
			cambiada: false,
		},
		{
			nombre:   "objeto conserva coords",
			entrada:  `{"direccion":"CLINICA X","coords":[-17.7833,-63.1821]}`,
			quiere:   []Ubicacion{{ID: "u1", Direccion: "CLINICA X", Coords: ptr([]float64{-17.7833, -63.1821})}},
			cambiada: true,
		},
		{
			nombre:   "coords 0,0 (Quito por defecto) se ignoran",
			entrada:  `{"direccion":"CLINICA X","coords":[0,0]}`,
			quiere:   []Ubicacion{{ID: "u1", Direccion: "CLINICA X"}},
			cambiada: true,
		},
		{
			nombre:   "coords fuera de rango se ignoran",
			entrada:  `{"direccion":"CLINICA X","coords":[999,999]}`,
			quiere:   []Ubicacion{{ID: "u1", Direccion: "CLINICA X"}},
			cambiada: true,
		},
		{
			nombre:   "texto plano de carga vieja",
			entrada:  `"AV. 6 DE AGOSTO 123"`,
			quiere:   []Ubicacion{{ID: "u1", Direccion: "AV. 6 DE AGOSTO 123"}},
			cambiada: true,
		},
		{
			nombre:   "array ya normalizado no se toca",
			entrada:  `[{"id":"u1","direccion":"HOSPITAL A","coords":[-17.78,-63.18]}]`,
			quiere:   []Ubicacion{{ID: "u1", Direccion: "HOSPITAL A", Coords: ptr([]float64{-17.78, -63.18})}},
			cambiada: false,
		},
		{
			nombre:   "array sin id gana id estable y denso",
			entrada:  `[{"direccion":"0"},{"direccion":"CONSULTORIO A"},{"direccion":"CONSULTORIO B"}]`,
			quiere:   []Ubicacion{{ID: "u1", Direccion: "CONSULTORIO A"}, {ID: "u2", Direccion: "CONSULTORIO B"}},
			cambiada: false,
		},
		{
			nombre:   "array con hospital como nombre",
			entrada:  `[{"hospital":"SANTA MARIA"}]`,
			quiere:   []Ubicacion{{ID: "u1", Direccion: "SANTA MARIA"}},
			cambiada: false,
		},
		{
			nombre:   "objeto vacío",
			entrada:  `{}`,
			quiere:   nil,
			cambiada: false,
		},
		{
			nombre:   "json null",
			entrada:  `null`,
			quiere:   nil,
			cambiada: false,
		},
		{
			nombre:   "cadena vacía",
			entrada:  `  `,
			quiere:   nil,
			cambiada: false,
		},
	}

	for _, c := range casos {
		t.Run(c.nombre, func(t *testing.T) {
			obtenido, cambiada, err := Normalizar(c.entrada)
			if err != nil {
				t.Fatalf("error inesperado: %v", err)
			}
			if cambiada != c.cambiada {
				t.Errorf("cambiada = %v, quiero %v", cambiada, c.cambiada)
			}
			if !equal(obtenido, c.quiere) {
				t.Errorf("obtenido = %+v, quiero %+v", obtenido, c.quiere)
			}
		})
	}
}

// TestNormalizarEsIdempotente protege el ciclo "el ETL escribe objeto, el
// geocodificador lo pasa a array, y la próxima corrida del ETL no lo rompe".
func TestNormalizarEsIdempotente(t *testing.T) {
	primera, _, err := Normalizar(`{"direccion":"HOSPITAL OBRERO","detalle":"Piso 3"}`)
	if err != nil {
		t.Fatal(err)
	}
	segunda, cambiada, err := Normalizar(`[{"id":"u1","direccion":"HOSPITAL OBRERO","detalle":"Piso 3"}]`)
	if err != nil {
		t.Fatal(err)
	}
	if cambiada {
		t.Error("no debería marcar cambio: el array ya estaba normalizado")
	}
	if !equal(primera, segunda) {
		t.Errorf("no es idempotente:\nprimera = %+v\nsegunda = %+v", primera, segunda)
	}
}

// TestFusionerConservaCoordenadas es el test que justifica la función: sin
// esto, la corrida diaria del ETL borraría los pines del geocodificador.
func TestFusionerConservaCoordenadas(t *testing.T) {
	casos := []struct {
		nombre    string
		existente string
		cartera   string
		quiere    []Ubicacion
	}{
		{
			nombre:    "base vacía, la cartera manda",
			existente: "",
			cartera:   "HOSPITAL OBRERO",
			quiere:    []Ubicacion{{ID: "u1", Direccion: "HOSPITAL OBRERO"}},
		},
		{
			nombre:    "objeto del ETL se normaliza",
			existente: `{"direccion":"HOSPITAL OBRERO"}`,
			cartera:   "HOSPITAL OBRERO",
			quiere:    []Ubicacion{{ID: "u1", Direccion: "HOSPITAL OBRERO"}},
		},
		{
			nombre:    "coords y detalle sobreviven al ETL",
			existente: `[{"id":"u1","direccion":"HOSPITAL OBRERO","detalle":"Piso 3","coords":[-17.7833,-63.1821]}]`,
			cartera:   "HOSPITAL OBRERO",
			quiere:    []Ubicacion{{ID: "u1", Direccion: "HOSPITAL OBRERO", Detalle: "Piso 3", Coords: ptr([]float64{-17.7833, -63.1821})}},
		},
		{
			nombre:    "la cartera corrige el texto sin perder el pin",
			existente: `[{"id":"u1","direccion":"HOSP OBRERO","coords":[-17.78,-63.18]}]`,
			cartera:   "HOSPITAL OBRERO",
			quiere:    []Ubicacion{{ID: "u1", Direccion: "HOSPITAL OBRERO", Coords: ptr([]float64{-17.78, -63.18})}},
		},
		{
			nombre:    "sentinel 0 de la cartera no borra la base",
			existente: `[{"id":"u1","direccion":"HOSPITAL OBRERO","coords":[-17.78,-63.18]}]`,
			cartera:   "0",
			quiere:    []Ubicacion{{ID: "u1", Direccion: "HOSPITAL OBRERO", Coords: ptr([]float64{-17.78, -63.18})}},
		},
		{
			nombre:    "varias ubicaciones: manda la base",
			existente: `[{"id":"u1","direccion":"CONSULTORIO A","coords":[-17.78,-63.18]},{"id":"u2","direccion":"CONSULTORIO B"}]`,
			cartera:   "HOSPITAL OBRERO",
			quiere: []Ubicacion{
				{ID: "u1", Direccion: "CONSULTORIO A", Coords: ptr([]float64{-17.78, -63.18})},
				{ID: "u2", Direccion: "CONSULTORIO B"},
			},
		},
		{
			nombre:    "nada en ninguna parte",
			existente: "",
			cartera:   "0",
			quiere:    nil,
		},
	}

	for _, c := range casos {
		t.Run(c.nombre, func(t *testing.T) {
			obtenido, err := Fusionar(c.existente, c.cartera)
			if err != nil {
				t.Fatalf("error inesperado: %v", err)
			}
			us, _, err := Normalizar(obtenido)
			if err != nil {
				t.Fatalf("el resultado no es normalizable: %v (obtenido %q)", err, obtenido)
			}
			if !equal(us, c.quiere) {
				t.Errorf("obtenido = %+v, quiero %+v", us, c.quiere)
			}
		})
	}
}

// TestFusionerLimpiaCoordsInvalidas: un `coords` que no es un par de números
// no debe sobrevivir a la pasada del ETL. Es preferible perder un pin dudoso
// que dejar basura que se dibuje en el mapa.
func TestFusionerLimpiaCoordsInvalidas(t *testing.T) {
	casos := []string{
		`{"direccion":"HOSPITAL OBRERO","coords":"basura"}`,
		`{"direccion":"HOSPITAL OBRERO","coords":[]}`,
		`{"direccion":"HOSPITAL OBRERO","coords":[1,2,3]}`,
		`{"direccion":"HOSPITAL OBRERO","coords":[999,999]}`,
		`{"direccion":"HOSPITAL OBRERO","coords":[0,0]}`,
	}
	for _, existente := range casos {
		obtenido, err := Fusionar(existente, "HOSPITAL OBRERO")
		if err != nil {
			t.Fatalf("%s: error inesperado: %v", existente, err)
		}
		us, _, err := Normalizar(obtenido)
		if err != nil {
			t.Fatalf("%s: el resultado no es normalizable: %v", existente, err)
		}
		if len(us) != 1 {
			t.Fatalf("%s: esperaba 1 ubicación, obtuve %d", existente, len(us))
		}
		if us[0].Coords != nil {
			t.Errorf("%s: las coords inválidas debieron descartarse, quedaron %v", existente, *us[0].Coords)
		}
		if us[0].Direccion != "HOSPITAL OBRERO" {
			t.Errorf("%s: se perdió la dirección, quedó %q", existente, us[0].Direccion)
		}
	}
}

func TestCiudadEnDireccion(t *testing.T) {
	casos := map[string]string{
		"COSS MIL, SANTA CRUZ":      "Santa cruz",
		"av. 6 de agosto, La Paz":   "La paz",
		"HOSPITAL OBRERO":           "",
		"CLINICA QUILLACOLLO":       "Quillacollo",
		"consultorio potosi centro": "Potosi",
	}
	for entrada, quiero := range casos {
		if obtenido := CiudadEnDireccion(entrada); obtenido != quiero {
			t.Errorf("CiudadEnDireccion(%q) = %q, quiero %q", entrada, obtenido, quiero)
		}
	}
}

func ptr[T any](v T) *T { return &v }

// equal delega en reflect.DeepEqual, que sigue los punteros: dos *float64 a
// datos iguales se consideran iguales.
func equal(a, b []Ubicacion) bool {
	return reflect.DeepEqual(a, b)
}
