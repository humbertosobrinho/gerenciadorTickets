import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase.js';

export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ error: 'Token de autenticação não fornecido.' });
  }

  try {
    const secret = process.env.JWT_SECRET || 'fallback_secret_change_me';
    const decoded = jwt.verify(token, secret);

    // Buscar status do usuário no banco para garantir que não foi bloqueado recentemente
    const { data: user, error } = await supabase
      .from('users')
      .select('id, nome, email, role, status')
      .eq('id', decoded.id)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Usuário não encontrado ou token inválido.' });
    }

    if (user.status === 'bloqueado') {
      return res.status(403).json({ error: 'Sua conta está bloqueada. Entre em contato com o administrador.' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
    }
    return res.status(401).json({ error: 'Token inválido ou corrompido.' });
  }
};

export const requireRole = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Usuário não autenticado.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso negado: Você não possui permissão para esta ação.' });
    }

    next();
  };
};
