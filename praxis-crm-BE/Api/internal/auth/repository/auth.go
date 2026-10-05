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
	p.nacimiento, COALESCE(p.ci, ''), p.ciudad_id, COALESCE(p.status, true), COALESCE(p.created_at, u.created_at)`

func scanUserWithPersona(row pgx.Row) (*models.UserWithPersona, error) {
	up := &models.UserWithPersona{}
	err := row.Scan(
		&up.User.ID, &up.User.PersonaID, &up.User.Email, &up.User.PasswordHash, &up.User.Role, &up.User.CreatedAt, &up.User.UpdatedAt,
		&up.Persona.ID, &up.Persona.Nombre, &up.Persona.PrimerApellido, &up.Persona.SegundoApellido, &up.Persona.Sexo,
		&up.Persona.Correo, &up.Persona.Telefono, &up.Persona.Nacimiento, &up.Persona.CI, &up.Persona.CiudadID, &up.Persona.Status, &up.Persona.CreatedAt,
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

// UpdatePasswordHash reemplaza el hash de la contraseña del usuario del
// persona_id dado. Se busca por persona_id y no por el UUID del usuario
// porque el JWT solo lleva el persona_id.
func (r *AuthRepository) UpdatePasswordHash(ctx context.Context, personaID int, passwordHash string) error {
	tag, err := r.pool.Exec(ctx,
		`UPDATE users SET password_hash = $1, updated_at = now() WHERE persona_id = $2`,
		passwordHash, personaID,
	)
	if err != nil {
		return fmt.Errorf("error updating password: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return errors.New("user not found")
	}
	return nil
}

// ============================================================
// CRUD de administradores (persona <-> users en transacción)
// Eliminación lógica: persona.status true(1) -> false(0).
// ============================================================

// ListAdmins devuelve todos los usuarios con rol admin y su persona.
func (r *AuthRepository) ListAdmins(ctx context.Context) ([]models.UserWithPersona, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT `+userWithPersonaCols+`
		 FROM users u
		 JOIN persona p ON p.id = u.persona_id
		 WHERE u.role = 'admin'
		 ORDER BY p.status DESC, p.nombre, p.primer_apellido`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	admins := []models.UserWithPersona{}
	for rows.Next() {
		up, err := scanUserWithPersona(rows)
		if err != nil {
			return nil, err
		}
		admins = append(admins, *up)
	}
	return admins, nil
}

// GetAdminByPersonaID busca un administrador por su persona_id.
func (r *AuthRepository) GetAdminByPersonaID(ctx context.Context, personaID int) (*models.UserWithPersona, error) {
	up, err := scanUserWithPersona(r.pool.QueryRow(ctx,
		`SELECT `+userWithPersonaCols+`
		 FROM users u
		 JOIN persona p ON p.id = u.persona_id
		 WHERE u.persona_id = $1 AND u.role = 'admin'`, personaID,
	))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("administrador no encontrado")
	}
	if err != nil {
		return nil, fmt.Errorf("administrador no encontrado: %w", err)
	}
	return up, nil
}

// CreateAdmin inserta persona + users (rol admin) en UNA transacción.
func (r *AuthRepository) CreateAdmin(ctx context.Context, email, passwordHash string, persona *models.Persona) (int, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("error starting transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	var personaID int
	err = tx.QueryRow(ctx,
		`INSERT INTO persona (nombre, primer_apellido, segundo_apellido, sexo, correo, telefono, nacimiento, ci, ciudad_id, status)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true) RETURNING id`,
		persona.Nombre, persona.PrimerApellido, persona.SegundoApellido, persona.Sexo,
		persona.Correo, persona.Telefono, persona.Nacimiento, persona.CI, persona.CiudadID,
	).Scan(&personaID)
	if err != nil {
		return 0, fmt.Errorf("error creating persona: %w", err)
	}

	_, err = tx.Exec(ctx,
		`INSERT INTO users (persona_id, email, password_hash, role) VALUES ($1, $2, $3, 'admin')`,
		personaID, email, passwordHash,
	)
	if err != nil {
		return 0, fmt.Errorf("error creating user: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return personaID, nil
}

// UpdateAdmin actualiza persona + credencial (email/password) en UNA
// transacción. Si passwordHash es "", no toca la contraseña.
// Si status es nil, no toca persona.status.
func (r *AuthRepository) UpdateAdmin(ctx context.Context, personaID int, req models.UpdateAdminRequest, passwordHash string) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("error starting transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx,
		`UPDATE persona SET
			nombre = $1, primer_apellido = $2, segundo_apellido = $3, sexo = $4,
			correo = NULLIF($5, ''), telefono = NULLIF($6, ''),
			nacimiento = $7, ci = NULLIF($8, ''), ciudad_id = $9,
			status = COALESCE($10, status)
		 WHERE id = $11`,
		req.Nombre, req.PrimerApellido, req.SegundoApellido, req.Sexo,
		req.Correo, req.Telefono, req.Nacimiento, req.CI, req.CiudadID,
		req.Status, personaID,
	)
	if err != nil {
		return fmt.Errorf("error updating persona: %w", err)
	}

	if req.Email != "" {
		_, err = tx.Exec(ctx,
			`UPDATE users SET email = $1, updated_at = NOW() WHERE persona_id = $2`,
			req.Email, personaID,
		)
		if err != nil {
			return fmt.Errorf("error updating user email: %w", err)
		}
	}

	if passwordHash != "" {
		_, err = tx.Exec(ctx,
			`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE persona_id = $2`,
			passwordHash, personaID,
		)
		if err != nil {
			return fmt.Errorf("error updating password: %w", err)
		}
	}

	return tx.Commit(ctx)
}

// SetAdminStatus hace la eliminación lógica (false) o reactivación (true):
// persona.status 1 -> 0. No borra filas para no romper auditoría.
func (r *AuthRepository) SetAdminStatus(ctx context.Context, personaID int, status bool) error {
	tag, err := r.pool.Exec(ctx,
		`UPDATE persona SET status = $1 WHERE id = $2
		 AND EXISTS (SELECT 1 FROM users u WHERE u.persona_id = persona.id AND u.role = 'admin')`,
		status, personaID,
	)
	if err != nil {
		return fmt.Errorf("error updating status: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("administrador no encontrado")
	}
	return nil
}
