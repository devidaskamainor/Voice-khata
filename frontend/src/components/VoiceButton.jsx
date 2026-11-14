import { useState } from 'react'

function VoiceButton({ onTranscript }) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState('')
  const supported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  const start = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError('Voice input is not supported in this browser. Add an entry manually instead.')
      return
    }
    setError('')
    const recognition = new SpeechRecognition()
    recognition.lang = 'hi-IN'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onstart = () => setListening(true)
    recognition.onend = () => setListening(false)
    recognition.onerror = (event) => {
      setListening(false)
      setError(event.error === 'not-allowed' ? 'Allow microphone access to use voice input.' : 'Could not recognize speech. Please try again.')
    }
    recognition.onresult = (event) => onTranscript(event.results[0][0].transcript)
    recognition.start()
  }

  return (
    <div>
      <button className="voice-record" type="button" aria-label="Start voice entry" disabled={listening} onClick={start}>
        {listening ? '…' : '🎙'}
      </button>
      {error && <p className="page-error" role="alert">{error}</p>}
      {!supported && !error && <span className="voice-hint">Voice input works in supported browsers.</span>}
    </div>
  )
}

export default VoiceButton
