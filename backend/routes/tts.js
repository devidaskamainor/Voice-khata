import { Router } from 'express'

const router = Router()

router.post('/', async (req, res) => {
  const startedAt = performance.now()
  try {
    const { text, language = 'hi-IN' } = req.body

    if (!process.env.GNANI_API_KEY) {
      return res.status(500).json({
        message: 'Gnani API key is missing from backend configuration.'
      })
    }

    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({
        message: 'Text is required for speech generation.'
      })
    }

    if (text.length > 2000) {
      return res.status(400).json({
        message: 'Text must be 2000 characters or fewer.'
      })
    }

    const supportedLanguages = [
      'en-IN', 'hi-IN', 'kn-IN', 'ta-IN', 'te-IN',
      'bn-IN', 'gu-IN', 'ml-IN', 'mr-IN', 'pa-IN'
    ]

    if (!supportedLanguages.includes(language)) {
      return res.status(400).json({
        message: 'Unsupported speech language.'
      })
    }

    const response = await fetch(
      'https://api.vachana.ai/api/v1/tts/sse',
      {
        method: 'POST',
        headers: {
          'X-API-Key-ID': process.env.GNANI_API_KEY,
          'Content-Type': 'application/json',
          Accept: 'text/event-stream'
        },
        body: JSON.stringify({
          audio_config: {
            bitrate: '192k',
            container: 'mp3',
            encoding: 'linear_pcm',
            num_channels: 1,
            sample_rate: 44100,
            sample_width: 2
          },
          model: 'timbre-v3.0',
          text: text.trim(),
          voice: 'Yashraj'
        }),
        signal: AbortSignal.timeout(20000)
      }
    )

    if (!response.ok) {
      console.error('Gnani TTS request failed with HTTP status:', response.status)

      return res.status(502).json({
        message: 'Gnani speech generation failed.',
        status: response.status
      })
    }

    const responseText = await response.text()

    const audioChunks = []
    let currentEvent = ''

    for (const line of responseText.split(/\r?\n/)) {
      if (line.startsWith('event:')) {
        currentEvent = line.slice(6).trim()
        continue
      }

      if (!line.startsWith('data:')) {
        continue
      }

      const data = line.slice(5).trim()

      if (currentEvent === 'audio_chunk' || currentEvent === 'chunk') {
        let audioData = data
        try {
          const chunkData = JSON.parse(data)
          audioData = chunkData.audio || chunkData.data || ''
        } catch {
          // Gnani's SSE endpoint sends raw base64 audio data in audio_chunk events.
        }
        if (audioData) audioChunks.push(Buffer.from(audioData, 'base64'))
      }

      if (currentEvent === 'error') {
        console.error('Gnani TTS stream returned an error event.')
      }

      currentEvent = ''
    }

    if (audioChunks.length === 0) {
      console.error('Gnani TTS returned no audio chunks.')

      return res.status(502).json({
        message: 'Gnani returned no audio chunks. Check the backend terminal.'
      })
    }

    const audio = Buffer.concat(audioChunks)

    console.info('[tts-metrics]', JSON.stringify({ providerMs: Math.round(performance.now() - startedAt), audioBytes: audio.length }))

    const isWav = audio.subarray(0, 4).toString() === 'RIFF'

    res.setHeader(
      'Content-Type',
      isWav ? 'audio/wav' : 'audio/mpeg'
    )
    res.setHeader('Content-Length', audio.length)
    res.setHeader('Cache-Control', 'no-store')

    return res.send(audio)
  } catch (error) {
    console.error('TTS route failed:', error.name || 'Error')

    return res.status(500).json({
      message: 'Could not generate speech.'
    })
  }
})

export default router
