package geo

import (
	"encoding/json"
	"testing"
)

// Simula exactamente lo que hace una corrida del ETL sobre una fila ya
// geocodificada: el texto de la cartera vuelve a ser el mismo, pero la pasada
// no debe perder el pin.
func TestCorridaETLNoPierdeElPin(t *testing.T) {
	// 1ª corrida: el ETL pasa el objeto suelto a array.
	primera, _, err := Normalizar(`{"direccion":"HOSPITAL OBRERO"}`)
	if err != nil {
		t.Fatal(err)
	}
	b := mustJSON(primera)

	// el geocodificador le pone el pin
	var us []Ubicacion
	mustUnmarshal(b, &us)
	us[0].Coords = ptr([]float64{-17.7833, -63.1821})
	conPin := mustJSON(us)

	// 2ª corrida del ETL: mismo texto de cartera
	tras, err := Fusionar(conPin, "HOSPITAL OBRERO")
	if err != nil {
		t.Fatal(err)
	}
	var finales []Ubicacion
	mustUnmarshal(tras, &finales)

	if finales[0].Coords == nil {
		t.Fatal("el ETL borró el pin")
	}
	if (*finales[0].Coords)[0] != -17.7833 {
		t.Errorf("pin alterado: %v", *finales[0].Coords)
	}
	// 3ª corrida, por si acaso
	tercera, err := Fusionar(tras, "HOSPITAL OBRERO")
	if err != nil {
		t.Fatal(err)
	}
	if tercera != tras {
		t.Errorf("no es estable entre corridas:\n1 = %s\n2 = %s", tras, tercera)
	}
	t.Logf("estable tras 3 corridas: %s", tercera)
}

func mustJSON(v any) string {
	b, err := json.Marshal(v)
	if err != nil {
		panic(err)
	}
	return string(b)
}
func mustUnmarshal(s string, v any) {
	if err := json.Unmarshal([]byte(s), v); err != nil {
		panic(err)
	}
}
