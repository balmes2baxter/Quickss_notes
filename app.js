// ============================================================================
// BRIGADAPRO v2.0 — GAMIFIED FIELD SALES OS, MAPA, VOZ Y ANALÍTICA
// ============================================================================

const STORAGE_KEYS = {
  USERS: 'brigadapro_users_v2',
  CURRENT_USER: 'brigadapro_current_user_v2',
  PRE_CHECKIN: 'brigadapro_pre_checkin_v2',
  VISITS: 'brigadapro_visits_v2',
  SUPABASE_CFG: 'brigadapro_supabase_cfg_v2'
};

const OUTCOME_PRESETS = {
  interesado: {
    label: '🔥 ¿Cómo estuvo interesado? (1 toque):',
    condLabel: '✍️ Condiciones específicas del cliente o acuerdos clave:',
    placeholder: 'Ej: "Oye muchachos, me interesa pero si tienen estas condiciones..." (Puedes usar el botón de Dictar con voz 🎙️)',
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
  users: [],
  currentUser: null,
  preCheckin: null,
  visits: [],
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
// 1. INICIALIZACIÓN
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
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

    const today = getTodayISO();
    if (savedPre && savedPre.fecha === today && state.currentUser && savedPre.brigadista_id === state.currentUser.id) {
      state.preCheckin = savedPre;
    } else {
      state.preCheckin = null;
    }

    if (savedVisits && Array.isArray(savedVisits) && savedVisits.length > 0) {
      state.visits = savedVisits;
    } else {
      state.visits = generateInitialSampleData();
      localStorage.setItem(STORAGE_KEYS.VISITS, JSON.stringify(state.visits));
    }
  } catch (e) {
    console.error('Error cargando estado:', e);
    state.visits = [];
  }
}

function setupEventListeners() {
  document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const nombre = document.getElementById('loginNameInput').value.trim();
    const rol = document.getElementById('loginRoleInput').value;
    const meta = parseInt(document.getElementById('loginGoalInput').value, 10) || 12;
    if (!nombre) return;

    let existing = state.users.find(u => u.nombre.toLowerCase() === nombre.toLowerCase());
    if (!existing) {
      existing = { id: 'usr_' + Date.now(), nombre, rol, meta };
      state.users.push(existing);
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(state.users));
    } else {
      existing.rol = rol;
      existing.meta = meta;
    }
    loginAsUser(existing);
  });

  document.getElementById('btnSwitchUser').addEventListener('click', () => {
    renderSavedUsersOnLogin();
    document.getElementById('authScreen').classList.remove('hidden');
  });

  document.getElementById('btnOpenCloudModal').addEventListener('click', openCloudModal);
  document.getElementById('negocioNombre').addEventListener('input', checkDuplicateBusiness);
  document.getElementById('negocioDireccion').addEventListener('input', checkDuplicateBusiness);
  document.getElementById('visitForm').addEventListener('submit', handleVisitSubmit);
}

// ============================================================================
// 2. SISTEMA DE GAMIFICACIÓN (XP, NIVELES Y CONFETTI)
// ============================================================================
function calculateUserXP(userName) {
  const userVisits = state.visits.filter(v => v.brigadista_nombre === userName);
  let xp = 0;
  userVisits.forEach(v => {
    xp += 10; // Base por acercamiento
    if ((v.interlocutor || '').includes('Dueño')) xp += 15;
    if (v.resultado === 'interesado') xp += 50;
    else if (v.resultado === 'solo_info') xp += 20;
    if (v.tenia_carnet && v.tenia_tarjetas && v.tenia_folletos) xp += 5;
  });
  return xp;
}

function getRankFromXP(xp) {
  if (xp >= 450) return { title: '👑 Leyenda de Brigada', color: 'text-amber-300' };
  if (xp >= 250) return { title: '🔥 Closer de Calle', color: 'text-emerald-300' };
  if (xp >= 100) return { title: '🎯 Cazador Comercial', color: 'text-indigo-300' };
  return { title: '⚡ Explorador', color: 'text-slate-300' };
}

function fireCelebrationConfetti(isBigGoal = false) {
  if (typeof confetti !== 'function') return;
  if (isBigGoal) {
    confetti({ particleCount: 110, spread: 80, origin: { y: 0.6 } });
    setTimeout(() => confetti({ particleCount: 80, spread: 100, origin: { y: 0.5 } }), 250);
  } else {
    confetti({ particleCount: 55, spread: 60, origin: { y: 0.7 } });
  }
}

// ============================================================================
// 3. LOGIN Y SELECCIÓN DE CUENTA
// ============================================================================
function renderSavedUsersOnLogin() {
  const container = document.getElementById('savedUsersList');
  if (!container) return;

  container.innerHTML = state.users.map(u => {
    const initials = u.nombre.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const todayVisits = state.visits.filter(v => v.fecha === getTodayISO() && v.brigadista_nombre === u.nombre);
    const hotCount = todayVisits.filter(v => v.resultado === 'interesado').length;
    const xp = calculateUserXP(u.nombre);

    return `
      <button
        type="button"
        onclick="selectSavedUser('${u.id}')"
        class="w-full p-3.5 rounded-2xl bg-slate-900/80 border border-slate-700/80 hover:border-indigo-500 hover:bg-indigo-950/30 flex items-center justify-between transition text-left group"
      >
        <div class="flex items-center gap-3.5">
          <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white font-extrabold text-sm flex items-center justify-center shadow">
            ${initials}
          </div>
          <div>
            <p class="font-extrabold text-sm text-white group-hover:text-indigo-300 transition">${escapeHtml(u.nombre)}</p>
            <p class="text-[11px] text-slate-400">${escapeHtml(u.rol)} · ⚡ ${xp} XP</p>
          </div>
        </div>
        <div class="text-right">
          <span class="inline-block text-xs font-extrabold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded-full">
            Hoy: ${todayVisits.length}/${u.meta || 12} (🔥 ${hotCount})
          </span>
        </div>
      </button>
    `;
  }).join('');
}

window.selectSavedUser = function(userId) {
  const user = state.users.find(u => u.id === userId);
  if (user) loginAsUser(user);
};

function loginAsUser(user) {
  state.currentUser = user;
  localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));

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
// 4. CHECK-IN DE SALIDA ANTES DE INICIAR LA BRIGADA
// ============================================================================
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
    label.className = 'text-xs font-bold text-emerald-400 mt-0.5';
  } else {
    card.classList.remove('equipped');
    card.classList.add('not-equipped');
    label.textContent = cfg.no;
    label.className = 'text-xs font-bold text-rose-400 mt-0.5';
  }

  updateReadinessScore();
};

function updateReadinessScore() {
  const c = document.getElementById('chkCarnet').checked ? 1 : 0;
  const t = document.getElementById('chkTarjetas').checked ? 1 : 0;
  const f = document.getElementById('chkFolletos').checked ? 1 : 0;
  const pct = Math.round(((c + t + f) / 3) * 100);
  const el = document.getElementById('readinessScoreText');
  if (el) {
    el.textContent = `${pct}% Equipado`;
    el.className = pct === 100
      ? 'text-2xl font-extrabold text-emerald-400'
      : (pct >= 66 ? 'text-2xl font-extrabold text-amber-400' : 'text-2xl font-extrabold text-rose-400');
  }
}

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
  showToast('🚀 ¡Misión iniciada! Modo Ráfaga activado para anotar en segundos.');
  setTimeout(() => document.getElementById('negocioNombre')?.focus(), 150);
};

window.reopenPreBrigada = function() {
  document.getElementById('preBrigadaCard').classList.remove('hidden');
  document.getElementById('brigadaWorkspaceGrid').classList.add('hidden');
};

// ============================================================================
// 5. CAPTURA RÁPIDA + DICTADO POR VOZ + GPS
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
        class="chip-btn ${isSelected ? 'active-blue' : ''} px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-800/90 text-xs font-bold text-slate-200 text-left"
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

// Dictado por Voz en Vivo (Web Speech API)
window.toggleVoiceDictation = function() {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) {
    showToast('⚠️ Usa Chrome, Edge o Safari para dictado por voz directo.');
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
    btnText.textContent = 'Escuchando... (Habla ahora)';
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    textarea.value = textarea.value ? `${textarea.value.trim()} ${transcript}` : transcript;
    showToast('🎙️ Nota transcrita por voz');
  };

  recognition.onerror = () => {
    showToast('⚠️ No se pudo escuchar el micrófono.');
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
      showToast('⚠️ Activa la ubicación del navegador o escribe la dirección.');
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

  // Coordenadas simuladas cercanas en caso de no haber pulsado GPS para que siempre se vea en el mapa de la brigada
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
// 6. ACTUALIZACIÓN INTEGRAL DE UI, ANILLO DE PROGRESO Y TARJETA WHATSAPP
// ============================================================================
function refreshAllUI() {
  if (!state.currentUser) return;

  const initials = state.currentUser.nombre.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  document.getElementById('userAvatarBadge').textContent = initials;
  document.getElementById('headerUserName').textContent = state.currentUser.nombre;
  document.getElementById('headerUserRole').textContent = state.currentUser.rol;

  const xp = calculateUserXP(state.currentUser.nombre);
  const rank = getRankFromXP(xp);
  const xpBadge = document.getElementById('headerXpBadge');
  xpBadge.textContent = `${rank.title} · ${xp} XP`;

  const todayFormatted = new Date().toLocaleDateString('es-CO', {
    weekday: 'short', day: 'numeric', month: 'short'
  });
  const zonaText = state.preCheckin?.zona ? ` · 📍 ${state.preCheckin.zona}` : '';
  document.getElementById('headerDateZone').textContent = `${todayFormatted}${zonaText}`;

  // Progreso de Meta de 12 acercamientos
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

  // Anillo Radial SVG
  const circumference = 263.89;
  const offset = circumference - (pct / 100) * circumference;
  const radialCircle = document.getElementById('radialGoalCircle');
  if (radialCircle) radialCircle.style.strokeDashoffset = offset;
  const radialText = document.getElementById('radialPctText');
  if (radialText) radialText.textContent = `${pct}%`;

  const missionPill = document.getElementById('missionStatusPill');
  const missionHelper = document.getElementById('missionHelperText');
  if (missionPill && missionHelper) {
    const remaining = Math.max(0, goal - myToday.length);
    if (remaining === 0) {
      missionPill.textContent = '🏆 Objetivo de Brigada Logrado';
      missionPill.className = 'text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
      missionHelper.innerHTML = `¡Superaste la meta de <b>${goal} visitas</b> hoy con <b>${myHotToday} clientes muy interesados</b>!`;
    } else {
      missionPill.textContent = `Faltan ${remaining} visitas para tu meta`;
      missionHelper.innerHTML = `Llevas <b>${myToday.length} de ${goal}</b> acercamientos hoy y <b>🔥 ${myHotToday} muy interesados</b>.`;
    }
  }

  document.getElementById('navHistoryCount').textContent = state.visits.length;
  const deskCount = document.getElementById('deskHistoryCount');
  if (deskCount) deskCount.textContent = state.visits.length;

  // Mostrar Check-in o Consola Dividida
  if (state.preCheckin && state.preCheckin.completed) {
    document.getElementById('preBrigadaCard').classList.add('hidden');
    document.getElementById('brigadaWorkspaceGrid').classList.remove('hidden');

    setBadgeStatus('badgeCarnet', '🪪 Carnet', state.preCheckin.tiene_carnet);
    setBadgeStatus('badgeTarjetas', '📇 Tarjetas', state.preCheckin.tiene_tarjetas);
    setBadgeStatus('badgeFolletos', '📄 Folletos', state.preCheckin.tiene_folletos);
    document.getElementById('badgeZona').textContent = `📍 ${state.preCheckin.zona}`;
  } else {
    document.getElementById('preBrigadaCard').classList.remove('hidden');
    document.getElementById('brigadaWorkspaceGrid').classList.add('hidden');
  }

  if (!document.getElementById('outcomeQuickChips').innerHTML.trim()) {
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
    ? 'px-2.5 py-1 rounded-full font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
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
      <span class="text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full">
        💬 Seguimiento Instantáneo Listo
      </span>
      <button onclick="document.getElementById('lastSavedHighlightBox').classList.add('hidden')" class="text-xs text-slate-400 hover:text-white">✕</button>
    </div>
    <p class="text-xs font-bold text-white">
      Envíale un WhatsApp ahora mismo a <span class="text-emerald-400">${escapeHtml(v.negocio_nombre)}</span> con sus condiciones pre-cargadas:
    </p>
    <a
      href="${waUrl}"
      target="_blank"
      class="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg transition"
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
  if (recent.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-500 py-4 text-center">Aún no hay visitas registradas hoy.</p>`;
    return;
  }

  container.innerHTML = recent.map(v => {
    const badge = getOutcomeBadgeHTML(v.resultado);
    return `
      <div class="p-3.5 rounded-2xl bg-slate-900/75 border border-white/10 hover:border-indigo-500/40 transition space-y-1">
        <div class="flex items-center justify-between gap-2">
          <p class="font-extrabold text-xs text-white truncate">${escapeHtml(v.negocio_nombre)}</p>
          ${badge}
        </div>
        <p class="text-[11px] text-slate-400 truncate">
          📍 ${escapeHtml(v.direccion)} · <span class="text-slate-300">${escapeHtml(v.motivo_estado || '')}</span>
        </p>
        ${v.condiciones_notas ? `
          <p class="text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg truncate">
            💬 "${escapeHtml(v.condiciones_notas)}"
          </p>
        ` : ''}
        <div class="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
          <span>👤 ${escapeHtml(v.brigadista_nombre)}</span>
          <span>${escapeHtml(v.hora)}</span>
        </div>
      </div>
    `;
  }).join('');
}

// ============================================================================
// 7. MAPA INTERACTIVO (LEAFLET) Y DIRECTORIO DE NEGOCIOS
// ============================================================================
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

    const color = v.resultado === 'interesado' ? '#10b981' : (v.resultado === 'solo_info' ? '#f59e0b' : '#64748b');
    const marker = L.circleMarker([lat, lng], {
      radius: 9,
      fillColor: color,
      color: '#ffffff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.9
    });

    const popupHtml = `
      <div style="font-family: sans-serif; min-width: 190px; color: #0f172a;">
        <b style="font-size: 13px;">${escapeHtml(v.negocio_nombre)}</b><br/>
        <span style="font-size: 11px; color: #475569;">📍 ${escapeHtml(v.direccion)}</span><br/>
        <span style="font-size: 11px; font-weight: bold; color: ${color};">● ${escapeHtml(v.motivo_estado || v.resultado)}</span>
        ${v.condiciones_notas ? `<p style="font-size: 11px; background:#f1f5f9; padding:4px 6px; border-radius:6px; margin-top:4px;">"${escapeHtml(v.condiciones_notas)}"</p>` : ''}
        <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Por: ${escapeHtml(v.brigadista_nombre)} (${escapeHtml(v.hora)})</div>
      </div>
    `;
    marker.bindPopup(popupHtml);
    state.mapMarkersLayer.addLayer(marker);
  });

  setTimeout(() => {
    state.map.invalidateSize();
    if (bounds.length > 0) {
      state.map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
    }
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

  if (!document.getElementById('tabHistory').classList.contains('hidden')) {
    renderBrigadaMap(filtered);
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="col-span-2 glass-card rounded-3xl p-8 text-center">
        <p class="text-sm font-bold text-slate-400">No se encontraron negocios con ese filtro</p>
      </div>
    `;
    return;
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
      <div class="glass-card rounded-3xl p-5 flex flex-col justify-between gap-3 border border-white/10 hover:border-indigo-500/40 transition">
        <div class="space-y-2">
          <div class="flex items-start justify-between gap-2">
            <div>
              <h4 class="font-extrabold text-base text-white">${escapeHtml(v.negocio_nombre)}</h4>
              <p class="text-xs text-indigo-300 font-semibold">📍 ${escapeHtml(v.direccion)}</p>
            </div>
            ${badge}
          </div>

          <div class="flex flex-wrap gap-1.5 text-[11px]">
            <span class="px-2.5 py-0.5 rounded-lg bg-slate-800 text-slate-300 font-semibold">${escapeHtml(v.negocio_rubro)}</span>
            <span class="px-2.5 py-0.5 rounded-lg bg-slate-800 text-slate-300 font-semibold">🗣️ ${escapeHtml(v.interlocutor)}</span>
            <span class="px-2.5 py-0.5 rounded-lg bg-slate-800 text-slate-300 font-semibold">📦 ${escapeHtml(materials)}</span>
          </div>

          <p class="text-xs text-slate-200 font-semibold">
            📌 Caso: <span class="text-white">${escapeHtml(v.motivo_estado || 'Registrado')}</span>
          </p>

          ${v.condiciones_notas ? `
            <div class="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3 text-xs text-emerald-200 font-medium">
              📝 <b>Condición / Nota:</b> "${escapeHtml(v.condiciones_notas)}"
            </div>
          ` : ''}
        </div>

        <div class="flex items-center justify-between pt-3 border-t border-white/10 text-[11px] text-slate-400">
          <div>
            <span>👤 <b class="text-slate-200">${escapeHtml(v.brigadista_nombre)}</b></span>
            <span class="mx-1">·</span>
            <span>${escapeHtml(v.fecha)} ${escapeHtml(v.hora)}</span>
          </div>
          <div class="flex items-center gap-2">
            ${waLink ? `
              <a href="${waLink}" target="_blank" class="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs">
                💬 WhatsApp
              </a>
            ` : ''}
            <button onclick="deleteVisit('${v.id}')" class="text-slate-500 hover:text-rose-400 font-bold px-2 py-1">
              ✕
            </button>
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
  showToast('🗑️ Registro eliminado');
};

function getOutcomeBadgeHTML(resultado) {
  if (resultado === 'interesado') {
    return `<span class="text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0">🔥 Muy Interesado</span>`;
  }
  if (resultado === 'solo_info') {
    return `<span class="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">🌤️ Info / Ya tiene</span>`;
  }
  return `<span class="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700 shrink-0">❄️ No interesado</span>`;
}

// ============================================================================
// 8. PODIO DE BRIGADA Y MEDALLAS (LEADERBOARD)
// ============================================================================
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

  const rows = Object.entries(grouped).sort((a, b) => {
    const xpA = calculateUserXP(a[0]);
    const xpB = calculateUserXP(b[0]);
    return xpB - xpA;
  });

  rankContainer.innerHTML = rows.map(([nombre, stats], idx) => {
    const goal = 12;
    const pct = Math.min(100, Math.round((stats.total / goal) * 100));
    const xp = calculateUserXP(nombre);
    const rank = getRankFromXP(xp);
    const medal = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : '👟'));

    return `
      <div class="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-2.5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-3">
            <span class="text-2xl">${medal}</span>
            <div>
              <div class="flex items-center gap-2">
                <span class="font-extrabold text-base text-white">${escapeHtml(nombre)}</span>
                <span class="text-xs font-extrabold ${rank.color}">${rank.title}</span>
              </div>
              <p class="text-[11px] text-slate-400">⚡ ${xp} XP acumulados · 👑 ${stats.ownerCount} dueños contactados</p>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2 text-xs">
            <span class="font-extrabold text-white bg-slate-800 px-3 py-1 rounded-full">${stats.total} / ${goal} visitas</span>
            <span class="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-extrabold">🔥 ${stats.hot} interesados</span>
            <span class="px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold">🌤️ ${stats.info} solo info</span>
          </div>
        </div>

        <div class="w-full h-3 bg-slate-950 rounded-full overflow-hidden p-0.5">
          <div class="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all duration-500" style="width: ${pct}%"></div>
        </div>
      </div>
    `;
  }).join('');

  // Medallas del Equipo
  const totalHot = state.visits.filter(v => v.resultado === 'interesado').length;
  const totalOwners = state.visits.filter(v => (v.interlocutor || '').includes('Dueño')).length;
  const totalKit = state.visits.filter(v => v.tenia_carnet && v.tenia_tarjetas && v.tenia_folletos).length;
  const any12 = rows.some(([, s]) => s.total >= 12);

  const badges = [
    {
      icon: '🪪',
      title: 'Embajador con Kit Completo',
      desc: `${totalKit} acercamientos realizados con Carnet + Tarjeta + Folleto.`,
      unlocked: totalKit > 0
    },
    {
      icon: '👑',
      title: 'Francotirador de Decisores',
      desc: `${totalOwners} conversaciones directas con el Dueño del negocio.`,
      unlocked: totalOwners >= 2
    },
    {
      icon: '🔥',
      title: 'Imán de Prospectos Calientes',
      desc: `${totalHot} clientes declararon estar muy interesados.`,
      unlocked: totalHot >= 2
    },
    {
      icon: '🏆',
      title: 'Meta 12/12 Completada',
      desc: 'Alcanzar los 12 acercamientos diarios de la brigada.',
      unlocked: any12
    }
  ];

  badgesContainer.innerHTML = badges.map(b => `
    <div class="p-4 rounded-2xl border ${b.unlocked ? 'bg-indigo-950/30 border-indigo-500/40' : 'bg-slate-900/40 border-white/5 opacity-50'} space-y-1.5">
      <div class="flex items-center justify-between">
        <span class="text-3xl">${b.icon}</span>
        <span class="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${b.unlocked ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'}">
          ${b.unlocked ? 'Desbloqueada' : 'En curso'}
        </span>
      </div>
      <p class="font-extrabold text-sm text-white">${b.title}</p>
      <p class="text-xs text-slate-400 leading-relaxed">${b.desc}</p>
    </div>
  `).join('');
}

// ============================================================================
// 9. INTELIGENCIA COMERCIAL Y ANALÍTICA DE DATOS
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

  document.getElementById('kpiTotalVisits').textContent = total;
  document.getElementById('kpiHotLeads').textContent = hot.length;
  document.getElementById('kpiConversionRate').textContent = `${convRate}% tasa de interés positivo`;
  document.getElementById('kpiWarmInfo').textContent = warm.length;
  document.getElementById('kpiAlreadyHasSystem').textContent = `${alreadyHasSystemCount} dijeron "Ya tengo sistema"`;
  document.getElementById('kpiCarnetRate').textContent = `${carnetRate}%`;
  document.getElementById('kpiDecisionMakerRate').textContent = `${ownerRate}% hablaron con el dueño`;

  renderSmartInsights(visits, hot, alreadyHasSystemCount);
  renderHotLeadsTable(hot);

  if (!document.getElementById('tabAnalytics').classList.contains('hidden')) {
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
    <div class="p-4 rounded-2xl bg-slate-900/90 border border-indigo-500/30 space-y-1">
      <p class="text-indigo-400 font-extrabold uppercase text-[10px] tracking-wider">1. Multiplicador por Hablar con el Dueño</p>
      <p class="text-slate-200 leading-relaxed">
        Abordar directamente al <b>Dueño/Decisor</b> convierte al <b class="text-emerald-400">${ownerConv}%</b>, mientras que dejar recado con empleados convierte al <b>${nonOwnerConv}%</b>.
      </p>
    </div>

    <div class="p-4 rounded-2xl bg-slate-900/90 border border-emerald-500/30 space-y-1">
      <p class="text-emerald-400 font-extrabold uppercase text-[10px] tracking-wider">2. Impacto del Check-in (Carnet + Kit)</p>
      <p class="text-slate-200 leading-relaxed">
        Los brigadistas que salieron con <b>Carnet + Tarjetas + Folletos</b> lograron un <b class="text-emerald-400">${fullKitConv}%</b> de clientes interesados en ${fullKitVisits.length} locales.
      </p>
    </div>

    <div class="p-4 rounded-2xl bg-slate-900/90 border border-amber-500/30 space-y-1">
      <p class="text-amber-400 font-extrabold uppercase text-[10px] tracking-wider">3. Condiciones Específicas vs Competencia</p>
      <p class="text-slate-200 leading-relaxed">
        Tenemos <b class="text-emerald-400">${withConditions.length} negocios</b> listos si cumplimos sus condiciones, y <b>${alreadyHasSystemCount}</b> que ya tienen sistema pero quedaron mapeados con dirección e info.
      </p>
    </div>
  `;
}

function renderHotLeadsTable(hotLeads) {
  const container = document.getElementById('hotLeadsTableContainer');
  if (!container) return;

  if (hotLeads.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-400 py-6 text-center">Aún no hay prospectos marcados como Muy Interesados.</p>`;
    return;
  }

  container.innerHTML = `
    <table class="w-full text-left border-collapse text-xs">
      <thead>
        <tr class="border-b border-white/10 text-slate-400 uppercase text-[10px]">
          <th class="py-3 pr-3">Negocio y Dirección</th>
          <th class="py-3 px-3">Condiciones Específicas Solicitadas</th>
          <th class="py-3 px-3">Contacto Directo</th>
          <th class="py-3 pl-3">Brigadista</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-white/5">
        ${hotLeads.map(v => {
          const wa = v.contacto_telefono
            ? `https://wa.me/${v.contacto_telefono.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${v.contacto_nombre || ''}, te saludo respecto a nuestra visita hoy a ${v.negocio_nombre}.`)}`
            : null;
          return `
            <tr class="hover:bg-white/5 transition">
              <td class="py-3.5 pr-3">
                <p class="font-extrabold text-white text-sm">${escapeHtml(v.negocio_nombre)}</p>
                <p class="text-[11px] text-indigo-300">📍 ${escapeHtml(v.direccion)}</p>
              </td>
              <td class="py-3.5 px-3">
                <span class="inline-block font-bold text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-0.5 rounded-lg mb-1">
                  ${escapeHtml(v.motivo_estado || 'Interesado')}
                </span>
                <p class="text-slate-200 font-medium">
                  ${v.condiciones_notas ? `"${escapeHtml(v.condiciones_notas)}"` : '<span class="text-slate-500">Sin condición adicional</span>'}
                </p>
              </td>
              <td class="py-3.5 px-3">
                <p class="font-bold text-white">${escapeHtml(v.contacto_nombre || v.interlocutor)}</p>
                ${wa ? `<a href="${wa}" target="_blank" class="inline-block mt-1 px-2.5 py-1 rounded-lg bg-emerald-500 text-slate-950 font-extrabold">💬 ${escapeHtml(v.contacto_telefono)}</a>` : '<span class="text-slate-500">Sin teléfono</span>'}
              </td>
              <td class="py-3.5 pl-3 text-slate-400">
                <p class="font-bold text-slate-200">${escapeHtml(v.brigadista_nombre)}</p>
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

  Chart.defaults.color = '#cbd5e1';

  state.charts.outcomes = new Chart(ctxOutcomes, {
    type: 'doughnut',
    data: {
      labels: ['🔥 Muy Interesados', '🌤️ Solo Info / Ya tiene sistema', '❄️ No interesados'],
      datasets: [{
        data: [hotCount, warmCount, coldCount],
        backgroundColor: ['#10b981', '#f59e0b', '#475569'],
        borderColor: '#0f172a',
        borderWidth: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 14, color: '#e2e8f0', font: { size: 11, weight: 'bold' } } }
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
        backgroundColor: '#6366f1',
        borderRadius: 8
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, ticks: { precision: 0, color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: '#e2e8f0', font: { size: 11 } }, grid: { display: false } }
      }
    }
  });
}

// ============================================================================
// 10. NAVEGACIÓN ENTRE VISTAS
// ============================================================================
window.switchTab = function(tab) {
  const sections = {
    capture: document.getElementById('tabCapture'),
    history: document.getElementById('tabHistory'),
    leaderboard: document.getElementById('tabLeaderboard'),
    analytics: document.getElementById('tabAnalytics')
  };
  const mobBtns = {
    capture: document.getElementById('navBtnCapture'),
    history: document.getElementById('navBtnHistory'),
    leaderboard: document.getElementById('navBtnLeaderboard'),
    analytics: document.getElementById('navBtnAnalytics')
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
      if (mobBtns[k]) mobBtns[k].className = 'py-2 px-2 rounded-2xl font-extrabold text-[11px] flex flex-col items-center gap-0.5 bg-indigo-600/25 text-indigo-300 border border-indigo-500/30';
      if (deskBtns[k]) deskBtns[k].className = 'px-4 py-2 rounded-xl text-xs font-extrabold bg-indigo-600 text-white shadow';
    } else {
      sections[k]?.classList.add('hidden');
      if (mobBtns[k]) mobBtns[k].className = 'py-2 px-2 rounded-2xl font-bold text-[11px] flex flex-col items-center gap-0.5 text-slate-400';
      if (deskBtns[k]) deskBtns[k].className = 'px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white';
    }
  });

  if (tab === 'history') renderHistoryList();
  if (tab === 'leaderboard') renderLeaderboardAndBadges();
  if (tab === 'analytics') renderAnalytics();
};

// ============================================================================
// 11. EXPORTACIÓN A EXCEL (.CSV) Y DATOS DEMO
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
  showToast('📥 Base de datos descargada en formato Excel (.CSV)');
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
      gps_lat: 4.6895,
      gps_lng: -74.0480,
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
  showToast('✨ Nuevas visitas simuladas cargadas en el mapa y análisis.');
};

// ============================================================================
// 12. CONEXIÓN CON SUPABASE (NUBE GRATUITA)
// ============================================================================
function initSupabaseIfConfigured() {
  try {
    const cfg = JSON.parse(localStorage.getItem(STORAGE_KEYS.SUPABASE_CFG) || 'null');
    if (cfg && cfg.url && cfg.key && window.supabase) {
      state.supabase = window.supabase.createClient(cfg.url, cfg.key);
      document.getElementById('cloudStatusDot').className = 'w-2.5 h-2.5 rounded-full bg-emerald-400';
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
    console.warn('Error consultando Supabase:', e);
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
    showToast('⚠️ Ingresa la URL y el Anon Key de Supabase.');
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
  document.getElementById('cloudStatusDot').className = 'w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse';
  document.getElementById('cloudStatusText').textContent = 'Modo Local';
  closeCloudModal();
  showToast('📱 Usando almacenamiento local.');
};

function showToast(msg) {
  const toast = document.getElementById('toastNotification');
  const msgEl = document.getElementById('toastMessage');
  msgEl.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 3500);
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
