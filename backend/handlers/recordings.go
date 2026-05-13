package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gugalski/browser-voice-recording/models"
	"github.com/gugalski/browser-voice-recording/services"

	"crypto/rand"
	"encoding/hex"
)

type RecordingsHandler struct {
	storage     *services.Storage
	maxUploadMB int64
}

func NewRecordingsHandler(storage *services.Storage, maxUploadMB int64) *RecordingsHandler {
	return &RecordingsHandler{storage: storage, maxUploadMB: maxUploadMB}
}

func (h *RecordingsHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /recordings", h.create)
	mux.HandleFunc("GET /recordings", h.list)
	mux.HandleFunc("GET /recordings/{id}", h.get)
	mux.HandleFunc("DELETE /recordings/{id}", h.delete)
}

func (h *RecordingsHandler) create(w http.ResponseWriter, r *http.Request) {
	maxBytes := h.maxUploadMB << 20
	r.Body = http.MaxBytesReader(w, r.Body, maxBytes)
	if err := r.ParseMultipartForm(maxBytes); err != nil {
		if strings.Contains(err.Error(), "too large") {
			http.Error(w, "file too large", http.StatusRequestEntityTooLarge)
			return
		}
		http.Error(w, "invalid form", http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "missing file field", http.StatusBadRequest)
		return
	}
	defer file.Close()

	ct := header.Header.Get("Content-Type")
	if ct == "" {
		ct = "audio/webm"
	}
	if !strings.HasPrefix(ct, "audio/webm") && !strings.HasPrefix(ct, "video/webm") {
		http.Error(w, "expected audio/webm", http.StatusBadRequest)
		return
	}

	id := newID()
	sessionID := r.FormValue("session_id")

	tmp, err := os.CreateTemp("", "rec-*.webm")
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	defer os.Remove(tmp.Name())

	if _, err := io.Copy(tmp, file); err != nil {
		tmp.Close()
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	tmp.Close()

	wavPath := h.storage.WAVPath(id)
	if err := services.ConvertToWAV(tmp.Name(), wavPath); err != nil {
		fmt.Printf("conversion error: %v\n", err)
		http.Error(w, "conversion failed", http.StatusInternalServerError)
		return
	}

	info, err := os.Stat(wavPath)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	rec := &models.Recording{
		ID:        id,
		Filename:  id + ".wav",
		SizeBytes: info.Size(),
		SessionID: sessionID,
		CreatedAt: time.Now().UTC(),
	}
	if err := h.storage.SaveMeta(rec); err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(rec)
}

func (h *RecordingsHandler) list(w http.ResponseWriter, r *http.Request) {
	recs, err := h.storage.List()
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if recs == nil {
		recs = []*models.Recording{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(recs)
}

func (h *RecordingsHandler) get(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	wavPath := h.storage.WAVPath(id)
	f, err := os.Open(wavPath)
	if err != nil {
		if os.IsNotExist(err) {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	defer f.Close()
	w.Header().Set("Content-Type", "audio/wav")
	http.ServeContent(w, r, id+".wav", time.Time{}, f)
}

func (h *RecordingsHandler) delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if _, err := h.storage.Get(id); err != nil {
		if os.IsNotExist(err) {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if err := h.storage.Delete(id); err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func newID() string {
	b := make([]byte, 4)
	rand.Read(b)
	return hex.EncodeToString(b)
}
