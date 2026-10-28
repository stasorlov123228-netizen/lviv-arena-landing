
(function () {
  'use strict';

  const CONNECTION_ERROR =
    'Не вдалося зв’язатися із сервером. Перевірте підключення до інтернету та спробуйте ще раз.';
  const BOOKING_CONFLICT =
    'Вибраний час щойно зайняли. Оберіть інший час і спробуйте ще раз.';

  const fieldLabels = {
    computerCategory: 'Категорія комп’ютера',
    date: 'Дата',
    duration: 'Тривалість',
    name: 'Ім’я',
    phone: 'Номер телефону',
    tariff: 'Тариф',
    time: 'Час початку',
  };

  const getFieldLabel = function (field) {
    const parts = field.split('.');
    const fieldName = parts[parts.length - 1] || field;
    return fieldLabels[fieldName] || field;
  };

  const translateServerMessage = function (message) {
    const translations = {
      'This field is required.': 'Це поле обов’язкове.',
      'This value is invalid.': 'Вказано неприпустиме значення.',
      'Validation Error.': 'Перевірте правильність заповнення полів.',
    };
    return translations[message] || message;
  };

  const getApiErrorMessage = function (body, status) {
    if (body?.code === 'PHONE_IN_USE' && typeof body.message === 'string') return body.message;
    if (status === 409) return BOOKING_CONFLICT;

    if (typeof body !== 'object' || body === null) {
      return 'Сервер відхилив запит (HTTP ' + status + '), але не надав опису помилки.';
    }

    const messages = [];

    if (
      typeof body.message === 'string' &&
      body.message.trim() &&
      body.message !== 'Validation Error.'
    ) {
      messages.push(translateServerMessage(body.message.trim()));
    }

    if (Array.isArray(body.errors)) {
      for (const item of body.errors) {
        if (typeof item !== 'object' || item === null) continue;
        if (typeof item.message !== 'string' || !item.message.trim()) continue;

        const field =
          typeof item.field === 'string'
            ? item.field
            : typeof item.path === 'string'
              ? item.path
              : null;
        const msg = translateServerMessage(item.message.trim());
        messages.push(field ? getFieldLabel(field) + ': ' + msg : msg);
      }
    }

    const unique = Array.from(new Set(messages));
    if (unique.length) return unique.join('\n');

    return 'Сервер відхилив запит (HTTP ' + status + '), але не надав опису помилки.';
  };

  const categoryDescriptions = {
    DEFAULT: 'STANDART - визначається тарифом автоматично.',
    PRO: 'PRO - визначається тарифом автоматично.',
    VIP: 'VIP - визначається тарифом автоматично.',
    STREAM: 'STREAM - визначається тарифом автоматично.',
  };

  const formatDate = function (dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const durationLabel = function (n) {
    const num = Number(n);
    if (num === 1) return '1 година';
    if (num === 2) return '2 години';
    if (num === 3) return '3 години';
    if (num === 5) return '5 годин';
    return num + ' год.';
  };

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function init() {
    const form = document.querySelector('#booking-form');
    const successBox = document.querySelector('#booking-success');
    const submitBtn = document.querySelector('#submit-btn');

    const nameInput = document.querySelector('#name');
    const phoneInput = document.querySelector('#phone');
    const emailInput = document.querySelector('#email');
    const tariffSelect = document.querySelector('#tariff');
    const dateInput = document.querySelector('#date');
    const timeInput = document.querySelector('#time');
    const durationSelect = document.querySelector('#duration');
    const categoryInfoText = document.querySelector('#category-info-text');
    const availabilityStatus = document.querySelector('#availability-status');
    const phoneHint = document.querySelector('#phone-hint');

    let isSubmitting = false;
    let activeAbortController = null;
    let pendingAvailability = false;

    let profileRequest = Promise.resolve();
    if (phoneInput || emailInput) {
      profileRequest = fetch('/api/auth/profile', { cache: 'no-store' })
        .then(function (response) {
          if (!response.ok) return null;
          return response.json();
        })
        .then(function (data) {
          const profile = data?.profile;
          const savedName = profile?.name?.trim();
          const savedPhone = profile?.phone?.trim();
          const savedEmail = profile?.email?.trim();
          if (savedName && nameInput && !nameInput.value.trim()) nameInput.value = savedName;
          if (savedEmail && emailInput) {
            emailInput.value = savedEmail;
            emailInput.readOnly = true;
            emailInput.setAttribute('aria-readonly', 'true');
          }
          if (!savedPhone || !phoneInput) return;

          phoneInput.value = savedPhone;
          if (/^\+380[0-9]{9}$/.test(savedPhone)) {
            phoneInput.readOnly = true;
            phoneInput.setAttribute('aria-readonly', 'true');
            if (phoneHint) phoneHint.textContent = '\u041d\u043e\u043c\u0435\u0440 \u0430\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u043d\u043e \u0432\u0437\u044f\u0442\u043e \u0437 \u0432\u0430\u0448\u043e\u0433\u043e \u043f\u0440\u043e\u0444\u0456\u043b\u044e.';
          }
        })
        .catch(function () {

        });
    }

    const hideError = function () {
      const existing = document.querySelector('#error-dialog-overlay');
      if (existing) existing.remove();
    };

    const showError = function (msg) {
      hideError();

      const overlay = document.createElement('div');
      overlay.id = 'error-dialog-overlay';
      overlay.className = 'dialog-overlay';
      overlay.innerHTML =
        '<section role="alertdialog" aria-modal="true" aria-labelledby="booking-error-title" aria-describedby="booking-error-description" class="dialog-card">' +
        '  <div class="dialog-icon-wrap">' +
        '    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
        '      <circle cx="12" cy="12" r="10"></circle>' +
        '      <line x1="12" y1="8" x2="12" y2="12"></line>' +
        '      <line x1="12" y1="16" x2="12.01" y2="16"></line>' +
        '    </svg>' +
        '  </div>' +
        '  <h2 id="booking-error-title" class="dialog-title">Не вдалося створити бронювання</h2>' +
        '  <p id="booking-error-description" class="dialog-desc"></p>' +
        '  <button type="button" id="error-close-btn" class="btn-lime dialog-btn">Зрозуміло</button>' +
        '</section>';

      const descEl = overlay.querySelector('#booking-error-description');
      if (descEl) descEl.textContent = msg;

      overlay.addEventListener('mousedown', function (e) {
        if (e.target === overlay) hideError();
      });

      const closeBtn = overlay.querySelector('#error-close-btn');
      if (closeBtn) closeBtn.addEventListener('click', hideError);

      document.body.appendChild(overlay);
      if (closeBtn) closeBtn.focus();
    };

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') hideError();
    });

    if (dateInput) {
      dateInput.min = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Kyiv' });
    }
    if (timeInput) {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Kyiv', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
      }).formatToParts(new Date(Date.now() + 60 * 1000));
      const getPart = function (type) { return parts.find(function (item) { return item.type === type; })?.value || '00'; };
      timeInput.value = getPart('hour') + ':' + getPart('minute');
    }

    try {
      const params = new URLSearchParams(window.location.search);
      const urlTariff = params.get('tariff');
      const urlCat = params.get('category');

      if (urlTariff && tariffSelect) {
        if (Array.from(tariffSelect.options).some(function (option) { return option.value === urlTariff; })) {
          tariffSelect.value = urlTariff;
        }
      } else if (urlCat && tariffSelect) {
        const matchingOption = Array.from(tariffSelect.options).find(function (option) {
          return option.dataset.category === urlCat;
        });
        if (matchingOption) tariffSelect.value = matchingOption.value;
      }
    } catch (e) {}

    const updateCategoryText = function () {
      if (!categoryInfoText || !tariffSelect) return;
      const selectedOption = tariffSelect.selectedOptions[0];
      categoryInfoText.textContent = selectedOption
        ? selectedOption.dataset.category + ' - ' + selectedOption.textContent
        : categoryDescriptions.DEFAULT;
    };
    updateCategoryText();

    const loadAvailability = async function () {
      if (!dateInput || !tariffSelect || !timeInput || !durationSelect) {
        return;
      }

      const date = dateInput.value;
      const tariff = tariffSelect.value;
      const time = timeInput.value;
      const duration = durationSelect.value;

      if (!date) {
        if (availabilityStatus) {
          availabilityStatus.textContent =
            'Вільний комп’ютер і його номер буде призначено автоматично після перевірки доступності.';
        }
        return;
      }

      if (activeAbortController) {
        activeAbortController.abort();
      }
      activeAbortController = new AbortController();

      if (availabilityStatus) {
        availabilityStatus.textContent = 'Перевіряємо, чи є вільний комп’ютер…';
      }

      try {
        const query = new URLSearchParams({ tariff, date, time, duration }).toString();
        const res = await fetch('/api/bookings?' + query, {
          signal: activeAbortController.signal,
        });
        const body = await res.json();

        if (!res.ok) {
          throw new Error(body?.message || 'Не вдалося перевірити доступність.');
        }

        const availableCount = Number(body?.availableCount) || 0;

        if (availableCount === 0) {
          if (availabilityStatus) {
            availabilityStatus.textContent =
              'На обраний час немає вільних комп’ютерів. Спробуйте інший час або тариф.';
          }
        } else {
          if (availabilityStatus) {
            availabilityStatus.textContent = 'Є вільні комп’ютери: ' + availableCount + '. Номер буде призначено автоматично.';
          }
        }
      } catch (err) {
        if (err && err.name === 'AbortError') return;
        if (availabilityStatus) {
          availabilityStatus.textContent =
            (err && err.message) || 'Не вдалося перевірити доступність комп’ютерів.';
        }
      }
    };

    const scheduleAvailability = function () {
      if (pendingAvailability) return;
      pendingAvailability = true;
      queueMicrotask(function () {
        pendingAvailability = false;
        loadAvailability();
      });
    };

    if (tariffSelect) {
      tariffSelect.addEventListener('change', function () {
        updateCategoryText();
        scheduleAvailability();
      });
    }

    if (dateInput) {
      dateInput.addEventListener('input', scheduleAvailability);
      dateInput.addEventListener('change', scheduleAvailability);
    }
    if (timeInput) {
      timeInput.addEventListener('input', scheduleAvailability);
      timeInput.addEventListener('change', scheduleAvailability);
    }
    if (durationSelect) {
      durationSelect.addEventListener('change', scheduleAvailability);
    }

    if (form) {
      form.addEventListener('submit', async function (e) {
        e.preventDefault();

        if (isSubmitting) return;

        await profileRequest;

        const name = nameInput ? nameInput.value.trim() : '';
        const phone = phoneInput ? phoneInput.value.trim() : '';
        const email = emailInput ? emailInput.value.trim().toLowerCase() : '';
        const tariff = tariffSelect ? tariffSelect.value : 'DEFAULT';
        const date = dateInput ? dateInput.value : '';
        const time = timeInput ? timeInput.value : '';
        const duration = Number(durationSelect ? durationSelect.value : 2);

        if (!/^\+380[0-9]{9}$/.test(phone)) {
          showError('Введіть номер у форматі +380 і 9 цифр, наприклад +380501234567.');
          phoneInput?.focus();
          return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
          showError('Enter a valid email address.');
          if (emailInput) emailInput.focus();
          return;
        }

        isSubmitting = true;
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.setAttribute('aria-busy', 'true');
        }

        try {
          const response = await fetch('/api/bookings', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: name,
              phone: phone,
              email: email,
              tariff: tariff,
              date: date,
              time: time,
              duration: duration,
            }),
          });

          let body;
          try {
            body = await response.json();
          } catch (jsonErr) {
            showError(CONNECTION_ERROR);
            return;
          }

          if (!response.ok) {
            showError(getApiErrorMessage(body, response.status));
            return;
          }

          if (!body || typeof body !== 'object' || !body.doc || !body.doc.id) {
            showError('Сервер не підтвердив збереження заявки. Спробуйте ще раз.');
            return;
          }

          const doc = body.doc;
          form.style.display = 'none';
          if (successBox) {
            successBox.innerHTML =
              '<div class="success-header">' +
              '  <svg class="success-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">' +
              '    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>' +
              '  </svg>' +
              '  <h2 class="success-title">' +
              '    ВИ УСПІШНО ЗАБРОНЮВАЛИ<br>КОМ’ЮТЕР' +
              '  </h2>' +
              '</div>' +
              '<div class="success-body">' +
              '  <dl class="details-list">' +
              '    <div class="detail-row">' +
              '      <dt class="detail-label">№ бронювання</dt>' +
              '      <dd class="detail-value highlight" id="success-id">#' + doc.id + '</dd>' +
              '    </div>' +
              '    <div class="detail-row">' +
              '      <dt class="detail-label">Ім’я клієнта</dt>' +
              '      <dd class="detail-value" id="success-name">' + escapeHtml(doc.name || '') + '</dd>' +
              '    </div>' +
              '    <div class="detail-row">' +
              '      <dt class="detail-label">Комп’ютер</dt>' +
              '      <dd class="detail-value" id="success-computer">' + escapeHtml((doc.computer || '').replace('PC-', 'ПК-')) + '</dd>' +
              '    </div>' +
              '    <div class="detail-row">' +
              '      <dt class="detail-label">Категорія</dt>' +
              '      <dd class="detail-value" id="success-category">' + escapeHtml(doc.computerCategory === 'STREAMER' ? 'STREAM' : doc.computerCategory || '-') + '</dd>' +
              '    </div>' +
              '    <div class="detail-row">' +
              '      <dt class="detail-label">Тариф</dt>' +
              '      <dd class="detail-value" id="success-tariff">' + escapeHtml(doc.tariff || '') + '</dd>' +
              '    </div>' +
              '    <div class="detail-row">' +
              '      <dt class="detail-label">Дата</dt>' +
              '      <dd class="detail-value" id="success-date">' + formatDate(doc.date || '') + '</dd>' +
              '    </div>' +
              '    <div class="detail-row">' +
              '      <dt class="detail-label">Час початку</dt>' +
              '      <dd class="detail-value" id="success-time">' + escapeHtml(doc.time || '') + '</dd>' +
              '    </div>' +
              '    <div class="detail-row">' +
              '      <dt class="detail-label">Тривалість</dt>' +
              '      <dd class="detail-value" id="success-duration">' + durationLabel(doc.duration || 2) + '</dd>' +
              '    </div>' +
              '  </dl>' +
              '  <div class="success-actions">' +
              '    <a href="/booking" class="btn-outline" style="flex: 1; text-align: center;">Нове бронювання</a>' +
              '    <a href="/" class="btn-lime" style="flex: 1; text-align: center;">На головну</a>' +
              '  </div>' +
              '</div>';
            successBox.style.display = 'block';
          }
        } catch (fetchErr) {
          showError(CONNECTION_ERROR);
        } finally {
          isSubmitting = false;
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.removeAttribute('aria-busy');
          }
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

