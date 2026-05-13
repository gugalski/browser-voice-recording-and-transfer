package services

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/gugalski/browser-voice-recording/models"
)

type Storage struct {
	Dir string
}

func NewStorage(dir string) (*Storage, error) {
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("create recordings dir: %w", err)
	}
	return &Storage{Dir: dir}, nil
}

func (s *Storage) SaveMeta(r *models.Recording) error {
	data, err := json.Marshal(r)
	if err != nil {
		return err
	}
	return os.WriteFile(s.metaPath(r.ID), data, 0644)
}

func (s *Storage) WAVPath(id string) string {
	return filepath.Join(s.Dir, id+".wav")
}

func (s *Storage) metaPath(id string) string {
	return filepath.Join(s.Dir, id+".json")
}

func (s *Storage) List() ([]*models.Recording, error) {
	entries, err := os.ReadDir(s.Dir)
	if err != nil {
		return nil, err
	}
	var list []*models.Recording
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
			continue
		}
		id := strings.TrimSuffix(e.Name(), ".json")
		r, err := s.Get(id)
		if err != nil {
			continue
		}
		list = append(list, r)
	}
	return list, nil
}

func (s *Storage) Get(id string) (*models.Recording, error) {
	data, err := os.ReadFile(s.metaPath(id))
	if err != nil {
		return nil, err
	}
	var r models.Recording
	if err := json.Unmarshal(data, &r); err != nil {
		return nil, err
	}
	return &r, nil
}

func (s *Storage) Delete(id string) error {
	wavErr := os.Remove(s.WAVPath(id))
	metaErr := os.Remove(s.metaPath(id))
	if wavErr != nil && !os.IsNotExist(wavErr) {
		return wavErr
	}
	if metaErr != nil && !os.IsNotExist(metaErr) {
		return metaErr
	}
	return nil
}
