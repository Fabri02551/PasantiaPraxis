package middleware

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/core/pkg/response"
)

type contextKey string

const RoleKey contextKey = "role"

type Claims struct {
	Role string `json:"role"`
	jwt.RegisteredClaims
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

			ctx := context.WithValue(r.Context(), RoleKey, claims.Role)
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
