import { useMemo, useState } from 'react'
import './App.css'

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

function getApi() {
  return typeof window !== 'undefined' ? window.keyboardTrainer : undefined
}

function App() {
  const apiAvailable = useMemo(() => typeof getApi()?.setTargetLetter === 'function', [])
  const [letterInput, setLetterInput] = useState('A')
  const [currentLetter, setCurrentLetter] = useState(null)
  const [transportState, setTransportState] = useState('not-sent')
  const [message, setMessage] = useState('Pick a letter and send it to Electron.')

  async function sendLetter(letter) {
    const api = getApi()
    if (!api?.setTargetLetter) {
      setMessage('Electron API is not available. Start app with npm run electron:dev.')
      return
    }

    const response = await api.setTargetLetter(letter)
    if (!response?.ok) {
      setMessage(response?.error || 'Failed to send letter.')
      return
    }

    setCurrentLetter(response.state.currentLetter)
    setTransportState(response.transport?.transport || 'unknown')
    setMessage(`Sent ${response.state.currentLetter} to main process.`)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    await sendLetter(letterInput)
  }

  return (
    <main className="app-shell">
      <header>
        <h1>Keyboard Trainer LED Bridge</h1>
        <p>Step 1: Renderer to Electron IPC for target letter updates (A-Z).</p>
      </header>

      <section className="status-grid">
        <article>
          <h2>Connection</h2>
          <p>{apiAvailable ? 'Electron preload API detected' : 'API unavailable (browser mode)'}</p>
        </article>
        <article>
          <h2>Current Letter</h2>
          <p className="large">{currentLetter || '-'}</p>
        </article>
        <article>
          <h2>Transport</h2>
          <p>{transportState}</p>
        </article>
      </section>

      <form className="letter-form" onSubmit={handleSubmit}>
        <label htmlFor="letter-input">Send target letter</label>
        <input
          id="letter-input"
          value={letterInput}
          onChange={(event) => setLetterInput(event.target.value.toUpperCase())}
          maxLength={1}
          placeholder="A"
        />
        <button type="submit">Send</button>
      </form>

      <section className="letter-pad">
        {alphabet.map((letter) => (
          <button key={letter} type="button" onClick={() => sendLetter(letter)}>
            {letter}
          </button>
        ))}
      </section>

      <p className="message">{message}</p>
    </main>
  )
}

export default App
