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
            { id: 's1_uteis', label: 'Somente itens necessários na área', desc: 'Materiais, ferramentas e equipamentos presentes são usados na rotina; nada obsoleto ou em excesso.' },
            { id: 's1_etiqueta', label: 'Tratamento de itens sem uso', desc: 'Itens sem uso identificados (etiqueta/área de descarte) e com destino definido em prazo.' },
            { id: 's1_estoque', label: 'Quantidades adequadas no posto', desc: 'Estoques no posto limitados ao necessário do período; sem acúmulo de WIP indevido.' },
            { id: 's1_info', label: 'Documentos e informações vigentes', desc: 'Quadros, ITs e papéis na área estão atualizados; nada vencido ou irrelevante exposto.' },
        ],
    },
    {
        id: 'seiton', num: '2S', nome: 'Seiton · Organização', cor: '#16A34A',
        conceito: 'Um lugar para cada coisa e cada coisa em seu lugar, com acesso rápido.',
        itens: [
            { id: 's2_demarcacao', label: 'Demarcações e endereços visuais', desc: 'Pisos, prateleiras e bancadas demarcados; endereços identificados e legíveis.' },
            { id: 's2_ferramentas', label: 'Ferramentas com local definido', desc: 'Cada ferramenta tem posição própria (sombra/suporte) e retorna ao lugar após o uso.' },
            { id: 's2_acesso', label: 'Itens de uso frequente à mão', desc: 'Disposição segue a frequência de uso; nada exige deslocamento ou procura excessiva.' },
            { id: 's2_fluxo', label: 'Corredores e rotas desobstruídos', desc: 'Rotas de pessoas e materiais livres; nada armazenado em áreas de circulação ou emergência.' },
        ],
    },
    {
        id: 'seiso', num: '3S', nome: 'Seiso · Limpeza', cor: '#D97706',
        conceito: 'Limpar é inspecionar: eliminar sujeira e atacar suas fontes.',
        itens: [
            { id: 's3_area', label: 'Área e equipamentos limpos', desc: 'Máquinas, bancadas e piso sem sujeira, óleo, rebarbas ou resíduos acumulados.' },
            { id: 's3_rotina', label: 'Rotina de limpeza definida', desc: 'Cronograma de limpeza com responsáveis e frequência visível e cumprido.' },
            { id: 's3_fontes', label: 'Fontes de sujeira tratadas', desc: 'Vazamentos e geradores de sujeira identificados e com ação corretiva (não apenas limpeza repetida).' },
            { id: 's3_residuos', label: 'Descarte e coleta seletiva corretos', desc: 'Lixeiras identificadas, não transbordando; resíduos segregados por tipo.' },
        ],
    },
    {
        id: 'seiketsu', num: '4S', nome: 'Seiketsu · Padronização', cor: '#8B5CF6',
        conceito: 'Transformar os 3 primeiros sensos em padrão visual e replicável.',
        itens: [
            { id: 's4_padroes', label: 'Padrões visuais publicados', desc: 'Fotos de condição-padrão, gestão à vista e critérios claros do "certo" na área.' },
            { id: 's4_uniforme', label: 'Consistência entre turnos/postos', desc: 'A mesma organização e limpeza se mantêm em qualquer turno e posto equivalente.' },
            { id: 's4_epi', label: 'Condições de trabalho e EPIs', desc: 'Iluminação, ergonomia e uso de EPIs conforme padrão; anomalias sinalizadas.' },
            { id: 's4_auditoria', label: 'Autoavaliação periódica da área', desc: 'A própria área se autoavalia com frequência definida e registra os desvios.' },
        ],
    },
    {
        id: 'shitsuke', num: '5S', nome: 'Shitsuke · Disciplina', cor: '#DC2626',
        conceito: 'Sustentar: hábito, cumprimento espontâneo e melhoria contínua.',
        itens: [
            { id: 's5_habito', label: 'Cumprimento sem cobrança', desc: 'A equipe mantém os padrões espontaneamente, sem depender de fiscalização.' },
            { id: 's5_acoes', label: 'Ações de auditorias anteriores concluídas', desc: 'Pendências das últimas auditorias tratadas no prazo; sem reincidência dos mesmos desvios.' },
            { id: 's5_treinamento', label: 'Equipe treinada e engajada no 5S', desc: 'Colaboradores conhecem os sensos, participam das melhorias e sabem o porquê das regras.' },
            { id: 's5_melhoria', label: 'Melhorias propostas pela própria área', desc: 'Há registro de kaizens/sugestões da equipe implantadas no período.' },
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
            { id: 'sol_seg_epi', label: 'EPIs adequados e em uso', desc: 'EPIs necessários disponíveis, em bom estado e usados corretamente por todos na área.' },
            { id: 'sol_seg_risco', label: 'Riscos mapeados e sinalizados', desc: 'Perigos identificados (mapa de risco, sinalização de piso, máquinas e produtos químicos) e visíveis.' },
            { id: 'sol_seg_maquina', label: 'Dispositivos de segurança ativos', desc: 'Proteções, sensores e botões de emergência das máquinas presentes, testados e funcionando.' },
            { id: 'sol_seg_reporte', label: 'Condições inseguras e quase-acidentes tratados', desc: 'Desvios de segurança e quase-acidentes reportados, registrados e com ação — sem reincidência.' },
        ],
    },
    {
        id: 'sol_org', num: 'O', letra: 'O', nome: 'Organização', cor: '#F59E0B',
        conceito: 'Ordem visível que faz o trabalho fluir com clareza e ritmo.',
        itens: [
            { id: 'sol_org_gestao', label: 'Gestão à vista viva', desc: 'Quadros de metas, indicadores e avisos atualizados, legíveis e usados pela equipe no dia a dia.' },
            { id: 'sol_org_fluxo', label: 'Fluxo e endereçamento claros', desc: 'Layout, rotas e endereços evidentes; qualquer pessoa localiza itens e materiais sem ajuda.' },
            { id: 'sol_org_padrao', label: 'Padrões acessíveis e seguidos', desc: 'Instruções de trabalho e padrões visuais disponíveis no posto e efetivamente seguidos.' },
        ],
    },
    {
        id: 'sol_lim', num: 'L', letra: 'L', nome: 'Limpeza & Luz', cor: '#FBBF24',
        conceito: 'Ambiente limpo e iluminado: a luz que dá energia e bem-estar.',
        itens: [
            { id: 'sol_lim_ambiente', label: 'Ambiente limpo, iluminado e ventilado', desc: 'Área limpa, com iluminação e ventilação adequadas — conforto e boas condições ("luz") para trabalhar.' },
            { id: 'sol_lim_higiene', label: 'Áreas comuns higienizadas', desc: 'Banheiros, copa, bebedouros e vestiários limpos, abastecidos e conservados.' },
            { id: 'sol_lim_residuo', label: 'Resíduos segregados e destinados', desc: 'Coleta seletiva correta, sem acúmulo ou transbordo; destinação adequada dos resíduos.' },
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
