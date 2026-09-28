package catalog

import "fmt"

// Especialidad es una fila del catálogo canónico de especialidades.
type Especialidad struct {
	Codigo    string
	Nombre    string
	Sinonimos []string
}

// Especialidades es el catálogo de especialidades indexado por código, por
// nombre canónico y por cada alias.
//
// El CSV de carteras trae 188 valores distintos en la columna ESPECIALIDAD
// (GAS, GASTRO, GASTROENTEROLOGIA, MGE, MEG, M.GEN...) que en realidad son
// unas 40 especialidades. El catálogo los colapsa y deja el código canónico
// como identidad estable de la especialidad.
type Especialidades struct {
	Orden    []Especialidad
	porID    map[string]int // nombre o código normalizado -> id
	porAlias map[string]int // alias normalizado -> id
}

func LoadEspecialidades(path string) (*Especialidades, error) {
	rows, err := readCSV(path)
	if err != nil {
		return nil, err
	}

	e := &Especialidades{
		porID:    make(map[string]int, len(rows)*2),
		porAlias: make(map[string]int, len(rows)*6),
	}

	// indice local para detectar sinónimos declarados dos veces
	declarado := make(map[string]string, len(rows)*6)

	for i, row := range rows {
		codigo := row["codigo"]
		nombre := row["nombre"]
		if codigo == "" || nombre == "" {
			return nil, fmt.Errorf("%s fila %d: 'codigo' y 'nombre' son obligatorios", path, i+2)
		}
		esp := Especialidad{
			Codigo:    codigo,
			Nombre:    nombre,
			Sinonimos: splitSinonimos(row["sinonimos"]),
		}
		e.Orden = append(e.Orden, esp)

		for _, clave := range []string{nombre, codigo} {
			key := Normalize(clave)
			if previo, ok := declarado[key]; ok && previo != codigo {
				return nil, fmt.Errorf("%s fila %d: %q ya estaba declarado como %q, no puede ser también %q",
					path, i+2, clave, previo, codigo)
			}
			declarado[key] = codigo
			e.porID[key] = i
		}
		for _, alias := range esp.Sinonimos {
			key := Normalize(alias)
			if previo, ok := declarado[key]; ok && previo != codigo {
				return nil, fmt.Errorf("%s fila %d: el alias %q ya estaba declarado en %q, no puede ser también en %q",
					path, i+2, alias, previo, codigo)
			}
			declarado[key] = codigo
			e.porAlias[key] = i
		}
	}
	return e, nil
}

// Bind reemplaza el índice de posición de una especialidad por el id que le
// asignó la base.
func (e *Especialidades) Bind(indice, id int) {
	if indice < 0 || indice >= len(e.Orden) {
		return
	}
	esp := e.Orden[indice]
	e.porID[Normalize(esp.Nombre)] = id
	e.porID[Normalize(esp.Codigo)] = id
	for _, alias := range esp.Sinonimos {
		e.porAlias[Normalize(alias)] = id
	}
}

// IDByCode devuelve el id de la base de una especialidad por su código
// canónico.
func (e *Especialidades) IDByCode(codigo string) (int, bool) {
	id, ok := e.porID[Normalize(codigo)]
	return id, ok
}

// IDByAlias resuelve un valor crudo de la columna ESPECIALIDAD. Acepta el
// código, el nombre canónico y cualquier alias del catálogo.
func (e *Especialidades) IDByAlias(valor string) (int, bool) {
	key := Normalize(valor)
	if key == "" {
		return 0, false
	}
	if id, ok := e.porID[key]; ok {
		return id, true
	}
	id, ok := e.porAlias[key]
	return id, ok
}

// NombrePorID devuelve el nombre canónico de una especialidad ya cargada.
func (e *Especialidades) NombrePorID(id int) string {
	if id >= 0 && id < len(e.Orden) {
		return e.Orden[id].Nombre
	}
	return ""
}

// SinAlias devuelve los valores crudos de ESPECIALIDAD que el catálogo no
// reconoce. El ETL los reporta como error: es preferible que la corrida
// avise a que adivine la especialidad de un médico.
func (e *Especialidades) SinAlias(valores []string) []string {
	var out []string
	vistos := make(map[string]bool)
	for _, v := range valores {
		if Normalize(v) == "" {
			continue
		}
		if _, ok := e.IDByAlias(v); ok || vistos[Normalize(v)] {
			continue
		}
		vistos[Normalize(v)] = true
		out = append(out, v)
	}
	return out
}

// IDPendiente es el código de la especialidad "Sin especificar (revisar)".
// Los valores de las carteras que no son una especialidad real (LAB,
// HOSPITAL, CONSULTORIO VILLAMED, 0...) apuntan ahí para que el dato quede
// visible y se corrija a mano, en vez de inventarle una especialidad.
const IDPendiente = "PEND"
