package visitador

// Visitador es un registro extraído y normalizado desde la fuente externa.
type Visitador struct {
	Nombre          string
	PrimerApellido  string
	SegundoApellido string
	Sexo            string
	Correo          string
	Telefono        string
	CI              string
	DeptoCodigo     string
	CiudadID        *int
	Nacimiento      *string // "YYYY-MM-DD" o nil cuando no hay fecha
}

// Result describe el resultado de la carga de un visitador en la BD.
type Result struct {
	Nombre          string
	PrimerApellido  string
	SegundoApellido string
	Email           string
	CI              string
	Ciudad          string
	Password        string
	Estado          string // insertado | omitido | error
	Detalle         string
}
