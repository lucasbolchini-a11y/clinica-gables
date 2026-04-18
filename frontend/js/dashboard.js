/* ════════════════════════════════════════════════════════════
   DASHBOARD.JS — User dashboard logic
   ════════════════════════════════════════════════════════════ */

const SERVICIOS = [
  { value: 'botox',         label: 'Botox preventivo',          dur: '30 min' },
  { value: 'fillers',       label: 'Fillers de ácido hialurónico', dur: '45 min' },
  { value: 'hidrafacial',   label: 'HydraFacial',                dur: '60 min' },
  { value: 'biorevital',    label: 'Biorevitalización',          dur: '40 min' },
  { value: 'peeling',       label: 'Peeling químico',            dur: '45 min' },
  { value: 'prp',           label: 'PRP / Plasma rico en plaquetas', dur: '60 min' },
  { value: 'mesoterapia',   label: 'Mesoterapia facial',         dur: '40 min' },
  { value: 'laser',         label: 'Laser rejuvenecimiento',     dur: '50 min' },
  { value: 'consulta',      label: 'Consulta de evaluación',     dur: '30 min' }
];

document.addEventListener('DOMContentLoaded', () => {
  // ─── Auth guard ─────────────────────────────────────────
  if (!Auth.isLoggedIn()) {
    window.location.href = '/login.html?redirect=dashboard';
    return;
  }

  const user = Auth.getUser();
  initDashboard(user);
});

async function initDashboard(user) {
  // Populate user info in sidebar
  const initials = ((user.nombre?.[0] || '') + (user.apellido?.[0] || '')).toUpperCase();
  setEl('sidebar-avatar', initials);
  setEl('sidebar-name', `${user.nombre} ${user.apellido}`);
  setEl('sidebar-email', user.email);
  setEl('dash-greeting', getGreeting(user.nombre));

  // Logout button
  document.querySelectorAll('[data-logout]').forEach(btn => {
    btn.addEventListener('click', Auth.logout);
  });

  // Populate services dropdown
  const select = document.getElementById('booking-service');
  if (select) {
    SERVICIOS.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.value;
      opt.textContent = `${s.label} (${s.dur})`;
      select.appendChild(opt);
    });
  }

  // Date input: min = today
  const dateInput = document.getElementById('booking-date');
  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.min = today;
    dateInput.addEventListener('change', handleDateChange);
  }

  // Tabs
  initTabs();

  // Load bookings
  await loadBookings();

  // Booking form
  const form = document.getElementById('booking-form');
  if (form) {
    form.addEventListener('submit', handleBookingSubmit);
  }
}

// ─── Load & render bookings ──────────────────────────────
async function loadBookings() {
  const upcomingEl = document.getElementById('upcoming-list');
  const pastEl     = document.getElementById('past-list');
  const countEl    = document.getElementById('stat-upcoming');
  const totalEl    = document.getElementById('stat-total');

  if (!upcomingEl) return;

  setLoadingList(upcomingEl);
  if (pastEl) setLoadingList(pastEl);

  try {
    const bookings = await apiFetch('/bookings');
    const today = new Date().toISOString().split('T')[0];

    const upcoming = bookings.filter(b => b.fecha >= today && b.estado !== 'cancelado');
    const past     = bookings.filter(b => b.fecha < today || b.estado === 'cancelado');

    if (countEl) countEl.textContent = upcoming.length;
    if (totalEl) totalEl.textContent = bookings.length;

    renderBookingList(upcomingEl, upcoming, true);
    if (pastEl) renderBookingList(pastEl, past, false);

    // Next appointment label
    const nextEl = document.getElementById('stat-next');
    if (nextEl && upcoming.length > 0) {
      const next = upcoming.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora))[0];
      nextEl.textContent = `${formatDateShort(next.fecha).full} a las ${next.hora}`;
    } else if (nextEl) {
      nextEl.textContent = 'Sin turnos próximos';
    }
  } catch (err) {
    showToast('Error al cargar turnos', err.message, 'error');
    upcomingEl.innerHTML = '<p style="color:var(--text-muted);font-size:.85rem;">No se pudieron cargar los turnos.</p>';
  }
}

function setLoadingList(el) {
  el.innerHTML = `<div class="slots-loading"><span class="spinner spinner--dark"></span> Cargando turnos...</div>`;
}

function renderBookingList(container, bookings, showActions) {
  if (!bookings.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">📅</div>
        <p>${showActions ? 'No tenés turnos programados. Agendá uno abajo.' : 'No hay turnos anteriores.'}</p>
        ${showActions ? `<a href="#nueva-reserva" class="btn btn--accent btn--sm">Reservar ahora</a>` : ''}
      </div>`;
    return;
  }

  container.innerHTML = bookings.map(b => {
    const d = formatDateShort(b.fecha);
    const service = SERVICIOS.find(s => s.value === b.servicio);
    const label = service ? service.label : b.servicio;
    const isCancelled = b.estado === 'cancelado';

    return `
      <div class="booking-card ${isCancelled ? 'booking-card--cancelled' : ''}" id="booking-${b.id}">
        <div class="booking-card__date">
          <span class="booking-card__day">${d.day}</span>
          <span class="booking-card__month">${d.month}</span>
        </div>
        <div class="booking-card__info">
          <div class="booking-card__service">${label}</div>
          <div class="booking-card__time">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            ${b.hora} hs · ${d.full}
            ${b.notas ? `· <em style="font-size:.75rem;">${b.notas}</em>` : ''}
          </div>
        </div>
        <div class="booking-card__actions">
          <span class="badge badge--${isCancelled ? 'cancelled' : 'success'}">${isCancelled ? 'Cancelado' : 'Confirmado'}</span>
          ${showActions && !isCancelled ? `<button class="btn btn--outline btn--sm" onclick="cancelBooking('${b.id}')">Cancelar</button>` : ''}
        </div>
      </div>`;
  }).join('');
}

// ─── Cancel booking ───────────────────────────────────────
async function cancelBooking(id) {
  if (!confirm('¿Cancelar este turno?')) return;
  try {
    await apiFetch(`/bookings/${id}/cancel`, { method: 'PATCH' });
    showToast('Turno cancelado', 'Podés reagendar cuando quieras.', 'default');
    await loadBookings();
  } catch (err) {
    showToast('Error', err.message, 'error');
  }
}

// ─── Handle date change → fetch slots ────────────────────
async function handleDateChange() {
  const date = document.getElementById('booking-date').value;
  const slotsContainer = document.getElementById('slots-container');
  const selectedHourInput = document.getElementById('selected-hora');

  if (!date || !slotsContainer) return;
  if (selectedHourInput) selectedHourInput.value = '';

  // Disable weekends
  const d = new Date(date + 'T00:00:00');
  if (d.getDay() === 0 || d.getDay() === 6) {
    slotsContainer.innerHTML = `<p style="font-size:.82rem;color:var(--text-muted);">No atendemos los fines de semana. Elegí un día hábil.</p>`;
    return;
  }

  slotsContainer.innerHTML = `<div class="slots-loading"><span class="spinner spinner--dark"></span> Verificando disponibilidad...</div>`;

  try {
    const data = await apiFetch(`/availability?fecha=${date}`);
    if (!data.available.length) {
      slotsContainer.innerHTML = `<p style="font-size:.82rem;color:var(--text-muted);">No quedan turnos disponibles para ese día. Probá con otra fecha.</p>`;
      return;
    }
    renderSlots(slotsContainer, data.available, selectedHourInput);
  } catch {
    slotsContainer.innerHTML = `<p style="font-size:.82rem;color:var(--text-light);">Error al verificar horarios.</p>`;
  }
}

function renderSlots(container, available, hiddenInput) {
  const allSlots = [
    '09:00','09:30','10:00','10:30','11:00','11:30',
    '12:00','12:30','14:00','14:30','15:00','15:30',
    '16:00','16:30','17:00','17:30'
  ];
  container.innerHTML = `<div class="slots-grid">` +
    allSlots.map(slot => {
      const free = available.includes(slot);
      return `<button type="button" class="slot-btn ${free ? '' : 'taken'}"
        ${free ? `onclick="selectSlot(this,'${slot}')"` : 'disabled'}>${slot}</button>`;
    }).join('') +
    `</div>`;
}

window.selectSlot = function(btn, hora) {
  document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  const input = document.getElementById('selected-hora');
  if (input) input.value = hora;
};

// ─── Handle booking form submit ───────────────────────────
async function handleBookingSubmit(e) {
  e.preventDefault();
  const btn = e.target.querySelector('[type="submit"]');
  const servicio = document.getElementById('booking-service').value;
  const fecha    = document.getElementById('booking-date').value;
  const hora     = document.getElementById('selected-hora').value;
  const notas    = document.getElementById('booking-notas')?.value || '';
  const errEl    = document.getElementById('booking-error');

  if (errEl) errEl.textContent = '';

  if (!servicio) { if (errEl) errEl.textContent = 'Seleccioná un servicio.'; return; }
  if (!fecha)    { if (errEl) errEl.textContent = 'Seleccioná una fecha.'; return; }
  if (!hora)     { if (errEl) errEl.textContent = 'Seleccioná un horario.'; return; }

  setLoading(btn, true);
  try {
    await apiFetch('/bookings', {
      method: 'POST',
      body: JSON.stringify({ servicio, fecha, hora, notas })
    });
    showToast('Turno confirmado', `${fecha} a las ${hora} hs`, 'success');
    e.target.reset();
    document.getElementById('slots-container').innerHTML = '';
    document.getElementById('selected-hora').value = '';
    await loadBookings();
    // Switch to upcoming tab
    document.querySelector('[data-tab="upcoming"]')?.click();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    if (errEl) errEl.textContent = err.message;
    else showToast('Error', err.message, 'error');
  } finally {
    setLoading(btn, false);
  }
}

// ─── Tabs ─────────────────────────────────────────────────
function initTabs() {
  const btns = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.tab-panel');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-tab');
      btns.forEach(b => b.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${target}`)?.classList.add('active');
    });
  });
}

// ─── Helpers ──────────────────────────────────────────────
function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function getGreeting(name) {
  const h = new Date().getHours();
  const g = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  return `${g}, ${name}`;
}

// expose for nav cancel button
window.cancelBooking = cancelBooking;
