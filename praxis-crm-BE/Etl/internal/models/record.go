package models

import "time"

// Record es el registro genérico que viaja por el pipeline ETL.
type Record struct {
	ID        string            `json:"id"`
	Entity    string            `json:"entity"`
	Data      map[string]string `json:"data"`
	Timestamp time.Time         `json:"timestamp"`
}
