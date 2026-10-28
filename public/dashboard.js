'use strict';

document.addEventListener('DOMContentLoaded', () => {

  const tabButtons = document.querySelectorAll('.dash-tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabName = btn.getAttribute('data-tab');
      if (!tabName) return;

      tabButtons.forEach((b) => b.classList.remove('active'));
      tabPanels.forEach((p) => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPanel = document.getElementById(`panel-${tabName}`);
      if (targetPanel) targetPanel.classList.add('active');

      if (tabName === 'bookings') loadBookings();
      if (tabName === 'computers') loadComputers();
      if (tabName === 'tariffs') loadTariffs();
      if (tabName === 'users') loadUsers();
    });
  });

  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
      const alert = modal.querySelector('.form-alert');
      if (alert) {
        alert.className = 'form-alert';
        alert.textContent = '';
      }
    }
  }

  function openAdminAction({ title, description, confirmLabel, danger = false, run, onSuccess, onCancel }) {
    const dialog = document.getElementById('admin-action-dialog');
    const titleEl = document.getElementById('admin-action-title');
    const descriptionEl = document.getElementById('admin-action-description');
    const statusEl = document.getElementById('admin-action-status');
    const cancelButton = document.getElementById('admin-action-cancel');
    const confirmButton = document.getElementById('admin-action-confirm');
    if (!dialog || !titleEl || !descriptionEl || !statusEl || !cancelButton || !confirmButton) return;

    titleEl.textContent = title;
    descriptionEl.textContent = description;
    statusEl.textContent = '';
    statusEl.className = 'admin-action-status';
    cancelButton.textContent = danger ? 'Ні, залишити' : 'Скасувати';
    confirmButton.textContent = confirmLabel;
    confirmButton.className = danger ? 'btn-lime btn-danger' : 'btn-lime';
    cancelButton.disabled = false;
    confirmButton.disabled = false;
    if (dialog.open) dialog.close();
    dialog.showModal();

    cancelButton.onclick = () => {
      dialog.close();
      onCancel?.();
    };
    dialog.oncancel = (event) => {
      if (confirmButton.disabled) event.preventDefault();
      else onCancel?.();
    };
    confirmButton.onclick = async () => {
      cancelButton.disabled = true;
      confirmButton.disabled = true;
      confirmButton.classList.add('is-loading');
      confirmButton.textContent = 'Виконується…';
      statusEl.className = 'admin-action-status';
      statusEl.textContent = 'Виконуємо запит до сервера…';
      try {
        const successMessage = await run();
        statusEl.className = 'admin-action-status success';
        statusEl.textContent = successMessage || 'Зміни збережено.';
        setTimeout(() => {
          if (dialog.open) dialog.close();
          onSuccess?.();
        }, 700);
      } catch (error) {
        statusEl.className = 'admin-action-status error';
        statusEl.textContent = error instanceof Error ? error.message : 'Не вдалося виконати дію.';
        cancelButton.disabled = false;
        confirmButton.disabled = false;
        confirmButton.classList.remove('is-loading');
        confirmButton.textContent = confirmLabel;
      }
    };
  }

  async function requestAdminJson(url, options, fallbackMessage) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || fallbackMessage);
    return data;
  }

  document.querySelectorAll('[data-close-modal]').forEach((el) => {
    el.addEventListener('click', () => {
      const modalId = el.getAttribute('data-close-modal');
      if (modalId) closeModal(modalId);
    });
  });

  document.querySelectorAll('.admin-modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal(overlay.id);
      }
    });
  });

  const btnOpenChangePw = document.getElementById('btn-open-change-pw');
  const bannerChangePwBtn = document.getElementById('banner-change-pw-btn');
  const changePwForm = document.getElementById('change-pw-form');
  const newPwInput = document.getElementById('new-pw-input');
  const confirmPwInput = document.getElementById('confirm-pw-input');
  const pwAlert = document.getElementById('pw-modal-alert');
  const pwBanner = document.getElementById('banner-must-change-pw');

  if (btnOpenChangePw) {
    btnOpenChangePw.addEventListener('click', () => openModal('modal-change-password'));
  }
  if (bannerChangePwBtn) {
    bannerChangePwBtn.addEventListener('click', () => openModal('modal-change-password'));
  }

  if (changePwForm) {
    changePwForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newPassword = newPwInput.value;
      const confirmPassword = confirmPwInput.value;

      if (!newPassword || newPassword.length < 8) {
        showFormAlert(pwAlert, 'Пароль повинен містити щонайменше 8 символів.', 'error');
        return;
      }
      if (newPassword === 'admin') {
        showFormAlert(pwAlert, 'Пароль "admin" використовувати заборонено.', 'error');
        return;
      }
      if (newPassword !== confirmPassword) {
        showFormAlert(pwAlert, 'Паролі не співпадають.', 'error');
        return;
      }

      try {
        const res = await fetch('/api/auth/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newPassword, confirmPassword }),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          showFormAlert(pwAlert, data.message || 'Помилка зміни пароля.', 'error');
          return;
        }

        showFormAlert(pwAlert, 'Пароль успішно змінено!', 'success');
        if (pwBanner) pwBanner.style.display = 'none';

        setTimeout(() => {
          closeModal('modal-change-password');
          changePwForm.reset();
        }, 1200);
      } catch (err) {
        showFormAlert(pwAlert, 'Мережева помилка при зміні пароля.', 'error');
      }
    });
  }

  const bookingsTbody = document.getElementById('bookings-tbody');
  const bookingsCountBadge = document.getElementById('badge-bookings-count');
  const filterBookingSearch = document.getElementById('filter-booking-search');
  const filterBookingStatus = document.getElementById('filter-booking-status');
  const filterBookingTariff = document.getElementById('filter-booking-tariff');
  const filterBookingDate = document.getElementById('filter-booking-date');
  const btnRefreshBookings = document.getElementById('btn-refresh-bookings');

  async function loadBookings() {
    if (!bookingsTbody) return;
    bookingsTbody.innerHTML = '<tr><td colspan="9" class="empty-state">Завантаження бронювань...</td></tr>';

    const params = new URLSearchParams();
    if (filterBookingSearch && filterBookingSearch.value.trim()) {
      params.set('search', filterBookingSearch.value.trim());
    }
    if (filterBookingStatus && filterBookingStatus.value !== 'all') {
      params.set('status', filterBookingStatus.value);
    }
    if (filterBookingTariff && filterBookingTariff.value !== 'all') {
      params.set('tariff', filterBookingTariff.value);
    }
    if (filterBookingDate && filterBookingDate.value) {
      params.set('date', filterBookingDate.value);
    }

    try {
      const res = await fetch(`/api/admin/bookings?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load bookings');
      const data = await res.json();
      const docs = data.docs || [];

      if (bookingsCountBadge) bookingsCountBadge.textContent = String(data.totalDocs ?? docs.length);

      if (docs.length === 0) {
        bookingsTbody.innerHTML = '<tr><td colspan="9" class="empty-state">Бронювань не знайдено.</td></tr>';
        return;
      }

      bookingsTbody.innerHTML = docs
        .map((b) => {
          const dateStr = b.date ? String(b.date).slice(0, 10) : '-';
          const timeStr = b.time ? String(b.time) : '-';
          const durationStr = b.duration ? `${b.duration} год` : '-';
          const amount = b.totalAmount === null || b.totalAmount === undefined ? null : Number(b.totalAmount);
          const amountStr = amount !== null && Number.isFinite(amount)
            ? `${new Intl.NumberFormat('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)} грн`
            : '-';
          const statusClass = `badge-${b.status || 'new'}`;
          const compDisplay = b.computer ? `<strong>${escapeHtml(b.computer)}</strong>` : '<span style="color:var(--text-muted);">(не призначено)</span>';
          const catDisplay = b.computerCategory ? `<span style="font-size:0.75rem; color:var(--accent-lime);">${escapeHtml(b.computerCategory === 'STREAMER' ? 'STREAM' : b.computerCategory)}</span>` : '';

          return `
            <tr data-booking-id="${b.id}">
              <td>#${b.id}</td>
              <td>
                <strong>${escapeHtml(b.name || '-')}</strong>
                <div style="font-size: 0.8rem; color: var(--text-secondary);">${escapeHtml(b.phone || '')}</div>
              </td>
              <td>
                ${compDisplay}
                <div>${catDisplay}</div>
              </td>
              <td><span class="badge" style="background:rgba(255,255,255,0.06);">${escapeHtml(b.tariff || '-')}</span></td>
              <td>${dateStr} <br><small style="color:var(--text-secondary);">${timeStr}</small></td>
              <td>${durationStr}</td>
              <td><strong>${amountStr}</strong></td>
              <td><span class="badge ${statusClass}">${escapeHtml(b.status || 'new')}</span></td>
              <td>
                <div class="action-btn-group">
                  ${
                    b.status !== 'confirmed'
                      ? `<button type="button" class="btn-sm btn-action-primary" onclick="window.updateBookingStatus(${b.id}, 'confirmed')" title="Підтвердити">Підтвердити</button>`
                      : ''
                  }
                  <button type="button" class="btn-sm btn-action-subtle" onclick="window.openEditBookingModal(${JSON.stringify(b).replace(/"/g, '&quot;')})" title="Редагувати">Редагувати</button>
                  <button type="button" class="btn-sm btn-action-danger" onclick="window.deleteBooking(${b.id})" title="Видалити назавжди">Видалити</button>
                  ${
                    b.status !== 'cancelled'
                      ? `<button type="button" class="btn-sm btn-action-danger" onclick="window.updateBookingStatus(${b.id}, 'cancelled')" title="Скасувати">Скасувати</button>`
                      : ''
                  }
                </div>
              </td>
            </tr>
          `;
        })
        .join('');
    } catch (err) {
      bookingsTbody.innerHTML = '<tr><td colspan="9" class="empty-state" style="color:var(--color-error);">Помилка завантаження бронювань.</td></tr>';
    }
  }

  window.updateBookingStatus = async function (id, status) {
    const cancelling = status === 'cancelled';
    openAdminAction({
      title: cancelling ? 'Скасувати бронювання?' : 'Підтвердити бронювання?',
      description: cancelling
        ? `Скасувати бронювання #${id}? Запис залишиться в історії зі статусом «Скасовано».`
        : `Підтвердити бронювання #${id}? Новий статус буде збережено в системі.`,
      confirmLabel: cancelling ? 'Так, скасувати' : 'Так, підтвердити',
      danger: cancelling,
      run: async () => {
        const data = await requestAdminJson('/api/admin/bookings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, status }),
        }, 'Не вдалося оновити бронювання.');
        return data.message;
      },
      onSuccess: loadBookings,
    });
  };

  window.deleteBooking = function (id) {
    openAdminAction({
      title: 'Видалити бронювання назавжди?',
      description: `Бронювання #${id} і пов’язаний платіж буде безповоротно видалено з Neon/PostgreSQL. Цю дію не можна скасувати.`,
      confirmLabel: 'Видалити назавжди',
      danger: true,
      run: async () => {
        const data = await requestAdminJson(`/api/admin/bookings?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
        }, 'Не вдалося видалити бронювання.');
        return data.message;
      },
      onSuccess: loadBookings,
    });
  };

  const editBookingForm = document.getElementById('edit-booking-form');
  const editBookingIdInput = document.getElementById('edit-booking-id');
  const editBookingIdDisplay = document.getElementById('edit-booking-id-display');
  const editBookingUserInput = document.getElementById('edit-booking-user');
  const editBookingNameInput = document.getElementById('edit-booking-name');
  const editBookingPhoneInput = document.getElementById('edit-booking-phone');
  const editBookingTariffInput = document.getElementById('edit-booking-tariff');
  async function loadBookingTariffOptions() {
    if (!editBookingTariffInput) return;
    try {
      const response = await fetch('/api/admin/tariffs');
      if (!response.ok) return;
      const data = await response.json();
      const selectedValue = editBookingTariffInput.value;
      editBookingTariffInput.replaceChildren();
      (data.docs || []).forEach((tariff) => {
        const option = document.createElement('option');
        option.value = tariff.name;
        option.textContent = tariff.name + ' - ' + (tariff.title || tariff.name);
        editBookingTariffInput.append(option);
      });
      if (selectedValue) editBookingTariffInput.value = selectedValue;
    } catch (error) {
      console.error('Could not load booking tariff options:', error);
    }
  }
  loadBookingTariffOptions();
  const editBookingStatusSelect = document.getElementById('edit-booking-status');
  const editBookingComputerInput = document.getElementById('edit-booking-computer');
  const editBookingDateInput = document.getElementById('edit-booking-date');
  const editBookingTimeInput = document.getElementById('edit-booking-time');
  const editBookingDurationInput = document.getElementById('edit-booking-duration');
  const editBookingAlert = document.getElementById('booking-modal-alert');

  async function populateBookingUsers(selectedUserId) {
    if (!editBookingUserInput) return;
    editBookingUserInput.innerHTML = '<option value="">Без прив’язки до акаунта</option>';
    try {
      const { docs = [] } = await requestAdminJson('/api/admin/users', {}, 'Не вдалося завантажити список клієнтів.');
      docs.forEach((user) => {
        const option = document.createElement('option');
        option.value = String(user.id);
        option.textContent = `${user.name || user.email} - ${user.email}${user.isBlocked ? ' (заблокований)' : ''}`;
        option.disabled = Boolean(user.isBlocked) && String(user.id) !== String(selectedUserId ?? '');
        editBookingUserInput.append(option);
      });
      if (selectedUserId !== null && selectedUserId !== undefined && !docs.some((user) => String(user.id) === String(selectedUserId))) {
        const option = document.createElement('option');
        option.value = String(selectedUserId);
        option.textContent = `Клієнт #${selectedUserId} (поточний запис)`;
        editBookingUserInput.append(option);
      }
      editBookingUserInput.value = selectedUserId === null || selectedUserId === undefined ? '' : String(selectedUserId);
    } catch (error) {
      showFormAlert(editBookingAlert, error instanceof Error ? error.message : 'Не вдалося завантажити клієнтів.', 'error');
    }
  }

  window.openEditBookingModal = function (booking) {
    if (!editBookingForm) return;
    editBookingIdInput.value = booking.id;
    if (editBookingIdDisplay) editBookingIdDisplay.textContent = booking.id;
    const relatedUserId = booking.user && typeof booking.user === 'object' ? booking.user.id : booking.user;
    populateBookingUsers(relatedUserId);
    editBookingNameInput.value = booking.name || '';
    editBookingPhoneInput.value = booking.phone || '';
    editBookingTariffInput.value = booking.tariff || 'DEFAULT';
    editBookingStatusSelect.value = booking.status || 'new';
    editBookingComputerInput.value = booking.computer || '';
    editBookingDateInput.value = booking.date ? String(booking.date).slice(0, 10) : '';
    editBookingTimeInput.value = booking.time || '';
    editBookingDurationInput.value = booking.duration || 1;
    openModal('modal-edit-booking');
  };

  if (editBookingForm) {
    editBookingForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = editBookingIdInput.value;
      const status = editBookingStatusSelect.value;
      const computer = editBookingComputerInput.value.trim();
      const date = editBookingDateInput.value;
      const time = editBookingTimeInput.value;
      const duration = Number(editBookingDurationInput.value);
      const user = editBookingUserInput.value ? Number(editBookingUserInput.value) : null;
      const submitButton = editBookingForm.querySelector('[type="submit"]');
      if (submitButton) submitButton.disabled = true;
      showFormAlert(editBookingAlert, 'Зберігаємо бронювання…', 'success');

      try {
        const data = await requestAdminJson('/api/admin/bookings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, status, computer, date, time, duration, user, name: editBookingNameInput.value.trim(), phone: editBookingPhoneInput.value.trim(), tariff: editBookingTariffInput.value }),
        }, 'Не вдалося зберегти бронювання.');

        showFormAlert(editBookingAlert, data.message || 'Збережено!', 'success');
        loadBookings();
        setTimeout(() => {
          closeModal('modal-edit-booking');
        }, 600);
      } catch (err) {
        showFormAlert(editBookingAlert, err instanceof Error ? err.message : 'Мережева помилка.', 'error');
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  }

  if (filterBookingSearch) filterBookingSearch.addEventListener('input', debounce(loadBookings, 400));
  if (filterBookingStatus) filterBookingStatus.addEventListener('change', loadBookings);
  if (filterBookingTariff) filterBookingTariff.addEventListener('change', loadBookings);
  if (filterBookingDate) filterBookingDate.addEventListener('change', loadBookings);
  if (btnRefreshBookings) btnRefreshBookings.addEventListener('click', loadBookings);

  const computersTbody = document.getElementById('computers-tbody');
  const computersCountBadge = document.getElementById('badge-computers-count');
  const filterPcSearch = document.getElementById('filter-pc-search');
  const filterPcCategory = document.getElementById('filter-pc-category');
  const filterPcStatus = document.getElementById('filter-pc-status');
  const btnRefreshComputers = document.getElementById('btn-refresh-computers');
  const btnAddComputer = document.getElementById('btn-add-computer');

  async function loadComputers(silent = false) {
    if (!computersTbody) return;
    if (!silent) computersTbody.innerHTML = '<tr><td colspan="5" class="empty-state">Завантаження комп’ютерів...</td></tr>';

    const params = new URLSearchParams();
    if (filterPcSearch && filterPcSearch.value.trim()) params.set('search', filterPcSearch.value.trim());
    if (filterPcCategory && filterPcCategory.value !== 'all') params.set('category', filterPcCategory.value);
    if (filterPcStatus && filterPcStatus.value !== 'all') params.set('status', filterPcStatus.value);

    try {
      const res = await fetch(`/api/admin/computers?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load computers');
      const data = await res.json();
      const docs = data.docs || [];

      if (computersCountBadge) computersCountBadge.textContent = String(data.totalDocs ?? docs.length);

      if (docs.length === 0) {
        computersTbody.innerHTML = '<tr><td colspan="5" class="empty-state">Комп’ютерів не знайдено.</td></tr>';
        return;
      }

      computersTbody.innerHTML = docs
        .map((pc) => {
          const statusClass = `badge-${pc.status || 'available'}`;
          return `
            <tr data-pc-id="${pc.id}">
              <td><strong>${escapeHtml(pc.computerNumber)}</strong></td>
              <td><span class="badge" style="background:rgba(163,255,18,0.1); color:var(--accent-lime);">${escapeHtml(pc.category === 'STREAMER' ? 'STREAM' : pc.category)}</span></td>
              <td>${escapeHtml(pc.description || '-')}</td>
              <td>
                <select class="dash-select" style="padding: 4px 8px; font-size: 0.8rem;" onchange="window.updatePcStatus(${pc.id}, this.value, '${pc.status}')">
                  <option value="available" ${pc.status === 'available' ? 'selected' : ''}>Вільний (available)</option>
                  <option value="occupied" ${pc.status === 'occupied' ? 'selected' : ''}>Зайнятий (occupied)</option>
                  <option value="maintenance" ${pc.status === 'maintenance' ? 'selected' : ''}>Обслуговування (maintenance)</option>
                  <option value="offline" ${pc.status === 'offline' ? 'selected' : ''}>Вимкнено (offline)</option>
                </select>
              </td>
              <td>
                <div class="action-btn-group">
                  <button type="button" class="btn-sm btn-action-subtle" onclick="window.openEditComputerModal(${JSON.stringify(pc).replace(/"/g, '&quot;')})">Редагувати</button>
                <button type="button" class="btn-sm btn-action-subtle btn-danger" onclick="window.deleteComputer(${pc.id})">Видалити</button>
                </div>
              </td>
            </tr>
          `;
        })
        .join('');
    } catch (err) {
      if (!silent) computersTbody.innerHTML = '<tr><td colspan="5" class="empty-state" style="color:var(--color-error);">Помилка завантаження ПК.</td></tr>';
    }
  }

  window.updatePcStatus = async function (id, newStatus, oldStatus) {
    const labels = { available: 'Вільний', occupied: 'Зайнятий', maintenance: 'На обслуговуванні', offline: 'Вимкнений' };
    const computerNumber = document.querySelector(`[data-pc-id="${CSS.escape(String(id))}"] td strong`)?.textContent || `#${id}`;
    openAdminAction({
      title: 'Змінити стан комп’ютера?',
      description: `${computerNumber}: ${labels[oldStatus] || oldStatus} → ${labels[newStatus] || newStatus}. Зміна буде збережена на сервері.`,
      confirmLabel: 'Так, змінити',
      run: async () => {
        const data = await requestAdminJson('/api/admin/computers', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: newStatus }),
        }, 'Не вдалося оновити статус комп’ютера.');
        return data.message;
      },
      onSuccess: loadComputers,
      onCancel: loadComputers,
    });
  };

  window.deleteComputer = function (id) {
    const computerNumber = document.querySelector(`[data-pc-id="${CSS.escape(String(id))}"] td strong`)?.textContent || `#${id}`;
    openAdminAction({
      title: 'Видалити комп’ютер?',
      description: `${computerNumber} буде видалено з клубу. Комп’ютер із пов’язаними бронюваннями видалити не можна.`,
      confirmLabel: 'Видалити',
      danger: true,
      run: async () => {
        const data = await requestAdminJson(`/api/admin/computers?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
        }, 'Не вдалося видалити комп’ютер.');
        return data.message;
      },
      onSuccess: loadComputers,
    });
  };

  const computerForm = document.getElementById('computer-form');
  const computerFormId = document.getElementById('computer-form-id');
  const computerModalTitle = document.getElementById('computer-modal-title');
  const compNumberInput = document.getElementById('comp-number-input');
  const compCategoryInput = document.getElementById('comp-category-input');
  const compStatusInput = document.getElementById('comp-status-input');
  const compDescInput = document.getElementById('comp-desc-input');
  const computerModalAlert = document.getElementById('computer-modal-alert');

  if (btnAddComputer) {
    btnAddComputer.addEventListener('click', () => {
      computerForm.reset();
      computerFormId.value = '';
      compNumberInput.value = 'PC-';
      if (computerModalTitle) computerModalTitle.textContent = 'Додати новий комп’ютер';
      compNumberInput.disabled = false;
      openModal('modal-computer');
      compNumberInput.focus();
      compNumberInput.setSelectionRange(compNumberInput.value.length, compNumberInput.value.length);
    });
  }

  window.openEditComputerModal = function (pc) {
    if (!computerForm) return;
    computerFormId.value = pc.id;
    if (computerModalTitle) computerModalTitle.textContent = `Редагування ПК ${pc.computerNumber}`;
    compNumberInput.value = pc.computerNumber;
    compNumberInput.disabled = true;
    compCategoryInput.value = pc.category;
    compStatusInput.value = pc.status;
    compDescInput.value = pc.description || '';
    openModal('modal-computer');
  };

  if (computerForm) {
    computerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = computerFormId.value;
      const isEdit = Boolean(id);
      const url = '/api/admin/computers';
      const method = isEdit ? 'PATCH' : 'POST';

      const payload = isEdit
        ? {
            id,
            category: compCategoryInput.value,
            status: compStatusInput.value,
            description: compDescInput.value.trim(),
          }
        : {
            computerNumber: compNumberInput.value.trim().toUpperCase(),
            category: compCategoryInput.value,
            status: compStatusInput.value,
            description: compDescInput.value.trim(),
          };

      try {
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          showFormAlert(computerModalAlert, data.message || 'Помилка збереження.', 'error');
          return;
        }

        showFormAlert(computerModalAlert, 'Збережено!', 'success');
        setTimeout(() => {
          closeModal('modal-computer');
          loadComputers();
        }, 600);
      } catch (err) {
        showFormAlert(computerModalAlert, 'Мережева помилка.', 'error');
      }
    });
  }

  if (filterPcSearch) filterPcSearch.addEventListener('input', debounce(loadComputers, 400));
  if (filterPcCategory) filterPcCategory.addEventListener('change', loadComputers);
  if (filterPcStatus) filterPcStatus.addEventListener('change', loadComputers);
  if (btnRefreshComputers) btnRefreshComputers.addEventListener('click', loadComputers);
  window.setInterval(() => {
    if (computersTbody && document.visibilityState === 'visible') loadComputers(true);
  }, 15000);

  const tariffsTbody = document.getElementById('tariffs-tbody');
  const tariffsCountBadge = document.getElementById('badge-tariffs-count');
  const btnRefreshTariffs = document.getElementById('btn-refresh-tariffs');
  const btnAddTariff = document.getElementById('btn-add-tariff');

  async function loadTariffs() {
    if (!tariffsTbody) return;
    tariffsTbody.innerHTML = '<tr><td colspan="7" class="empty-state">Завантаження тарифів...</td></tr>';

    try {
      const res = await fetch('/api/admin/tariffs');
      if (!res.ok) throw new Error('Failed to load tariffs');
      const data = await res.json();
      const docs = data.docs || [];

      if (tariffsCountBadge) tariffsCountBadge.textContent = String(data.totalDocs ?? docs.length);

      if (docs.length === 0) {
        tariffsTbody.innerHTML = '<tr><td colspan="7" class="empty-state">Тарифів не знайдено.</td></tr>';
        return;
      }

      tariffsTbody.innerHTML = docs
        .map((t) => {
          const activeBadge = t.isActive !== false ? '<span class="badge badge-active">Активний</span>' : '<span class="badge badge-inactive">Вимкнено</span>';
          const priceDisplay = t.pricePerHour != null ? `<strong>${t.pricePerHour} грн/год</strong>` : '-';

          return `
            <tr data-tariff-id="${t.id}">
              <td><strong>${escapeHtml(t.name)}</strong></td>
              <td>${escapeHtml(t.title || '-')}</td>
              <td><span class="badge" style="background:rgba(163,255,18,0.1); color:var(--accent-lime);">${escapeHtml(t.computerCategory === 'STREAMER' ? 'STREAM' : t.computerCategory || '-')}</span></td>
              <td>${escapeHtml(t.description || '-')}</td>
              <td>${priceDisplay}</td>
              <td>${activeBadge}</td>
              <td>
                <div class="action-btn-group">
                  <button type="button" class="btn-sm btn-action-subtle" onclick="window.openEditTariffModal(${JSON.stringify(t).replace(/"/g, '&quot;')})">Змінити</button>
                  <button type="button" class="btn-sm btn-action-danger" onclick="window.deleteTariff(${t.id})" title="\u0412\u0438\u0434\u0430\u043b\u0438\u0442\u0438">\u0412\u0438\u0434\u0430\u043b\u0438\u0442\u0438</button>
                  <button type="button" class="btn-sm ${t.isActive !== false ? 'btn-action-danger' : 'btn-action-primary'}" onclick="window.toggleTariffActive(${t.id}, ${Boolean(t.isActive !== false)})">
                    ${t.isActive !== false ? 'Вимкнути' : 'Увімкнути'}
                  </button>
                </div>
              </td>
            </tr>
          `;
        })
        .join('');
    } catch (err) {
      tariffsTbody.innerHTML = '<tr><td colspan="7" class="empty-state" style="color:var(--color-error);">Помилка завантаження тарифів.</td></tr>';
    }
  }

  window.toggleTariffActive = async function (id, currentActive) {
    const row = document.querySelector(`[data-tariff-id="${CSS.escape(String(id))}"]`);
    const tariffName = row?.querySelector('td strong')?.textContent || `#${id}`;
    const activating = !currentActive;
    openAdminAction({
      title: activating ? 'Увімкнути тариф?' : 'Вимкнути тариф?',
      description: `${tariffName}: ${activating ? 'тариф знову стане доступним для бронювання.' : 'нові бронювання за цим тарифом будуть недоступні.'}`,
      confirmLabel: activating ? 'Так, увімкнути' : 'Так, вимкнути',
      danger: !activating,
      run: async () => {
        const data = await requestAdminJson('/api/admin/tariffs', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, isActive: activating }),
        }, 'Не вдалося змінити активність тарифу.');
        return data.message;
      },
      onSuccess: loadTariffs,
    });
  };

  window.deleteTariff = function (id) {
    const row = document.querySelector(`[data-tariff-id="${CSS.escape(String(id))}"]`);
    const tariffName = row?.querySelector('td strong')?.textContent || `#${id}`;
    openAdminAction({
      title: '\u0412\u0438\u0434\u0430\u043b\u0438\u0442\u0438 \u0442\u0430\u0440\u0438\u0444?',
      description: `${tariffName}: \u0432\u0438\u0434\u0430\u043b\u0435\u043d\u043d\u044f \u043d\u0435\u043c\u043e\u0436\u043b\u0438\u0432\u0435, \u044f\u043a\u0449\u043e \u0454 \u043f\u043e\u0432\u2019\u044f\u0437\u0430\u043d\u0456 \u0431\u0440\u043e\u043d\u044e\u0432\u0430\u043d\u043d\u044f.`,
      confirmLabel: '\u0412\u0438\u0434\u0430\u043b\u0438\u0442\u0438',
      danger: true,
      run: async () => {
        const data = await requestAdminJson(`/api/admin/tariffs?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
        }, '\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u0432\u0438\u0434\u0430\u043b\u0438\u0442\u0438 \u0442\u0430\u0440\u0438\u0444.');
        return data.message;
      },
      onSuccess: loadTariffs,
    });
  };
  const tariffForm = document.getElementById('tariff-form');
  const tariffFormId = document.getElementById('tariff-form-id');
  const tariffModalTitle = document.getElementById('tariff-modal-title');
  const tariffNameInput = document.getElementById('tariff-name-input');
  const tariffTitleInput = document.getElementById('tariff-title-input');
  const tariffCatInput = document.getElementById('tariff-cat-input');
  const tariffPriceInput = document.getElementById('tariff-price-input');
  const tariffDescInput = document.getElementById('tariff-desc-input');
  const tariffActiveInput = document.getElementById('tariff-active-input');
  const tariffModalAlert = document.getElementById('tariff-modal-alert');

  if (btnAddTariff) {
    btnAddTariff.addEventListener('click', () => {
      tariffForm.reset();
      tariffFormId.value = '';
      if (tariffModalTitle) tariffModalTitle.textContent = 'Додати новий тариф';
      tariffNameInput.disabled = false;
      tariffActiveInput.checked = true;
      openModal('modal-tariff');
    });
  }

  window.openEditTariffModal = function (t) {
    if (!tariffForm) return;
    tariffFormId.value = t.id;
    if (tariffModalTitle) tariffModalTitle.textContent = `Редагування тарифу ${t.name}`;
    tariffNameInput.value = t.name;
    tariffNameInput.disabled = true;
    tariffTitleInput.value = t.title || '';
    tariffCatInput.value = t.computerCategory || 'STANDART';
    tariffPriceInput.value = t.pricePerHour != null ? t.pricePerHour : '';
    tariffDescInput.value = t.description || '';
    tariffActiveInput.checked = t.isActive !== false;
    openModal('modal-tariff');
  };

  if (tariffForm) {
    tariffForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = tariffFormId.value;
      const isEdit = Boolean(id);
      const url = '/api/admin/tariffs';
      const method = isEdit ? 'PATCH' : 'POST';
      const price = tariffPriceInput.value.trim() === '' ? null : Number(tariffPriceInput.value);

      const payload = isEdit
        ? {
            id,
            title: tariffTitleInput.value.trim(),
            computerCategory: tariffCatInput.value,
            pricePerHour: price,
            description: tariffDescInput.value.trim(),
            isActive: tariffActiveInput.checked,
          }
        : {
            name: tariffNameInput.value.trim().toUpperCase(),
            title: tariffTitleInput.value.trim(),
            computerCategory: tariffCatInput.value,
            pricePerHour: price,
            description: tariffDescInput.value.trim(),
            isActive: tariffActiveInput.checked,
          };

      try {
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          showFormAlert(tariffModalAlert, data.message || 'Помилка збереження тарифу.', 'error');
          return;
        }

        showFormAlert(tariffModalAlert, 'Збережено!', 'success');
        setTimeout(() => {
          closeModal('modal-tariff');
          loadTariffs();
        }, 600);
      } catch (err) {
        showFormAlert(tariffModalAlert, 'Мережева помилка.', 'error');
      }
    });
  }

  if (btnRefreshTariffs) btnRefreshTariffs.addEventListener('click', loadTariffs);

  const usersTbody = document.getElementById('users-tbody');
  const usersCountBadge = document.getElementById('badge-users-count');
  const filterUserSearch = document.getElementById('filter-user-search');
  const btnRefreshUsers = document.getElementById('btn-refresh-users');

  async function loadUsers() {
    if (!usersTbody) return;
    usersTbody.innerHTML = '<tr><td colspan="7" class="empty-state">Завантаження користувачів...</td></tr>';

    const params = new URLSearchParams();
    if (filterUserSearch && filterUserSearch.value.trim()) params.set('search', filterUserSearch.value.trim());

    try {
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load users');
      const data = await res.json();
      const docs = data.docs || [];

      if (usersCountBadge) usersCountBadge.textContent = String(data.totalDocs ?? docs.length);

      if (docs.length === 0) {
        usersTbody.innerHTML = '<tr><td colspan="7" class="empty-state">Користувачів не знайдено.</td></tr>';
        return;
      }

      usersTbody.innerHTML = docs
        .map((u) => {
          const isAdmin = u.role === 'admin';
          const isBlocked = Boolean(u.isBlocked);
          const roleBadge = isAdmin ? '<span class="badge badge-admin">Адміністратор</span>' : '<span class="badge badge-user">Користувач</span>';
          const statusBadge = isBlocked ? '<span class="badge badge-blocked">Заблоковано</span>' : '<span class="badge badge-active">Активний</span>';
          const dateStr = u.createdAt ? String(u.createdAt).slice(0, 10) : '-';

          return `
            <tr data-user-id="${u.id}">
              <td>#${u.id}</td>
              <td><strong>${escapeHtml(u.name || '-')}</strong></td>
              <td class="user-email-cell">${escapeHtml(u.email)}</td>
              <td>${roleBadge}</td>
              <td>${statusBadge}</td>
              <td>${dateStr}</td>
              <td>
                <div class="action-btn-group">
                  <button type="button" class="btn-sm ${isBlocked ? 'btn-action-primary' : 'btn-action-danger'}" onclick="window.updateUserBlocked(${u.id}, ${!isBlocked})">
                    ${isBlocked ? 'Розблокувати' : 'Заблокувати'}
                  </button>
                  <button type="button" class="btn-sm btn-action-danger" onclick="window.deleteUser(${u.id}, this.dataset.email)" data-email="${escapeHtml(u.email)}" title="Видалити користувача">Видалити</button>
                </div>
              </td>
            </tr>
          `;
        })
        .join('');
    } catch (err) {
      usersTbody.innerHTML = '<tr><td colspan="7" class="empty-state" style="color:var(--color-error);">Помилка завантаження користувачів.</td></tr>';
    }
  }

  window.updateUserBlocked = async function (id, shouldBlock) {
    const action = shouldBlock ? 'заблокувати' : 'розблокувати';
    openAdminAction({
      title: shouldBlock ? 'Заблокувати користувача?' : 'Розблокувати користувача?',
      description: `Ви справді бажаєте ${action} цього облікового запису? ${shouldBlock ? 'Після збереження користувач втратить доступ.' : 'Користувач знову зможе увійти.'}`,
      confirmLabel: shouldBlock ? 'Так, заблокувати' : 'Так, розблокувати',
      danger: shouldBlock,
      run: async () => {
        const data = await requestAdminJson('/api/admin/users', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, isBlocked: shouldBlock }),
        }, 'Не вдалося оновити статус облікового запису.');
        return data.message;
      },
      onSuccess: loadUsers,
    });
  };

  window.deleteUser = async function (id, email) {
    openAdminAction({
      title: 'Видалити обліковий запис?',
      description: `Видалити акаунт ${email}? Цю дію неможливо скасувати.`,
      confirmLabel: 'Так, видалити',
      danger: true,
      run: async () => {
        const data = await requestAdminJson(`/api/admin/users?id=${encodeURIComponent(id)}`, { method: 'DELETE' }, 'Не вдалося видалити користувача.');
        return data.message;
      },
      onSuccess: loadUsers,
    });
  };

  if (filterUserSearch) filterUserSearch.addEventListener('input', debounce(loadUsers, 400));
  if (btnRefreshUsers) btnRefreshUsers.addEventListener('click', loadUsers);

  function showFormAlert(alertEl, message, type = 'error') {
    if (!alertEl) return;
    alertEl.textContent = message;
    alertEl.className = `form-alert active ${type}`;
  }

  function debounce(fn, delay) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  loadBookings();
});

