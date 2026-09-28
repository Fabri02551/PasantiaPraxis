package visitador

import "strings"

// Departamentos de Bolivia. El nombre canónico de cada uno debe existir en
// src/ciudad/ciudades.csv, que es quien los carga en la tabla ciudad.
var Departamentos = []string{
	"Chuquisaca",
	"La Paz",
	"Cochabamba",
	"Oruro",
	"Potosí",
	"Tarija",
	"Santa Cruz",
	"Beni",
	"Pando",
}

// deptoPorExtension mapea las abreviaturas usadas en la columna depto del
// CSV de visitadores al nombre del departamento. El catálogo de ciudades ya
// trae estos códigos como alias, así que esto es solo el respaldo para cuando
// el catálogo quedó desactualizado.
var deptoPorExtension = map[string]string{
	"SC":    "Santa Cruz",
	"SCZ":   "Santa Cruz",
	"SANTA": "Santa Cruz",
	"LP":    "La Paz",
	"CBBA":  "Cochabamba",
	"CBB":   "Cochabamba",
	"OR":    "Oruro",
	"PT":    "Potosí",
	"TJA":   "Tarija",
	"T":     "Tarija",
	"CH":    "Chuquisaca",
	"BE":    "Beni",
	"BEN":   "Beni",
	"BN":    "Beni",
	"PA":    "Pando",
	"PD":    "Pando",
	"PND":   "Pando",
}

// deptoNombre traduce la abreviatura de un departamento a su nombre canónico.
func deptoNombre(codigo string) string {
	if codigo == "" {
		return ""
	}
	return deptoPorExtension[strings.ToUpper(strings.TrimSpace(codigo))]
}
