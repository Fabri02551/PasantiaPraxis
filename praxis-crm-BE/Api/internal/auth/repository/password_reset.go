package repository

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/auth/models"
)

type PasswordResetRepository struct {
	pool *pgxpool.Pool
}

func NewPasswordResetRepository(pool *pgxpool.Pool) *PasswordResetRepository {
	return &PasswordResetRepository{pool: pool}
}

func (r *PasswordResetRepository) CreateToken(ctx context.Context, email string) (*models.PasswordResetToken, error) {
	token, err := generateToken()
	if err != nil {
		return nil, err
	}
	exp := time.Now().Add(30 * time.Minute)
	var id int
	err = r.pool.QueryRow(ctx,
		`INSERT INTO password_reset_tokens (email, token, expires_at) VALUES ($1, $2, $3) RETURNING id`,
		email, token, exp,
	).Scan(&id)
	if err != nil {
		return nil, fmt.Errorf("error creating token: %w", err)
	}
	return &models.PasswordResetToken{ID: id, Email: email, Token: token, ExpiresAt: exp}, nil
}

func (r *PasswordResetRepository) GetValidToken(ctx context.Context, token string) (*models.PasswordResetToken, error) {
	var t models.PasswordResetToken
	err := r.pool.QueryRow(ctx,
		`SELECT id, email, token, expires_at, used, created_at FROM password_reset_tokens WHERE token=$1`,
		token,
	).Scan(&t.ID, &t.Email, &t.Token, &t.ExpiresAt, &t.Used, &t.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("token inválido")
		}
		return nil, err
	}
	if t.Used {
		return nil, errors.New("token ya utilizado")
	}
	if time.Now().After(t.ExpiresAt) {
		return nil, errors.New("token expirado")
	}
	return &t, nil
}

func (r *PasswordResetRepository) MarkUsed(ctx context.Context, token string) error {
	_, err := r.pool.Exec(ctx, `UPDATE password_reset_tokens SET used=true WHERE token=$1`, token)
	return err
}

func generateToken() (string, error) {
	b := make([]byte, 32)
	_, err := rand.Read(b)
	if err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
