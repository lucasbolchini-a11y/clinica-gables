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
const JWT_SECRET = 'cgables_clinic_secret_2024_change_in_production';
const BASE_URL   = process.env.BASE_URL || `http://localhost:${PORT}`;

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// ─── Data layer ──────────────────────────────────────────────────────────────
const USERS_FILE    = path.join(__dirname, 'data/users.json');
const BOOKINGS_FILE = path.join(__dirname, 'data/bookings.json');

function readJSON(file) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, '[]');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ─── Email ───────────────────────────────────────────────────────────────────
async function sendVerificationEmail(user, token) {
  const link = `${BASE_URL}/verify.html?token=${token}`;

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Georgia', serif; background: #F8F7F4; margin: 0; padding: 40px 20px; }
    .wrap { max-width: 520px; margin: 0 auto; background: #fff; border: 1px solid #E3DDD5; border-radius: 8px; overflow: hidden; }
    .header { background: #1A1916; padding: 32px 40px; }
    .header-name { font-size: 18px; font-weight: 400; color: rgba(255,255,255,.9); letter-spacing: 2px; }
    .header-sub { font-size: 10px; letter-spacing: 3px; text-transform: uppercase; color: rgba(255,255,255,.4); margin-top: 4px; }
    .body { padding: 40px; }
    .body h2 { font-size: 22px; font-weight: 400; color: #1A1916; margin: 0 0 12px; }
    .body p { font-size: 14px; color: #716E68; line-height: 1.7; margin: 0 0 24px; }
    .btn { display: inline-block; background: #B5895A; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 4px; font-size: 12px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; }
    .footer { padding: 24px 40px; border-top: 1px solid #F0EDE8; font-size: 12px; color: #A09D97; }
    .link { word-break: break-all; color: #B5895A; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <div class="header-name">Gables Clinic</div>
      <div class="header-sub">Coral Gables · Miami</div>
    </div>
    <div class="body">
      <h2>Verificá tu cuenta, ${user.nombre}.</h2>
      <p>Gracias por registrarte. Hacé clic en el botón para confirmar tu email y activar tu cuenta.</p>
      <a href="${link}" class="btn">Verificar mi cuenta</a>
      <p class="link">O copiá este link en tu navegador:<br>${link}</p>
      <p style="margin-top:24px;font-size:12px;color:#A09D97">Este link expira en 24 horas. Si no creaste una cuenta en Gables Clinic, ignorá este email.</p>
    </div>
    <div class="footer">Gables Clinic · 2525 Ponce de Leon Blvd, Coral Gables, FL 33134</div>
  </div>
</body>
</html>`;

  await resend.emails.send({
    from: 'Gables Clinic <onboarding@resend.dev>',
    to: user.email,
    subject: 'Verificá tu cuenta — Gables Clinic',
    html
  });

  console.log(`✉️  Email enviado a ${user.email}`);
}

// ─── Auth middleware ─────────────────────────────────────────────────────────
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

// ─── POST /api/auth/register ─────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  const { nombre, apellido, email, telefono, password } = req.body;

  if (!nombre || !apellido || !email || !password)
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });

  const users = readJSON(USERS_FILE);
  const existingIdx = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());

  // Email ya registrado y verificado → error normal
  if (existingIdx !== -1 && users[existingIdx].verified)
    return res.status(409).json({ error: 'Ya existe una cuenta con ese email. Ingresá o usá otro.' });

  const hashed              = await bcrypt.hash(password, 10);
  const verificationToken   = crypto.randomBytes(32).toString('hex');
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  let user;

  if (existingIdx !== -1 && !users[existingIdx].verified) {
    // Email existe pero no verificado → actualizar datos y reenviar email
    users[existingIdx] = {
      ...users[existingIdx],
      nombre,
      apellido,
      telefono: telefono || '',
      password: hashed,
      verificationToken,
      verificationExpires
    };
    user = users[existingIdx];
  } else {
    // Email nuevo → crear usuario
    user = {
      id: uuidv4(),
      nombre,
      apellido,
      email: email.toLowerCase(),
      telefono: telefono || '',
      password: hashed,
      verified: false,
      verificationToken,
      verificationExpires,
      createdAt: new Date().toISOString()
    };
    users.push(user);
  }

  writeJSON(USERS_FILE, users);

  try {
    await sendVerificationEmail(user, verificationToken);
  } catch (err) {
    console.error('Error enviando email:', err.message);
  }

  res.status(201).json({ message: 'Cuenta creada. Revisá tu email para verificarla.' });
});

// ─── GET /api/auth/verify/:token ─────────────────────────────────────────────
app.get('/api/auth/verify/:token', (req, res) => {
  const users = readJSON(USERS_FILE);
  const idx   = users.findIndex(u => u.verificationToken === req.params.token);

  if (idx === -1)
    return res.status(400).json({ error: 'El link de verificación no es válido.' });

  if (new Date() > new Date(users[idx].verificationExpires))
    return res.status(400).json({ error: 'El link expiró. Solicitá uno nuevo.' });

  users[idx].verified            = true;
  users[idx].verificationToken   = null;
  users[idx].verificationExpires = null;
  writeJSON(USERS_FILE, users);

  res.json({ message: 'Email verificado correctamente.' });
});

// ─── POST /api/auth/resend-verification ──────────────────────────────────────
app.post('/api/auth/resend-verification', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requerido' });

  const users = readJSON(USERS_FILE);
  const idx   = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());

  if (idx === -1)       return res.status(404).json({ error: 'No encontramos esa cuenta.' });
  if (users[idx].verified) return res.status(400).json({ error: 'Esta cuenta ya está verificada.' });

  users[idx].verificationToken   = crypto.randomBytes(32).toString('hex');
  users[idx].verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  writeJSON(USERS_FILE, users);

  try {
    await sendVerificationEmail(users[idx], users[idx].verificationToken);
  } catch (err) {
    console.error('Error reenviando email:', err.message);
  }

  res.json({ message: 'Email de verificación reenviado.' });
});

// ─── POST /api/auth/login ────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email y contraseña son obligatorios' });

  const users = readJSON(USERS_FILE);
  const user  = users.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.status(401).json({ error: 'Credenciales incorrectas' });

  if (!user.verified)
    return res.status(403).json({
      error: 'Verificá tu email antes de ingresar.',
      code: 'EMAIL_NOT_VERIFIED',
      email: user.email
    });

  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

  res.json({
    token,
    user: { id: user.id, nombre: user.nombre, apellido: user.apellido, email: user.email, telefono: user.telefono }
  });
});

// ─── GET /api/auth/me ────────────────────────────────────────────────────────
app.get('/api/auth/me', authenticate, (req, res) => {
  const users = readJSON(USERS_FILE);
  const user  = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ id: user.id, nombre: user.nombre, apellido: user.apellido, email: user.email, telefono: user.telefono });
});

// ─── Bookings ────────────────────────────────────────────────────────────────
app.get('/api/bookings', authenticate, (req, res) => {
  const bookings = readJSON(BOOKINGS_FILE);
  res.json(bookings.filter(b => b.userId === req.user.id)
    .sort((a, b) => a.fecha.localeCompare(b.fecha)));
});

app.post('/api/bookings', authenticate, (req, res) => {
  const { servicio, fecha, hora, notas } = req.body;
  if (!servicio || !fecha || !hora)
    return res.status(400).json({ error: 'Servicio, fecha y hora son obligatorios' });

  const bookings = readJSON(BOOKINGS_FILE);
  if (bookings.find(b => b.fecha === fecha && b.hora === hora && b.estado !== 'cancelado'))
    return res.status(409).json({ error: 'Ese horario ya no está disponible. Elegí otro.' });

  const booking = {
    id: uuidv4(), userId: req.user.id, servicio, fecha, hora,
    notas: notas || '', estado: 'confirmado', createdAt: new Date().toISOString()
  };
  bookings.push(booking);
  writeJSON(BOOKINGS_FILE, bookings);
  res.status(201).json(booking);
});

app.patch('/api/bookings/:id/cancel', authenticate, (req, res) => {
  const bookings = readJSON(BOOKINGS_FILE);
  const idx = bookings.findIndex(b => b.id === req.params.id && b.userId === req.user.id);
  if (idx === -1) return res.status(404).json({ error: 'Turno no encontrado' });
  bookings[idx].estado = 'cancelado';
  writeJSON(BOOKINGS_FILE, bookings);
  res.json(bookings[idx]);
});

app.delete('/api/bookings/:id', authenticate, (req, res) => {
  let bookings = readJSON(BOOKINGS_FILE);
  const idx = bookings.findIndex(b => b.id === req.params.id && b.userId === req.user.id);
  if (idx === -1) return res.status(404).json({ error: 'Turno no encontrado' });
  bookings.splice(idx, 1);
  writeJSON(BOOKINGS_FILE, bookings);
  res.json({ message: 'Turno eliminado' });
});

app.get('/api/availability', authenticate, (req, res) => {
  const { fecha } = req.query;
  if (!fecha) return res.status(400).json({ error: 'Fecha requerida' });
  const allSlots = ['09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30'];
  const bookings = readJSON(BOOKINGS_FILE);
  const occupied = bookings.filter(b => b.fecha === fecha && b.estado !== 'cancelado').map(b => b.hora);
  res.json({ fecha, available: allSlots.filter(s => !occupied.includes(s)) });
});

// ─── Fallback ────────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✓ Servidor en http://localhost:${PORT}`);
});