-- ════════════════════════════════════════════════════════════════════════
--  Programa 5S + SOL — liga o acesso por login (Supabase Auth).
--  Rode no SQL Editor do projeto que JÁ existe (não apaga dados).
--  Depois: Authentication → Users → Add user, com "Auto Confirm User":
--     eugenio@5s-sol.app   e   pedro@5s-sol.app   (senha à sua escolha)
--  No app, entra-se com "eugenio" / "pedro" e essa senha.
-- ════════════════════════════════════════════════════════════════════════
alter table public.cadastro_planta_area enable row level security;
alter table public.cinco_s_auditoria   enable row level security;

-- A chave pública (vai dentro do APK) não abre nada sozinha.
revoke all on public.cadastro_planta_area from anon;
revoke all on public.cinco_s_auditoria   from anon;
-- Desfaz a contingência (contingencia_abrir_anon.sql), se tiver sido aberta.
drop policy if exists area_anon_contingencia on public.cadastro_planta_area;
drop policy if exists aud_anon_contingencia on public.cinco_s_auditoria;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.cadastro_planta_area to authenticated;
grant select, insert, update, delete on public.cinco_s_auditoria   to authenticated;
grant usage, select on all sequences in schema public to authenticated;

drop policy if exists area_all on public.cadastro_planta_area;
create policy area_all on public.cadastro_planta_area for all to authenticated using (true) with check (true);

drop policy if exists aud_all on public.cinco_s_auditoria;
create policy aud_all on public.cinco_s_auditoria for all to authenticated using (true) with check (true);

notify pgrst, 'reload schema';
