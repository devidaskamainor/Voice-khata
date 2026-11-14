function normalizeName(value) {
  return String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

export function resolveCustomerCandidates(query, customers) {
  const name = normalizeName(query)
  const exact = customers.filter((customer) => normalizeName(customer.name) === name)
  if (exact.length) return exact
  return customers.filter((customer) => normalizeName(customer.name).startsWith(name))
}

