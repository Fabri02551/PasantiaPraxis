// Package passwd genera las contraseñas temporales de los usuarios que crea
// el ETL. Solo se usan en la carga: en la base queda el hash bcrypt y la
// contraseña en claro viaja por el correo y por logs/visitadores_*.log.
package passwd

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"strings"
)

// charset sin caracteres ambiguos (0/O, 1/l/I) para que la contraseña se
// pueda copiar a mano desde el correo.
const charset = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"

// Longitud de la contraseña generada.
const Longitud = 12

// Random devuelve una contraseña aleatoria de Longitud caracteres.
func Random() (string, error) {
	max := big.NewInt(int64(len(charset)))
	var sb strings.Builder
	sb.Grow(Longitud)
	for i := 0; i < Longitud; i++ {
		n, err := rand.Int(rand.Reader, max)
		if err != nil {
			return "", fmt.Errorf("generando contraseña: %w", err)
		}
		sb.WriteByte(charset[n.Int64()])
	}
	return sb.String(), nil
}
