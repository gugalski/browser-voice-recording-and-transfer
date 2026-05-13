package services

import (
	"bytes"
	"fmt"
	"os/exec"
)

func ConvertToWAV(inputPath, outputPath string) error {
	var stderr bytes.Buffer
	cmd := exec.Command("ffmpeg",
		"-i", inputPath,
		"-ar", "16000",
		"-ac", "1",
		"-y",
		outputPath,
	)
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("ffmpeg: %w — %s", err, stderr.String())
	}
	return nil
}
