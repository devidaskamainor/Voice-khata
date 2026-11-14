# Voice Khata demo and pitch outline

## Before the demo

- Start MongoDB, the backend, and the Vite frontend.
- Check the selected Gnani key and use a browser with microphone permission.
- Add synthetic customers `Ramesh Kumar`, `Ramesh Sharma`, and `Suresh`.
- Start from a clean demo database, or record the opening balances so the audience can interpret totals.
- Check Hindi and Kannada disclosure/TTS audio on the device. Keep the manual confirm/cancel controls visible as a recovery path.
- Do not use real customer names, phone numbers, or ledger data on screen.

## Two minute thirty second run of show

| Time | Action and suggested narration |
| --- | --- |
| 0:00–0:20 | “A busy shopkeeper cannot stop every sale to write in a notebook. Voice Khata is an AI assistant that turns a spoken request into a confirmed ledger entry.” Start the first recording; the app discloses that it is an AI assistant in the selected language. |
| 0:20–0:50 | Say: “Ramesh Kumar ka teen sau chaalis udhaar.” Show the transcript and ₹340 confirmation. Explain that nothing is saved before confirmation. |
| 0:50–1:10 | Record a correction: “Nahi, chaar sau tees.” Show the pending amount change to ₹430, then say “Haan” or press **Confirm and save**. Point out the same pending request was updated. |
| 1:10–1:30 | Record a payment: “Ramesh Kumar ne do sau diye.” Confirm it. Show the balance decrease from ₹430 to ₹230. |
| 1:30–1:50 | Ask: “Aaj kitna udhaar gaya?” Show the spoken answer and matching dashboard credit total, calculated from ledger entries for the configured local day. |
| 1:50–2:10 | Say: “Ramesh ka 500 udhaar.” Select either Ramesh Kumar or Ramesh Sharma from the clarification, review the customer ID/name, then cancel or confirm the entry. |
| 2:10–2:30 | Show the customer ledger and explain: Prisma transcribes, the backend parser and pending state validate, MongoDB supplies totals, and Timbre speaks the response. State that live latency is measured and report only numbers collected during this run. |

### Recovery if speech recognition fails

Keep the demo moving without fabricating a transcript: retry once, then type the exact example into the visible transcript box and press **Process command**. Explain that this exercises ledger parsing and confirmation, not speech recognition. If TTS fails, let the browser fallback speak or show the visible result and call out the fallback.

### Capture latency honestly

Backend logs emit `[voice-metrics]` with parser, database, and request durations. The browser logs `[voice-latency-client]` with recording-to-transcript and recording-end-to-playback-start durations plus the selected speech engine. These are diagnostic measurements, not a benchmark. Capture several complete turns on the actual demo network before reporting a value; include slow or failed requests rather than quoting only the fastest one.

## Pitch deck outline (maximum six slides)

1. **The shop-floor problem** — paper khata slows service and makes balances hard to query.
2. **The product** — speak credit, payments, balance, and daily total questions in Hindi, English, or Kannada.
3. **The safe voice workflow** — recognize, parse, identify, confirm, then write once; correction and duplicate-name examples.
4. **Architecture** — React push-to-talk, Prisma v3, Express pending state, MongoDB ledger, Timbre v3 and browser fallback.
5. **Live demo evidence** — show the updated ledger and actual test results; insert measured latency only after a real run. No placeholder metrics.
6. **Limitations and next steps** — authentication, persistent pending state, native speaker review, integration tests, and streaming playback.

## Submission checklist

- [ ] Capture dashboard, corrected confirmation, and daily totals using synthetic data.
- [ ] Record and link the 2–3 minute demo video.
- [ ] Present no more than six pitch slides.
- [ ] Verify the `.env` file is not staged or committed.
- [ ] Verify the deployed MongoDB encryption-at-rest setting and HTTPS/WSS endpoints.
- [ ] Run the tests and production build immediately before the presentation.
- [ ] Remove demo screenshots/video containing any non-consented personal data.
- [ ] Delete demo data only from the designated demo database; never run cleanup against a real ledger.
