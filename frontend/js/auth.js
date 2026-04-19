/* ════════════════════════════════════════════════════════════
   AUTH.JS — Login & Signup
   ════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  // Redirect if already logged in
  if (Auth.isLoggedIn()) {
    const isAuthPage = /login|signup/.test(window.location.pathname);
    if (isAuthPage) window.location.href = '/dashboard.html';
  }

  // ─── LOGIN ────────────────────────────────────────────────
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn   = loginForm.querySelector('[type="submit"]');
      const errEl = document.getElementById('login-error');
      const resendWrap = document.getElementById('resend-wrap');
      if (errEl) errEl.textContent = '';
      if (resendWrap) resendWrap.style.display = 'none';

      setLoading(btn, true);
      try {
        const data = await apiFetch('/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            email:    loginForm.email.value.trim(),
            password: loginForm.password.value
          })
        });
        Auth.save(data.token, data.user);
        showToast('Bienvenido/a de vuelta', `Hola, ${data.user.nombre}`, 'success');
        setTimeout(() => { window.location.href = '/dashboard.html'; }, 700);
      } catch (err) {
        if (errEl) errEl.textContent = err.message;

        // Si el error es por email no verificado, mostrar opción de reenvío
        const isUnverified = err.message.toLowerCase().includes('verific');
        if (isUnverified && resendWrap) {
          resendWrap.dataset.email = loginForm.email.value.trim();
          resendWrap.style.display = 'block';
        }
        setLoading(btn, false);
      }
    });

    // Reenviar verificación desde login
    const resendBtn = document.getElementById('resend-verification');
    if (resendBtn) {
      resendBtn.addEventListener('click', async () => {
        const wrap  = document.getElementById('resend-wrap');
        const email = wrap?.dataset.email;
        if (!email) return;
        setLoading(resendBtn, true);
        try {
          await apiFetch('/auth/resend-verification', {
            method: 'POST',
            body: JSON.stringify({ email })
          });
          showToast('Email reenviado', 'Revisá tu bandeja de entrada.', 'success');
          wrap.style.display = 'none';
        } catch (err) {
          showToast('Error', err.message, 'error');
        } finally {
          setLoading(resendBtn, false);
        }
      });
    }
  }

  // ─── SIGNUP ───────────────────────────────────────────────
  const signupForm = document.getElementById('signup-form');
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn   = signupForm.querySelector('[type="submit"]');
      const errEl = document.getElementById('signup-error');
      if (errEl) errEl.textContent = '';

      const nombre   = signupForm.nombre.value.trim();
      const apellido = signupForm.apellido.value.trim();
      const email    = signupForm.email.value.trim();
      const telefono = signupForm.telefono?.value.trim() || '';
      const password = signupForm.password.value;
      const confirm  = signupForm.confirm_password?.value;

      if (password.length < 8) {
        if (errEl) errEl.textContent = 'La contraseña debe tener al menos 8 caracteres.';
        return;
      }
      if (confirm && password !== confirm) {
        if (errEl) errEl.textContent = 'Las contraseñas no coinciden.';
        return;
      }

      setLoading(btn, true);
      try {
        const data = await apiFetch('/auth/register', {
          method: 'POST',
          body: JSON.stringify({ nombre, apellido, email, telefono, password })
        });

        // Verificación desactivada para portfolio — login directo
        Auth.save(data.token, data.user);
        showToast('Cuenta creada', `Bienvenido/a, ${data.user.nombre}`, 'success');
        setTimeout(() => { window.location.href = '/dashboard.html'; }, 700);

      } catch (err) {
        if (errEl) errEl.textContent = err.message;
        setLoading(btn, false);
      }
    });
  }

  // Toggle password visibility
  document.querySelectorAll('[data-toggle-pw]').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.getAttribute('data-toggle-pw'));
      if (!input) return;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.innerHTML = show
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
        : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
    });
  });
});

// ─── Pending verification screen ─────────────────────────
function showPendingVerification(email) {
  // Reemplaza el contenido del panel de signup
  const panel = document.querySelector('.auth-panel') || document.body;
  panel.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:80vh;text-align:center;padding:0 20px;max-width:400px;margin:0 auto">
      <div style="width:64px;height:64px;border-radius:50%;background:var(--accent-light);display:flex;align-items:center;justify-content:center;margin-bottom:24px">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
      </div>
      <h2 style="margin-bottom:12px">Revisá tu email.</h2>
      <p style="font-size:.9rem;line-height:1.7;margin-bottom:8px">
        Te mandamos un link de verificación a<br>
        <strong style="color:var(--text)">${email}</strong>
      </p>
      <p style="font-size:.82rem;color:var(--text-light);margin-bottom:32px">
        El link expira en 24 horas. Si no lo ves, revisá spam.
      </p>
      <a href="/login.html" class="btn btn--accent btn--full" style="margin-bottom:12px">Ya verifiqué, ingresar</a>
      <button class="btn btn--outline btn--full" id="resend-pending">Reenviar email</button>
      <div id="resend-pending-msg" style="margin-top:12px;font-size:.8rem;color:var(--text-muted)"></div>
    </div>`;

  document.getElementById('resend-pending').addEventListener('click', async function() {
    setLoading(this, true);
    try {
      await apiFetch('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email })
      });
      document.getElementById('resend-pending-msg').textContent = '✓ Email reenviado correctamente.';
    } catch (err) {
      document.getElementById('resend-pending-msg').textContent = err.message;
    } finally {
      setLoading(this, false);
    }
  });
}