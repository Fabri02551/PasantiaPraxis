package pipeline

import (
	"context"
	"fmt"
	"log"

	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/config"
	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/extractor"
	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/loader"
	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/transformer"
)

type Pipeline struct {
	cfg         config.Config
	extractor   extractor.Extractor
	transformer transformer.Transformer
	loader      loader.Loader
}

func New(cfg config.Config) Pipeline {
	return Pipeline{
		cfg:         cfg,
		extractor:   extractor.New(),
		transformer: transformer.New(),
		loader:      loader.New(),
	}
}

func (p Pipeline) Run(ctx context.Context) error {
	raw, err := p.extractor.Extract(ctx)
	if err != nil {
		return fmt.Errorf("extracción: %w", err)
	}
	log.Printf("extraídos %d registros", len(raw))

	clean := p.transformer.Transform(raw)
	log.Printf("transformados %d registros", len(clean))

	if err := p.loader.Load(ctx, clean); err != nil {
		return fmt.Errorf("carga: %w", err)
	}
	log.Printf("cargados %d registros", len(clean))

	return nil
}
