import { formatBytes, formatDate } from './utils'

export default function RecordingList({ api, recordings, onDeleted }) {
  const del = async id => {
    await fetch(`${api}/recordings/${id}`, { method: 'DELETE' })
    onDeleted()
  }

  if (!recordings.length) return null

  return (
    <div className="recordings">
      <h2>Saved recordings</h2>
      <ul>
        {recordings.map(rec => (
          <li key={rec.id}>
            <audio controls src={`${api}/recordings/${rec.id}`} />
            <span className="meta">
              {formatBytes(rec.size_bytes)}<br />{formatDate(rec.created_at)}
            </span>
            <button className="btn-del" onClick={() => del(rec.id)}>✕</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
