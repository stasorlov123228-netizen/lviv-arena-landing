
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import '../../public/register.js'

describe('registration form error display', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="register-alert" class="form-alert" role="alert"></div>
      <form id="register-form">
        <input id="name-input" value="Test User" />
        <input id="email-input" value="test@example.com" />
        <input id="password-input" value="safe-password" />
        <input id="confirm-password-input" value="safe-password" />
        <button id="register-submit-btn" type="submit"></button>
      </form>`
    document.getElementById('register-alert')!.scrollIntoView = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ message: 'Registration is temporarily unavailable.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    )))
    document.dispatchEvent(new Event('DOMContentLoaded'))
  })

  afterEach(() => vi.unstubAllGlobals())

  it('shows the API error and restores the submit button', async () => {
    const form = document.getElementById('register-form')!
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

    await vi.waitFor(() => {
      expect(document.getElementById('register-alert')!.textContent).toBe('Registration is temporarily unavailable.')
      expect(document.getElementById('register-submit-btn')!.hasAttribute('disabled')).toBe(false)
    })
  })
})
