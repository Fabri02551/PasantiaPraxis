package visitador

// Departamentos de Bolivia cargados en la tabla ciudad.
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

// deptoPorExtension mapea las abreviaturas usadas en la columna C.I. / Exp.
// al nombre del departamento correspondiente.
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
