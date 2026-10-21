package visitador

import (
	"log"
	"strings"

	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/catalog"
)

// Mapa resuelve la columna "VISITADOR ASIGNADO" de las carteras de médicos e
// instituciones hacia el persona_id del visitador.
//
// La columna no trae el nombre completo del visitador del CSV sino la forma
// con la que lo conoce el visitador en la calle: "JAHAZIEL FACIO" cuando el
// CSV lo tiene como "Jahaziel Belen Facio", o "OCTAVIA CRUZ" cuando el CSV
// lo tiene como "Celcina Cruz Menacho". Por eso se indexa el visitador con
// varias claves y se resuelve por tokens.
//
// Un apellido que corresponde a dos visitadores queda ambiguo y se
// descarta: es preferible dejar al médico sin visitador (la columna es NULL)
// que asignarle el visitador equivocado, porque un error de asignación se
// descubre cuando el reporte de visitas sale mal.
type Mapa struct {
	ids    map[string]int
	ambig  map[string]bool
	ciudad map[int]int // persona_id -> ciudad_id
}

func NewMapa() *Mapa {
	return &Mapa{
		ids:    make(map[string]int),
		ambig:  make(map[string]bool),
		ciudad: make(map[int]int),
	}
}

func (m *Mapa) agregar(clave string, id int) {
	clave = catalog.Normalize(clave)
	if clave == "" {
		return
	}
	if m.ambig[clave] {
		return
	}
	if previo, ok := m.ids[clave]; ok {
		if previo == id {
			return
		}
		delete(m.ids, clave)
		m.ambig[clave] = true
		log.Printf("[visitador] alias ambiguo %q: se descarta (persona_id %d y %d)", clave, previo, id)
		return
	}
	m.ids[clave] = id
}

// Agregar indexa un visitador con todas las claves por las que las carteras
// lo pueden nombrar.
func (m *Mapa) Agregar(v Visitador, personaID int) {
	if v.CiudadID != nil {
		m.ciudad[personaID] = *v.CiudadID
	}

	nombre := catalog.Normalize(v.Nombre)
	pri := catalog.Normalize(v.PrimerApellido)
	seg := catalog.Normalize(v.SegundoApellido)

	// "Nombre PrimerApellido SegundoApellido" y sus prefijos
	m.agregar(nombre+" "+pri+" "+seg, personaID)
	m.agregar(nombre+" "+pri, personaID)
	m.agregar(nombre, personaID)

	// Cada palabra del nombre por separado: el CSV trae nombres compuestos
	// ("Paulo Andre", "Yesenia Marahi", "Lilibeth Alejandra") y la kartera
	// suele usar solo la parte que el visitador reconoce.
	for _, token := range strings.Fields(nombre) {
		m.agregar(token, personaID)
	}

	// Los apellidos por separado: es lo que rescata los casos en que la
	// kartera usa un apodo en lugar del nombre de pila.
	if pri != "" {
		m.agregar(pri, personaID)
	}
	if seg != "" {
		m.agregar(seg, personaID)
	}
}

// Resolver devuelve el persona_id del visitador nombrado por la cartera.
// Primero prueba la cadena completa y después cada palabra, que es lo que
// permite emparejar "OCTAVIA CRUZ" con "Celcina Cruz Menacho".
func (m *Mapa) Resolver(nombre string) (int, bool) {
	clave := catalog.Normalize(nombre)
	if clave == "" {
		return 0, false
	}
	if id, ok := m.ids[clave]; ok {
		return id, true
	}
	for _, token := range strings.Fields(clave) {
		if id, ok := m.ids[token]; ok {
			return id, true
		}
	}
	return 0, false
}

// CiudadDe devuelve la ciudad del visitador. Se usa como valor de respaldo
// cuando la cartera de médicos o instituciones viene sin columna CIUDAD.
func (m *Mapa) CiudadDe(personaID int) (int, bool) {
	id, ok := m.ciudad[personaID]
	return id, ok
}

// TotalAliases cuenta las claves con las que las carteras pueden nombrar a
// un visitador. Sirve para detectar carteras que no van a resolver.
func (m *Mapa) TotalAliases() int {
	return len(m.ids) - len(m.ambig)
}

// SinAlias devuelve los valores crudos de "VISITADOR ASIGNADO" que no
// corresponden a ningún visitador cargado.
func (m *Mapa) SinAlias(valores []string) []string {
	var out []string
	vistos := make(map[string]bool)
	for _, v := range valores {
		if catalog.Normalize(v) == "" {
			continue
		}
		if _, ok := m.Resolver(v); ok || vistos[catalog.Normalize(v)] {
			continue
		}
		vistos[catalog.Normalize(v)] = true
		out = append(out, strings.TrimSpace(v))
	}
	return out
}
