# Browser Voice Recording and Transfer

Record audio in the browser via the **MediaRecorder API**, POST the raw `webm/opus` blob to a **Go backend**, convert it to `wav` server-side, and persist it on disk.

## Features

- Real-time waveform visualisation on `<canvas>`
- Upload progress bar
- Playback list with delete support
- Server-side conversion to **16 kHz mono WAV** (ready for ML inference)
- One-command Docker setup

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JS + Web Audio API |
| Backend | Go 1.22 + `net/http` stdlib |
| Audio conversion | `ffmpeg` via `os/exec` |
| Storage | Local filesystem (Docker volume) |
| Containers | Docker + Compose |

## Quick start

```bash
cp .env.example .env
docker compose up --build
```

- Frontend: http://localhost:3000  
- Backend API: http://localhost:8000

## Local development (without Docker)

Requires Go 1.22+ and `ffmpeg` installed locally.

```bash
# backend
cd backend && go run main.go

# frontend
cd frontend && python -m http.server 3000
```

## API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/recordings` | Upload `audio/webm`, returns JSON metadata |
| `GET` | `/recordings` | List all recordings |
| `GET` | `/recordings/{id}` | Stream WAV file |
| `DELETE` | `/recordings/{id}` | Remove recording |
| `GET` | `/health` | Health check |

### POST /recordings

`multipart/form-data` fields:

| Field | Type | Required |
|-------|------|----------|
| `file` | `audio/webm` | yes |
| `session_id` | string | no |

Response `201`:
```json
{
  "id": "a3f2c1d4",
  "filename": "a3f2c1d4.wav",
  "duration_s": 8.3,
  "size_bytes": 132480,
  "session_id": "sess_007",
  "created_at": "2025-05-13T14:22:01Z"
}
```

## Configuration

Environment variables (see `.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8000` | Backend listen port |
| `RECORDINGS_DIR` | `/data/recordings` | Storage directory |
| `MAX_UPLOAD_MB` | `50` | Upload size limit |
| `ALLOWED_ORIGIN` | `http://localhost:3000` | CORS allowed origin |

## Project structure

```
.
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── main.go
│   ├── config/config.go
│   ├── handlers/recordings.go
│   ├── models/recording.go
│   └── services/
│       ├── converter.go
│       └── storage.go
└── frontend/
    ├── index.html
    ├── style.css
    └── recorder.js
```
