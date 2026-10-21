package catalog

import "fmt"

// Ciudad es una fila del catálogo de ciudades.
type Ciudad struct {
	Codigo       string
	Nombre       string
	Departamento string
	Sinonimos    []string
}

// Ciudades es el catálogo de ciudades ya indexado, tanto por nombre
// canónico como por cada alias, para resolver los valores crudos de las
// carteras (que traen códigos de departamento como CBBA junto a ciudades
// reales como QUILLACOLLO).
type Ciudades struct {
	Orden    []Ciudad
	porID    map[string]int // nombre normalizado -> id de la base
	porAlias map[string]int // alias normalizado -> id de la base
	nombres  map[int]string // id de la base -> nombre canónico
}

func LoadCiudades(path string) (*Ciudades, error) {
	rows, err := readCSV(path)
	if err != nil {
		return nil, err
	}

	c := &Ciudades{
		porID:    make(map[string]int, len(rows)*2),
		porAlias: make(map[string]int, len(rows)*4),
		nombres:  make(map[int]string, len(rows)),
	}

	for i, row := range rows {
		nombre := row["nombre"]
		if nombre == "" {
			return nil, fmt.Errorf("%s fila %d: la columna 'nombre' es obligatoria", path, i+2)
		}
		ciudad := Ciudad{
			Codigo:       row["codigo"],
			Nombre:       nombre,
			Departamento: row["departamento"],
			Sinonimos:    splitSinonimos(row["sinonimos"]),
		}
		c.Orden = append(c.Orden, ciudad)

		// La posición en Orden es temporal: se reemplaza por el id real de
		// la base cuando la etapa ciudad las inserta.
		c.porID[Normalize(nombre)] = i
		for _, alias := range ciudad.Sinonimos {
			c.porAlias[Normalize(alias)] = i
		}
		if ciudad.Codigo != "" {
			c.porAlias[Normalize(ciudad.Codigo)] = i
		}
	}
	return c, nil
}

// Bind reemplaza el índice de posición de una ciudad por el id que le
// asignó la base. La etapa ciudad lo llama durante la carga para que las
// etapas siguientes puedan resolver ids reales.
func (c *Ciudades) Bind(indice, id int) {
	if indice < 0 || indice >= len(c.Orden) {
		return
	}
	clave := Normalize(c.Orden[indice].Nombre)
	c.porID[clave] = id
	c.nombres[id] = c.Orden[indice].Nombre
	for _, alias := range c.Orden[indice].Sinonimos {
		c.porAlias[Normalize(alias)] = id
	}
	if c.Orden[indice].Codigo != "" {
		c.porAlias[Normalize(c.Orden[indice].Codigo)] = id
	}
}

// IDByName devuelve el id de la base de una ciudad por su nombre canónico.
func (c *Ciudades) IDByName(nombre string) (int, bool) {
	id, ok := c.porID[Normalize(nombre)]
	return id, ok
}

// IDByAlias resuelve un valor crudo de la columna CIUDAD. Acepta el nombre
// canónico, cualquier alias y el código corto.
func (c *Ciudades) IDByAlias(valor string) (int, bool) {
	key := Normalize(valor)
	if key == "" {
		return 0, false
	}
	if id, ok := c.porID[key]; ok {
		return id, true
	}
	id, ok := c.porAlias[key]
	return id, ok
}

// NombrePorID devuelve el nombre canónico de una ciudad ya cargada.
func (c *Ciudades) NombrePorID(id int) string {
	return c.nombres[id]
}

// CodigoPorNombre devuelve el código corto de una ciudad canónica.
func (c *Ciudades) CodigoPorNombre(nombre string) string {
	if i, ok := c.porID[Normalize(nombre)]; ok {
		return c.Orden[i].Codigo
	}
	return ""
}

// SinAlias devuelve los valores crudos de la columna CIUDAD que el catálogo
// no reconoce. El ETL los reporta para que se agreguen al CSV en vez de
// perderse en silencio.
func (c *Ciudades) SinAlias(valores []string) []string {
	var out []string
	vistos := make(map[string]bool)
	for _, v := range valores {
		if Normalize(v) == "" {
			continue
		}
		if _, ok := c.IDByAlias(v); ok || vistos[Normalize(v)] {
			continue
		}
		vistos[Normalize(v)] = true
		out = append(out, v)
	}
	return out
}
