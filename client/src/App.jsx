import { useEffect, useState } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export default function App() {
  const [status, setStatus] = useState('checking...')
  useEffect(() => {
    fetch(`${API}/api/health`)
      .then((r) => r.json())
      .then((d) => setStatus(d.status))
      .catch(() => setStatus('cannot reach server'))
  }, [])
  return <h1 className="p-8 text-2xl font-bold">Mini Ajintara: server says {status}</h1>
}