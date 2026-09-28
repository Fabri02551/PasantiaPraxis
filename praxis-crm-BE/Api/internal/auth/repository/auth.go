package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/auth/models"
)

// userWithPersonaCols usa COALESCE en las columnas que el modelo Persona
// declara como string (correo, telefono, ci) porque en la tabla son VARCHAR
// NULL y pgx no puede escanear NULL en un *string: sin esto, el login y el
// perfil fallan con "cannot scan NULL into *string".
// segundo_apellido, nacimiento y ciudad_id son punteros, se leen tal cual.
const userWithPersonaCols = `u.id, u.persona_id, u.email, u.password_hash, u.role, u.created_at, u.updated_at,
	p.id, p.nombre, p.primer_apellido, p.segundo_apellido, p.sexo, COALESCE(p.correo, ''), COALESCE(p.telefono, ''),
	p.nacimiento, COALESCE(p.ci, ''), p.ciudad_id, COALESCE(p.created_at, u.created_at)`

func scanUserWithPersona(row pgx.Row) (*models.UserWithPersona, error) {
	up := &models.UserWithPersona{}
	err := row.Scan(
		&up.User.ID, &up.User.PersonaID, &up.User.Email, &up.User.PasswordHash, &up.User.Role, &up.User.CreatedAt, &up.User.UpdatedAt,
		&up.Persona.ID, &up.Persona.Nombre, &up.Persona.PrimerApellido, &up.Persona.SegundoApellido, &up.Persona.Sexo,
		&up.Persona.Correo, &up.Persona.Telefono, &up.Persona.Nacimiento, &up.Persona.CI, &up.Persona.CiudadID, &up.Persona.CreatedAt,
	)
	return up, err
}

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
	up, err := scanUserWithPersona(r.pool.QueryRow(ctx,
		`SELECT `+userWithPersonaCols+`
		 FROM users u
		 LEFT JOIN persona p ON p.id = u.persona_id
		 WHERE u.email = $1`, email,
	))
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}
	return up, nil
}

func (r *AuthRepository) GetByID(ctx context.Context, id string) (*models.UserWithPersona, error) {
	up, err := scanUserWithPersona(r.pool.QueryRow(ctx,
		`SELECT `+userWithPersonaCols+`
		 FROM users u
		 LEFT JOIN persona p ON p.id = u.persona_id
		 WHERE u.id = $1`, id,
	))
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}
	return up, nil
}

// GetByPersonaID busca por el persona_id que viaja en el JWT (middleware
// UserPersonaID). El token no lleva el UUID del usuario, así que el perfil
// se resuelve por esta columna en vez de por GetByID.
func (r *AuthRepository) GetByPersonaID(ctx context.Context, personaID int) (*models.UserWithPersona, error) {
	up, err := scanUserWithPersona(r.pool.QueryRow(ctx,
		`SELECT `+userWithPersonaCols+`
		 FROM users u
		 JOIN persona p ON p.id = u.persona_id
		 WHERE u.persona_id = $1`, personaID,
	))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("user not found: %w", err)
	}
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}
	return up, nil
}

// UpdatePersona actualiza los datos editables de la persona del usuario
// autenticado. NO toca users.email (credencial de login) ni nombre, primer
// y segundo apellido, que son parte de la identidad. Devuelve la persona
// actualizada ya combinada con el usuario.
func (r *AuthRepository) UpdatePersona(ctx context.Context, personaID int, req models.UpdateProfileRequest) (*models.UserWithPersona, error) {
	_, err := r.pool.Exec(ctx,
		`UPDATE persona
		 SET nombre = $1, primer_apellido = $2, segundo_apellido = $3, sexo = $4,
		     telefono = NULLIF($5, ''), nacimiento = $6, ci = NULLIF($7, ''), status = true
		 WHERE id = $8`,
		req.Nombre, req.PrimerApellido, req.SegundoApellido, req.Sexo,
		req.Telefono, req.Nacimiento, req.CI, personaID,
	)
	if err != nil {
		return nil, fmt.Errorf("error updating persona: %w", err)
	}
	return r.GetByPersonaID(ctx, personaID)
}
