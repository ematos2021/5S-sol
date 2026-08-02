// ============================================================================
//  Resumo Executivo por IA — Programa 5S + SOL
//
//  Por que isto existe: a chave do Gemini é cobrada por uso. Qualquer chave que
//  chegue ao navegador ou ao APK pode ser extraída em minutos, e `VITE_...` no
//  .env NÃO resolve — o Vite embute o valor no pacote final. A única forma de
//  ela não circular é ficar num servidor. É este arquivo.
//
//  O prompt também é montado aqui, de propósito: se o cliente mandasse texto
//  livre, esta função viraria um proxy gratuito de IA para quem tivesse a anon
//  key. Ela só aceita números de auditoria e devolve o resumo daquela auditoria.
//
//  Instalar (uma vez):
//    supabase secrets set GEMINI_API_KEY=AIza...
//    supabase functions deploy resumo-executivo
//
//  O app funciona sem isto — apenas o botão de resumo por IA fica indisponível.
// ============================================================================

const MODELO = 'gemini-2.5-flash';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const responder = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

interface Dimensao { num: string; nome: string; score: number | null }
interface Payload {
  area?: { planta?: string; fabrica?: string; setor?: string; maquina?: string };
  solar?: number | null;
  sensos?: Dimensao[];
  pilares?: Dimensao[];
  criticos?: string[];
  planos?: { total?: number; abertos?: number };
}

function montarPrompt(d: Payload): string {
  const a = d.area || {};
  const linha = (x: Dimensao[] = []) =>
    x.map(i => `${i.num} ${i.nome}: ${i.score != null ? i.score + '%' : 'n/a'}`).join('; ');
  const criticos = (d.criticos || []).slice(0, 40);   // teto: prompt não vira dissertação
  const p = d.planos || {};

  return `Você é o Assistente PRIME, especialista em 5S e segurança do trabalho de uma fábrica de eletrodomésticos (Grupo MK · Mondial). Escreva o RESUMO EXECUTIVO de uma auditoria integrada 5S + Programa SOL (Segurança, Organização, Limpeza), em português do Brasil, com tom OBJETIVO, TÉCNICO e IMPESSOAL. Escreva na 3ª pessoa, sem saudações, sem 1ª pessoa e sem exclamações. NÃO invente dados: use apenas os números abaixo.
Área: ${a.fabrica || ''} · ${a.setor || ''}${a.maquina ? ` · ${a.maquina}` : ''} (${a.planta || ''}).
Índice Solar: ${d.solar != null ? d.solar + '%' : 'sem leitura'} (média do 5S com o SOL).
Sensos 5S: ${linha(d.sensos)}.
Pilares SOL: ${linha(d.pilares)}.
Critérios críticos (nota ≤ 2): ${criticos.length ? criticos.join('; ') : 'nenhum'}.
Plano de ação: ${p.total || 0} ação(ões), ${p.abertos || 0} em aberto.
Estruture em 2 a 3 parágrafos curtos: (1) leitura geral do resultado e nível de maturidade; (2) pontos fortes e principais focos de atenção (priorizando Segurança quando frágil); (3) recomendação objetiva de próximos passos. Sem marcadores, títulos, listas ou markdown — apenas texto corrido em parágrafos separados por linha em branco. Máximo de 180 palavras.`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return responder({ erro: 'Use POST.' }, 405);

  const chave = Deno.env.get('GEMINI_API_KEY');
  if (!chave) {
    return responder({ erro: 'GEMINI_API_KEY não configurada. Rode: supabase secrets set GEMINI_API_KEY=...' }, 500);
  }

  let dados: Payload;
  try {
    dados = await req.json();
  } catch {
    return responder({ erro: 'Corpo inválido.' }, 400);
  }

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent?key=${chave}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: montarPrompt(dados) }] }] }),
      },
    );

    if (!r.ok) {
      // Não devolvemos o corpo do erro do Google: ele pode citar a chave.
      return responder({ erro: `A IA respondeu ${r.status}.` }, 502);
    }

    const json = await r.json();
    const texto = String(json?.candidates?.[0]?.content?.parts?.[0]?.text || '')
      .replace(/```/g, '')
      .trim();

    if (!texto) return responder({ erro: 'Resposta vazia da IA.' }, 502);
    return responder({ texto });
  } catch (e) {
    return responder({ erro: 'Falha ao falar com a IA: ' + (e as Error).message }, 502);
  }
});
