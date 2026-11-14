import { useEffect, useRef, useState } from 'react'
import {
  cancelVoiceTransaction,
  confirmVoiceTransaction,
  selectVoiceCustomer,
  sendVoiceCommand
} from './api'
import { speakResponse, stopSpeaking } from './speech'
import './VoiceAssistant.css'

const languageNames = { 'hi-IN': 'Hindi', 'en-IN': 'English', 'kn-IN': 'Kannada' }
const disclosures = {
  'hi-IN': 'नमस्ते, मैं वॉइस खाता AI सहायक हूँ।',
  'en-IN': 'Hello, I am the Voice Khata AI assistant.',
  'kn-IN': 'ನಮಸ್ಕಾರ, ನಾನು ವಾಯ್ಸ್ ಖಾತಾ AI ಸಹಾಯಕ.'
}

function getVoiceSocketUrl() {
  const configured = import.meta.env.VITE_WS_URL
  if (configured) return configured
  const url = new URL('/api/voice/stream', window.location.href)
  url.protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString()
}

function mergeTranscript(previous, incoming) {
  const oldText = String(previous || '').trim()
  const newText = String(incoming || '').trim()
  if (!oldText) return newText
  if (!newText) return oldText
  if (newText.startsWith(oldText) || newText.includes(oldText)) return newText
  if (oldText.endsWith(newText)) return oldText
  const oldWords = oldText.split(/\s+/)
  const newWords = newText.split(/\s+/)
  const maxOverlap = Math.min(oldWords.length, newWords.length)
  for (let overlap = maxOverlap; overlap > 0; overlap -= 1) {
    if (oldWords.slice(-overlap).join(' ').toLocaleLowerCase() === newWords.slice(0, overlap).join(' ').toLocaleLowerCase()) {
      return [...oldWords, ...newWords.slice(overlap)].join(' ')
    }
  }
  return `${oldText} ${newText}`.trim()
}

export default function VoiceAssistant({ onTransactionSaved }) {
  const [recording, setRecording] = useState(false)
  const [playingAudio, setPlayingAudio] = useState(false)
  const [starting, setStarting] = useState(false)
  const [status, setStatus] = useState('Ready to listen')
  const [transcript, setTranscript] = useState('')
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [pendingTransaction, setPendingTransaction] = useState(null)
  const [language, setLanguage] = useState('hi-IN')

  const socketRef = useRef(null)
  const audioContextRef = useRef(null)
  const streamRef = useRef(null)
  const sourceRef = useRef(null)
  const processorRef = useRef(null)
  const stoppingRef = useRef(false)
  const startingRef = useRef(false)
  const recordingEndedAtRef = useRef(null)
  const finalTranscriptAtRef = useRef(null)
  const timingMetricsRef = useRef(null)
  const transcriptRef = useRef('')

  async function speakWithFeedback(message, locale, options = {}) {
    try {
      return await speakResponse(message, locale, {
        ...options,
        onPlaybackStart: (engine) => {
          setPlayingAudio(true)
          options.onPlaybackStart?.(engine)
        }
      })
    } finally {
      setPlayingAudio(false)
    }
  }

  useEffect(() => {
    if (!result) return undefined
    void speakWithFeedback(result, language, {
      onPlaybackStart: (engine) => {
        const endToTranscript = recordingEndedAtRef.current !== null && finalTranscriptAtRef.current !== null
          ? Math.max(0, Math.round(finalTranscriptAtRef.current - recordingEndedAtRef.current))
          : null
        console.info('[voice-latency-client]', JSON.stringify({
          engine,
          recordingToTranscriptMs: endToTranscript,
          ...timingMetricsRef.current,
          endToPlaybackStartMs: recordingEndedAtRef.current === null
            ? null
            : Math.max(0, Math.round(performance.now() - recordingEndedAtRef.current))
        }))
      }
    })
    return () => stopSpeaking()
  }, [result, language])

  async function startRecording() {
    if (startingRef.current || recording || busy) return
    startingRef.current = true
    setStarting(true)
    try {
      setError('')
      setResult('')
      setTranscript('')
      transcriptRef.current = ''
      recordingEndedAtRef.current = null
      finalTranscriptAtRef.current = null
      setStatus(pendingTransaction
        ? 'Record your confirmation, correction, or cancellation.'
        : 'Preparing the microphone...')

      stopSpeaking()
      await new Promise((resolve) => window.setTimeout(resolve, 0))
      const disclosureKey = `voice-khata-ai-disclosure-v1:${language}`
      let disclosed = false
      try { disclosed = window.localStorage.getItem(disclosureKey) === 'played' } catch { /* Storage may be disabled by the browser. */ }
      if (!disclosed) {
        setStatus('Introducing the AI assistant...')
        const played = await speakWithFeedback(disclosures[language], language)
        if (played) {
          try { window.localStorage.setItem(disclosureKey, 'played') } catch { /* The disclosure remains session-only when storage is disabled. */ }
        }
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('This browser cannot access a microphone. Try a current Android or desktop browser over HTTPS.')
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }
      })
      streamRef.current = mediaStream

      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      if (!AudioContextClass) throw new Error('Audio recording is not supported in this browser.')
      const audioContext = new AudioContextClass()
      audioContextRef.current = audioContext
      await audioContext.resume()

      const socket = new WebSocket(getVoiceSocketUrl())
      socketRef.current = socket
      stoppingRef.current = false
      let socketConnected = false
      let rejectConnection
      const connectionPromise = new Promise((resolve, reject) => {
        rejectConnection = reject
        const timeout = window.setTimeout(() => {
          reject(new Error('Speech service connection timed out. Check your network and try again.'))
          socket.close()
        }, 10000)
        socket.onopen = () => {
          socketConnected = true
          window.clearTimeout(timeout)
          resolve()
        }
      })

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          if (message.type === 'status') setStatus(message.message)
          if (message.type === 'transcript' && message.text) {
            const receivedAt = performance.now()
            const isFinal = message.is_final === true || message.final === true || message.is_partial === false
            if (isFinal) finalTranscriptAtRef.current = receivedAt
            transcriptRef.current = mergeTranscript(transcriptRef.current, message.text)
            setTranscript(transcriptRef.current)
            setStatus(isFinal
              ? 'Final transcript ready to process'
              : 'Speech recognized; keep speaking or stop recording')
          }
          if (message.type === 'processing') setStatus('Finishing speech recognition...')
          if (message.type === 'error') {
            setError(`${message.message || 'Speech recognition failed.'} Check your connection and try again.`)
            setStatus('Speech service needs attention')
          }
          if (message.type === 'stream-ended') {
            if (transcriptRef.current && finalTranscriptAtRef.current === null) {
              finalTranscriptAtRef.current = performance.now()
            }
            setStatus('Speech session ended. Review the transcript and retry if it is incomplete.')
            setRecording(false)
            void cleanup()
          }
        } catch {
          setError('Could not read the speech service response. Restart recording and try again.')
        }
      }
      socket.onerror = () => {
        setError('Could not connect to Gnani speech recognition. Check the backend, API key configuration, and network.')
        setRecording(false)
        const error = new Error('Could not connect to the speech service. Check the backend and Gnani API key.')
        if (!socketConnected) rejectConnection(error)
        void cleanup()
      }
      socket.onclose = () => {
        const unexpected = !stoppingRef.current
        setRecording(false)
        if (unexpected) setStatus('Speech connection closed. Reconnect and record again.')
        if (!socketConnected) rejectConnection(new Error('Speech service closed before recording started.'))
        void cleanup()
      }
      await connectionPromise

      const source = audioContext.createMediaStreamSource(mediaStream)
      const processor = audioContext.createScriptProcessor(512, 1, 1)
      sourceRef.current = source
      processorRef.current = processor
      processor.onaudioprocess = (event) => {
        if (stoppingRef.current || socket.readyState !== WebSocket.OPEN) return
        const samples = event.inputBuffer.getChannelData(0)
        const pcm = new Int16Array(samples.length)
        for (let i = 0; i < samples.length; i += 1) {
          const sample = Math.max(-1, Math.min(1, samples[i]))
          pcm[i] = sample < 0 ? sample * 32768 : sample * 32767
        }
        socket.send(pcm.buffer)
      }
      source.connect(processor)
      processor.connect(audioContext.destination)
      setRecording(true)
      setStatus(pendingTransaction
        ? `Listening for ${pendingTransaction.customerName || 'your selection'}, confirmation, correction, or cancellation.`
        : `Listening in ${languageNames[language]}. Speak your command.`)
    } catch (err) {
      const message = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
        ? 'Microphone permission was denied. Allow microphone access in browser settings, then try again.'
        : err.message || 'Could not start microphone recording.'
      setError(message)
      setStatus('Ready to try again')
      await cleanup()
    } finally {
      startingRef.current = false
      setStarting(false)
    }
  }

  async function stopRecording() {
    if (!recording && !startingRef.current) return
    recordingEndedAtRef.current = performance.now()
    stoppingRef.current = true
    if (processorRef.current) {
      processorRef.current.onaudioprocess = null
      processorRef.current.disconnect()
      processorRef.current = null
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect()
      sourceRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (audioContextRef.current) {
      await audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
    const socket = socketRef.current
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'stop' }))
      setStatus('Recording ended. Waiting for the final transcript...')
    } else {
      setRecording(false)
    }
  }

  async function cleanup(updateState = true) {
    stoppingRef.current = true
    if (processorRef.current) {
      processorRef.current.onaudioprocess = null
      processorRef.current.disconnect()
      processorRef.current = null
    }
    sourceRef.current?.disconnect()
    sourceRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (audioContextRef.current) {
      await audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
    if (socketRef.current) {
      socketRef.current.close()
      socketRef.current = null
    }
    if (updateState) setRecording(false)
  }

  useEffect(() => () => {
    void cleanup(false)
  }, [])

  async function processCommand() {
    if (!transcript.trim()) {
      setError('Record or type a command first.')
      return
    }
    try {
      setBusy(true)
      setError('')
      setResult('')
      setStatus('Processing the transcript and checking the ledger...')
      const recordingToTranscriptMs = recordingEndedAtRef.current !== null && finalTranscriptAtRef.current !== null
        ? Math.max(0, finalTranscriptAtRef.current - recordingEndedAtRef.current)
        : null
      const response = await sendVoiceCommand(transcript.trim(), {
        language,
        pendingId: pendingTransaction?.pendingId,
        clientTimings: { recordingToTranscriptMs }
      })

      timingMetricsRef.current = response.metrics || { recordingToTranscriptMs }
      if (['CONFIRM_TRANSACTION', 'AWAITING_CORRECTION', 'AWAITING_CUSTOMER'].includes(response.intent)) {
        setPendingTransaction(response)
        setResult(response.message || 'Please review the pending transaction.')
        setStatus(response.state === 'AWAITING_CUSTOMER'
          ? 'Choose the correct customer before saving.'
          : response.intent === 'AWAITING_CORRECTION'
            ? 'Waiting for a corrected amount.'
            : 'Waiting for confirmation. No transaction has been saved yet.')
        return
      }

      setPendingTransaction(null)
      setResult(response.message || response.response || response.reply || 'Command processed successfully.')
      setStatus(response.intent === 'CANCELLED' ? 'Transaction cancelled' : response.transaction ? 'Transaction saved' : 'Answer ready')
      if (response.transaction && onTransactionSaved) await onTransactionSaved()
    } catch (err) {
      const data = err.response?.data
      if (data?.intent === 'AWAITING_CUSTOMER' && data.customerOptions?.length) {
        setPendingTransaction({ ...data, customerOptions: data.customerOptions })
      }
      setError(data?.message || data?.error || err.message || 'Could not process the command. Check the connection and try again.')
      setStatus('Command needs attention')
    } finally {
      setBusy(false)
    }
  }

  async function handleSelectCustomer(customerId) {
    if (!pendingTransaction?.pendingId) return
    try {
      setBusy(true)
      setError('')
      const response = await selectVoiceCustomer(pendingTransaction.pendingId, customerId)
      setPendingTransaction(response)
      setResult(response.message)
      setStatus('Customer selected. Review the amount and confirm.')
    } catch (err) {
      setError(err.response?.data?.message || 'Could not select that customer. Start the command again.')
    } finally {
      setBusy(false)
    }
  }

  async function handleConfirmTransaction() {
    if (!pendingTransaction?.pendingId || pendingTransaction.state === 'AWAITING_CUSTOMER') return
    try {
      setBusy(true)
      setError('')
      setStatus('Saving the confirmed transaction...')
      const response = await confirmVoiceTransaction(
        pendingTransaction.pendingId,
        true,
        pendingTransaction.revision,
        language
      )
      setPendingTransaction(null)
      timingMetricsRef.current = response.metrics || timingMetricsRef.current
      setResult(response.message || 'Transaction saved successfully.')
      setStatus('Transaction saved')
      if (onTransactionSaved) await onTransactionSaved()
    } catch (err) {
      const data = err.response?.data
      setError(data?.message || data?.error || 'Could not save the transaction. Retry the same confirmation safely.')
      setStatus('Transaction was not confirmed. Review and try again.')
    } finally {
      setBusy(false)
    }
  }

  async function handleCancelTransaction() {
    if (!pendingTransaction?.pendingId) return
    try {
      setBusy(true)
      setError('')
      const response = await cancelVoiceTransaction(pendingTransaction.pendingId)
      setPendingTransaction(null)
      setResult(response.message || 'Transaction cancelled.')
      setStatus('Transaction cancelled. Nothing was saved.')
    } catch (err) {
      setError(err.response?.data?.message || 'Could not cancel the pending transaction. Retry or wait for it to expire.')
    } finally {
      setBusy(false)
    }
  }

  function handleLanguageChange(event) {
    setLanguage(event.target.value)
    setStatus('Language changed. The AI disclosure will be played on the next interaction.')
    setError('')
    setResult('')
    stopSpeaking()
  }

  return (
    <section className="voice-panel" aria-labelledby="voice-heading-title">
      <div className="voice-heading">
        <div className="voice-icon" aria-hidden="true">🎙</div>
        <div>
          <h3 id="voice-heading-title">Voice Khata Assistant</h3>
          <p>Manage your shop ledger using your voice.</p>
        </div>
      </div>

      <div className="language-selector">
        <label htmlFor="voice-language">Choose language</label>
        <select id="voice-language" value={language} onChange={handleLanguageChange} disabled={recording || starting || busy}>
          <option value="hi-IN">Hindi</option>
          <option value="en-IN">English</option>
          <option value="kn-IN">Kannada</option>
        </select>
      </div>

      <div className="voice-status" role="status" aria-live="polite">
        <span className={recording ? 'voice-dot active' : playingAudio ? 'voice-dot playback' : 'voice-dot'} />
        {recording ? status : playingAudio ? 'Speaking response...' : status}
      </div>

      {pendingTransaction && (
        <p className="pending-notice" role="status">
          Pending request: {pendingTransaction.customerName || 'customer selection'} · expires in about {Math.ceil((pendingTransaction.expiresInSeconds || 0) / 60)} min. Say a correction, confirm, or cancel before starting another ledger command.
        </p>
      )}

      <div className="voice-actions">
        {!recording ? (
          <button className="voice-start" type="button" onClick={startRecording} disabled={busy || starting}>
            {starting ? 'Preparing...' : pendingTransaction ? 'Record response' : 'Start recording'}
          </button>
        ) : (
          <button className="voice-stop" type="button" onClick={stopRecording}>Stop recording</button>
        )}
      </div>

      <label htmlFor="voiceTranscript">Recognized speech</label>
      <textarea
        id="voiceTranscript"
        rows="3"
        value={transcript}
        onChange={(event) => {
          transcriptRef.current = event.target.value
          setTranscript(event.target.value)
        }}
        placeholder="Recognized words appear here. You can correct them before processing."
        maxLength={500}
      />

      <p className="voice-hint">
        {pendingTransaction
          ? 'Try: “Nahi, 430”, “Change it to 600”, “Yes”, or “Cancel”.'
          : language === 'hi-IN'
            ? 'Example: Ramesh ka teen sau chaalis udhaar'
            : language === 'en-IN'
              ? 'Example: Add three hundred forty credit for Ramesh'
              : 'Example: Ramesh ge mooru nooru rupaayi saala kodi'}
      </p>

      <button className="voice-process" type="button" onClick={processCommand} disabled={busy || recording || starting || !transcript.trim()}>
        {busy ? 'Processing...' : pendingTransaction ? 'Process response' : 'Process command'}
      </button>

      {result && <p className="voice-result" aria-live="polite">{result}</p>}

      {pendingTransaction && (
        <div className="transaction-confirmation" role="group" aria-label="Pending voice transaction">
          <h3>{pendingTransaction.state === 'AWAITING_CUSTOMER' ? 'Choose customer' : 'Review transaction'}</h3>
          {pendingTransaction.state === 'AWAITING_CUSTOMER' ? (
            <div className="customer-choice-list">
              {pendingTransaction.customerOptions?.map((customer) => (
                <button key={customer.id} type="button" onClick={() => handleSelectCustomer(customer.id)} disabled={busy}>
                  {customer.name}
                </button>
              ))}
            </div>
          ) : (
            <>
              <p>Customer: <strong>{pendingTransaction.customerName}</strong></p>
              <p>Type: <strong>{pendingTransaction.type === 'CREDIT' ? 'Credit given' : 'Payment received'}</strong></p>
              <p>Amount: <strong>₹{Number(pendingTransaction.amount).toLocaleString('en-IN')}</strong></p>
              <p>Date: <strong>{pendingTransaction.transactionDate ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(pendingTransaction.transactionDate)) : 'Today'}</strong></p>
              <p>{pendingTransaction.state === 'AWAITING_CORRECTION' ? 'Say the corrected amount, then review the updated amount before saving.' : 'This entry is not saved until you confirm.'}</p>
            </>
          )}

          <div className="confirmation-actions">
            {pendingTransaction.state === 'AWAITING_CONFIRMATION' && (
              <button type="button" className="confirm-transaction-button" onClick={handleConfirmTransaction} disabled={busy}>
                {busy ? 'Saving...' : 'Confirm and save'}
              </button>
            )}
            <button type="button" className="cancel-transaction-button" onClick={handleCancelTransaction} disabled={busy}>
              Cancel pending entry
            </button>
          </div>
        </div>
      )}

      {error && <p className="voice-error" role="alert">{error}</p>}
      <p className="voice-disclosure">AI assistant. Review every transaction before it is saved. Speech transcripts are processed in memory and are not added to the ledger.</p>
    </section>
  )
}
