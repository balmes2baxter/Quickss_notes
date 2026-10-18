// ============================================================================
// NOTAS QUICKSS — HUB MULTI-MÓDULO (BRIGADAS, DAILY DAY, TAREAS, LLAMADOS)
// ============================================================================

const STORAGE_KEYS = {
  USERS: 'quickss_users_v3',
  CURRENT_USER: 'quickss_current_user_v3',
  PRE_CHECKIN: 'quickss_pre_checkin_v3',
  VISITS: 'quickss_visits_v3',
  DAILIES: 'quickss_dailies_v3',
  TASKS: 'quickss_tasks_v3',
  WARNINGS: 'quickss_warnings_v3',
  SUPABASE_CFG: 'quickss_supabase_cfg_v3'
};

const OUTCOME_PRESETS = {
  interesado: {
    label: '🔥 ¿Cómo estuvo interesado? (1 toque):',
    condLabel: '✍️ Condiciones específicas del cliente o acuerdos clave:',
    placeholder: 'Ej: "Oye muchachos, me interesa pero si tienen estas condiciones..." (Usa Dictar con voz 🎙️)',
    chips: [
      'Interesado si cumple condiciones específicas',
      'Listo para cotización / propuesta formal',
      'Quiere agendar demostración',
      'Muy interesado en precios y planes'
    ]
  },
  solo_info: {
    label: '🌤️ ¿Qué pasó en este negocio? (Queda registrado negocio y dirección):',
    condLabel: '✍️ Nota rápida (Ej: qué sistema tiene actualmente o a quién se dejó la info):',
    placeholder: 'Ej: Ya tiene sistema actual, no quiere cambiar ahora. Se dejó folleto y tarjeta en esta dirección...',
    chips: [
      'Ya tiene sistema, no quiere cambiar ahora',
      'Solo se entregó información (Folleto / Tarjeta)',
      'No estaba el dueño, se dejó información',
      'Lo revisará con el socio / administrador'
    ]
  },
  no_interesado: {
    label: '❄️ Motivo rápido:',
    condLabel: '✍️ Observación breve (Opcional):',
    placeholder: 'Ej: Franquicia nacional, decisiones en otra ciudad...',
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
  preCheckin: null,
  visits: [],
  dailies: [],
  tasks: [],
  warnings: [],
  tasksFilter: 'all',
  dailyMood: '🔥 A tope',
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

// ============================================================================
// 1. INICIALIZACIÓN DIRECTA AL DASHBOARD PRINCIPAL (SIN PANTALLA BLOQUEANTE)
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  loadLocalState();
  initSupabaseIfConfigured();
  setupEventListeners();
  updateClockPreview();
  setInterval(updateClockPreview, 30000);
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
  if (el) el.textContent = `🕒 Hoy · ${getCurrentTimeFormatted()}`;
}

function loadLocalState() {
  try {
    const savedUsers = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    const savedCurrent = JSON.parse(localStorage.getItem(STORAGE_KEYS.CURRENT_USER) || 'null');
    const savedPre = JSON.parse(localStorage.getItem(STORAGE_KEYS.PRE_CHECKIN) || 'null');
    const savedVisits = JSON.parse(localStorage.getItem(STORAGE_KEYS.VISITS) || 'null');
    const savedDailies = JSON.parse(localStorage.getItem(STORAGE_KEYS.DAILIES) || 'null');
    const savedTasks = JSON.parse(localStorage.getItem(STORAGE_KEYS.TASKS) || 'null');
    const savedWarnings = JSON.parse(localStorage.getItem(STORAGE_KEYS.WARNINGS) || 'null');

    state.users = savedUsers.length > 0 ? savedUsers : [
      { id: 'usr_1', nombre: 'Andrés Gómez', rol: 'Líder / Admin', meta: 12 },
      { id: 'usr_2', nombre: 'Laura Martínez', rol: 'Brigadista', meta: 12 },
      { id: 'usr_3', nombre: 'Camila Rojas', rol: 'Brigadista', meta: 12 }
    ];
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(state.users));

    state.currentUser = savedCurrent || state.users[0];
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(state.currentUser));

    const today = getTodayISO();
    if (savedPre && savedPre.fecha === today && savedPre.brigadista_id === state.currentUser.id) {
      state.preCheckin = savedPre;
    } else {
      state.preCheckin = null;
    }

    state.visits = (savedVisits && Array.isArray(savedVisits) && savedVisits.length > 0)
      ? savedVisits
      : generateInitialSampleData();
    localStorage.setItem(STORAGE_KEYS.VISITS, JSON.stringify(state.visits));

    state.dailies = (savedDailies && Array.isArray(savedDailies))
      ? savedDailies
      : generateInitialDailies();
    localStorage.setItem(STORAGE_KEYS.DAILIES, JSON.stringify(state.dailies));

    state.tasks = (savedTasks && Array.isArray(savedTasks))
      ? savedTasks
      : generateInitialTasks();
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(state.tasks));

    state.warnings = (savedWarnings && Array.isArray(savedWarnings))
      ? savedWarnings
      : generateInitialWarnings();
    localStorage.setItem(STORAGE_KEYS.WARNINGS, JSON.stringify(state.warnings));
  } catch (e) {
    console.error('Error cargando estado:', e);
  }
}

function setupEventListeners() {
  document.getElementById('btnOpenCloudModal')?.addEventListener('click', openCloudModal);
  document.getElementById('negocioNombre')?.addEventListener('input', checkDuplicateBusiness);
  document.getElementById('negocioDireccion')?.addEventListener('input', checkDuplicateBusiness);
  document.getElementById('visitForm')?.addEventListener('submit', handleVisitSubmit);
  document.getElementById('dailyForm')?.addEventListener('submit', handleDailySubmit);
  document.getElementById('taskForm')?.addEventListener('submit', handleTaskSubmit);
  document.getElementById('warningForm')?.addEventListener('submit', handleWarningSubmit);
}

// ============================================================================
// 2. NAVEGACIÓN ENTRE MÓDULOS PRINCIPALES DE NOTAS QUICKSS
// ============================================================================
window.switchModule = function(modName) {
  state.activeModule = modName;
  const modules = ['hub', 'brigadas', 'daily', 'tareas', 'llamados'];

  modules.forEach(m => {
    const el = document.getElementById(`module_${m}`);
    const deskBtn = document.getElementById(`modBtn_${m}`);
    const mobBtn = document.getElementById(`mobModBtn_${m}`);

    if (m === modName) {
      el?.classList.remove('hidden');
      if (deskBtn) deskBtn.className = 'px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-violet-600 text-white transition shadow';
      if (mobBtn) mobBtn.className = 'py-2 px-1 rounded-xl text-[10px] font-extrabold bg-violet-600 text-white flex flex-col items-center justify-center gap-0.5 shadow';
    } else {
      el?.classList.add('hidden');
      if (deskBtn) deskBtn.className = 'px-3.5 py-1.5 rounded-xl text-xs font-bold text-violet-200/80 hover:text-white transition';
      if (mobBtn) mobBtn.className = 'py-2 px-1 rounded-xl text-[10px] font-bold bg-[#161224] text-violet-200 border border-violet-500/20 flex flex-col items-center justify-center gap-0.5';
    }
  });

  refreshAllUI();
};

// ============================================================================
// 3. CAMBIO RÁPIDO DE RESPONSABLE / USUARIO EN BARRA SUPERIOR
// ============================================================================
function renderUserSelects() {
  const topSelect = document.getElementById('quickUserSelect');
  const taskSelect = document.getElementById('taskAssigneeSelect');
  const warnSelect = document.getElementById('warnMemberSelect');

  if (topSelect) {
    topSelect.innerHTML = state.users.map(u => `
      <option value="${u.id}" ${state.currentUser?.id === u.id ? 'selected' : ''} class="bg-[#161224] text-white">
        ${escapeHtml(u.nombre)}
      </option>
    `).join('');
  }

  const optionsByName = state.users.map(u => `
    <option value="${escapeHtml(u.nombre)}" ${state.currentUser?.nombre === u.nombre ? 'selected' : ''} class="bg-[#161224] text-white">
      ${escapeHtml(u.nombre)}
    </option>
  `).join('');

  if (taskSelect && !taskSelect.innerHTML) taskSelect.innerHTML = optionsByName;
  if (warnSelect && !warnSelect.innerHTML) warnSelect.innerHTML = optionsByName;
}

window.handleQuickUserChange = function(userId) {
  const user = state.users.find(u => u.id === userId);
  if (!user) return;
  state.currentUser = user;
  localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));

  const savedPre = JSON.parse(localStorage.getItem(STORAGE_KEYS.PRE_CHECKIN) || 'null');
  if (savedPre && savedPre.fecha === getTodayISO() && savedPre.brigadista_id === user.id) {
    state.preCheckin = savedPre;
  } else {
    state.preCheckin = null;
  }

  refreshAllUI();
  showToast(`👤 Anotando ahora como: ${user.nombre}`);
};

window.promptNewTeamMember = function() {
  const nombre = prompt('Nombre y apellido de la persona a agregar al equipo:');
  if (!nombre || !nombre.trim()) return;
  const clean = nombre.trim();
  let existing = state.users.find(u => u.nombre.toLowerCase() === clean.toLowerCase());
  if (!existing) {
    existing = { id: 'usr_' + Date.now(), nombre: clean, rol: 'Brigadista', meta: 12 };
    state.users.push(existing);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(state.users));
  }
  state.currentUser = existing;
  localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(existing));
  document.getElementById('taskAssigneeSelect').innerHTML = '';
  document.getElementById('warnMemberSelect').innerHTML = '';
  refreshAllUI();
  showToast(`✅ Cuenta creada y activa: ${existing.nombre}`);
};

// ============================================================================
// 4. RENDER DEL HUB PRINCIPAL DE NOTAS QUICKSS (TODOS LOS MÓDULOS)
// ============================================================================
function renderHubDashboard() {
  const todayFormatted = new Date().toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long'
  });
  const dateEl = document.getElementById('hubTodayDate');
  if (dateEl) dateEl.textContent = todayFormatted;

  const welcomeEl = document.getElementById('hubWelcomeName');
  if (welcomeEl && state.currentUser) welcomeEl.textContent = state.currentUser.nombre.split(' ')[0];

  const hotVisits = state.visits.filter(v => v.resultado === 'interesado').length;
  const pendingTasks = state.tasks.filter(t => !t.completed).length;

  // Contadores de Cabecera y Hub
  setText('badgeCountBrigadas', state.visits.length);
  setText('badgeCountDaily', state.dailies.length);
  setText('badgeCountTareas', pendingTasks);
  setText('badgeCountLlamados', state.warnings.length);

  setText('hubStatBrigadas', state.visits.length);
  setText('hubStatDaily', state.dailies.length);
  setText('hubStatTareas', pendingTasks);
  setText('hubStatLlamados', state.warnings.length);

  setText('hubCardBrigadasInfo', `${state.visits.length} visitas · 🔥 ${hotVisits} muy interesados`);
  setText('hubCardDailyInfo', `${state.dailies.length} reportes en el muro del equipo`);
  setText('hubCardTareasInfo', `${pendingTasks} pendientes · ${state.tasks.length - pendingTasks} completadas`);
  setText('hubCardLlamadosInfo', `${state.warnings.length} registros en bitácora`);

  // Feed Unificado Reciente
  const feedEl = document.getElementById('hubUnifiedFeed');
  if (!feedEl) return;

  const combined = [
    ...state.visits.slice(0, 3).map(v => ({
      mod: '🚀 Brigada',
      title: `${v.negocio_nombre} (${v.direccion})`,
      desc: `${v.motivo_estado || ''}${v.condiciones_notas ? ' — "' + v.condiciones_notas + '"' : ''}`,
      author: v.brigadista_nombre,
      time: `${v.fecha} ${v.hora}`,
      clickMod: 'brigadas'
    })),
    ...state.dailies.slice(0, 2).map(d => ({
      mod: '☀️ Daily Day',
      title: `Foco hoy: ${d.focus}`,
      desc: d.blocker ? `🚧 Bloqueo: ${d.blocker}` : `✅ Logro: ${d.done || 'En progreso'}`,
      author: d.author,
      time: `${d.fecha} ${d.hora}`,
      clickMod: 'daily'
    })),
    ...state.tasks.slice(0, 2).map(t => ({
      mod: '✅ Tarea',
      title: t.title,
      desc: `Prioridad ${t.priority} · Estado: ${t.completed ? 'Completada' : 'Pendiente'}`,
      author: t.assignee,
      time: t.fecha,
      clickMod: 'tareas'
    })),
    ...state.warnings.slice(0, 2).map(w => ({
      mod: '⚠️ Llamado',
      title: `${w.member} — ${w.category}`,
      desc: w.reason,
      author: `Reg: ${w.author}`,
      time: `${w.fecha} ${w.hora}`,
      clickMod: 'llamados'
    }))
  ].slice(0, 6);

  feedEl.innerHTML = combined.map(item => `
    <div
      onclick="switchModule('${item.clickMod}')"
      class="p-4 rounded-2xl bg-[#1b152c] border border-violet-500/20 hover:border-violet-400/50 cursor-pointer transition space-y-1"
    >
      <div class="flex items-center justify-between text-[11px]">
        <span class="font-extrabold text-violet-300 bg-violet-500/15 px-2.5 py-0.5 rounded-full">${escapeHtml(item.mod)}</span>
        <span class="text-violet-300/60">${escapeHtml(item.time)}</span>
      </div>
      <p class="font-extrabold text-sm text-white truncate">${escapeHtml(item.title)}</p>
      <p class="text-xs text-violet-200/75 truncate">${escapeHtml(item.desc)}</p>
      <p class="text-[11px] text-violet-300/70 pt-0.5">👤 ${escapeHtml(item.author)}</p>
    </div>
  `).join('');
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ============================================================================
// 5. MÓDULO DAILY DAY (SEGUIMIENTO DIARIO DEL EQUIPO)
// ============================================================================
window.selectDailyMood = function(mood) {
  state.dailyMood = mood;
  const buttons = document.querySelectorAll('#dailyMoodChips button');
  buttons.forEach(btn => {
    if (btn.textContent.trim() === mood) btn.classList.add('active-blue');
    else btn.classList.remove('active-blue');
  });
};

function handleDailySubmit(e) {
  e.preventDefault();
  const focus = document.getElementById('dailyFocusInput').value.trim();
  const done = document.getElementById('dailyDoneInput').value.trim();
  const blocker = document.getElementById('dailyBlockerInput').value.trim();
  if (!focus) return;

  const entry = {
    id: 'dly_' + Date.now(),
    fecha: getTodayISO(),
    hora: getCurrentTimeFormatted(),
    author: state.currentUser?.nombre || 'Equipo',
    focus,
    done,
    blocker,
    mood: state.dailyMood
  };

  state.dailies.unshift(entry);
  localStorage.setItem(STORAGE_KEYS.DAILIES, JSON.stringify(state.dailies));

  document.getElementById('dailyFocusInput').value = '';
  document.getElementById('dailyDoneInput').value = '';
  document.getElementById('dailyBlockerInput').value = '';

  refreshAllUI();
  fireCelebrationConfetti(false);
  showToast('☀️ Daily Day publicado en el tablero del equipo');
}

function renderDailiesList() {
  const container = document.getElementById('dailyListContainer');
  if (!container) return;

  if (state.dailies.length === 0) {
    container.innerHTML = `<p class="text-xs text-violet-300/60 py-6 text-center">Aún no hay reportes de Daily Day hoy.</p>`;
    return;
  }

  container.innerHTML = state.dailies.map(d => `
    <div class="p-4 rounded-2xl bg-[#1b152c] border border-violet-500/25 space-y-2">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <span class="font-extrabold text-sm text-white">👤 ${escapeHtml(d.author)}</span>
          <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-violet-500/20 text-violet-200 border border-violet-400/30">${escapeHtml(d.mood)}</span>
        </div>
        <div class="flex items-center gap-2 text-[11px] text-violet-300/60">
          <span>${escapeHtml(d.fecha)} · ${escapeHtml(d.hora)}</span>
          <button onclick="deleteDaily('${d.id}')" class="hover:text-rose-400 font-bold">✕</button>
        </div>
      </div>

      <p class="text-xs text-violet-100">
        🎯 <b class="text-violet-300">Foco hoy:</b> ${escapeHtml(d.focus)}
      </p>
      ${d.done ? `<p class="text-xs text-violet-200/80">✅ <b>Avance reciente:</b> ${escapeHtml(d.done)}</p>` : ''}
      ${d.blocker ? `<p class="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/25 px-3 py-1.5 rounded-xl">🚧 <b>Bloqueo / Apoyo:</b> ${escapeHtml(d.blocker)}</p>` : ''}
    </div>
  `).join('');
}

window.deleteDaily = function(id) {
  state.dailies = state.dailies.filter(d => d.id !== id);
  localStorage.setItem(STORAGE_KEYS.DAILIES, JSON.stringify(state.dailies));
  refreshAllUI();
};

// ============================================================================
// 6. MÓDULO DE TAREAS PENDIENTES (TO-DO & SEGUIMIENTOS)
// ============================================================================
function handleTaskSubmit(e) {
  e.preventDefault();
  const title = document.getElementById('taskTitleInput').value.trim();
  const assignee = document.getElementById('taskAssigneeSelect').value || state.currentUser?.nombre || 'Equipo';
  const priority = document.getElementById('taskPriorityInput').value;
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
  localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(state.tasks));

  document.getElementById('taskTitleInput').value = '';
  document.getElementById('taskNotesInput').value = '';

  refreshAllUI();
  showToast('✅ Tarea agregada al tablero');
}

window.toggleTaskDone = function(id) {
  const t = state.tasks.find(item => item.id === id);
  if (!t) return;
  t.completed = !t.completed;
  localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(state.tasks));
  if (t.completed) fireCelebrationConfetti(false);
  refreshAllUI();
};

window.deleteTask = function(id) {
  state.tasks = state.tasks.filter(t => t.id !== id);
  localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(state.tasks));
  refreshAllUI();
};

window.filterTasksView = function(filter) {
  state.tasksFilter = filter;
  renderTasksList();
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
      <div class="p-4 rounded-2xl bg-[#1b152c] border border-violet-500/20 flex items-start justify-between gap-3 ${t.completed ? 'opacity-60' : ''}">
        <div class="flex items-start gap-3">
          <input
            type="checkbox"
            ${t.completed ? 'checked' : ''}
            onchange="toggleTaskDone('${t.id}')"
            class="mt-1 w-5 h-5 accent-violet-600 cursor-pointer"
          />
          <div class="space-y-1">
            <div class="flex flex-wrap items-center gap-2">
              <p class="font-extrabold text-sm text-white ${t.completed ? 'line-through text-violet-300/60' : ''}">${escapeHtml(t.title)}</p>
              <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${prioBadge}">${escapeHtml(t.priority)}</span>
            </div>
            ${t.notes ? `<p class="text-xs text-violet-200/80">${escapeHtml(t.notes)}</p>` : ''}
            <p class="text-[11px] text-violet-300/60">👤 Responsable: <b class="text-violet-200">${escapeHtml(t.assignee)}</b> · ${escapeHtml(t.fecha)}</p>
          </div>
        </div>
        <button onclick="deleteTask('${t.id}')" class="text-xs text-violet-300/50 hover:text-rose-400 font-bold px-2">✕</button>
      </div>
    `;
  }).join('');
}

// ============================================================================
// 7. MÓDULO DE LLAMADOS DE ATENCIÓN & BITÁCORA
// ============================================================================
window.selectWarnCategory = function(cat) {
  state.warnCategory = cat;
  const buttons = document.querySelectorAll('#warnCategoryChips button');
  buttons.forEach(btn => {
    if (btn.getAttribute('onclick').includes(cat)) btn.classList.add('active-blue');
    else btn.classList.remove('active-blue');
  });
};

function handleWarningSubmit(e) {
  e.preventDefault();
  const member = document.getElementById('warnMemberSelect').value || 'Colaborador';
  const severity = document.getElementById('warnSeverityInput').value;
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
  localStorage.setItem(STORAGE_KEYS.WARNINGS, JSON.stringify(state.warnings));

  document.getElementById('warnReasonInput').value = '';
  document.getElementById('warnCommitmentInput').value = '';

  refreshAllUI();
  showToast(`⚠️ Llamado de atención registrado para ${member}`);
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
      <div class="p-4 rounded-2xl bg-[#1b152c] border border-violet-500/25 space-y-2">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-extrabold text-sm text-white">👤 ${escapeHtml(w.member)}</span>
            <span class="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${sevBadge}">${escapeHtml(w.severity)}</span>
            <span class="text-[11px] font-semibold text-violet-300 bg-[#251c3d] px-2.5 py-0.5 rounded-lg">${escapeHtml(w.category)}</span>
          </div>
          <div class="flex items-center gap-2 text-[11px] text-violet-300/60">
            <span>${escapeHtml(w.fecha)} · ${escapeHtml(w.hora)}</span>
            <button onclick="deleteWarning('${w.id}')" class="hover:text-rose-400 font-bold">✕</button>
          </div>
        </div>

        <p class="text-xs text-violet-100 leading-relaxed">
          📝 <b>Detalle:</b> ${escapeHtml(w.reason)}
        </p>
        ${w.commitment ? `
          <p class="text-xs text-violet-200 bg-violet-500/10 border border-violet-500/25 px-3 py-1.5 rounded-xl">
            🤝 <b>Compromiso acordado:</b> ${escapeHtml(w.commitment)}
          </p>
        ` : ''}
        <p class="text-[10px] text-violet-300/60">Registrado por: <b>${escapeHtml(w.author)}</b></p>
      </div>
    `;
  }).join('');
}

window.deleteWarning = function(id) {
  state.warnings = state.warnings.filter(w => w.id !== id);
  localStorage.setItem(STORAGE_KEYS.WARNINGS, JSON.stringify(state.warnings));
  refreshAllUI();
};

// ============================================================================
// 8. MÓDULO BRIGADAS COMERCIALES (GAMIFICACIÓN, CHECK-IN, CAPTURA Y ANALÍTICA)
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
  if (xp >= 450) return { title: '👑 Leyenda de Brigada' };
  if (xp >= 250) return { title: '🔥 Closer de Calle' };
  if (xp >= 100) return { title: '🎯 Cazador Comercial' };
  return { title: '⚡ Explorador' };
}

function fireCelebrationConfetti(isBigGoal = false) {
  if (typeof confetti !== 'function') return;
  if (isBigGoal) {
    confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
  } else {
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
  }
}

window.togglePreCheck = function(item) {
  const map = {
    carnet: { chk: 'chkCarnet', card: 'checkCardCarnet', label: 'labelCarnetState', yes: '✅ Sí, visible y puesto', no: '⚠️ No llevo carnet hoy' },
    tarjetas: { chk: 'chkTarjetas', card: 'checkCardTarjetas', label: 'labelTarjetasState', yes: '✅ Sí, llevo tarjetas', no: '⚠️ Sin tarjetas hoy' },
    folletos: { chk: 'chkFolletos', card: 'checkCardFolletos', label: 'labelFolletosState', yes: '✅ Sí, llevo folletos', no: '⚠️ Sin folletos hoy' }
  };
  const cfg = map[item];
  if (!cfg) return;

  const checkbox = document.getElementById(cfg.chk);
  checkbox.checked = !checkbox.checked;
  const card = document.getElementById(cfg.card);
  const label = document.getElementById(cfg.label);

  if (checkbox.checked) {
    card.classList.add('equipped');
    card.classList.remove('not-equipped');
    label.textContent = cfg.yes;
    label.className = 'text-xs font-bold text-violet-300 mt-0.5';
  } else {
    card.classList.remove('equipped');
    card.classList.add('not-equipped');
    label.textContent = cfg.no;
    label.className = 'text-xs font-bold text-rose-400 mt-0.5';
  }

  const c = document.getElementById('chkCarnet').checked ? 1 : 0;
  const t = document.getElementById('chkTarjetas').checked ? 1 : 0;
  const f = document.getElementById('chkFolletos').checked ? 1 : 0;
  const pct = Math.round(((c + t + f) / 3) * 100);
  const el = document.getElementById('readinessScoreText');
  if (el) el.textContent = `${pct}% Equipado`;
};

window.confirmPreBrigada = async function() {
  if (!state.currentUser) return;

  const tiene_carnet = document.getElementById('chkCarnet').checked;
  const tiene_tarjetas = document.getElementById('chkTarjetas').checked;
  const tiene_folletos = document.getElementById('chkFolletos').checked;
  const zona = document.getElementById('inputZonaBrigada').value.trim() || 'Sector Comercial';
  const meta_diaria = parseInt(document.getElementById('inputMetaDiaria').value, 10) || 12;

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
  localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(state.currentUser));
  localStorage.setItem(STORAGE_KEYS.PRE_CHECKIN, JSON.stringify(state.preCheckin));

  const defaultMat = ['Explicación verbal'];
  if (tiene_folletos) defaultMat.unshift('Folleto');
  if (tiene_tarjetas) defaultMat.unshift('Tarjeta');
  state.form.material = defaultMat;
  syncMaterialChipsUI();

  refreshAllUI();
  showToast('🚀 ¡Equipamiento confirmado! Ya puedes anotar negocios rápido.');
  setTimeout(() => document.getElementById('negocioNombre')?.focus(), 150);
};

window.reopenPreBrigada = function() {
  document.getElementById('preBrigadaCard').classList.remove('hidden');
  document.getElementById('brigadaWorkspaceGrid').classList.add('hidden');
};

window.selectRubro = function(rubro) {
  state.form.rubro = rubro;
  const buttons = document.querySelectorAll('#rubroChips button');
  buttons.forEach(btn => {
    if (btn.textContent.includes(rubro.split(' ')[0])) btn.classList.add('active-blue');
    else btn.classList.remove('active-blue');
  });
};

window.selectInterlocutor = function(persona) {
  state.form.interlocutor = persona;
  const buttons = document.querySelectorAll('#interlocutorChips button');
  buttons.forEach(btn => {
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
  const buttons = document.querySelectorAll('#materialChips button');
  buttons.forEach(btn => {
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
        class="chip-btn ${isSelected ? 'active-blue' : ''} px-3.5 py-2 rounded-xl text-xs font-bold text-left"
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
    showToast('⚠️ Usa Chrome, Edge o Safari para dictar por voz.');
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
    btn.classList.add('mic-recording');
    btnText.textContent = 'Escuchando...';
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    textarea.value = textarea.value ? `${textarea.value.trim()} ${transcript}` : transcript;
    showToast('🎙️ Condición anotada por voz');
  };

  recognition.onend = () => {
    state.isRecordingVoice = false;
    btn.classList.remove('mic-recording');
    btnText.textContent = 'Dictar con voz';
  };

  recognition.start();
};

function checkDuplicateBusiness() {
  const nombre = document.getElementById('negocioNombre').value.trim().toLowerCase();
  const dir = document.getElementById('negocioDireccion').value.trim().toLowerCase();
  const warnBox = document.getElementById('duplicateWarning');

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
      ? '🔥 Muy Interesado'
      : (match.resultado === 'solo_info' ? '🌤️ Ya recibió info / Ya tiene sistema' : '❄️ No interesado');
    warnBox.innerHTML = `⚠️ <b>Radar Anti-Duplicados:</b> Ya se registró <b>${escapeHtml(match.negocio_nombre)}</b> en <b>${escapeHtml(match.direccion)}</b> por ${escapeHtml(match.brigadista_nombre)} → <span class="underline">${statusText}</span> (${escapeHtml(match.motivo_estado || '')}).`;
    warnBox.classList.remove('hidden');
  } else {
    warnBox.classList.add('hidden');
  }
}

window.detectAddressByGps = function() {
  if (!navigator.geolocation) {
    showToast('⚠️ Tu navegador no soporta geolocalización.');
    return;
  }

  const label = document.getElementById('gpsBtnLabel');
  label.textContent = 'Buscando...';

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

      label.textContent = '📍 Listo';
      checkDuplicateBusiness();
    },
    () => {
      label.textContent = 'GPS';
      showToast('⚠️ Activa el permiso de ubicación o escribe la dirección.');
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
  localStorage.setItem(STORAGE_KEYS.VISITS, JSON.stringify(state.visits));

  if (state.supabase) {
    try {
      const { id, ...payload } = newVisit;
      await state.supabase.from('acercamientos').insert([payload]);
    } catch (err) {
      console.warn('Sync pendiente:', err);
    }
  }

  document.getElementById('negocioNombre').value = '';
  document.getElementById('condicionesNotas').value = '';
  document.getElementById('contactoNombre').value = '';
  document.getElementById('contactoTelefono').value = '';
  document.getElementById('duplicateWarning').classList.add('hidden');
  state.form.gps_lat = null;
  state.form.gps_lng = null;
  document.getElementById('gpsBtnLabel').textContent = 'GPS';

  refreshAllUI();

  const myTodayVisits = state.visits.filter(
    v => v.fecha === getTodayISO() && v.brigadista_nombre === state.currentUser.nombre
  );
  const goal = state.preCheckin?.meta_diaria || state.currentUser.meta || 12;

  if (myTodayVisits.length === goal) {
    fireCelebrationConfetti(true);
    showToast(`🏆 ¡META CUMPLIDA! Llegaste a tus ${goal} acercamientos de hoy.`);
  } else if (newVisit.resultado === 'interesado') {
    fireCelebrationConfetti(false);
    showToast(`🔥 ¡ +50 XP ! Cliente interesado guardado (${myTodayVisits.length}/${goal})`);
  } else {
    showToast(`✅ Guardado: ${negocio_nombre} (${myTodayVisits.length}/${goal} hoy)`);
  }

  document.getElementById('negocioNombre').focus();
}

// ============================================================================
// 9. ACTUALIZACIÓN INTEGRAL DE TODA LA INTERFAZ
// ============================================================================
function refreshAllUI() {
  if (!state.currentUser) return;

  renderUserSelects();
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
      missionPill.textContent = '🏆 Objetivo de Brigada Logrado';
      missionHelper.innerHTML = `¡Completaste la meta de <b>${goal} visitas</b> hoy con <b>${myHotToday} clientes muy interesados</b>!`;
    } else {
      missionPill.textContent = `Faltan ${remaining} visitas para tu meta`;
      missionHelper.innerHTML = `Llevas <b>${myToday.length} de ${goal}</b> acercamientos hoy y <b>🔥 ${myHotToday} muy interesados</b>.`;
    }
  }

  setText('deskHistoryCount', state.visits.length);

  if (state.preCheckin && state.preCheckin.completed) {
    document.getElementById('preBrigadaCard')?.classList.add('hidden');
    document.getElementById('brigadaWorkspaceGrid')?.classList.remove('hidden');

    setBadgeStatus('badgeCarnet', '🪪 Carnet', state.preCheckin.tiene_carnet);
    setBadgeStatus('badgeTarjetas', '📇 Tarjetas', state.preCheckin.tiene_tarjetas);
    setBadgeStatus('badgeFolletos', '📄 Folletos', state.preCheckin.tiene_folletos);
    setText('badgeZona', `📍 ${state.preCheckin.zona}`);
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
  const condMsg = v.condiciones_notas ? ` Tuvimos muy en cuenta lo que nos comentaste sobre: "${v.condiciones_notas}".` : '';
  const message = `Hola ${v.contacto_nombre || ''}, ¡qué gusto saludarte hoy en ${v.negocio_nombre}! Soy ${v.brigadista_nombre} del equipo de la brigada.${condMsg} Te comparto por aquí nuestro contacto directo.`;
  const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

  box.innerHTML = `
    <div class="flex items-center justify-between">
      <span class="text-[10px] font-extrabold uppercase tracking-wider bg-violet-500/25 text-violet-200 px-2.5 py-0.5 rounded-full">
        💬 Seguimiento Instantáneo Listo
      </span>
      <button onclick="document.getElementById('lastSavedHighlightBox').classList.add('hidden')" class="text-xs text-violet-300 hover:text-white">✕</button>
    </div>
    <p class="text-xs font-bold text-white">
      Envíale un WhatsApp ahora mismo a <span class="text-violet-300">${escapeHtml(v.negocio_nombre)}</span> con sus condiciones pre-cargadas:
    </p>
    <a
      href="${waUrl}"
      target="_blank"
      class="btn-purple-primary w-full py-2.5 px-4 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2"
    >
      <span>📲 Abrir Chat de WhatsApp con ${escapeHtml(v.contacto_nombre || v.negocio_nombre)}</span>
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
      <div class="p-3.5 rounded-2xl bg-[#1b152c] border border-violet-500/20 space-y-1">
        <div class="flex items-center justify-between gap-2">
          <p class="font-extrabold text-xs text-white truncate">${escapeHtml(v.negocio_nombre)}</p>
          ${badge}
        </div>
        <p class="text-[11px] text-violet-300/70 truncate">
          📍 ${escapeHtml(v.direccion)} · <span class="text-violet-200">${escapeHtml(v.motivo_estado || '')}</span>
        </p>
        ${v.condiciones_notas ? `
          <p class="text-[11px] text-violet-200 bg-violet-500/15 border border-violet-500/30 px-2.5 py-1 rounded-lg truncate">
            💬 "${escapeHtml(v.condiciones_notas)}"
          </p>
        ` : ''}
      </div>
    `;
  }).join('');
}

function populateBrigadistaFilter() {
  const select = document.getElementById('filterHistoryBrigadista');
  if (!select) return;
  const currentVal = select.value;
  const uniqueNames = [...new Set(state.visits.map(v => v.brigadista_nombre))];
  select.innerHTML = `<option value="all">👥 Todos los brigadistas</option>` +
    uniqueNames.map(n => `<option value="${escapeHtml(n)}">👤 ${escapeHtml(n)}</option>`).join('');
  if (uniqueNames.includes(currentVal)) select.value = currentVal;
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
        <span style="font-size: 11px; color: #475569;">📍 ${escapeHtml(v.direccion)}</span><br/>
        <span style="font-size: 11px; font-weight: bold; color: ${color};">● ${escapeHtml(v.motivo_estado || v.resultado)}</span>
        ${v.condiciones_notas ? `<p style="font-size: 11px; background:#f1f5f9; padding:4px 6px; border-radius:6px; margin-top:4px;">"${escapeHtml(v.condiciones_notas)}"</p>` : ''}
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
  const filterResult = document.getElementById('filterHistoryResult')?.value || 'all';
  const filterBrigadista = document.getElementById('filterHistoryBrigadista')?.value || 'all';

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
      <div class="glass-card rounded-3xl p-5 flex flex-col justify-between gap-3 border border-violet-500/20">
        <div class="space-y-2">
          <div class="flex items-start justify-between gap-2">
            <div>
              <h4 class="font-extrabold text-base text-white">${escapeHtml(v.negocio_nombre)}</h4>
              <p class="text-xs text-violet-300 font-semibold">📍 ${escapeHtml(v.direccion)}</p>
            </div>
            ${badge}
          </div>

          <div class="flex flex-wrap gap-1.5 text-[11px]">
            <span class="px-2.5 py-0.5 rounded-lg bg-[#221a38] text-violet-200 font-semibold">${escapeHtml(v.negocio_rubro)}</span>
            <span class="px-2.5 py-0.5 rounded-lg bg-[#221a38] text-violet-200 font-semibold">🗣️ ${escapeHtml(v.interlocutor)}</span>
            <span class="px-2.5 py-0.5 rounded-lg bg-[#221a38] text-violet-200 font-semibold">📦 ${escapeHtml(materials)}</span>
          </div>

          <p class="text-xs text-violet-200 font-semibold">
            📌 Caso: <span class="text-white">${escapeHtml(v.motivo_estado || 'Registrado')}</span>
          </p>

          ${v.condiciones_notas ? `
            <div class="bg-violet-500/15 border border-violet-500/30 rounded-2xl p-3 text-xs text-violet-100 font-medium">
              📝 <b>Condición / Nota:</b> "${escapeHtml(v.condiciones_notas)}"
            </div>
          ` : ''}
        </div>

        <div class="flex items-center justify-between pt-3 border-t border-violet-500/15 text-[11px] text-violet-300/70">
          <div>
            <span>👤 <b class="text-white">${escapeHtml(v.brigadista_nombre)}</b></span>
            <span class="mx-1">·</span>
            <span>${escapeHtml(v.fecha)} ${escapeHtml(v.hora)}</span>
          </div>
          <div class="flex items-center gap-2">
            ${waLink ? `<a href="${waLink}" target="_blank" class="btn-purple-primary px-3 py-1.5 rounded-xl font-extrabold text-xs">💬 WhatsApp</a>` : ''}
            <button onclick="deleteVisit('${v.id}')" class="text-violet-300/50 hover:text-rose-400 font-bold px-2 py-1">✕</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
};

window.deleteVisit = function(id) {
  state.visits = state.visits.filter(v => v.id !== id);
  localStorage.setItem(STORAGE_KEYS.VISITS, JSON.stringify(state.visits));
  refreshAllUI();
};

function getOutcomeBadgeHTML(resultado) {
  if (resultado === 'interesado') {
    return `<span class="text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-violet-500/25 text-violet-200 border border-violet-400/40 shrink-0">🔥 Muy Interesado</span>`;
  }
  if (resultado === 'solo_info') {
    return `<span class="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">🌤️ Info / Ya tiene</span>`;
  }
  return `<span class="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700 shrink-0">❄️ No interesado</span>`;
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
    const medal = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : '👟'));

    return `
      <div class="p-4 rounded-2xl bg-[#1b152c] border border-violet-500/20 space-y-2.5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-3">
            <span class="text-2xl">${medal}</span>
            <div>
              <div class="flex items-center gap-2">
                <span class="font-extrabold text-base text-white">${escapeHtml(nombre)}</span>
                <span class="text-xs font-extrabold text-violet-300">${rank.title}</span>
              </div>
              <p class="text-[11px] text-violet-300/70">⚡ ${xp} XP acumulados · 👑 ${stats.ownerCount} dueños contactados</p>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2 text-xs">
            <span class="font-extrabold text-white bg-[#271e40] px-3 py-1 rounded-full">${stats.total} / ${goal} visitas</span>
            <span class="px-3 py-1 rounded-full bg-violet-500/25 text-violet-200 border border-violet-400/30 font-extrabold">🔥 ${stats.hot} interesados</span>
            <span class="px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold">🌤️ ${stats.info} solo info</span>
          </div>
        </div>

        <div class="w-full h-3 bg-[#0e0b16] rounded-full overflow-hidden p-0.5">
          <div class="h-full bg-violet-500 rounded-full transition-all duration-500" style="width: ${pct}%"></div>
        </div>
      </div>
    `;
  }).join('');

  const totalHot = state.visits.filter(v => v.resultado === 'interesado').length;
  const totalOwners = state.visits.filter(v => (v.interlocutor || '').includes('Dueño')).length;
  const totalKit = state.visits.filter(v => v.tenia_carnet && v.tenia_tarjetas && v.tenia_folletos).length;
  const any12 = rows.some(([, s]) => s.total >= 12);

  const badges = [
    { icon: '🪪', title: 'Embajador con Kit Completo', desc: `${totalKit} acercamientos con Carnet + Tarjeta + Folleto.`, unlocked: totalKit > 0 },
    { icon: '👑', title: 'Francotirador de Decisores', desc: `${totalOwners} conversaciones directas con el Dueño.`, unlocked: totalOwners >= 2 },
    { icon: '🔥', title: 'Imán de Prospectos Calientes', desc: `${totalHot} clientes muy interesados registrados.`, unlocked: totalHot >= 2 },
    { icon: '🏆', title: 'Meta 12/12 Completada', desc: 'Alcanzar los 12 acercamientos diarios de la brigada.', unlocked: any12 }
  ];

  badgesContainer.innerHTML = badges.map(b => `
    <div class="p-4 rounded-2xl border ${b.unlocked ? 'bg-[#211838] border-violet-500/40' : 'bg-[#141022] border-white/5 opacity-50'} space-y-1.5">
      <div class="flex items-center justify-between">
        <span class="text-3xl">${b.icon}</span>
        <span class="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${b.unlocked ? 'bg-violet-500/25 text-violet-200' : 'bg-slate-800 text-slate-400'}">
          ${b.unlocked ? 'Desbloqueada' : 'En curso'}
        </span>
      </div>
      <p class="font-extrabold text-sm text-white">${b.title}</p>
      <p class="text-xs text-violet-200/70 leading-relaxed">${b.desc}</p>
    </div>
  `).join('');
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
  setText('kpiAlreadyHasSystem', `${alreadyHasSystemCount} dijeron "Ya tengo sistema"`);
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
    <div class="p-4 rounded-2xl bg-[#1d1632] border border-violet-500/30 space-y-1">
      <p class="text-violet-300 font-extrabold uppercase text-[10px] tracking-wider">1. Multiplicador por Hablar con el Dueño</p>
      <p class="text-violet-100 leading-relaxed">
        Abordar directamente al <b>Dueño/Decisor</b> convierte al <b class="text-violet-300">${ownerConv}%</b>, mientras que dejar recado con empleados convierte al <b>${nonOwnerConv}%</b>.
      </p>
    </div>

    <div class="p-4 rounded-2xl bg-[#1d1632] border border-violet-500/30 space-y-1">
      <p class="text-violet-300 font-extrabold uppercase text-[10px] tracking-wider">2. Impacto del Check-in (Carnet + Kit)</p>
      <p class="text-violet-100 leading-relaxed">
        Salir con <b>Carnet + Tarjetas + Folletos</b> logró un <b class="text-violet-300">${fullKitConv}%</b> de clientes interesados en ${fullKitVisits.length} locales.
      </p>
    </div>

    <div class="p-4 rounded-2xl bg-[#1d1632] border border-violet-500/30 space-y-1">
      <p class="text-violet-300 font-extrabold uppercase text-[10px] tracking-wider">3. Condiciones Específicas vs Competencia</p>
      <p class="text-violet-100 leading-relaxed">
        Tenemos <b class="text-violet-300">${withConditions.length} negocios</b> listos si cumplimos sus condiciones, y <b>${alreadyHasSystemCount}</b> que ya tienen sistema pero quedaron mapeados con dirección e info.
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
        <tr class="border-b border-violet-500/15 text-violet-300/70 uppercase text-[10px]">
          <th class="py-3 pr-3">Negocio y Dirección</th>
          <th class="py-3 px-3">Condiciones Específicas Solicitadas</th>
          <th class="py-3 px-3">Contacto Directo</th>
          <th class="py-3 pl-3">Brigadista</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-violet-500/10">
        ${hotLeads.map(v => {
          const wa = v.contacto_telefono
            ? `https://wa.me/${v.contacto_telefono.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${v.contacto_nombre || ''}, te saludo respecto a nuestra visita hoy a ${v.negocio_nombre}.`)}`
            : null;
          return `
            <tr class="hover:bg-violet-500/5 transition">
              <td class="py-3.5 pr-3">
                <p class="font-extrabold text-white text-sm">${escapeHtml(v.negocio_nombre)}</p>
                <p class="text-[11px] text-violet-300">📍 ${escapeHtml(v.direccion)}</p>
              </td>
              <td class="py-3.5 px-3">
                <span class="inline-block font-bold text-violet-200 bg-violet-500/25 border border-violet-400/30 px-2.5 py-0.5 rounded-lg mb-1">
                  ${escapeHtml(v.motivo_estado || 'Interesado')}
                </span>
                <p class="text-violet-100 font-medium">
                  ${v.condiciones_notas ? `"${escapeHtml(v.condiciones_notas)}"` : '<span class="text-violet-300/50">Sin condición adicional</span>'}
                </p>
              </td>
              <td class="py-3.5 px-3">
                <p class="font-bold text-white">${escapeHtml(v.contacto_nombre || v.interlocutor)}</p>
                ${wa ? `<a href="${wa}" target="_blank" class="inline-block mt-1 px-2.5 py-1 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-extrabold">💬 ${escapeHtml(v.contacto_telefono)}</a>` : '<span class="text-violet-300/50">Sin teléfono</span>'}
              </td>
              <td class="py-3.5 pl-3 text-violet-300/70">
                <p class="font-bold text-violet-100">${escapeHtml(v.brigadista_nombre)}</p>
                <p class="text-[10px]">${escapeHtml(v.fecha)} · ${escapeHtml(v.hora)}</p>
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
      labels: ['🔥 Muy Interesados', '🌤️ Solo Info / Ya tiene sistema', '❄️ No interesados'],
      datasets: [{
        data: [hotCount, warmCount, coldCount],
        backgroundColor: ['#8b5cf6', '#f59e0b', '#475569'],
        borderColor: '#161224',
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
      if (deskBtns[k]) deskBtns[k].className = 'px-3 py-2.5 rounded-xl text-xs font-extrabold bg-violet-600 text-white shadow text-center';
    } else {
      sections[k]?.classList.add('hidden');
      if (deskBtns[k]) deskBtns[k].className = 'px-3 py-2.5 rounded-xl text-xs font-bold bg-[#1d1630] text-violet-200 hover:text-white text-center';
    }
  });

  if (tab === 'history') renderHistoryList();
  if (tab === 'leaderboard') renderLeaderboardAndBadges();
  if (tab === 'analytics') renderAnalytics();
};

// ============================================================================
// 10. EXPORTACIÓN EXCEL Y DATOS INICIALES DE LOS 4 MÓDULOS
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
  showToast('📥 Excel (.CSV) descargado');
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
      mood: '🔥 A tope'
    },
    {
      id: 'dly_2',
      fecha: today,
      hora: '08:40 a. m.',
      author: 'Laura Martínez',
      focus: 'Completar mis 12 acercamientos en Calle 80 enfocándome en hablar directamente con los dueños.',
      done: 'Agendé demostración con Restaurante Brasas & Sazón.',
      blocker: 'Necesito más tarjetas impresas para la tarde.',
      mood: '⚡ Enfocad@'
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
  localStorage.setItem(STORAGE_KEYS.VISITS, JSON.stringify(state.visits));
  refreshAllUI();
  fireCelebrationConfetti(false);
  showToast('✨ Visitas simuladas agregadas.');
};

function initSupabaseIfConfigured() {
  try {
    const cfg = JSON.parse(localStorage.getItem(STORAGE_KEYS.SUPABASE_CFG) || 'null');
    if (cfg && cfg.url && cfg.key && window.supabase) {
      state.supabase = window.supabase.createClient(cfg.url, cfg.key);
      document.getElementById('cloudStatusDot').className = 'w-2 h-2 rounded-full bg-violet-400';
      setText('cloudStatusText', 'Nube Activa');
    }
  } catch (e) {
    console.warn('Error Supabase:', e);
  }
}

function openCloudModal() {
  const cfg = JSON.parse(localStorage.getItem(STORAGE_KEYS.SUPABASE_CFG) || 'null');
  document.getElementById('supaUrlInput').value = cfg?.url || '';
  document.getElementById('supaKeyInput').value = cfg?.key || '';
  document.getElementById('cloudModal').classList.remove('hidden');
}

window.closeCloudModal = function() {
  document.getElementById('cloudModal').classList.add('hidden');
};

window.saveSupabaseConfig = function() {
  const url = document.getElementById('supaUrlInput').value.trim();
  const key = document.getElementById('supaKeyInput').value.trim();
  if (!url || !key) return;
  localStorage.setItem(STORAGE_KEYS.SUPABASE_CFG, JSON.stringify({ url, key }));
  initSupabaseIfConfigured();
  closeCloudModal();
  showToast('☁️ Conectado a Supabase.');
};

window.disconnectSupabase = function() {
  localStorage.removeItem(STORAGE_KEYS.SUPABASE_CFG);
  state.supabase = null;
  document.getElementById('cloudStatusDot').className = 'w-2 h-2 rounded-full bg-amber-400';
  setText('cloudStatusText', 'Local');
  closeCloudModal();
};

function showToast(msg) {
  const toast = document.getElementById('toastNotification');
  const msgEl = document.getElementById('toastMessage');
  if (!toast || !msgEl) return;
  msgEl.textContent = msg;
  toast.classList.remove('hidden');
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
