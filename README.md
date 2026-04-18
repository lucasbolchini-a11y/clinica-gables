# Gables Clinic — Web App

Sitio web multipágina con sistema de reservas para clínica estética en Coral Gables, Miami.

---

## Stack

- **Frontend**: HTML, CSS, JavaScript vanilla
- **Backend**: Node.js + Express
- **Auth**: JWT (jsonwebtoken) + bcryptjs
- **DB**: JSON local (`backend/data/`)

---

## Estructura

```
clinica-gables/
├── backend/
│   ├── server.js          # API Express
│   ├── package.json
│   └── data/
│       ├── users.json     # Usuarios (auto-generado)
│       └── bookings.json  # Reservas (auto-generado)
└── frontend/
    ├── index.html         # Inicio
    ├── servicios.html     # Tratamientos
    ├── about.html         # Nosotros
    ├── contacto.html      # Contacto
    ├── login.html         # Login
    ├── signup.html        # Registro
    ├── dashboard.html     # Panel del usuario
    ├── css/
    │   ├── style.css      # Design system global
    │   └── dashboard.css  # Estilos del dashboard
    └── js/
        ├── main.js        # Utilidades, nav, auth helpers
        ├── auth.js        # Lógica de login/signup
        └── dashboard.js   # Lógica del dashboard
```

---

## Setup

### 1. Instalar dependencias del backend

```bash
cd backend
npm install
```

### 2. Iniciar el servidor

```bash
npm start
# o en modo dev:
npm run dev
```

El servidor corre en `http://localhost:3001` y sirve tanto la API como el frontend.

### 3. Acceder

Abrí el navegador en:
```
http://localhost:3001/index.html
```

---

## API Endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/auth/register` | No | Registro de usuario |
| POST | `/api/auth/login` | No | Login |
| GET  | `/api/auth/me` | Sí | Perfil del usuario actual |
| GET  | `/api/bookings` | Sí | Turnos del usuario |
| POST | `/api/bookings` | Sí | Crear turno |
| PATCH | `/api/bookings/:id/cancel` | Sí | Cancelar turno |
| DELETE | `/api/bookings/:id` | Sí | Eliminar turno |
| GET  | `/api/availability?fecha=YYYY-MM-DD` | Sí | Horarios disponibles |

---

## Producción

Para usar en producción:

1. Cambiar `JWT_SECRET` en `server.js` por una clave segura
2. Reemplazar `JSON storage` por PostgreSQL o MongoDB
3. Agregar HTTPS (nginx + certbot)
4. Cambiar `cors({ origin: '*' })` por el dominio real
5. Agregar variables de entorno con `.env`

---

## Personalización

- Colores: Variables CSS en `frontend/css/style.css` (`:root`)
- Servicios: Array `SERVICIOS` en `frontend/js/dashboard.js`
- Horarios: Array `allSlots` en `backend/server.js`
- Número de WhatsApp: Buscar `wa.me/13055550000` y reemplazar
- Email/teléfono de contacto: En `index.html`, `about.html`, `contacto.html`, `footer`

---

Desarrollado para Gables Clinic · Coral Gables, Miami, FL
