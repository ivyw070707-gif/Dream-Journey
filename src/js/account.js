import {apiRequest, setSessionCSRF} from './project-api.js';
import {escapeHTML as esc} from './project-schema.js';

export function createAccount({t, onChange}) {
  const dialog = document.querySelector('#account-dialog');
  let user = null, mode = 'login', busy = false, error = '', purpose = '', afterLogin;
  const errors = new Set(['invalidEmail', 'invalidPassword', 'invalidAccount', 'emailExists', 'invalidLogin', 'authRateLimit', 'invalidCSRF', 'connectionError']);
  function render() {
    dialog.innerHTML = `<div class="account-heading"><span class="eyebrow">DREAM JOURNEY / ${t('account')}</span><button type="button" data-account-close aria-label="${t('accountClose')}" ${busy ? 'disabled' : ''}>×</button></div>
      ${user ? `<h2 id="account-title">${t(`role_${user.role}`)}</h2><p class="account-name">${esc(user.name)}</p><p>${esc(user.email)}</p><p class="account-note">${t(user.role === 'teacher' ? 'teacherDescription' : 'donorDescription')}</p><button class="agent-primary account-logout">${t('logout')}</button>` : `<h2 id="account-title">${t(mode === 'register' ? 'register' : 'login')}</h2><p class="account-note">${t(purpose === 'upload' ? 'teacherLoginRequired' : 'visitorDescription')}</p>
      <div class="account-tabs"><button data-mode="login" aria-pressed="${mode === 'login'}">${t('login')}</button><button data-mode="register" aria-pressed="${mode === 'register'}">${t('register')}</button></div>
      <form id="account-form"><fieldset ${busy ? 'disabled' : ''}>${mode === 'register' ? `<label class="agent-field"><span>${t('accountName')}</span><input name="name" autocomplete="name" maxlength="80" required></label>` : ''}<label class="agent-field"><span>${t('accountEmail')}</span><input name="email" type="email" autocomplete="email" maxlength="254" required></label><label class="agent-field"><span>${t('accountPassword')}</span><input name="password" type="password" autocomplete="${mode === 'register' ? 'new-password' : 'current-password'}" minlength="8" maxlength="128" required></label>
      ${mode === 'register' ? `<label class="agent-field"><span>${t('accountConfirmPassword')}</span><input name="confirmation" type="password" autocomplete="new-password" minlength="8" maxlength="128" required></label><div class="account-role-picker" role="group" aria-label="${t('accountRole')}"><label><input type="radio" name="role" value="donor" checked><strong>${t('role_donor')}</strong><small>${t('donorDescription')}</small></label><label><input type="radio" name="role" value="teacher"><strong>${t('role_teacher')}</strong><small>${t('teacherDescription')}</small></label></div>` : ''}<p class="account-password-hint">${t('accountPasswordHint')}</p><button class="agent-primary account-submit" type="submit">${t(busy ? 'accountWorking' : mode === 'register' ? 'registerAndLogin' : 'login')}</button></fieldset></form>`}
      <p class="account-error" role="alert">${error ? t(errors.has(error) ? `accountError_${error}` : error === 'passwordMismatch' ? 'passwordMismatch' : 'accountError_serverError') : ''}</p>`;
    dialog.querySelector('[data-account-close]').onclick = () => dialog.close();
    dialog.querySelectorAll('[data-mode]').forEach(button => button.onclick = () => { mode = button.dataset.mode; error = ''; render(); });
    const form = dialog.querySelector('form'); if (form) form.onsubmit = submit;
    const logout = dialog.querySelector('.account-logout'); if (logout) logout.onclick = signOut;
  }
  function accept(result) { user = result.user || null; setSessionCSRF(result.csrfToken); onChange(user); }
  async function submit(event) {
    event.preventDefault(); if (busy) return;
    const data = new FormData(event.target), body = Object.fromEntries(data);
    if (mode === 'register' && body.password !== body.confirmation) { error = 'passwordMismatch'; render(); return; }
    delete body.confirmation; busy = true; error = '';
    const submit = dialog.querySelector('.account-submit'); submit.disabled = true; submit.textContent = t('accountWorking');
    try {
      const result = await apiRequest(`api/auth/${mode}`, {body}); accept(result); busy = false;
      if (user?.role === 'teacher' && afterLogin) { const next = afterLogin; afterLogin = null; dialog.close(); next(); }
      else { purpose = ''; render(); }
    } catch (err) { busy = false; error = err.message; render(); }
  }
  async function signOut() {
    if (busy) return; busy = true;
    try { accept(await apiRequest('api/auth/logout', {body: {}})); busy = false; dialog.close(); }
    catch (err) { busy = false; error = err.message; render(); }
  }
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  dialog.addEventListener('close', () => { afterLogin = null; error = ''; dialog.innerHTML = ''; });
  return {
    getUser: () => user,
    open(options = {}) { purpose = options.purpose || ''; afterLogin = options.afterLogin; mode = 'login'; error = ''; render(); if (!dialog.open) dialog.showModal(); },
    refreshLocale() { if (dialog.open) render(); },
    async refresh() { try { accept(await apiRequest('api/auth/me')); } catch { /* Browsing works even if the account service is offline. */ } }
  };
}
