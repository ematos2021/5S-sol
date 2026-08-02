import { supabase } from './supabase';
import { SENSOS, SOL_PILARES } from '../data/cincoS';

/*
 * Resumo executivo por IA.
 *
 * A chamada ao Gemini acontece no servidor (Edge Function), não aqui — ver
 * supabase/functions/resumo-executivo/index.ts para o porquê. Deste lado só
 * saem os números da auditoria; nenhuma chave de API circula pelo aparelho.
 */

export class IAIndisponivel extends Error {}

export async function gerarResumoExecutivo(aud, sc, scSol, solar) {
  const dimensao = (lista, scores) => lista.map(d => ({
    num: d.num,
    nome: d.nome.includes('·') ? d.nome.split('·')[1].trim() : d.nome,
    score: scores[d.id] ?? null,
  }));

  const criticos = [...SENSOS, ...SOL_PILARES].flatMap(g => (g.itens || [])
    .filter(it => aud.respostas?.[it.id] != null && aud.respostas[it.id] <= 2)
    .map(it => `${it.label} (nota ${aud.respostas[it.id]}${aud.observacoes?.[it.id] ? ` — ${aud.observacoes[it.id]}` : ''})`));

  const planos = aud.planos || [];

  const { data, error } = await supabase.functions.invoke('resumo-executivo', {
    body: {
      area: { planta: aud.planta, fabrica: aud.fabrica, setor: aud.setor, maquina: aud.maquina },
      solar: solar ?? null,
      sensos: dimensao(SENSOS, sc),
      pilares: dimensao(SOL_PILARES, scSol),
      criticos,
      planos: { total: planos.length, abertos: planos.filter(p => p.status !== 'concluida').length },
    },
  });

  if (error) {
    // O caso mais comum é a função nem estar publicada ainda.
    throw new IAIndisponivel(
      'O resumo por IA ainda não está disponível. Publique a Edge Function "resumo-executivo" no Supabase (instruções no README).'
    );
  }
  if (data?.erro) throw new IAIndisponivel(data.erro);
  if (!data?.texto) throw new IAIndisponivel('A IA não devolveu texto.');

  return data.texto;
}
