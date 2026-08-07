-- =========================================================
-- SCRIPT DE CRIAÇÃO DO BANCO DE DADOS - HELP DESK TICKETS
-- Supabase / PostgreSQL
-- =========================================================

-- 1. CRIAÇÃO DOS ENUMS
CREATE TYPE user_role AS ENUM ('admin', 'user');
CREATE TYPE user_status AS ENUM ('ativo', 'bloqueado');
CREATE TYPE ticket_tipo AS ENUM ('hardware', 'software');
CREATE TYPE ticket_status AS ENUM ('aberto', 'em_andamento', 'fechado');

-- 2. CRIAÇÃO DA TABELA USERS
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    senha_hash TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'user',
    status user_status NOT NULL DEFAULT 'ativo',
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. CRIAÇÃO DA TABELA TICKETS
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT NULL,
    descricao TEXT NOT NULL,
    tipo ticket_tipo NOT NULL,
    status ticket_status NOT NULL DEFAULT 'aberto',
    usuario_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    responsavel_id UUID REFERENCES users(id) ON DELETE SET NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    fechado_em TIMESTAMPTZ
);

-- 4. CRIAÇÃO DA TABELA TICKET_HISTORICO (AUDITORIA - RF03.7)
CREATE TABLE IF NOT EXISTS ticket_historico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status_anterior TEXT,
    status_novo TEXT NOT NULL,
    data TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. CRIAÇÃO DA TABELA TICKET_COMENTARIOS (RF03.6)
CREATE TABLE IF NOT EXISTS ticket_comentarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conteudo TEXT NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. ÍNDICES PARA OTIMIZAÇÃO DE BUSCAS E FILTROS (RF04)
CREATE INDEX IF NOT EXISTS idx_tickets_usuario ON tickets(usuario_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_tipo ON tickets(tipo);
CREATE INDEX IF NOT EXISTS idx_tickets_criado_em ON tickets(criado_em);
CREATE INDEX IF NOT EXISTS idx_ticket_historico_ticket ON ticket_historico(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comentarios_ticket ON ticket_comentarios(ticket_id);

-- 7. HABILITAR ROW LEVEL SECURITY (RLS - RNF05)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comentarios ENABLE ROW LEVEL SECURITY;

-- 8. TRIGGER PARA ATUALIZAÇÃO AUTOMÁTICA DE DATAS (atualizado_em / fechado_em)
CREATE OR REPLACE FUNCTION trg_update_ticket_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = now();
    
    IF NEW.status = 'fechado' AND OLD.status IS DISTINCT FROM 'fechado' THEN
        NEW.fechado_em = now();
    ELSIF NEW.status IS DISTINCT FROM 'fechado' THEN
        NEW.fechado_em = NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_ticket_timestamps_trigger ON tickets;
CREATE TRIGGER update_ticket_timestamps_trigger
BEFORE UPDATE ON tickets
FOR EACH ROW
EXECUTE FUNCTION trg_update_ticket_timestamps();

-- 9. INSERÇÃO DO USUÁRIO ADMINISTRADOR INICIAL (SEED)
-- Email: admin@sistema.com | Senha: admin123
INSERT INTO users (nome, email, senha_hash, role, status)
VALUES (
    'Administrador do Sistema',
    'admin@sistema.com',
    '$2b$10$wE68vX1PkWJ2fC5A6y1KROr9G8yT4oX5dY1zQ5eR6tY7uI8oP9aSa',
    'admin',
    'ativo'
)
ON CONFLICT (email) DO NOTHING;
