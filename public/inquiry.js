document.querySelectorAll('form[data-inquiry]').forEach((form) => {
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const status = form.querySelector('[data-inquiry-message]')
    const button = form.querySelector('button[type="submit"], button:not([type])')
    button.disabled = true
    status.textContent = 'Надсилання…'
    const values = Object.fromEntries(new FormData(form).entries())
    try {
      const response = await fetch('/api/inquiries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...values, kind: form.dataset.inquiry }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Не вдалося надіслати звернення.')
      status.textContent = result.message
      form.reset()
    } catch (error) { status.textContent = error.message }
    finally { button.disabled = false }
  })
})
