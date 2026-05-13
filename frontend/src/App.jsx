import { useState, useEffect } from 'react'
import Recorder from './Recorder'
import RecordingList from './RecordingList'

const API = 'http://localhost:8000'

export default function App() {
  const [recordings, setRecordings] = useState([])

  const load = async () => {
    try {
      const res = await fetch(`${API}/recordings`)
      const data = await res.json()
      setRecordings(data.sort((a, b) => b.created_at.localeCompare(a.created_at)))
    } catch (_) {}
  }

  useEffect(() => { load() }, [])

  return (
    <div className="container">
      <h1>Voice Recorder</h1>
      <Recorder api={API} onUploaded={load} />
      <RecordingList api={API} recordings={recordings} onDeleted={load} />
    </div>
  )
}
