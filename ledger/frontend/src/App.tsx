import { useState } from 'react'

function App() {
  const [ready] = useState(true)
  return ready ? <main className="app-root">Ledger</main> : null
}

export default App
