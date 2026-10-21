package visitador

import (
	"os"
	"path/filepath"
	"testing"
)

func TestExtractCoordenadas(t *testing.T) {
	vis, err := Extract(filepath.Join("..", "..", "src", "vistadores", "visitadores.csv"))
	if err != nil {
		t.Fatalf("Extract: %v", err)
	}
	if len(vis) != 12 {
		t.Fatalf("se esperaban 12 visitadores, se obtuvieron %d", len(vis))
	}

	if vis[0].Nombre != "Consuelo" {
		t.Fatalf("el primer visitador debería ser Consuelo, es %q", vis[0].Nombre)
	}
	if vis[0].Latitud == nil || vis[0].Longitud == nil {
		t.Fatalf("Consuelo (SC) debería traer coordenadas: %v, %v", vis[0].Latitud, vis[0].Longitud)
	}
	if *vis[0].Latitud != -17.78629 || *vis[0].Longitud != -63.18117 {
		t.Fatalf("coordenadas de Santa Cruz mal parseadas: %f, %f", *vis[0].Latitud, *vis[0].Longitud)
	}

	// Los visitadores sin departamento quedan sin coordenadas (NULL).
	for _, v := range vis {
		if v.CI == "5159014" && (v.Latitud != nil || v.Longitud != nil) {
			t.Fatalf("Gualberto no tiene depto, no debería tener coordenadas: %v, %v", v.Latitud, v.Longitud)
		}
		if v.CI == "9762020" && (v.Latitud != nil || v.Longitud != nil) {
			t.Fatalf("Lilibeth no tiene depto, no debería tener coordenadas: %v, %v", v.Latitud, v.Longitud)
		}
	}

	// Rocio (SC), la última fila, sí trae coordenadas.
	ultimo := vis[len(vis)-1]
	if ultimo.CI != "" || ultimo.Nombre != "Rocio" {
		t.Fatalf("la última fila debería ser Rocio: %+v", ultimo)
	}
	if ultimo.Latitud == nil || *ultimo.Latitud != -17.78629 {
		t.Fatalf("Rocio debería traer la latitud de Santa Cruz, tiene %v", ultimo.Latitud)
	}
}

// TestExtractSinColumnaDeCoordenadas asegura que un CSV sin las columnas
// latitud,longitud sigue siendo válido: el ETL no puede romperse con fuentes
// viejas.
func TestExtractSinColumnaDeCoordenadas(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "viejos.csv")
	if err := os.WriteFile(path, []byte(
		"nombre,primer_apellido,segundo_apellido,ci,depto,telefono,nacimiento,correo\n"+
			"Ana,Diaz,Perez,123,LP,60000000,1990-01-01,ana@praxis.com\n",
	), 0o644); err != nil {
		t.Fatal(err)
	}

	vis, err := Extract(path)
	if err != nil {
		t.Fatalf("Extract: %v", err)
	}
	if len(vis) != 1 {
		t.Fatalf("se esperaba 1 visitador, se obtuvieron %d", len(vis))
	}
	if vis[0].Latitud != nil || vis[0].Longitud != nil {
		t.Fatalf("sin la columna, las coordenadas deben quedar nil: %v, %v", vis[0].Latitud, vis[0].Longitud)
	}
}
