// ===================== FIREBASE CONFIG =====================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB1eajhPBzIraCpUjWuuN7C8-OJeT081q8",
  authDomain: "tech-motors-c1b61.firebaseapp.com",
  projectId: "tech-motors-c1b61",
  storageBucket: "tech-motors-c1b61.firebasestorage.app",
  messagingSenderId: "62161555992",
  appId: "1:62161555992:web:595dbb68d524befd3ce96d",
  measurementId: "G-8C1TV62EX7"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ===================== CAMPOS DE INSPEÇÃO =====================
const CAMPOS = {
  mecanica: [
    'Tampa Dianteira',
    'Tampa Traseira',
    'Sistema de Ventilação',
    'Vedação',
    'Rolamento'
  ],
  usinagem: [
    'Metrologia dos Colos do Eixo',
    'Metrologia do Assento da Polia/Acoplamento',
    'Teste de Batimento Radial',
    'Inspeção Visual do Rotor',
    'Anéis Coletores / Comutador (Se houver)'
  ],
  eletrica: [
    'Inspeção Visual do Bobinado',
    'Inspeção do Núcleo Estatórico',
    'Megonagem (Resistência de Isolamento)',
    'Resistência Ôhmica',
    'Inspeção de Sensores'
  ]
};

// ===================== ESTADO LOCAL =====================
const statusState = { mecanica: {}, usinagem: {}, eletrica: {} };
let osAtual = null;
let todosMotores = []; // cache local para filtro do painel

// ===================== UTILS =====================
function getTimestamp() {
  return new Date().toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

async function getNextOS() {
  const snap = await getDocs(collection(db, 'ordens'));
  const nums = snap.docs
    .map(d => parseInt((d.data().os || '').replace('OS-', '')))
    .filter(n => !isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return 'OS-' + String(next).padStart(4, '0');
}

// ===================== NAVEGAÇÃO =====================
window.showPage = function(p) {
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
  document.getElementById('page-' + p).classList.add('active');

  const labels = { recebimento: 'recebimento', mecanica: 'mecânica', usinagem: 'usinagem', eletrica: 'elétrica', painel: 'painel' };
  document.querySelectorAll('.nav-btn').forEach(btn => {
    if (btn.textContent.toLowerCase().includes(labels[p])) btn.classList.add('active');
  });
};

// ===================== ALERTAS =====================
function showAlert(setor, msg, type) {
  const el = document.getElementById('alert-' + setor);
  if (!el) return;
  if (!msg) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="alert alert-${type}">${msg}</div>`;
  if (type === 'success') setTimeout(() => el.innerHTML = '', 4000);
}

// ===================== RECEBIMENTO =====================
window.registrarOS = async function() {
  const nome    = document.getElementById('r-nome').value.trim();
  const celular = document.getElementById('r-celular').value.trim();
  const modelo  = document.getElementById('r-modelo').value.trim();
  const serie   = document.getElementById('r-serie').value.trim();
  const obs     = document.getElementById('r-obs').value.trim();

  if (!nome || !celular || !modelo) {
    showAlert('recebimento', 'Preencha ao menos nome, celular e modelo do motor.', 'error');
    return;
  }

  const btn = document.querySelector('#page-recebimento .btn-primary');
  btn.textContent = 'Salvando...';
  btn.disabled = true;

  try {
    const os = await getNextOS();
    const registro = {
      os, nome, celular, modelo, serie, obs,
      timestamp_recebimento: getTimestamp(),
      mecanica: null,
      usinagem: null,
      eletrica: null
    };

    await addDoc(collection(db, 'ordens'), registro);
    osAtual = os;

    document.getElementById('os-numero-display').textContent = os;
    document.getElementById('os-timestamp').textContent = registro.timestamp_recebimento;
    document.getElementById('os-gerada').style.display = 'block';

    // QR Code
    document.getElementById('qrcode').innerHTML = '';
    const url = window.location.href.split('?')[0] + '?os=' + os + '&setor=mecanica';
    new QRCode(document.getElementById('qrcode'), {
      text: url, width: 160, height: 160,
      colorDark: '#e8eaf0', colorLight: '#181c27'
    });

    showAlert('recebimento', `OS ${os} registrada com sucesso!`, 'success');
  } catch (e) {
    showAlert('recebimento', 'Erro ao salvar. Verifique sua conexão.', 'error');
    console.error(e);
  }

  btn.textContent = 'Registrar e Gerar OS';
  btn.disabled = false;
};

window.novaOS = function() {
  ['r-nome','r-celular','r-modelo','r-serie','r-obs'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('os-gerada').style.display = 'none';
  document.getElementById('alert-recebimento').innerHTML = '';
  osAtual = null;
};

window.imprimirEtiqueta = async function() {
  if (!osAtual) return;
  const snap = await getDocs(collection(db, 'ordens'));
  const m = snap.docs.map(d => d.data()).find(x => x.os === osAtual);
  if (!m) return;

  document.getElementById('print-area').innerHTML = `
    <div class="etiqueta">
      <div class="etiqueta-label">Tech Motors — Ordem de Serviço</div>
      <div class="etiqueta-os">${m.os}</div>
      <div id="qr-print"></div>
      <div class="etiqueta-info"><span class="etiqueta-label">Cliente: </span>${m.nome}</div>
      <div class="etiqueta-info"><span class="etiqueta-label">Motor: </span>${m.modelo}</div>
      <div class="etiqueta-info"><span class="etiqueta-label">Série: </span>${m.serie || '—'}</div>
      <div class="etiqueta-info"><span class="etiqueta-label">Entrada: </span>${m.timestamp_recebimento}</div>
    </div>
  `;

  const url = window.location.href.split('?')[0] + '?os=' + m.os + '&setor=mecanica';
  new QRCode(document.getElementById('qr-print'), { text: url, width: 80, height: 80 });
  setTimeout(() => window.print(), 400);
};

// ===================== CAMPOS DE INSPEÇÃO =====================
function buildFields(setor) {
  const container = document.getElementById(setor + '-fields');
  container.innerHTML = '';
  CAMPOS[setor].forEach((campo, i) => {
    container.innerHTML += `
      <div class="insp-field">
        <div class="insp-field-name">${campo}</div>
        <div class="status-btns">
          <button class="status-btn" id="btn-ok-${setor}-${i}"      onclick="setStatus('${setor}',${i},'OK')">✓ OK</button>
          <button class="status-btn" id="btn-defeito-${setor}-${i}" onclick="setStatus('${setor}',${i},'Defeito')">✗ Com Defeito</button>
          <button class="status-btn" id="btn-na-${setor}-${i}"      onclick="setStatus('${setor}',${i},'N/A')">— N/A</button>
        </div>
        <textarea class="insp-obs" id="obs-${setor}-${i}" placeholder="Observação sobre este item..."></textarea>
      </div>`;
  });
}

window.setStatus = function(setor, idx, val) {
  statusState[setor][idx] = val;
  const map = { 'OK': 'ok', 'Defeito': 'defeito', 'N/A': 'na' };
  ['OK','Defeito','N/A'].forEach(s => {
    const key = s === 'OK' ? 'ok' : s === 'Defeito' ? 'defeito' : 'na';
    const btn = document.getElementById(`btn-${key}-${setor}-${idx}`);
    if (btn) btn.className = 'status-btn' + (s === val ? ' selected-' + map[s] : '');
  });
};

// ===================== BUSCAR OS NOS SETORES =====================
window.buscarOS = async function(setor) {
  const input = document.getElementById(setor + '-os-input').value.trim().toUpperCase();
  const snap  = await getDocs(collection(db, 'ordens'));
  const doc   = snap.docs.find(d => d.data().os === input);

  if (!doc) {
    showAlert(setor, `OS "${input}" não encontrada. Verifique o número.`, 'error');
    document.getElementById(setor + '-form').style.display = 'none';
    return;
  }

  const m = doc.data();
  document.getElementById(setor + '-os-display').textContent = m.os;
  document.getElementById(setor + '-cliente-info').innerHTML = `<strong>${m.nome}</strong> · ${m.modelo}`;
  document.getElementById(setor + '-form').style.display = 'block';

  buildFields(setor);
  statusState[setor] = {};

  if (m[setor]) {
    m[setor].campos.forEach((c, i) => {
      setStatus(setor, i, c.status);
      const obsEl = document.getElementById(`obs-${setor}-${i}`);
      if (obsEl) obsEl.value = c.obs || '';
    });
    document.getElementById(setor + '-obs').value = m[setor].obs_geral || '';
  }

  showAlert(setor, '', '');
};

// ===================== SALVAR INSPEÇÃO =====================
window.salvarSetor = async function(setor) {
  const input = document.getElementById(setor + '-os-input').value.trim().toUpperCase();
  const snap  = await getDocs(collection(db, 'ordens'));
  const docRef = snap.docs.find(d => d.data().os === input);
  if (!docRef) return;

  const btn = document.querySelector(`#page-${setor} .btn-primary`);
  btn.textContent = 'Salvando...';
  btn.disabled = true;

  const campos = CAMPOS[setor].map((nome, i) => ({
    nome,
    status: statusState[setor][i] || '—',
    obs: (document.getElementById(`obs-${setor}-${i}`) || {}).value || ''
  }));

  const dados = {
    [setor]: {
      campos,
      obs_geral: document.getElementById(setor + '-obs').value,
      timestamp: getTimestamp()
    }
  };

  try {
    await updateDoc(doc(db, 'ordens', docRef.id), dados);
    showAlert(setor, `Inspeção salva com sucesso em ${dados[setor].timestamp}`, 'success');
  } catch (e) {
    showAlert(setor, 'Erro ao salvar. Verifique sua conexão.', 'error');
    console.error(e);
  }

  btn.textContent = 'Salvar Inspeção';
  btn.disabled = false;
};

// ===================== PAINEL EM TEMPO REAL =====================
function statusBadge(setor) {
  if (!setor) return `<span class="badge badge-nao">Pendente</span>`;
  const temDefeito = setor.campos.some(c => c.status === 'Defeito');
  const todos      = setor.campos.every(c => c.status && c.status !== '—');
  if (temDefeito) return `<span class="badge badge-defeito">Com Defeito</span>`;
  if (todos)      return `<span class="badge badge-ok">Concluído</span>`;
  return `<span class="badge badge-pendente">Em andamento</span>`;
}

function renderTabela(lista) {
  const tbody = document.getElementById('painel-body');
  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--muted); padding:2rem;">Nenhuma OS encontrada.</td></tr>`;
    return;
  }
  tbody.innerHTML = lista.map(m => `
    <tr>
      <td><span style="font-family:'IBM Plex Mono',monospace; font-weight:600; color:var(--accent)">${m.os}</span></td>
      <td>${m.nome}<br><span style="color:var(--muted);font-size:0.75rem">${m.celular}</span></td>
      <td>${m.modelo}<br><span style="color:var(--muted);font-size:0.75rem">${m.serie || '—'}</span></td>
      <td><span class="timestamp">${m.timestamp_recebimento}</span></td>
      <td>${statusBadge(m.mecanica)}</td>
      <td>${statusBadge(m.usinagem)}</td>
      <td>${statusBadge(m.eletrica)}</td>
      <td><button class="btn btn-secondary btn-sm" onclick="abrirModal('${m.os}')">Ver</button></td>
    </tr>
  `).join('');
}

window.filtrarPainel = function() {
  const busca = (document.getElementById('painel-busca').value || '').toLowerCase();
  const filtrado = todosMotores.filter(m =>
    !busca ||
    m.os.toLowerCase().includes(busca) ||
    m.nome.toLowerCase().includes(busca) ||
    m.modelo.toLowerCase().includes(busca)
  );
  renderTabela(filtrado);
};

// Listener em tempo real — atualiza o painel automaticamente
onSnapshot(collection(db, 'ordens'), snap => {
  todosMotores = snap.docs.map(d => d.data()).reverse();
  filtrarPainel();
});

// ===================== MODAL =====================
function badgeStatus(status) {
  if (status === 'OK')      return `<span class="badge badge-ok">OK</span>`;
  if (status === 'Defeito') return `<span class="badge badge-defeito">Defeito</span>`;
  if (status === 'N/A')     return `<span class="badge badge-nao">N/A</span>`;
  return `<span class="badge badge-nao">—</span>`;
}

window.abrirModal = async function(os) {
  const snap = await getDocs(collection(db, 'ordens'));
  const m = snap.docs.map(d => d.data()).find(x => x.os === os);
  if (!m) return;

  const setorHTML = (nome, cor, dados) => {
    if (!dados) return `
      <div class="detail-section">
        <div class="detail-section-title" style="border-color:${cor}">${nome}</div>
        <p style="color:var(--muted); font-size:0.85rem;">Inspeção ainda não realizada.</p>
      </div>`;
    return `
      <div class="detail-section">
        <div class="detail-section-title" style="border-color:${cor}">
          ${nome} · <span class="timestamp">${dados.timestamp}</span>
        </div>
        <div class="detail-insp">
          ${dados.campos.map(c => `
            <div class="detail-insp-row">
              <div class="detail-insp-name">${c.nome}</div>
              <div class="detail-insp-right">
                ${badgeStatus(c.status)}
                ${c.obs ? `<div class="detail-insp-obs">${c.obs}</div>` : ''}
              </div>
            </div>`).join('')}
          ${dados.obs_geral ? `
            <div style="margin-top:0.5rem; padding:0.75rem; background:var(--surface2);
                        border-radius:4px; font-size:0.82rem; color:var(--muted)">
              <strong style="color:var(--text)">Obs. gerais:</strong> ${dados.obs_geral}
            </div>` : ''}
        </div>
      </div>`;
  };

  document.getElementById('modal-content').innerHTML = `
    <div class="modal-title">
      <span style="color:var(--accent); font-family:'IBM Plex Mono',monospace">${m.os}</span> — ${m.nome}
    </div>
    <div class="detail-section">
      <div class="detail-section-title">Dados do Cliente e Motor</div>
      <div class="detail-grid">
        <div class="detail-item"><label>Cliente</label><span>${m.nome}</span></div>
        <div class="detail-item"><label>Celular</label><span>${m.celular}</span></div>
        <div class="detail-item"><label>Modelo</label><span>${m.modelo}</span></div>
        <div class="detail-item"><label>Nº de Série</label><span>${m.serie || '—'}</span></div>
        <div class="detail-item" style="grid-column:1/-1">
          <label>Entrada</label><span class="timestamp">${m.timestamp_recebimento}</span>
        </div>
        ${m.obs ? `<div class="detail-item" style="grid-column:1/-1"><label>Observações de entrada</label><span>${m.obs}</span></div>` : ''}
      </div>
    </div>
    ${setorHTML('Mecânica',         'var(--mecanica)', m.mecanica)}
    ${setorHTML('Usinagem — Rotor', 'var(--usinagem)', m.usinagem)}
    ${setorHTML('Elétrica',         'var(--eletrica)', m.eletrica)}
  `;

  document.getElementById('modal-overlay').classList.add('open');
};

window.fecharModal = function(e) {
  if (!e || e.target === document.getElementById('modal-overlay')) {
    document.getElementById('modal-overlay').classList.remove('open');
  }
};

// ===================== REDIRECIONAMENTO POR QR CODE =====================
(function() {
  const params = new URLSearchParams(window.location.search);
  const os     = params.get('os');
  const setor  = params.get('setor');
  if (os && setor && ['mecanica','usinagem','eletrica'].includes(setor)) {
    showPage(setor);
    setTimeout(() => {
      const input = document.getElementById(setor + '-os-input');
      if (input) { input.value = os.toUpperCase(); buscarOS(setor); }
    }, 300);
  }
})();
