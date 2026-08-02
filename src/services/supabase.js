import { createClient } from '@supabase/supabase-js';

// ═══════════════════════════════════════════════════════════════════════════
//  Programa 5S + SOL — conexão com o Supabase.
//
//  As chaves saíram do código e passaram a viver no arquivo .env (que não vai
//  para o git). Para instalar em outro cliente: crie um projeto no Supabase,
//  rode database/schema.sql, copie .env.example para .env e preencha as duas
//  linhas. Nada mais precisa mudar.
//
//  A anon key aparecer no navegador é o desenho do Supabase — quem protege os
//  dados são as políticas do banco. A service_role JAMAIS entra aqui.
// ═══════════════════════════════════════════════════════════════════════════
const url = import.meta.env.VITE_SUPABASE_URL;
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigurado = Boolean(url && chave);

if (!supabaseConfigurado) {
    console.error('[5S+SOL] Faltam VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env — o app abre, mas não carrega nem salva nada.');
}

export const supabase = createClient(
    url || 'https://indisponivel.supabase.co',
    chave || 'chave-ausente'
);
