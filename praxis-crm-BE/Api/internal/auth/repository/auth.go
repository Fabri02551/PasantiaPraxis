package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/auth/models"
)

type AuthRepository struct {
	pool *pgxpool.Pool
}

func NewAuthRepository(pool *pgxpool.Pool) *AuthRepository {
	return &AuthRepository{pool: pool}
}

func (r *AuthRepository) CreateWithPersona(ctx context.Context, user *models.User, passwordHash string, persona *models.Persona) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("error starting transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	var personaID int
	err = tx.QueryRow(ctx,
		`INSERT INTO persona (nombre, primer_apellido, segundo_apellido, sexo, correo, telefono, ci)
		 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
		persona.Nombre, persona.PrimerApellido, persona.SegundoApellido, persona.Sexo, persona.Correo, persona.Telefono, persona.CI,
	).Scan(&personaID)
	if err != nil {
		return fmt.Errorf("error creating persona: %w", err)
	}

	_, err = tx.Exec(ctx,
		`INSERT INTO users (persona_id, email, password_hash, role) VALUES ($1, $2, $3, $4)`,
		personaID, user.Email, passwordHash, user.Role,
	)
	if err != nil {
		return fmt.Errorf("error creating user: %w", err)
	}

	return tx.Commit(ctx)
}

func (r *AuthRepository) GetByEmail(ctx context.Context, email string) (*models.UserWithPersona, error) {
	up := &models.UserWithPersona{}
	err := r.pool.QueryRow(ctx,
		`SELECT u.id, u.persona_id, u.email, u.password_hash, u.role, u.created_at, u.updated_at,
		        p.id, p.nombre, p.primer_apellido, p.segundo_apellido, p.sexo, p.correo, p.telefono, p.nacimiento, p.ci, p.ciudad_id, p.created_at
		 FROM users u
		 LEFT JOIN persona p ON p.id = u.persona_id
		 WHERE u.email = $1`, email,
	).Scan(
		&up.User.ID, &up.User.PersonaID, &up.User.Email, &up.User.PasswordHash, &up.User.Role, &up.User.CreatedAt, &up.User.UpdatedAt,
		&up.Persona.ID, &up.Persona.Nombre, &up.Persona.PrimerApellido, &up.Persona.SegundoApellido, &up.Persona.Sexo, &up.Persona.Correo, &up.Persona.Telefono, &up.Persona.Nacimiento, &up.Persona.CI, &up.Persona.CiudadID, &up.Persona.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}
	return up, nil
}

func (r *AuthRepository) GetByID(ctx context.Context, id string) (*models.UserWithPersona, error) {
	up := &models.UserWithPersona{}
	err := r.pool.QueryRow(ctx,
		`SELECT u.id, u.persona_id, u.email, u.password_hash, u.role, u.created_at, u.updated_at,
		        p.id, p.nombre, p.primer_apellido, p.segundo_apellido, p.sexo, p.correo, p.telefono, p.nacimiento, p.ci, p.ciudad_id, p.created_at
		 FROM users u
		 LEFT JOIN persona p ON p.id = u.persona_id
		 WHERE u.id = $1`, id,
	).Scan(
		&up.User.ID, &up.User.PersonaID, &up.User.Email, &up.User.PasswordHash, &up.User.Role, &up.User.CreatedAt, &up.User.UpdatedAt,
		&up.Persona.ID, &up.Persona.Nombre, &up.Persona.PrimerApellido, &up.Persona.SegundoApellido, &up.Persona.Sexo, &up.Persona.Correo, &up.Persona.Telefono, &up.Persona.Nacimiento, &up.Persona.CI, &up.Persona.CiudadID, &up.Persona.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}
	return up, nil
}
