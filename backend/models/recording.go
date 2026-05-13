package models

import "time"

type Recording struct {
	ID         string    `json:"id"`
	Filename   string    `json:"filename"`
	DurationS  float64   `json:"duration_s"`
	SizeBytes  int64     `json:"size_bytes"`
	SessionID  string    `json:"session_id,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
}
