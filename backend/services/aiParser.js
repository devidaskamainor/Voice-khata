import { parseRelativeDate } from './dateService.js'

const MAX_TRANSACTION_AMOUNT = 10_000_000

const ENGLISH_NUMBERS = new Map(Object.entries({
  zero: 0, oh: 0, one: 1, a: 1, an: 1, two: 2, three: 3, four: 4,
  five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  hundred: 100, hundreds: 100, thousand: 1000, thousands: 1000,
  lakh: 100000, lakhs: 100000, lac: 100000, crore: 10000000,
  crores: 10000000
}))

const HINDI_NUMBERS = new Map(Object.entries({
  shunya: 0, sunya: 0, ek: 1, eka: 1, ikk: 1, do: 2, dho: 2,
  teen: 3, tin: 3, char: 4, chaar: 4, paanch: 5, panch: 5,
  che: 6, chhe: 6, chhah: 6, saat: 7, sat: 7, aath: 8, ath: 8,
  nau: 9, noo: 9, das: 10, dus: 10, gyarah: 11, gyaarah: 11,
  barah: 12, baarah: 12, terah: 13, chaudah: 14, pandrah: 15,
  solah: 16, satrah: 17, atharah: 18, unnis: 19,
  bees: 20, bis: 20, ikkis: 21, bais: 22, teis: 23, chaubees: 24,
  pachis: 25, chabbis: 26, sattais: 27, athais: 28, untis: 29,
  tees: 30, paintis: 35, chalis: 40, chaalis: 40, pachas: 50,
  pachhas: 50, saath: 60, sattar: 70, assi: 80, nabbe: 90,
  sau: 100, shau: 100, hazaar: 1000, hajar: 1000, lakh: 100000,
  laakh: 100000, crore: 10000000
}))

const KANNADA_NUMBERS = new Map(Object.entries({
  sonne: 0, ondu: 1, eradu: 2, mooru: 3, naalku: 4, nalaku: 4,
  aidu: 5, aaru: 6, elu: 7, eelu: 7, entu: 8, ombattu: 9,
  hattu: 10, hannondu: 11, hannೆರಡು: 12, hadimuru: 13,
  ippattu: 20, muvattu: 30, nalvattu: 40, nalavattu: 40,
  aivattu: 50, aravattu: 60, embತ್ತು: 80, tombattu: 90,
  nooru: 100, nuru: 100, saavira: 1000, savira: 1000,
  laksha: 100000, koti: 10000000
}))

const NATIVE_NUMBERS = new Map(Object.entries({
  '०': 0, 'शून्य': 0, 'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4,
  'पाँच': 5, 'पांच': 5, 'छह': 6, 'छः': 6, 'सात': 7, 'आठ': 8,
  'नौ': 9, 'दस': 10, 'ग्यारह': 11, 'बारह': 12, 'तेरह': 13,
  'चौदह': 14, 'पंद्रह': 15, 'सोलह': 16, 'सत्रह': 17,
  'अठारह': 18, 'उन्नीस': 19, 'बीस': 20, 'तीस': 30,
  'चालीस': 40, 'पचास': 50, 'साठ': 60, 'सत्तर': 70,
  'अस्सी': 80, 'नब्बे': 90, 'सौ': 100, 'हज़ार': 1000,
  'हजार': 1000, 'लाख': 100000, 'करोड़': 10000000
}))

for (const [word, value] of Object.entries({
  '೦': 0, 'ಒಂದು': 1, 'ಎರಡು': 2, 'ಮೂರು': 3, 'ನಾಲ್ಕು': 4,
  'ಐದು': 5, 'ಆರು': 6, 'ಏಳು': 7, 'ಎಂಟು': 8, 'ಒಂಬತ್ತು': 9,
  'ಹತ್ತು': 10, 'ಇಪ್ಪತ್ತು': 20, 'ಮೂವತ್ತು': 30, 'ನಲವತ್ತು': 40,
  'ಐವತ್ತು': 50, 'ಅರವತ್ತು': 60, 'ಎಪ್ಪತ್ತು': 70, 'ಎಂಭತ್ತು': 80,
  'ತೊಂಬತ್ತು': 90, 'ನೂರು': 100, 'ಸಾವಿರ': 1000, 'ಲಕ್ಷ': 100000,
  'ಕೋಟಿ': 10000000
})) NATIVE_NUMBERS.set(word, value)

const NUMBER_WORDS = new Map([
  ...ENGLISH_NUMBERS,
  ...HINDI_NUMBERS,
  ...KANNADA_NUMBERS,
  ...NATIVE_NUMBERS
])

const BALANCE_PATTERN = /\b(balance|total|kitna(?:\s+hai)?|hisab|how much|owe|owes|pending|baaki|baki|eshtu)\b|बैलेंस|बाकी|कितना|ಬಾಕಿ|ಎಷ್ಟು/i
const PAYMENT_PATTERN = /\b(diye hain|diye|diya|jama|payment|paid|pay|returned|received|gave|kottanu|kottaru|kotru|kottidane|kottiddare|pavati|rupees?|rupaye|rupya|ruppe|rupaayi|rs)\b|दिए|दिया|जमा|भुगतान|ಕೊಟ್ಟರು|ಕೊಟ್ಟನು|ಪಾವತಿ/i
const CREDIT_PATTERN = /\b(udhaar|udhar|credit|borrowed|loan|saala|saal|kodisi|kodbeku)\b|उधार|कर्ज|ಸಾಲ|ಉಧಾರ/i
const CANCEL_PATTERN = /\b(cancel|cancel it|never mind|stop|reject|discard)\b|रद्द|मत करो|ಬೇಡ|ರದ್ದು/i
const YES_PATTERN = /\b(yes|yeah|yep|confirm|correct|haan|han|ji|okay|ok|sahi|theek|thik)\b|हाँ|हां|जी|ठीक|ಹೌದು|ಸರಿ/i
const NO_PATTERN = /\b(no|nope|nahi|nahin|wrong|not correct)\b|नहीं|नही|गलत|ಇಲ್ಲ/i
const CURRENCY_WORDS = new Set(['rupee', 'rupees', 'rupaye', 'rupya', 'ruppe', 'rupaayi', 'rs', 'रुपये', 'रुपया', 'ರೂಪಾಯಿ'])

const COMMAND_WORDS = [
  'how much does', 'how much', 'kitna hai', 'kitna he', 'diye hain',
  'jama kar', 'gave me', 'balance', 'pending', 'payment', 'returned',
  'received', 'borrowed', 'customer', 'rupees', 'rupee', 'rupaye',
  'rupaayi', 'rupya', 'ruppe', 'udhaar', 'udhar', 'credit', 'loan',
  'saala', 'saal', 'saala', 'kodisi', 'kodbeku', 'kottanu', 'kottaru',
  'kotru', 'kottidane', 'kottiddare', 'diye', 'diya', 'paid', 'pay',
  'gave', 'jama', 'total', 'hisab', 'kitna', 'batao', 'batana', 'baaki',
  'baki', 'eshtu', 'heli', 'ide', 'owe', 'owes', 'add', 'record', 'for',
  'from', 'ne', 'ka', 'ki', 'ke', 'ko', 'ge', 'hai', 'he', 'rs', 'kodu', 'kodi',
  'aaj', 'aj', 'kal', 'parso', 'ninne', 'ivattu', 'indru', 'today',
  'yesterday', 'tomorrow', 'please', 'change', 'amount', 'make', 'it',
  'to', 'no', 'nahi', 'nahin', 'haan', 'han', 'yes', 'correct', 'confirm',
  'cancel', 'credit', 'cash', 'outstanding', 'most', 'highest', 'who',
  'customer', 'customers', 'sabse', 'zyada', 'kiske', 'paise', 'baaki',
  'and', 'aur', 'what', 'is', 'the', 'outstanding'
]

const DATE_WORDS = /\b(?:aaj|aj|kal|parso|yesterday|tomorrow|today|ninne|ivattu|day before yesterday|day after tomorrow|two days ago|2 days ago)\b|आज|कल|परसों|ನಿನ್ನೆ|ಇಂದು/giu
const DIGIT_AMOUNT_PATTERN = /(?<![\p{L}\p{N}])(?:₹\s*)?\d[\d,]*(?:\.\d{1,2})?(?![\p{L}\p{N}])/gu

const NEGATIVE_AMOUNT_PATTERN = /(?:-\s*(?:₹\s*)?\d|\b(?:minus|negative)\b)/i

function tokenize(text) {
  return String(text).normalize('NFC').toLowerCase().match(/[\p{L}\p{M}\p{N}]+(?:[-'][\p{L}\p{M}\p{N}]+)*/gu) || []
}

function numberValue(token) {
  const clean = token.normalize('NFC').replace(/[-']/g, '')
  if (NUMBER_WORDS.has(clean)) return NUMBER_WORDS.get(clean)
  if (/^\d+$/.test(clean)) return Number(clean)
  return null
}

function parseNumberRun(tokens) {
  if (!tokens.length) return { status: 'missing' }
  const values = tokens.map(numberValue)

  // Shopkeepers commonly say "three-forty" to mean 340.
  if (tokens.length === 2 && /^[1-9]$/.test(String(values[0])) &&
      values[1] >= 20 && values[1] < 100 &&
      NUMBER_WORDS.has(tokens[1].replace(/[-']/g, ''))) {
    return { status: 'ok', amount: values[0] * 100 + values[1] }
  }

  let total = 0
  let current = 0
  let previousSmall = false

  for (let i = 0; i < values.length; i += 1) {
    const value = values[i]
    if (value === null) return { status: 'ambiguous' }

    if (value >= 100) {
      if (value === 100) {
        current = (current || 1) * 100
      } else {
        total += (current || 1) * value
        current = 0
      }
      previousSmall = false
      continue
    }

    if (value >= 20) {
      if (current >= 1 && current <= 9 && i > 0 &&
          NUMBER_WORDS.has(tokens[i].replace(/[-']/g, ''))) {
        current = current * 100 + value
      } else {
        current += value
      }
      previousSmall = false
      continue
    }

    if (previousSmall && current < 20) return { status: 'ambiguous' }
    current += value
    previousSmall = true
  }

  const amount = total + current
  if (!Number.isFinite(amount)) return { status: 'invalid' }
  return { status: 'ok', amount }
}

export function extractAmount(transcript) {
  const original = String(transcript || '')
  if (NEGATIVE_AMOUNT_PATTERN.test(original)) return { status: 'invalid' }
  const text = original.replace(DATE_WORDS, ' ').replace(/(?<=\p{L})-(?=\p{L})/gu, ' ')
  const digits = [...text.matchAll(DIGIT_AMOUNT_PATTERN)]

  if (digits.length) {
    if (digits.length > 1) return { status: 'ambiguous', candidates: digits.map((m) => Number(m[0].replace(/[₹,\s]/g, ''))) }
    const amount = Number(digits[0][0].replace(/[₹,\s]/g, ''))
    return validateAmount(amount)
  }

  const tokens = tokenize(text)
  const runs = []
  let current = []
  for (const token of tokens) {
    if (token === 'and' || token === 'aur') continue
    if (numberValue(token) !== null) current.push(token)
    else if (current.length) {
      runs.push(current)
      current = []
    }
  }
  if (current.length) runs.push(current)

  if (!runs.length) return { status: 'missing' }
  if (runs.length > 1) return { status: 'ambiguous' }
  const parsed = parseNumberRun(runs[0])
  return validateAmount(parsed.amount, parsed.status)
}

function validateAmount(amount, status = 'ok') {
  if (status !== 'ok') return { status }
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_TRANSACTION_AMOUNT) {
    return { status: 'invalid', amount }
  }
  return { status: 'ok', amount: Math.round(amount * 100) / 100 }
}

function removeAmountText(text) {
  let result = String(text).replace(DATE_WORDS, ' ').replace(/(?<=\p{L})-(?=\p{L})/gu, ' ')
  result = result.replace(DIGIT_AMOUNT_PATTERN, ' ')
  const tokens = tokenize(result)
  const filtered = []
  let skippingNumber = false

  for (const token of tokens) {
    if (numberValue(token) !== null) {
      skippingNumber = true
      continue
    }
    if (skippingNumber && !NUMBER_WORDS.has(token)) skippingNumber = false
    if (!skippingNumber) filtered.push(token)
  }
  return filtered.join(' ')
}

const NATIVE_COMMAND_WORDS = [
  'का', 'के', 'की', 'को', 'ने', 'से', 'में', 'कितना', 'है', 'बाकी', 'बैलेंस',
  'उधार', 'रुपये', 'रुपया', 'दिए', 'दिया', 'जमा', 'भुगतान', 'आज', 'कल', 'परसों',
  'क्या', 'कुल', 'टोटल', 'सबसे', 'ज़्यादा', 'ज्यादा', 'किसके', 'पैसे', 'रकम',
  'दर्ज', 'करो', 'ಗೆ', 'ರೂಪಾಯಿ', 'ಸಾಲ', 'ಕೊಡಿ', 'ಕೊಟ್ಟರು', 'ಕೊಟ್ಟನು', 'ಪಾವತಿ',
  'ಬಾಕಿ', 'ಎಷ್ಟು', 'ಇಂದು', 'ನಿನ್ನೆ'
]

function extractCustomerName(transcript) {
  let name = removeAmountText(transcript).replace(/\b(what|is|the)\b/giu, ' ')
  name = name.replace(/'s\b/giu, ' ')
  for (const word of [...COMMAND_WORDS, ...NATIVE_COMMAND_WORDS].sort((a, b) => b.length - a.length)) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    name = name.replace(new RegExp(`(?:^|\\s)${escaped}(?=\\s|$)`, 'giu'), ' ')
  }
  name = name.replace(/[.,!?₹:$]/gu, ' ').replace(/\s+/g, ' ').trim()
  return name.split(' ').filter(Boolean).map((word) => {
    if (/[\u0900-\u097f\u0c80-\u0cff]/u.test(word)) return word
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  }).join(' ')
}

function dateFromCommand(original, timezone) {
  return parseRelativeDate(original, { timeZone: timezone })
}

function dailyIntent(text) {
  const today = /\b(today|aaj|aj|ivattu|indru)\b|आज|ಇಂದು/i.test(text)
  if (!today) return null
  const asksTotal = /\b(how much|kitna|total|amount|value)\b|कितना/i.test(text)
  if (!asksTotal) return null
  if (/\b(payment|paid|received|mila|aaya|aaye|jama)\b|भुगतान|जमा|ಪಾವತಿ/i.test(text)) return 'GET_DAILY_PAYMENT'
  if (/\b(credit|udhaar|udhar|borrowed|loan|gave|diya|diye|gaya|gaye)\b|उधार|कर्ज|ಸಾಲ/i.test(text)) return 'GET_DAILY_CREDIT'
  return null
}

const NATIVE_HIGHEST_PATTERN = /किसके|सबसे ज़्यादा|सबसे ज्यादा|ಅತ್ಯಂತ ಹೆಚ್ಚು|ಯಾರ ಬಾಕಿ/i
const NATIVE_OUTSTANDING_PATTERN = /बाकी|पैसे बाकी|ಬಾಕಿ/i

export function parseVoiceCommand(transcript, { timeZone = process.env.SHOP_TIMEZONE || 'Asia/Kolkata' } = {}) {
  const original = String(transcript || '').trim()
  const text = original.toLowerCase()
  if (!text) return { intent: 'UNKNOWN', message: 'Please say your command again.' }

  const aggregateIntent = dailyIntent(text)
  if (aggregateIntent) return { intent: aggregateIntent, dateRange: 'today' }

  if (NATIVE_HIGHEST_PATTERN.test(text) && NATIVE_OUTSTANDING_PATTERN.test(text)) {
    return { intent: 'GET_HIGHEST_BALANCE' }
  }

  if (/\b(who|which customer|kiske|sabse zyada|highest|most)\b/i.test(text) &&
      /\b(outstanding|baaki|balance|owed|due|paise)\b|बाकी/i.test(text)) {
    return { intent: 'GET_HIGHEST_BALANCE' }
  }

  if (BALANCE_PATTERN.test(text)) {
    const customerName = extractCustomerName(original)
    if (!customerName) return { intent: 'GET_TOTAL_BALANCE' }
    return { intent: 'CHECK_BALANCE', customerName }
  }

  const hasCredit = CREDIT_PATTERN.test(original)
  const hasPayment = [...original.matchAll(new RegExp(PAYMENT_PATTERN.source, 'giu'))]
    .some(([match]) => !/^(rupees?|rupaye|rupya|ruppe|rupaayi|rs)$/i.test(match))
  // Explicit udhaar/saala terms take precedence over Kannada "kodi" verbs.
  const intent = hasCredit ? 'ADD_CREDIT' : hasPayment ? 'RECORD_PAYMENT' : null
  if (!intent) {
    return { intent: 'UNKNOWN', message: 'Say a customer and amount, or ask about today’s totals.' }
  }

  const customerName = extractCustomerName(original)
  if (!customerName) {
    return { intent: 'UNKNOWN', message: 'Please say the customer name clearly.' }
  }

  const amountResult = extractAmount(original)
  if (amountResult.status === 'missing') {
    return { intent: 'UNKNOWN', message: 'Please say the amount clearly.', clarification: 'amount' }
  }
  if (amountResult.status === 'ambiguous') {
    return { intent: 'UNKNOWN', message: 'I heard more than one possible amount. Please say one amount.', clarification: 'amount' }
  }
  if (amountResult.status !== 'ok') {
    return { intent: 'UNKNOWN', message: 'That amount is not valid. Please say an amount greater than zero, up to ten million rupees.', clarification: 'amount' }
  }

  const date = dateFromCommand(original, timeZone)
  if (date.status === 'ambiguous') {
    return { intent: 'UNKNOWN', message: 'Do you mean yesterday or tomorrow? Please say the date again.', clarification: 'date' }
  }
  if (date.status === 'future') {
    return { intent: 'UNKNOWN', message: 'A transaction date cannot be in the future. Please say today or a past date.', clarification: 'date' }
  }

  return {
    intent,
    customerName,
    amount: amountResult.amount,
    transactionDate: date.date,
    dateLabel: date.label
  }
}

export function isNewLedgerCommand(transcript) {
  return [
    'ADD_CREDIT', 'RECORD_PAYMENT', 'CHECK_BALANCE', 'GET_TOTAL_BALANCE',
    'GET_DAILY_CREDIT', 'GET_DAILY_PAYMENT', 'GET_HIGHEST_BALANCE'
  ].includes(parseVoiceCommand(transcript).intent)
}

export function parsePendingResponse(transcript) {
  const text = String(transcript || '').trim()
  if (!text) return { action: 'UNKNOWN', message: 'Please say confirm, correct the amount, or cancel.' }
  if (CANCEL_PATTERN.test(text)) return { action: 'CANCEL' }

  const amount = extractAmount(text)
  const correction = /\b(change|correct|make|amount|instead|not|wrong)\b|नहीं|नही|बदल|बदलो|गलत|ಬದಲಾಯಿಸು/i.test(text)
  const amountOnly = tokenize(text).every((token) =>
    numberValue(token) !== null || CURRENCY_WORDS.has(token) || ['and', 'aur'].includes(token)
  )
  // Any amount spoken in a pending response is treated as a correction and
  // must receive a fresh confirmation, even if the transcript also says yes.
  if (amount.status === 'ok') {
    if (correction || NO_PATTERN.test(text) || YES_PATTERN.test(text) || amountOnly) {
      return { action: 'CORRECT_AMOUNT', amount: amount.amount }
    }
    return { action: 'UNKNOWN', message: 'Say a corrected amount, yes to confirm, or cancel.' }
  }
  if (amount.status === 'invalid') return { action: 'INVALID_AMOUNT' }
  if (amount.status === 'ambiguous') return { action: 'AMBIGUOUS_AMOUNT' }
  if (NO_PATTERN.test(text)) return { action: 'CANCEL' }
  if (correction) return { action: 'REQUEST_CORRECTION' }
  if (YES_PATTERN.test(text)) return { action: 'CONFIRM' }
  return { action: 'UNKNOWN', message: 'Say yes to save, say the corrected amount, or say cancel.' }
}

export const parserLimits = Object.freeze({ maxTransactionAmount: MAX_TRANSACTION_AMOUNT })
