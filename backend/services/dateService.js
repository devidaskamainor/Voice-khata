const DATE_MARKERS = {
  today: /\b(today|aaj|aj|ivattu|indru)\b|आज|ಇಂದು/i,
  yesterday: /\b(yesterday|ninne)\b|ನಿನ್ನೆ/i,
  twoDaysAgo: /\b(day before yesterday|two days ago|2 days ago)\b/i,
  tomorrow: /\b(tomorrow)\b/i,
  twoDaysAhead: /\b(day after tomorrow)\b/i,
  ambiguousKal: /\bkal\b|कल/i,
  ambiguousParso: /\bparso\b|परसों/i
}

function datePartsAt(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date)
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map(({ type, value }) => [type, Number(value)]))
}

function addCalendarDays(parts, days) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days))
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate()
  }
}

export function formatLocalDate(parts) {
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

export function localDateTimeToUtc(dateString, timeZone, hour = 12) {
  const [year, month, day] = dateString.split('-').map(Number)
  const desiredUtcLike = Date.UTC(year, month - 1, day, hour)
  let guess = desiredUtcLike

  // Correct the guessed UTC time until the requested wall-clock time matches
  // in the configured timezone (including DST transitions).
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date(guess))
    const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map(({ type, value }) => [type, Number(value)]))
    const represented = Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute, values.second)
    guess += desiredUtcLike - represented
  }
  return new Date(guess)
}

export function getLocalDayRange({ now = new Date(), timeZone = process.env.SHOP_TIMEZONE || 'Asia/Kolkata' } = {}) {
  const today = datePartsAt(now, timeZone)
  const nextDay = addCalendarDays(today, 1)
  const startDate = formatLocalDate(today)
  const endDate = formatLocalDate(nextDay)
  return {
    date: startDate,
    start: localDateTimeToUtc(startDate, timeZone, 0),
    end: localDateTimeToUtc(endDate, timeZone, 0)
  }
}

export function parseRelativeDate(transcript, { now = new Date(), timeZone = process.env.SHOP_TIMEZONE || 'Asia/Kolkata' } = {}) {
  const text = String(transcript || '')
  const today = datePartsAt(now, timeZone)
  let offset = 0
  let label = 'today'

  if (DATE_MARKERS.today.test(text)) {
    offset = 0
    label = 'today'
  } else if (DATE_MARKERS.twoDaysAgo.test(text)) {
    offset = -2
    label = 'day before yesterday'
  } else if (DATE_MARKERS.yesterday.test(text)) {
    offset = -1
    label = 'yesterday'
  } else if (DATE_MARKERS.tomorrow.test(text) || DATE_MARKERS.twoDaysAhead.test(text)) {
    return { status: 'future', label: 'future' }
  } else if (DATE_MARKERS.ambiguousKal.test(text) || DATE_MARKERS.ambiguousParso.test(text)) {
    const pastTense = /\b(paid|received|gave|was|were|did|the|tha|thi|diye|diya|tha|thi|kiya|kiye|hue|hui)\b|थे|थी|था|दिए|दिया|ಕೊಟ್ಟರು|ಕೊಟ್ಟನು/i.test(text)
    const futureTense = /\b(will|tomorrow|dunga|karunga|karenge|hoga)\b|दूंगा|करूंगा/i.test(text)
    if (!pastTense && !futureTense) return { status: 'ambiguous', label: 'ambiguous' }
    offset = pastTense ? (DATE_MARKERS.ambiguousParso.test(text) ? -2 : -1) : (DATE_MARKERS.ambiguousParso.test(text) ? 2 : 1)
    if (offset > 0) return { status: 'future', label: 'future' }
    label = offset === -2 ? 'day before yesterday' : 'yesterday'
  }

  const parts = addCalendarDays(today, offset)
  return { status: 'ok', date: formatLocalDate(parts), label }
}

