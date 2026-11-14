import test from 'node:test'
import assert from 'node:assert/strict'
import { getLocalDayRange, parseRelativeDate } from '../services/dateService.js'

const now = new Date('2026-11-14T07:00:00.000Z')

test('resolves today, yesterday and day before yesterday in the configured timezone', () => {
  assert.equal(parseRelativeDate('aaj', { now, timeZone: 'Asia/Kolkata' }).date, '2026-11-14')
  assert.equal(parseRelativeDate('Yesterday', { now, timeZone: 'Asia/Kolkata' }).date, '2026-11-13')
  assert.equal(parseRelativeDate('day before yesterday', { now, timeZone: 'Asia/Kolkata' }).date, '2026-11-12')
  assert.equal(parseRelativeDate('Kal Ramesh ne 200 diye the', { now, timeZone: 'Asia/Kolkata' }).date, '2026-11-13')
  assert.equal(parseRelativeDate('Parso Suresh ka udhaar tha', { now, timeZone: 'Asia/Kolkata' }).date, '2026-11-12')
  assert.equal(parseRelativeDate('कल रमेश ने 200 दिए थे', { now, timeZone: 'Asia/Kolkata' }).date, '2026-11-13')
  assert.equal(parseRelativeDate('ನಿನ್ನೆ', { now, timeZone: 'Asia/Kolkata' }).date, '2026-11-13')
})

test('asks for clarification on ambiguous relative dates and rejects future dates', () => {
  assert.equal(parseRelativeDate('Kal Ramesh ka udhaar', { now, timeZone: 'Asia/Kolkata' }).status, 'ambiguous')
  assert.equal(parseRelativeDate('Parso Ramesh ka udhaar', { now, timeZone: 'Asia/Kolkata' }).status, 'ambiguous')
  assert.equal(parseRelativeDate('Tomorrow Ramesh paid', { now, timeZone: 'Asia/Kolkata' }).status, 'future')
})

test('uses local day boundaries rather than UTC calendar boundaries', () => {
  const range = getLocalDayRange({
    now: new Date('2026-11-13T18:29:00.000Z'),
    timeZone: 'Asia/Kolkata'
  })
  assert.equal(range.date, '2026-11-13')
  assert.equal(range.start.toISOString(), '2026-11-12T18:30:00.000Z')
  assert.equal(range.end.toISOString(), '2026-11-13T18:30:00.000Z')
})

