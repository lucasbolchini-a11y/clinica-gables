require('dotenv').config();
const express    = require('express');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const cors       = require('cors');
const { v4: uuidv4 } = require('uuid');
const crypto     = require('crypto');
const { Resend } = require('resend');
const fs         = require('fs');
const path       = require('path');

const app    = express();
const resend = new Resend(process.env.RESEND_API_KEY);
const PORT       = 3001;
const JWT_SECRET   = 'cgables_clinic_secret_2024_change_in_production';
const ADMIN_USER   = process.env.ADMIN_USER  || 'admin';
const ADMIN_PASS   = process.env.ADMIN_PASS  || 'gables2024';
const BASE_URL     = process.env.BASE_URL    || `http://localhost:${PORT}`;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// ─── Data layer ───────────────────────────────────────────────────────────────
const USERS_FILE    = path.join(__dirname, 'data/users.json');
const BOOKINGS_FILE = path.join(__dirname, 'data/bookings.json');

function readJSON(file) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, '[]');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ─── Email ────────────────────────────────────────────────────────────────────
async function sendVerificationEmail(user, token) {
  const link = `${BASE_URL}/verify.html?token=${token}`;
  const html = `
<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>
body{font-family:'Georgia',serif;background:#F8F7F4;margin:0;padding:40px 20px}
.wrap{max-width:520px;margin:0 auto;background:#fff;border:1px solid #E3DDD5;border-radius:8px;overflow:hidden}
.header{background:#1A1916;padding:32px 40px}
.header-name{font-size:18px;font-weight:400;color:rgba(255,255,255,.9);letter-spacing:2px}
.header-sub{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,.4);margin-top:4px}
.body{padding:40px}.body h2{font-size:22px;font-weight:400;color:#1A1916;margin:0 0 12px}
.body p{font-size:14px;color:#716E68;line-height:1.7;margin:0 0 24px}
.btn{display:inline-block;background:#B5895A;color:#fff;text-decoration:none;padding:14px 32px;border-radius:4px;font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase}
.footer{padding:24px 40px;border-top:1px solid #F0EDE8;font-size:12px;color:#A09D97}
.link{word-break:break-all;color:#B5895A;font-size:12px;margin-top:20px}
</style></head><body>
<div class="wrap">
  <div class="header"><div class="header-name">Gables Clinic</div><div class="header-sub">Coral Gables · Miami</div></div>
  <div class="body">
    <h2>Verificá tu cuenta, ${user.nombre}.</h2>
    <p>Gracias por registrarte. Hacé clic en el botón para confirmar tu email y activar tu cuenta.</p>
    <a href="${link}" class="btn">Verificar mi cuenta</a>
    <p class="link">O copiá este link:<br>${link}</p>
    <p style="margin-top:24px;font-size:12px;color:#A09D97">Este link expira en 24 horas.</p>
  </div>
  <div class="footer">Gables Clinic · 2525 Ponce de Leon Blvd, Coral Gables, FL 33134</div>
</div></body></html>`;
  await resend.emails.send({ from: 'Gables Clinic <onboarding@resend.dev>', to: user.email, subject: 'Verificá tu cuenta — Gables Clinic', html });
  console.log(`✉️  Verificación enviada a ${user.email}`);
}

async function sendBookingStatusEmail(booking, user, estado) {
  const servicios = {
    botox:'Botox preventivo', fillers:'Fillers de ácido hialurónico',
    hidrafacial:'HydraFacial', biorevital:'Biorevitalización',
    peeling:'Peeling químico', prp:'PRP / Plasma rico en plaquetas',
    mesoterapia:'Mesoterapia facial', laser:'Laser rejuvenecimiento', consulta:'Consulta de evaluación'
  };
  const nombreServicio = servicios[booking.servicio] || booking.servicio;
  const esConfirmado   = estado === 'confirmado';
  const color          = esConfirmado ? '#2E7D5A' : '#C0392B';
  const titulo         = esConfirmado ? '¡Tu turno está confirmado!' : 'Tu solicitud fue rechazada';
  const mensaje        = esConfirmado
    ? `Tu turno para <strong>${nombreServicio}</strong> el <strong>${booking.fecha}</strong> a las <strong>${booking.hora} hs</strong> ha sido confirmado. Te esperamos en la clínica.`
    : `Lamentablemente no podemos confirmar tu solicitud para <strong>${nombreServicio}</strong> el <strong>${booking.fecha}</strong> a las <strong>${booking.hora} hs</strong>. ${booking.motivoRechazo ? `<br><br>Motivo: ${booking.motivoRechazo}` : 'Por favor reservá un nuevo turno con otra fecha u horario.'}`;

  const html = `
<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>
body{font-family:'Georgia',serif;background:#F8F7F4;margin:0;padding:40px 20px}
.wrap{max-width:520px;margin:0 auto;background:#fff;border:1px solid #E3DDD5;border-radius:8px;overflow:hidden}
.header{background:#1A1916;padding:32px 40px}
.header-name{font-size:18px;font-weight:400;color:rgba(255,255,255,.9);letter-spacing:2px}
.header-sub{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,.4);margin-top:4px}
.status-bar{background:${color};padding:12px 40px;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#fff}
.body{padding:40px}.body h2{font-size:22px;font-weight:400;color:#1A1916;margin:0 0 16px}
.body p{font-size:14px;color:#716E68;line-height:1.7;margin:0 0 16px}
.detail{background:#F8F7F4;border-radius:6px;padding:16px 20px;margin:20px 0;font-size:13px;color:#1A1916}
.btn{display:inline-block;background:#B5895A;color:#fff;text-decoration:none;padding:14px 32px;border-radius:4px;font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase}
.footer{padding:24px 40px;border-top:1px solid #F0EDE8;font-size:12px;color:#A09D97}
</style></head><body>
<div class="wrap">
  <div class="header"><div class="header-name">Gables Clinic</div><div class="header-sub">Coral Gables · Miami</div></div>
  <div class="status-bar">${esConfirmado ? '✓ Turno confirmado' : '✗ Solicitud no disponible'}</div>
  <div class="body">
    <h2>${titulo}</h2>
    <p>Hola ${user.nombre},</p>
    <p>${mensaje}</p>
    <div class="detail">
      <strong>${nombreServicio}</strong><br>
      📅 ${booking.fecha} · 🕐 ${booking.hora} hs
    </div>
    <a href="${BASE_URL}/dashboard.html" class="btn">Ver mis turnos</a>
  </div>
  <div class="footer">Gables Clinic · 2525 Ponce de Leon Blvd, Coral Gables, FL 33134 · +1 (305) 555-0000</div>
</div></body></html>`;

  await resend.emails.send({
    from: 'Gables Clinic <onboarding@resend.dev>',
    to: user.email,
    subject: esConfirmado ? `✓ Turno confirmado — ${nombreServicio}` : `Tu solicitud no pudo confirmarse — ${nombreServicio}`,
    html
  });
  console.log(`✉️  Email de ${estado} enviado a ${user.email}`);
}

// ─── Auth middleware (usuarios) ───────────────────────────────────────────────
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer '))
    return res.status(401).json({ error: 'Token requerido' });
  try {
    req.user = jwt.verify(header.split(' ')[1], JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

// ─── Auth middleware (admin) ──────────────────────────────────────────────────
function authenticateAdmin(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer '))
    return res.status(401).json({ error: 'Token requerido' });
  try {
    const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET);
    if (!decoded.isAdmin) return res.status(403).json({ error: 'Acceso denegado' });
    req.admin = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

// ════════════════════════════════════════════════════════════
// AUTH — USUARIOS
// ════════════════════════════════════════════════════════════

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  const { nombre, apellido, email, telefono, password } = req.body;
  if (!nombre || !apellido || !email || !password)
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });

  const users      = readJSON(USERS_FILE);
  const existingIdx = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());

  if (existingIdx !== -1 && users[existingIdx].verified)
    return res.status(409).json({ error: 'Ya existe una cuenta con ese email. Ingresá o usá otro.' });

  const hashed              = await bcrypt.hash(password, 10);
  const verificationToken   = crypto.randomBytes(32).toString('hex');
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  let user;
  if (existingIdx !== -1 && !users[existingIdx].verified) {
    users[existingIdx] = { ...users[existingIdx], nombre, apellido, telefono: telefono || '', password: hashed, verificationToken, verificationExpires };
    user = users[existingIdx];
  } else {
    user = { id: uuidv4(), nombre, apellido, email: email.toLowerCase(), telefono: telefono || '', password: hashed,
             verified: false, verificationToken, verificationExpires, createdAt: new Date().toISOString() };
    users.push(user);
  }
  writeJSON(USERS_FILE, users);

  // ── Sin verificación de email para portfolio ──
  // Marcar como verificado directamente y hacer login automático
  const idx = users.findIndex(u => u.id === user.id);
  users[idx].verified            = true;
  users[idx].verificationToken   = null;
  users[idx].verificationExpires = null;
  writeJSON(USERS_FILE, users);

  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  res.status(201).json({
    token,
    user: { id: user.id, nombre: user.nombre, apellido: user.apellido, email: user.email, telefono: user.telefono }
  });
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email y contraseña son obligatorios' });

  const users = readJSON(USERS_FILE);
  const user  = users.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.status(401).json({ error: 'Credenciales incorrectas' });

  // ── Verificación desactivada para portfolio ──
  // if (!user.verified) return res.status(403).json({ error: 'Verificá tu email antes de ingresar.', code: 'EMAIL_NOT_VERIFIED', email: user.email });

  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, nombre: user.nombre, apellido: user.apellido, email: user.email, telefono: user.telefono } });
});

// GET /api/auth/me
app.get('/api/auth/me', authenticate, (req, res) => {
  const users = readJSON(USERS_FILE);
  const user  = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ id: user.id, nombre: user.nombre, apellido: user.apellido, email: user.email, telefono: user.telefono });
});

// GET /api/auth/verify/:token
app.get('/api/auth/verify/:token', (req, res) => {
  const users = readJSON(USERS_FILE);
  const idx   = users.findIndex(u => u.verificationToken === req.params.token);
  if (idx === -1) return res.status(400).json({ error: 'Link inválido.' });
  if (new Date() > new Date(users[idx].verificationExpires))
    return res.status(400).json({ error: 'El link expiró.' });
  users[idx].verified = true; users[idx].verificationToken = null; users[idx].verificationExpires = null;
  writeJSON(USERS_FILE, users);
  res.json({ message: 'Email verificado.' });
});

// POST /api/auth/resend-verification
app.post('/api/auth/resend-verification', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requerido' });
  const users = readJSON(USERS_FILE);
  const idx   = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
  if (idx === -1)          return res.status(404).json({ error: 'No encontramos esa cuenta.' });
  if (users[idx].verified) return res.status(400).json({ error: 'Esta cuenta ya está verificada.' });
  users[idx].verificationToken   = crypto.randomBytes(32).toString('hex');
  users[idx].verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  writeJSON(USERS_FILE, users);
  try { await sendVerificationEmail(users[idx], users[idx].verificationToken); } catch (e) { console.error(e.message); }
  res.json({ message: 'Email reenviado.' });
});

// ════════════════════════════════════════════════════════════
// AUTH — ADMIN
// ════════════════════════════════════════════════════════════

// POST /api/admin/login
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username !== ADMIN_USER || password !== ADMIN_PASS)
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  const token = jwt.sign({ isAdmin: true, username }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token });
});

// ════════════════════════════════════════════════════════════
// BOOKINGS — USUARIO
// ════════════════════════════════════════════════════════════

// GET /api/bookings
app.get('/api/bookings', authenticate, (req, res) => {
  const bookings = readJSON(BOOKINGS_FILE);
  res.json(bookings.filter(b => b.userId === req.user.id)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora)));
});

// POST /api/bookings — crea solicitud PENDIENTE
app.post('/api/bookings', authenticate, (req, res) => {
  const { servicio, fecha, hora, notas } = req.body;
  if (!servicio || !fecha || !hora)
    return res.status(400).json({ error: 'Servicio, fecha y hora son obligatorios' });

  const bookings = readJSON(BOOKINGS_FILE);
  // Bloquear si ya existe turno confirmado en ese horario
  if (bookings.find(b => b.fecha === fecha && b.hora === hora && b.estado === 'confirmado'))
    return res.status(409).json({ error: 'Ese horario ya tiene un turno confirmado. Elegí otro.' });

  const booking = {
    id: uuidv4(), userId: req.user.id, servicio, fecha, hora,
    notas: notas || '', estado: 'pendiente', createdAt: new Date().toISOString()
  };
  bookings.push(booking);
  writeJSON(BOOKINGS_FILE, bookings);
  res.status(201).json(booking);
});

// PATCH /api/bookings/:id/cancel
app.patch('/api/bookings/:id/cancel', authenticate, (req, res) => {
  const bookings = readJSON(BOOKINGS_FILE);
  const idx = bookings.findIndex(b => b.id === req.params.id && b.userId === req.user.id);
  if (idx === -1) return res.status(404).json({ error: 'Turno no encontrado' });
  if (bookings[idx].estado === 'confirmado')
    return res.status(400).json({ error: 'No podés cancelar un turno ya confirmado. Contactanos por WhatsApp.' });
  bookings[idx].estado = 'cancelado';
  writeJSON(BOOKINGS_FILE, bookings);
  res.json(bookings[idx]);
});

// DELETE /api/bookings/:id
app.delete('/api/bookings/:id', authenticate, (req, res) => {
  let bookings = readJSON(BOOKINGS_FILE);
  const idx = bookings.findIndex(b => b.id === req.params.id && b.userId === req.user.id);
  if (idx === -1) return res.status(404).json({ error: 'Turno no encontrado' });
  bookings.splice(idx, 1);
  writeJSON(BOOKINGS_FILE, bookings);
  res.json({ message: 'Turno eliminado' });
});

// GET /api/availability
app.get('/api/availability', authenticate, (req, res) => {
  const { fecha } = req.query;
  if (!fecha) return res.status(400).json({ error: 'Fecha requerida' });
  const allSlots = ['09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30'];
  const bookings = readJSON(BOOKINGS_FILE);
  const occupied = bookings.filter(b => b.fecha === fecha && b.estado === 'confirmado').map(b => b.hora);
  res.json({ fecha, available: allSlots.filter(s => !occupied.includes(s)) });
});

// ════════════════════════════════════════════════════════════
// BOOKINGS — ADMIN
// ════════════════════════════════════════════════════════════

// GET /api/admin/bookings — todas las reservas con info del usuario
app.get('/api/admin/bookings', authenticateAdmin, (req, res) => {
  const bookings = readJSON(BOOKINGS_FILE);
  const users    = readJSON(USERS_FILE);
  const { estado } = req.query;

  let result = bookings.map(b => {
    const user = users.find(u => u.id === b.userId);
    return {
      ...b,
      usuario: user ? { nombre: user.nombre, apellido: user.apellido, email: user.email, telefono: user.telefono } : null
    };
  });

  if (estado) result = result.filter(b => b.estado === estado);
  result.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora));
  res.json(result);
});

// GET /api/admin/stats
app.get('/api/admin/stats', authenticateAdmin, (req, res) => {
  const bookings = readJSON(BOOKINGS_FILE);
  const users    = readJSON(USERS_FILE);
  res.json({
    total:      bookings.length,
    pendientes: bookings.filter(b => b.estado === 'pendiente').length,
    confirmados: bookings.filter(b => b.estado === 'confirmado').length,
    cancelados:  bookings.filter(b => b.estado === 'cancelado').length,
    rechazados:  bookings.filter(b => b.estado === 'rechazado').length,
    usuarios:    users.filter(u => u.verified).length
  });
});

// PATCH /api/admin/bookings/:id — confirmar o rechazar
app.patch('/api/admin/bookings/:id', authenticateAdmin, async (req, res) => {
  const { estado, motivoRechazo } = req.body;
  if (!['confirmado', 'rechazado'].includes(estado))
    return res.status(400).json({ error: 'Estado debe ser "confirmado" o "rechazado"' });

  const bookings = readJSON(BOOKINGS_FILE);
  const users    = readJSON(USERS_FILE);
  const idx      = bookings.findIndex(b => b.id === req.params.id);

  if (idx === -1) return res.status(404).json({ error: 'Turno no encontrado' });

  bookings[idx].estado        = estado;
  bookings[idx].motivoRechazo = motivoRechazo || null;
  bookings[idx].gestionadoAt  = new Date().toISOString();
  writeJSON(BOOKINGS_FILE, bookings);

  // Enviar email de notificación al paciente
  const user = users.find(u => u.id === bookings[idx].userId);
  if (user) {
    try { await sendBookingStatusEmail(bookings[idx], user, estado); } catch (e) { console.error('Email error:', e.message); }
  }

  res.json(bookings[idx]);
});

// ─── Fallback ─────────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✓ Servidor en http://localhost:${PORT}`);
  console.log(`  Admin: usuario="${ADMIN_USER}" | contraseña="${ADMIN_PASS}"\n`);
});