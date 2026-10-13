/**
 * PRODE CON AMIGOS - Motor Principal
 * Diseñado especialmente para Octa y sus 3 amigos.
 * Sistema de roles:
 * - Octa: Usuario con contraseña (octa123). Modifica apellidos, sus apuestas y resultados finales.
 * - Amigos: Ingresan solo con su nombre (sin contraseña). Cargan solo sus apuestas.
 * - Estadísticas avanzadas: Muestra quién se acercó más en general y por apellido.
 */

// --- CONFIGURACIÓN & ESTADO POR DEFECTO ---
const DEFAULT_APELLIDOS = ["Pérez", "González", "Rodríguez", "Fernández"];
const DEFAULT_OCTA_PASS = "octa123";

let state = {
  title: "Prode con Amigos",
  apellidos: [...DEFAULT_APELLIDOS],
  bets: {},          // { [playerName]: { [apellido]: number } }
  finalResults: {},  // { [apellido]: number }
  hasFinalResults: false,
  adminPassword: DEFAULT_OCTA_PASS,
  firebaseUrl: ""    // URL opcional de Firebase Realtime Database
};

// Usuario actualmente conectado en este navegador
let currentUser = {
  name: "",
  isAdmin: false
};

// Borrador de apuestas del usuario actual
let currentBetDraft = {};

// Claves de almacenamiento local
const STORAGE_KEY = "prode_octa_state_v2";
const AUTH_KEY = "prode_octa_auth_user";

// --- PERSISTENCIA LOCALSTORAGE ---
function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      state = { ...state, ...parsed };
      if (state.finalResults && Object.keys(state.finalResults).length > 0) {
        state.hasFinalResults = true;
      }
    }
  } catch (e) {
    console.error("Error al leer state:", e);
  }

  try {
    const authSaved = localStorage.getItem(AUTH_KEY);
    if (authSaved) {
      currentUser = JSON.parse(authSaved);
    }
  } catch (e) {
    console.error("Error al leer auth:", e);
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Error al guardar state:", e);
  }

  // Si hay Firebase configurado, sincronizar
  if (state.firebaseUrl) {
    pushToFirebase();
  }
}

function saveAuth(user) {
  currentUser = user;
  try {
    localStorage.setItem(AUTH_KEY, JSON.stringify(user));
  } catch (e) {}
}

// --- SINCRONIZACIÓN FIREBASE (OPCIONAL EN TIEMPO REAL) ---
async function pushToFirebase() {
  if (!state.firebaseUrl) return;
  try {
    const url = state.firebaseUrl.replace(/\/+$/, "") + "/prode.json";
    await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apellidos: state.apellidos,
        bets: state.bets,
        finalResults: state.finalResults,
        hasFinalResults: state.hasFinalResults
      })
    });
  } catch (e) {
    console.warn("Fallo al sincronizar con Firebase:", e);
  }
}

async function fetchFromFirebase() {
  if (!state.firebaseUrl) return;
  try {
    const url = state.firebaseUrl.replace(/\/+$/, "") + "/prode.json";
    const res = await fetch(url);
    if (res.ok) {
      const cloudData = await res.json();
      if (cloudData) {
        if (cloudData.apellidos) state.apellidos = cloudData.apellidos;
        if (cloudData.bets) state.bets = { ...state.bets, ...cloudData.bets };
        if (cloudData.finalResults) {
          state.finalResults = cloudData.finalResults;
          state.hasFinalResults = Object.keys(cloudData.finalResults).length > 0;
        }
        renderApp();
      }
    }
  } catch (e) {
    console.warn("Error leyendo de Firebase:", e);
  }
}

// --- UTILIDADES BASE64 / COMPARTIR ---
function encodeData(data) {
  try {
    return encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(data)))));
  } catch (e) {
    return "";
  }
}

function decodeData(encoded) {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(encoded)))));
  } catch (e) {
    return null;
  }
}

// --- NOTIFICACIONES TOAST ---
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast ${type === "success" ? "toast-success" : type === "error" ? "toast-error" : ""}`;
  const icon = type === "success" ? "✅" : type === "error" ? "⚠️" : "ℹ️";
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// --- INICIALIZACIÓN ---
document.addEventListener("DOMContentLoaded", () => {
  loadState();
  checkUrlParams();
  setupEventListeners();

  // Si no está identificado, abrir modal de login
  if (!currentUser.name) {
    openLoginModal();
  } else {
    updateUserInterfaceForRole();
    renderApp();
  }

  // Si hay Firebase configurado, intentar sincronizar cada 15 segundos
  if (state.firebaseUrl) {
    fetchFromFirebase();
    setInterval(fetchFromFirebase, 15000);
    const cloudBanner = document.getElementById("cloudSyncAlert");
    if (cloudBanner) cloudBanner.classList.remove("hidden");
  }
});

// --- PARÁMETROS URL (#bet=... o #prode=...) ---
function checkUrlParams() {
  const hash = window.location.hash;
  const search = window.location.search;

  // 1. Apuesta de amigo importada por URL
  let betParam = null;
  if (hash.startsWith("#bet=")) betParam = hash.replace("#bet=", "");
  else {
    const sp = new URLSearchParams(search);
    if (sp.has("bet")) betParam = sp.get("bet");
  }

  if (betParam) {
    const data = decodeData(betParam);
    if (data && data.player && data.picks) {
      state.bets[data.player] = data.picks;
      Object.keys(data.picks).forEach(a => {
        if (!state.apellidos.includes(a)) state.apellidos.push(a);
      });
      saveState();
      showToast(`¡Apuesta de ${data.player} importada con éxito!`, "success");
      window.history.replaceState(null, "", window.location.pathname);
      return;
    }
  }

  // 2. Configuración de Apellidos de Octa
  let prodeParam = null;
  if (hash.startsWith("#prode=")) prodeParam = hash.replace("#prode=", "");
  else {
    const sp = new URLSearchParams(search);
    if (sp.has("prode")) prodeParam = sp.get("prode");
  }

  if (prodeParam) {
    const data = decodeData(prodeParam);
    if (data && data.apellidos) {
      state.apellidos = data.apellidos;
      if (data.firebaseUrl) state.firebaseUrl = data.firebaseUrl;
      saveState();
      showToast("¡Lista de apellidos actualizada!", "success");
      window.history.replaceState(null, "", window.location.pathname);
    }
  }
}

// --- LISTENERS DE EVENTOS ---
function setupEventListeners() {
  // Navegación de pestañas
  document.getElementById("navBtnBets").addEventListener("click", () => switchView("bets"));
  document.getElementById("navBtnTable").addEventListener("click", () => switchView("table"));
  document.getElementById("navBtnAdmin").addEventListener("click", () => switchView("admin"));

  // Cambio de usuario
  document.getElementById("btnSwitchUser").addEventListener("click", openLoginModal);

  // Tabs del Modal de Login
  document.getElementById("tabFriendLogin").addEventListener("click", () => switchLoginTab("friend"));
  document.getElementById("tabOctaLogin").addEventListener("click", () => switchLoginTab("octa"));

  // Enviar Login Amigo
  document.getElementById("btnSubmitFriendLogin").addEventListener("click", submitFriendLogin);
  document.getElementById("inputFriendName").addEventListener("keypress", (e) => {
    if (e.key === "Enter") submitFriendLogin();
  });

  // Enviar Login Octa
  document.getElementById("btnSubmitOctaLogin").addEventListener("click", submitOctaLogin);
  document.getElementById("inputOctaPassword").addEventListener("keypress", (e) => {
    if (e.key === "Enter") submitOctaLogin();
  });

  // Apuestas: Guardar y Enviar por WhatsApp
  document.getElementById("btnSaveMyBet").addEventListener("click", saveMyBet);
  document.getElementById("btnShareWhatsAppBet").addEventListener("click", shareMyBetWhatsApp);

  // Admin: Agregar Apellido
  document.getElementById("btnAdminAddApellido").addEventListener("click", adminAddApellido);
  document.getElementById("adminNewApellidoInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") adminAddApellido();
  });
  document.getElementById("btnLoadExampleApellidos").addEventListener("click", () => {
    state.apellidos = ["Pérez", "González", "Rodríguez", "Fernández", "López"];
    saveState();
    renderApp();
    showToast("Ejemplos de apellidos cargados", "success");
  });

  // Admin: Guardar Resultados Finales
  document.getElementById("btnAdminSaveFinalResults").addEventListener("click", adminSaveFinalResults);
  document.getElementById("btnAdminClearResults").addEventListener("click", adminClearFinalResults);

  // Admin: Procesar Apuesta pegada de Amigo
  document.getElementById("btnAdminProcessImportBet").addEventListener("click", adminProcessImportBet);

  // Admin: Modal Carga Manual de Amigo
  document.getElementById("btnAdminOpenManualBetModal").addEventListener("click", openManualBetModal);
  document.getElementById("btnCloseManualModal").addEventListener("click", closeManualBetModal);
  document.getElementById("btnCancelManualBet").addEventListener("click", closeManualBetModal);
  document.getElementById("btnSaveManualFriendBet").addEventListener("click", saveManualFriendBet);

  // Admin: Cambiar contraseña
  document.getElementById("btnAdminChangePassword").addEventListener("click", adminChangePassword);

  // Admin: Firebase URL
  document.getElementById("btnSaveFirebaseUrl").addEventListener("click", adminSaveFirebaseUrl);

  // Admin: Exportar / Reiniciar
  document.getElementById("btnAdminExportJson").addEventListener("click", adminExportJson);
  document.getElementById("btnAdminResetProde").addEventListener("click", adminResetProde);

  // Compartir URL general
  document.getElementById("btnCopyShareUrl").addEventListener("click", copyShareUrl);
  document.getElementById("btnWhatsAppShareUrl").addEventListener("click", shareInviteWhatsApp);

  // Botón desde Empty State de Apellidos
  const emptyBtn = document.getElementById("btnOpenOctaLoginFromEmpty");
  if (emptyBtn) {
    emptyBtn.addEventListener("click", () => {
      openLoginModal();
      switchLoginTab("octa");
    });
  }
}

// --- SISTEMA DE LOGIN Y CONTROL DE ROLES ---
function openLoginModal() {
  document.getElementById("loginModal").classList.remove("hidden");
  // Si ya hay usuario, permitir cerrar el modal
  const closeBtn = document.getElementById("btnCloseLoginModal");
  if (currentUser.name) {
    closeBtn.style.display = "block";
    closeBtn.onclick = () => document.getElementById("loginModal").classList.add("hidden");
  } else {
    closeBtn.style.display = "none";
  }

  // Preseleccionar tab según si era Octa
  if (currentUser.isAdmin) {
    switchLoginTab("octa");
  } else {
    switchLoginTab("friend");
  }
}

function switchLoginTab(tab) {
  const friendTab = document.getElementById("tabFriendLogin");
  const octaTab = document.getElementById("tabOctaLogin");
  const friendForm = document.getElementById("friendLoginForm");
  const octaForm = document.getElementById("octaLoginForm");

  if (tab === "friend") {
    friendTab.classList.add("active");
    octaTab.classList.remove("active");
    friendForm.classList.remove("hidden");
    octaForm.classList.add("hidden");
    document.getElementById("inputFriendName").focus();
  } else {
    octaTab.classList.add("active");
    friendTab.classList.remove("active");
    octaForm.classList.remove("hidden");
    friendForm.classList.add("hidden");
    document.getElementById("inputOctaPassword").focus();
  }
}

function submitFriendLogin() {
  const nameInput = document.getElementById("inputFriendName");
  const name = nameInput.value.trim();

  if (!name) {
    showToast("Por favor escribí tu nombre para ingresar", "error");
    nameInput.focus();
    return;
  }

  // Si pone "Octa" sin contraseña, avisarle que Octa requiere contraseña
  if (name.toLowerCase() === "octa") {
    showToast("Para ingresar como Octa debés ir a la pestaña 'Soy Octa' y poner tu contraseña", "error");
    switchLoginTab("octa");
    return;
  }

  saveAuth({ name, isAdmin: false });
  document.getElementById("loginModal").classList.add("hidden");
  showToast(`¡Bienvenido ${name}! Ya podés cargar tus apuestas`, "success");
  updateUserInterfaceForRole();
  renderApp();
  switchView("bets");
}

function submitOctaLogin() {
  const passInput = document.getElementById("inputOctaPassword");
  const pass = passInput.value.trim();

  const correctPass = state.adminPassword || DEFAULT_OCTA_PASS;

  if (pass !== correctPass) {
    showToast("Contraseña incorrecta. Probá con 'octa123'", "error");
    passInput.focus();
    return;
  }

  saveAuth({ name: "Octa", isAdmin: true });
  document.getElementById("loginModal").classList.add("hidden");
  passInput.value = "";
  showToast("¡Hola Octa! Sesión de administrador iniciada", "success");
  updateUserInterfaceForRole();
  renderApp();
  switchView("admin");
}

function updateUserInterfaceForRole() {
  const nameDisplay = document.getElementById("currentUserNameDisplay");
  const adminTag = document.getElementById("adminTagDisplay");
  const adminNavBtn = document.getElementById("navBtnAdmin");
  const avatarIcon = document.getElementById("userAvatarIcon");
  const greeting = document.getElementById("userGreetingText");

  nameDisplay.textContent = currentUser.name || "Invitado";

  if (currentUser.isAdmin) {
    adminTag.classList.remove("hidden");
    adminNavBtn.classList.remove("hidden");
    avatarIcon.textContent = "👑";
    if (greeting) {
      greeting.innerHTML = `Hola <strong>Octa</strong> 👑. Podés cargar tus números del <strong>1 al 10</strong> acá y administrar todo en el <strong>Panel de Octa</strong>.`;
    }
  } else {
    adminTag.classList.add("hidden");
    adminNavBtn.classList.add("hidden");
    avatarIcon.textContent = "👤";
    if (greeting) {
      greeting.innerHTML = `Hola <strong>${escapeHtml(currentUser.name)}</strong>. Elegí un número del <strong>1 al 10</strong> para cada apellido y guardá tu jugada.`;
    }
  }
}

// --- CAMBIO DE VISTAS ---
function switchView(viewName) {
  // Protección: amigos no pueden ver admin
  if (viewName === "admin" && !currentUser.isAdmin) {
    showToast("Acceso restringido: Solo Octa con contraseña puede entrar al panel de administración", "error");
    openLoginModal();
    switchLoginTab("octa");
    return;
  }

  const views = {
    bets: document.getElementById("viewBets"),
    table: document.getElementById("viewTable"),
    admin: document.getElementById("viewAdmin")
  };

  const navs = {
    bets: document.getElementById("navBtnBets"),
    table: document.getElementById("navBtnTable"),
    admin: document.getElementById("navBtnAdmin")
  };

  Object.keys(views).forEach(v => {
    if (v === viewName) {
      views[v].classList.remove("hidden");
      if (navs[v]) navs[v].classList.add("active");
    } else {
      views[v].classList.add("hidden");
      if (navs[v]) navs[v].classList.remove("active");
    }
  });

  if (viewName === "bets") renderBetsView();
  if (viewName === "table") renderTableView();
  if (viewName === "admin") renderAdminView();
}

// --- RENDERIZADO GLOBAL ---
function renderApp() {
  renderBetsView();
  renderTableView();
  if (currentUser.isAdmin) renderAdminView();
  updateShareUrlInput();
}

// --- VISTA 1: MIS APUESTAS ---
function renderBetsView() {
  const container = document.getElementById("betsCardsContainer");
  const emptyMsg = document.getElementById("noApellidosMessage");
  const countBadge = document.getElementById("apellidosCountBadge");
  const actionFooter = document.getElementById("betsActionFooter");

  countBadge.textContent = `${state.apellidos.length} Apellidos`;

  if (state.apellidos.length === 0) {
    container.innerHTML = "";
    emptyMsg.classList.remove("hidden");
    actionFooter.classList.add("hidden");
    return;
  }

  emptyMsg.classList.add("hidden");
  actionFooter.classList.remove("hidden");
  container.innerHTML = "";

  // Cargar borrador previo de este usuario si existe
  if (currentUser.name && state.bets[currentUser.name]) {
    currentBetDraft = { ...state.bets[currentUser.name] };
  }

  state.apellidos.forEach((apellido, idx) => {
    const selectedVal = currentBetDraft[apellido] || null;
    const isDone = selectedVal !== null;

    const card = document.createElement("div");
    card.className = `bet-card ${isDone ? "completed" : ""}`;
    card.id = `betCard_${idx}`;

    const header = document.createElement("div");
    header.className = "bet-card-header";
    header.innerHTML = `
      <span class="apellido-title">
        <span>#${idx + 1}</span> ${escapeHtml(apellido)}
      </span>
      <span class="current-selection-badge" id="badge_${idx}">
        ${isDone ? `Apostaste: ${selectedVal}` : "Sin elegir"}
      </span>
    `;

    const grid = document.createElement("div");
    grid.className = "number-selector-grid";

    for (let num = 1; num <= 10; num++) {
      const pill = document.createElement("button");
      pill.type = "button";
      pill.className = `num-pill ${selectedVal === num ? "selected" : ""}`;
      pill.textContent = num;
      pill.addEventListener("click", () => {
        selectBetNumber(apellido, num, idx);
      });
      grid.appendChild(pill);
    }

    card.appendChild(header);
    card.appendChild(grid);
    container.appendChild(card);
  });

  updateBetProgress();
}

function selectBetNumber(apellido, num, idx) {
  currentBetDraft[apellido] = num;

  const card = document.getElementById(`betCard_${idx}`);
  if (card) {
    card.classList.add("completed");
    const badge = document.getElementById(`badge_${idx}`);
    if (badge) badge.textContent = `Apostaste: ${num}`;

    const pills = card.querySelectorAll(".num-pill");
    pills.forEach((p, i) => {
      if (i + 1 === num) p.classList.add("selected");
      else p.classList.remove("selected");
    });
  }

  updateBetProgress();
}

function updateBetProgress() {
  const total = state.apellidos.length;
  const done = Object.keys(currentBetDraft).filter(a => state.apellidos.includes(a)).length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  const text = document.getElementById("footerProgressText");
  const bar = document.getElementById("footerProgressBar");
  if (text) text.textContent = `${done} de ${total} apellidos completados (${percent}%)`;
  if (bar) bar.style.width = `${percent}%`;
}

function saveMyBet() {
  if (!currentUser.name) {
    openLoginModal();
    return;
  }

  const missing = state.apellidos.filter(a => currentBetDraft[a] === undefined);
  if (missing.length > 0) {
    showToast(`Te faltan ${missing.length} apellidos por apostar`, "error");
    return;
  }

  state.bets[currentUser.name] = { ...currentBetDraft };
  saveState();
  showToast(`¡Apuestas de ${currentUser.name} guardadas con éxito!`, "success");
  switchView("table");
}

function shareMyBetWhatsApp() {
  if (!currentUser.name) {
    openLoginModal();
    return;
  }

  const missing = state.apellidos.filter(a => currentBetDraft[a] === undefined);
  if (missing.length > 0) {
    showToast("Completá todos los apellidos antes de enviar", "error");
    return;
  }

  state.bets[currentUser.name] = { ...currentBetDraft };
  saveState();

  const payload = {
    player: currentUser.name,
    picks: currentBetDraft
  };
  const encoded = encodeData(payload);
  const baseUrl = window.location.origin + window.location.pathname;
  const importLink = `${baseUrl}#bet=${encoded}`;

  let text = `🏆 *PRODE - Apuestas de ${currentUser.name}*\n\n`;
  state.apellidos.forEach(a => {
    text += `▪️ *${a}:* ${currentBetDraft[a]}\n`;
  });
  text += `\n📥 *Octa, cargá mi jugada directa tocando acá:*\n${importLink}\n`;
  text += `\n(Código: \`PRODE:${encoded}\`)`;

  const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(waUrl, "_blank");
}

// --- VISTA 2: TABLA GENERAL & ESTADÍSTICAS AVANZADAS ---
function calculateAdvancedStats() {
  if (!state.hasFinalResults) return null;

  const playerStats = [];
  const officialApellidos = state.apellidos.filter(a => state.finalResults[a] !== undefined);

  if (officialApellidos.length === 0) return null;

  // 1. Estadísticas individuales de cada jugador
  Object.keys(state.bets).forEach(name => {
    const picks = state.bets[name];
    let totalPoints = 0;
    let totalDifference = 0;
    let exactHits = 0;
    let worstDiff = -1;
    let worstApellido = "";
    const diffs = {};

    officialApellidos.forEach(a => {
      const official = state.finalResults[a];
      const pick = picks[a];

      if (pick !== undefined) {
        const diff = Math.abs(pick - official);
        diffs[a] = { pick, official, diff };
        totalDifference += diff;

        if (diff === 0) {
          totalPoints += 10;
          exactHits++;
        } else if (diff === 1) totalPoints += 7;
        else if (diff === 2) totalPoints += 5;
        else if (diff === 3) totalPoints += 3;
        else if (diff === 4) totalPoints += 1;

        if (diff > worstDiff) {
          worstDiff = diff;
          worstApellido = a;
        }
      }
    });

    const evaluatedCount = Object.keys(diffs).length;
    const avgDiff = evaluatedCount > 0 ? (totalDifference / evaluatedCount).toFixed(1) : 0;

    playerStats.push({
      name,
      totalPoints,
      totalDifference,
      avgDiff,
      exactHits,
      worstDiff,
      worstApellido,
      diffs
    });
  });

  // Ranking general: más puntos -> menor diferencia total -> más plenos
  playerStats.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (a.totalDifference !== b.totalDifference) return a.totalDifference - b.totalDifference;
    return b.exactHits - a.exactHits;
  });

  // 2. Quién estuvo más cerca en CADA APELLIDO
  const apellidoWinners = {};
  officialApellidos.forEach(a => {
    const official = state.finalResults[a];
    let bestDiff = 999;
    let winners = [];
    const participants = [];

    Object.keys(state.bets).forEach(name => {
      const pick = state.bets[name][a];
      if (pick !== undefined) {
        const diff = Math.abs(pick - official);
        participants.push({ name, pick, diff });
        if (diff < bestDiff) {
          bestDiff = diff;
          winners = [{ name, pick, diff }];
        } else if (diff === bestDiff) {
          winners.push({ name, pick, diff });
        }
      }
    });

    apellidoWinners[a] = {
      official,
      bestDiff,
      winners,
      participants
    };
  });

  return { playerStats, apellidoWinners };
}

function renderTableView() {
  const headerRow = document.getElementById("tableHeaderRow");
  const tbody = document.getElementById("tableBody");
  const emptyTable = document.getElementById("emptyTableMessage");
  const statusBadge = document.getElementById("tableStatusBadge");
  const podiumSec = document.getElementById("podiumSection");
  const breakdownSec = document.getElementById("breakdownSection");

  const playerNames = Object.keys(state.bets);

  if (playerNames.length === 0) {
    emptyTable.classList.remove("hidden");
    podiumSec.classList.add("hidden");
    breakdownSec.classList.add("hidden");
    headerRow.innerHTML = "<th>Apellido</th>";
    tbody.innerHTML = "";
    return;
  }

  emptyTable.classList.add("hidden");

  // Calcular estadísticas si hay resultados oficiales
  const stats = calculateAdvancedStats();

  if (state.hasFinalResults && stats && stats.playerStats.length > 0) {
    renderPodiumAndHighlights(stats.playerStats);
    renderApellidoBreakdown(stats.apellidoWinners);
    podiumSec.classList.remove("hidden");
    breakdownSec.classList.remove("hidden");
    statusBadge.textContent = "🏆 ¡Resultados Oficiales Cargados!";
    statusBadge.className = "badge badge-pulse";
  } else {
    podiumSec.classList.add("hidden");
    breakdownSec.classList.add("hidden");
    statusBadge.textContent = "⏳ Esperando resultados de Octa";
    statusBadge.className = "badge";
  }

  // Header de la tabla comparativa
  let headerHtml = "<th>Apellido</th>";
  if (state.hasFinalResults) {
    headerHtml += "<th class='result-col-header'>Oficial 🎯</th>";
  }
  playerNames.forEach(name => {
    const isOcta = name.toLowerCase() === "octa";
    headerHtml += `<th>${escapeHtml(name)} ${isOcta ? "👑" : ""}</th>`;
  });
  headerRow.innerHTML = headerHtml;

  // Filas por cada apellido
  tbody.innerHTML = "";
  state.apellidos.forEach(apellido => {
    const tr = document.createElement("tr");
    let rowHtml = `<td><strong>${escapeHtml(apellido)}</strong></td>`;

    if (state.hasFinalResults) {
      const official = state.finalResults[apellido];
      rowHtml += `<td class="result-col">${official !== undefined ? official : "-"}</td>`;
    }

    playerNames.forEach(name => {
      const pick = state.bets[name] ? state.bets[name][apellido] : undefined;

      if (pick === undefined) {
        rowHtml += `<td class="text-dim">-</td>`;
      } else if (state.hasFinalResults) {
        const official = state.finalResults[apellido];
        if (official !== undefined) {
          const diff = Math.abs(pick - official);
          let cls = "cell-far";
          if (diff === 0) cls = "cell-exact";
          else if (diff <= 2) cls = "cell-close";
          rowHtml += `<td class="${cls}">${pick} <small>(${diff === 0 ? "🎯 Pleno" : `±${diff}`})</small></td>`;
        } else {
          rowHtml += `<td>${pick}</td>`;
        }
      } else {
        rowHtml += `<td><strong>${pick}</strong></td>`;
      }
    });

    tr.innerHTML = rowHtml;
    tbody.appendChild(tr);
  });

  // Fila resumen si hay resultados
  if (state.hasFinalResults && stats) {
    const scoreMap = {};
    stats.playerStats.forEach(s => scoreMap[s.name] = s);

    // Puntos totales
    const trPoints = document.createElement("tr");
    trPoints.style.background = "rgba(16, 185, 129, 0.12)";
    trPoints.style.fontWeight = "800";
    let pRow = `<td>🏆 PUNTOS TOTALES</td><td class="result-col">-</td>`;
    playerNames.forEach(name => {
      const sc = scoreMap[name];
      pRow += `<td style="color:var(--success); font-size:1.15rem">${sc ? sc.totalPoints + " pts" : "0"}</td>`;
    });
    trPoints.innerHTML = pRow;
    tbody.appendChild(trPoints);

    // Plenos
    const trHits = document.createElement("tr");
    let hRow = `<td>🎯 Plenos (Exactos)</td><td class="result-col">-</td>`;
    playerNames.forEach(name => {
      const sc = scoreMap[name];
      hRow += `<td>${sc ? sc.exactHits : "0"}</td>`;
    });
    trHits.innerHTML = hRow;
    tbody.appendChild(trHits);

    // Error promedio
    const trAvg = document.createElement("tr");
    let aRow = `<td>📏 Desvío Promedio (±)</td><td class="result-col">-</td>`;
    playerNames.forEach(name => {
      const sc = scoreMap[name];
      aRow += `<td class="text-dim">${sc ? "±" + sc.avgDiff : "0"}</td>`;
    });
    trAvg.innerHTML = aRow;
    tbody.appendChild(trAvg);
  }
}

function renderPodiumAndHighlights(playerStats) {
  const podiumGrid = document.getElementById("podiumGrid");
  const highlightsRow = document.getElementById("statsHighlightsRow");

  podiumGrid.innerHTML = "";
  highlightsRow.innerHTML = "";

  const medals = ["🥇", "🥈", "🥉", "💩"];

  // Podio de posiciones
  playerStats.forEach((p, idx) => {
    const item = document.createElement("div");
    const isFirst = idx === 0;
    const medal = medals[idx] || `#${idx + 1}`;

    item.className = `podium-item ${isFirst ? "first-place" : ""}`;
    item.innerHTML = `
      <div class="podium-rank">${medal}</div>
      <div class="podium-name">${escapeHtml(p.name)}</div>
      <div class="podium-points">${p.totalPoints} pts</div>
      <div class="podium-diff">
        <span>${p.exactHits} plenos</span> &bull; 
        <span>Desvío: ±${p.avgDiff}</span>
      </div>
    `;
    podiumGrid.appendChild(item);
  });

  // Estadísticas destacadas
  // 1. Mejor puntería (menor avgDiff)
  const bestAim = [...playerStats].sort((a, b) => a.totalDifference - b.totalDifference)[0];
  // 2. Más plenos
  const mostPlenos = [...playerStats].sort((a, b) => b.exactHits - a.exactHits)[0];
  // 3. El tiro más lejano (peor tiro individual)
  const worstShot = [...playerStats].sort((a, b) => b.worstDiff - a.worstDiff)[0];

  highlightsRow.innerHTML = `
    <div class="stat-pill-card">
      <span class="stat-pill-icon">🎯</span>
      <div class="stat-pill-content">
        <span class="stat-pill-label">Mejor Puntería</span>
        <span class="stat-pill-value">${escapeHtml(bestAim.name)} (erró solo ±${bestAim.avgDiff} promedio)</span>
      </div>
    </div>
    <div class="stat-pill-card">
      <span class="stat-pill-icon">⚡</span>
      <div class="stat-pill-content">
        <span class="stat-pill-label">Rey de los Plenos</span>
        <span class="stat-pill-value">${escapeHtml(mostPlenos.name)} (${mostPlenos.exactHits} aciertos exactos)</span>
      </div>
    </div>
    <div class="stat-pill-card">
      <span class="stat-pill-icon">🚀</span>
      <div class="stat-pill-content">
        <span class="stat-pill-label">La Pifiada del Torneo</span>
        <span class="stat-pill-value">${escapeHtml(worstShot.name)} (erró por ${worstShot.worstDiff} en ${worstShot.worstApellido})</span>
      </div>
    </div>
  `;

  // Lanzar confeti
  if (typeof confetti === "function") {
    confetti({ particleCount: 75, spread: 70, origin: { y: 0.6 } });
  }
}

function renderApellidoBreakdown(apellidoWinners) {
  const container = document.getElementById("apellidoBreakdownList");
  container.innerHTML = "";

  Object.keys(apellidoWinners).forEach(apellido => {
    const data = apellidoWinners[apellido];
    const card = document.createElement("div");
    card.className = "breakdown-card";

    const winnerNames = data.winners.map(w => `${escapeHtml(w.name)} (${w.pick}${w.diff === 0 ? " 🎯 Pleno" : ""})`).join(", ");

    let othersHtml = "";
    data.participants.forEach(p => {
      othersHtml += `<span>${escapeHtml(p.name)}: ${p.pick} (±${p.diff})</span>`;
    });

    card.innerHTML = `
      <div class="breakdown-card-header">
        <span>${escapeHtml(apellido)}</span>
        <span class="breakdown-official-num">Oficial: ${data.official}</span>
      </div>
      <div class="breakdown-winner-row">
        🏆 Más cerca: <strong>${winnerNames}</strong>
      </div>
      <div class="breakdown-others-list">
        ${othersHtml}
      </div>
    `;

    container.appendChild(card);
  });
}

// --- VISTA 3: PANEL EXCLUSIVO DE OCTA ---
function renderAdminView() {
  if (!currentUser.isAdmin) return;

  renderAdminApellidosChips();
  renderAdminFinalResultsGrid();

  const passInput = document.getElementById("adminNewPasswordInput");
  if (passInput) passInput.value = "";

  const fbInput = document.getElementById("firebaseDbUrlInput");
  if (fbInput && state.firebaseUrl) fbInput.value = state.firebaseUrl;
}

function renderAdminApellidosChips() {
  const container = document.getElementById("adminApellidosChipsList");
  container.innerHTML = "";

  if (state.apellidos.length === 0) {
    container.innerHTML = "<span class='text-muted'>No hay apellidos todavía. ¡Agregá uno arriba!</span>";
    return;
  }

  state.apellidos.forEach((apellido, idx) => {
    const chip = document.createElement("div");
    chip.className = "apellido-chip";
    chip.innerHTML = `
      <span>${escapeHtml(apellido)}</span>
      <button type="button" title="Eliminar apellido" onclick="adminRemoveApellido(${idx})">&times;</button>
    `;
    container.appendChild(chip);
  });
}

function adminAddApellido() {
  const input = document.getElementById("adminNewApellidoInput");
  const val = input.value.trim();

  if (!val) {
    showToast("Escribí un apellido para agregar", "error");
    return;
  }

  if (state.apellidos.map(a => a.toLowerCase()).includes(val.toLowerCase())) {
    showToast("Ese apellido ya existe en la lista", "error");
    return;
  }

  state.apellidos.push(val);
  input.value = "";
  saveState();
  renderApp();
  showToast(`"${val}" agregado correctamente`, "success");
}

window.adminRemoveApellido = function(idx) {
  const removed = state.apellidos[idx];
  state.apellidos.splice(idx, 1);
  saveState();
  renderApp();
  showToast(`"${removed}" eliminado`, "info");
};

function renderAdminFinalResultsGrid() {
  const container = document.getElementById("adminFinalResultsGrid");
  container.innerHTML = "";

  if (state.apellidos.length === 0) {
    container.innerHTML = "<p class='text-muted'>Agregá apellidos arriba para poder cargar los resultados.</p>";
    return;
  }

  state.apellidos.forEach(apellido => {
    const val = state.finalResults[apellido] || "";
    const card = document.createElement("div");
    card.className = "result-input-card";

    let opts = `<option value="">-- Elegir --</option>`;
    for (let i = 1; i <= 10; i++) {
      opts += `<option value="${i}" ${Number(val) === i ? "selected" : ""}>${i}</option>`;
    }

    card.innerHTML = `
      <label>${escapeHtml(apellido)}:</label>
      <select class="admin-final-select" data-apellido="${escapeHtml(apellido)}">
        ${opts}
      </select>
    `;
    container.appendChild(card);
  });
}

function adminSaveFinalResults() {
  const selects = document.querySelectorAll(".admin-final-select");
  const results = {};
  let missing = 0;

  selects.forEach(sel => {
    const ap = sel.getAttribute("data-apellido");
    const v = sel.value;
    if (v === "") missing++;
    else results[ap] = parseInt(v, 10);
  });

  if (missing > 0) {
    if (!confirm(`Faltan ${missing} apellidos sin resultado. ¿Querés guardar y calcular igual con los que pusiste?`)) {
      return;
    }
  }

  state.finalResults = results;
  state.hasFinalResults = Object.keys(results).length > 0;
  saveState();
  renderApp();
  showToast("¡Resultados finales guardados! Mirá las estadísticas en la Tabla", "success");
  switchView("table");
}

function adminClearFinalResults() {
  if (confirm("¿Seguro que querés limpiar los resultados oficiales?")) {
    state.finalResults = {};
    state.hasFinalResults = false;
    saveState();
    renderApp();
    showToast("Resultados oficiales borrados", "info");
  }
}

function adminProcessImportBet() {
  const textarea = document.getElementById("adminImportBetTextarea");
  const raw = textarea.value.trim();

  if (!raw) {
    showToast("Pegá el mensaje de WhatsApp", "error");
    return;
  }

  // Buscar código base64
  let code = null;
  const m1 = raw.match(/PRODE:([A-Za-z0-9%_\-=]+)/);
  if (m1) code = m1[1];
  else {
    const m2 = raw.match(/[#?]bet=([A-Za-z0-9%_\-=]+)/);
    if (m2) code = m2[1];
  }

  if (code) {
    const parsed = decodeData(code);
    if (parsed && parsed.player && parsed.picks) {
      state.bets[parsed.player] = parsed.picks;
      saveState();
      renderApp();
      textarea.value = "";
      showToast(`¡Apuesta de ${parsed.player} importada!`, "success");
      switchView("table");
      return;
    }
  }

  // Parser inteligente de texto
  const lines = raw.split("\n");
  let foundPlayer = "Amigo";
  const foundPicks = {};

  lines.forEach(line => {
    const pMatch = line.match(/(?:Jugador|Nombre|De|Soy)[:\s]+([A-Za-zÁÉÍÓÚáéíóúñÑ0-9_ ]+)/i);
    if (pMatch) foundPlayer = pMatch[1].trim();

    state.apellidos.forEach(a => {
      const reg = new RegExp(`${a}[:\\s]+([1-9]|10)\\b`, "i");
      const nMatch = line.match(reg);
      if (nMatch) foundPicks[a] = parseInt(nMatch[1], 10);
    });
  });

  if (Object.keys(foundPicks).length > 0) {
    state.bets[foundPlayer] = foundPicks;
    saveState();
    renderApp();
    textarea.value = "";
    showToast(`¡Apuesta de ${foundPlayer} leída y guardada!`, "success");
    switchView("table");
    return;
  }

  showToast("No se pudo reconocer la apuesta en el texto", "error");
}

function openManualBetModal() {
  const container = document.getElementById("manualBetsList");
  container.innerHTML = "";

  state.apellidos.forEach(a => {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.justifyContent = "space-between";
    row.style.alignItems = "center";
    row.style.padding = "0.4rem 0.6rem";
    row.style.background = "var(--bg-card-subtle)";
    row.style.borderRadius = "var(--radius-sm)";

    let opts = `<option value="">--</option>`;
    for (let i = 1; i <= 10; i++) opts += `<option value="${i}">${i}</option>`;

    row.innerHTML = `
      <span>${escapeHtml(a)}</span>
      <select class="manual-pick-select" data-apellido="${escapeHtml(a)}" style="background:var(--bg-main);color:#fff;padding:0.3rem 0.5rem;border-radius:4px;border:1px solid var(--border-color)">
        ${opts}
      </select>
    `;
    container.appendChild(row);
  });

  document.getElementById("manualFriendName").value = "";
  document.getElementById("manualBetModal").classList.remove("hidden");
}

function closeManualBetModal() {
  document.getElementById("manualBetModal").classList.add("hidden");
}

function saveManualFriendBet() {
  const name = document.getElementById("manualFriendName").value.trim();
  if (!name) {
    showToast("Escribí el nombre del amigo", "error");
    return;
  }

  const selects = document.querySelectorAll(".manual-pick-select");
  const picks = {};
  selects.forEach(s => {
    const ap = s.getAttribute("data-apellido");
    if (s.value) picks[ap] = parseInt(s.value, 10);
  });

  if (Object.keys(picks).length === 0) {
    showToast("Elegí al menos un número", "error");
    return;
  }

  state.bets[name] = picks;
  saveState();
  renderApp();
  closeManualBetModal();
  showToast(`¡Apuesta de ${name} agregada a la tabla!`, "success");
  switchView("table");
}

function adminChangePassword() {
  const newPass = document.getElementById("adminNewPasswordInput").value.trim();
  if (!newPass) {
    showToast("Ingresá una nueva contraseña", "error");
    return;
  }

  state.adminPassword = newPass;
  saveState();
  document.getElementById("adminNewPasswordInput").value = "";
  showToast("¡Contraseña de Octa actualizada con éxito!", "success");
}

function adminSaveFirebaseUrl() {
  const url = document.getElementById("firebaseDbUrlInput").value.trim();
  state.firebaseUrl = url;
  saveState();
  if (url) {
    pushToFirebase();
    showToast("URL de Firebase guardada y sincronizada", "success");
    document.getElementById("cloudSyncAlert").classList.remove("hidden");
  } else {
    document.getElementById("cloudSyncAlert").classList.add("hidden");
    showToast("Firebase desactivado. Usando almacenamiento local", "info");
  }
}

function adminExportJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `prode_octa_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Respaldo descargado", "success");
}

function adminResetProde() {
  if (confirm("⚠️ ¿Estás seguro de reiniciar todo el prode? Se borrarán apuestas y resultados.")) {
    state.bets = {};
    state.finalResults = {};
    state.hasFinalResults = false;
    currentBetDraft = {};
    saveState();
    renderApp();
    showToast("Prode reiniciado", "info");
    switchView("bets");
  }
}

// --- COMPARTIR ENLACE ---
function updateShareUrlInput() {
  const input = document.getElementById("shareUrlInput");
  if (!input) return;

  const payload = {
    title: state.title,
    apellidos: state.apellidos,
    firebaseUrl: state.firebaseUrl || undefined
  };

  const encoded = encodeData(payload);
  const baseUrl = window.location.origin + window.location.pathname;
  input.value = `${baseUrl}#prode=${encoded}`;
}

function copyShareUrl() {
  const input = document.getElementById("shareUrlInput");
  input.select();
  navigator.clipboard.writeText(input.value).then(() => {
    showToast("¡Enlace copiado al portapapeles!", "success");
  }).catch(() => {
    document.execCommand("copy");
    showToast("¡Enlace copiado!", "success");
  });
}

function shareInviteWhatsApp() {
  const input = document.getElementById("shareUrlInput");
  const link = input.value;
  const text = `⚽ *¡Salió el Prode con los pibes!*\n\nOcta armó el prode. Entrá al link, poné tu nombre (sin contraseña) y elegí del 1 al 10 para cada apellido:\n\n👉 ${link}\n\n¡Al final miramos las estadísticas de quién se acercó más!`;
  const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(waUrl, "_blank");
}

// --- HELPER ESCAPE HTML ---
function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
