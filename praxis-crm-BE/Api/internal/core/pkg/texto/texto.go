// Package texto normaliza los campos de texto que se guardan en la base.
//
// Los nombres y apellidos se guardan SIEMPRE en mayúsculas, aunque quien los
// escriba lo haga en minúsculas o mezclado: así se ven iguales en todos los
// listados del panel y en los correos de credenciales. Los correos no se
// tocan acá: se normalizan en minúsculas aparte porque son el login.
package texto

import "strings"

// Mayusculas devuelve el texto en mayúsculas sin los espacios de los costados.
func Mayusculas(v string) string {
	return strings.ToUpper(strings.TrimSpace(v))
}

// MayusculasP hace lo mismo para un campo opcional. Un nil se queda en nil y
// una cadena vacía se devuelve vacía (a quien la recibe le toca decidir si
// eso es "sin valor").
func MayusculasP(v *string) *string {
	if v == nil {
		return nil
	}
	s := Mayusculas(*v)
	return &s
}
