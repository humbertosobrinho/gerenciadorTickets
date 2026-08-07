import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { validateBody } from '../middlewares/validate.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email('E-mail com formato inválido.'),
  senha: z.string().min(1, 'A senha é obrigatória.')
});

// POST /auth/login
router.post('/login', validateBody(loginSchema), async (req, res) => {
  try {
    const { email, senha } = req.body;

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    if (user.status === 'bloqueado') {
      return res.status(403).json({ error: 'Usuário bloqueado. Entre em contato com o suporte.' });
    }

    const passwordMatches = await bcrypt.compare(senha, user.senha_hash);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    const secret = process.env.JWT_SECRET || 'fallback_secret_change_me';
    const expiresIn = process.env.JWT_EXPIRES_IN || '8h';

    const token = jwt.sign(
      {
        id: user.id,
        nome: user.nome,
        email: user.email,
        role: user.role
      },
      secret,
      { expiresIn }
    );

    return res.json({
      message: 'Login realizado com sucesso.',
      token,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });
  } catch (err) {
    console.error('Erro no login:', err);
    return res.status(500).json({ error: 'Erro interno ao realizar login.' });
  }
});

// POST /auth/refresh
router.post('/refresh', authenticateToken, async (req, res) => {
  try {
    const secret = process.env.JWT_SECRET || 'fallback_secret_change_me';
    const expiresIn = process.env.JWT_EXPIRES_IN || '8h';

    const token = jwt.sign(
      {
        id: req.user.id,
        nome: req.user.nome,
        email: req.user.email,
        role: req.user.role
      },
      secret,
      { expiresIn }
    );

    return res.json({ token, user: req.user });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao renovar o token.' });
  }
});

export default router;
