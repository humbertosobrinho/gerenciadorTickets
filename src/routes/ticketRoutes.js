import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { authenticateToken, requireRole } from '../middlewares/auth.js';
import { validateBody } from '../middlewares/validate.js';

const router = Router();

// Todas as rotas de tickets requerem usuário autenticado
router.use(authenticateToken);

const createTicketSchema = z.object({
  titulo: z.string().min(3, 'O título deve ter pelo menos 3 caracteres.'),
  descricao: z.string().min(5, 'A descrição deve ter pelo menos 5 caracteres.'),
  tipo: z.enum(['hardware', 'software'], { required_error: 'Selecione o tipo do ticket.' })
});

const updateStatusSchema = z.object({
  status: z.enum(['aberto', 'em_andamento', 'fechado'], { required_error: 'Status inválido.' }),
  responsavel_id: z.string().uuid().optional().nullable()
});

const createCommentSchema = z.object({
  conteudo: z.string().min(1, 'O comentário não pode ser vazio.')
});

// GET /tickets - Listar tickets (RF03.2, RF03.3, RF04.1, RF04.2)
router.get('/', async (req, res) => {
  try {
    const { status, tipo, data_inicio, data_fim, usuario_id } = req.query;

    let query = supabase
      .from('tickets')
      .select(`
        id,
        titulo,
        descricao,
        tipo,
        status,
        criado_em,
        atualizado_em,
        fechado_em,
        usuario:users!tickets_usuario_id_fkey(id, nome, email),
        responsavel:users!tickets_responsavel_id_fkey(id, nome, email)
      `)
      .order('criado_em', { ascending: false });

    // Regra de perfil: Usuário comum visualiza apenas os tickets criados por ele
    if (req.user.role !== 'admin') {
      query = query.eq('usuario_id', req.user.id);
    } else if (usuario_id) {
      // Admin pode filtrar por usuario_id solicitante (RF04.2)
      query = query.eq('usuario_id', usuario_id);
    }

    // Filtros adicionais (RF04.1)
    if (status) {
      query = query.eq('status', status);
    }
    if (tipo) {
      query = query.eq('tipo', tipo);
    }
    if (data_inicio) {
      query = query.gte('criado_em', new Date(data_inicio).toISOString());
    }
    if (data_fim) {
      // Ajustar data fim para o final do dia
      const dateEnd = new Date(data_fim);
      dateEnd.setHours(23, 59, 59, 999);
      query = query.lte('criado_em', dateEnd.toISOString());
    }

    const { data: tickets, error } = await query;
    if (error) throw error;

    return res.json(tickets);
  } catch (err) {
    console.error('Erro ao buscar tickets:', err);
    return res.status(500).json({ error: 'Erro ao carregar lista de tickets.' });
  }
});

// POST /tickets - Criar ticket (RF03.1)
router.post('/', validateBody(createTicketSchema), async (req, res) => {
  try {
    const { titulo, descricao, tipo } = req.body;

    const { data: newTicket, error } = await supabase
      .from('tickets')
      .insert({
        titulo,
        descricao,
        tipo,
        status: 'aberto',
        usuario_id: req.user.id
      })
      .select(`
        *,
        usuario:users!tickets_usuario_id_fkey(id, nome, email)
      `)
      .single();

    if (error) throw error;

    // Registrar histórico inicial (Abertura do Ticket)
    await supabase.from('ticket_historico').insert({
      ticket_id: newTicket.id,
      usuario_id: req.user.id,
      status_anterior: null,
      status_novo: 'aberto'
    });

    return res.status(201).json({ message: 'Ticket criado com sucesso.', ticket: newTicket });
  } catch (err) {
    console.error('Erro ao criar ticket:', err);
    return res.status(500).json({ error: 'Erro ao registrar novo ticket.' });
  }
});

// GET /tickets/:id - Detalhes do ticket, comentários e histórico de auditoria
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: ticket, error } = await supabase
      .from('tickets')
      .select(`
        *,
        usuario:users!tickets_usuario_id_fkey(id, nome, email),
        responsavel:users!tickets_responsavel_id_fkey(id, nome, email)
      `)
      .eq('id', id)
      .single();

    if (error || !ticket) {
      return res.status(404).json({ error: 'Ticket não encontrado.' });
    }

    // Verificar se o usuário comum é dono do ticket
    if (req.user.role !== 'admin' && ticket.usuario_id !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado: Você só pode visualizar seus próprios tickets.' });
    }

    // Buscar Comentários
    const { data: comentarios } = await supabase
      .from('ticket_comentarios')
      .select(`
        id,
        conteudo,
        criado_em,
        usuario:users(id, nome, email, role)
      `)
      .eq('ticket_id', id)
      .order('criado_em', { ascending: true });

    // Buscar Histórico de Auditoria (RF03.7)
    const { data: historico } = await supabase
      .from('ticket_historico')
      .select(`
        id,
        status_anterior,
        status_novo,
        data,
        usuario:users(id, nome, email, role)
      `)
      .eq('ticket_id', id)
      .order('data', { ascending: true });

    return res.json({
      ...ticket,
      comentarios: comentarios || [],
      historico: historico || []
    });
  } catch (err) {
    console.error('Erro ao buscar detalhes do ticket:', err);
    return res.status(500).json({ error: 'Erro ao carregar detalhes do ticket.' });
  }
});

// PATCH /tickets/:id/status - Alterar status do ticket (Somente Admin - RF03.4, RF03.5, RF03.7)
router.patch('/:id/status', requireRole(['admin']), validateBody(updateStatusSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, responsavel_id } = req.body;

    // Obter estado atual do ticket
    const { data: ticketAtual, error: fetchError } = await supabase
      .from('tickets')
      .select('status, responsavel_id')
      .eq('id', id)
      .single();

    if (fetchError || !ticketAtual) {
      return res.status(404).json({ error: 'Ticket não encontrado.' });
    }

    const updates = { status };
    if (responsavel_id !== undefined) {
      updates.responsavel_id = responsavel_id;
    } else if (!ticketAtual.responsavel_id) {
      // Se ainda não tiver responsável, atribui o admin logado
      updates.responsavel_id = req.user.id;
    }

    const { data: ticketAtualizado, error: updateError } = await supabase
      .from('tickets')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        usuario:users!tickets_usuario_id_fkey(id, nome, email),
        responsavel:users!tickets_responsavel_id_fkey(id, nome, email)
      `)
      .single();

    if (updateError) throw updateError;

    // Registrar no histórico de auditoria se houver alteração de status (RF03.7)
    if (ticketAtual.status !== status) {
      await supabase.from('ticket_historico').insert({
        ticket_id: id,
        usuario_id: req.user.id,
        status_anterior: ticketAtual.status,
        status_novo: status
      });
    }

    return res.json({ message: 'Status do ticket atualizado com sucesso.', ticket: ticketAtualizado });
  } catch (err) {
    console.error('Erro ao alterar status do ticket:', err);
    return res.status(500).json({ error: 'Erro ao atualizar status do ticket.' });
  }
});

// POST /tickets/:id/comentarios - Adicionar comentário (RF03.6)
router.post('/:id/comentarios', validateBody(createCommentSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { conteudo } = req.body;

    const { data: ticket } = await supabase
      .from('tickets')
      .select('id, usuario_id, status')
      .eq('id', id)
      .single();

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket não encontrado.' });
    }

    // Permissão: usuário comum só pode comentar no próprio ticket
    if (req.user.role !== 'admin' && ticket.usuario_id !== req.user.id) {
      return res.status(403).json({ error: 'Você só pode adicionar comentários em seus próprios tickets.' });
    }

    const { data: novoComentario, error } = await supabase
      .from('ticket_comentarios')
      .insert({
        ticket_id: id,
        usuario_id: req.user.id,
        conteudo
      })
      .select(`
        id,
        conteudo,
        criado_em,
        usuario:users(id, nome, email, role)
      `)
      .single();

    if (error) throw error;

    return res.status(201).json({ message: 'Comentário adicionado com sucesso.', comentario: novoComentario });
  } catch (err) {
    console.error('Erro ao adicionar comentário:', err);
    return res.status(500).json({ error: 'Erro ao salvar comentário.' });
  }
});

export default router;
