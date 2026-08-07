/* =========================================================
   HELPDESK TICKETS FRONTEND ENGINE (SPA)
   ========================================================= */

const API_BASE = '';
let currentUser = null;
let currentToken = null;
let currentTicketId = null;

// Elementos DOM Principais
const viewLogin = document.getElementById('view-login');
const viewApp = document.getElementById('view-app');
const formLogin = document.getElementById('form-login');
const userDisplayName = document.getElementById('user-display-name');
const userDisplayBadge = document.getElementById('user-display-badge');
const btnLogout = document.getElementById('btn-logout');

// Dashboard Elements
const dashboardTitle = document.getElementById('dashboard-title');
const btnTabUsers = document.getElementById('btn-tab-users');
const btnOpenNewTicket = document.getElementById('btn-open-new-ticket');
const ticketsList = document.getElementById('tickets-list');
const ticketsLoading = document.getElementById('tickets-loading');
const ticketsEmpty = document.getElementById('tickets-empty');

// Filter Elements
const filterStatus = document.getElementById('filter-status');
const filterTipo = document.getElementById('filter-tipo');
const filterUsuario = document.getElementById('filter-usuario');
const filterDataInicio = document.getElementById('filter-data-inicio');
const filterDataFim = document.getElementById('filter-data-fim');
const btnApplyFilters = document.getElementById('btn-apply-filters');
const btnClearFilters = document.getElementById('btn-clear-filters');

// Modal Elements - New Ticket
const modalNewTicket = document.getElementById('modal-new-ticket');
const formNewTicket = document.getElementById('form-new-ticket');
const btnCloseModalTicket = document.getElementById('btn-close-modal-ticket');
const btnCancelTicket = document.getElementById('btn-cancel-ticket');

// Modal Elements - Ticket Details
const modalTicketDetails = document.getElementById('modal-ticket-details');
const btnCloseModalDetails = document.getElementById('btn-close-modal-details');
const detailTicketBadge = document.getElementById('detail-ticket-badge');
const detailTicketTitulo = document.getElementById('detail-ticket-titulo');
const detailTicketSolicitante = document.getElementById('detail-ticket-solicitante');
const detailTicketTipo = document.getElementById('detail-ticket-tipo');
const detailTicketData = document.getElementById('detail-ticket-data');
const detailTicketResponsavel = document.getElementById('detail-ticket-responsavel');
const detailTicketDescricao = document.getElementById('detail-ticket-descricao');
const detailTicketHistorico = document.getElementById('detail-ticket-historico');
const detailTicketComentarios = document.getElementById('detail-ticket-comentarios');
const formAddComment = document.getElementById('form-add-comment');
const commentText = document.getElementById('comment-text');
const adminStatusControl = document.getElementById('admin-status-control');

// Modal Elements - Admin Users Management
const modalUsersManagement = document.getElementById('modal-users-management');
const btnCloseModalUsers = document.getElementById('btn-close-modal-users');
const formAdminUser = document.getElementById('form-admin-user');
const userFormTitle = document.getElementById('user-form-title');
const userEditId = document.getElementById('user-edit-id');
const userNome = document.getElementById('user-nome');
const userEmail = document.getElementById('user-email');
const userSenha = document.getElementById('user-senha');
const senhaHelp = document.getElementById('senha-help');
const userRole = document.getElementById('user-role');
const btnCancelEditUser = document.getElementById('btn-cancel-edit-user');
const usersTableBody = document.getElementById('users-table-body');

/* =========================================================
   INICIALIZAÇÃO E AUTENTICAÇÃO
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
  const savedToken = localStorage.getItem('helpdesk_token');
  const savedUser = localStorage.getItem('helpdesk_user');

  if (savedToken && savedUser) {
    try {
      currentToken = savedToken;
      currentUser = JSON.parse(savedUser);
      showAppScreen();
    } catch (e) {
      logout();
    }
  }

  setupEventListeners();
});

function setupEventListeners() {
  // Login
  formLogin.addEventListener('submit', handleLogin);
  btnLogout.addEventListener('submit', (e) => e.preventDefault());
  btnLogout.addEventListener('click', logout);

  // Modais de Tickets
  btnOpenNewTicket.addEventListener('click', () => openModal(modalNewTicket));
  btnCloseModalTicket.addEventListener('click', () => closeModal(modalNewTicket));
  btnCancelTicket.addEventListener('click', () => closeModal(modalNewTicket));
  formNewTicket.addEventListener('submit', handleCreateTicket);

  btnCloseModalDetails.addEventListener('click', () => closeModal(modalTicketDetails));
  formAddComment.addEventListener('submit', handleAddComment);

  // Status Buttons para Admin
  document.querySelectorAll('.btn-status-change').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const status = e.target.dataset.status;
      if (currentTicketId && status) {
        updateTicketStatus(currentTicketId, status);
      }
    });
  });

  // Filtros
  btnApplyFilters.addEventListener('click', loadTickets);
  btnClearFilters.addEventListener('click', clearFilters);

  // Admin Users
  btnTabUsers.addEventListener('click', () => {
    openModal(modalUsersManagement);
    loadUsersList();
  });
  btnCloseModalUsers.addEventListener('click', () => closeModal(modalUsersManagement));
  formAdminUser.addEventListener('submit', handleSaveUser);
  btnCancelEditUser.addEventListener('click', resetUserForm);
}

/* =========================================================
   MÉTODOS DE REQUISIÇÃO COM TOKEN JWT
   ========================================================= */
async function fetchAPI(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (currentToken) {
    headers['Authorization'] = `Bearer ${currentToken}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (response.status === 401) {
    showToast('Sessão expirada. Faça login novamente.', 'error');
    logout();
    throw new Error('Não autorizado');
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Erro ao processar solicitação.');
  }

  return data;
}

/* =========================================================
   LOGIN / LOGOUT / TELAS
   ========================================================= */
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const senha = document.getElementById('login-senha').value;

  try {
    const data = await fetchAPI('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, senha })
    });

    currentToken = data.token;
    currentUser = data.user;

    localStorage.setItem('helpdesk_token', currentToken);
    localStorage.setItem('helpdesk_user', JSON.stringify(currentUser));

    showToast('Login realizado com sucesso!', 'success');
    showAppScreen();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function logout() {
  currentToken = null;
  currentUser = null;
  localStorage.removeItem('helpdesk_token');
  localStorage.removeItem('helpdesk_user');

  viewApp.classList.remove('active');
  viewLogin.classList.add('active');
  formLogin.reset();
}

function showAppScreen() {
  viewLogin.classList.remove('active');
  viewApp.classList.add('active');

  userDisplayName.textContent = currentUser.nome;
  
  if (currentUser.role === 'admin') {
    userDisplayBadge.textContent = 'ADMIN';
    userDisplayBadge.className = 'badge badge-admin';
    dashboardTitle.textContent = 'Painel Geral de Chamados (Administrador)';
    document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hide'));
    loadUsersSelectForFilter();
  } else {
    userDisplayBadge.textContent = 'USUÁRIO';
    userDisplayBadge.className = 'badge badge-user';
    dashboardTitle.textContent = 'Meus Chamados';
    document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hide'));
  }

  loadTickets();
}

/* =========================================================
   GESTÃO E LISTAGEM DE TICKETS
   ========================================================= */
async function loadTickets() {
  ticketsLoading.classList.remove('hide');
  ticketsEmpty.classList.add('hide');
  ticketsList.innerHTML = '';

  const params = new URLSearchParams();
  if (filterStatus.value) params.append('status', filterStatus.value);
  if (filterTipo.value) params.append('tipo', filterTipo.value);
  if (filterDataInicio.value) params.append('data_inicio', filterDataInicio.value);
  if (filterDataFim.value) params.append('data_fim', filterDataFim.value);
  if (currentUser.role === 'admin' && filterUsuario.value) {
    params.append('usuario_id', filterUsuario.value);
  }

  try {
    const tickets = await fetchAPI(`/tickets?${params.toString()}`);
    ticketsLoading.classList.add('hide');

    if (!tickets || tickets.length === 0) {
      ticketsEmpty.classList.remove('hide');
      return;
    }

    tickets.forEach(ticket => {
      ticketsList.appendChild(createTicketCard(ticket));
    });
  } catch (err) {
    ticketsLoading.classList.add('hide');
    showToast('Erro ao carregar tickets: ' + err.message, 'error');
  }
}

function createTicketCard(ticket) {
  const card = document.createElement('div');
  card.className = 'ticket-card';
  card.onclick = () => openTicketDetails(ticket.id);

  const statusMap = {
    aberto: 'Aberto',
    em_andamento: 'Em Andamento',
    fechado: 'Fechado'
  };

  const dataFormatada = new Date(ticket.criado_em).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const solicitanteNome = ticket.usuario ? ticket.usuario.nome : 'Desconhecido';

  card.innerHTML = `
    <div>
      <div class="ticket-card-header">
        <span class="badge badge-${ticket.status}">${statusMap[ticket.status] || ticket.status}</span>
        <span class="badge badge-tipo">${ticket.tipo.toUpperCase()}</span>
      </div>
      <h3 class="ticket-title">${escapeHTML(ticket.titulo)}</h3>
      <p class="ticket-desc-preview">${escapeHTML(ticket.descricao)}</p>
    </div>
    <div class="ticket-card-footer">
      <span>Solicitante: <strong>${escapeHTML(solicitanteNome)}</strong></span>
      <span>${dataFormatada}</span>
    </div>
  `;

  return card;
}

function clearFilters() {
  filterStatus.value = '';
  filterTipo.value = '';
  filterDataInicio.value = '';
  filterDataFim.value = '';
  if (filterUsuario) filterUsuario.value = '';
  loadTickets();
}

async function handleCreateTicket(e) {
  e.preventDefault();
  const titulo = document.getElementById('ticket-titulo').value;
  const tipo = document.getElementById('ticket-tipo').value;
  const descricao = document.getElementById('ticket-descricao').value;

  try {
    await fetchAPI('/tickets', {
      method: 'POST',
      body: JSON.stringify({ titulo, tipo, descricao })
    });

    showToast('Ticket criado com sucesso!', 'success');
    formNewTicket.reset();
    closeModal(modalNewTicket);
    loadTickets();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* =========================================================
   DETALHES DO TICKET & COMENTÁRIOS / AUDITORIA
   ========================================================= */
async function openTicketDetails(ticketId) {
  currentTicketId = ticketId;
  openModal(modalTicketDetails);

  detailTicketTitulo.textContent = 'Carregando...';
  detailTicketDescricao.textContent = '';
  detailTicketHistorico.innerHTML = '<p class="text-muted">Buscando histórico...</p>';
  detailTicketComentarios.innerHTML = '<p class="text-muted">Buscando comentários...</p>';

  try {
    const ticket = await fetchAPI(`/tickets/${ticketId}`);

    const statusMap = { aberto: 'Aberto', em_andamento: 'Em Andamento', fechado: 'Fechado' };
    detailTicketBadge.textContent = statusMap[ticket.status] || ticket.status;
    detailTicketBadge.className = `badge badge-${ticket.status}`;

    detailTicketTitulo.textContent = ticket.titulo;
    detailTicketDescricao.textContent = ticket.descricao;
    detailTicketSolicitante.textContent = ticket.usuario ? `${ticket.usuario.nome} (${ticket.usuario.email})` : 'N/A';
    detailTicketTipo.textContent = ticket.tipo.toUpperCase();
    detailTicketData.textContent = new Date(ticket.criado_em).toLocaleString('pt-BR');
    detailTicketResponsavel.textContent = ticket.responsavel ? ticket.responsavel.nome : 'Pendente de Atribuição';

    // Renderizar histórico de auditoria (RF03.7)
    renderHistorico(ticket.historico);

    // Renderizar comentários (RF03.6)
    renderComentarios(ticket.comentarios);

  } catch (err) {
    showToast('Erro ao carregar detalhes: ' + err.message, 'error');
    closeModal(modalTicketDetails);
  }
}

function renderHistorico(historico) {
  detailTicketHistorico.innerHTML = '';

  if (!historico || historico.length === 0) {
    detailTicketHistorico.innerHTML = '<p class="text-muted"><small>Nenhum histórico registrado.</small></p>';
    return;
  }

  const statusMap = { aberto: 'Aberto', em_andamento: 'Em Andamento', fechado: 'Fechado' };

  historico.forEach(item => {
    const div = document.createElement('div');
    div.className = 'timeline-item';
    const dataHora = new Date(item.data).toLocaleString('pt-BR');
    const autor = item.usuario ? item.usuario.nome : 'Sistema';
    
    let textoAlteracao = item.status_anterior 
      ? `alterou o status de <strong>${statusMap[item.status_anterior] || item.status_anterior}</strong> para <strong>${statusMap[item.status_novo]}</strong>`
      : `abriu o chamado com status <strong>${statusMap[item.status_novo]}</strong>`;

    div.innerHTML = `
      <div><strong>${escapeHTML(autor)}</strong> ${textoAlteracao}</div>
      <div class="timeline-date">${dataHora}</div>
    `;
    detailTicketHistorico.appendChild(div);
  });
}

function renderComentarios(comentarios) {
  detailTicketComentarios.innerHTML = '';

  if (!comentarios || comentarios.length === 0) {
    detailTicketComentarios.innerHTML = '<p class="text-muted"><small>Nenhum comentário adicionado ainda.</small></p>';
    return;
  }

  comentarios.forEach(c => {
    const card = document.createElement('div');
    card.className = 'comment-card';

    const dataHora = new Date(c.criado_em).toLocaleString('pt-BR');
    const autorNome = c.usuario ? c.usuario.nome : 'Usuário';
    const autorBadge = c.usuario && c.usuario.role === 'admin' ? '<span class="badge badge-admin">Admin</span>' : '';

    card.innerHTML = `
      <div class="comment-header">
        <span><strong>${escapeHTML(autorNome)}</strong> ${autorBadge}</span>
        <span>${dataHora}</span>
      </div>
      <div class="comment-body">${escapeHTML(c.conteudo)}</div>
    `;
    detailTicketComentarios.appendChild(card);
  });
}

async function handleAddComment(e) {
  e.preventDefault();
  const conteudo = commentText.value.trim();
  if (!conteudo || !currentTicketId) return;

  try {
    await fetchAPI(`/tickets/${currentTicketId}/comentarios`, {
      method: 'POST',
      body: JSON.stringify({ conteudo })
    });

    commentText.value = '';
    showToast('Comentário enviado!', 'success');
    openTicketDetails(currentTicketId); // Recarrega os comentários
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function updateTicketStatus(ticketId, status) {
  try {
    await fetchAPI(`/tickets/${ticketId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });

    showToast('Status do ticket alterado com sucesso!', 'success');
    openTicketDetails(ticketId);
    loadTickets();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* =========================================================
   GESTÃO DE USUÁRIOS (ADMIN ONLY)
   ========================================================= */
async function loadUsersSelectForFilter() {
  try {
    const users = await fetchAPI('/users');
    filterUsuario.innerHTML = '<option value="">Todos os usuários</option>';
    users.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.id;
      opt.textContent = `${u.nome} (${u.email})`;
      filterUsuario.appendChild(opt);
    });
  } catch (e) {
    // Silencioso se der erro na carga inicial do filtro
  }
}

async function loadUsersList() {
  usersTableBody.innerHTML = '<tr><td colspan="5" class="text-muted">Carregando usuários...</td></tr>';

  try {
    const users = await fetchAPI('/users');
    usersTableBody.innerHTML = '';

    users.forEach(u => {
      const tr = document.createElement('tr');

      const isMe = u.id === currentUser.id;
      const isBloqueado = u.status === 'bloqueado';

      tr.innerHTML = `
        <td><strong>${escapeHTML(u.nome)}</strong> ${isMe ? '<small class="text-muted">(Você)</small>' : ''}</td>
        <td>${escapeHTML(u.email)}</td>
        <td><span class="badge badge-${u.role}">${u.role.toUpperCase()}</span></td>
        <td><span class="badge badge-${u.status}">${u.status.toUpperCase()}</span></td>
        <td>
          <button class="btn btn-outline-sm btn-edit-user" data-id="${u.id}" data-nome="${escapeHTML(u.nome)}" data-email="${escapeHTML(u.email)}" data-role="${u.role}">Editar</button>
          ${!isMe ? `
            <button class="btn btn-outline-sm btn-toggle-status" data-id="${u.id}" data-status="${isBloqueado ? 'ativo' : 'bloqueado'}">
              ${isBloqueado ? 'Desbloquear' : 'Bloquear'}
            </button>
            <button class="btn btn-danger-sm btn-delete-user" data-id="${u.id}">Excluir</button>
          ` : ''}
        </td>
      `;

      usersTableBody.appendChild(tr);
    });

    // Eventos da Tabela
    document.querySelectorAll('.btn-edit-user').forEach(b => {
      b.addEventListener('click', (e) => {
        const d = e.target.dataset;
        userEditId.value = d.id;
        userNome.value = d.nome;
        userEmail.value = d.email;
        userRole.value = d.role;
        userSenha.value = '';
        senhaHelp.classList.remove('hide');
        userFormTitle.textContent = 'Editar Usuário';
        btnCancelEditUser.classList.remove('hide');
      });
    });

    document.querySelectorAll('.btn-toggle-status').forEach(b => {
      b.addEventListener('click', async (e) => {
        const { id, status } = e.target.dataset;
        try {
          await fetchAPI(`/users/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
          });
          showToast(`Usuário ${status === 'bloqueado' ? 'bloqueado' : 'desbloqueado'} com sucesso!`, 'success');
          loadUsersList();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });

    document.querySelectorAll('.btn-delete-user').forEach(b => {
      b.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        if (!confirm('Tem certeza que deseja remover este usuário?')) return;
        try {
          await fetchAPI(`/users/${id}`, { method: 'DELETE' });
          showToast('Usuário removido com sucesso!', 'success');
          loadUsersList();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });

  } catch (err) {
    usersTableBody.innerHTML = `<tr><td colspan="5" class="text-muted">Erro ao carregar usuários: ${err.message}</td></tr>`;
  }
}

async function handleSaveUser(e) {
  e.preventDefault();
  const id = userEditId.value;
  const nome = userNome.value.trim();
  const email = userEmail.value.trim();
  const senha = userSenha.value.trim();
  const role = userRole.value;

  try {
    if (id) {
      // Edição
      const body = { nome, email, role };
      if (senha) body.senha = senha;

      await fetchAPI(`/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body)
      });
      showToast('Usuário atualizado com sucesso!', 'success');
    } else {
      // Criação
      if (!senha) {
        showToast('Senha é obrigatória para novos usuários.', 'error');
        return;
      }

      await fetchAPI('/users', {
        method: 'POST',
        body: JSON.stringify({ nome, email, senha, role })
      });
      showToast('Usuário cadastrado com sucesso!', 'success');
    }

    resetUserForm();
    loadUsersList();
    loadUsersSelectForFilter();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function resetUserForm() {
  userEditId.value = '';
  formAdminUser.reset();
  senhaHelp.classList.add('hide');
  userFormTitle.textContent = 'Cadastrar Novo Usuário';
  btnCancelEditUser.classList.add('hide');
}

/* =========================================================
   UTILITÁRIOS (MODAIS, TOAST, ESCAPE HTML)
   ========================================================= */
function openModal(modalEl) {
  modalEl.classList.remove('hide');
}

function closeModal(modalEl) {
  modalEl.classList.add('hide');
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4000);
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}
