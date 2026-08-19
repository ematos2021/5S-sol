import { SENSOS, SOL_PILARES } from '../data/cincoS';

/*
 * Assistente PRIME (Gemini AI) — Mesma integração dos módulos do PRIME.
 * Utiliza o modelo gemini-2.5-flash com fallback automático para gemini-1.5-flash.
 */

const DEFAULT_GEMINI_KEY = 'AIzaSyAXWmH7aEujQg9j2BiHnDlUz5HxPOKpt4E';

export class IAIndisponivel extends Error {}

function getApiKey() {
  return localStorage.getItem('mk_gemini_api_key') || DEFAULT_GEMINI_KEY;
}

export function montarPromptResumo5S(aud, sc, scSol, solar) {
  const linhas5S = SENSOS.map(s => `${s.num} ${s.nome.includes('·') ? s.nome.split('·')[1].trim() : s.nome}: ${sc[s.id] != null ? sc[s.id] + '%' : 'n/a'}`).join('; ');
  const linhasSOL = SOL_PILARES.map(p => `${p.num} ${p.nome}: ${scSol[p.id] != null ? scSol[p.id] + '%' : 'n/a'}`).join('; ');

  const criticos = [...SENSOS, ...SOL_PILARES].flatMap(g => (g.itens || [])
    .filter(it => !it.emAvaliacao && !it.desabilitado && aud.respostas?.[it.id] != null && aud.respostas[it.id] <= 2)
    .map(it => `${it.label} (nota ${aud.respostas[it.id]}${aud.observacoes?.[it.id] ? ` — ${aud.observacoes[it.id]}` : ''})`));

  const planos = aud.planos || [];

  return `Você é o Assistente PRIME, especialista em 5S e segurança do trabalho de uma fábrica de eletrodomésticos (Grupo MK · Mondial). Escreva o RESUMO EXECUTIVO de uma auditoria integrada 5S + Programa SOL (Segurança, Organização, Limpeza), em português do Brasil, com tom OBJETIVO, TÉCNICO e IMPESSOAL. Escreva na 3ª pessoa, sem saudações, sem 1ª pessoa e sem exclamações. NÃO invente dados: use apenas os números abaixo.
Área: ${aud.fabrica || ''} · ${aud.setor || ''}${aud.maquina ? ` · ${aud.maquina}` : ''} (${aud.planta || ''}).
Índice Solar: ${solar != null ? solar + '%' : 'sem leitura'} (média do 5S com o SOL).
Régua de pontuação: a escala 0–5 não é linear — nota 3 vale 45% do critério, nota 4 vale 72% e só a nota 5 vale 100%. Faixas: abaixo de 55% crítico, 55–74% em evolução, 75–89% em consolidação, 90%+ excelência.
Sensos 5S: ${linhas5S}.
Pilares SOL: ${linhasSOL}.
Critérios críticos (nota ≤ 2): ${criticos.length ? criticos.join('; ') : 'nenhum'}.
Plano de ação: ${planos.length} ação(ões), ${planos.filter(p => p.status !== 'concluida').length} em aberto.
Estruture em 2 a 3 parágrafos curtos: (1) leitura geral do resultado e nível de maturidade; (2) pontos fortes e principais focos de atenção (priorizando Segurança quando frágil); (3) recomendação objetiva de próximos passos. Sem marcadores, títulos, listas ou markdown — apenas texto corrido em parágrafos separados por linha em branco. Máximo de 180 palavras.`;
}

export async function gerarResumoExecutivo(aud, sc, scSol, solar) {
  const apiKey = getApiKey();
  if (!apiKey) throw new IAIndisponivel('Chave de API do Gemini não configurada.');

  const prompt = montarPromptResumo5S(aud, sc, scSol, solar);
  const models = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-flash-latest'];

  let ultimoErro = null;

  for (const model of models) {
    try {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 600,
          }
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => null);
        ultimoErro = new Error(errData?.error?.message || `Erro HTTP ${resp.status} (${model})`);
        continue;
      }

      const resJson = await resp.json();
      let texto = resJson?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      texto = texto.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();

      if (texto) {
        return texto;
      }
    } catch (err) {
      ultimoErro = err;
    }
  }

  throw new IAIndisponivel(ultimoErro?.message || 'Falha ao comunicar com a IA do Gemini. Verifique a conexão com a internet.');
}
