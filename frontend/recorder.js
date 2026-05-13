const API = 'http://localhost:8000';

const btnStart   = document.getElementById('btnStart');
const btnStop    = document.getElementById('btnStop');
const btnUpload  = document.getElementById('btnUpload');
const btnDiscard = document.getElementById('btnDiscard');
const statusEl   = document.getElementById('status');
const timerEl    = document.getElementById('timer');
const canvas     = document.getElementById('waveform');
const playback   = document.getElementById('playback');
const player     = document.getElementById('player');
const progress   = document.getElementById('progress');
const progressBar = document.getElementById('progressBar');
const recordingList = document.getElementById('recordingList');

const ctx = canvas.getContext('2d');

let mediaRecorder = null;
let chunks = [];
let blob = null;
let audioCtx = null;
let analyser = null;
let animFrame = null;
let timerInterval = null;
let elapsed = 0;

// ── Waveform ─────────────────────────────────────────────────────────────────

function drawWaveform() {
  const W = canvas.width, H = canvas.height;
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteTimeDomainData(data);

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, W, H);

  ctx.lineWidth = 2;
  ctx.strokeStyle = '#3b82f6';
  ctx.beginPath();

  const step = W / data.length;
  for (let i = 0; i < data.length; i++) {
    const y = (data[i] / 128) * (H / 2);
    i === 0 ? ctx.moveTo(0, y) : ctx.lineTo(i * step, y);
  }
  ctx.stroke();
  animFrame = requestAnimationFrame(drawWaveform);
}

function clearWaveform() {
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// ── Timer ─────────────────────────────────────────────────────────────────────

function startTimer() {
  elapsed = 0;
  timerEl.textContent = '00:00';
  timerInterval = setInterval(() => {
    elapsed++;
    const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const s = String(elapsed % 60).padStart(2, '0');
    timerEl.textContent = `${m}:${s}`;
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
}

// ── Recording ─────────────────────────────────────────────────────────────────

btnStart.addEventListener('click', async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);

    mediaRecorder = new MediaRecorder(stream);
    chunks = [];
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    mediaRecorder.onstop = () => {
      blob = new Blob(chunks, { type: 'audio/webm' });
      player.src = URL.createObjectURL(blob);
      playback.classList.remove('hidden');
    };

    mediaRecorder.start();
    startTimer();
    drawWaveform();

    btnStart.disabled = true;
    btnStop.disabled  = false;
    setStatus('Recording…');
  } catch (err) {
    setStatus(`Mic error: ${err.message}`);
  }
});

btnStop.addEventListener('click', () => {
  mediaRecorder.stop();
  mediaRecorder.stream.getTracks().forEach(t => t.stop());
  cancelAnimationFrame(animFrame);
  stopTimer();
  audioCtx.close();

  btnStop.disabled  = true;
  btnStart.disabled = false;
  clearWaveform();
  setStatus('Recording stopped. Upload or discard.');
});

// ── Upload ────────────────────────────────────────────────────────────────────

btnUpload.addEventListener('click', async () => {
  if (!blob) return;

  const fd = new FormData();
  fd.append('file', blob, 'recording.webm');

  progress.classList.remove('hidden');
  progressBar.style.width = '0%';
  btnUpload.disabled = true;
  setStatus('Uploading…');

  try {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API}/recordings`);

    xhr.upload.onprogress = e => {
      if (e.lengthComputable) {
        progressBar.style.width = `${(e.loaded / e.total) * 100}%`;
      }
    };

    await new Promise((resolve, reject) => {
      xhr.onload = () => {
        if (xhr.status === 201) resolve(JSON.parse(xhr.responseText));
        else reject(new Error(`Server responded ${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(fd);
    }).then(rec => {
      progressBar.style.width = '100%';
      player.src = `${API}/recordings/${rec.id}`;
      setStatus(`Saved: ${rec.filename} (${formatBytes(rec.size_bytes)})`);
      loadRecordings();
    });
  } catch (err) {
    setStatus(`Upload failed: ${err.message}`);
  } finally {
    btnUpload.disabled = false;
  }
});

btnDiscard.addEventListener('click', () => {
  blob = null;
  player.src = '';
  playback.classList.add('hidden');
  progress.classList.add('hidden');
  progressBar.style.width = '0%';
  clearWaveform();
  timerEl.textContent = '00:00';
  setStatus('Discarded.');
});

// ── Recordings list ───────────────────────────────────────────────────────────

async function loadRecordings() {
  try {
    const res = await fetch(`${API}/recordings`);
    const list = await res.json();
    recordingList.innerHTML = '';
    for (const rec of list.sort((a, b) => b.created_at.localeCompare(a.created_at))) {
      const li = document.createElement('li');
      li.innerHTML = `
        <audio controls src="${API}/recordings/${rec.id}"></audio>
        <span class="meta">${formatBytes(rec.size_bytes)}<br>${formatDate(rec.created_at)}</span>
        <button class="del" data-id="${rec.id}">✕</button>
      `;
      li.querySelector('.del').addEventListener('click', () => deleteRecording(rec.id));
      recordingList.appendChild(li);
    }
  } catch (_) {}
}

async function deleteRecording(id) {
  await fetch(`${API}/recordings/${id}`, { method: 'DELETE' });
  loadRecordings();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function setStatus(msg) { statusEl.textContent = msg; }

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleString();
}

// ── Init ──────────────────────────────────────────────────────────────────────
clearWaveform();
loadRecordings();
