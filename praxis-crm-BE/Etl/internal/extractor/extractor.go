package extractor

import (
	"context"

	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/models"
)

type Extractor interface {
	Extract(ctx context.Context) ([]models.Record, error)
}

type extractorImpl struct{}

func New() Extractor { return extractorImpl{} }

func (extractorImpl) Extract(_ context.Context) ([]models.Record, error) {
	return []models.Record{}, nil
}
