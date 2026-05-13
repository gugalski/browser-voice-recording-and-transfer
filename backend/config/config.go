package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port          string
	RecordingsDir string
	MaxUploadMB   int64
	AllowedOrigin string
}

func Load() *Config {
	maxMB := int64(50)
	if v := os.Getenv("MAX_UPLOAD_MB"); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			maxMB = n
		}
	}
	port := os.Getenv("PORT")
	if port == "" {
		port = "8000"
	}
	dir := os.Getenv("RECORDINGS_DIR")
	if dir == "" {
		dir = "/data/recordings"
	}
	origin := os.Getenv("ALLOWED_ORIGIN")
	if origin == "" {
		origin = "http://localhost:3000"
	}
	return &Config{
		Port:          port,
		RecordingsDir: dir,
		MaxUploadMB:   maxMB,
		AllowedOrigin: origin,
	}
}
