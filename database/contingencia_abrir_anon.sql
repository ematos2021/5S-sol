-- ════════════════════════════════════════════════════════════════════════
--  CONTINGÊNCIA — devolve o acesso à chave pública (anon), como era antes.
--  Serve para o APK antigo dos tablets voltar a funcionar enquanto o site
--  novo não está publicado. O login por Supabase Auth continua funcionando.
--  RISCO: enquanto estiver aberto, quem tiver a chave (está dentro do APK)
--  lê, altera e apaga tudo. Fechar com acesso_login.sql assim que der.
-- ════════════════════════════════════════════════════════════════════════
grant usage on schema public to anon;
grant select, insert, update, delete on public.cadastro_planta_area to anon;
grant select, insert, update, delete on public.cinco_s_auditoria   to anon;
grant usage, select on all sequences in schema public to anon;

drop policy if exists area_anon_contingencia on public.cadastro_planta_area;
create policy area_anon_contingencia on public.cadastro_planta_area for all to anon using (true) with check (true);

drop policy if exists aud_anon_contingencia on public.cinco_s_auditoria;
create policy aud_anon_contingencia on public.cinco_s_auditoria for all to anon using (true) with check (true);

notify pgrst, 'reload schema';
