package main

import (
	"fmt"
	"net/http"

	"github.com/gugalski/browser-voice-recording/config"
	"github.com/gugalski/browser-voice-recording/handlers"
	"github.com/gugalski/browser-voice-recording/services"
)

func main() {
	cfg := config.Load()

	storage, err := services.NewStorage(cfg.RecordingsDir)
	if err != nil {
		panic(fmt.Sprintf("storage init: %v", err))
	}

	mux := http.NewServeMux()

	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})

	rh := handlers.NewRecordingsHandler(storage, cfg.MaxUploadMB)
	rh.RegisterRoutes(mux)

	handler := corsMiddleware(cfg.AllowedOrigin, mux)

	addr := ":" + cfg.Port
	fmt.Printf("listening on %s\n", addr)
	if err := http.ListenAndServe(addr, handler); err != nil {
		panic(err)
	}
}

func corsMiddleware(origin string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
