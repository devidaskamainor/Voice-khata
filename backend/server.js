import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import { createServer } from 'http'
import { WebSocket, WebSocketServer } from 'ws'
import Transaction from './models/Transaction.js'

import ttsRouter from './routes/tts.js'
import voiceRouter from './routes/voice.js'
import transactionsRouter from './routes/transactions.js'
import customersRouter from './routes/customers.js'

const app = express()
const server = createServer(app)

const allowedOrigins = new Set(
  (process.env.FRONTEND_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
)
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true)
    return callback(new Error('Origin is not allowed.'))
  }
}))
app.use(express.json({ limit: '32kb' }))

app.use('/api/customers', customersRouter)
app.use('/api/transactions', transactionsRouter)
app.use('/api/voice', voiceRouter)
app.use('/api/tts', ttsRouter)

app.get('/', (_req, res) => {
  res.json({
    message: 'Voice Khata API is running successfully!'
  })
})

const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 })

server.on('upgrade', (request, socket, head) => {
  const origin = request.headers.origin
  if (origin && !allowedOrigins.has(origin)) {
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n')
    socket.destroy()
    return
  }
  const requestUrl = new URL(
    request.url,
    `http://${request.headers.host}`
  )

  if (requestUrl.pathname !== '/api/voice/stream') {
    socket.destroy()
    return
  }

  wss.handleUpgrade(request, socket, head, (clientSocket) => {
    wss.emit('connection', clientSocket, request)
  })
})

wss.on('connection', (clientSocket, request) => {
  const requestUrl = new URL(
    request.url,
    `http://${request.headers.host}`
  )

  const requestedLanguage = requestUrl.searchParams.get('lang') || 'hi-IN'
  const sampleRate = Number(
    requestUrl.searchParams.get('sampleRate') || 16000
  )

  const allowedLanguages = ['hi-IN', 'en-IN', 'kn-IN']
  const allowedSampleRates = [8000, 16000, 44100, 48000]

  if (
    !allowedLanguages.includes(requestedLanguage) ||
    !allowedSampleRates.includes(sampleRate)
  ) {
    clientSocket.send(JSON.stringify({
      type: 'error',
      message: 'Unsupported language or microphone sample rate.'
    }))
    clientSocket.close()
    return
  }

  if (!process.env.GNANI_API_KEY) {
    clientSocket.send(JSON.stringify({
      type: 'error',
      message: 'Gnani API key is missing from backend configuration.'
    }))
    clientSocket.close()
    return
  }

  const gnaniSocket = new WebSocket(
    'wss://api.vachana.ai/stt/v3/stream',
    {
      headers: {
        'x-api-key-id': process.env.GNANI_API_KEY,
        'lang_code': requestedLanguage,
        'x-sample-rate': String(sampleRate),
        'x-format': 'transcribe'
      }
    }
  )

  let clientClosed = false

  gnaniSocket.on('open', () => {
    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(JSON.stringify({
        type: 'status',
        message: 'Connected to Gnani speech recognition.'
      }))
    }
  })

  clientSocket.on('message', (data, isBinary) => {
    if (gnaniSocket.readyState !== WebSocket.OPEN) {
      return
    }

    gnaniSocket.send(data, { binary: isBinary })
  })

  gnaniSocket.on('message', (data, isBinary) => {
    if (
      clientSocket.readyState !== WebSocket.OPEN
    ) {
      return
    }

    if (isBinary) {
      clientSocket.send(data, { binary: true })
      return
    }

    try {
      const event = JSON.parse(data.toString())
      if (event.type === 'error') {
        clientSocket.send(JSON.stringify({
          type: 'error',
          message: 'The speech recognition provider reported an error. Retry or check backend configuration.'
        }))
      } else {
        clientSocket.send(JSON.stringify(event))
      }
    } catch {
      clientSocket.send(JSON.stringify({
        type: 'error',
        message: 'Could not read the response from Gnani.'
      }))
    }
  })

  gnaniSocket.on('error', (error) => {
    console.error('Gnani STT WebSocket failed:', error.name || 'Error')

    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(JSON.stringify({
        type: 'error',
        message: 'Could not connect to Gnani speech recognition. Check the API configuration and backend logs.'
      }))
    }
  })

  clientSocket.on('error', (error) => {
    console.error('Browser WebSocket failed:', error.name || 'Error')
  })

  clientSocket.on('close', () => {
    clientClosed = true

    if (
      gnaniSocket.readyState === WebSocket.OPEN ||
      gnaniSocket.readyState === WebSocket.CONNECTING
    ) {
      gnaniSocket.close()
    }
  })

  gnaniSocket.on('close', (code, reason) => {
    if (!clientClosed && clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(JSON.stringify({
        type: 'stream-ended',
        code,
        message: 'Speech recognition connection closed.'
      }))

      clientSocket.close()
    }
  })
})

async function startServer() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is missing from your .env file')
    }

    await mongoose.connect(process.env.MONGODB_URI)
    await Transaction.init()

    console.log('MongoDB connected successfully!')

    const PORT = process.env.PORT || 5000

    server.listen(PORT, () => {
      console.log(`Voice Khata server running on port ${PORT}`)
      console.log('Gnani speech WebSocket endpoint is ready.')
    })
  } catch (error) {
    console.error('Server startup failed:', error.name || 'Error')
    process.exit(1)
  }
}

startServer()
