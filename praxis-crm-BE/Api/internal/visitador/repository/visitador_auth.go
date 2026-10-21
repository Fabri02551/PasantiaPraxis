package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

type VisitadorAuthRepository struct {
	pool *pgxpool.Pool
}

func NewVisitadorAuthRepository(pool *pgxpool.Pool) *VisitadorAuthRepository {
	return &VisitadorAuthRepository{pool: pool}
}

func (r *VisitadorAuthRepository) CreateUser(ctx context.Context, personaID int, email, passwordHash string) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO users (persona_id, email, password_hash, role) VALUES ($1, $2, $3, 'visitador') ON CONFLICT DO NOTHING`,
		personaID, email, passwordHash,
	)
	if err != nil {
		return fmt.Errorf("error creating user: %w", err)
	}
	return nil
}

func (r *VisitadorAuthRepository) UserExists(ctx context.Context, email string) bool {
	var id int
	err := r.pool.QueryRow(ctx, `SELECT id FROM users WHERE email=$1`, email).Scan(&id)
	return err == nil
}
