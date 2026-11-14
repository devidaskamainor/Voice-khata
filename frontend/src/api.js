import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json'
  }
})

export const getCustomers = async () => {
  const response = await api.get('/customers')
  return response.data
}

export const addCustomer = async (customer) => {
  const response = await api.post('/customers', customer)
  return response.data
}

export const getTransactions = async () => {
  const response = await api.get('/transactions')
  return response.data
}

export const addTransaction = async (transaction) => {
  const response = await api.post('/transactions', transaction)
  return response.data
}

export const sendVoiceCommand = async (transcript, options = {}) => {
  const response = await api.post('/voice/command', {
    transcript,
    language: options.language,
    pendingId: options.pendingId,
    clientTimings: options.clientTimings
  })
  return response.data
}
export const confirmVoiceTransaction = async (pendingId, confirmed, revision, language) =>
  (
    await api.post('/voice/confirm', {
      pendingId,
      confirmed,
      revision,
      language
    })
  ).data

export const selectVoiceCustomer = async (pendingId, customerId) =>
  (await api.post('/voice/select-customer', { pendingId, customerId })).data

export const cancelVoiceTransaction = async (pendingId) =>
  (
    await api.post('/voice/cancel', {
      pendingId
    })
  ).data

export const getDailySummary = async () =>
  (await api.get('/voice/summary/today')).data

export default api
