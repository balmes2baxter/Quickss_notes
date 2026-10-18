// ============================================================================
// BRIGADAPRO — LÓGICA DE APLICACIÓN, SINCRONIZACIÓN SUPABASE Y ANALÍTICA
// ============================================================================

const STORAGE_KEYS = {
  USERS: 'brigadapro_users_v1',
  CURRENT_USER: 'brigadapro_current_user_v1',
  PRE_CHECKIN: 'brigadapro_pre_checkin_v1',
  VISITS: 'brigadapro_visits_v1',
  SUPABASE_CFG: 'brigadapro_supabase_cfg_v1'
};

// Opciones rápidas según el resultado de la visita
const OUTCOME_PRESETS = {
  interesado: {
    label: '🔥 ¿Cómo estuvo interesado? (1 toque):',
    condLabel: '✍️ Condiciones específicas del cliente o acuerdos clave:',
    placeholder: 'Ej: "Me interesa, pero si tienen facturación POS e inventario..." / "Llamar mañana a las 10am"',
    chips: [
      'Interesado si cumple condiciones específicas',
      'Listo para cotización / propuesta',
      'Quiere agendar demostración',
      'Muy interesado en precios y planes'
    ]
  },
  solo_info: {
    label: '🌤️ ¿Qué pasó en este negocio? (Queda registrado negocio y dirección):',
    condLabel: '✍️ Nota rápida (Ej: qué sistema tiene actualmente o a quién se dejó la info):',
    placeholder: 'Ej: Ya tiene sistema Siigo/Alegra, se dejó folleto y tarjeta en mostrador...',
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
    placeholder: 'Ej: Local de cadena nacional, decisiones en sede principal...',
    chips: [
      'Ya tiene sistema y está conforme',
      'No aplica para su tipo de negocio',
      'Estaban muy ocupados para atender',
      'Sucursal / No toman decisiones ahí'
    ]
  }
};

// Estado en memoria
let state = {
  users: [],
  currentUser: null,
  preCheckin: null, // { fecha, tiene_carnet, tiene_tarjetas, tiene_folletos, zona, meta_diaria, completed }
  visits: [],
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
  charts: {
    outcomes: null,
    reasons: null
  }
};

// ============================================================================
// 1. INICIALIZACIÓN
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  loadLocalState();
  initSupabaseIfConfigured();
  setupEventListeners();
  updateClockPreview();
  setInterval(updateClockPreview, 30000);

  if (state.currentUser) {
    hideAuthScreen();
    refreshAllUI();
  } else {
    renderSavedUsersOnLogin();
  }
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
  if (el) {
    el.textContent = `🕒 Hoy · ${getCurrentTimeFormatted()}`;
  }
}

function loadLocalState() {
  try {
    const savedUsers = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    const savedCurrent = JSON.parse(localStorage.getItem(STORAGE_KEYS.CURRENT_USER) || 'null');
    const savedPre = JSON.parse(localStorage.getItem(STORAGE_KEYS.PRE_CHECKIN) || 'null');
    const savedVisits = JSON.parse(localStorage.getItem(STORAGE_KEYS.VISITS) || 'null');

    state.users = savedUsers.length > 0 ? savedUsers : [
      { id: 'usr_1', nombre: 'Andrés Gómez', rol: 'Líder / Admin', meta: 12 },
      { id: 'usr_2', nombre: 'Laura Martínez', rol: 'Brigadista', meta: 12 },
      { id: 'usr_3', nombre: 'Camila Rojas', rol: 'Brigadista', meta: 12 }
    ];
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(state.users));

    state.currentUser = savedCurrent;

    // Verificar si el Check-in guardado corresponde al usuario actual y al día de hoy
    const today = getTodayISO();
    if (savedPre && savedPre.fecha === today && state.currentUser && savedPre.brigadista_id === state.currentUser.id) {
      state.preCheckin = savedPre;
    } else {
      state.preCheckin = null;
    }

    if (savedVisits && Array.isArray(savedVisits)) {
      state.visits = savedVisits;
    } else {
      // Cargar un set inicial realista para que el usuario vea cómo luce el sistema desde el primer segundo
      state.visits = generateInitialSampleData();
      localStorage.setItem(STORAGE_KEYS.VISITS, JSON.stringify(state.visits));
    }
  } catch (e) {
    console.error('Error cargando estado local:', e);
    state.visits = [];
  }
}

function setupEventListeners() {
  // Login Form
  const loginForm = document.getElementById('loginForm');
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const nombre = document.getElementById('loginNameInput').value.trim();
    const rol = document.getElementById('loginRoleInput').value;
    const meta = parseInt(document.getElementById('loginGoalInput').value, 10) || 12;
    if (!nombre) return;

    let existing = state.users.find(u => u.nombre.toLowerCase() === nombre.toLowerCase());
    if (!existing) {
      existing = {
        id: 'usr_' + Date.now(),
        nombre,
        rol,
        meta
      };
      state.users.push(existing);
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(state.users));
    } else {
      existing.rol = rol;
      existing.meta = meta;
    }

    loginAsUser(existing);
  });

  // Botón cambiar usuario
  document.getElementById('btnSwitchUser').addEventListener('click', () => {
    renderSavedUsersOnLogin();
    document.getElementById('authScreen').classList.remove('hidden');
  });

  // Botón modal nube
  document.getElementById('btnOpenCloudModal').addEventListener('click', openCloudModal);

  // Detectar duplicados mientras escribe el negocio o la dirección
  document.getElementById('negocioNombre').addEventListener('input', checkDuplicateBusiness);
  document.getElementById('negocioDireccion').addEventListener('input', checkDuplicateBusiness);

  // Guardar visita
  document.getElementById('visitForm').addEventListener('submit', handleVisitSubmit);
}

// ============================================================================
// 2. GESTIÓN DE CUENTAS DE BRIGADISTA
// ============================================================================
function renderSavedUsersOnLogin() {
  const container = document.getElementById('savedUsersList');
  if (!container) return;

  container.innerHTML = state.users.map(u => {
    const initials = u.nombre.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const todayCount = state.visits.filter(v => v.fecha === getTodayISO() && v.brigadista_nombre === u.nombre).length;
    return `
      <button
        type="button"
        onclick="selectSavedUser('${u.id}')"
        class="w-full p-3 rounded-2xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 flex items-center justify-between transition text-left"
      >
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 font-extrabold text-xs flex items-center justify-center">
            ${initials}
          </div>
          <div>
            <p class="font-bold text-sm text-slate-900">${escapeHtml(u.nombre)}</p>
            <p class="text-[11px] text-slate-500">${escapeHtml(u.rol)} · Meta: ${u.meta || 12} visitas</p>
          </div>
        </div>
        <span class="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
          Hoy: ${todayCount}/${u.meta || 12} →
        </span>
      </button>
    `;
  }).join('');
}

window.selectSavedUser = function(userId) {
  const user = state.users.find(u => u.id === userId);
  if (user) {
    loginAsUser(user);
  }
};

function loginAsUser(user) {
  state.currentUser = user;
  localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));

  // Revisar si ya hizo el check-in hoy
  const savedPre = JSON.parse(localStorage.getItem(STORAGE_KEYS.PRE_CHECKIN) || 'null');
  if (savedPre && savedPre.fecha === getTodayISO() && savedPre.brigadista_id === user.id) {
    state.preCheckin = savedPre;
  } else {
    state.preCheckin = null;
    document.getElementById('inputMetaDiaria').value = user.meta || 12;
  }

  hideAuthScreen();
  refreshAllUI();
}

function hideAuthScreen() {
  document.getElementById('authScreen').classList.add('hidden');
}

// ============================================================================
// 3. PASO 1: CHECK-IN DE EQUIPAMIENTO ANTES DE INICIAR LA BRIGADA
// ============================================================================
window.togglePreCheck = function(item) {
  const map = {
    carnet: { chk: 'chkCarnet', card: 'checkCardCarnet', label: 'labelCarnetState', yes: 'Sí, lo tengo puesto', no: 'No llevo carnet hoy' },
    tarjetas: { chk: 'chkTarjetas', card: 'checkCardTarjetas', label: 'labelTarjetasState', yes: 'Sí, llevo tarjetas', no: 'Sin tarjetas hoy' },
    folletos: { chk: 'chkFolletos', card: 'checkCardFolletos', label: 'labelFolletosState', yes: 'Sí, llevo folletos', no: 'Sin folletos hoy' }
  };
  const cfg = map[item];
  if (!cfg) return;

  const checkbox = document.getElementById(cfg.chk);
  checkbox.checked = !checkbox.checked;
  updatePreCheckCardUI(cfg, checkbox.checked);
};

function updatePreCheckCardUI(cfg, isChecked) {
  const card = document.getElementById(cfg.card);
  const label = document.getElementById(cfg.label);
  if (isChecked) {
    card.classList.add('equipped');
    card.classList.remove('not-equipped');
    label.textContent = cfg.yes;
    label.className = 'text-xs font-semibold text-blue-700';
  } else {
    card.classList.remove('equipped');
    card.classList.add('not-equipped');
    label.textContent = cfg.no;
    label.className = 'text-xs font-semibold text-rose-600';
  }
}

window.confirmPreBrigada = async function() {
  if (!state.currentUser) return;

  const tiene_carnet = document.getElementById('chkCarnet').checked;
  const tiene_tarjetas = document.getElementById('chkTarjetas').checked;
  const tiene_folletos = document.getElementById('chkFolletos').checked;
  const zona = document.getElementById('inputZonaBrigada').value.trim() || 'Sector General';
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

  // Pre-seleccionar automáticamente el material que lleva según su check-in
  const defaultMat = ['Explicación verbal'];
  if (tiene_folletos) defaultMat.unshift('Folleto');
  if (tiene_tarjetas) defaultMat.unshift('Tarjeta');
  state.form.material = defaultMat;
  syncMaterialChipsUI();

  // Guardar sesión en Supabase si está conectado
  if (state.supabase) {
    try {
      await state.supabase.from('sesiones_brigada').insert([{
        fecha: state.preCheckin.fecha,
        brigadista_id: state.preCheckin.brigadista_id,
        brigadista_nombre: state.preCheckin.brigadista_nombre,
        zona: state.preCheckin.zona,
        tiene_carnet: state.preCheckin.tiene_carnet,
        tiene_tarjetas: state.preCheckin.tiene_tarjetas,
        tiene_folletos: state.preCheckin.tiene_folletos,
        meta_diaria: state.preCheckin.meta_diaria
      }]);
    } catch (e) {
      console.warn('Error sincronizando sesión con Supabase:', e);
    }
  }

  refreshAllUI();
  showToast('🎒 ¡Equipamiento confirmado! Ya puedes anotar visitas rápido.');
  setTimeout(() => {
    document.getElementById('negocioNombre')?.focus();
  }, 150);
};

window.reopenPreBrigada = function() {
  document.getElementById('preBrigadaCard').classList.remove('hidden');
  document.getElementById('activeBrigadaBanner').classList.add('hidden');
  document.getElementById('visitForm').classList.add('hidden');
};

// ============================================================================
// 4. PASO 2: FORMULARIO SÚPER RÁPIDO EN TERRENO
// ============================================================================
window.selectRubro = function(rubro) {
  state.form.rubro = rubro;
  const buttons = document.querySelectorAll('#rubroChips button');
  buttons.forEach(btn => {
    if (btn.textContent.includes(rubro.split(' ')[0])) {
      btn.classList.add('active-blue');
    } else {
      btn.classList.remove('active-blue');
    }
  });
};

window.selectInterlocutor = function(persona) {
  state.form.interlocutor = persona;
  const buttons = document.querySelectorAll('#interlocutorChips button');
  buttons.forEach(btn => {
    if (btn.getAttribute('onclick').includes(persona)) {
      btn.classList.add('active-indigo');
    } else {
      btn.classList.remove('active-indigo');
    }
  });
};

window.toggleMaterial = function(mat) {
  const idx = state.form.material.indexOf(mat);
  if (idx >= 0) {
    state.form.material.splice(idx, 1);
  } else {
    state.form.material.push(mat);
  }
  syncMaterialChipsUI();
};

function syncMaterialChipsUI() {
  const buttons = document.querySelectorAll('#materialChips button');
  buttons.forEach(btn => {
    const mat = btn.getAttribute('data-mat');
    if (state.form.material.includes(mat)) {
      btn.classList.add('active-indigo');
    } else {
      btn.classList.remove('active-indigo');
    }
  });
}

window.selectVisitResult = function(resultado) {
  state.form.resultado = resultado;

  const cardHot = document.getElementById('cardResultHot');
  const cardWarm = document.getElementById('cardResultWarm');
  const cardCold = document.getElementById('cardResultCold');

  cardHot.classList.remove('selected-hot');
  cardWarm.classList.remove('selected-warm');
  cardCold.classList.remove('selected-cold');

  if (resultado === 'interesado') cardHot.classList.add('selected-hot');
  if (resultado === 'solo_info') cardWarm.classList.add('selected-warm');
  if (resultado === 'no_interesado') cardCold.classList.add('selected-cold');

  const preset = OUTCOME_PRESETS[resultado];
  document.getElementById('outcomeChipsLabel').textContent = preset.label;
  document.getElementById('conditionsLabel').textContent = preset.condLabel;
  document.getElementById('condicionesNotas').placeholder = preset.placeholder;

  // Seleccionar el primer chip por defecto para ahorrar clics
  state.form.motivo_estado = preset.chips[0];
  renderOutcomeSubChips(preset.chips);
};

function renderOutcomeSubChips(chips) {
  const container = document.getElementById('outcomeQuickChips');
  container.innerHTML = chips.map(chipText => {
    const isSelected = state.form.motivo_estado === chipText;
    return `
      <button
        type="button"
        onclick="selectOutcomeChip('${escapeHtml(chipText)}')"
        class="chip-btn ${isSelected ? 'active-blue' : ''} px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 text-left"
      >
        ${escapeHtml(chipText)}
      </button>
    `;
  }).join('');
}

window.selectOutcomeChip = function(chipText) {
  state.form.motivo_estado = chipText;
  const preset = OUTCOME_PRESETS[state.form.resultado];
  renderOutcomeSubChips(preset.chips);
};

// Detector de negocios o direcciones ya visitadas
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
    const badge = match.resultado === 'interesado' ? '🔥 Muy Interesado' : (match.resultado === 'solo_info' ? '🌤️ Ya se le dio info / Ya tiene sistema' : '❄️ No interesado');
    warnBox.innerHTML = `⚠️ <b>Aviso:</b> Ya existe un registro similar: <b>${escapeHtml(match.negocio_nombre)}</b> (${escapeHtml(match.direccion)}) por ${escapeHtml(match.brigadista_nombre)} → <b>${badge}</b> (${escapeHtml(match.motivo_estado || '')}).`;
    warnBox.classList.remove('hidden');
  } else {
    warnBox.classList.add('hidden');
  }
}

// GPS y Geocodificación gratuita en 1 toque
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
    zona: state.preCheckin?.zona || 'Sector General',
    negocio_nombre,
    negocio_rubro: state.form.rubro,
    direccion,
    gps_lat: state.form.gps_lat,
    gps_lng: state.form.gps_lng,
    interlocutor: state.form.interlocutor,
    material_entregado: [...state.form.material],
    resultado: state.form.resultado,
    motivo_estado: state.form.motivo_estado,
    condiciones_notas,
    contacto_nombre,
    contacto_telefono,
    created_at: new Date().toISOString()
  };

  // Guardar primero en memoria local (velocidad instantánea < 10ms)
  state.visits.unshift(newVisit);
  localStorage.setItem(STORAGE_KEYS.VISITS, JSON.stringify(state.visits));

  // Sincronizar con Supabase en segundo plano si está configurado
  if (state.supabase) {
    try {
      const { id, ...payload } = newVisit;
      await state.supabase.from('acercamientos').insert([payload]);
    } catch (err) {
      console.warn('Guardado local OK, pendiente sync nube:', err);
    }
  }

  // Limpiar campos pero dejar el prefijo de la calle para que el siguiente local en la misma cuadra sea aún más rápido
  document.getElementById('negocioNombre').value = '';
  document.getElementById('condicionesNotas').value = '';
  document.getElementById('contactoNombre').value = '';
  document.getElementById('contactoTelefono').value = '';
  document.getElementById('duplicateWarning').classList.add('hidden');

  refreshAllUI();

  // Mensaje motivacional según meta
  const myTodayVisits = state.visits.filter(
    v => v.fecha === getTodayISO() && v.brigadista_nombre === state.currentUser.nombre
  );
  const goal = state.preCheckin?.meta_diaria || state.currentUser.meta || 12;

  if (myTodayVisits.length === goal) {
    showToast(`🎉 ¡FELICITACIONES! Completaste tu meta de ${goal} acercamientos hoy.`);
  } else if (newVisit.resultado === 'interesado') {
    showToast(`🔥 ¡Excelente! Prospecto interesado guardado (${myTodayVisits.length}/${goal})`);
  } else {
    showToast(`✅ Guardado: ${negocio_nombre} (${myTodayVisits.length}/${goal} hoy)`);
  }

  document.getElementById('negocioNombre').focus();
}

// ============================================================================
// 5. ACTUALIZACIÓN DE INTERFAZ Y METAS DE BRIGADA
// ============================================================================
function refreshAllUI() {
  if (!state.currentUser) return;

  // Cabecera de usuario
  const initials = state.currentUser.nombre.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  document.getElementById('userAvatarBadge').textContent = initials;
  document.getElementById('headerUserName').textContent = state.currentUser.nombre;
  document.getElementById('headerUserRole').textContent = state.currentUser.rol;

  const todayFormatted = new Date().toLocaleDateString('es-CO', {
    weekday: 'short', day: 'numeric', month: 'short'
  });
  const zonaText = state.preCheckin?.zona ? ` · 📍 ${state.preCheckin.zona}` : '';
  document.getElementById('headerDateZone').textContent = `${todayFormatted}${zonaText}`;

  // Progreso de Meta Diaria (12 visitas + contador de interesados)
  const todayISO = getTodayISO();
  const myToday = state.visits.filter(v => v.fecha === todayISO && v.brigadista_nombre === state.currentUser.nombre);
  const myHotToday = myToday.filter(v => v.resultado === 'interesado').length;
  const myInfoToday = myToday.filter(v => v.resultado === 'solo_info').length;
  const goal = state.preCheckin?.meta_diaria || state.currentUser.meta || 12;
  const pct = Math.min(100, Math.round((myToday.length / goal) * 100));

  document.getElementById('goalProgressCounter').textContent = `${myToday.length} / ${goal}`;
  document.getElementById('hotProgressCounter').textContent = myHotToday;
  document.getElementById('infoProgressCounter').textContent = myInfoToday;
  document.getElementById('goalProgressBar').style.width = `${pct}%`;
  document.getElementById('navHistoryCount').textContent = state.visits.length;

  // Mostrar Check-in o Formulario según corresponda
  if (state.preCheckin && state.preCheckin.completed) {
    document.getElementById('preBrigadaCard').classList.add('hidden');
    document.getElementById('activeBrigadaBanner').classList.remove('hidden');
    document.getElementById('visitForm').classList.remove('hidden');

    setBadgeStatus('badgeCarnet', '🪪 Carnet', state.preCheckin.tiene_carnet);
    setBadgeStatus('badgeTarjetas', '📇 Tarjetas', state.preCheckin.tiene_tarjetas);
    setBadgeStatus('badgeFolletos', '📄 Folletos', state.preCheckin.tiene_folletos);
    document.getElementById('badgeZona').textContent = `📍 ${state.preCheckin.zona}`;
  } else {
    document.getElementById('preBrigadaCard').classList.remove('hidden');
    document.getElementById('activeBrigadaBanner').classList.add('hidden');
    document.getElementById('visitForm').classList.add('hidden');
  }

  // Inicializar chips de resultado si están vacíos
  if (!document.getElementById('outcomeQuickChips').innerHTML.trim()) {
    selectVisitResult(state.form.resultado);
  }

  renderRecentMiniList();
  renderHistoryList();
  renderAnalytics();
}

function setBadgeStatus(id, label, active) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = `${label}: ${active ? 'Sí' : 'No'}`;
  el.className = active
    ? 'px-2.5 py-1 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200'
    : 'px-2.5 py-1 rounded-full font-semibold bg-rose-50 text-rose-700 border border-rose-200';
}

function renderRecentMiniList() {
  const container = document.getElementById('recentVisitsMiniList');
  const recent = state.visits.slice(0, 3);
  if (recent.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-400 py-2 text-center">Aún no hay visitas registradas hoy.</p>`;
    return;
  }

  container.innerHTML = recent.map(v => {
    const badge = getOutcomeBadgeHTML(v.resultado);
    return `
      <div class="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <p class="font-bold text-xs text-slate-900 truncate">${escapeHtml(v.negocio_nombre)}</p>
            ${badge}
          </div>
          <p class="text-[11px] text-slate-500 truncate mt-0.5">
            📍 ${escapeHtml(v.direccion)} · ${escapeHtml(v.motivo_estado || '')}
          </p>
          ${v.condiciones_notas ? `<p class="text-[11px] text-emerald-800 font-medium truncate mt-0.5">💬 "${escapeHtml(v.condiciones_notas)}"</p>` : ''}
        </div>
        <span class="text-[10px] font-semibold text-slate-400 shrink-0">${escapeHtml(v.hora)}</span>
      </div>
    `;
  }).join('');
}

// ============================================================================
// 6. DIRECTORIO DE NEGOCIOS Y DIRECCIONES
// ============================================================================
window.renderHistoryList = function() {
  const container = document.getElementById('fullHistoryList');
  if (!container) return;

  const query = (document.getElementById('searchHistoryInput')?.value || '').trim().toLowerCase();
  const filterResult = document.getElementById('filterHistoryResult')?.value || 'all';

  const filtered = state.visits.filter(v => {
    const matchesResult = filterResult === 'all' || v.resultado === filterResult;
    const matchesQuery = !query ||
      v.negocio_nombre.toLowerCase().includes(query) ||
      v.direccion.toLowerCase().includes(query) ||
      (v.condiciones_notas || '').toLowerCase().includes(query) ||
      (v.motivo_estado || '').toLowerCase().includes(query) ||
      v.brigadista_nombre.toLowerCase().includes(query);
    return matchesResult && matchesQuery;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="bg-white rounded-3xl p-8 text-center border border-slate-200">
        <p class="text-sm font-bold text-slate-600">No se encontraron negocios con ese filtro</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(v => {
    const badge = getOutcomeBadgeHTML(v.resultado);
    const materials = Array.isArray(v.material_entregado) && v.material_entregado.length > 0
      ? v.material_entregado.join(' + ')
      : 'Abordaje verbal';
    const waLink = v.contacto_telefono
      ? `https://wa.me/${v.contacto_telefono.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${v.contacto_nombre || ''}, te escribimos tras nuestra visita hoy a ${v.negocio_nombre}.`)}`
      : null;

    return `
      <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="space-y-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-extrabold text-sm text-slate-900">${escapeHtml(v.negocio_nombre)}</span>
            <span class="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-semibold">${escapeHtml(v.negocio_rubro)}</span>
            ${badge}
          </div>

          <p class="text-xs text-slate-600 font-medium">
            📍 <b>Dirección:</b> ${escapeHtml(v.direccion)} · <span class="text-slate-400">Habló con: ${escapeHtml(v.interlocutor)}</span>
          </p>

          <p class="text-xs text-slate-700">
            📌 <b>Estado:</b> ${escapeHtml(v.motivo_estado || 'Registrado')}
            <span class="text-slate-400 ml-1">(${escapeHtml(materials)})</span>
          </p>

          ${v.condiciones_notas ? `
            <div class="bg-emerald-50/80 border border-emerald-200 rounded-xl px-3 py-1.5 text-xs text-emerald-950 font-medium mt-1">
              📝 <b>Condición / Nota:</b> "${escapeHtml(v.condiciones_notas)}"
            </div>
          ` : ''}

          <div class="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-400">
            <span>👤 Resp: <b class="text-slate-600">${escapeHtml(v.brigadista_nombre)}</b></span>
            <span>📅 ${escapeHtml(v.fecha)} · ${escapeHtml(v.hora)}</span>
            <span>${v.tenia_carnet ? '🪪 Con carnet' : '⚠️ Sin carnet'}</span>
          </div>
        </div>

        <div class="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
          ${waLink ? `
            <a
              href="${waLink}"
              target="_blank"
              class="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
            >
              <span>💬 WhatsApp</span>
              <span>(${escapeHtml(v.contacto_telefono)})</span>
            </a>
          ` : ''}
          <button
            onclick="deleteVisit('${v.id}')"
            class="text-[11px] text-slate-400 hover:text-rose-600 font-semibold px-2 py-1"
          >
            Eliminar
          </button>
        </div>
      </div>
    `;
  }).join('');
};

window.deleteVisit = function(id) {
  state.visits = state.visits.filter(v => v.id !== id);
  localStorage.setItem(STORAGE_KEYS.VISITS, JSON.stringify(state.visits));
  refreshAllUI();
  showToast('🗑️ Registro eliminado');
};

function getOutcomeBadgeHTML(resultado) {
  if (resultado === 'interesado') {
    return `<span class="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">🔥 Muy Interesado</span>`;
  }
  if (resultado === 'solo_info') {
    return `<span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">🌤️ Info entregada / Ya tiene</span>`;
  }
  return `<span class="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-300">❄️ No interesado</span>`;
}

// ============================================================================
// 7. MOTOR DE ANÁLISIS DE DATOS Y CONCLUSIONES DE BRIGADA
// ============================================================================
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

  // KPIs
  document.getElementById('kpiTotalVisits').textContent = total;
  document.getElementById('kpiHotLeads').textContent = hot.length;
  document.getElementById('kpiConversionRate').textContent = `${convRate}% tasa de interés positivo`;
  document.getElementById('kpiWarmInfo').textContent = warm.length;
  document.getElementById('kpiAlreadyHasSystem').textContent = `${alreadyHasSystemCount} dijeron "Ya tengo sistema"`;
  document.getElementById('kpiCarnetRate').textContent = `${carnetRate}%`;
  document.getElementById('kpiDecisionMakerRate').textContent = `${ownerRate}% hablaron con el dueño`;

  // 1. Generar Insights Inteligentes cruzando variables
  renderSmartInsights(visits, hot, alreadyHasSystemCount);

  // 2. Ranking por Brigadista frente a la meta de 12 visitas
  renderBrigadistaProgress(visits);

  // 3. Tabla de Clientes Interesados + Condiciones
  renderHotLeadsTable(hot);

  // 4. Actualizar Gráficos si la pestaña es visible
  if (!document.getElementById('tabAnalytics').classList.contains('hidden')) {
    renderCharts(hot.length, warm.length, cold.length, visits);
  }
}

function renderSmartInsights(visits, hot, alreadyHasSystemCount) {
  const box = document.getElementById('aiInsightsContainer');
  if (!box) return;

  if (visits.length === 0) {
    box.innerHTML = `<div class="col-span-3 text-slate-400">Registra acercamientos para ver el análisis automático.</div>`;
    return;
  }

  // Cruce 1: Efectividad al hablar con Dueño vs Empleado
  const ownerVisits = visits.filter(v => (v.interlocutor || '').includes('Dueño'));
  const ownerHot = ownerVisits.filter(v => v.resultado === 'interesado');
  const ownerConv = ownerVisits.length > 0 ? Math.round((ownerHot.length / ownerVisits.length) * 100) : 0;

  const nonOwnerVisits = visits.filter(v => !(v.interlocutor || '').includes('Dueño'));
  const nonOwnerHot = nonOwnerVisits.filter(v => v.resultado === 'interesado');
  const nonOwnerConv = nonOwnerVisits.length > 0 ? Math.round((nonOwnerHot.length / nonOwnerVisits.length) * 100) : 0;

  // Cruce 2: Equipamiento completo (Carnet + Tarjeta + Folleto)
  const fullKitVisits = visits.filter(v => v.tenia_carnet && v.tenia_tarjetas && v.tenia_folletos);
  const fullKitHot = fullKitVisits.filter(v => v.resultado === 'interesado');
  const fullKitConv = fullKitVisits.length > 0 ? Math.round((fullKitHot.length / fullKitVisits.length) * 100) : 0;

  // Cruce 3: Clientes con condiciones específicas
  const withConditions = hot.filter(v => v.condiciones_notas && v.condiciones_notas.trim().length > 3);

  box.innerHTML = `
    <div class="bg-slate-800/90 p-3.5 rounded-2xl border border-slate-700">
      <p class="text-blue-400 font-extrabold uppercase text-[10px] tracking-wider mb-1">1. Impacto del Decisor</p>
      <p class="text-slate-100 leading-relaxed">
        Cuando el brigadista habla con el <b>Dueño/Decisor</b>, el interés sube al <b class="text-emerald-400">${ownerConv}%</b> (vs <b>${nonOwnerConv}%</b> cuando atiende un empleado).
      </p>
    </div>

    <div class="bg-slate-800/90 p-3.5 rounded-2xl border border-slate-700">
      <p class="text-emerald-400 font-extrabold uppercase text-[10px] tracking-wider mb-1">2. Efecto Kit Completo (Check-in)</p>
      <p class="text-slate-100 leading-relaxed">
        Salir con <b>Carnet + Tarjetas + Folletos</b> registra un <b class="text-emerald-400">${fullKitConv}%</b> de clientes interesados sobre ${fullKitVisits.length} visitas con kit completo.
      </p>
    </div>

    <div class="bg-slate-800/90 p-3.5 rounded-2xl border border-slate-700">
      <p class="text-amber-400 font-extrabold uppercase text-[10px] tracking-wider mb-1">3. Condiciones vs Competencia</p>
      <p class="text-slate-100 leading-relaxed">
        <b>${withConditions.length} negocios</b> están interesados bajo condiciones específicas, mientras que <b>${alreadyHasSystemCount}</b> indicaron que ya tienen sistema y quedaron con nuestra info.
      </p>
    </div>
  `;
}

function renderBrigadistaProgress(visits) {
  const container = document.getElementById('brigadistasRankingList');
  if (!container) return;

  const grouped = {};
  visits.forEach(v => {
    if (!grouped[v.brigadista_nombre]) {
      grouped[v.brigadista_nombre] = { total: 0, hot: 0, info: 0, carnetYes: 0 };
    }
    grouped[v.brigadista_nombre].total += 1;
    if (v.resultado === 'interesado') grouped[v.brigadista_nombre].hot += 1;
    if (v.resultado === 'solo_info') grouped[v.brigadista_nombre].info += 1;
    if (v.tenia_carnet) grouped[v.brigadista_nombre].carnetYes += 1;
  });

  const rows = Object.entries(grouped).sort((a, b) => b[1].total - a[1].total);
  if (rows.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-400">Sin datos de brigadistas aún.</p>`;
    return;
  }

  container.innerHTML = rows.map(([nombre, stats]) => {
    const goal = 12;
    const pct = Math.min(100, Math.round((stats.total / goal) * 100));
    const goalReached = stats.total >= goal;
    return `
      <div class="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="font-extrabold text-sm text-slate-900">${escapeHtml(nombre)}</span>
            ${goalReached ? `<span class="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">🏆 Meta de 12 cumplida</span>` : ''}
          </div>
          <div class="flex items-center gap-2 text-xs">
            <span class="font-extrabold text-slate-800">${stats.total} / ${goal} visitas</span>
            <span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">🔥 ${stats.hot} interesados</span>
            <span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">🌤️ ${stats.info} solo info</span>
          </div>
        </div>
        <div class="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
          <div class="h-full ${goalReached ? 'bg-emerald-500' : 'bg-blue-600'} rounded-full" style="width: ${pct}%"></div>
        </div>
      </div>
    `;
  }).join('');
}

function renderHotLeadsTable(hotLeads) {
  const container = document.getElementById('hotLeadsTableContainer');
  if (!container) return;

  if (hotLeads.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-400 py-4 text-center">Aún no hay clientes marcados como Muy Interesados.</p>`;
    return;
  }

  container.innerHTML = `
    <table class="w-full text-left border-collapse text-xs">
      <thead>
        <tr class="border-b border-slate-200 text-slate-400 uppercase text-[10px]">
          <th class="py-2.5 pr-3">Negocio y Dirección</th>
          <th class="py-2.5 px-3">Condiciones Específicas / Qué pidió</th>
          <th class="py-2.5 px-3">Contacto</th>
          <th class="py-2.5 pl-3">Brigadista</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        ${hotLeads.map(v => {
          const wa = v.contacto_telefono
            ? `https://wa.me/${v.contacto_telefono.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${v.contacto_nombre || ''}, te saludo respecto a nuestra visita a ${v.negocio_nombre}.`)}`
            : null;
          return `
            <tr class="hover:bg-emerald-50/40">
              <td class="py-3 pr-3">
                <p class="font-extrabold text-slate-900">${escapeHtml(v.negocio_nombre)}</p>
                <p class="text-[11px] text-slate-500">📍 ${escapeHtml(v.direccion)}</p>
              </td>
              <td class="py-3 px-3">
                <span class="inline-block font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md mb-1">
                  ${escapeHtml(v.motivo_estado || 'Interesado')}
                </span>
                <p class="text-slate-700 font-medium">
                  ${v.condiciones_notas ? `"${escapeHtml(v.condiciones_notas)}"` : '<span class="text-slate-400">Sin condición adicional</span>'}
                </p>
              </td>
              <td class="py-3 px-3">
                <p class="font-bold text-slate-800">${escapeHtml(v.contacto_nombre || v.interlocutor)}</p>
                ${wa ? `<a href="${wa}" target="_blank" class="text-emerald-600 font-extrabold underline">📱 ${escapeHtml(v.contacto_telefono)}</a>` : '<span class="text-slate-400">Sin teléfono</span>'}
              </td>
              <td class="py-3 pl-3 text-slate-500">
                <p class="font-semibold text-slate-700">${escapeHtml(v.brigadista_nombre)}</p>
                <p class="text-[10px]">${escapeHtml(v.fecha)} ${escapeHtml(v.hora)}</p>
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

  state.charts.outcomes = new Chart(ctxOutcomes, {
    type: 'doughnut',
    data: {
      labels: ['🔥 Muy Interesados', '🌤️ Solo Info / Ya tiene sistema', '❄️ No interesados'],
      datasets: [{
        data: [hotCount, warmCount, coldCount],
        backgroundColor: ['#10b981', '#f59e0b', '#94a3b8'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
      }
    }
  });

  // Conteo de motivos principales
  const reasonCounts = {};
  visits.forEach(v => {
    const key = v.motivo_estado || 'Otro';
    reasonCounts[key] = (reasonCounts[key] || 0) + 1;
  });
  const topReasons = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  state.charts.reasons = new Chart(ctxReasons, {
    type: 'bar',
    data: {
      labels: topReasons.map(r => r[0].length > 26 ? r[0].substring(0, 26) + '…' : r[0]),
      datasets: [{
        label: 'Negocios',
        data: topReasons.map(r => r[1]),
        backgroundColor: '#2563eb',
        borderRadius: 8
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, ticks: { precision: 0 } },
        y: { ticks: { font: { size: 10 } } }
      }
    }
  });
}

// ============================================================================
// 8. NAVEGACIÓN ENTRE PESTAÑAS
// ============================================================================
window.switchTab = function(tab) {
  const sections = {
    capture: document.getElementById('tabCapture'),
    history: document.getElementById('tabHistory'),
    analytics: document.getElementById('tabAnalytics')
  };
  const buttons = {
    capture: document.getElementById('navBtnCapture'),
    history: document.getElementById('navBtnHistory'),
    analytics: document.getElementById('navBtnAnalytics')
  };

  Object.keys(sections).forEach(k => {
    if (k === tab) {
      sections[k].classList.remove('hidden');
      buttons[k].className = 'py-2 px-3 rounded-2xl font-extrabold text-xs flex flex-col items-center gap-0.5 bg-blue-50 text-blue-600';
    } else {
      sections[k].classList.add('hidden');
      buttons[k].className = 'py-2 px-3 rounded-2xl font-bold text-xs flex flex-col items-center gap-0.5 text-slate-500 hover:bg-slate-50';
    }
  });

  if (tab === 'analytics') {
    renderAnalytics();
  }
};

// ============================================================================
// 9. EXPORTACIÓN A EXCEL (.CSV CON UTF-8 BOM) Y DATOS DE DEMOSTRACIÓN
// ============================================================================
window.exportToExcelCSV = function() {
  if (state.visits.length === 0) {
    showToast('⚠️ No hay registros para exportar aún.');
    return;
  }

  const headers = [
    'Fecha', 'Hora', 'Brigadista', 'Zona', 'Carnet Puesto', 'Llevaba Tarjetas', 'Llevaba Folletos',
    'Negocio', 'Rubro', 'Direccion', 'Hablo Con', 'Material Entregado',
    'Resultado', 'Caso / Motivo', 'Condiciones Especificas / Notas', 'Nombre Contacto', 'Telefono Contacto'
  ];

  const rows = state.visits.map(v => [
    v.fecha,
    v.hora,
    v.brigadista_nombre,
    v.zona || '',
    v.tenia_carnet ? 'SI' : 'NO',
    v.tenia_tarjetas ? 'SI' : 'NO',
    v.tenia_folletos ? 'SI' : 'NO',
    v.negocio_nombre,
    v.negocio_rubro,
    v.direccion,
    v.interlocutor,
    (v.material_entregado || []).join(' + '),
    v.resultado === 'interesado' ? 'MUY INTERESADO' : (v.resultado === 'solo_info' ? 'SOLO INFO / YA TIENE SISTEMA' : 'NO INTERESADO'),
    v.motivo_estado || '',
    v.condiciones_notas || '',
    v.contacto_nombre || '',
    v.contacto_telefono || ''
  ]);

  const csvContent = '\uFEFF' + [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(';'))
    .join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Reporte_Brigada_${getTodayISO()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('📥 Archivo Excel (.CSV) descargado correctamente.');
};

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
      interlocutor: 'Dueño / Decisor',
      material_entregado: ['Folleto', 'Tarjeta', 'Explicación verbal'],
      resultado: 'interesado',
      motivo_estado: 'Interesado si cumple condiciones específicas',
      condiciones_notas: 'Le interesa mucho, pero si incluye control de inventario por bodega y migración de su Excel actual.',
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
      interlocutor: 'Administrador / Encargado',
      material_entregado: ['Folleto', 'Tarjeta'],
      resultado: 'solo_info',
      motivo_estado: 'Ya tiene sistema, no quiere cambiar ahora',
      condiciones_notas: 'Tienen sistema desde hace 1 año. Se dejó folleto y tarjeta en el negocio por si desean comparar precios.',
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
      interlocutor: 'Dueño / Decisor',
      material_entregado: ['Folleto', 'Tarjeta', 'Demo / Muestra'],
      resultado: 'interesado',
      motivo_estado: 'Quiere agendar demostración',
      condiciones_notas: 'Está interesado si funciona rápido en horas pico de almuerzo y permite comandar desde celular.',
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
      interlocutor: 'Empleado / Mostrador',
      material_entregado: ['Folleto', 'Tarjeta'],
      resultado: 'solo_info',
      motivo_estado: 'No estaba el dueño, se dejó información',
      condiciones_notas: 'El dueño llega después de las 4pm. Quedó entregado el folleto en caja.',
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
      interlocutor: 'Dueño / Decisor',
      material_entregado: ['Folleto', 'Tarjeta', 'Explicación verbal'],
      resultado: 'interesado',
      motivo_estado: 'Listo para cotización / propuesta',
      condiciones_notas: 'Necesita 3 usuarios simultáneos y descuento por pago anual.',
      contacto_nombre: 'Diana Carolina',
      contacto_telefono: '3152223344'
    },
    {
      id: 'vis_sim_' + Date.now() + '_2',
      fecha: today,
      hora: '10:35 a. m.',
      brigadista_id: 'usr_3',
      brigadista_nombre: 'Camila Rojas',
      tenia_carnet: false,
      tenia_tarjetas: true,
      tenia_folletos: false,
      zona: 'Sector Norte',
      negocio_nombre: 'Panadería y Pastelería Imperial',
      negocio_rubro: 'Restaurante / Gastronomía',
      direccion: 'Av 19 # 104-12',
      interlocutor: 'Empleado / Mostrador',
      material_entregado: ['Tarjeta'],
      resultado: 'no_interesado',
      motivo_estado: 'Estaban muy ocupados para atender',
      condiciones_notas: 'Solo recibieron tarjeta rápido.',
      contacto_nombre: '',
      contacto_telefono: ''
    },
    {
      id: 'vis_sim_' + Date.now() + '_3',
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
  showToast('✨ Datos de brigada agregados para análisis.');
};

// ============================================================================
// 10. CONEXIÓN CON SUPABASE (NUBE GRATUITA)
// ============================================================================
function initSupabaseIfConfigured() {
  try {
    const cfg = JSON.parse(localStorage.getItem(STORAGE_KEYS.SUPABASE_CFG) || 'null');
    if (cfg && cfg.url && cfg.key && window.supabase) {
      state.supabase = window.supabase.createClient(cfg.url, cfg.key);
      document.getElementById('cloudStatusDot').className = 'w-2 h-2 rounded-full bg-emerald-400';
      document.getElementById('cloudStatusText').textContent = 'Nube Activa';
      fetchCloudVisits();
    }
  } catch (e) {
    console.warn('Error inicializando Supabase:', e);
  }
}

async function fetchCloudVisits() {
  if (!state.supabase) return;
  try {
    const { data, error } = await state.supabase
      .from('acercamientos')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (!error && Array.isArray(data) && data.length > 0) {
      state.visits = data;
      localStorage.setItem(STORAGE_KEYS.VISITS, JSON.stringify(data));
      refreshAllUI();
    }
  } catch (e) {
    console.warn('Error consultando acercamientos en Supabase:', e);
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
  if (!url || !key) {
    showToast('⚠️ Ingresa tanto la URL como el Anon Key de Supabase.');
    return;
  }
  localStorage.setItem(STORAGE_KEYS.SUPABASE_CFG, JSON.stringify({ url, key }));
  initSupabaseIfConfigured();
  closeCloudModal();
  showToast('☁️ Conectado a Supabase correctamente.');
};

window.disconnectSupabase = function() {
  localStorage.removeItem(STORAGE_KEYS.SUPABASE_CFG);
  state.supabase = null;
  document.getElementById('cloudStatusDot').className = 'w-2 h-2 rounded-full bg-amber-400';
  document.getElementById('cloudStatusText').textContent = 'Modo Local';
  closeCloudModal();
  showToast('📱 Usando almacenamiento local.');
};

// ============================================================================
// UTILIDADES
// ============================================================================
function showToast(msg) {
  const toast = document.getElementById('toastNotification');
  const msgEl = document.getElementById('toastMessage');
  msgEl.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 3200);
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
