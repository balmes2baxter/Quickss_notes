// ============================================================================
// NOTAS QUICKSS — HUB MULTI-MÓDULO (GLASSMORPHISM-MINIMALISM · ZERO EMOJIS)
// ============================================================================

// ----------------------------------------------------------------------------
// ENTORNO: development (localhost / rama development) vs production (main → GitHub Pages)
// - development: carga datos de demostración (mock) para probar
// - production: arranca limpio para usuarios reales, con su propio almacenamiento
// ----------------------------------------------------------------------------
const DEV_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', ''];
const APP_ENV = (new URLSearchParams(window.location.search).get('env'))
  || (DEV_HOSTS.includes(window.location.hostname) ? 'development' : 'production');
const IS_PROD = APP_ENV === 'production';
const STORAGE_PREFIX = IS_PROD ? 'quickss_prod_' : 'quickss_';
const CLOUD_WORKSPACE_ID = IS_PROD ? 'main_workspace' : 'dev_workspace';

const STORAGE_KEYS = {
  USERS: `${STORAGE_PREFIX}users_v4`,
  CURRENT_USER: `${STORAGE_PREFIX}current_user_v4`,
  ALLOWED_EMAILS: `${STORAGE_PREFIX}allowed_emails_v4`,
  AUTH_SESSION: `${STORAGE_PREFIX}auth_session_v4`,
  PRE_CHECKIN: `${STORAGE_PREFIX}pre_checkin_v4`,
  VISITS: `${STORAGE_PREFIX}visits_v4`,
  DAILIES: `${STORAGE_PREFIX}dailies_v4`,
  TASKS: `${STORAGE_PREFIX}tasks_v4`,
  WARNINGS: `${STORAGE_PREFIX}warnings_v4`,
  SUPABASE_CFG: `${STORAGE_PREFIX}supabase_cfg_v4`,
  CLEAN_MODE: `${STORAGE_PREFIX}clean_mode_v4`
};

const MODULE_LABELS = {
  hub: 'Centro Operativo',
  brigadas: 'Brigadas Comerciales',
  daily: 'Daily Day',
  tareas: 'Tareas Pendientes',
  llamados: 'Llamados de Atención'
};

const OUTCOME_PRESETS = {
  interesado: {
    label: '¿Cómo estuvo interesado? (Selecciona 1 toque):',
    condLabel: 'Condiciones específicas del cliente o acuerdos clave:',
    placeholder: 'Ej: “Me interesa si incluye control de inventario por bodega…” (Usa Dictar con voz)',
    chips: [
      'Interesado si cumple condiciones específicas',
      'Listo para cotización / propuesta formal',
      'Quiere agendar demostración',
      'Muy interesado en precios y planes'
    ]
  },
  solo_info: {
    label: '¿Qué pasó en este negocio? (Queda registrado negocio y dirección):',
    condLabel: 'Nota rápida (Ej: qué sistema tiene actualmente o a quién se dejó la info):',
    placeholder: 'Ej: Ya tiene sistema actual, no quiere cambiar ahora. Se dejó folleto y tarjeta en esta dirección…',
    chips: [
      'Ya tiene sistema, no quiere cambiar ahora',
      'Solo se entregó información (Folleto / Tarjeta)',
      'No estaba el dueño, se dejó información',
      'Lo revisará con el socio / administrador'
    ]
  },
  no_interesado: {
    label: 'Motivo rápido:',
    condLabel: 'Observación breve (Opcional):',
    placeholder: 'Ej: Franquicia nacional, decisiones en otra ciudad…',
    chips: [
      'Ya tiene sistema y está conforme',
      'No aplica para su tipo de negocio',
      'Estaban muy ocupados para atender',
      'Sucursal / No toman decisiones ahí'
    ]
  }
};

let state = {
  activeModule: 'hub', // 'hub' | 'brigadas' | 'daily' | 'tareas' | 'llamados'
  users: [],
  currentUser: null,
  allowedEmails: [],
  authSession: null,
  preCheckin: null,
  preForm: {
    carnet: true,
    tarjetas: true,
    folletos: true
  },
  visits: [],
  dailies: [],
  tasks: [],
  warnings: [],
  tasksFilter: 'all',
  historyResultFilter: 'all',
  historyBrigadistaFilter: 'all',
  dailyMood: 'A tope',
  taskAssignee: '',
  taskPriority: 'Media',
  warnMember: '',
  warnSeverity: 'Llamado de Atención Verbal',
  warnCategory: 'No portar carnet / Kit incompleto',
  lastSavedVisit: null,
  form: {
    rubro: 'Comercio / Tienda',
    interlocutor: 'Dueño / Decisor',
    material: ['Folleto', 'Tarjeta', 'Explicación verbal'],
    resultado: 'interesado',
    motivo_estado: 'Interesado si cumple condiciones específicas',
    gps_lat: null,
    gps_lng: null
  },
  supabase: null,
  map: null,
  mapMarkersLayer: null,
  recognition: null,
  isRecordingVoice: false,
  charts: {
    outcomes: null,
    reasons: null
  }
};

function refreshLucideIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function getInitials(name) {
  if (!name) return 'NQ';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function applyEnvironmentUI() {
  if (IS_PROD) {
    document.querySelectorAll('[data-dev-only]').forEach(el => el.classList.add('hidden'));
    return;
  }
  // Badge visible solo en development para no confundir con producción
  const badge = document.createElement('div');
  badge.className = 'fixed top-2 left-1/2 -translate-x-1/2 z-[60] px-2.5 py-0.5 rounded-full bg-amber-500/90 text-[10px] font-extrabold text-black tracking-wide pointer-events-none';
  badge.textContent = 'DEV · datos de prueba';
  document.body.appendChild(badge);
}

// ============================================================================
// 1. INICIALIZACIÓN CON COMPUERTA DE LOGIN GOOGLE + LISTA BLANCA
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  loadLocalState();
  applyEnvironmentUI();
  initSupabaseIfConfigured();
  setupEventListeners();
  updateClockPreview();
  setInterval(updateClockPreview, 30000);
  checkAndRenderAuthGate();
  refreshAllUI();
});

function getTodayISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getCurrentTimeFormatted() {
  const now = new Date();
  return now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function updateClockPreview() {
  const el = document.getElementById('visitTimestampPreview');
  if (el) el.textContent = `Hoy · ${getCurrentTimeFormatted()}`;
}

function loadLocalState() {
  try {
    // Auto-configurar Supabase si viene por URL compartida con socios (?supa_url=...&supa_key=...)
    const params = new URLSearchParams(window.location.search);
    const urlParam = params.get('supa_url');
    const keyParam = params.get('supa_key');
    if (urlParam && keyParam) {
      localStorage.setItem(STORAGE_KEYS.SUPABASE_CFG, JSON.stringify({ url: urlParam, key: keyParam }));
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // En producción nunca se cargan datos mock: siempre arranca limpio
    const isCleanMode = true; // Tanto en producción como en desarrollo arranca 100% limpio
    const savedUsers = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    const savedCurrent = JSON.parse(localStorage.getItem(STORAGE_KEYS.CURRENT_USER) || 'null');
    const savedAllowedEmails = JSON.parse(localStorage.getItem(STORAGE_KEYS.ALLOWED_EMAILS) || 'null');
    const savedAuthSession = JSON.parse(localStorage.getItem(STORAGE_KEYS.AUTH_SESSION) || 'null');
    const savedPre = JSON.parse(localStorage.getItem(STORAGE_KEYS.PRE_CHECKIN) || 'null');
    const savedVisits = JSON.parse(localStorage.getItem(STORAGE_KEYS.VISITS) || 'null');
    const savedDailies = JSON.parse(localStorage.getItem(STORAGE_KEYS.DAILIES) || 'null');
    const savedTasks = JSON.parse(localStorage.getItem(STORAGE_KEYS.TASKS) || 'null');
    const savedWarnings = JSON.parse(localStorage.getItem(STORAGE_KEYS.WARNINGS) || 'null');

    // Sin usuarios mock en ningún entorno: los usuarios reales se registran al entrar
    state.users = savedUsers;
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(state.users));

    // Lista blanca de correos de Google autorizados del equipo
    if (Array.isArray(savedAllowedEmails)) {
      state.allowedEmails = savedAllowedEmails.map(e => String(e).trim().toLowerCase()).filter(Boolean);
    } else {
      state.allowedEmails = state.users
        .map(u => String(u.email || '').trim().toLowerCase())
        .filter(Boolean);
      localStorage.setItem(STORAGE_KEYS.ALLOWED_EMAILS, JSON.stringify(state.allowedEmails));
    }

    state.authSession = savedAuthSession;

    state.currentUser = savedCurrent || state.users[0] || null;
    if (state.currentUser) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(state.currentUser));
      state.taskAssignee = state.currentUser.nombre;
      state.warnMember = state.users[1]?.nombre || state.currentUser.nombre;
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      state.taskAssignee = '';
      state.warnMember = '';
    }

    const today = getTodayISO();
    if (savedPre && savedPre.fecha === today && savedPre.brigadista_id === state.currentUser?.id) {
      state.preCheckin = savedPre;
    } else {
      state.preCheckin = null;
    }

    state.visits = Array.isArray(savedVisits) ? savedVisits : [];
    localStorage.setItem(STORAGE_KEYS.VISITS, JSON.stringify(state.visits));

    state.dailies = Array.isArray(savedDailies) ? savedDailies : [];
    localStorage.setItem(STORAGE_KEYS.DAILIES, JSON.stringify(state.dailies));

    state.tasks = Array.isArray(savedTasks) ? savedTasks : [];
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(state.tasks));

    state.warnings = Array.isArray(savedWarnings) ? savedWarnings : [];
    localStorage.setItem(STORAGE_KEYS.WARNINGS, JSON.stringify(state.warnings));
  } catch (e) {
    console.error('Error cargando estado:', e);
  }
}

async function persistAndSyncState() {
  try {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(state.users));
    localStorage.setItem(STORAGE_KEYS.ALLOWED_EMAILS, JSON.stringify(state.allowedEmails));
    if (state.authSession) {
      localStorage.setItem(STORAGE_KEYS.AUTH_SESSION, JSON.stringify(state.authSession));
    } else {
      localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
    }
    if (state.currentUser) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(state.currentUser));
    }
    if (state.preCheckin) {
      localStorage.setItem(STORAGE_KEYS.PRE_CHECKIN, JSON.stringify(state.preCheckin));
    }
    localStorage.setItem(STORAGE_KEYS.VISITS, JSON.stringify(state.visits));
    localStorage.setItem(STORAGE_KEYS.DAILIES, JSON.stringify(state.dailies));
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(state.tasks));
    localStorage.setItem(STORAGE_KEYS.WARNINGS, JSON.stringify(state.warnings));

    const dot = document.getElementById('cloudStatusDot');
    if (dot) {
      dot.classList.add('scale-125');
      setTimeout(() => dot.classList.remove('scale-125'), 300);
    }

    if (state.supabase) {
      await syncStateToCloud();
    }
  } catch (e) {
    console.warn('Error guardando estado:', e);
  }
}

// ============================================================================
// 1.B SISTEMA DE AUTENTICACIÓN GOOGLE OAUTH + LISTA BLANCA DE EQUIPO
// ============================================================================
function isEmailAuthorized(email) {
  const clean = String(email || '').trim().toLowerCase();
  if (!clean) return false;
  // Si en producción aún no hay ningún correo en la lista blanca, el primer socio que entra se registra como Admin fundador
  if (state.allowedEmails.length === 0) return true;
  return state.allowedEmails.includes(clean);
}

function checkAndRenderAuthGate() {
  const overlay = document.getElementById('authGateOverlay');
  if (!overlay) return;

  renderAuthQuickAccounts();
  renderWhitelistUI();

  if (state.authSession && state.authSession.email && isEmailAuthorized(state.authSession.email)) {
    overlay.classList.add('hidden');
  } else {
    state.authSession = null;
    localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
    overlay.classList.remove('hidden');
  }
  refreshLucideIcons();
}

function renderAuthQuickAccounts() {
  const listEl = document.getElementById('authQuickAccountsList');
  if (!listEl) return;

  // Mostrar tarjetas de acceso rápido con los socios autorizados (o con correo registrado)
  const accountsWithEmail = state.users.filter(u => u.email);
  if (accountsWithEmail.length === 0 && state.allowedEmails.length === 0) {
    listEl.innerHTML = `
      <div class="p-2.5 rounded-xl bg-violet-500/10 border border-violet-400/20 text-[11px] text-violet-200">
        Primer ingreso en producción: ingresa tu correo de Google abajo para quedar registrado como Socio Administrador en la Lista Blanca.
      </div>
    `;
    return;
  }

  const items = state.allowedEmails.map(email => {
    const matchedUser = state.users.find(u => String(u.email || '').toLowerCase() === email);
    const displayName = matchedUser ? matchedUser.nombre : email.split('@')[0];
    const roleLabel = matchedUser?.rol || 'Socio Autorizado';
    return { email, displayName, roleLabel };
  });

  listEl.innerHTML = items.map(acc => `
    <button
      type="button"
      onclick="selectQuickGoogleAccount('${escapeHtml(acc.email)}', '${escapeHtml(acc.displayName)}')"
      class="w-full min-h-[44px] px-3 py-2 rounded-xl glass-panel hover:border-violet-400/50 flex items-center justify-between gap-2.5 text-left cursor-pointer transition-colors"
    >
      <div class="flex items-center gap-2.5 min-w-0">
        <span class="w-7 h-7 rounded-full bg-violet-600/40 border border-violet-300/30 text-white text-[11px] font-extrabold flex items-center justify-center shrink-0">
          ${escapeHtml(getInitials(acc.displayName))}
        </span>
        <div class="min-w-0">
          <p class="text-xs font-extrabold text-white truncate">${escapeHtml(acc.displayName)}</p>
          <p class="text-[10px] text-violet-300/75 truncate">${escapeHtml(acc.email)}</p>
        </div>
      </div>
      <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 shrink-0">
        Autorizado
      </span>
    </button>
  `).join('');
}

window.handleGoogleLoginClick = async function() {
  const alertBox = document.getElementById('authDeniedAlert');
  alertBox?.classList.add('hidden');

  const pickerBox = document.getElementById('googleAccountPickerBox');
  const btnText = document.getElementById('btnGoogleSignInText');

  // 1. Si Supabase ya está conectado, lanzar de inmediato la ventana emergente oficial de Google (accounts.google.com)
  if (state.supabase && state.supabase.auth) {
    try {
      if (btnText) btnText.textContent = 'Conectando con Google…';
      const redirectUrl = window.location.origin + window.location.pathname;
      const { data, error } = await state.supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            prompt: 'select_account',
            access_type: 'offline'
          }
        }
      });
      if (error) throw error;
      return;
    } catch (err) {
      console.warn('OAuth directo de Supabase no configurado o falló:', err);
      if (btnText) btnText.textContent = 'Continuar con Google';
      showToast('Configura las llaves de Google en Supabase para abrir la ventana oficial.');
    }
  }

  // 2. Si aún no han pegado las llaves de Google en Supabase, mostramos la opción para verificar o configurar
  if (pickerBox) {
    pickerBox.classList.remove('hidden');
    renderAuthQuickAccounts();
    refreshLucideIcons();
    setTimeout(() => {
      document.getElementById('authGoogleEmailInput')?.focus();
    }, 100);
  }
};

window.selectQuickGoogleAccount = function(email, name) {
  loginWithAuthorizedGoogleAccount(email, name);
};

window.handleVerifyGoogleEmailForm = function(e) {
  e.preventDefault();
  const emailInput = document.getElementById('authGoogleEmailInput');
  const nameInput = document.getElementById('authGoogleNameInput');
  const email = (emailInput?.value || '').trim().toLowerCase();
  const customName = (nameInput?.value || '').trim();
  if (!email) return;

  loginWithAuthorizedGoogleAccount(email, customName);
};

function loginWithAuthorizedGoogleAccount(rawEmail, customName = '') {
  const email = String(rawEmail || '').trim().toLowerCase();
  const alertBox = document.getElementById('authDeniedAlert');
  const alertMsg = document.getElementById('authDeniedMessage');

  if (!email || !email.includes('@')) {
    if (alertBox && alertMsg) {
      alertMsg.textContent = 'Ingresa un correo electrónico válido de Google.';
      alertBox.classList.remove('hidden');
    }
    return;
  }

  // Si es el primer ingreso en producción (lista blanca vacía), el primer socio se registra como Admin fundador
  if (state.allowedEmails.length === 0) {
    state.allowedEmails.push(email);
  }

  // Validar estrictamente contra la Lista Blanca del equipo
  if (!state.allowedEmails.includes(email)) {
    if (alertBox && alertMsg) {
      alertMsg.textContent = `El correo "${email}" no está en la Lista Blanca de socios autorizados de Notas Quickss. Solicita al administrador que lo agregue.`;
      alertBox.classList.remove('hidden');
    }
    if (state.supabase?.auth) {
      state.supabase.auth.signOut().catch(() => {});
    }
    showToast('Acceso bloqueado: correo no autorizado');
    return;
  }

  alertBox?.classList.add('hidden');

  // Buscar o vincular el perfil del socio correspondiente a este correo
  let userProfile = state.users.find(u => String(u.email || '').toLowerCase() === email);

  if (!userProfile) {
    const derivedName = customName || email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    userProfile = {
      id: 'usr_' + Date.now(),
      nombre: derivedName,
      email,
      rol: state.users.length === 0 ? 'Socio / Admin' : 'Socio / Brigadista',
      meta: 12
    };
    state.users.push(userProfile);
  } else if (customName && (!userProfile.nombre || userProfile.nombre === 'Administrador')) {
    userProfile.nombre = customName;
  }

  state.currentUser = userProfile;
  state.taskAssignee = userProfile.nombre;
  state.authSession = {
    email,
    nombre: userProfile.nombre,
    userId: userProfile.id,
    loginAt: new Date().toISOString()
  };

  persistAndSyncState();
  checkAndRenderAuthGate();
  refreshAllUI();
  showToast(`Bienvenido, ${userProfile.nombre}`);
}

window.handleSignOut = async function() {
  state.authSession = null;
  localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
  if (state.supabase?.auth) {
    try {
      await state.supabase.auth.signOut();
    } catch {}
  }
  closeAllCustomDropdowns();
  closeAppDrawer();
  checkAndRenderAuthGate();
  showToast('Sesión cerrada correctamente');
};

window.handleAddWhitelistEmail = function(e) {
  e.preventDefault();
  const input = document.getElementById('whitelistEmailInput');
  const email = (input?.value || '').trim().toLowerCase();
  if (!email || !email.includes('@')) return;

  if (!state.allowedEmails.includes(email)) {
    state.allowedEmails.push(email);
  }

  // Si aún no tiene perfil creado en el equipo, creamos uno base para que aparezca de inmediato
  const existsInUsers = state.users.some(u => String(u.email || '').toLowerCase() === email);
  if (!existsInUsers) {
    const suggestedName = email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    state.users.push({
      id: 'usr_' + Date.now(),
      nombre: suggestedName,
      email,
      rol: 'Socio Autorizado',
      meta: 12
    });
  }

  if (input) input.value = '';
  persistAndSyncState();
  renderWhitelistUI();
  renderAuthQuickAccounts();
  refreshAllUI();
  showToast(`Correo autorizado en Lista Blanca: ${email}`);
};

window.removeWhitelistEmail = function(emailToRemove) {
  const clean = String(emailToRemove || '').trim().toLowerCase();
  if (state.allowedEmails.length <= 1) {
    showToast('Debe quedar al menos 1 correo administrador en la Lista Blanca');
    return;
  }
  state.allowedEmails = state.allowedEmails.filter(e => e !== clean);
  persistAndSyncState();
  renderWhitelistUI();
  renderAuthQuickAccounts();
  showToast(`Correo removido de la Lista Blanca: ${clean}`);
};

function renderWhitelistUI() {
  const container = document.getElementById('whitelistEmailsContainer');
  const badge = document.getElementById('whitelistCountBadge');
  if (badge) {
    badge.textContent = `${state.allowedEmails.length} autorizado${state.allowedEmails.length === 1 ? '' : 's'}`;
  }
  if (!container) return;

  if (state.allowedEmails.length === 0) {
    container.innerHTML = `<p class="text-[11px] text-violet-300/60 py-1">Aún no hay correos restringidos. Agrega los correos @gmail.com de tus socios.</p>`;
    return;
  }

  container.innerHTML = state.allowedEmails.map(email => {
    const matchedUser = state.users.find(u => String(u.email || '').toLowerCase() === email);
    const labelName = matchedUser ? matchedUser.nombre : 'Socio';
    return `
      <div class="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-[#130e22] border border-violet-400/20 text-xs">
        <div class="flex items-center gap-2 min-w-0">
          <i data-lucide="check-circle-2" class="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true"></i>
          <span class="font-extrabold text-white truncate">${escapeHtml(email)}</span>
          <span class="text-[10px] text-violet-300/70 truncate">· ${escapeHtml(labelName)}</span>
        </div>
        <button
          type="button"
          onclick="removeWhitelistEmail('${escapeHtml(email)}')"
          class="min-h-[26px] min-w-[26px] rounded-lg hover:bg-rose-500/20 text-violet-300 hover:text-rose-300 flex items-center justify-center cursor-pointer shrink-0"
          title="Quitar acceso a este correo"
        >
          <i data-lucide="x" class="w-3.5 h-3.5" aria-hidden="true"></i>
        </button>
      </div>
    `;
  }).join('');
  refreshLucideIcons();
}

function setupEventListeners() {
  document.getElementById('btnOpenCloudModal')?.addEventListener('click', openCloudModal);
  document.getElementById('negocioNombre')?.addEventListener('input', checkDuplicateBusiness);
  document.getElementById('negocioDireccion')?.addEventListener('input', checkDuplicateBusiness);
  document.getElementById('visitForm')?.addEventListener('submit', handleVisitSubmit);
  document.getElementById('dailyForm')?.addEventListener('submit', handleDailySubmit);
  document.getElementById('taskForm')?.addEventListener('submit', handleTaskSubmit);
  document.getElementById('warningForm')?.addEventListener('submit', handleWarningSubmit);

  // Cerrar custom dropdowns al hacer clic fuera
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[aria-haspopup="true"]') && !e.target.closest('.custom-dropdown-menu')) {
      closeAllCustomDropdowns();
    }
  });

  // Cerrar Drawer, Modales y Dropdowns con tecla Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllCustomDropdowns();
      closeAppDrawer();
      closeCloudModal();
    }
  });
}

// ============================================================================
// 2. DRAWER LATERAL GLASSMORPHIC & CUSTOM TAILWIND DROPDOWNS
// ============================================================================
window.openAppDrawer = function() {
  const drawer = document.getElementById('appDrawer');
  const backdrop = document.getElementById('drawerBackdrop');
  const btn = document.getElementById('btnOpenDrawer');
  closeAllCustomDropdowns();
  backdrop?.classList.remove('hidden');
  drawer?.classList.remove('translate-x-full');
  btn?.setAttribute('aria-expanded', 'true');
};

window.closeAppDrawer = function() {
  const drawer = document.getElementById('appDrawer');
  const backdrop = document.getElementById('drawerBackdrop');
  const btn = document.getElementById('btnOpenDrawer');
  drawer?.classList.add('translate-x-full');
  backdrop?.classList.add('hidden');
  btn?.setAttribute('aria-expanded', 'false');
};

window.openDrawerAndFocusNewUser = function() {
  closeAllCustomDropdowns();
  openAppDrawer();
  setTimeout(() => {
    document.getElementById('newMemberNameInput')?.focus();
  }, 220);
};

window.toggleCustomDropdown = function(menuId, event) {
  if (event) event.stopPropagation();
  const targetMenu = document.getElementById(menuId);
  if (!targetMenu) return;
  const isCurrentlyHidden = targetMenu.classList.contains('hidden');
  closeAllCustomDropdowns();
  if (isCurrentlyHidden) {
    targetMenu.classList.remove('hidden');
  }
};

function closeAllCustomDropdowns() {
  document.querySelectorAll('.custom-dropdown-menu').forEach(menu => {
    menu.classList.add('hidden');
  });
}

// ============================================================================
// 3. NAVEGACIÓN ENTRE MÓDULOS PRINCIPALES (BOTTOM NAVBAR + HEADER)
// ============================================================================
window.switchModule = function(modName) {
  state.activeModule = modName;
  const modules = ['hub', 'brigadas', 'daily', 'tareas', 'llamados'];

  modules.forEach(m => {
    const el = document.getElementById(`module_${m}`);
    const dockBtn = document.getElementById(`navDockBtn_${m}`);

    if (m === modName) {
      el?.classList.remove('hidden');
      if (dockBtn) {
        dockBtn.className = 'min-h-[52px] py-1.5 px-1 rounded-xl bg-violet-600 text-white font-extrabold flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors relative shadow-lg shadow-violet-600/30';
      }
    } else {
      el?.classList.add('hidden');
      if (dockBtn) {
        dockBtn.className = 'min-h-[52px] py-1.5 px-1 rounded-xl text-violet-200/80 hover:text-white font-bold flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors relative';
      }
    }
  });

  setText('topActiveModuleBadge', MODULE_LABELS[modName] || 'Centro Operativo');
  closeAllCustomDropdowns();
  refreshAllUI();
};

// ============================================================================
// 4. GESTIÓN DE EQUIPO Y CUSTOM SELECTORS TAILWIND (SIN <SELECT> NI PROMPT)
// ============================================================================
function renderCustomUserMenus() {
  if (!state.currentUser) return;

  // Cabecera superior
  setText('topWelcomeName', state.currentUser.nombre.split(' ')[0]);
  setText('headerUserName', state.currentUser.nombre);
  setText('headerUserInitials', getInitials(state.currentUser.nombre));

  // Datos en Drawer
  setText('drawerUserName', state.currentUser.nombre);
  setText('drawerUserRole', state.currentUser.rol || 'Brigadista');

  // 1. Menú desplegable de cabecera
  const headerItems = document.getElementById('headerUserMenuItems');
  if (headerItems) {
    headerItems.innerHTML = state.users.map(u => {
      const isActive = state.currentUser?.id === u.id;
      return `
        <button
          type="button"
          onclick="handleQuickUserChange('${u.id}')"
          class="w-full min-h-[42px] px-3 py-2 rounded-xl flex items-center justify-between text-xs font-bold ${isActive ? 'bg-violet-600 text-white' : 'text-violet-100 hover:bg-violet-500/20'} cursor-pointer transition-colors"
        >
          <span class="flex items-center gap-2.5 truncate">
            <span class="w-6 h-6 rounded-lg ${isActive ? 'bg-white/20 text-white' : 'bg-violet-500/25 text-violet-200'} text-[10px] font-extrabold flex items-center justify-center shrink-0">
              ${escapeHtml(getInitials(u.nombre))}
            </span>
            <span class="truncate">${escapeHtml(u.nombre)}</span>
          </span>
          ${isActive ? '<i data-lucide="check" class="w-4 h-4 shrink-0" aria-hidden="true"></i>' : ''}
        </button>
      `;
    }).join('');
  }

  // 2. Lista de integrantes en el Drawer
  const drawerList = document.getElementById('drawerUsersList');
  if (drawerList) {
    drawerList.innerHTML = state.users.map(u => {
      const isActive = state.currentUser?.id === u.id;
      return `
        <button
          type="button"
          onclick="handleQuickUserChange('${u.id}')"
          class="w-full min-h-[44px] px-3 py-2 rounded-xl flex items-center justify-between text-xs font-bold ${isActive ? 'bg-violet-600 text-white shadow' : 'glass-panel text-violet-100 hover:border-violet-400/40'} cursor-pointer transition-colors"
        >
          <span class="flex items-center gap-2.5 truncate">
            <span class="w-7 h-7 rounded-lg ${isActive ? 'bg-white/20 text-white' : 'bg-violet-500/25 text-violet-200'} text-[11px] font-extrabold flex items-center justify-center shrink-0">
              ${escapeHtml(getInitials(u.nombre))}
            </span>
            <span class="text-left truncate">
              <span class="block leading-tight truncate">${escapeHtml(u.nombre)}</span>
              <span class="block text-[10px] ${isActive ? 'text-violet-100' : 'text-violet-300/70'} font-medium">${escapeHtml(u.rol || 'Brigadista')}</span>
            </span>
          </span>
          ${isActive ? '<i data-lucide="check-circle-2" class="w-4 h-4 shrink-0" aria-hidden="true"></i>' : ''}
        </button>
      `;
    }).join('');
  }

  // 3. Custom Dropdown para Responsable en Tareas
  if (!state.taskAssignee) state.taskAssignee = state.currentUser.nombre;
  setText('labelTaskAssignee', state.taskAssignee);
  const taskMenu = document.getElementById('taskAssigneeMenu');
  if (taskMenu) {
    taskMenu.innerHTML = state.users.map(u => {
      const isSelected = state.taskAssignee === u.nombre;
      return `
        <button
          type="button"
          onclick="selectTaskAssignee('${escapeHtml(u.nombre)}')"
          class="w-full min-h-[40px] px-3 py-2 rounded-xl flex items-center justify-between text-xs font-bold ${isSelected ? 'bg-violet-600 text-white' : 'text-violet-100 hover:bg-violet-500/20'} cursor-pointer"
        >
          <span class="flex items-center gap-2 truncate">
            <i data-lucide="user" class="w-3.5 h-3.5 text-violet-300 shrink-0" aria-hidden="true"></i>
            <span class="truncate">${escapeHtml(u.nombre)}</span>
          </span>
          ${isSelected ? '<i data-lucide="check" class="w-3.5 h-3.5 shrink-0" aria-hidden="true"></i>' : ''}
        </button>
      `;
    }).join('');
  }

  // 4. Custom Dropdown para Colaborador en Llamados
  if (!state.warnMember) state.warnMember = state.users[0]?.nombre || 'Colaborador';
  setText('labelWarnMember', state.warnMember);
  const warnMenu = document.getElementById('warnMemberMenu');
  if (warnMenu) {
    warnMenu.innerHTML = state.users.map(u => {
      const isSelected = state.warnMember === u.nombre;
      return `
        <button
          type="button"
          onclick="selectWarnMember('${escapeHtml(u.nombre)}')"
          class="w-full min-h-[40px] px-3 py-2 rounded-xl flex items-center justify-between text-xs font-bold ${isSelected ? 'bg-violet-600 text-white' : 'text-violet-100 hover:bg-violet-500/20'} cursor-pointer"
        >
          <span class="flex items-center gap-2 truncate">
            <i data-lucide="user-check" class="w-3.5 h-3.5 text-violet-300 shrink-0" aria-hidden="true"></i>
            <span class="truncate">${escapeHtml(u.nombre)}</span>
          </span>
          ${isSelected ? '<i data-lucide="check" class="w-3.5 h-3.5 shrink-0" aria-hidden="true"></i>' : ''}
        </button>
      `;
    }).join('');
  }
}

window.handleQuickUserChange = function(userId) {
  const user = state.users.find(u => u.id === userId);
  if (!user) return;
  state.currentUser = user;
  state.taskAssignee = user.nombre;
  localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));

  const savedPre = JSON.parse(localStorage.getItem(STORAGE_KEYS.PRE_CHECKIN) || 'null');
  if (savedPre && savedPre.fecha === getTodayISO() && savedPre.brigadista_id === user.id) {
    state.preCheckin = savedPre;
  } else {
    state.preCheckin = null;
  }

  closeAllCustomDropdowns();
  refreshAllUI();
  showToast(`Sesión activa cambiada a ${user.nombre}`);
};

window.handleCreateTeamMember = function(e) {
  e.preventDefault();
  const input = document.getElementById('newMemberNameInput');
  const emailInput = document.getElementById('newMemberEmailInput');
  const nombre = (input?.value || '').trim();
  const email = (emailInput?.value || '').trim().toLowerCase();
  if (!nombre) return;

  let existing = state.users.find(
    u => u.nombre.toLowerCase() === nombre.toLowerCase() || (email && String(u.email || '').toLowerCase() === email)
  );
  if (!existing) {
    existing = { id: 'usr_' + Date.now(), nombre, email, rol: 'Socio / Brigadista', meta: 12 };
    state.users.push(existing);
  } else {
    existing.nombre = nombre;
    if (email) existing.email = email;
  }

  if (email && !state.allowedEmails.includes(email)) {
    state.allowedEmails.push(email);
  }

  state.currentUser = existing;
  state.taskAssignee = existing.nombre;
  persistAndSyncState();

  if (input) input.value = '';
  if (emailInput) emailInput.value = '';
  renderWhitelistUI();
  renderAuthQuickAccounts();
  refreshAllUI();
  showToast(`Socio autorizado: ${existing.nombre}${email ? ` (${email})` : ''}`);
};

window.selectTaskAssignee = function(nombre) {
  state.taskAssignee = nombre;
  setText('labelTaskAssignee', nombre);
  closeAllCustomDropdowns();
  renderCustomUserMenus();
  refreshLucideIcons();
};

window.selectTaskPriority = function(priority) {
  state.taskPriority = priority;
  document.querySelectorAll('#taskPriorityGroup button').forEach(btn => {
    if (btn.getAttribute('data-prio') === priority) btn.classList.add('active-blue');
    else btn.classList.remove('active-blue');
  });
};

window.selectWarnMember = function(nombre) {
  state.warnMember = nombre;
  setText('labelWarnMember', nombre);
  closeAllCustomDropdowns();
  renderCustomUserMenus();
  refreshLucideIcons();
};

window.selectWarnSeverity = function(severity) {
  state.warnSeverity = severity;
  document.querySelectorAll('#warnSeverityGroup button').forEach(btn => {
    if (btn.getAttribute('data-sev') === severity) btn.classList.add('active-blue');
    else btn.classList.remove('active-blue');
  });
};

// ============================================================================
// 5. RENDER DEL HUB PRINCIPAL: PANEL DE ANALÍTICAS PERSONALES + MÓDULOS
// ============================================================================
window.setHubAnalyticsScope = function(scope) {
  state.hubAnalyticsScope = scope;
  const btnPersonal = document.getElementById('btnScopePersonal');
  const btnTeam = document.getElementById('btnScopeTeam');

  if (scope === 'personal') {
    if (btnPersonal) btnPersonal.className = 'min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-extrabold bg-violet-600 text-white shadow flex items-center gap-1.5 cursor-pointer transition-colors';
    if (btnTeam) btnTeam.className = 'min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-bold text-violet-200 hover:text-white flex items-center gap-1.5 cursor-pointer transition-colors';
  } else {
    if (btnTeam) btnTeam.className = 'min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-extrabold bg-violet-600 text-white shadow flex items-center gap-1.5 cursor-pointer transition-colors';
    if (btnPersonal) btnPersonal.className = 'min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-bold text-violet-200 hover:text-white flex items-center gap-1.5 cursor-pointer transition-colors';
  }

  renderHubDashboard();
  refreshLucideIcons();
};

function renderHubDashboard() {
  const todayFormatted = new Date().toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long'
  });
  setText('hubTodayDate', todayFormatted);

  const scope = state.hubAnalyticsScope || 'personal';
  const currentName = state.currentUser?.nombre || 'Equipo';
  const todayISO = getTodayISO();

  // Identidad en el Panel de Analíticas
  setText('hubUserAvatarBig', scope === 'personal' ? getInitials(currentName) : 'EQ');
  setText('hubWelcomeName', scope === 'personal' ? currentName : 'Todo el Equipo');
  setText('hubScopeBadgeText', scope === 'personal' ? 'Mi Rendimiento' : 'Vista Equipo');

  const userXP = scope === 'personal'
    ? calculateUserXP(currentName)
    : state.users.reduce((acc, u) => acc + calculateUserXP(u.nombre), 0);
  const rankObj = getRankFromXP(scope === 'personal' ? userXP : Math.round(userXP / Math.max(1, state.users.length)));
  const rankPill = document.getElementById('hubUserRankPill');
  if (rankPill) {
    rankPill.innerHTML = `
      <i data-lucide="${rankObj.icon}" class="w-3 h-3 text-violet-300" aria-hidden="true"></i>
      <span>${rankObj.title} · ${userXP} XP</span>
    `;
  }

  // Filtrar datos según alcance (Personal al iniciar sesión vs Equipo)
  const scopedVisits = scope === 'personal'
    ? state.visits.filter(v => v.brigadista_nombre === currentName)
    : state.visits;
  const scopedDailies = scope === 'personal'
    ? state.dailies.filter(d => d.author === currentName)
    : state.dailies;
  const scopedTasks = scope === 'personal'
    ? state.tasks.filter(t => t.assignee === currentName)
    : state.tasks;
  const scopedWarnings = scope === 'personal'
    ? state.warnings.filter(w => w.member === currentName)
    : state.warnings;

  // 1. Métrica Brigada
  const targetBrigada = scope === 'personal'
    ? (state.preCheckin?.meta_diaria || state.currentUser?.meta || 12)
    : state.users.length * 12;
  const pctBrigada = Math.min(100, Math.round((scopedVisits.length / Math.max(1, targetBrigada)) * 100));
  const hotScoped = scopedVisits.filter(v => v.resultado === 'interesado').length;

  setText('hubStatBrigadas', `${scopedVisits.length}/${targetBrigada}`);
  const barBrig = document.getElementById('hubBarBrigadas');
  if (barBrig) barBrig.style.width = `${pctBrigada}%`;
  setText('hubSubBrigadasHot', `${hotScoped} interesados`);
  setText('hubSubBrigadasKit', state.preCheckin?.completed ? state.preCheckin.zona : 'Sin check-in');

  // 2. Métrica Daily Chat (Ayer / Hoy / Bloqueante)
  const todayDaily = scopedDailies.find(d => d.fecha === todayISO) || scopedDailies[0];
  const hasDailyToday = scope === 'personal'
    ? scopedDailies.some(d => d.fecha === todayISO)
    : scopedDailies.length >= state.users.length;
  const pctDaily = scope === 'personal'
    ? (hasDailyToday ? 100 : 0)
    : Math.min(100, Math.round((scopedDailies.filter(d => d.fecha === todayISO).length / Math.max(1, state.users.length)) * 100));

  setText('hubStatDaily', scope === 'personal' ? (hasDailyToday ? 'Listo' : 'Pendiente') : `${scopedDailies.length} hoy`);
  const barDaily = document.getElementById('hubBarDaily');
  if (barDaily) barDaily.style.width = `${pctDaily}%`;
  setText('hubSubDailyFocus', todayDaily ? todayDaily.focus : 'Sin reporte hoy');

  // 3. Métrica Tareas Planteadas
  const totalScopedTasks = scopedTasks.length;
  const doneScopedTasks = scopedTasks.filter(t => t.completed).length;
  const pendingScopedTasks = totalScopedTasks - doneScopedTasks;
  const highPendingTasks = scopedTasks.filter(t => !t.completed && t.priority === 'Alta').length;
  const pctTareas = totalScopedTasks > 0 ? Math.round((doneScopedTasks / totalScopedTasks) * 100) : 100;

  setText('hubStatTareas', `${doneScopedTasks}/${totalScopedTasks}`);
  const barTareas = document.getElementById('hubBarTareas');
  if (barTareas) barTareas.style.width = `${pctTareas}%`;
  setText('hubSubTareasPending', `${pendingScopedTasks} pendientes`);
  setText('hubSubTareasHigh', `${highPendingTasks} alta`);

  // 4. Métrica Bitácora / Llamados
  const pctDiscipline = scopedWarnings.length === 0 ? 100 : Math.max(40, 100 - scopedWarnings.length * 25);
  setText('hubStatLlamados', `${scopedWarnings.length}`);
  const barLlamados = document.getElementById('hubBarLlamados');
  if (barLlamados) {
    barLlamados.style.width = `${pctDiscipline}%`;
    barLlamados.className = `h-full rounded-full transition-[width] duration-500 ${scopedWarnings.length === 0 ? 'bg-emerald-400' : 'bg-rose-400'}`;
  }
  setText(
    'hubSubLlamadosText',
    scopedWarnings.length === 0
      ? 'Cumplimiento óptimo'
      : (scopedWarnings[0].commitment || scopedWarnings[0].category)
  );

  // Anillo Global de Cumplimiento
  const overallPct = Math.round((pctBrigada * 0.45) + (pctDaily * 0.25) + (pctTareas * 0.30));
  const circumference = 263.89;
  const overallOffset = circumference - (overallPct / 100) * circumference;
  const overallCircle = document.getElementById('hubOverallRadialCircle');
  if (overallCircle) overallCircle.style.strokeDashoffset = overallOffset;
  setText('hubOverallPctText', `${overallPct}%`);

  setText(
    'hubOverallStatusBadge',
    overallPct >= 80 ? 'Óptimo' : (overallPct >= 45 ? 'En marcha' : 'Por iniciar')
  );
  setText(
    'hubOverallSummaryText',
    `${scopedVisits.length}/${targetBrigada} visitas · ${doneScopedTasks}/${totalScopedTasks} tareas`
  );

  // Renderizar Gráfica Personal y Acciones Rápidas
  renderHubPersonalChart(pctBrigada, pctDaily, pctTareas, pctDiscipline);
  renderHubActionableRoadmap(currentName, scopedVisits.length, targetBrigada, hasDailyToday, scopedTasks, scopedWarnings);

  // Contadores Globales de Navbar Inferior, Drawer y Tarjetas de Módulos
  const allHotVisits = state.visits.filter(v => v.resultado === 'interesado').length;
  const allPendingTasks = state.tasks.filter(t => !t.completed).length;

  setText('badgeCountBrigadas', state.visits.length);
  setText('badgeCountDaily', state.dailies.length);
  setText('badgeCountTareas', allPendingTasks);
  setText('badgeCountLlamados', state.warnings.length);

  setText('drawerBadgeBrigadas', state.visits.length);
  setText('drawerBadgeDaily', state.dailies.length);
  setText('drawerBadgeTareas', allPendingTasks);
  setText('drawerBadgeLlamados', state.warnings.length);

  setText('hubCardBrigadasInfo', `${state.visits.length} visitas · ${allHotVisits} interesados`);
  setText('hubCardDailyInfo', `${state.dailies.length} reportes · Ayer/Hoy`);
  setText('hubCardTareasInfo', `${allPendingTasks} pendientes`);
  setText('hubCardLlamadosInfo', `${state.warnings.length} registros`);

  // Feed Unificado Reciente (Compacto y Alineado)
  const feedEl = document.getElementById('hubUnifiedFeed');
  if (!feedEl) return;

  const combined = [
    ...state.visits.slice(0, 2).map(v => ({
      icon: 'compass',
      mod: 'Brigada',
      title: v.negocio_nombre,
      meta: `${v.brigadista_nombre} · ${v.hora}`,
      clickMod: 'brigadas'
    })),
    ...state.dailies.slice(0, 2).map(d => ({
      icon: 'sun',
      mod: 'Daily Chat',
      title: d.focus,
      meta: `${d.author} · ${d.hora}`,
      clickMod: 'daily'
    })),
    ...state.tasks.slice(0, 2).map(t => ({
      icon: 'check-square',
      mod: 'Tarea',
      title: t.title,
      meta: `${t.assignee} · ${t.priority}`,
      clickMod: 'tareas'
    })),
    ...state.warnings.slice(0, 2).map(w => ({
      icon: 'shield-alert',
      mod: 'Llamado',
      title: `${w.member} · ${w.category}`,
      meta: w.hora,
      clickMod: 'llamados'
    }))
  ].slice(0, 4);

  feedEl.innerHTML = combined.map(item => `
    <button
      type="button"
      onclick="switchModule('${item.clickMod}')"
      class="h-full p-3.5 rounded-2xl glass-panel hover:border-violet-400/50 text-left cursor-pointer flex items-center justify-between gap-3 transition-colors"
    >
      <div class="flex items-center gap-3 min-w-0">
        <div class="w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-400/25 flex items-center justify-center text-violet-300 shrink-0">
          <i data-lucide="${item.icon}" class="w-4 h-4" aria-hidden="true"></i>
        </div>
        <div class="min-w-0">
          <p class="font-extrabold text-xs sm:text-sm text-white truncate">${escapeHtml(item.title)}</p>
          <p class="text-[11px] text-violet-300/75 truncate">${escapeHtml(item.mod)} · ${escapeHtml(item.meta)}</p>
        </div>
      </div>
      <i data-lucide="chevron-right" class="w-4 h-4 text-violet-300/60 shrink-0" aria-hidden="true"></i>
    </button>
  `).join('');
}

function renderHubPersonalChart(pctBrigada, pctDaily, pctTareas, pctDiscipline) {
  const canvas = document.getElementById('chartHubPersonal');
  if (!canvas || typeof Chart === 'undefined') return;
  const ctx = canvas.getContext('2d');

  if (state.charts.hubPersonal) {
    state.charts.hubPersonal.destroy();
  }

  state.charts.hubPersonal = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Brigadas', 'Daily Chat', 'Tareas', 'Bitácora'],
      datasets: [{
        label: '% Avance',
        data: [pctBrigada, pctDaily, pctTareas, pctDiscipline],
        backgroundColor: ['#8b5cf6', '#a78bfa', '#f59e0b', '#34d399'],
        borderRadius: 6,
        barThickness: 14
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          min: 0,
          max: 100,
          ticks: {
            callback: (val) => `${val}%`,
            color: '#c4b5fd',
            font: { size: 10 }
          },
          grid: { color: 'rgba(139,92,246,0.1)' }
        },
        y: {
          ticks: { color: '#f5f3ff', font: { size: 11, weight: 'bold' } },
          grid: { display: false }
        }
      }
    }
  });
}

function renderHubActionableRoadmap(userName, visitsDone, visitsTarget, hasDailyToday, userTasks, userWarnings) {
  const container = document.getElementById('hubPersonalActionList');
  if (!container) return;

  const actions = [];

  if (!hasDailyToday) {
    actions.push({
      icon: 'sun',
      badge: 'Pendiente',
      badgeClass: 'bg-violet-500/25 text-violet-200 border-violet-400/35',
      title: 'Publicar Daily Chat',
      mod: 'daily'
    });
  } else {
    actions.push({
      icon: 'check-circle-2',
      badge: 'Al día',
      badgeClass: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/35',
      title: 'Daily Chat registrado',
      mod: 'daily'
    });
  }

  const remainingVisits = Math.max(0, visitsTarget - visitsDone);
  if (remainingVisits > 0) {
    actions.push({
      icon: 'compass',
      badge: `${visitsDone}/${visitsTarget}`,
      badgeClass: 'bg-violet-500/25 text-violet-200 border-violet-400/35',
      title: `Registrar visitas (${remainingVisits} restantes)`,
      mod: 'brigadas'
    });
  } else {
    actions.push({
      icon: 'trophy',
      badge: '100%',
      badgeClass: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/35',
      title: 'Meta de brigada completada',
      mod: 'brigadas'
    });
  }

  const pendingTask = userTasks.find(t => !t.completed);
  if (pendingTask) {
    actions.push({
      icon: 'check-square',
      badge: pendingTask.priority,
      badgeClass: 'bg-amber-500/20 text-amber-200 border-amber-400/35',
      title: pendingTask.title,
      mod: 'tareas'
    });
  } else if (userWarnings.length > 0) {
    actions.push({
      icon: 'shield-alert',
      badge: 'Acuerdo',
      badgeClass: 'bg-rose-500/20 text-rose-200 border-rose-400/35',
      title: userWarnings[0].commitment || userWarnings[0].category,
      mod: 'llamados'
    });
  } else {
    actions.push({
      icon: 'sparkles',
      badge: 'Al día',
      badgeClass: 'bg-violet-500/20 text-violet-200 border-violet-400/35',
      title: 'Sin tareas pendientes',
      mod: 'tareas'
    });
  }

  container.innerHTML = actions.slice(0, 3).map(a => `
    <button
      type="button"
      onclick="switchModule('${a.mod}')"
      class="w-full p-2.5 rounded-xl bg-[#130e22]/90 hover:bg-[#1b1430] border border-violet-400/20 hover:border-violet-400/50 text-left flex items-center justify-between gap-2.5 cursor-pointer transition-colors"
    >
      <div class="flex items-center gap-2.5 min-w-0">
        <div class="w-7 h-7 rounded-lg bg-violet-500/20 border border-violet-400/30 flex items-center justify-center text-violet-200 shrink-0">
          <i data-lucide="${a.icon}" class="w-3.5 h-3.5" aria-hidden="true"></i>
        </div>
        <p class="text-xs font-extrabold text-white truncate">${escapeHtml(a.title)}</p>
      </div>
      <div class="flex items-center gap-1.5 shrink-0">
        <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full border tabular-nums ${a.badgeClass}">${escapeHtml(a.badge)}</span>
        <i data-lucide="chevron-right" class="w-3.5 h-3.5 text-violet-300/60" aria-hidden="true"></i>
      </div>
    </button>
  `).join('');
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ============================================================================
// 6. MÓDULO DAILY DAY / DAILY CHAT (ESTRUCTURA: AYER · HOY · BLOQUEANTE)
// ============================================================================
window.selectDailyMood = function(mood) {
  state.dailyMood = mood;
  document.querySelectorAll('#dailyMoodChips button').forEach(btn => {
    if (btn.getAttribute('data-mood') === mood) btn.classList.add('active-blue');
    else btn.classList.remove('active-blue');
  });
};

function formatDailyChatBlock(done, focus, blocker, author) {
  const ayerText = (done || '').trim() || 'Sin novedades registradas';
  const hoyText = (focus || '').trim() || 'Por definir';
  const bloqText = (blocker || '').trim() || 'Ninguno';
  const header = author ? `Daily — ${author}\n` : '';
  return `${header}✅ Ayer: ${ayerText}\n🎯 Hoy: ${hoyText}\n🚧 Bloqueante: ${bloqText}`;
}

window.copyDraftDailyChat = async function() {
  const done = document.getElementById('dailyDoneInput')?.value || '';
  const focus = document.getElementById('dailyFocusInput')?.value || '';
  const blocker = document.getElementById('dailyBlockerInput')?.value || 'Ninguno';
  const text = formatDailyChatBlock(done, focus, blocker, state.currentUser?.nombre);
  try {
    await navigator.clipboard.writeText(text);
    showToast('Formato Daily Chat (Ayer / Hoy / Bloqueante) copiado al portapapeles');
  } catch {
    showToast('Listo: publica tu Daily para copiarlo con 1 toque');
  }
};

window.copyDailyEntryText = async function(id) {
  const d = state.dailies.find(item => item.id === id);
  if (!d) return;
  const text = formatDailyChatBlock(d.done, d.focus, d.blocker, d.author);
  try {
    await navigator.clipboard.writeText(text);
    showToast(`Daily Chat de ${d.author} copiado al portapapeles`);
  } catch {
    showToast('No se pudo acceder al portapapeles');
  }
};

function handleDailySubmit(e) {
  e.preventDefault();
  const done = document.getElementById('dailyDoneInput').value.trim();
  const focus = document.getElementById('dailyFocusInput').value.trim();
  const blocker = document.getElementById('dailyBlockerInput').value.trim() || 'Ninguno';
  if (!focus && !done) return;

  const entry = {
    id: 'dly_' + Date.now(),
    fecha: getTodayISO(),
    hora: getCurrentTimeFormatted(),
    author: state.currentUser?.nombre || 'Equipo',
    done,
    focus,
    blocker,
    mood: state.dailyMood
  };

  state.dailies.unshift(entry);
  persistAndSyncState();

  document.getElementById('dailyDoneInput').value = '';
  document.getElementById('dailyFocusInput').value = '';
  document.getElementById('dailyBlockerInput').value = '';

  refreshAllUI();
  fireCelebrationConfetti(false);
  showToast('Daily Chat guardado y publicado');
}

function renderDailiesList() {
  const container = document.getElementById('dailyListContainer');
  if (!container) return;

  if (state.dailies.length === 0) {
    container.innerHTML = `<p class="text-xs text-violet-300/60 py-6 text-center">Aún no hay reportes de Daily Chat hoy. Registra tu estructura Ayer / Hoy / Bloqueante.</p>`;
    return;
  }

  container.innerHTML = state.dailies.map(d => {
    const cleanMood = String(d.mood || 'Enfocado').replace(/[^\w\sáéíóúÁÉÍÓÚñÑ@]/g, '').trim() || 'A tope';
    const moodIcon = cleanMood.toLowerCase().includes('bloqueo') ? 'life-buoy' : (cleanMood.toLowerCase().includes('tope') ? 'flame' : 'zap');
    const hasBlocker = d.blocker && !['ninguno', 'ninguna', 'ninguno por el momento', 'sin bloqueos'].includes(d.blocker.trim().toLowerCase());

    return `
      <div class="p-4 rounded-2xl glass-panel space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-violet-400/10 pb-2.5">
          <div class="flex items-center gap-2">
            <span class="w-7 h-7 rounded-lg bg-violet-600/30 border border-violet-400/30 text-violet-200 text-xs font-extrabold flex items-center justify-center">
              ${escapeHtml(getInitials(d.author))}
            </span>
            <span class="font-extrabold text-sm text-white">${escapeHtml(d.author)}</span>
            <span class="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-violet-500/20 text-violet-200 border border-violet-400/30">
              <i data-lucide="${moodIcon}" class="w-3 h-3" aria-hidden="true"></i>
              <span>${escapeHtml(cleanMood)}</span>
            </span>
          </div>
          <div class="flex items-center gap-1.5 text-[11px] text-violet-300/60 tabular-nums">
            <span>${escapeHtml(d.fecha)} · ${escapeHtml(d.hora)}</span>
            <button
              type="button"
              onclick="copyDailyEntryText('${d.id}')"
              title="Copiar en formato Daily Chat"
              class="min-h-[32px] px-2.5 py-1 rounded-lg glass-panel hover:border-violet-400/50 text-violet-200 hover:text-white font-bold flex items-center gap-1 cursor-pointer"
            >
              <i data-lucide="copy" class="w-3 h-3" aria-hidden="true"></i>
              <span>Copiar</span>
            </button>
            <button
              type="button"
              onclick="deleteDaily('${d.id}')"
              aria-label="Eliminar reporte Daily"
              class="min-h-[32px] min-w-[32px] rounded-lg hover:bg-rose-500/20 hover:text-rose-300 flex items-center justify-center cursor-pointer"
            >
              <i data-lucide="trash-2" class="w-3.5 h-3.5" aria-hidden="true"></i>
            </button>
          </div>
        </div>

        <!-- Estructura Oficial Daily Chat: 1. Ayer / 2. Hoy / 3. Bloqueante -->
        <div class="space-y-2 text-xs">
          <div class="flex items-start gap-2.5">
            <span class="inline-flex items-center gap-1 font-extrabold text-emerald-300 shrink-0 min-w-[92px]">
              <i data-lucide="check-circle-2" class="w-3.5 h-3.5" aria-hidden="true"></i>
              <span>Ayer:</span>
            </span>
            <p class="text-violet-100 leading-relaxed">${escapeHtml(d.done || 'Sin registro previo')}</p>
          </div>

          <div class="flex items-start gap-2.5">
            <span class="inline-flex items-center gap-1 font-extrabold text-violet-300 shrink-0 min-w-[92px]">
              <i data-lucide="target" class="w-3.5 h-3.5" aria-hidden="true"></i>
              <span>Hoy:</span>
            </span>
            <p class="text-white font-semibold leading-relaxed">${escapeHtml(d.focus)}</p>
          </div>

          <div class="flex items-start gap-2.5 ${hasBlocker ? 'bg-amber-500/15 border border-amber-500/30 p-2.5 rounded-xl text-amber-200' : ''}">
            <span class="inline-flex items-center gap-1 font-extrabold ${hasBlocker ? 'text-amber-300' : 'text-violet-300/75'} shrink-0 min-w-[92px]">
              <i data-lucide="triangle-alert" class="w-3.5 h-3.5" aria-hidden="true"></i>
              <span>Bloqueante:</span>
            </span>
            <p class="${hasBlocker ? 'font-bold text-amber-100' : 'text-violet-300/80'} leading-relaxed">
              ${escapeHtml(d.blocker || 'Ninguno')}
            </p>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

window.deleteDaily = function(id) {
  state.dailies = state.dailies.filter(d => d.id !== id);
  persistAndSyncState();
  refreshAllUI();
};

// ============================================================================
// 7. MÓDULO DE TAREAS PENDIENTES (CON CUSTOM CHECKBOX TAILWIND)
// ============================================================================
function handleTaskSubmit(e) {
  e.preventDefault();
  const title = document.getElementById('taskTitleInput').value.trim();
  const assignee = state.taskAssignee || state.currentUser?.nombre || 'Equipo';
  const priority = state.taskPriority || 'Media';
  const notes = document.getElementById('taskNotesInput').value.trim();
  if (!title) return;

  const newTask = {
    id: 'tsk_' + Date.now(),
    fecha: getTodayISO(),
    hora: getCurrentTimeFormatted(),
    title,
    assignee,
    priority,
    notes,
    completed: false
  };

  state.tasks.unshift(newTask);
  persistAndSyncState();

  document.getElementById('taskTitleInput').value = '';
  document.getElementById('taskNotesInput').value = '';

  refreshAllUI();
  showToast('Tarea guardada');
}

window.toggleTaskDone = function(id) {
  const t = state.tasks.find(item => item.id === id);
  if (!t) return;
  t.completed = !t.completed;
  persistAndSyncState();
  if (t.completed) fireCelebrationConfetti(false);
  refreshAllUI();
};

window.deleteTask = function(id) {
  state.tasks = state.tasks.filter(t => t.id !== id);
  persistAndSyncState();
  refreshAllUI();
};

window.filterTasksView = function(filter) {
  state.tasksFilter = filter;
  document.querySelectorAll('#taskFilterPills button').forEach(btn => {
    if (btn.getAttribute('data-filter') === filter) {
      btn.className = 'min-h-[36px] px-3 py-1.5 rounded-xl bg-violet-600 text-xs font-bold text-white cursor-pointer';
    } else {
      btn.className = 'min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-bold text-violet-200 hover:text-white cursor-pointer';
    }
  });
  renderTasksList();
  refreshLucideIcons();
};

function renderTasksList() {
  const container = document.getElementById('tasksListContainer');
  if (!container) return;

  const filtered = state.tasks.filter(t => {
    if (state.tasksFilter === 'pending') return !t.completed;
    if (state.tasksFilter === 'done') return t.completed;
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<p class="text-xs text-violet-300/60 py-6 text-center">No hay tareas en esta vista.</p>`;
    return;
  }

  container.innerHTML = filtered.map(t => {
    const prioBadge = t.priority === 'Alta'
      ? 'bg-rose-500/20 text-rose-200 border-rose-400/30'
      : (t.priority === 'Media' ? 'bg-violet-500/20 text-violet-200 border-violet-400/30' : 'bg-slate-800 text-slate-300 border-slate-700');

    return `
      <div class="p-4 rounded-2xl glass-panel flex items-start justify-between gap-3 ${t.completed ? 'opacity-65' : ''}">
        <div class="flex items-start gap-3.5 min-w-0">
          <!-- Custom Tailwind Checkbox Button (Sin <input type="checkbox"> nativo) -->
          <button
            type="button"
            role="checkbox"
            aria-checked="${t.completed ? 'true' : 'false'}"
            aria-label="Marcar tarea ${escapeHtml(t.title)} como ${t.completed ? 'pendiente' : 'completada'}"
            onclick="toggleTaskDone('${t.id}')"
            class="mt-0.5 w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
              t.completed
                ? 'bg-violet-600 border-violet-400 text-white'
                : 'bg-[#120d20] border-violet-400/40 text-transparent hover:border-violet-300'
            }"
          >
            <i data-lucide="check" class="w-3.5 h-3.5" aria-hidden="true"></i>
          </button>

          <div class="space-y-1 min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <p class="font-extrabold text-sm text-white ${t.completed ? 'line-through text-violet-300/60' : ''}">${escapeHtml(t.title)}</p>
              <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${prioBadge}">${escapeHtml(t.priority)}</span>
            </div>
            ${t.notes ? `<p class="text-xs text-violet-200/80">${escapeHtml(t.notes)}</p>` : ''}
            <p class="text-[11px] text-violet-300/65 flex items-center gap-1.5">
              <i data-lucide="user" class="w-3 h-3 text-violet-300" aria-hidden="true"></i>
              <span>Responsable: <b class="text-violet-200">${escapeHtml(t.assignee)}</b> · ${escapeHtml(t.fecha)}</span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onclick="deleteTask('${t.id}')"
          aria-label="Eliminar tarea"
          class="min-h-[36px] min-w-[36px] rounded-xl text-violet-300/60 hover:text-rose-300 hover:bg-rose-500/15 flex items-center justify-center shrink-0 cursor-pointer"
        >
          <i data-lucide="trash-2" class="w-4 h-4" aria-hidden="true"></i>
        </button>
      </div>
    `;
  }).join('');
}

// ============================================================================
// 8. MÓDULO DE LLAMADOS DE ATENCIÓN & BITÁCORA
// ============================================================================
window.selectWarnCategory = function(cat) {
  state.warnCategory = cat;
  document.querySelectorAll('#warnCategoryChips button').forEach(btn => {
    if (btn.getAttribute('onclick').includes(cat)) btn.classList.add('active-blue');
    else btn.classList.remove('active-blue');
  });
};

function handleWarningSubmit(e) {
  e.preventDefault();
  const member = state.warnMember || state.users[0]?.nombre || 'Colaborador';
  const severity = state.warnSeverity || 'Llamado de Atención Verbal';
  const reason = document.getElementById('warnReasonInput').value.trim();
  const commitment = document.getElementById('warnCommitmentInput').value.trim();
  if (!reason) return;

  const newWarn = {
    id: 'wrn_' + Date.now(),
    fecha: getTodayISO(),
    hora: getCurrentTimeFormatted(),
    member,
    severity,
    category: state.warnCategory,
    reason,
    commitment,
    author: state.currentUser?.nombre || 'Líder'
  };

  state.warnings.unshift(newWarn);
  persistAndSyncState();

  document.getElementById('warnReasonInput').value = '';
  document.getElementById('warnCommitmentInput').value = '';

  refreshAllUI();
  showToast(`Llamado guardado para ${member}`);
}

function renderWarningsList() {
  const container = document.getElementById('warningsListContainer');
  if (!container) return;

  if (state.warnings.length === 0) {
    container.innerHTML = `<p class="text-xs text-violet-300/60 py-6 text-center">No hay llamados de atención registrados.</p>`;
    return;
  }

  container.innerHTML = state.warnings.map(w => {
    const sevBadge = w.severity.includes('Formal')
      ? 'bg-rose-500/25 text-rose-200 border-rose-400/40'
      : (w.severity.includes('Verbal') ? 'bg-amber-500/20 text-amber-200 border-amber-400/40' : 'bg-violet-500/20 text-violet-200 border-violet-400/30');

    return `
      <div class="p-4 rounded-2xl glass-panel space-y-2.5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex flex-wrap items-center gap-2">
            <span class="inline-flex items-center gap-1.5 font-extrabold text-sm text-white">
              <i data-lucide="user" class="w-4 h-4 text-rose-300" aria-hidden="true"></i>
              <span>${escapeHtml(w.member)}</span>
            </span>
            <span class="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${sevBadge}">${escapeHtml(w.severity)}</span>
            <span class="text-[11px] font-semibold text-violet-200 bg-violet-500/15 border border-violet-400/20 px-2.5 py-0.5 rounded-lg">${escapeHtml(w.category)}</span>
          </div>
          <div class="flex items-center gap-2 text-[11px] text-violet-300/60 tabular-nums">
            <span>${escapeHtml(w.fecha)} · ${escapeHtml(w.hora)}</span>
            <button
              type="button"
              onclick="deleteWarning('${w.id}')"
              aria-label="Eliminar registro"
              class="min-h-[32px] min-w-[32px] rounded-lg hover:bg-rose-500/20 hover:text-rose-300 flex items-center justify-center cursor-pointer"
            >
              <i data-lucide="trash-2" class="w-3.5 h-3.5" aria-hidden="true"></i>
            </button>
          </div>
        </div>

        <p class="text-xs text-violet-100 leading-relaxed flex items-start gap-2">
          <i data-lucide="file-warning" class="w-4 h-4 text-rose-300 shrink-0 mt-0.5" aria-hidden="true"></i>
          <span><b>Detalle:</b> ${escapeHtml(w.reason)}</span>
        </p>
        ${w.commitment ? `
          <div class="text-xs text-violet-200 bg-violet-500/10 border border-violet-500/25 px-3 py-2 rounded-xl flex items-start gap-2">
            <i data-lucide="handshake" class="w-4 h-4 text-violet-300 shrink-0 mt-0.5" aria-hidden="true"></i>
            <span><b>Compromiso acordado:</b> ${escapeHtml(w.commitment)}</span>
          </div>
        ` : ''}
        <p class="text-[10px] text-violet-300/60">Registrado por: <b>${escapeHtml(w.author)}</b></p>
      </div>
    `;
  }).join('');
}

window.deleteWarning = function(id) {
  state.warnings = state.warnings.filter(w => w.id !== id);
  persistAndSyncState();
  refreshAllUI();
};

// ============================================================================
// 9. MÓDULO BRIGADAS COMERCIALES (SIN CHECKBOXES NI SPINNERS NATIVOS)
// ============================================================================
function calculateUserXP(userName) {
  const userVisits = state.visits.filter(v => v.brigadista_nombre === userName);
  let xp = 0;
  userVisits.forEach(v => {
    xp += 10;
    if ((v.interlocutor || '').includes('Dueño')) xp += 15;
    if (v.resultado === 'interesado') xp += 50;
    else if (v.resultado === 'solo_info') xp += 20;
    if (v.tenia_carnet && v.tenia_tarjetas && v.tenia_folletos) xp += 5;
  });
  return xp;
}

function getRankFromXP(xp) {
  if (xp >= 450) return { title: 'Leyenda de Brigada', icon: 'crown' };
  if (xp >= 250) return { title: 'Closer de Calle', icon: 'flame' };
  if (xp >= 100) return { title: 'Cazador Comercial', icon: 'target' };
  return { title: 'Explorador', icon: 'compass' };
}

function fireCelebrationConfetti(isBigGoal = false) {
  if (typeof confetti !== 'function') return;
  if (isBigGoal) {
    confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
  } else {
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
  }
}

window.adjustDailyGoal = function(delta) {
  const input = document.getElementById('inputMetaDiaria');
  if (!input) return;
  const current = parseInt(input.value, 10) || 12;
  const next = Math.max(1, Math.min(100, current + delta));
  input.value = next;
};

window.togglePreCheck = function(item) {
  const map = {
    carnet: {
      card: 'checkCardCarnet',
      pill: 'switchPillCarnet',
      label: 'labelCarnetState',
      yes: 'Sí, visible y puesto',
      no: 'No llevo carnet hoy'
    },
    tarjetas: {
      card: 'checkCardTarjetas',
      pill: 'switchPillTarjetas',
      label: 'labelTarjetasState',
      yes: 'Sí, llevo tarjetas',
      no: 'Sin tarjetas hoy'
    },
    folletos: {
      card: 'checkCardFolletos',
      pill: 'switchPillFolletos',
      label: 'labelFolletosState',
      yes: 'Sí, llevo folletos',
      no: 'Sin folletos hoy'
    }
  };
  const cfg = map[item];
  if (!cfg) return;

  state.preForm[item] = !state.preForm[item];
  const isEquipped = state.preForm[item];

  const card = document.getElementById(cfg.card);
  const pill = document.getElementById(cfg.pill);
  const label = document.getElementById(cfg.label);

  card?.setAttribute('aria-checked', isEquipped ? 'true' : 'false');

  if (isEquipped) {
    card?.classList.add('equipped');
    card?.classList.remove('not-equipped');
    if (label) {
      label.textContent = cfg.yes;
      label.className = 'text-xs font-bold text-violet-300 mt-0.5';
    }
    if (pill) {
      pill.className = 'w-7 h-7 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow shrink-0';
      pill.innerHTML = '<i data-lucide="check" class="w-4 h-4" aria-hidden="true"></i>';
    }
  } else {
    card?.classList.remove('equipped');
    card?.classList.add('not-equipped');
    if (label) {
      label.textContent = cfg.no;
      label.className = 'text-xs font-bold text-rose-300 mt-0.5';
    }
    if (pill) {
      pill.className = 'w-7 h-7 rounded-xl bg-rose-500/25 border border-rose-400/40 text-rose-200 flex items-center justify-center shrink-0';
      pill.innerHTML = '<i data-lucide="x" class="w-4 h-4" aria-hidden="true"></i>';
    }
  }

  const c = state.preForm.carnet ? 1 : 0;
  const t = state.preForm.tarjetas ? 1 : 0;
  const f = state.preForm.folletos ? 1 : 0;
  const pct = Math.round(((c + t + f) / 3) * 100);
  setText('readinessScoreText', `${pct}% Equipado`);
  refreshLucideIcons();
};

window.confirmPreBrigada = async function() {
  if (!state.currentUser) return;

  const tiene_carnet = state.preForm.carnet;
  const tiene_tarjetas = state.preForm.tarjetas;
  const tiene_folletos = state.preForm.folletos;
  const zona = document.getElementById('inputZonaBrigada')?.value.trim() || 'Sector Comercial';
  const meta_diaria = parseInt(document.getElementById('inputMetaDiaria')?.value, 10) || 12;

  state.preCheckin = {
    id: 'ses_' + Date.now(),
    fecha: getTodayISO(),
    brigadista_id: state.currentUser.id,
    brigadista_nombre: state.currentUser.nombre,
    tiene_carnet,
    tiene_tarjetas,
    tiene_folletos,
    zona,
    meta_diaria,
    completed: true
  };

  state.currentUser.meta = meta_diaria;
  persistAndSyncState();

  const defaultMat = ['Explicación verbal'];
  if (tiene_folletos) defaultMat.unshift('Folleto');
  if (tiene_tarjetas) defaultMat.unshift('Tarjeta');
  state.form.material = defaultMat;
  syncMaterialChipsUI();

  refreshAllUI();
  showToast('Equipamiento confirmado. Ya puedes anotar negocios rápido.');
  setTimeout(() => document.getElementById('negocioNombre')?.focus(), 150);
};

window.reopenPreBrigada = function() {
  document.getElementById('preBrigadaCard')?.classList.remove('hidden');
  document.getElementById('brigadaWorkspaceGrid')?.classList.add('hidden');
};

window.selectRubro = function(rubro) {
  state.form.rubro = rubro;
  document.querySelectorAll('#rubroChips button').forEach(btn => {
    if (btn.getAttribute('data-rubro') === rubro) btn.classList.add('active-blue');
    else btn.classList.remove('active-blue');
  });
};

window.selectInterlocutor = function(persona) {
  state.form.interlocutor = persona;
  document.querySelectorAll('#interlocutorChips button').forEach(btn => {
    if (btn.getAttribute('onclick').includes(persona)) btn.classList.add('active-indigo');
    else btn.classList.remove('active-indigo');
  });
};

window.toggleMaterial = function(mat) {
  const idx = state.form.material.indexOf(mat);
  if (idx >= 0) state.form.material.splice(idx, 1);
  else state.form.material.push(mat);
  syncMaterialChipsUI();
};

function syncMaterialChipsUI() {
  document.querySelectorAll('#materialChips button').forEach(btn => {
    const mat = btn.getAttribute('data-mat');
    if (state.form.material.includes(mat)) btn.classList.add('active-indigo');
    else btn.classList.remove('active-indigo');
  });
}

window.selectVisitResult = function(resultado) {
  state.form.resultado = resultado;

  document.getElementById('cardResultHot')?.classList.toggle('selected-hot', resultado === 'interesado');
  document.getElementById('cardResultWarm')?.classList.toggle('selected-warm', resultado === 'solo_info');
  document.getElementById('cardResultCold')?.classList.toggle('selected-cold', resultado === 'no_interesado');

  const preset = OUTCOME_PRESETS[resultado];
  setText('outcomeChipsLabel', preset.label);
  setText('conditionsLabel', preset.condLabel);
  const notesEl = document.getElementById('condicionesNotas');
  if (notesEl) notesEl.placeholder = preset.placeholder;

  state.form.motivo_estado = preset.chips[0];
  renderOutcomeSubChips(preset.chips);
};

function renderOutcomeSubChips(chips) {
  const container = document.getElementById('outcomeQuickChips');
  if (!container) return;
  container.innerHTML = chips.map(chipText => {
    const isSelected = state.form.motivo_estado === chipText;
    return `
      <button
        type="button"
        onclick="selectOutcomeChip('${escapeHtml(chipText)}')"
        class="chip-btn ${isSelected ? 'active-blue' : ''} min-h-[38px] px-3.5 py-2 rounded-xl text-xs font-bold text-left"
      >
        ${escapeHtml(chipText)}
      </button>
    `;
  }).join('');
}

window.selectOutcomeChip = function(chipText) {
  state.form.motivo_estado = chipText;
  renderOutcomeSubChips(OUTCOME_PRESETS[state.form.resultado].chips);
};

window.toggleVoiceDictation = function() {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) {
    showToast('Usa Chrome, Edge o Safari para dictar por voz.');
    return;
  }

  const btn = document.getElementById('btnVoiceDictation');
  const btnText = document.getElementById('voiceBtnText');
  const textarea = document.getElementById('condicionesNotas');

  if (state.isRecordingVoice && state.recognition) {
    state.recognition.stop();
    return;
  }

  const recognition = new SpeechRec();
  recognition.lang = 'es-CO';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  state.recognition = recognition;

  recognition.onstart = () => {
    state.isRecordingVoice = true;
    btn?.classList.add('mic-recording');
    if (btnText) btnText.textContent = 'Escuchando…';
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    textarea.value = textarea.value ? `${textarea.value.trim()} ${transcript}` : transcript;
    showToast('Condición anotada por voz');
  };

  recognition.onend = () => {
    state.isRecordingVoice = false;
    btn?.classList.remove('mic-recording');
    if (btnText) btnText.textContent = 'Dictar con voz';
  };

  recognition.start();
};

function checkDuplicateBusiness() {
  const nombre = document.getElementById('negocioNombre')?.value.trim().toLowerCase() || '';
  const dir = document.getElementById('negocioDireccion')?.value.trim().toLowerCase() || '';
  const warnBox = document.getElementById('duplicateWarning');
  if (!warnBox) return;

  if (nombre.length < 3 && dir.length < 5) {
    warnBox.classList.add('hidden');
    return;
  }

  const match = state.visits.find(v => {
    const matchName = nombre.length >= 4 && v.negocio_nombre.toLowerCase().includes(nombre);
    const matchDir = dir.length >= 6 && v.direccion.toLowerCase().includes(dir);
    return matchName || matchDir;
  });

  if (match) {
    const statusText = match.resultado === 'interesado'
      ? 'Muy Interesado'
      : (match.resultado === 'solo_info' ? 'Ya recibió info / Ya tiene sistema' : 'No interesado');
    warnBox.innerHTML = `
      <div class="flex items-start gap-2">
        <i data-lucide="alert-circle" class="w-4 h-4 text-amber-300 shrink-0 mt-0.5" aria-hidden="true"></i>
        <span><b>Radar Anti-Duplicados:</b> Ya se registró <b>${escapeHtml(match.negocio_nombre)}</b> en <b>${escapeHtml(match.direccion)}</b> por ${escapeHtml(match.brigadista_nombre)} — <span class="underline">${statusText}</span> (${escapeHtml(match.motivo_estado || '')}).</span>
      </div>
    `;
    warnBox.classList.remove('hidden');
    refreshLucideIcons();
  } else {
    warnBox.classList.add('hidden');
  }
}

window.detectAddressByGps = function() {
  if (!navigator.geolocation) {
    showToast('Tu navegador no soporta geolocalización.');
    return;
  }

  const label = document.getElementById('gpsBtnLabel');
  if (label) label.textContent = 'Buscando…';

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      state.form.gps_lat = lat;
      state.form.gps_lng = lng;

      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
        const data = await res.json();
        const road = data?.address?.road || data?.address?.pedestrian || '';
        const houseNumber = data?.address?.house_number || '';
        const suburb = data?.address?.suburb || data?.address?.neighbourhood || '';
        const composed = [road, houseNumber, suburb].filter(Boolean).join(', ');
        document.getElementById('negocioDireccion').value = composed || `GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      } catch {
        document.getElementById('negocioDireccion').value = `GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      }

      if (label) label.textContent = 'Listo';
      checkDuplicateBusiness();
    },
    () => {
      if (label) label.textContent = 'GPS';
      showToast('Activa el permiso de ubicación o escribe la dirección.');
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
};

async function handleVisitSubmit(e) {
  e.preventDefault();
  if (!state.currentUser) return;

  const negocio_nombre = document.getElementById('negocioNombre').value.trim();
  const direccion = document.getElementById('negocioDireccion').value.trim();
  if (!negocio_nombre || !direccion) return;

  const condiciones_notas = document.getElementById('condicionesNotas').value.trim();
  const contacto_nombre = document.getElementById('contactoNombre').value.trim();
  const contacto_telefono = document.getElementById('contactoTelefono').value.trim();

  const baseLat = state.form.gps_lat || (4.6533 + (Math.random() - 0.5) * 0.018);
  const baseLng = state.form.gps_lng || (-74.0602 + (Math.random() - 0.5) * 0.018);

  const newVisit = {
    id: 'vis_' + Date.now(),
    sesion_id: state.preCheckin?.id || 'ses_default',
    fecha: getTodayISO(),
    hora: getCurrentTimeFormatted(),
    brigadista_id: state.currentUser.id,
    brigadista_nombre: state.currentUser.nombre,
    tenia_carnet: state.preCheckin ? state.preCheckin.tiene_carnet : true,
    tenia_tarjetas: state.preCheckin ? state.preCheckin.tiene_tarjetas : true,
    tenia_folletos: state.preCheckin ? state.preCheckin.tiene_folletos : true,
    zona: state.preCheckin?.zona || 'Sector Comercial',
    negocio_nombre,
    negocio_rubro: state.form.rubro,
    direccion,
    gps_lat: baseLat,
    gps_lng: baseLng,
    interlocutor: state.form.interlocutor,
    material_entregado: [...state.form.material],
    resultado: state.form.resultado,
    motivo_estado: state.form.motivo_estado,
    condiciones_notas,
    contacto_nombre,
    contacto_telefono,
    created_at: new Date().toISOString()
  };

  state.visits.unshift(newVisit);
  state.lastSavedVisit = newVisit;
  await persistAndSyncState();

  if (state.supabase) {
    try {
      const { id, ...payload } = newVisit;
      await state.supabase.from('acercamientos').insert([payload]);
    } catch (err) {
      console.warn('Sync tabla acercamientos:', err);
    }
  }

  document.getElementById('negocioNombre').value = '';
  document.getElementById('condicionesNotas').value = '';
  document.getElementById('contactoNombre').value = '';
  document.getElementById('contactoTelefono').value = '';
  document.getElementById('duplicateWarning')?.classList.add('hidden');
  state.form.gps_lat = null;
  state.form.gps_lng = null;
  setText('gpsBtnLabel', 'GPS');

  refreshAllUI();

  const myTodayVisits = state.visits.filter(
    v => v.fecha === getTodayISO() && v.brigadista_nombre === state.currentUser.nombre
  );
  const goal = state.preCheckin?.meta_diaria || state.currentUser.meta || 12;

  if (myTodayVisits.length === goal) {
    fireCelebrationConfetti(true);
    showToast(`Meta cumplida: llegaste a tus ${goal} acercamientos de hoy.`);
  } else if (newVisit.resultado === 'interesado') {
    fireCelebrationConfetti(false);
    showToast(`+50 XP · Cliente interesado guardado (${myTodayVisits.length}/${goal})`);
  } else {
    showToast(`Guardado: ${negocio_nombre} (${myTodayVisits.length}/${goal} hoy)`);
  }

  document.getElementById('negocioNombre')?.focus();
}

// ============================================================================
// 10. ACTUALIZACIÓN INTEGRAL DE TODA LA INTERFAZ
// ============================================================================
function refreshAllUI() {
  if (!state.currentUser) return;

  renderCustomUserMenus();
  renderHubDashboard();
  renderDailiesList();
  renderTasksList();
  renderWarningsList();

  // Progreso de Meta de Brigada (12 acercamientos)
  const todayISO = getTodayISO();
  const myToday = state.visits.filter(v => v.fecha === todayISO && v.brigadista_nombre === state.currentUser.nombre);
  const myHotToday = myToday.filter(v => v.resultado === 'interesado').length;
  const myInfoToday = myToday.filter(v => v.resultado === 'solo_info').length;
  const goal = state.preCheckin?.meta_diaria || state.currentUser.meta || 12;
  const pct = Math.min(100, Math.round((myToday.length / goal) * 100));

  setText('goalProgressCounter', `${myToday.length} / ${goal}`);
  setText('drawerGoalSummary', `Meta de brigada hoy: ${myToday.length} / ${goal} acercamientos`);
  setText('hotProgressCounter', myHotToday);
  setText('infoProgressCounter', myInfoToday);
  const bar = document.getElementById('goalProgressBar');
  if (bar) bar.style.width = `${pct}%`;

  const circumference = 263.89;
  const offset = circumference - (pct / 100) * circumference;
  const radialCircle = document.getElementById('radialGoalCircle');
  if (radialCircle) radialCircle.style.strokeDashoffset = offset;
  setText('radialPctText', `${pct}%`);

  const missionPill = document.getElementById('missionStatusPill');
  const missionHelper = document.getElementById('missionHelperText');
  if (missionPill && missionHelper) {
    const remaining = Math.max(0, goal - myToday.length);
    if (remaining === 0) {
      missionPill.textContent = 'Objetivo de Brigada Logrado';
      missionHelper.innerHTML = `Completaste la meta de <b>${goal} visitas</b> hoy con <b>${myHotToday} clientes muy interesados</b>.`;
    } else {
      missionPill.textContent = `Faltan ${remaining} visitas para tu meta`;
      missionHelper.innerHTML = `Llevas <b>${myToday.length} de ${goal}</b> acercamientos hoy y <b>${myHotToday} muy interesados</b>.`;
    }
  }

  setText('deskHistoryCount', state.visits.length);

  if (state.preCheckin && state.preCheckin.completed) {
    document.getElementById('preBrigadaCard')?.classList.add('hidden');
    document.getElementById('brigadaWorkspaceGrid')?.classList.remove('hidden');

    setBadgeStatus('badgeCarnet', 'Carnet', state.preCheckin.tiene_carnet);
    setBadgeStatus('badgeTarjetas', 'Tarjetas', state.preCheckin.tiene_tarjetas);
    setBadgeStatus('badgeFolletos', 'Folletos', state.preCheckin.tiene_folletos);
    setText('badgeZona', state.preCheckin.zona);
  } else {
    document.getElementById('preBrigadaCard')?.classList.remove('hidden');
    document.getElementById('brigadaWorkspaceGrid')?.classList.add('hidden');
  }

  if (!document.getElementById('outcomeQuickChips')?.innerHTML.trim()) {
    selectVisitResult(state.form.resultado);
  }

  populateBrigadistaFilter();
  renderLastSavedWhatsAppBox();
  renderRecentMiniList();
  renderHistoryList();
  renderLeaderboardAndBadges();
  renderAnalytics();
  refreshLucideIcons();
}

function setBadgeStatus(id, label, active) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = `${label}: ${active ? 'Sí' : 'No'}`;
  el.className = active
    ? 'px-2.5 py-1 rounded-full font-bold bg-violet-500/20 text-violet-200 border border-violet-400/30'
    : 'px-2.5 py-1 rounded-full font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30';
}

function renderLastSavedWhatsAppBox() {
  const box = document.getElementById('lastSavedHighlightBox');
  if (!box) return;
  const v = state.lastSavedVisit;
  if (!v || !v.contacto_telefono) {
    box.classList.add('hidden');
    return;
  }

  const cleanPhone = v.contacto_telefono.replace(/\D/g, '');
  const condMsg = v.condiciones_notas ? ` Tuvimos muy en cuenta lo que nos comentaste sobre: “${v.condiciones_notas}”.` : '';
  const message = `Hola ${v.contacto_nombre || ''}, qué gusto saludarte hoy en ${v.negocio_nombre}. Soy ${v.brigadista_nombre} del equipo de la brigada.${condMsg} Te comparto por aquí nuestro contacto directo.`;
  const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

  box.innerHTML = `
    <div class="flex items-center justify-between">
      <span class="inline-flex items-center gap-1.5 text-[11px] font-extrabold bg-violet-500/25 text-violet-200 px-2.5 py-0.5 rounded-full">
        <i data-lucide="message-circle" class="w-3.5 h-3.5" aria-hidden="true"></i>
        <span>Seguimiento Instantáneo Listo</span>
      </span>
      <button type="button" onclick="document.getElementById('lastSavedHighlightBox').classList.add('hidden')" aria-label="Cerrar seguimiento" class="text-xs text-violet-300 hover:text-white cursor-pointer">
        <i data-lucide="x" class="w-4 h-4" aria-hidden="true"></i>
      </button>
    </div>
    <p class="text-xs font-bold text-white">
      Envíale un WhatsApp ahora mismo a <span class="text-violet-300">${escapeHtml(v.negocio_nombre)}</span> con sus condiciones pre-cargadas:
    </p>
    <a
      href="${waUrl}"
      target="_blank"
      rel="noopener noreferrer"
      class="btn-purple-primary w-full min-h-[44px] py-2.5 px-4 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2"
    >
      <i data-lucide="send" class="w-4 h-4" aria-hidden="true"></i>
      <span>Abrir Chat de WhatsApp con ${escapeHtml(v.contacto_nombre || v.negocio_nombre)}</span>
    </a>
  `;
  box.classList.remove('hidden');
}

function renderRecentMiniList() {
  const container = document.getElementById('recentVisitsMiniList');
  if (!container) return;

  const recent = state.visits.slice(0, 4);
  container.innerHTML = recent.map(v => {
    const badge = getOutcomeBadgeHTML(v.resultado);
    return `
      <div class="p-3.5 rounded-2xl glass-panel space-y-1.5">
        <div class="flex items-center justify-between gap-2">
          <p class="font-extrabold text-xs text-white truncate">${escapeHtml(v.negocio_nombre)}</p>
          ${badge}
        </div>
        <p class="text-[11px] text-violet-300/70 truncate flex items-center gap-1.5">
          <i data-lucide="map-pin" class="w-3 h-3 text-violet-300 shrink-0" aria-hidden="true"></i>
          <span class="truncate">${escapeHtml(v.direccion)} · <span class="text-violet-200">${escapeHtml(v.motivo_estado || '')}</span></span>
        </p>
        ${v.condiciones_notas ? `
          <p class="text-[11px] text-violet-200 bg-violet-500/15 border border-violet-500/30 px-2.5 py-1 rounded-lg truncate">
            “${escapeHtml(v.condiciones_notas)}”
          </p>
        ` : ''}
      </div>
    `;
  }).join('');
}

window.selectHistoryResultFilter = function(value, label) {
  state.historyResultFilter = value;
  setText('labelFilterHistoryResult', label);
  closeAllCustomDropdowns();
  renderHistoryList();
  refreshLucideIcons();
};

window.selectHistoryBrigadistaFilter = function(value, label) {
  state.historyBrigadistaFilter = value;
  setText('labelFilterHistoryBrigadista', label);
  closeAllCustomDropdowns();
  renderHistoryList();
  refreshLucideIcons();
};

function populateBrigadistaFilter() {
  const menu = document.getElementById('historyBrigadistaMenu');
  if (!menu) return;

  const uniqueNames = [...new Set(state.visits.map(v => v.brigadista_nombre))];
  const allItems = [
    { val: 'all', label: 'Todos los brigadistas', icon: 'users' },
    ...uniqueNames.map(n => ({ val: n, label: n, icon: 'user' }))
  ];

  menu.innerHTML = allItems.map(item => {
    const isSelected = state.historyBrigadistaFilter === item.val;
    return `
      <button
        type="button"
        onclick="selectHistoryBrigadistaFilter('${escapeHtml(item.val)}', '${escapeHtml(item.label)}')"
        class="w-full min-h-[40px] px-3 py-2 rounded-xl flex items-center justify-between text-xs font-bold ${isSelected ? 'bg-violet-600 text-white' : 'text-violet-100 hover:bg-violet-600/30'} cursor-pointer"
      >
        <span class="flex items-center gap-2 truncate">
          <i data-lucide="${item.icon}" class="w-4 h-4 text-violet-300 shrink-0" aria-hidden="true"></i>
          <span class="truncate">${escapeHtml(item.label)}</span>
        </span>
        ${isSelected ? '<i data-lucide="check" class="w-3.5 h-3.5 shrink-0" aria-hidden="true"></i>' : ''}
      </button>
    `;
  }).join('');
}

function renderBrigadaMap(filteredVisits) {
  const mapEl = document.getElementById('brigadaMap');
  if (!mapEl || typeof L === 'undefined') return;

  if (!state.map) {
    state.map = L.map('brigadaMap').setView([4.6533, -74.0602], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap'
    }).addTo(state.map);
    state.mapMarkersLayer = L.layerGroup().addTo(state.map);
  }

  state.mapMarkersLayer.clearLayers();
  const bounds = [];

  filteredVisits.forEach((v, idx) => {
    const lat = v.gps_lat || (4.6533 + Math.sin(idx * 1.7) * 0.006);
    const lng = v.gps_lng || (-74.0602 + Math.cos(idx * 1.7) * 0.006);
    bounds.push([lat, lng]);

    const color = v.resultado === 'interesado' ? '#8b5cf6' : (v.resultado === 'solo_info' ? '#f59e0b' : '#64748b');
    const marker = L.circleMarker([lat, lng], {
      radius: 9,
      fillColor: color,
      color: '#ffffff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.9
    });

    marker.bindPopup(`
      <div style="font-family: sans-serif; min-width: 190px; color: #0f172a;">
        <b style="font-size: 13px;">${escapeHtml(v.negocio_nombre)}</b><br/>
        <span style="font-size: 11px; color: #475569;">Dirección: ${escapeHtml(v.direccion)}</span><br/>
        <span style="font-size: 11px; font-weight: bold; color: ${color};">Estado: ${escapeHtml(v.motivo_estado || v.resultado)}</span>
        ${v.condiciones_notas ? `<p style="font-size: 11px; background:#f1f5f9; padding:4px 6px; border-radius:6px; margin-top:4px;">“${escapeHtml(v.condiciones_notas)}”</p>` : ''}
      </div>
    `);
    state.mapMarkersLayer.addLayer(marker);
  });

  setTimeout(() => {
    state.map.invalidateSize();
    if (bounds.length > 0) state.map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
  }, 150);
}

window.renderHistoryList = function() {
  const container = document.getElementById('fullHistoryList');
  if (!container) return;

  const query = (document.getElementById('searchHistoryInput')?.value || '').trim().toLowerCase();
  const filterResult = state.historyResultFilter || 'all';
  const filterBrigadista = state.historyBrigadistaFilter || 'all';

  const filtered = state.visits.filter(v => {
    const matchesResult = filterResult === 'all' || v.resultado === filterResult;
    const matchesBrig = filterBrigadista === 'all' || v.brigadista_nombre === filterBrigadista;
    const matchesQuery = !query ||
      v.negocio_nombre.toLowerCase().includes(query) ||
      v.direccion.toLowerCase().includes(query) ||
      (v.condiciones_notas || '').toLowerCase().includes(query) ||
      (v.motivo_estado || '').toLowerCase().includes(query) ||
      v.brigadista_nombre.toLowerCase().includes(query);
    return matchesResult && matchesBrig && matchesQuery;
  });

  if (state.activeModule === 'brigadas' && !document.getElementById('tabHistory')?.classList.contains('hidden')) {
    renderBrigadaMap(filtered);
  }

  container.innerHTML = filtered.map(v => {
    const badge = getOutcomeBadgeHTML(v.resultado);
    const materials = Array.isArray(v.material_entregado) && v.material_entregado.length > 0
      ? v.material_entregado.join(' + ')
      : 'Pitch verbal';
    const waLink = v.contacto_telefono
      ? `https://wa.me/${v.contacto_telefono.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${v.contacto_nombre || ''}, te escribimos tras nuestra visita hoy a ${v.negocio_nombre}.`)}`
      : null;

    return `
      <div class="glass-card rounded-3xl p-5 flex flex-col justify-between gap-3">
        <div class="space-y-2.5">
          <div class="flex items-start justify-between gap-2">
            <div>
              <h4 class="font-extrabold text-base text-white">${escapeHtml(v.negocio_nombre)}</h4>
              <p class="text-xs text-violet-300 font-semibold flex items-center gap-1 mt-0.5">
                <i data-lucide="map-pin" class="w-3.5 h-3.5 shrink-0" aria-hidden="true"></i>
                <span>${escapeHtml(v.direccion)}</span>
              </p>
            </div>
            ${badge}
          </div>

          <div class="flex flex-wrap gap-1.5 text-[11px]">
            <span class="px-2.5 py-0.5 rounded-lg glass-panel text-violet-200 font-semibold">${escapeHtml(v.negocio_rubro)}</span>
            <span class="px-2.5 py-0.5 rounded-lg glass-panel text-violet-200 font-semibold">${escapeHtml(v.interlocutor)}</span>
            <span class="px-2.5 py-0.5 rounded-lg glass-panel text-violet-200 font-semibold">${escapeHtml(materials)}</span>
          </div>

          <p class="text-xs text-violet-200 font-semibold">
            Caso: <span class="text-white">${escapeHtml(v.motivo_estado || 'Registrado')}</span>
          </p>

          ${v.condiciones_notas ? `
            <div class="bg-violet-500/15 border border-violet-500/30 rounded-2xl p-3 text-xs text-violet-100 font-medium">
              <b>Condición / Nota:</b> “${escapeHtml(v.condiciones_notas)}”
            </div>
          ` : ''}
        </div>

        <div class="flex items-center justify-between pt-3 border-t border-violet-400/15 text-[11px] text-violet-300/70">
          <div class="flex items-center gap-1.5">
            <i data-lucide="user" class="w-3.5 h-3.5 text-violet-300" aria-hidden="true"></i>
            <span><b class="text-white">${escapeHtml(v.brigadista_nombre)}</b></span>
            <span>·</span>
            <span class="tabular-nums">${escapeHtml(v.fecha)} ${escapeHtml(v.hora)}</span>
          </div>
          <div class="flex items-center gap-2">
            ${waLink ? `
              <a href="${waLink}" target="_blank" rel="noopener noreferrer" class="btn-purple-primary px-3 py-1.5 rounded-xl font-extrabold text-xs inline-flex items-center gap-1.5">
                <i data-lucide="message-circle" class="w-3.5 h-3.5" aria-hidden="true"></i>
                <span>WhatsApp</span>
              </a>
            ` : ''}
            <button
              type="button"
              onclick="deleteVisit('${v.id}')"
              aria-label="Eliminar visita"
              class="min-h-[34px] min-w-[34px] rounded-lg text-violet-300/60 hover:text-rose-300 hover:bg-rose-500/15 flex items-center justify-center cursor-pointer"
            >
              <i data-lucide="trash-2" class="w-4 h-4" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  refreshLucideIcons();
};

window.deleteVisit = function(id) {
  state.visits = state.visits.filter(v => v.id !== id);
  localStorage.setItem(STORAGE_KEYS.VISITS, JSON.stringify(state.visits));
  refreshAllUI();
};

function getOutcomeBadgeHTML(resultado) {
  if (resultado === 'interesado') {
    return `
      <span class="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-violet-500/25 text-violet-200 border border-violet-400/40 shrink-0">
        <i data-lucide="flame" class="w-3 h-3 text-violet-300" aria-hidden="true"></i>
        <span>Muy Interesado</span>
      </span>
    `;
  }
  if (resultado === 'solo_info') {
    return `
      <span class="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
        <i data-lucide="cloud-sun" class="w-3 h-3 text-amber-300" aria-hidden="true"></i>
        <span>Info / Ya tiene</span>
      </span>
    `;
  }
  return `
    <span class="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
      <i data-lucide="snowflake" class="w-3 h-3 text-slate-400" aria-hidden="true"></i>
      <span>No interesado</span>
    </span>
  `;
}

function renderLeaderboardAndBadges() {
  const rankContainer = document.getElementById('brigadistasRankingList');
  const badgesContainer = document.getElementById('badgesGridContainer');
  if (!rankContainer || !badgesContainer) return;

  const grouped = {};
  state.visits.forEach(v => {
    if (!grouped[v.brigadista_nombre]) {
      grouped[v.brigadista_nombre] = { total: 0, hot: 0, info: 0, ownerCount: 0, fullKitCount: 0 };
    }
    const g = grouped[v.brigadista_nombre];
    g.total += 1;
    if (v.resultado === 'interesado') g.hot += 1;
    if (v.resultado === 'solo_info') g.info += 1;
    if ((v.interlocutor || '').includes('Dueño')) g.ownerCount += 1;
    if (v.tenia_carnet && v.tenia_tarjetas && v.tenia_folletos) g.fullKitCount += 1;
  });

  const rows = Object.entries(grouped).sort((a, b) => calculateUserXP(b[0]) - calculateUserXP(a[0]));

  rankContainer.innerHTML = rows.map(([nombre, stats], idx) => {
    const goal = 12;
    const pct = Math.min(100, Math.round((stats.total / goal) * 100));
    const xp = calculateUserXP(nombre);
    const rank = getRankFromXP(xp);

    return `
      <div class="p-4 rounded-2xl glass-panel space-y-2.5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl ${idx === 0 ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30' : 'bg-violet-500/20 text-violet-200 border border-violet-400/30'} flex items-center justify-center font-extrabold text-sm tabular-nums">
              #${idx + 1}
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="font-extrabold text-base text-white">${escapeHtml(nombre)}</span>
                <span class="inline-flex items-center gap-1 text-xs font-extrabold text-violet-300">
                  <i data-lucide="${rank.icon}" class="w-3.5 h-3.5" aria-hidden="true"></i>
                  <span>${rank.title}</span>
                </span>
              </div>
              <p class="text-[11px] text-violet-300/70 tabular-nums">${xp} XP acumulados · ${stats.ownerCount} dueños contactados</p>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2 text-xs tabular-nums">
            <span class="font-extrabold text-white glass-panel px-3 py-1 rounded-full">${stats.total} / ${goal} visitas</span>
            <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-violet-500/25 text-violet-200 border border-violet-400/30 font-extrabold">
              <i data-lucide="flame" class="w-3.5 h-3.5" aria-hidden="true"></i>
              <span>${stats.hot} interesados</span>
            </span>
            <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold">
              <i data-lucide="cloud-sun" class="w-3.5 h-3.5" aria-hidden="true"></i>
              <span>${stats.info} solo info</span>
            </span>
          </div>
        </div>

        <div class="w-full h-2.5 bg-[#09070f] rounded-full overflow-hidden p-0.5">
          <div class="h-full bg-violet-500 rounded-full transition-[width] duration-500" style="width: ${pct}%"></div>
        </div>
      </div>
    `;
  }).join('');

  const totalHot = state.visits.filter(v => v.resultado === 'interesado').length;
  const totalOwners = state.visits.filter(v => (v.interlocutor || '').includes('Dueño')).length;
  const totalKit = state.visits.filter(v => v.tenia_carnet && v.tenia_tarjetas && v.tenia_folletos).length;
  const any12 = rows.some(([, s]) => s.total >= 12);

  const badges = [
    { icon: 'id-card', title: 'Embajador con Kit Completo', desc: `${totalKit} acercamientos con Carnet + Tarjeta + Folleto.`, unlocked: totalKit > 0 },
    { icon: 'crown', title: 'Francotirador de Decisores', desc: `${totalOwners} conversaciones directas con el Dueño.`, unlocked: totalOwners >= 2 },
    { icon: 'flame', title: 'Imán de Prospectos Calientes', desc: `${totalHot} clientes muy interesados registrados.`, unlocked: totalHot >= 2 },
    { icon: 'trophy', title: 'Meta 12/12 Completada', desc: 'Alcanzar los 12 acercamientos diarios de la brigada.', unlocked: any12 }
  ];

  badgesContainer.innerHTML = badges.map(b => `
    <div class="p-4 rounded-2xl border ${b.unlocked ? 'glass-panel border-violet-400/40' : 'bg-[#120d20]/50 border-white/5 opacity-55'} space-y-2">
      <div class="flex items-center justify-between">
        <div class="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-400/30 flex items-center justify-center text-violet-200">
          <i data-lucide="${b.icon}" class="w-5 h-5" aria-hidden="true"></i>
        </div>
        <span class="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${b.unlocked ? 'bg-violet-500/25 text-violet-200' : 'bg-slate-800 text-slate-400'}">
          ${b.unlocked ? 'Desbloqueada' : 'En curso'}
        </span>
      </div>
      <p class="font-extrabold text-sm text-white">${b.title}</p>
      <p class="text-xs text-violet-200/70 leading-relaxed">${b.desc}</p>
    </div>
  `).join('');

  refreshLucideIcons();
}

function renderAnalytics() {
  const visits = state.visits;
  const total = visits.length;
  const hot = visits.filter(v => v.resultado === 'interesado');
  const warm = visits.filter(v => v.resultado === 'solo_info');
  const cold = visits.filter(v => v.resultado === 'no_interesado');

  const convRate = total > 0 ? Math.round((hot.length / total) * 100) : 0;
  const alreadyHasSystemCount = visits.filter(v =>
    (v.motivo_estado || '').toLowerCase().includes('ya tiene sistema') ||
    (v.condiciones_notas || '').toLowerCase().includes('tiene sistema')
  ).length;

  const withCarnet = visits.filter(v => v.tenia_carnet);
  const carnetRate = total > 0 ? Math.round((withCarnet.length / total) * 100) : 100;
  const withOwner = visits.filter(v => (v.interlocutor || '').includes('Dueño'));
  const ownerRate = total > 0 ? Math.round((withOwner.length / total) * 100) : 0;

  setText('kpiTotalVisits', total);
  setText('kpiHotLeads', hot.length);
  setText('kpiConversionRate', `${convRate}% tasa de interés positivo`);
  setText('kpiWarmInfo', warm.length);
  setText('kpiAlreadyHasSystem', `${alreadyHasSystemCount} dijeron “Ya tengo sistema”`);
  setText('kpiCarnetRate', `${carnetRate}%`);
  setText('kpiDecisionMakerRate', `${ownerRate}% hablaron con el dueño`);

  renderSmartInsights(visits, hot, alreadyHasSystemCount);
  renderHotLeadsTable(hot);

  if (state.activeModule === 'brigadas' && !document.getElementById('tabAnalytics')?.classList.contains('hidden')) {
    renderCharts(hot.length, warm.length, cold.length, visits);
  }
}

function renderSmartInsights(visits, hot, alreadyHasSystemCount) {
  const box = document.getElementById('aiInsightsContainer');
  if (!box) return;

  const ownerVisits = visits.filter(v => (v.interlocutor || '').includes('Dueño'));
  const ownerHot = ownerVisits.filter(v => v.resultado === 'interesado');
  const ownerConv = ownerVisits.length > 0 ? Math.round((ownerHot.length / ownerVisits.length) * 100) : 0;

  const nonOwnerVisits = visits.filter(v => !(v.interlocutor || '').includes('Dueño'));
  const nonOwnerHot = nonOwnerVisits.filter(v => v.resultado === 'interesado');
  const nonOwnerConv = nonOwnerVisits.length > 0 ? Math.round((nonOwnerHot.length / nonOwnerVisits.length) * 100) : 0;

  const fullKitVisits = visits.filter(v => v.tenia_carnet && v.tenia_tarjetas && v.tenia_folletos);
  const fullKitHot = fullKitVisits.filter(v => v.resultado === 'interesado');
  const fullKitConv = fullKitVisits.length > 0 ? Math.round((fullKitHot.length / fullKitVisits.length) * 100) : 0;

  const withConditions = hot.filter(v => v.condiciones_notas && v.condiciones_notas.trim().length > 3);

  box.innerHTML = `
    <div class="p-4 rounded-2xl glass-panel space-y-1.5">
      <p class="text-violet-300 font-extrabold text-xs flex items-center gap-1.5">
        <i data-lucide="crown" class="w-4 h-4" aria-hidden="true"></i>
        <span>Multiplicador por Hablar con el Dueño</span>
      </p>
      <p class="text-violet-100 leading-relaxed">
        Abordar directamente al <b>Dueño/Decisor</b> convierte al <b class="text-violet-300 tabular-nums">${ownerConv}%</b>, mientras que dejar recado con empleados convierte al <b class="tabular-nums">${nonOwnerConv}%</b>.
      </p>
    </div>

    <div class="p-4 rounded-2xl glass-panel space-y-1.5">
      <p class="text-violet-300 font-extrabold text-xs flex items-center gap-1.5">
        <i data-lucide="id-card" class="w-4 h-4" aria-hidden="true"></i>
        <span>Impacto del Check-in (Carnet + Kit)</span>
      </p>
      <p class="text-violet-100 leading-relaxed">
        Salir con <b>Carnet + Tarjetas + Folletos</b> logró un <b class="text-violet-300 tabular-nums">${fullKitConv}%</b> de clientes interesados en ${fullKitVisits.length} locales.
      </p>
    </div>

    <div class="p-4 rounded-2xl glass-panel space-y-1.5">
      <p class="text-violet-300 font-extrabold text-xs flex items-center gap-1.5">
        <i data-lucide="check-circle-2" class="w-4 h-4" aria-hidden="true"></i>
        <span>Condiciones Específicas vs Competencia</span>
      </p>
      <p class="text-violet-100 leading-relaxed">
        Tenemos <b class="text-violet-300 tabular-nums">${withConditions.length} negocios</b> listos si cumplimos sus condiciones, y <b class="tabular-nums">${alreadyHasSystemCount}</b> que ya tienen sistema pero quedaron mapeados.
      </p>
    </div>
  `;
}

function renderHotLeadsTable(hotLeads) {
  const container = document.getElementById('hotLeadsTableContainer');
  if (!container) return;

  container.innerHTML = `
    <table class="w-full text-left border-collapse text-xs">
      <thead>
        <tr class="border-b border-violet-400/15 text-violet-300/80 text-[11px]">
          <th class="py-3 pr-3">Negocio y Dirección</th>
          <th class="py-3 px-3">Condiciones Específicas Solicitadas</th>
          <th class="py-3 px-3">Contacto Directo</th>
          <th class="py-3 pl-3">Brigadista</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-violet-400/10">
        ${hotLeads.map(v => {
          const wa = v.contacto_telefono
            ? `https://wa.me/${v.contacto_telefono.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${v.contacto_nombre || ''}, te saludo respecto a nuestra visita hoy a ${v.negocio_nombre}.`)}`
            : null;
          return `
            <tr class="hover:bg-violet-500/5 transition-colors">
              <td class="py-3.5 pr-3">
                <p class="font-extrabold text-white text-sm">${escapeHtml(v.negocio_nombre)}</p>
                <p class="text-[11px] text-violet-300 flex items-center gap-1 mt-0.5">
                  <i data-lucide="map-pin" class="w-3 h-3 shrink-0" aria-hidden="true"></i>
                  <span>${escapeHtml(v.direccion)}</span>
                </p>
              </td>
              <td class="py-3.5 px-3">
                <span class="inline-block font-bold text-violet-200 bg-violet-500/20 border border-violet-400/30 px-2.5 py-0.5 rounded-lg mb-1">
                  ${escapeHtml(v.motivo_estado || 'Interesado')}
                </span>
                <p class="text-violet-100 font-medium">
                  ${v.condiciones_notas ? `“${escapeHtml(v.condiciones_notas)}”` : '<span class="text-violet-300/50">Sin condición adicional</span>'}
                </p>
              </td>
              <td class="py-3.5 px-3">
                <p class="font-bold text-white">${escapeHtml(v.contacto_nombre || v.interlocutor)}</p>
                ${wa ? `
                  <a href="${wa}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 mt-1 px-2.5 py-1 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-extrabold tabular-nums">
                    <i data-lucide="phone" class="w-3 h-3" aria-hidden="true"></i>
                    <span>${escapeHtml(v.contacto_telefono)}</span>
                  </a>
                ` : '<span class="text-violet-300/50">Sin teléfono</span>'}
              </td>
              <td class="py-3.5 pl-3 text-violet-300/70">
                <p class="font-bold text-violet-100">${escapeHtml(v.brigadista_nombre)}</p>
                <p class="text-[10px] tabular-nums">${escapeHtml(v.fecha)} · ${escapeHtml(v.hora)}</p>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function renderCharts(hotCount, warmCount, coldCount, visits) {
  const ctxOutcomes = document.getElementById('chartOutcomes')?.getContext('2d');
  const ctxReasons = document.getElementById('chartReasons')?.getContext('2d');
  if (!ctxOutcomes || !ctxReasons) return;

  if (state.charts.outcomes) state.charts.outcomes.destroy();
  if (state.charts.reasons) state.charts.reasons.destroy();

  Chart.defaults.color = '#ddd6fe';

  state.charts.outcomes = new Chart(ctxOutcomes, {
    type: 'doughnut',
    data: {
      labels: ['Muy Interesados', 'Solo Info / Ya tiene sistema', 'No interesados'],
      datasets: [{
        data: [hotCount, warmCount, coldCount],
        backgroundColor: ['#8b5cf6', '#f59e0b', '#475569'],
        borderColor: '#130e21',
        borderWidth: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 14, color: '#ede9fe', font: { size: 11, weight: 'bold' } } }
      }
    }
  });

  const reasonCounts = {};
  visits.forEach(v => {
    const key = v.motivo_estado || 'Otro';
    reasonCounts[key] = (reasonCounts[key] || 0) + 1;
  });
  const topReasons = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  state.charts.reasons = new Chart(ctxReasons, {
    type: 'bar',
    data: {
      labels: topReasons.map(r => r[0].length > 28 ? r[0].substring(0, 28) + '…' : r[0]),
      datasets: [{
        label: 'Negocios',
        data: topReasons.map(r => r[1]),
        backgroundColor: '#7c3aed',
        borderRadius: 8
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, ticks: { precision: 0, color: '#c4b5fd' }, grid: { color: 'rgba(139,92,246,0.08)' } },
        y: { ticks: { color: '#f5f3ff', font: { size: 11 } }, grid: { display: false } }
      }
    }
  });
}

window.switchTab = function(tab) {
  const sections = {
    capture: document.getElementById('tabCapture'),
    history: document.getElementById('tabHistory'),
    leaderboard: document.getElementById('tabLeaderboard'),
    analytics: document.getElementById('tabAnalytics')
  };
  const deskBtns = {
    capture: document.getElementById('deskNavCapture'),
    history: document.getElementById('deskNavHistory'),
    leaderboard: document.getElementById('deskNavLeaderboard'),
    analytics: document.getElementById('deskNavAnalytics')
  };

  Object.keys(sections).forEach(k => {
    if (k === tab) {
      sections[k]?.classList.remove('hidden');
      if (deskBtns[k]) {
        deskBtns[k].className = 'min-h-[44px] px-3.5 py-2.5 rounded-xl text-xs font-extrabold bg-violet-600 text-white shadow flex items-center justify-center gap-2 cursor-pointer';
      }
    } else {
      sections[k]?.classList.add('hidden');
      if (deskBtns[k]) {
        deskBtns[k].className = 'min-h-[44px] px-3.5 py-2.5 rounded-xl text-xs font-bold glass-panel text-violet-200 hover:text-white flex items-center justify-center gap-2 cursor-pointer';
      }
    }
  });

  if (tab === 'history') renderHistoryList();
  if (tab === 'leaderboard') renderLeaderboardAndBadges();
  if (tab === 'analytics') renderAnalytics();
  refreshLucideIcons();
};

// ============================================================================
// 11. EXPORTACIÓN EXCEL Y DATOS INICIALES DE LOS 4 MÓDULOS (CERO EMOJIS)
// ============================================================================
window.exportToExcelCSV = function() {
  const headers = [
    'Fecha', 'Hora', 'Brigadista', 'Zona', 'Carnet Puesto', 'Llevaba Tarjetas', 'Llevaba Folletos',
    'Negocio', 'Rubro', 'Direccion', 'Hablo Con', 'Material Entregado',
    'Resultado', 'Caso / Motivo', 'Condiciones Especificas / Notas', 'Nombre Contacto', 'Telefono Contacto'
  ];

  const rows = state.visits.map(v => [
    v.fecha, v.hora, v.brigadista_nombre, v.zona || '',
    v.tenia_carnet ? 'SI' : 'NO', v.tenia_tarjetas ? 'SI' : 'NO', v.tenia_folletos ? 'SI' : 'NO',
    v.negocio_nombre, v.negocio_rubro, v.direccion, v.interlocutor,
    (v.material_entregado || []).join(' + '),
    v.resultado === 'interesado' ? 'MUY INTERESADO' : (v.resultado === 'solo_info' ? 'SOLO INFO / YA TIENE SISTEMA' : 'NO INTERESADO'),
    v.motivo_estado || '', v.condiciones_notas || '', v.contacto_nombre || '', v.contacto_telefono || ''
  ]);

  const csvContent = '\uFEFF' + [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(';'))
    .join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `NotasQuickss_Brigada_${getTodayISO()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Archivo Excel (.CSV) descargado correctamente');
};

function generateInitialDailies() {
  const today = getTodayISO();
  return [
    {
      id: 'dly_1',
      fecha: today,
      hora: '08:30 a. m.',
      author: 'Andrés Gómez',
      focus: 'Coordinar salida de brigada en Zona Centro y cerrar seguimiento de los 3 negocios interesados.',
      done: 'Dejé listos los folletos, tarjetas y metas de 12 acercamientos por persona.',
      blocker: '',
      mood: 'A tope'
    },
    {
      id: 'dly_2',
      fecha: today,
      hora: '08:40 a. m.',
      author: 'Laura Martínez',
      focus: 'Completar mis 12 acercamientos en Calle 80 enfocándome en hablar directamente con los dueños.',
      done: 'Agendé demostración con Restaurante Brasas & Sazón.',
      blocker: 'Necesito más tarjetas impresas para la tarde.',
      mood: 'Enfocado'
    }
  ];
}

function generateInitialTasks() {
  const today = getTodayISO();
  return [
    {
      id: 'tsk_1',
      fecha: today,
      hora: '09:30 a. m.',
      title: 'Enviar propuesta con módulo de inventario por bodega a Ferretería El Tornillo',
      assignee: 'Andrés Gómez',
      priority: 'Alta',
      notes: 'Condición que pidió Don Jorge Ramírez (3004567890) para comprar.',
      completed: false
    },
    {
      id: 'tsk_2',
      fecha: today,
      hora: '10:00 a. m.',
      title: 'Preparar demo móvil para Restaurante Brasas & Sazón (jueves 3pm)',
      assignee: 'Laura Martínez',
      priority: 'Alta',
      notes: 'Mostrar velocidad de comandas en hora pico.',
      completed: false
    },
    {
      id: 'tsk_3',
      fecha: today,
      hora: '08:15 a. m.',
      title: 'Entregar paquete de folletos y verificar carnets antes de salir',
      assignee: 'Andrés Gómez',
      priority: 'Media',
      notes: 'Revisión de pre-brigada completada.',
      completed: true
    }
  ];
}

function generateInitialWarnings() {
  const today = getTodayISO();
  return [
    {
      id: 'wrn_1',
      fecha: today,
      hora: '08:45 a. m.',
      member: 'Camila Rojas',
      severity: 'Observación Preventiva',
      category: 'No portar carnet / Kit incompleto',
      reason: 'Salió a la jornada sin el carnet visible y con pocos folletos para la ruta.',
      commitment: 'Portar el carnet desde el inicio de cada brigada y revisar el kit en el Check-in.',
      author: 'Andrés Gómez'
    }
  ];
}

function generateInitialSampleData() {
  const today = getTodayISO();
  return [
    {
      id: 'vis_demo_1',
      fecha: today,
      hora: '09:15 a. m.',
      brigadista_id: 'usr_1',
      brigadista_nombre: 'Andrés Gómez',
      tenia_carnet: true,
      tenia_tarjetas: true,
      tenia_folletos: true,
      zona: 'Zona Comercial Centro',
      negocio_nombre: 'Ferretería Industrial El Tornillo',
      negocio_rubro: 'Ferretería / Repuestos',
      direccion: 'Cra 15 # 72-18 Local 2',
      gps_lat: 4.6581,
      gps_lng: -74.0595,
      interlocutor: 'Dueño / Decisor',
      material_entregado: ['Folleto', 'Tarjeta', 'Explicación verbal'],
      resultado: 'interesado',
      motivo_estado: 'Interesado si cumple condiciones específicas',
      condiciones_notas: 'Me interesa, pero si incluye control de inventario por bodega y migración desde nuestro Excel actual.',
      contacto_nombre: 'Don Jorge Ramírez',
      contacto_telefono: '3004567890'
    },
    {
      id: 'vis_demo_2',
      fecha: today,
      hora: '09:28 a. m.',
      brigadista_id: 'usr_1',
      brigadista_nombre: 'Andrés Gómez',
      tenia_carnet: true,
      tenia_tarjetas: true,
      tenia_folletos: true,
      zona: 'Zona Comercial Centro',
      negocio_nombre: 'Droguería Vida Sana',
      negocio_rubro: 'Salud / Farmacia / Belleza',
      direccion: 'Cra 15 # 72-34',
      gps_lat: 4.6592,
      gps_lng: -74.0588,
      interlocutor: 'Administrador / Encargado',
      material_entregado: ['Folleto', 'Tarjeta'],
      resultado: 'solo_info',
      motivo_estado: 'Ya tiene sistema, no quiere cambiar ahora',
      condiciones_notas: 'Ya tienen sistema actualmente. Se dejó folleto y tarjeta en esta dirección.',
      contacto_nombre: 'Patricia',
      contacto_telefono: ''
    },
    {
      id: 'vis_demo_3',
      fecha: today,
      hora: '09:42 a. m.',
      brigadista_id: 'usr_2',
      brigadista_nombre: 'Laura Martínez',
      tenia_carnet: true,
      tenia_tarjetas: true,
      tenia_folletos: true,
      zona: 'Calle 80 Comercial',
      negocio_nombre: 'Restaurante Brasas & Sazón',
      negocio_rubro: 'Restaurante / Gastronomía',
      direccion: 'Calle 80 # 24-10',
      gps_lat: 4.6685,
      gps_lng: -74.0642,
      interlocutor: 'Dueño / Decisor',
      material_entregado: ['Folleto', 'Tarjeta', 'Demo / Muestra'],
      resultado: 'interesado',
      motivo_estado: 'Quiere agendar demostración',
      condiciones_notas: 'Está muy interesado si funciona rápido en horas pico de almuerzo y permite comandar desde celular.',
      contacto_nombre: 'Mauricio Vélez',
      contacto_telefono: '3119876543'
    },
    {
      id: 'vis_demo_4',
      fecha: today,
      hora: '10:05 a. m.',
      brigadista_id: 'usr_2',
      brigadista_nombre: 'Laura Martínez',
      tenia_carnet: true,
      tenia_tarjetas: true,
      tenia_folletos: true,
      zona: 'Calle 80 Comercial',
      negocio_nombre: 'Minimarket La Esquina 80',
      negocio_rubro: 'Supermercado / Minimarket',
      direccion: 'Calle 80 # 24-56',
      gps_lat: 4.6691,
      gps_lng: -74.0655,
      interlocutor: 'Empleado / Mostrador',
      material_entregado: ['Folleto', 'Tarjeta'],
      resultado: 'solo_info',
      motivo_estado: 'No estaba el dueño, se dejó información',
      condiciones_notas: 'El dueño llega después de las 4pm. Quedó entregado el folleto y tarjeta en el negocio.',
      contacto_nombre: '',
      contacto_telefono: ''
    }
  ];
}

window.loadSampleBrigadaData = function() {
  if (IS_PROD) return;
  const today = getTodayISO();
  const extraSamples = [
    {
      id: 'vis_sim_' + Date.now() + '_1',
      fecha: today,
      hora: '10:20 a. m.',
      brigadista_id: 'usr_1',
      brigadista_nombre: 'Andrés Gómez',
      tenia_carnet: true,
      tenia_tarjetas: true,
      tenia_folletos: true,
      zona: 'Zona Comercial Centro',
      negocio_nombre: 'Distribuidora Textil ModaCol',
      negocio_rubro: 'Comercio / Tienda',
      direccion: 'Cra 15 # 73-05',
      gps_lat: 4.6610,
      gps_lng: -74.0579,
      interlocutor: 'Dueño / Decisor',
      material_entregado: ['Folleto', 'Tarjeta', 'Explicación verbal'],
      resultado: 'interesado',
      motivo_estado: 'Listo para cotización / propuesta formal',
      condiciones_notas: 'Necesita 3 usuarios simultáneos y descuento por pago anual.',
      contacto_nombre: 'Diana Carolina',
      contacto_telefono: '3152223344'
    },
    {
      id: 'vis_sim_' + Date.now() + '_2',
      fecha: today,
      hora: '10:50 a. m.',
      brigadista_id: 'usr_2',
      brigadista_nombre: 'Laura Martínez',
      tenia_carnet: true,
      tenia_tarjetas: true,
      tenia_folletos: true,
      zona: 'Calle 80 Comercial',
      negocio_nombre: 'Óptica Visión Clara',
      negocio_rubro: 'Salud / Farmacia / Belleza',
      direccion: 'Calle 80 # 25-18',
      gps_lat: 4.6704,
      gps_lng: -74.0668,
      interlocutor: 'Dueño / Decisor',
      material_entregado: ['Folleto', 'Tarjeta', 'Explicación verbal'],
      resultado: 'interesado',
      motivo_estado: 'Interesado si cumple condiciones específicas',
      condiciones_notas: 'Me interesa si permite llevar historial de fórmulas de pacientes además de facturación.',
      contacto_nombre: 'Dr. Hernán Soto',
      contacto_telefono: '3205556677'
    }
  ];

  state.visits = [...extraSamples, ...state.visits];
  persistAndSyncState();
  refreshAllUI();
  fireCelebrationConfetti(false);
  showToast('Visitas simuladas agregadas y guardadas.');
};

// ============================================================================
// 12. MOTOR DE PRODUCCIÓN: AUTOGUARDADO, SUPABASE REALTIME & CONTROLES SOCIOS
// ============================================================================
function mergeUniqueById(localArr = [], remoteArr = [], keyField = 'id') {
  const map = new Map();
  remoteArr.forEach(item => {
    if (item && item[keyField]) map.set(item[keyField], item);
  });
  localArr.forEach(item => {
    if (item && item[keyField]) map.set(item[keyField], item);
  });
  return Array.from(map.values());
}

async function syncStateToCloud(forceOverwrite = false) {
  if (!state.supabase) return;
  try {
    let mergedUsers = state.users;
    let mergedVisits = state.visits;
    let mergedDailies = state.dailies;
    let mergedTasks = state.tasks;
    let mergedWarnings = state.warnings;

    if (!forceOverwrite) {
      const { data: remote } = await state.supabase
        .from('quickss_workspace_state')
        .select('*')
        .eq('id', CLOUD_WORKSPACE_ID)
        .maybeSingle();

      if (remote) {
        mergedUsers = mergeUniqueById(state.users, remote.users || [], 'nombre');
        mergedVisits = mergeUniqueById(state.visits, remote.visits || [], 'id');
        mergedDailies = mergeUniqueById(state.dailies, remote.dailies || [], 'id');
        mergedTasks = mergeUniqueById(state.tasks, remote.tasks || [], 'id');
        mergedWarnings = mergeUniqueById(state.warnings, remote.warnings || [], 'id');

        state.users = mergedUsers;
        state.visits = mergedVisits;
        state.dailies = mergedDailies;
        state.tasks = mergedTasks;
        state.warnings = mergedWarnings;

        const mergedEmails = Array.from(new Set([
          ...state.allowedEmails,
          ...state.users.map(u => String(u.email || '').trim().toLowerCase()).filter(Boolean)
        ]));
        state.allowedEmails = mergedEmails;
        localStorage.setItem(STORAGE_KEYS.ALLOWED_EMAILS, JSON.stringify(state.allowedEmails));
      }
    }

    const payload = {
      id: CLOUD_WORKSPACE_ID,
      users: mergedUsers,
      visits: mergedVisits,
      dailies: mergedDailies,
      tasks: mergedTasks,
      warnings: mergedWarnings,
      updated_at: new Date().toISOString()
    };
    await state.supabase
      .from('quickss_workspace_state')
      .upsert(payload, { onConflict: 'id' });
  } catch (e) {
    console.warn('Error sincronizando estado a Supabase:', e);
  }
}

async function pullStateFromCloud() {
  if (!state.supabase) return;
  try {
    const { data, error } = await state.supabase
      .from('quickss_workspace_state')
      .select('*')
      .eq('id', CLOUD_WORKSPACE_ID)
      .maybeSingle();

    if (error) return;

    if (data) {
      applyRemoteWorkspaceData(data);
    } else {
      // Primera vez en esta tabla: subir el estado actual para inicializar la nube
      await syncStateToCloud(true);
    }
  } catch (e) {
    console.warn('Error leyendo estado de Supabase:', e);
  }
}

function applyRemoteWorkspaceData(data) {
  if (!data) return;
  if (Array.isArray(data.users) && data.users.length > 0) {
    state.users = mergeUniqueById(state.users, data.users, 'nombre');
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(state.users));
    // Sincronizar correos autorizados de la Lista Blanca desde los perfiles del equipo en la nube
    const cloudEmails = state.users.map(u => String(u.email || '').trim().toLowerCase()).filter(Boolean);
    if (cloudEmails.length > 0) {
      state.allowedEmails = Array.from(new Set([...state.allowedEmails, ...cloudEmails]));
      localStorage.setItem(STORAGE_KEYS.ALLOWED_EMAILS, JSON.stringify(state.allowedEmails));
    }
    // Preservar el perfil activo de cada socio en su propio dispositivo
    const matchCurrent = state.users.find(
      u => u.id === state.currentUser?.id || u.nombre === state.currentUser?.nombre || (state.authSession?.email && String(u.email || '').toLowerCase() === state.authSession.email)
    ) || state.users[0];
    state.currentUser = matchCurrent;
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(state.currentUser));
  }
  if (Array.isArray(data.visits)) {
    state.visits = data.visits;
    localStorage.setItem(STORAGE_KEYS.VISITS, JSON.stringify(state.visits));
  }
  if (Array.isArray(data.dailies)) {
    state.dailies = data.dailies;
    localStorage.setItem(STORAGE_KEYS.DAILIES, JSON.stringify(state.dailies));
  }
  if (Array.isArray(data.tasks)) {
    state.tasks = data.tasks;
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(state.tasks));
  }
  if (Array.isArray(data.warnings)) {
    state.warnings = data.warnings;
    localStorage.setItem(STORAGE_KEYS.WARNINGS, JSON.stringify(state.warnings));
  }
  renderWhitelistUI();
  renderAuthQuickAccounts();
  checkAndRenderAuthGate();
  refreshAllUI();
}

function initSupabaseIfConfigured() {
  try {
    const cfg = JSON.parse(localStorage.getItem(STORAGE_KEYS.SUPABASE_CFG) || 'null');
    const dot = document.getElementById('cloudStatusDot');
    const sub = document.getElementById('cloudModalStatusSubtitle');

    if (cfg && cfg.url && cfg.key && window.supabase) {
      state.supabase = window.supabase.createClient(cfg.url, cfg.key);
      if (dot) dot.className = 'w-2 h-2 rounded-full bg-violet-400';
      setText('cloudStatusText', 'Nube En Vivo');
      if (sub) sub.textContent = 'Conectado a Supabase en tiempo real + Autoguardado Local';

      pullStateFromCloud();

      // Listener de Supabase Auth (Google OAuth 2.0 Redirect) con validación en Lista Blanca
      if (state.supabase.auth) {
        state.supabase.auth.onAuthStateChange((event, session) => {
          if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user?.email) {
            const oauthEmail = session.user.email.toLowerCase();
            const oauthName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || '';
            loginWithAuthorizedGoogleAccount(oauthEmail, oauthName);
          }
        });
      }

      // Suscripción en tiempo real para que tus socios vean cambios al instante
      state.supabase
        .channel('quickss_realtime_channel')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'quickss_workspace_state', filter: `id=eq.${CLOUD_WORKSPACE_ID}` },
          (payload) => {
            if (payload && payload.new) {
              applyRemoteWorkspaceData(payload.new);
            }
          }
        )
        .subscribe();
    } else {
      if (dot) dot.className = 'w-2 h-2 rounded-full bg-emerald-400';
      setText('cloudStatusText', 'Guardado Activo');
      if (sub) sub.textContent = 'Autoguardado instantáneo activo en este dispositivo';
    }
  } catch (e) {
    console.warn('Error Supabase:', e);
  }
}

function openCloudModal() {
  const cfg = JSON.parse(localStorage.getItem(STORAGE_KEYS.SUPABASE_CFG) || 'null');
  const urlEl = document.getElementById('supaUrlInput');
  const keyEl = document.getElementById('supaKeyInput');
  if (urlEl) urlEl.value = cfg?.url || '';
  if (keyEl) keyEl.value = cfg?.key || '';
  renderWhitelistUI();
  document.getElementById('cloudModal')?.classList.remove('hidden');
  refreshLucideIcons();
}

window.closeCloudModal = function() {
  document.getElementById('cloudModal')?.classList.add('hidden');
};

window.saveSupabaseConfig = async function() {
  const url = document.getElementById('supaUrlInput').value.trim();
  const key = document.getElementById('supaKeyInput').value.trim();
  if (!url || !key) {
    showToast('Ingresa el Project URL y Anon Key de Supabase');
    return;
  }
  localStorage.setItem(STORAGE_KEYS.SUPABASE_CFG, JSON.stringify({ url, key }));
  initSupabaseIfConfigured();
  await syncStateToCloud();
  closeCloudModal();
  showToast('Conectado a Supabase y datos sincronizados');
};

window.disconnectSupabase = function() {
  localStorage.removeItem(STORAGE_KEYS.SUPABASE_CFG);
  state.supabase = null;
  const dot = document.getElementById('cloudStatusDot');
  if (dot) dot.className = 'w-2 h-2 rounded-full bg-emerald-400';
  setText('cloudStatusText', 'Guardado Activo');
  closeCloudModal();
  showToast('Modo de autoguardado local activo');
};

window.copyPartnerShareLink = async function() {
  const prodBase = 'https://balmes2baxter.github.io/Quickss_notes/';
  const cfg = JSON.parse(localStorage.getItem(STORAGE_KEYS.SUPABASE_CFG) || 'null');
  let shareUrl = prodBase;
  if (cfg && cfg.url && cfg.key) {
    const params = new URLSearchParams({ supa_url: cfg.url, supa_key: cfg.key });
    shareUrl = `${prodBase}?${params.toString()}`;
  }
  try {
    await navigator.clipboard.writeText(shareUrl);
    showToast(
      cfg?.url
        ? 'Link de producción con conexión a tu nube copiado'
        : 'Link público de producción copiado al portapapeles'
    );
  } catch {
    showToast('Link: ' + prodBase);
  }
};

window.resetToDemoData = async function() {
  if (IS_PROD) return;
  localStorage.removeItem(STORAGE_KEYS.CLEAN_MODE);
  state.visits = generateInitialSampleData();
  state.dailies = generateInitialDailies();
  state.tasks = generateInitialTasks();
  state.warnings = generateInitialWarnings();
  await persistAndSyncState();
  refreshAllUI();
  closeCloudModal();
  fireCelebrationConfetti(false);
  showToast('Datos de demostración ejecutiva cargados');
};

window.clearAllWorkspaceData = async function() {
  localStorage.setItem(STORAGE_KEYS.CLEAN_MODE, 'true');
  state.visits = [];
  state.dailies = [];
  state.tasks = [];
  state.warnings = [];
  await syncStateToCloud(true);
  await persistAndSyncState();
  refreshAllUI();
  closeCloudModal();
  showToast('Tablero limpio (0 registros). Listo para anotar desde cero');
};

window.exportFullBackupJSON = function() {
  const backup = {
    app: 'Notas Quickss',
    exported_at: new Date().toISOString(),
    users: state.users,
    visits: state.visits,
    dailies: state.dailies,
    tasks: state.tasks,
    warnings: state.warnings
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `NotasQuickss_Backup_${getTodayISO()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Respaldo JSON descargado');
};

window.handleImportBackupJSON = function(event) {
  const file = event.target?.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      applyRemoteWorkspaceData(parsed);
      await persistAndSyncState();
      closeCloudModal();
      showToast('Respaldo JSON restaurado correctamente');
    } catch {
      showToast('El archivo JSON no tiene un formato válido');
    }
  };
  reader.readAsText(file);
};

window.copySupabaseSQLSchema = async function() {
  const sql = `CREATE TABLE IF NOT EXISTS public.quickss_workspace_state (
  id TEXT PRIMARY KEY DEFAULT 'main_workspace',
  users JSONB DEFAULT '[]'::jsonb NOT NULL,
  visits JSONB DEFAULT '[]'::jsonb NOT NULL,
  dailies JSONB DEFAULT '[]'::jsonb NOT NULL,
  tasks JSONB DEFAULT '[]'::jsonb NOT NULL,
  warnings JSONB DEFAULT '[]'::jsonb NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
ALTER TABLE public.quickss_workspace_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total workspace" ON public.quickss_workspace_state;
CREATE POLICY "Acceso total workspace" ON public.quickss_workspace_state FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.quickss_workspace_state;`;
  try {
    await navigator.clipboard.writeText(sql);
    showToast('SQL con Realtime copiado: pégalo en el SQL Editor de Supabase y dale Run');
  } catch {
    showToast('Consulta el archivo supabase_schema.sql del proyecto');
  }
};

function showToast(msg) {
  const toast = document.getElementById('toastNotification');
  const msgEl = document.getElementById('toastMessage');
  if (!toast || !msgEl) return;
  msgEl.textContent = msg;
  toast.classList.remove('hidden');
  refreshLucideIcons();
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => toast.classList.add('hidden'), 3200);
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
