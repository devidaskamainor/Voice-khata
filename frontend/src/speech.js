let currentAudio = null
let currentAudioUrl = null
let activePlaybackResolve = null

function clearAudio() {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.currentTime = 0
    currentAudio.onended = null
    currentAudio.onerror = null
    currentAudio.onplaying = null
    currentAudio = null
  }
  if (currentAudioUrl) {
    URL.revokeObjectURL(currentAudioUrl)
    currentAudioUrl = null
  }
}

export async function speakResponse(message, language = 'hi-IN', { onPlaybackStart } = {}) {
  if (!message || typeof message !== 'string') return false
  stopSpeaking()

  try {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 8000)
    let response
    try {
      response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message, language }),
        signal: controller.signal
      })
    } finally {
      window.clearTimeout(timeout)
    }
    if (!response.ok) throw new Error('Gnani speech service returned an error.')
    const audioBlob = await response.blob()
    if (!audioBlob.size) throw new Error('Gnani returned empty audio.')

    currentAudioUrl = URL.createObjectURL(audioBlob)
    currentAudio = new Audio(currentAudioUrl)
    const playback = new Promise((resolve, reject) => {
      activePlaybackResolve = resolve
      currentAudio.onplaying = () => onPlaybackStart?.('gnani')
      currentAudio.onended = () => {
        activePlaybackResolve = null
        clearAudio()
        resolve(true)
      }
      currentAudio.onerror = () => {
        activePlaybackResolve = null
        reject(new Error('Generated audio could not be played.'))
      }
      currentAudio.play().catch((error) => {
        activePlaybackResolve = null
        reject(error)
      })
    })
    return await playback
  } catch {
    clearAudio()
    return speakWithBrowser(message, language, onPlaybackStart)
  }
}

function speakWithBrowser(message, language, onPlaybackStart) {
  if (!('speechSynthesis' in window)) return Promise.resolve(false)
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(message)
  utterance.lang = language
  utterance.rate = 0.95
  utterance.pitch = 1
  return new Promise((resolve) => {
    activePlaybackResolve = resolve
    utterance.onstart = () => onPlaybackStart?.('browser')
    utterance.onend = () => {
      activePlaybackResolve = null
      resolve(true)
    }
    utterance.onerror = () => {
      activePlaybackResolve = null
      resolve(false)
    }
    window.speechSynthesis.speak(utterance)
  })
}

export function stopSpeaking() {
  if (activePlaybackResolve) {
    activePlaybackResolve(false)
    activePlaybackResolve = null
  }
  clearAudio()
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}
