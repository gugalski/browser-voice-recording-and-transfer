import { useState, useRef, useEffect, useCallback } from 'react'
import { formatBytes } from './utils'

const S = { IDLE: 'idle', RECORDING: 'recording', STOPPED: 'stopped' }

export default function Recorder({ api, onUploaded }) {
  const [state, setState] = useState(S.IDLE)
  const [status, setStatus] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [uploadProgress, setUploadProgress] = useState(0)

  const canvasRef  = useRef(null)
  const playerRef  = useRef(null)
  const recRef     = useRef(null)
  const chunksRef  = useRef([])
  const blobRef    = useRef(null)
  const audioCtx   = useRef(null)
  const analyser   = useRef(null)
  const animFrame  = useRef(null)
  const timerRef   = useRef(null)

  const clearCanvas = useCallback(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#1e293b'
    ctx.fillRect(0, 0, c.width, c.height)
  }, [])

  useEffect(() => { clearCanvas() }, [clearCanvas])

  const drawWaveform = useCallback(() => {
    const c = canvasRef.current
    if (!c || !analyser.current) return
    const ctx = c.getContext('2d')
    const W = c.width, H = c.height
    const data = new Uint8Array(analyser.current.frequencyBinCount)
    analyser.current.getByteTimeDomainData(data)
    ctx.fillStyle = '#1e293b'
    ctx.fillRect(0, 0, W, H)
    ctx.lineWidth = 2
    ctx.strokeStyle = '#3b82f6'
    ctx.beginPath()
    const step = W / data.length
    data.forEach((v, i) => {
      const y = (v / 128) * (H / 2)
      i === 0 ? ctx.moveTo(0, y) : ctx.lineTo(i * step, y)
    })
    ctx.stroke()
    animFrame.current = requestAnimationFrame(drawWaveform)
  }, [])

  const fmt = s =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioCtx.current = new AudioContext()
      const src = audioCtx.current.createMediaStreamSource(stream)
      analyser.current = audioCtx.current.createAnalyser()
      analyser.current.fftSize = 2048
      src.connect(analyser.current)

      recRef.current = new MediaRecorder(stream)
      chunksRef.current = []
      recRef.current.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recRef.current.onstop = () => {
        blobRef.current = new Blob(chunksRef.current, { type: 'audio/webm' })
        if (playerRef.current) playerRef.current.src = URL.createObjectURL(blobRef.current)
      }

      recRef.current.start()
      setElapsed(0)
      setState(S.RECORDING)
      setStatus('Recording…')
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
      drawWaveform()
    } catch (err) {
      setStatus(`Mic error: ${err.message}`)
    }
  }

  const stop = () => {
    recRef.current.stop()
    recRef.current.stream.getTracks().forEach(t => t.stop())
    cancelAnimationFrame(animFrame.current)
    clearInterval(timerRef.current)
    audioCtx.current.close()
    clearCanvas()
    setState(S.STOPPED)
    setStatus('Recording stopped. Upload or discard.')
  }

  const upload = async () => {
    if (!blobRef.current) return
    const fd = new FormData()
    fd.append('file', blobRef.current, 'recording.webm')
    setUploadProgress(0)
    setStatus('Uploading…')

    try {
      const rec = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', `${api}/recordings`)
        xhr.upload.onprogress = e => {
          if (e.lengthComputable) setUploadProgress((e.loaded / e.total) * 100)
        }
        xhr.onload = () =>
          xhr.status === 201 ? resolve(JSON.parse(xhr.responseText)) : reject(new Error(`${xhr.status}`))
        xhr.onerror = () => reject(new Error('Network error'))
        xhr.send(fd)
      })

      setUploadProgress(100)
      setStatus(`Saved: ${rec.filename} (${formatBytes(rec.size_bytes)})`)
      onUploaded()
      blobRef.current = null
      setState(S.IDLE)
      setElapsed(0)
    } catch (err) {
      setStatus(`Upload failed: ${err.message}`)
    }
  }

  const discard = () => {
    blobRef.current = null
    if (playerRef.current) playerRef.current.src = ''
    setState(S.IDLE)
    setStatus('Discarded.')
    clearCanvas()
    setElapsed(0)
    setUploadProgress(0)
  }

  return (
    <div className="recorder">
      <div className="status">{status}</div>

      <canvas ref={canvasRef} className="waveform" width={600} height={100} />

      <div className="timer">{fmt(elapsed)}</div>

      <div className="controls">
        <button onClick={start} disabled={state !== S.IDLE}>
          Start recording
        </button>
        <button onClick={stop} disabled={state !== S.RECORDING} className="btn-stop">
          Stop
        </button>
      </div>

      {state === S.STOPPED && (
        <div className="playback">
          <audio ref={playerRef} controls />
          <div className="playback-controls">
            <button onClick={upload} className="btn-upload">Upload</button>
            <button onClick={discard} className="btn-discard">Discard</button>
          </div>
          {uploadProgress > 0 && (
            <div className="progress">
              <div className="progress-bar" style={{ width: `${uploadProgress}%` }} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
