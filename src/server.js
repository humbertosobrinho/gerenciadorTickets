import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import ticketRoutes from './routes/ticketRoutes.js';
import { supabase } from './config/supabase.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middlewares globais
app.use(cors());
app.use(express.json());

// Servir arquivos estáticos do Frontend
app.use(express.static(path.join(__dirname, '../public')));

// Rotas da API
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/tickets', ticketRoutes);

// Rota de Health Check / Info
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'Helpdesk Tickets API'
  });
});

// Rota para Testar Conexão com o Banco do Supabase
app.get('/api/test-db', async (req, res) => {
  try {
    const { data: users, error } = await supabase.from('users').select('id, nome, email, role, status').limit(5);
    if (error) {
      return res.status(500).json({
        sucesso: false,
        mensagem: 'Erro ao comunicar com o Supabase. Verifique se executou o script schema.sql no SQL Editor do Supabase.',
        erro: error.message
      });
    }
    return res.json({
      sucesso: true,
      mensagem: '✅ Conexão com o Supabase estabelecida com sucesso!',
      totalUsuariosEncontrados: users ? users.length : 0,
      usuarios: users
    });
  } catch (err) {
    return res.status(500).json({
      sucesso: false,
      mensagem: 'Falha na conexão.',
      erro: err.message
    });
  }
});

// Middleware Global de Tratamento de Erros e Logs (RNF09)
app.use((err, req, res, next) => {
  console.error(`[ERROR LOG ${new Date().toISOString()}] ${req.method} ${req.url}:`, err.stack || err);
  res.status(500).json({ error: 'Erro interno no servidor.' });
});

// Inicialização do Servidor
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 Servidor Helpdesk rodando na porta: ${PORT}`);
  console.log(`🌐 Acesse o frontend em: http://localhost:${PORT}`);
  console.log(`==================================================`);
});
