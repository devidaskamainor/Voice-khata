import { parseVoiceCommand } from './services/aiParser.js'

console.log('\n--- Voice Khata Parser Tests ---\n')

console.log('Test 1: Hindi credit')
console.log(parseVoiceCommand('Ramesh ka 340 udhaar'))

console.log('\nTest 2: Hindi payment')
console.log(parseVoiceCommand('Ramesh ne 200 diye'))

console.log('\nTest 3: English credit')
console.log(parseVoiceCommand('Add 500 credit for Ramesh'))

console.log('\nTest 4: English payment')
console.log(parseVoiceCommand('Ramesh paid 200 rupees'))

console.log('\nTest 5: Balance inquiry')
console.log(parseVoiceCommand('Ramesh ka balance kitna hai'))

console.log('\nTest 6: Kannada transliteration')
console.log(parseVoiceCommand('Ramesh ge 340 rupaayi saala kodi'))

console.log('\nTest 5: Balance inquiry')
console.log(parseVoiceCommand('Ramesh ka balance kitna hai'))