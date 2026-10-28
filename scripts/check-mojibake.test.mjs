import test from 'node:test'
import assert from 'node:assert/strict'
import { findMojibake } from './check-mojibake.mjs'

test('accepts correct Ukrainian text', () => {
  assert.deepEqual(findMojibake('Бронювання комп’ютера у Львові - цілодобово'), [])
})

test('detects the Unicode replacement character', () => {
  assert.equal(findMojibake(`Пошкоджено ${String.fromCharCode(0xfffd)}`)[0].reason, 'replacement character')
})

test('detects characteristic mojibake', () => {
  const sample = String.fromCodePoint(0x0420, 0x045f, 0x0420, 0x0455, 0x0421, 0x2020)
  assert.ok(findMojibake(sample).length > 0)
})

