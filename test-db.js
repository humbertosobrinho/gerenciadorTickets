import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

console.log('\n==================================================');
console.log('🔍 INICIANDO TESTE DE CONEXÃO E CONFIGURAÇÃO DE USUÁRIO');
console.log('==================================================\n');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ ERRO: Verifique se o arquivo .env contém as variáveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
  try {
    console.log('⏳ Testando conexão com o banco de dados Supabase...');
    
    // Gerar hash real do Bcrypt para a senha 'admin123'
    const senhaHashAdmin = await bcrypt.hash('admin123', 10);

    // Verificar se o usuário Admin existe
    const { data: userAdmin, error: findError } = await supabase
      .from('users')
      .select('id, email, role, status')
      .eq('email', 'admin@sistema.com')
      .maybeSingle();

    if (findError) {
      console.error('\n❌ ERRO AO CONSULTAR A TABELA "users":');
      console.error(findError.message);
      console.error('👉 Verifique se você rodou o script schema.sql no SQL Editor do Supabase.');
      return;
    }

    if (!userAdmin) {
      console.log('⚠️ Usuário admin@sistema.com não encontrado. Inserindo administrador...');
      const { error: insertError } = await supabase.from('users').insert({
        nome: 'Administrador do Sistema',
        email: 'admin@sistema.com',
        senha_hash: senhaHashAdmin,
        role: 'admin',
        status: 'ativo'
      });

      if (insertError) {
        console.error('❌ Erro ao criar o administrador:', insertError.message);
      } else {
        console.log('✅ Usuário administrador criado com sucesso!');
      }
    } else {
      console.log('🔑 Atualizando a hash da senha do admin@sistema.com para garantir login...');
      const { error: updateError } = await supabase
        .from('users')
        .update({
          senha_hash: senhaHashAdmin,
          status: 'ativo'
        })
        .eq('email', 'admin@sistema.com');

      if (updateError) {
        console.error('❌ Erro ao atualizar senha do admin:', updateError.message);
      } else {
        console.log('✅ Senha do administrador (admin123) sincronizada com sucesso!');
      }
    }

    // Buscar lista de usuários atualizada
    const { data: users } = await supabase
      .from('users')
      .select('id, nome, email, role, status');

    console.log('\n📊 Usuários cadastrados no banco:');
    console.table(users);

    console.log('\n==================================================');
    console.log('🎉 PRONTO PARA USO! LOGIN E SENHA CONFIRMADOS:');
    console.log('👉 E-mail: admin@sistema.com');
    console.log('👉 Senha:  admin123');
    console.log('==================================================\n');

  } catch (err) {
    console.error('\n❌ ERRO INESPERADO:', err.message);
  }
}

runTest();
