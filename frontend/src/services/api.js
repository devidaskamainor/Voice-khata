const API_BASE = import.meta.env.VITE_API_URL || '/api'

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`)
  return body
}

export const api = {
  customers: {
    list: () => request('/customers'),
    create: (customer) => request('/customers', { method: 'POST', body: JSON.stringify(customer) }),
    remove: (id) => request(`/customers/${id}`, { method: 'DELETE' }),
  },
  transactions: {
    list: () => request('/transactions'),
    create: (entry) => request('/transactions', { method: 'POST', body: JSON.stringify(entry) }),
  },
  voice: {
    parse: (transcript) => request('/voice/parse', { method: 'POST', body: JSON.stringify({ transcript }) }),
  },
}
