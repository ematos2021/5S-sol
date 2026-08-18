// ════════════════════════════════════════════════════════════════════════
//  Programa 5S — definição dos sensos, critérios e escala de avaliação.
//  Escala ancorada 0–5 por critério; score do senso = média × 20 (0–100%).
//  Conteúdo autoral do PRIME, baseado nos conceitos clássicos do 5S.
// ════════════════════════════════════════════════════════════════════════

export const ESCALA_5S = [
    { nota: 0, rotulo: 'Inexistente', desc: 'Nenhuma prática observada; condição crítica.' },
    { nota: 1, rotulo: 'Inicial', desc: 'Prática esporádica, sem método definido.' },
    { nota: 2, rotulo: 'Básico', desc: 'Há iniciativa, mas com falhas visíveis e recorrentes.' },
    { nota: 3, rotulo: 'Definido', desc: 'Padrão existe e é seguido na maior parte do tempo.' },
    { nota: 4, rotulo: 'Gerenciado', desc: 'Padrão consolidado, medido e corrigido quando foge.' },
    { nota: 5, rotulo: 'Excelência', desc: 'Referência: melhoria contínua e autonomia da equipe.' },
];

export const SENSOS = [
    {
        id: 'seiri', num: '1S', nome: 'Seiri · Utilização', cor: '#3B82F6',
        conceito: 'Separar o necessário do desnecessário e descartar o que não agrega.',
        itens: [
            { id: 's1_uteis', label: 'Somente itens necessários na área', desc: 'Materiais, ferramentas e equipamentos presentes são usados na rotina da máquina; nada obsoleto ou em excesso no posto.' },
            { id: 's1_descarte', label: 'Tratamento de itens sem uso / descarte', desc: 'Lixeira próxima à atividade que está sendo executada, não transbordando.' },
            { id: 's1_estoque', label: 'Quantidades adequadas no posto', desc: 'Estoques no posto da máquina limitados ao necessário do período.' },
            { id: 's1_info', label: 'Documentos e informações vigentes', desc: 'ITs, procedimentos e documentos de referência da máquina estão atualizados e acessíveis no posto de trabalho.' },
        ],
    },
    {
        id: 'seiton', num: '2S', nome: 'Seiton · Organização', cor: '#16A34A',
        conceito: 'Um lugar para cada coisa e cada coisa em seu lugar, com acesso rápido.',
        itens: [
            { id: 's2_demarcacao', label: 'Demarcações e endereços visuais', desc: 'Pisos, prateleiras e bancadas ao redor da Máquina/Linha demarcados; endereços identificados e legíveis.' },
            { id: 's2_ferramentas', label: 'Ferramentas com local definido', desc: 'Cada ferramenta tem posição própria (sombra/suporte) na máquina e retorna ao lugar após o uso.' },
            { id: 's2_acesso', label: 'Itens de uso frequente à mão', desc: 'Disposição segue a frequência de uso na linha; nada exige deslocamento ou procura excessiva pelo operador.' },
            { id: 's2_desobstrucao', label: 'Área ao redor da máquina desobstruída', desc: 'Área ao redor da máquina livre de obstruções; rotas de abastecimento e descarga desobstruídas no entorno imediato da linha.' },
        ],
    },
    {
        id: 'seiso', num: '3S', nome: 'Seiso · Limpeza', cor: '#D97706',
        conceito: 'Limpar é inspecionar: eliminar sujeira e atacar suas fontes.',
        itens: [
            { id: 's3_area', label: 'Área e equipamentos limpos', desc: 'Máquina, bancadas e piso no entorno imediato sem sujeira, óleo, rebarbas ou resíduos acumulados.' },
            { id: 's3_rotina', label: 'Rotina de limpeza da máquina cumprida', desc: 'Checklist de limpeza da máquina é visível no posto e preenchido conforme frequência definida através do FR.284 Escala de Limpeza.' },
            { id: 's3_fontes', label: 'Fontes de sujeira tratadas', desc: 'Vazamentos e geradores de sujeira na máquina identificados e com ação corretiva em andamento (não apenas limpeza repetida). Obs. Perguntar ao operador se tem algo que gere sujeira com frequência, caso sim, pedir o numeração da Nota ao líder/supervisor.' },
            { id: 's3_recursos', label: 'Recursos de limpeza disponíveis e organizados', desc: 'Panos, vassouras, rodos, pás e demais itens necessários identificados, em bom estado e em local padronizado e de acesso aos colaboradores do posto.' },
        ],
    },
    {
        id: 'seiketsu', num: '4S', nome: 'Seiketsu · Padronização', cor: '#8B5CF6',
        conceito: 'Transformar os 3 primeiros sensos em padrão visual e replicável.',
        itens: [
            { id: 's4_padroes', label: 'Padrões visuais do posto', desc: 'Fotos de condição-padrão e critérios claros do \'certo\' visíveis no posto da máquina através do FR.285 - Condição padrão.' },
            { id: 's4_operacao', label: 'Padrão de operação visível na máquina', desc: 'Parâmetros técnicos de processo e configurações visíveis na máquina/linha. Pessoa pertinente consegue comparar o estado atual com o padrão definido.' },
            { id: 's4_ergonomia', label: 'Ergonomia', desc: 'Ergonomia do posto avaliada conforme mapa postural.' },
        ],
    },
    {
        id: 'shitsuke', num: '5S', nome: 'Shitsuke · Disciplina', cor: '#DC2626',
        conceito: 'Sustentar: hábito, cumprimento espontâneo e melhoria contínua.',
        itens: [
            { id: 's5_espontaneo', label: 'Cumprimento espontâneo dos padrões', desc: 'Colaboradores seguem os padrões do 5S/SOL espontaneamente (observação direta: organização, limpeza e disciplina no posto da máquina).' },
            { id: 's5_acoes_ant', label: 'Cumprimento das ações de auditorias anteriores', desc: 'Plano de ação de auditorias anteriores realizados. (Verificar relatórios antigos)' },
            { id: 's5_equipe', label: 'Equipe conhece e participa do 5S/SOL', desc: 'Operadores demonstram conhecimento do 5S/SOL (entrevista rápida no posto) e conseguem apontar participação em melhorias recentes.' },
            { id: 's5_melhorias', label: 'Melhorias da linha visíveis e atualizadas', desc: 'Quadro de sugestões/kaizens da linha visível no posto ; operador consegue apontar melhorias.' },
        ],
    },
];

// ════════════════════════════════════════════════════════════════════════
//  Programa SOL — Segurança · Organização · Limpeza (integrado ao 5S).
//  "O sol vai nascer na Mondial." Mesma escala de maturidade 0–5.
//  Os 3 pilares são os "raios do sol"; juntos ao 5S formam o Índice Solar.
//  Foco no que o 5S toca de leve — sobretudo a Segurança das pessoas.
// ════════════════════════════════════════════════════════════════════════
export const SOL_PILARES = [
    {
        id: 'sol_seg', num: 'S', letra: 'S', nome: 'Segurança', cor: '#F97316',
        conceito: 'Proteger pessoas: o sol só nasce onde é seguro trabalhar.',
        itens: [
            { id: 'sol_seg_epi', label: 'EPIs adequados e em uso', desc: 'EPIs necessários disponíveis no posto, em bom estado e usados corretamente pelos operadores da máquina.' },
            { id: 'sol_seg_riscos', label: 'Riscos e EPIs da máquina sinalizados', desc: 'Mapa de EPIs e riscos da máquina visível no posto; sinalização de perigo na máquina e entorno imediato identificada.' },
            { id: 'sol_seg_dispositivos', label: 'Dispositivos de segurança ativos', desc: 'Proteções, sensores e botões de emergência da máquina presentes, testados e funcionando.' },
        ],
    },
    {
        id: 'sol_org', num: 'O', letra: 'O', nome: 'Organização', cor: '#F59E0B',
        conceito: 'Ordem visível que faz o trabalho fluir com clareza e ritmo.',
        itens: [
            { id: 'sol_org_indicadores', label: 'Indicadores da linha visíveis', desc: 'Indicadores da linha/máquina visíveis no posto (produção, qualidade, paradas). O operador consegue informar o status atual da máquina.' },
            { id: 'sol_org_fluxo', label: 'Fluxo de materiais na máquina claro', desc: 'Fluxo de entrada/saída de materiais na máquina claro e sinalizado; operador sabe de onde vem e para onde vai cada componente.' },
            { id: 'sol_org_it', label: 'IT da máquina acessível e seguida', desc: 'Instrução de Trabalho (IT) da máquina acessível no posto e efetivamente seguida pelo operador; parâmetros de processo visíveis e dentro da faixa.' },
        ],
    },
    {
        id: 'sol_lim', num: 'L', letra: 'L', nome: 'Limpeza & Luz', cor: '#FBBF24',
        conceito: 'Ambiente limpo e iluminado: a luz que dá energia e bem-estar.',
        itens: [
            { id: 'sol_lim_ambiente', label: 'Ambiente limpo, iluminado e ventilado', desc: 'Área da máquina limpa, com iluminação adequada e conforto para trabalhar. Obs: na Tampografia, não avaliar ventilação (ventiladores atrapalham o processo produtivo).' },
            { id: 'sol_lim_maquina_ferramentas', label: 'Máquina e Ferramentas Limpas', desc: 'Ferramentas de uso diário limpas e sem graxa/sujeira acumulada.' },
        ],
    },
];

export const getItens5SFlat = () => SENSOS.flatMap(s => s.itens.map(it => ({ ...it, senso: s.id, sensoNome: s.nome, sensoNum: s.num, cor: s.cor })));

// Score de um senso (0-100) a partir do mapa de respostas { item_id: 0..5 }
export const scoreSenso = (senso, respostas) => {
    const notas = senso.itens.map(it => respostas?.[it.id]).filter(n => n != null && n !== '');
    if (!notas.length) return null;
    return Math.round((notas.reduce((s, n) => s + Number(n), 0) / (notas.length * 5)) * 100);
};

// Scores completos: { seiri: 80, ..., geral: 76 } (geral = média dos sensos avaliados)
export const scores5S = (respostas) => {
    const out = {};
    const vals = [];
    SENSOS.forEach(s => {
        const sc = scoreSenso(s, respostas);
        out[s.id] = sc;
        if (sc != null) vals.push(sc);
    });
    out.geral = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    return out;
};

// ── Programa SOL ─────────────────────────────────────────────────────────────
// Todos os itens do SOL (para varreduras/relatório)
export const getItensSOLFlat = () => SOL_PILARES.flatMap(p => p.itens.map(it => ({ ...it, pilar: p.id, pilarNome: p.nome, cor: p.cor })));

// Scores do SOL: { sol_seg: 80, sol_org: 70, sol_lim: 90, geral: 80 }
export const scoresSOL = (respostas) => {
    const out = {};
    const vals = [];
    SOL_PILARES.forEach(p => {
        const sc = scoreSenso(p, respostas); // reaproveita a média×20 (0–100)
        out[p.id] = sc;
        if (sc != null) vals.push(sc);
    });
    out.geral = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    return out;
};

// Índice Solar: combina 5S e SOL (média dos que existirem). É o que faz o sol nascer.
export const indiceSolar = (geral5S, geralSOL) => {
    const vals = [geral5S, geralSOL].filter(v => v != null);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
};

// Consolida tudo num único objeto de scores (gravado no jsonb `scores`)
export const scoresIntegrado = (respostas) => {
    const s5 = scores5S(respostas);
    const sol = scoresSOL(respostas);
    return {
        ...s5,                                    // seiri..shitsuke + geral (5S)
        sol_seg: sol.sol_seg, sol_org: sol.sol_org, sol_lim: sol.sol_lim,
        sol_geral: sol.geral,
        solar: indiceSolar(s5.geral, sol.geral),  // índice combinado
    };
};

// Selo do sol por estágio do Índice Solar — o coração lúdico do programa
export const solSelo = (solar) => {
    if (solar == null) return { key: 'none', emoji: '🌑', label: 'Sem leitura', frase: 'Aguardando a primeira auditoria.', cor: '#64748B' };
    if (solar < 50) return { key: 'madrugada', emoji: '🌑', label: 'Antes do amanhecer', frase: 'Ainda é madrugada aqui — há muito a preparar para o sol nascer.', cor: '#6366F1' };
    if (solar < 70) return { key: 'amanhecer', emoji: '🌅', label: 'Amanhecer', frase: 'O sol começa a nascer. Bom caminho — mantenha o ritmo!', cor: '#F97316' };
    if (solar < 85) return { key: 'raiando', emoji: '🌤️', label: 'Sol raiando', frase: 'Quase lá! Os raios já aquecem a área.', cor: '#F59E0B' };
    return { key: 'pleno', emoji: '☀️', label: 'Sol pleno', frase: 'O sol nasceu na Mondial! Excelência — hora de brilhar e inspirar.', cor: '#EAB308' };
};
