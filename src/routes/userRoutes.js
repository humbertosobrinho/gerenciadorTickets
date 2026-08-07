import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { authenticateToken, requireRole } from '../middlewares/auth.js';
import { validateBody } from '../middlewares/validate.js';

const router = Router();

// Todas as rotas de usuário requerem autenticação e nível 'admin'
router.use(authenticateToken, requireRole(['admin']));

const createUserSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres.'),
  email: z.string().email('E-mail inválido.'),
  senha: z.string().min(6, 'A senha deve ter no mínimo 6 caracteres.'),
  role: z.enum(['admin', 'user']).default('user')
});

const updateUserSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres.').optional(),
  email: z.string().email('E-mail inválido.').optional(),
  senha: z.string().min(6, 'A senha deve ter no mínimo 6 caracteres.').optional(),
  role: z.enum(['admin', 'user']).optional()
});

const statusSchema = z.object({
  status: z.enum(['ativo', 'bloqueado'])
});

// GET /users - RF02.4
router.get('/', async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, nome, email, role, status, criado_em')
      .order('criado_em', { ascending: false });

    if (error) throw error;
    return res.json(users);
  } catch (err) {
    console.error('Erro ao listar usuários:', err);
    return res.status(500).json({ error: 'Erro ao buscar lista de usuários.' });
  }
});

// POST /users - RF02.1
router.post('/', validateBody(createUserSchema), async (req, res) => {
  try {
    const { nome, email, senha, role } = req.body;

    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (existingUser) {
      return res.status(400).json({ error: 'Já existe um usuário cadastrado com este e-mail.' });
    }

    const saltRounds = 10; // RNF02 (mínimo 10)
    const senha_hash = await bcrypt.hash(senha, saltRounds);

    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        nome,
        email: email.toLowerCase().trim(),
        senha_hash,
        role: role || 'user',
        status: 'ativo'
      })
      .select('id, nome, email, role, status, criado_em')
      .single();

    if (error) throw error;

    return res.status(201).json({ message: 'Usuário cadastrado com sucesso.', user: newUser });
  } catch (err) {
    console.error('Erro ao criar usuário:', err);
    return res.status(500).json({ error: 'Erro ao cadastrar novo usuário.' });
  }
});

// PUT /users/:id - RF02.5
router.put('/:id', validateBody(updateUserSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, email, senha, role } = req.body;

    const updates = {};
    if (nome) updates.nome = nome;
    if (email) updates.email = email.toLowerCase().trim();
    if (role) updates.role = role;
    if (senha) {
      updates.senha_hash = await bcrypt.hash(senha, 10);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Nenhum campo fornecido para atualização.' });
    }

    const { data: updatedUser, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select('id, nome, email, role, status, criado_em')
      .single();

    if (error) throw error;
    if (!updatedUser) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    return res.json({ message: 'Usuário atualizado com sucesso.', user: updatedUser });
  } catch (err) {
    console.error('Erro ao editar usuário:', err);
    return res.status(500).json({ error: 'Erro ao atualizar dados do usuário.' });
  }
});

// PATCH /users/:id/status - RF02.3
router.patch('/:id/status', validateBody(statusSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (req.user.id === id && status === 'bloqueado') {
      return res.status(400).json({ error: 'Você não pode bloquear sua própria conta de administrador.' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .update({ status })
      .eq('id', id)
      .select('id, nome, email, role, status')
      .single();

    if (error) throw error;
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    return res.json({ message: `Usuário ${status === 'bloqueado' ? 'bloqueado' : 'desbloqueado'} com sucesso.`, user });
  } catch (err) {
    console.error('Erro ao alterar status do usuário:', err);
    return res.status(500).json({ error: 'Erro ao alterar status do usuário.' });
  }
});

// DELETE /users/:id - RF02.2
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.id === id) {
      return res.status(400).json({ error: 'Você não pode excluir sua própria conta de administrador.' });
    }

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return res.json({ message: 'Usuário removido com sucesso.' });
  } catch (err) {
    console.error('Erro ao remover usuário:', err);
    return res.status(500).json({ error: 'Erro ao remover usuário.' });
  }
});

export default router;
