package loader

import (
	"context"

	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/models"
)

type Loader interface {
	Load(ctx context.Context, records []models.Record) error
}

type loaderImpl struct{}

func New() Loader { return loaderImpl{} }

func (loaderImpl) Load(_ context.Context, _ []models.Record) error {
	return nil
}
