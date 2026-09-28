package transformer

import "gitlab.com/labpraxis/praxis-crm-be/etl/internal/models"

type Transformer interface {
	Transform([]models.Record) []models.Record
}

type transformerImpl struct{}

func New() Transformer { return transformerImpl{} }

func (transformerImpl) Transform(in []models.Record) []models.Record {
	return in
}
