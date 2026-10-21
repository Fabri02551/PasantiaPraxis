package passwd

import (
	"strings"
	"testing"
)

func TestRandom(t *testing.T) {
	primera, err := Random()
	if err != nil {
		t.Fatalf("Random: %v", err)
	}
	if len(primera) != Longitud {
		t.Errorf("longitud: se espera %d, llegó %d (%q)", Longitud, len(primera), primera)
	}
	for _, r := range primera {
		if !strings.ContainsRune(charset, r) {
			t.Errorf("el carácter %q no está en el charset", r)
			break
		}
	}
	// Sin caracteres ambiguos (0/O, 1/l/I): la contraseña se suele
	// transcribir a mano desde el correo.
	for _, ambiguo := range "0O1lI" {
		if strings.ContainsRune(charset, ambiguo) {
			t.Errorf("el charset no debería tener el carácter ambiguo %q", ambiguo)
		}
	}

	segunda, err := Random()
	if err != nil {
		t.Fatalf("Random: %v", err)
	}
	if primera == segunda {
		t.Error("dos contraseñas seguidas salieron iguales")
	}
}

func TestRandomSinRepetidos(t *testing.T) {
	// 12 caracteres sobre 58: repetir una contraseña completa sería casi
	// imposible por azar. Sirve para detectar un generador constantemente
	// roto (siempre el mismo valor).
	vistas := map[string]bool{}
	for i := 0; i < 100; i++ {
		p, err := Random()
		if err != nil {
			t.Fatalf("Random: %v", err)
		}
		if vistas[p] {
			t.Fatalf("contraseña repetida en la corrida %d: %q", i, p)
		}
		vistas[p] = true
	}
}
