package middleware

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/core/crypto"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/core/pkg/response"
)

type contextKey string

const RoleKey contextKey = "role"
const PersonaIDKey contextKey = "persona_id"

type Claims struct {
	// Role y PersonaID llegan CIFRADOS desde generateToken (ver
	// internal/auth/services). Aquí se descifran antes de guardarlos
	// en el contexto. PersonaID vacío = nil.
	Role      string `json:"role"`
	PersonaID string `json:"persona_id,omitempty"`
	jwt.RegisteredClaims
}

// UserPersonaID devuelve el persona_id del usuario autenticado (nil si el
// token no lo incluye, p.ej. tokens emitidos antes de este campo).
func UserPersonaID(ctx context.Context) *int {
	if id, ok := ctx.Value(PersonaIDKey).(*int); ok {
		return id
	}
	return nil
}

// UserRole devuelve el rol del usuario autenticado ("" si el token no lo
// incluye).
func UserRole(ctx context.Context) string {
	role, _ := ctx.Value(RoleKey).(string)
	return role
}

func Auth(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			if header == "" {
				response.Error(w, http.StatusUnauthorized, "token requerido")
				return
			}

			parts := strings.SplitN(header, " ", 2)
			if len(parts) != 2 || parts[0] != "Bearer" {
				response.Error(w, http.StatusUnauthorized, "formato de token inválido")
				return
			}

			claims := &Claims{}
			token, err := jwt.ParseWithClaims(parts[1], claims, func(t *jwt.Token) (any, error) {
				if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, fmt.Errorf("método de firma inválido: %v", t.Header["alg"])
				}
				return []byte(secret), nil
			})
			if err != nil || !token.Valid {
				response.Error(w, http.StatusUnauthorized, "token inválido o expirado")
				return
			}

			// Descifra rol y persona_id. Si falla, el token es inválido o fue
			// emitido antes del cifrado: se exige re-login.
			role, err := crypto.DecryptString(secret, claims.Role)
			if err != nil {
				response.Error(w, http.StatusUnauthorized, "token inválido o expirado")
				return
			}

			var personaID *int
			if claims.PersonaID != "" {
				id, err := crypto.DecryptInt(secret, claims.PersonaID)
				if err != nil {
					response.Error(w, http.StatusUnauthorized, "token inválido o expirado")
					return
				}
				personaID = &id
			}

			ctx := context.WithValue(r.Context(), RoleKey, role)
			ctx = context.WithValue(ctx, PersonaIDKey, personaID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func RequireRole(roles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			role, ok := r.Context().Value(RoleKey).(string)
			if !ok {
				response.Error(w, http.StatusUnauthorized, "no autenticado")
				return
			}

			for _, allowed := range roles {
				if role == allowed {
					next.ServeHTTP(w, r)
					return
				}
			}

			response.Error(w, http.StatusForbidden, "sin permisos")
		})
	}
}
