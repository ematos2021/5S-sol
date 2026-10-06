import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';
import { getUsuario } from '../services/usuario';
import { compressImage } from '../services/imageCompressor';
import { entregarRelatorio } from '../services/relatorio';
import {
    SENSOS, ESCALA_5S, scores5S, SOL_PILARES, scoresSOL, scoresIntegrado, indiceSolar, solSelo,
    PONTOS_NOTA, demonstrativoNota,
    FAIXA_EXCELENCIA, FAIXA_CONSOLIDA, FAIXA_ATENCAO,
} from '../data/cincoS';
import {
    FaPlus, FaTrash, FaSync, FaCheck, FaTimes, FaChevronLeft, FaChevronRight, FaBroom,
    FaChartPie, FaListUl, FaMapMarkedAlt, FaCamera, FaArrowLeft, FaCheckCircle,
    FaIndustry, FaExclamationTriangle, FaBolt, FaGraduationCap, FaClipboardCheck, FaFilePdf,
    FaSun, FaShieldAlt, FaHardHat, FaTrophy, FaMagic, FaRobot, FaSave, FaPen, FaSpinner, FaCalendarAlt, FaInfoCircle,
    FaSearch, FaFilter, FaLayerGroup, FaArrowUp, FaArrowDown, FaEye, FaBuilding, FaChartLine,
} from 'react-icons/fa';

const ACCENT = '#22C55E';
const SOL_ACCENT = '#F59E0B';
// Lookup unificado de dimensões (5S + SOL) para plano de ação e relatório
const DIM_BY_ID = Object.fromEntries([...SENSOS, ...SOL_PILARES].map(d => [d.id, d]));

// ─── Helpers ─────────────────────────────────────────────────────────────────
const hojeISO = () => new Date().toISOString().slice(0, 10);
const fmtData = (d) => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const scoreCor = (s) => s == null ? '#64748B' : s >= FAIXA_EXCELENCIA ? '#16A34A' : s >= FAIXA_CONSOLIDA ? '#D97706' : '#DC2626';
const notaCor = (n) => n == null ? 'var(--border-color-dark)' : n <= 1 ? '#DC2626' : n === 2 ? '#EA580C' : n === 3 ? '#D97706' : n === 4 ? '#84CC16' : '#16A34A';
const norm = (s) => String(s ?? '').trim().toUpperCase();
const areaKey = (a) => `${norm(a?.planta)}|${norm(a?.fabrica)}|${norm(a?.setor)}|${norm(a?.maquina)}`;
// Rótulo curto da área (inclui a linha/máquina quando houver)
const areaLabel = (a) => `${a?.fabrica || ''} · ${a?.setor || ''}${a?.maquina ? ` · ${a.maquina}` : ''}`;

// ─── Rotina semanal: toda área precisa de uma auditoria concluída por semana (seg–dom) ──
const diaLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dataLocal = (iso) => new Date(String(iso).slice(0, 10) + 'T12:00:00');
// Segunda-feira da semana, como 'AAAA-MM-DD' — é a chave da semana
const semanaDe = (iso) => { const d = dataLocal(iso); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return diaLocal(d); };
const somaDias = (iso, n) => { const d = dataLocal(iso); d.setDate(d.getDate() + n); return diaLocal(d); };
const semanaAtualKey = () => semanaDe(diaLocal(new Date()));
const numSemana = (seg) => { // ISO 8601: a semana 1 é a que tem a primeira quinta do ano
    const qui = dataLocal(somaDias(seg, 3));
    const jan1 = new Date(qui.getFullYear(), 0, 1, 12);
    return Math.floor((qui - jan1) / 86400000 / 7) + 1;
};
const fmtCurto = (iso) => dataLocal(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
const rotuloSemana = (seg) => `Semana ${numSemana(seg)} · ${fmtCurto(seg)} a ${fmtCurto(somaDias(seg, 6))}`;
// areaKey → (semana → auditoria concluída mais recente daquela semana)
const indexarSemanas = (auditorias) => {
    const idx = new Map();
    auditorias.forEach(a => {
        if (a.status !== 'concluida' || !a.data_auditoria) return;
        const k = areaKey(a), s = semanaDe(a.data_auditoria);
        if (!idx.has(k)) idx.set(k, new Map());
        const m = idx.get(k), atual = m.get(s);
        if (!atual || String(a.data_auditoria) > String(atual.data_auditoria)) m.set(s, a);
    });
    return idx;
};

// Linha = união de máquinas (cadastro_planta_area.linha_id aponta a máquina para a linha)
const emLinha = (estrutura, e) => e?.linha_id != null && estrutura.some(x => x.id === e.linha_id);
const composicaoLinha = (estrutura, a) => {
    const linha = estrutura.find(e => norm(e.planta) === norm(a?.planta) && norm(e.fabrica) === norm(a?.fabrica) && norm(e.setor) === norm(a?.setor) && norm(e.maquina) === norm(a?.maquina) && !emLinha(estrutura, e));
    if (!linha) return [];
    return estrutura.filter(e => e.linha_id === linha.id).map(e => e.maquina).filter(Boolean)
        .sort((x, y) => (parseInt(String(x).match(/\d+/)?.[0] || 0, 10) - parseInt(String(y).match(/\d+/)?.[0] || 0, 10)) || String(x).localeCompare(String(y)));
};

const extractMaquina = (a) => {
    if (a?.maquina && String(a.maquina).trim()) return String(a.maquina).trim();
    const parts = (a?.titulo || '').split(' · ');
    if (parts.length >= 5) {
        return parts[parts.length - 2].trim();
    }
    return null;
};

const tratarAuditoria = (a) => {
    if (!a) return a;
    const maq = a.maquina?.trim() || extractMaquina(a);
    return {
        ...a,
        planta: a.planta ? String(a.planta).trim() : null,
        fabrica: a.fabrica ? String(a.fabrica).trim() : null,
        setor: a.setor ? String(a.setor).trim() : null,
        maquina: maq || null,
    };
};

// Auditorias anteriores da MESMA linha/máquina, da mais recente para a mais antiga.
// Só entra auditoria concluída: rascunho da área não é histórico, é trabalho em
// andamento. E um relatório antigo não pode mostrar auditoria posterior a ele —
// senão o documento impresso em março "sabe" o que aconteceu em maio.
const historicoDaMaquina = (aud, todas, limite = 4) => {
    if (!aud) return [];
    const chave = areaKey(aud);
    const dataDe = (a) => String(a?.data_auditoria || a?.created_at || '').slice(0, 10);
    const ref = dataDe(aud);
    return (todas || [])
        .filter(a => a && a.id !== aud.id && a.status === 'concluida' && areaKey(a) === chave)
        .filter(a => !ref || dataDe(a) <= ref)
        .sort((a, b) => dataDe(b).localeCompare(dataDe(a)) || Number(b.id || 0) - Number(a.id || 0))
        .slice(0, limite);
};

// ── Cor no papel ────────────────────────────────────────────────────────────────
// A paleta é desenhada para tela escura. No relatório impresso ela encosta no branco
// e some: âmbar #FBBF24 com texto branco em cima dá 1,7:1 de contraste, e a nota 4
// (#84CC16) fica um círculo claro com número invisível. Esta função escurece a cor
// até o branco ler em cima dela (4,5:1) — o que, por simetria, também garante que
// ela leia como texto sobre o branco. Cor já escura passa intacta.
// Só o relatório usa: na tela do app a paleta original continua valendo.
const tinta = (hex, alvo = 4.5) => {
    let m = String(hex || '').replace('#', '').trim();
    if (m.length === 3) m = m.split('').map(c => c + c).join('');
    if (!/^[0-9a-fA-F]{6}$/.test(m)) return hex;
    let [r, g, b] = [0, 2, 4].map(i => parseInt(m.slice(i, i + 2), 16));
    const canal = (c) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
    const contraste = () => 1.05 / (0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b) + 0.05);
    for (let i = 0; i < 30 && contraste() < alvo; i++) {
        r = Math.round(r * 0.9); g = Math.round(g * 0.9); b = Math.round(b * 0.9);
    }
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
};

// Número do relatório: mora no título ("5S Nº 023 · ..."), que é como o app numera
// as auditorias. Sem número no título (registro antigo), devolve null.
const numeroRelatorio = (a) => {
    const m = String(a?.titulo || '').match(/N[º°]\s*(\d+)/i);
    return m ? m[1] : null;
};

// Scores de uma auditoria salva. Usa o que foi gravado e, quando faltar — auditoria
// antiga, salva antes do SOL existir —, recalcula a partir das respostas em vez de
// cair no Score 5S disfarçado de Índice Solar.
const scoresDaAuditoria = (a) => {
    const r = a?.respostas || {};
    const g5 = a?.scores?.geral ?? scores5S(r).geral;
    const gSol = a?.scores?.sol_geral ?? scoresSOL(r).geral;
    return { g5, gSol, solar: a?.scores?.solar_bruto ?? a?.scores?.solar ?? indiceSolar(g5, gSol) };
};

// Score de cada dimensão (5 sensos + 3 pilares) de uma auditoria salva. Mesma
// regra do scoresDaAuditoria: usa o que foi gravado e recalcula o que faltar.
const dimsDaAuditoria = (a) => {
    const r = a?.respostas || {};
    const s5 = scores5S(r), sol = scoresSOL(r);
    const out = {};
    SENSOS.forEach(s => { out[s.id] = a?.scores?.[s.id] ?? s5[s.id]; });
    SOL_PILARES.forEach(p => { out[p.id] = a?.scores?.[p.id] ?? sol[p.id]; });
    return out;
};

function useIsMobile() {
    const [mob, setMob] = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
    useEffect(() => {
        const mq = window.matchMedia('(max-width: 768px)');
        const on = () => setMob(mq.matches);
        on();
        mq.addEventListener ? mq.addEventListener('change', on) : mq.addListener(on);
        return () => { mq.removeEventListener ? mq.removeEventListener('change', on) : mq.removeListener(on); };
    }, []);
    return mob;
}

// ─── Radar dos 5 sensos (SVG pentágono) ──────────────────────────────────────
const Radar5S = ({ scores, size = 190, mini = false }) => {
    const cx = size / 2, cy = size / 2, R = size / 2 - (mini ? 14 : 30);
    const ang = (i) => (-90 + i * 72) * Math.PI / 180;
    const pt = (i, frac) => [cx + Math.cos(ang(i)) * R * frac, cy + Math.sin(ang(i)) * R * frac];
    const ringPath = (frac) => SENSOS.map((_, i) => pt(i, frac).join(',')).join(' ');
    const vals = SENSOS.map(s => (scores?.[s.id] ?? 0) / 100);
    const poly = SENSOS.map((_, i) => pt(i, Math.max(vals[i], 0.02)).join(',')).join(' ');
    return (
        <svg width={size} height={size} style={{ flexShrink: 0 }}>
            {[0.25, 0.5, 0.75, 1].map(f => <polygon key={f} points={ringPath(f)} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="1" />)}
            {SENSOS.map((s, i) => { const [x, y] = pt(i, 1); return <line key={s.id} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.09)" strokeWidth="1" />; })}
            <polygon points={poly} fill={`${ACCENT}33`} stroke={ACCENT} strokeWidth="2" strokeLinejoin="round" />
            {SENSOS.map((s, i) => {
                const [x, y] = pt(i, Math.max(vals[i], 0.02));
                return <circle key={s.id} cx={x} cy={y} r={mini ? 2.5 : 4} fill={s.cor} stroke="#0B0E16" strokeWidth="1.5" />;
            })}
            {!mini && SENSOS.map((s, i) => {
                const [x, y] = pt(i, 1.22);
                const sc = scores?.[s.id];
                return (
                    <text key={s.id} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="10" fontWeight="800" fill={s.cor}>
                        {s.num}{sc != null ? ` ${sc}%` : ''}
                    </text>
                );
            })}
        </svg>
    );
};

// ─── Nascer do sol por Índice Solar (SVG) ─────
// value 0–100 (ou null). O sol sobe do horizonte conforme o índice; o céu e os
// raios acompanham o estágio (selo). Núcleo lúdico do Programa SOL.
const SolNascente = ({ value, size = 150, label = true }) => {
    const uid = React.useId ? React.useId().replace(/[:]/g, '') : `sol${Math.round((value ?? 0) * 7)}`;
    const selo = solSelo(value);
    const v = value == null ? 0 : Math.max(0, Math.min(100, value));
    const W = 200, H = 150, horizon = 104;
    const sunY = 120 - (v / 100) * 78;   // 0% no horizonte, 100% bem alto
    const sunR = 24;
    // Paleta do céu por estágio
    const sky = {
        none:      ['#1e293b', '#334155'], madrugada: ['#312e81', '#4338ca'],
        amanhecer: ['#7c2d12', '#fb923c'], raiando:  ['#b45309', '#fcd34d'], pleno: ['#38bdf8', '#fef08a'],
    }[selo.key] || ['#1e293b', '#334155'];
    const sunCor = selo.key === 'pleno' ? '#FDE047' : selo.key === 'raiando' ? '#FBBF24' : selo.key === 'amanhecer' ? '#FB923C' : selo.key === 'madrugada' ? '#818CF8' : '#F97316';
    const rays = Array.from({ length: 12 }, (_, i) => i * 30);
    const rayLen = 8 + (v / 100) * 16;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: label ? '0.4rem' : 0 }}>
            <svg width={size} height={size * H / W} viewBox={`0 0 ${W} ${H}`} style={{ borderRadius: 12, display: 'block' }}>
                <defs>
                    <linearGradient id={`sky${uid}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={sky[0]} /><stop offset="100%" stopColor={sky[1]} />
                    </linearGradient>
                    <radialGradient id={`glow${uid}`} cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor={sunCor} stopOpacity="0.55" /><stop offset="100%" stopColor={sunCor} stopOpacity="0" />
                    </radialGradient>
                </defs>
                <rect x="0" y="0" width={W} height={H} fill={`url(#sky${uid})`} />
                {/* brilho */}
                <circle cx={W / 2} cy={sunY} r={sunR * 2.6} fill={`url(#glow${uid})`} />
                {/* raios */}
                <g stroke={sunCor} strokeWidth="3" strokeLinecap="round" opacity={0.35 + (v / 100) * 0.6}>
                    {rays.map(a => {
                        const rad = a * Math.PI / 180;
                        const x1 = W / 2 + Math.cos(rad) * (sunR + 5), y1 = sunY + Math.sin(rad) * (sunR + 5);
                        const x2 = W / 2 + Math.cos(rad) * (sunR + 5 + rayLen), y2 = sunY + Math.sin(rad) * (sunR + 5 + rayLen);
                        return <line key={a} x1={x1} y1={y1} x2={x2} y2={y2} />;
                    })}
                </g>
                {/* sol */}
                <circle cx={W / 2} cy={sunY} r={sunR} fill={sunCor} />
                {/* solo (esconde a parte abaixo do horizonte) */}
                <rect x="0" y={horizon} width={W} height={H - horizon} fill="#0d2818" />
                <rect x="0" y={horizon} width={W} height="3" fill={sunCor} opacity="0.5" />
                {/* silhueta fabril discreta */}
                <g fill="#08160e">
                    <rect x="18" y={horizon - 14} width="26" height="14" /><rect x="30" y={horizon - 22} width="7" height="8" />
                    <rect x="150" y={horizon - 18} width="30" height="18" /><rect x="160" y={horizon - 27} width="6" height="9" />
                </g>
                <text x={W / 2} y={H - 7} textAnchor="middle" fontSize="11" fontWeight="900" fill="#fde68a" opacity="0.85" letterSpacing="1">5S + SOL</text>
            </svg>
            {label && (
                <div style={{ textAlign: 'center', lineHeight: 1.15 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 900, color: selo.cor }}>{selo.emoji} {value != null ? `${Math.round(value)}%` : '—'} · {selo.label}</div>
                </div>
            )}
        </div>
    );
};

// Selo compacto (pill) do estágio do sol
const SolSeloPill = ({ value, small }) => {
    const s = solSelo(value);
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: small ? '0.6rem' : '0.68rem', fontWeight: 800, color: s.cor, background: `${s.cor}1e`, border: `1px solid ${s.cor}55`, borderRadius: 20, padding: small ? '0.1rem 0.5rem' : '0.2rem 0.65rem', whiteSpace: 'nowrap' }}>
            {s.emoji} {value != null ? `${Math.round(value)}%` : '—'}{small ? '' : ` · ${s.label}`}
        </span>
    );
};

const RingGauge = ({ value, size = 54, stroke = 6 }) => {
    const r = (size - stroke) / 2, c = 2 * Math.PI * r;
    const v = value == null ? 0 : Math.max(0, Math.min(100, value));
    const clr = scoreCor(value);
    return (
        <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
            <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={clr} strokeWidth={stroke} strokeLinecap="round"
                    strokeDasharray={c} strokeDashoffset={c - (v / 100) * c} style={{ transition: 'stroke-dashoffset 0.5s' }} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.25, fontWeight: 900, color: clr }}>{value == null ? '—' : `${value}`}</div>
        </div>
    );
};

const KpiMini = ({ icon, label, value, cor }) => (
    <div className="glass-panel" style={{ flex: 1, minWidth: 120, borderRadius: 12, border: '1px solid var(--border-color-dark)', padding: '0.6rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: `${cor}22`, color: cor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
        <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--color-text-main)', lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: '0.58rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.3px', fontWeight: 700, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
        </div>
    </div>
);

// `acoes` entra no cabeçalho, à esquerda do X — é onde a mão já está quando o
// modal está aberto. `largura` abre a folha além dos 760 padrão.
const ModalShell = ({ title, children, footer, onClose, wide, claro, acoes, largura }) => {
    const bd = claro ? '#e2e8f0' : 'var(--border-color-dark)';
    return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 6000, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.9rem' }}>
        <div className="glass-panel" style={{ width: '100%', maxWidth: largura || (wide ? 760 : 600), maxHeight: '88vh', borderRadius: 16, border: `1px solid ${bd}`, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: claro ? '#ffffff' : 'var(--bg-app)' }}>
            <div style={{ padding: '1rem 1.3rem', borderBottom: `1px solid ${bd}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.8rem' }}>
                <div style={{ fontSize: '1rem', fontWeight: 900, color: claro ? '#0F172A' : 'var(--color-text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>{title}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
                    {acoes}
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: claro ? '#475569' : 'var(--color-text-muted)', cursor: 'pointer', display: 'flex' }}><FaTimes size={16} /></button>
                </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.3rem' }}>{children}</div>
            <div style={{ padding: '0.9rem 1.3rem', borderTop: `1px solid ${bd}`, display: 'flex', justifyContent: 'flex-end', gap: '0.7rem', alignItems: 'center' }}>{footer}</div>
        </div>
    </div>
    );
};

const inputSty = { width: '100%', background: 'var(--bg-surface-glass)', border: '1px solid var(--border-color-dark)', borderRadius: 8, padding: '0.5rem 0.7rem', color: 'var(--color-text-main)', fontSize: '0.82rem', outline: 'none' };
const labelSty = { display: 'block', fontSize: '0.64rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.3rem' };
const btnPrim = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', padding: '0.55rem 1.2rem', borderRadius: 9, border: 'none', background: ACCENT, color: '#06210F', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' };
const btnSec = { display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.9rem', borderRadius: 8, border: '1px solid var(--border-color-dark)', background: 'transparent', color: 'var(--color-text-main)', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer' };

const Toast = ({ msg }) => (
    <div style={{ position: 'fixed', top: '1.5rem', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, padding: '0.6rem 1.3rem', borderRadius: 8, fontSize: '0.8rem', fontWeight: 700, background: msg.type === 'error' ? '#DC2626' : '#16A34A', color: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.4)', whiteSpace: 'nowrap' }}>
        {msg.type === 'error' ? '✕' : '✓'} {msg.text}
    </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
//  RELATÓRIO ANALÍTICO 5S — 1 documento executivo (HTML → imprimir/PDF)
// ═══════════════════════════════════════════════════════════════════════════════
// Monta o relatório e devolve { html, nomeArquivo } — quem exibe é o RelatorioViewer.
function montarRelatorio5S(aud, historico = []) {
    const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const respostas = aud.respostas || {};
    const sc = aud.scores && aud.scores.geral != null ? aud.scores : scores5S(respostas);
    const geral = sc.geral;
    const scSol = scoresSOL(respostas);
    // `solar_bruto` só existe nas auditorias salvas enquanto o veto de segurança
    // esteve ativo, e guarda o índice sem o teto — que é o valor que vale agora.
    const solar = aud.scores?.solar_bruto ?? aud.scores?.solar ?? indiceSolar(geral, scSol.geral);
    const selo = solSelo(solar);
    const nowStr = new Date().toLocaleDateString('pt-BR');
    const scCorHex = (s) => tinta(s == null ? '#475569' : s >= FAIXA_EXCELENCIA ? '#16a34a' : s >= FAIXA_CONSOLIDA ? '#d97706' : '#dc2626');
    const notaHex = (n) => tinta(n == null ? '#475569' : n <= 1 ? '#dc2626' : n === 2 ? '#ea580c' : n === 3 ? '#d97706' : n === 4 ? '#84cc16' : '#16a34a');
    // Verde e âmbar da marca são claros demais para virar texto no papel.
    const VERDE = tinta('#16a34a'), AMBAR = tinta('#d97706'), VERMELHO = tinta('#dc2626');

    // Conta 5S e SOL: o rótulo do KPI diz "críticos", e um EPI ou dispositivo de
    // segurança com nota 2 é o mais crítico que existe — ficava de fora.
    const criticos = [...SENSOS, ...SOL_PILARES].flatMap(s => s.itens.filter(it => !it.emAvaliacao && !it.desabilitado && respostas[it.id] != null && respostas[it.id] <= 2).map(it => ({ senso: s, it, nota: respostas[it.id] })));
    const planos = aud.planos || [];
    const planosAbertos = planos.filter(p => p.status !== 'concluida');

    // Radar SVG (pentágono) inline
    const radarSvg = (() => {
        const size = 250, cx = size / 2, cy = size / 2, R = 86;
        const ang = (i) => (-90 + i * 72) * Math.PI / 180;
        const pt = (i, f) => `${(cx + Math.cos(ang(i)) * R * f).toFixed(1)},${(cy + Math.sin(ang(i)) * R * f).toFixed(1)}`;
        const ring = (f) => SENSOS.map((_, i) => pt(i, f)).join(' ');
        const poly = SENSOS.map((s, i) => pt(i, Math.max((sc[s.id] ?? 0) / 100, 0.02))).join(' ');
        const labels = SENSOS.map((s, i) => {
            const lx = cx + Math.cos(ang(i)) * R * 1.32, ly = cy + Math.sin(ang(i)) * R * 1.32;
            return `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="11" font-weight="800" fill="${tinta(s.cor)}">${s.num} ${sc[s.id] != null ? sc[s.id] + '%' : '—'}</text>`;
        }).join('');
        const axes = SENSOS.map((s, i) => `<line x1="${cx}" y1="${cy}" x2="${pt(i, 1).split(',')[0]}" y2="${pt(i, 1).split(',')[1]}" stroke="#e2e8f0" stroke-width="1"/>`).join('');
        const dots = SENSOS.map((s, i) => { const [x, y] = pt(i, Math.max((sc[s.id] ?? 0) / 100, 0.02)).split(','); return `<circle cx="${x}" cy="${y}" r="4" fill="${tinta(s.cor)}" stroke="#fff" stroke-width="1.5"/>`; }).join('');
        return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
            ${[0.25, 0.5, 0.75, 1].map(f => `<polygon points="${ring(f)}" fill="none" stroke="#e2e8f0" stroke-width="1"/>`).join('')}
            ${axes}<polygon points="${poly}" fill="#22c55e33" stroke="${VERDE}" stroke-width="2"/>${dots}${labels}</svg>`;
    })();

    const barrasSensos = SENSOS.map(s => {
        const v = sc[s.id];
        return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
            <span style="width:150px;font-size:11px;font-weight:800;color:${tinta(s.cor)};text-align:right;white-space:nowrap">${s.num} · ${esc(s.nome.split('·')[1].trim())}</span>
            <div style="flex:1;height:14px;background:#f1f5f9;border-radius:7px;overflow:hidden"><div style="width:${v ?? 0}%;height:100%;background:${tinta(s.cor)};border-radius:7px"></div></div>
            <span style="width:40px;font-size:12px;font-weight:900;color:${scCorHex(v)};text-align:right">${v != null ? v + '%' : '—'}</span></div>`;
    }).join('');

    // Fotos numeradas (Fig. N) + galeria (5S e SOL)
    const allPhotos = [];
    [...SENSOS, ...SOL_PILARES].forEach(s => s.itens.forEach(it => (aud.fotos?.[it.id] || []).forEach(src => allPhotos.push({ src, item: it.label, senso: s.num, fig: allPhotos.length + 1 }))));
    const figOf = new Map();
    allPhotos.forEach(p => { if (!figOf.has(p.src)) figOf.set(p.src, p.fig); });

    // Detalhamento por grupo (reutilizável p/ 5S e SOL)
    const detalheDe = (grupos, scoresObj) => grupos.map(s => {
        const linhas = s.itens.map(it => {
            if (it.emAvaliacao || it.desabilitado) {
                return `<tr>
                    <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-weight:700;font-size:11px">${esc(it.label)} <span style="display:inline-block;margin-left:6px;font-size:10px;color:#475569;background:#f1f5f9;border:1px solid #e2e8f0;padding:1px 6px;border-radius:4px">Em avaliação</span><div style="font-size:10px;color:#475569;font-weight:400;margin-top:1px">${esc(it.desc)}</div></td>
                    <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;text-align:center;vertical-align:top;width:70px">
                        <span style="display:inline-flex;padding:3px 7px;border-radius:6px;background:#f1f5f9;color:#475569;font-size:10px;font-weight:800">Em avaliação</span>
                        <div style="font-size:10px;color:#475569;margin-top:2px">não pontuável</div></td></tr>`;
            }
            const n = respostas[it.id];
            const obs = aud.observacoes?.[it.id] || '';
            const fts = aud.fotos?.[it.id] || [];
            return `<tr>
                <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-weight:700;font-size:11px">${esc(it.label)}<div style="font-size:10px;color:#475569;font-weight:400;margin-top:1px">${esc(it.desc)}</div>
                ${obs ? `<div style="font-size:10.5px;color:#b91c1c;margin-top:3px"><b>Desvio:</b> ${esc(obs)}</div>` : ''}
                ${fts.length ? `<div style="display:flex;gap:6px;margin-top:5px;flex-wrap:wrap">${fts.map(f => `<div style="text-align:center"><img src="${f}" style="width:96px;height:72px;object-fit:cover;border-radius:4px;border:1px solid #e2e8f0"/><div style="font-size:10px;font-weight:800;color:#0f172a;margin-top:1px">Fig. ${figOf.get(f)}</div></div>`).join('')}</div>` : ''}</td>
                <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;text-align:center;vertical-align:top;width:70px">
                    <span style="display:inline-flex;width:30px;height:30px;border-radius:50%;background:${notaHex(n)};color:#fff;font-size:13px;font-weight:900;align-items:center;justify-content:center">${n != null ? n : '—'}</span>
                    <div style="font-size:10px;color:#475569;margin-top:2px">${n != null ? esc(ESCALA_5S[n].rotulo) : 'não avaliado'}</div></td></tr>`;
        }).join('');
        // A faixa colorida é um thead (não um div acima da tabela) para se repetir
        // no topo de cada página quando o senso não cabe inteiro em uma folha.
        return `<div class="bloco" style="margin-bottom:14px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
            <table style="width:100%;border-collapse:collapse">
                <thead><tr><th colspan="2" style="background:${tinta(s.cor)};padding:7px 12px;text-align:left">
                    <span style="font-weight:900;color:#fff;font-size:12px">${s.num} · ${esc(s.nome)}</span>
                    <span style="float:right;font-weight:900;color:#fff;font-size:13px">${scoresObj[s.id] != null ? scoresObj[s.id] + '%' : '—'}</span>
                </th></tr></thead>
                <tbody>${linhas}</tbody></table></div>`;
    }).join('');
    const detalheHtml = detalheDe(SENSOS, sc);
    const solDetalheHtml = detalheDe(SOL_PILARES, scSol);

    // Barras dos pilares SOL + nascer do sol (SVG) para o relatório
    const barrasSol = SOL_PILARES.map(p => {
        const v = scSol[p.id];
        return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
            <span style="width:150px;font-size:11px;font-weight:800;color:${tinta(p.cor)};text-align:right;white-space:nowrap">${p.num} · ${esc(p.nome)}</span>
            <div style="flex:1;height:14px;background:#f1f5f9;border-radius:7px;overflow:hidden"><div style="width:${v ?? 0}%;height:100%;background:${tinta(p.cor)};border-radius:7px"></div></div>
            <span style="width:40px;font-size:12px;font-weight:900;color:${scCorHex(v)};text-align:right">${v != null ? v + '%' : '—'}</span></div>`;
    }).join('');
    const solSvg = (() => {
        const v = solar == null ? 0 : Math.max(0, Math.min(100, solar));
        const W = 260, H = 150, horizon = 108;
        const sunY = 124 - (v / 100) * 82, sunR = 26;
        const skyPairs = { madrugada: ['#312e81', '#4338ca'], amanhecer: ['#7c2d12', '#fb923c'], raiando: ['#b45309', '#fcd34d'], pleno: ['#0ea5e9', '#fde68a'] };
        const [s0, s1] = skyPairs[selo.key] || ['#1e293b', '#334155'];
        const sunCor = selo.key === 'pleno' ? '#fde047' : selo.key === 'raiando' ? '#fbbf24' : selo.key === 'amanhecer' ? '#fb923c' : '#818cf8';
        const rayLen = 8 + (v / 100) * 16;
        const rays = Array.from({ length: 12 }, (_, i) => i * 30).map(a => { const r = a * Math.PI / 180; const x1 = W / 2 + Math.cos(r) * (sunR + 5), y1 = sunY + Math.sin(r) * (sunR + 5), x2 = W / 2 + Math.cos(r) * (sunR + 5 + rayLen), y2 = sunY + Math.sin(r) * (sunR + 5 + rayLen); return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`; }).join('');
        return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs><linearGradient id="rsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${s0}"/><stop offset="100%" stop-color="${s1}"/></linearGradient></defs>
            <rect width="${W}" height="${H}" rx="8" fill="url(#rsky)"/>
            <g stroke="${sunCor}" stroke-width="3" stroke-linecap="round" opacity="${(0.35 + v / 100 * 0.6).toFixed(2)}">${rays}</g>
            <circle cx="${W / 2}" cy="${sunY.toFixed(1)}" r="${sunR}" fill="${sunCor}"/>
            <rect x="0" y="${horizon}" width="${W}" height="${H - horizon}" fill="#0d2818"/><rect x="0" y="${horizon}" width="${W}" height="3" fill="${sunCor}" opacity="0.5"/>
            <text x="${W / 2}" y="${H - 8}" text-anchor="middle" font-size="12" font-weight="900" fill="#fde68a" opacity="0.85" letter-spacing="1">5S + SOL</text></svg>`;
    })();

    // Ação renovada = proposta numa auditoria anterior, não feita, e trazida de
    // novo para este plano. É o que o gestor precisa enxergar primeiro, então a
    // linha inteira sai destacada e a descrição diz desde quando aquilo se arrasta.
    const renovadas = planos.filter(pl => pl.origem);
    const planoRows = planos.map(pl => {
        const s = DIM_BY_ID[pl.senso] || SENSOS[0];
        const done = pl.status === 'concluida';
        const renov = Boolean(pl.origem);
        const vez = Number(pl.vez) || 2;
        return `<tr style="${renov && !done ? 'background:#fff7ed' : ''}"><td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;${renov && !done ? 'border-left:3px solid #dc2626' : ''}"><span style="font-size:10px;font-weight:900;color:#fff;background:${tinta(s.cor)};padding:2px 7px;border-radius:8px">${s.num}</span></td>
        <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-weight:700;font-size:11px">${esc(pl.descricao) || '—'}${renov ? `<div style="font-size:9.5px;font-weight:900;letter-spacing:.3px;color:${done ? VERDE : '#b91c1c'};margin-top:2px">RENOVADA · ${vez}ª VEZ · pendente desde ${fmtData(pl.origem.data)}${pl.origem.prazo ? ` · prazo original ${fmtData(pl.origem.prazo)}` : ''}</div>` : ''}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:11px">${esc(pl.resp) || '—'}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;text-align:center"><span style="font-size:10px;font-weight:800;padding:2px 9px;border-radius:9px;background:${done ? '#dcfce7' : '#fef3c7'};color:${tinta(done ? '#16a34a' : '#d97706', 5.5)}">${done ? 'CONCLUÍDA' : 'ABERTA'}</span></td></tr>`;
    }).join('');

    const galleryHtml = allPhotos.length === 0 ? '' : `
        <h2 class="page-break" style="font-size:13px;color:#0f172a;border-bottom:2px solid #22c55e;padding-bottom:5px;margin:24px 0 10px">Anexos fotográficos (${allPhotos.length})</h2>
        ${allPhotos.map(p => `<div class="avoid-break" style="border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin-bottom:16px">
            <div style="background:#f1f5f9;border-left:5px solid #22c55e;padding:8px 12px;margin-bottom:10px;font-size:12px;font-weight:700;color:#0f172a;display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px">
                <span>FIGURA ${p.fig}</span><span style="font-weight:400;color:#475569">${p.senso} · ${esc(p.item)}</span></div>
            <img src="${p.src}" style="width:100%;max-height:640px;object-fit:contain;display:block;border-radius:4px;border:1px solid #eee"/></div>`).join('')}`;

    const h2 = (t) => `<h2 style="font-size:13px;color:#0f172a;border-bottom:2px solid #22c55e;padding-bottom:5px;margin:24px 0 10px">${t}</h2>`;
    const kpi = (val, lbl, cor) => `<div style="flex:1;min-width:0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:9px 6px;text-align:center">
        <div style="font-size:19px;font-weight:900;color:${cor};line-height:1.15;white-space:nowrap">${val}</div>
        <div style="font-size:10px;color:#475569;text-transform:uppercase;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${lbl}</div></div>`;

    // ── Histórico da linha/máquina ──────────────────────────────────────────────
    // O gestor lê o relatório de hoje sem ter os anteriores na mão. Este bloco
    // fecha o corpo do documento com o que ele precisa lembrar: como a linha vinha
    // pontuando e o que ficou pendente das auditorias passadas — em especial as
    // ações vencidas, que é o que derruba o senso de Disciplina na próxima visita.
    const historicoSecao = (() => {
        const hist = (historico || []).filter(Boolean);
        const tdH = 'padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:11px';
        const thH = 'padding:6px 10px;font-size:10px;color:#475569;text-transform:uppercase;letter-spacing:.3px';

        if (!hist.length) {
            return `${h2('Histórico desta linha/máquina')}
        <div class="avoid-break" style="border:1px dashed #cbd5e1;border-radius:8px;padding:12px 16px;font-size:11.5px;color:#475569">
            Não há auditoria concluída anterior nesta linha/máquina — este relatório é o ponto de partida da série.
        </div>`;
        }

        const criticosDe = (a) => [...SENSOS, ...SOL_PILARES].reduce((n, g) =>
            n + g.itens.filter(it => !it.emAvaliacao && !it.desabilitado && a?.respostas?.[it.id] != null && a.respostas[it.id] <= 2).length, 0);

        // A auditoria atual entra como primeira linha da série: o gestor lê a
        // tendência incluindo o dia de hoje, sem ter de comparar de cabeça.
        const serie = [
            { a: aud, atual: true, s: { g5: geral, gSol: scSol.geral, solar }, crit: criticos.length },
            ...hist.map(a => ({ a, atual: false, s: scoresDaAuditoria(a), crit: criticosDe(a) })),
        ];
        const pct = (v) => v != null ? `${v}%` : '—';
        const delta = (atual, anterior) => {
            if (atual == null || anterior == null) return '';
            const d = atual - anterior;
            if (d === 0) return `<span style="color:#475569;font-weight:800;font-size:10px"> =</span>`;
            return `<span style="color:${d > 0 ? VERDE : VERMELHO};font-weight:900;font-size:10px"> ${d > 0 ? '▲' : '▼'}${Math.abs(d)}</span>`;
        };
        const linhasHist = serie.map((e, i) => {
            const ant = serie[i + 1];
            const pl = e.a.planos || [];
            const feitasAud = pl.filter(p => p.status === 'concluida').length;
            const num = numeroRelatorio(e.a);
            return `<tr style="${e.atual ? 'background:#f0fdf4' : ''}">
            <td style="${tdH};white-space:nowrap;font-weight:800;color:#334155">${num ? `Nº ${esc(num)}` : '—'}</td>
            <td style="${tdH};font-weight:${e.atual ? 800 : 600};white-space:nowrap">${fmtData(e.a.data_auditoria)}${e.atual ? ' <span style="font-size:9px;color:${VERDE};font-weight:900">RELATÓRIO ATUAL</span>' : ''}</td>
            <td style="${tdH}">${esc(e.a.auditor || '—')}</td>
            <td style="${tdH};text-align:center;font-weight:900;color:${scCorHex(e.s.solar)};white-space:nowrap">${pct(e.s.solar)}${ant ? delta(e.s.solar, ant.s.solar) : ''}</td>
            <td style="${tdH};text-align:center;font-weight:800;color:${scCorHex(e.s.g5)}">${pct(e.s.g5)}</td>
            <td style="${tdH};text-align:center;font-weight:800;color:${scCorHex(e.s.gSol)}">${pct(e.s.gSol)}</td>
            <td style="${tdH};text-align:center;font-weight:800;color:${e.crit ? VERMELHO : VERDE}">${e.crit}</td>
            <td style="${tdH};text-align:center">${pl.length ? `${feitasAud}/${pl.length}` : '—'}</td></tr>`;
        }).join('');

        const acoes = hist.flatMap(a => (a.planos || []).map(p => ({ p, a })));
        const vencida = (p) => Boolean(p.prazo) && String(p.prazo).slice(0, 10) < hojeISO();
        const feitas = acoes.filter(x => x.p.status === 'concluida');
        const abertas = acoes.filter(x => x.p.status !== 'concluida');
        const vencidas = abertas.filter(x => vencida(x.p));
        // Aberta antes de concluída, e a mais atrasada no topo: a lista já sai na
        // ordem em que o gestor vai cobrar.
        const ordenadas = [...acoes].sort((x, y) =>
            (x.p.status === 'concluida' ? 1 : 0) - (y.p.status === 'concluida' ? 1 : 0)
            || String(x.p.prazo || '9999-12-31').localeCompare(String(y.p.prazo || '9999-12-31')));

        const linhasAcoes = ordenadas.map(({ p, a }) => {
            const s = DIM_BY_ID[p.senso] || SENSOS[0];
            const done = p.status === 'concluida';
            // Renovada nesta auditoria: continua aberta lá atrás — é a prova de que
            // foi proposta e não feita — mas aqui já está sendo recobrada.
            const renovadaAqui = !done && planos.some(x => x.origem?.plano_id === p.id);
            const atrasada = !done && !renovadaAqui && vencida(p);
            const rotulo = done ? 'CONCLUÍDA' : renovadaAqui ? 'RENOVADA NESTA' : atrasada ? 'VENCIDA' : 'ABERTA';
            // 5,5:1 contra o branco porque o selo fica sobre um fundo já tingido —
            // no papel, 4,5 contra o branco vira ~4,1 contra o creme do selo.
            const cor = tinta(done ? '#16a34a' : renovadaAqui ? '#4338ca' : atrasada ? '#dc2626' : '#d97706', 5.5);
            const fundo = done ? '#dcfce7' : renovadaAqui ? '#e0e7ff' : atrasada ? '#fee2e2' : '#fef3c7';
            return `<tr>
            <td style="${tdH};white-space:nowrap;color:#475569">${numeroRelatorio(a) ? `<b style="color:#334155">Nº ${esc(numeroRelatorio(a))}</b> · ` : ''}${fmtData(a.data_auditoria)}</td>
            <td style="${tdH};text-align:center"><span style="font-size:9.5px;font-weight:900;color:#fff;background:${tinta(s.cor)};padding:2px 6px;border-radius:8px">${s.num}</span></td>
            <td style="${tdH};font-weight:700">${esc(p.descricao) || '—'}</td>
            <td style="${tdH}">${esc(p.resp) || '—'}</td>
            <td style="${tdH};text-align:center"><span style="font-size:9.5px;font-weight:800;padding:2px 8px;border-radius:9px;background:${fundo};color:${cor};white-space:nowrap">${rotulo}</span></td></tr>`;
        }).join('');

        const antiga = serie[serie.length - 1];
        const evolucao = (solar != null && antiga.s.solar != null)
            ? `Índice Solar: <b>${antiga.s.solar}%</b> em ${fmtData(antiga.a.data_auditoria)} → <b style="color:${scCorHex(solar)}">${solar}%</b> nesta auditoria.`
            : 'Série ainda sem Índice Solar comparável.';

        return `${h2('Histórico desta linha/máquina — últimas auditorias')}
        <div class="avoid-break" style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #0f172a;border-radius:8px;padding:10px 14px;margin-bottom:10px;font-size:11.5px;color:#334155;line-height:1.6">
            ${evolucao}
            ${acoes.length
                ? `Das <b>${acoes.length}</b> ações das auditorias anteriores: <b style="color:${VERDE}">${feitas.length} concluída(s)</b> e <b style="color:${abertas.length ? AMBAR : VERDE}">${abertas.length} em aberto</b>${vencidas.length ? ` — <b style="color:${VERMELHO}">${vencidas.length} fora do prazo</b>` : ''}.`
                : 'As auditorias anteriores não deixaram ações registradas.'}
        </div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;margin-bottom:16px">
            <thead><tr style="background:#f1f5f9">
                <th style="${thH};text-align:left">Relatório</th><th style="${thH};text-align:left">Data</th><th style="${thH};text-align:left">Auditor</th>
                <th style="${thH}">Índice Solar</th><th style="${thH}">5S</th><th style="${thH}">SOL</th>
                <th style="${thH}">Críticos</th><th style="${thH}">Ações</th></tr></thead>
            <tbody>${linhasHist}</tbody></table>
        ${acoes.length ? `<div style="font-size:12px;font-weight:900;color:#0f172a;margin:0 0 6px">Plano de ação das auditorias anteriores — o que foi feito e o que não foi</div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0">
            <thead><tr style="background:#f1f5f9">
                <th style="${thH};text-align:left">Auditoria</th><th style="${thH}">Pilar</th>
                <th style="${thH};text-align:left">Ação</th><th style="${thH};text-align:left">Responsável</th>
                <th style="${thH}">Situação</th></tr></thead>
            <tbody>${linhasAcoes}</tbody></table>` : ''}`;
    })();

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(aud.titulo)} · Relatório</title>
<style>
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    @page { size: A4; margin: 12mm 10mm; }
    @media print {
        html, body { background: #fff !important; margin: 0 !important; }
        .sheet { margin: 0 auto !important; box-shadow: none !important; border-radius: 0 !important; max-width: 100% !important; }
        .no-print { display: none !important; }

        /* overflow:hidden arredonda o card na tela, mas na impressão vira uma
           caixa que não quebra: o que passa do fim da página some. Some com ele. */
        .sheet, .bloco { overflow: visible !important; }
        .bloco { border-radius: 0 !important; }

        /* Blocos curtos (KPIs, resumo, radar, uma foto) ficam
           inteiros. Blocos longos NÃO levam esta classe — se um bloco maior que a
           página pede para não quebrar, o Chrome joga tudo para a página seguinte
           e deixa uma folha em branco para trás. */
        .avoid-break { page-break-inside: avoid; break-inside: avoid; }

        /* Faixa colorida do senso/pilar vira thead: quando a tabela atravessa a
           página, ela se repete no topo e o leitor não perde o contexto. */
        thead { display: table-header-group; }
        tfoot { display: table-footer-group; }
        tr, img { page-break-inside: avoid; break-inside: avoid; }

        /* Título nunca fica órfão no pé da página, nem sobra uma linha solta. */
        h2 { page-break-after: avoid; break-after: avoid; }
        p, td, div { orphans: 3; widows: 3; }

        .page-break { page-break-before: always; break-before: page; }
        .keep-next { page-break-after: avoid; break-after: avoid; }
        img { max-height: 150mm !important; }
    }
</style></head>
<body style="margin:0;background:#f3f4f6;font-family:'Segoe UI',Roboto,Arial,sans-serif">
<button class="no-print" onclick="window.print()" style="position:fixed;top:16px;right:16px;z-index:99;background:#16a34a;color:#fff;border:none;border-radius:8px;padding:10px 18px;font-size:13px;font-weight:800;cursor:pointer;box-shadow:0 4px 14px rgba(22,163,74,.4)">🖨️ Imprimir / Salvar PDF</button>
<div class="sheet" style="max-width:900px;margin:24px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,.1)">
    <div style="background:linear-gradient(120deg,#0d2818 55%,#7c2d12);padding:20px 30px;display:flex;justify-content:space-between;align-items:center;gap:14px">
        <div><h1 style="margin:0;color:#fff;font-size:20px;font-weight:900">Relatório 5S <span style="color:#fbbf24">+ SOL</span></h1>
        <p style="margin:3px 0 0;color:#fcd34d;font-size:10px;text-transform:uppercase;letter-spacing:1px;font-weight:700">5S + Programa SOL · Segurança · Organização · Limpeza</p></div>
        <div style="text-align:right;color:#cbd5e1;font-size:10px"><div style="font-size:13px;color:#fff;font-weight:900">${esc(aud.fabrica)} · ${esc(aud.setor)}${aud.maquina ? ` · ${esc(aud.maquina)}` : ''}</div><div>${esc(aud.planta)}</div><div>Monitoramento realizado em ${fmtData(aud.data_auditoria)}</div></div>
    </div>
    <div style="padding:22px 30px">
        <div style="font-size:15px;font-weight:900;color:#0f172a;margin-bottom:4px">${esc(aud.titulo)}</div>
        <div style="font-size:11px;color:#475569;margin-bottom:14px">Auditor: <b>${esc(aud.auditor) || '—'}</b>${aud.acompanhante ? ` · Acompanhante: <b>${esc(aud.acompanhante)}</b>` : ''} · Data: <b>${fmtData(aud.data_auditoria)}</b> · Status: <span style="font-weight:800;color:${aud.status === 'concluida' ? VERDE : AMBAR}">${aud.status === 'concluida' ? 'CONCLUÍDA' : 'EM ABERTO'}</span></div>

        <div class="avoid-break" style="display:flex;gap:10px;margin-bottom:6px">
            ${kpi(solar != null ? solar + '%' : '—', 'Índice Solar', tinta(selo.cor))}
            ${kpi(geral != null ? geral + '%' : '—', 'Score 5S', scCorHex(geral))}
            ${kpi(scSol.geral != null ? scSol.geral + '%' : '—', 'Score SOL', scCorHex(scSol.geral))}
            ${kpi(String(criticos.length), 'Críticos (≤2)', criticos.length ? VERMELHO : VERDE)}
            ${kpi(String(planosAbertos.length), 'Ações abertas', planosAbertos.length ? AMBAR : VERDE)}
        </div>

        ${(aud.analise_ia || '').trim() ? `${h2('Resumo Executivo')}
        <div class="avoid-break" style="background:#f0fdf4;border:1px solid #bbf7d0;border-left:4px solid ${VERDE};border-radius:8px;padding:12px 16px;margin-bottom:6px">
            ${aud.analise_ia.trim().split(/\n{2,}/).map(p => p.trim()).filter(Boolean).map(p => `<p style="margin:0 0 8px;font-size:12.5px;line-height:1.65;color:#334155">${esc(p)}</p>`).join('')}
        </div>` : ''}

        ${h2('Radar dos sensos')}
        <div class="avoid-break" style="display:flex;gap:24px;align-items:center;flex-wrap:wrap">
            <div style="flex-shrink:0">${radarSvg}</div>
            <div style="flex:1;min-width:280px">${barrasSensos}
                <div style="font-size:10px;color:#475569;margin-top:8px">Escala: ${ESCALA_5S.map(e => `<b>${e.nota}</b> ${e.rotulo} (${PONTOS_NOTA[e.nota]}%)`).join(' · ')}. A escala não é linear — só a nota 5 vale 100% do critério. Score do senso = média dos critérios.</div>
            </div>
        </div>

        ${scSol.geral != null ? `
        ${h2('Programa SOL — Segurança · Organização · Limpeza')}
        <div class="avoid-break" style="display:flex;gap:24px;align-items:center;flex-wrap:wrap;background:linear-gradient(120deg,#fff7ed,#fff);border:1px solid #fed7aa;border-radius:10px;padding:16px">
            <div style="flex-shrink:0;text-align:center">${solSvg}<div style="font-size:13px;font-weight:900;color:${tinta(selo.cor)};margin-top:6px">${solar}% · ${selo.label}</div></div>
            <div style="flex:1;min-width:280px">${barrasSol}
                <div style="font-size:10.5px;color:#7c2d12;margin-top:8px;font-style:italic">“${selo.frase}”</div>
                <div style="font-size:10px;color:#475569;margin-top:4px">Índice Solar = média do Score 5S com o Score SOL. SOL = Segurança · Organização · Limpeza (mesma escala 0–5).</div>
            </div>
        </div>
        ${h2('Detalhamento por pilar SOL')}
        ${solDetalheHtml}` : ''}

        ${h2('Detalhamento por senso (5S)')}
        ${detalheHtml}

        ${planos.length ? h2(`Plano de Ação 5S + SOL (${planos.length - planosAbertos.length}/${planos.length} concluídas${renovadas.length ? ` · ${renovadas.length} renovada(s) de auditoria anterior` : ''})`) + `
        <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0">
            <thead><tr style="background:#f1f5f9"><th style="padding:6px 10px;font-size:10px;color:#475569">Pilar</th><th style="padding:6px 10px;font-size:10px;text-align:left;color:#475569">Ação</th><th style="padding:6px 10px;font-size:10px;text-align:left;color:#475569">Responsável</th><th style="padding:6px 10px;font-size:10px;color:#475569">Status</th></tr></thead>
            <tbody>${planoRows}</tbody></table>` : ''}

        ${historicoSecao}

        ${galleryHtml}

        <div style="margin-top:28px;padding-top:12px;border-top:1px solid #e2e8f0;text-align:center;color:#475569;font-size:10px;font-weight:700">Documento gerado automaticamente · ${nowStr}</div>
    </div>
</div></body></html>`;

    const nomeArquivo = `5S_${String(aud.fabrica || '').replace(/[^a-z0-9]/gi, '_')}_${String(aud.setor || '').replace(/[^a-z0-9]/gi, '_')}${aud.maquina ? '_' + String(aud.maquina).replace(/[^a-z0-9]/gi, '_') : ''}_${nowStr.replace(/\//g, '-')}.html`;
    return { html, nomeArquivo };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  VISUALIZADOR DO RELATÓRIO (overlay em tela cheia)
// ═══════════════════════════════════════════════════════════════════════════════
/*
 * Antes o relatório era despachado direto: `window.open` de uma blob URL mais um
 * link de download. No tablet isso não mostra nada — a WebView do Android ignora
 * a blob URL, e o navegador do tablet bloqueia a aba nova por ser popup. Sem erro
 * na tela, o auditor apertava o botão e não acontecia nada.
 *
 * Agora o relatório é sempre renderizado aqui dentro, num iframe, onde funciona em
 * qualquer aparelho. Baixar/compartilhar e imprimir viram ações explícitas, e se
 * alguma delas falhar o motivo aparece na barra em vez de sumir no console.
 */
const RelatorioViewer = ({ html, nomeArquivo, onClose }) => {
    const isMobile = useIsMobile();
    const iframeRef = useRef(null);
    const [entregando, setEntregando] = useState(false);
    const [aviso, setAviso] = useState('');

    const imprimir = () => {
        const win = iframeRef.current?.contentWindow;
        if (!win) return;
        try { win.focus(); win.print(); }
        catch (e) { console.error('[relatorio:print]', e); setAviso('Este aparelho não imprime daqui. Use "Salvar / Enviar" e imprima pelo Chrome.'); }
    };

    const salvar = async () => {
        setEntregando(true); setAviso('');
        try {
            const { modo } = await entregarRelatorio(html, nomeArquivo);
            if (modo === 'navegador') setAviso('Arquivo baixado. Procure em Downloads.');
        } catch (e) {
            console.error('[relatorio:salvar]', e);
            setAviso('Não foi possível salvar o arquivo neste aparelho. O relatório continua visível aqui.');
        } finally { setEntregando(false); }
    };

    const btn = { display: 'flex', alignItems: 'center', gap: '0.4rem', border: '1px solid var(--border-color-dark)', background: 'rgba(255,255,255,0.06)', color: 'var(--color-text-main)', borderRadius: 9, padding: '0.5rem 0.9rem', fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer' };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: '#0b0f14', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', padding: isMobile ? '0.6rem 0.7rem' : '0.7rem 1.1rem', borderBottom: '1px solid var(--border-color-dark)' }}>
                <button onClick={onClose} style={{ ...btn, background: 'none', border: 'none' }}><FaArrowLeft size={14} /> Voltar</button>
                <div style={{ flex: 1, minWidth: 0, fontSize: '0.74rem', fontWeight: 800, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Relatório 5S + SOL</div>
                <button onClick={imprimir} style={btn}><FaFilePdf size={12} /> Imprimir / PDF</button>
                <button onClick={salvar} disabled={entregando} style={{ ...btn, background: `${ACCENT}22`, borderColor: `${ACCENT}66`, color: ACCENT, opacity: entregando ? 0.6 : 1 }}>
                    {entregando ? <FaSpinner size={12} className="spin" /> : <FaSave size={12} />} Salvar / Enviar
                </button>
            </div>
            {aviso && (
                <div style={{ flexShrink: 0, fontSize: '0.7rem', color: '#FCD34D', background: '#F59E0B1a', borderBottom: '1px solid #F59E0B44', padding: '0.5rem 1.1rem', lineHeight: 1.45 }}>{aviso}</div>
            )}
            <iframe ref={iframeRef} srcDoc={html} title="Relatório 5S + SOL" style={{ flex: 1, width: '100%', border: 'none', background: '#e2e8f0' }} />
        </div>
    );
};

// Guarda o relatório aberto e devolve [overlay, abrir]. Cada tela que gera relatório usa o seu.
const useRelatorioViewer = () => {
    const [rel, setRel] = useState(null);
    const overlay = rel ? <RelatorioViewer html={rel.html} nomeArquivo={rel.nomeArquivo} onClose={() => setRel(null)} /> : null;
    return [overlay, setRel];
};

// ═══════════════════════════════════════════════════════════════════════════════
//  WORKSPACE DA AUDITORIA (overlay em tela cheia)
// ═══════════════════════════════════════════════════════════════════════════════
const Auditoria5S = ({ aud, onClose, onSave, saving, historico = [] }) => {
    const isMobile = useIsMobile();
    const [respostas, setRespostas] = useState(aud.respostas || {});
    const [observacoes, setObservacoes] = useState(aud.observacoes || {});
    const [fotos, setFotos] = useState(aud.fotos || {});
    const [planos, setPlanos] = useState(aud.planos || []);
    const [analiseIa, setAnaliseIa] = useState(aud.analise_ia || '');
    const [infoItem, setInfoItem] = useState(null);
    const [relViewer, abrirRelatorio] = useRelatorioViewer();
    const fileRefs = useRef({});

    const countResp = (grupos) => grupos.reduce((s, x) => s + x.itens.filter(it => !it.emAvaliacao && !it.desabilitado && respostas[it.id] != null && respostas[it.id] !== '').length, 0);
    const total5S = SENSOS.reduce((s, x) => s + x.itens.filter(it => !it.emAvaliacao && !it.desabilitado).length, 0);
    const totalSOL = SOL_PILARES.reduce((s, x) => s + x.itens.filter(it => !it.emAvaliacao && !it.desabilitado).length, 0);
    const totalItens = total5S + totalSOL;
    const respondidos = countResp(SENSOS) + countResp(SOL_PILARES);
    const sc = scores5S(respostas);           // 5S (radar + geral)
    const scSol = scoresSOL(respostas);        // SOL (3 pilares + geral)
    const solar = indiceSolar(sc.geral, scSol.geral); // índice combinado

    // ── Pendências das auditorias anteriores ────────────────────────────────
    // Ação proposta e não concluída não morre no relatório antigo: o auditor a
    // renova aqui e ela entra neste plano marcada como reincidente. O registro
    // antigo fica intacto — ele é a prova de que a ação foi proposta e não feita.
    const pendenciasAnteriores = (historico || [])
        .flatMap(a => (a.planos || []).filter(p => p.status !== 'concluida').map(p => ({ p, a })))
        .sort((x, y) => String(x.p.prazo || '9999-12-31').localeCompare(String(y.p.prazo || '9999-12-31')));
    const jaRenovada = (p) => planos.some(x => x.origem?.plano_id === p.id);
    const renovarAcao = (p, a) => setPlanos(prev => [...prev, {
        id: uid(), senso: p.senso, descricao: p.descricao, resp: p.resp, prazo: '', status: 'aberta',
        vez: (Number(p.vez) || 1) + 1,
        origem: { plano_id: p.id, auditoria_id: a.id, data: a.data_auditoria, prazo: p.prazo || null },
    }]);

    const setNota = (itemId, n) => setRespostas(p => ({ ...p, [itemId]: p[itemId] === n ? null : n }));
    const capture = async (itemId, e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const push = (src) => setFotos(p => ({ ...p, [itemId]: [...(p[itemId] || []), src] }));
        try {
            const blob = await compressImage(file, 900, 0.6);
            const rd = new FileReader(); rd.onload = ev => push(ev.target.result); rd.readAsDataURL(blob);
        } catch {
            const rd = new FileReader(); rd.onload = ev => push(ev.target.result); rd.readAsDataURL(file);
        }
        e.target.value = '';
    };

    const doSave = (concluir) => {
        onSave({
            ...aud, respostas, observacoes, fotos, planos, analise_ia: analiseIa,
            score: sc.geral, scores: scoresIntegrado(respostas), // 5S + SOL + solar no jsonb
            status: concluir ? 'concluida' : aud.status,
        });
    };

    // Render de um grupo avaliável (senso do 5S OU pilar do SOL) — mesma UX
    const renderGrupo = (g, scoreVal) => (
        <div key={g.id} style={{ marginBottom: '1.4rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                <span style={{ background: g.cor, color: '#fff', fontWeight: 900, fontSize: '0.72rem', padding: '0.26rem 0.9rem', borderRadius: 7, letterSpacing: '0.5px' }}>{g.num} · {g.nome}</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 900, color: scoreCor(scoreVal) }}>{scoreVal != null ? `${scoreVal}%` : '—'}</span>
                <div style={{ flex: 1, height: 2, borderRadius: 2, background: `linear-gradient(90deg, ${g.cor}55, transparent)`, minWidth: 30 }} />
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginBottom: '0.6rem' }}>{g.conceito}</div>
            {g.itens.map(it => {
                const emAvaliacao = Boolean(it.emAvaliacao || it.desabilitado);
                const nota = respostas[it.id];
                const critico = !emAvaliacao && nota != null && nota <= 2;
                return (
                    <div key={it.id} style={{ background: 'var(--bg-surface-glass)', border: `1px solid ${critico ? '#DC262655' : 'var(--border-color-dark)'}`, borderRadius: 10, padding: '0.7rem 0.85rem', marginBottom: '0.55rem', opacity: emAvaliacao ? 0.9 : 1 }}>
                        <div style={{ display: 'flex', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? '0.5rem' : '0.9rem', flexDirection: isMobile ? 'column' : 'row' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-main)' }}>{it.label}</span>
                                    {emAvaliacao && (
                                        <button
                                            type="button"
                                            onClick={() => setInfoItem(it)}
                                            title="Clique para ver o status deste critério"
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.35)', borderRadius: 6, padding: '0.12rem 0.45rem', color: '#60A5FA', fontSize: '0.62rem', fontWeight: 800, cursor: 'pointer', letterSpacing: '0.3px', textTransform: 'uppercase' }}
                                        >
                                            <FaInfoCircle size={10} /> Em avaliação
                                        </button>
                                    )}
                                </div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginTop: 2, lineHeight: 1.3 }}>{it.desc}</div>
                            </div>
                            {emAvaliacao ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(255,255,255,0.03)', border: '1px dashed var(--border-color-dark)', borderRadius: 8, padding: '0.4rem 0.75rem', color: 'var(--color-text-muted)', fontSize: '0.72rem', fontWeight: 700, flexShrink: 0 }}>
                                    <button
                                        type="button"
                                        onClick={() => setInfoItem(it)}
                                        style={{ background: 'none', border: 'none', color: '#60A5FA', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', padding: 0, fontSize: '0.72rem', fontWeight: 700 }}
                                        title="Clique para mais detalhes"
                                    >
                                        <FaInfoCircle size={12} />
                                        <span>Não pontuável</span>
                                    </button>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                                    {[0, 1, 2, 3, 4, 5].map(n => (
                                        <button key={n} onClick={() => setNota(it.id, n)} title={`${n} · ${ESCALA_5S[n].rotulo}: ${ESCALA_5S[n].desc}`}
                                            style={{ flex: isMobile ? 1 : 'none', width: isMobile ? 'auto' : 38, height: isMobile ? 42 : 36, borderRadius: 8, border: `1.5px solid ${nota === n ? notaCor(n) : 'var(--border-color-dark)'}`, background: nota === n ? notaCor(n) : 'transparent', color: nota === n ? '#fff' : 'var(--color-text-muted)', fontSize: '0.82rem', fontWeight: 900, cursor: 'pointer', transition: 'all 0.12s' }}>{n}</button>
                                    ))}
                                </div>
                            )}
                        </div>
                        {critico && (
                            <div style={{ marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                                <textarea value={observacoes[it.id] || ''} onChange={e => setObservacoes(p => ({ ...p, [it.id]: e.target.value }))}
                                    placeholder="Descreva o desvio encontrado (nota ≤ 2)…" rows={2}
                                    style={{ width: '100%', background: 'var(--bg-app)', border: '1px solid #DC262644', borderRadius: 8, padding: '0.5rem 0.7rem', color: 'var(--color-text-main)', fontSize: '0.76rem', resize: 'vertical', outline: 'none' }} />
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
                                    <input ref={el => fileRefs.current[it.id] = el} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => capture(it.id, e)} />
                                    <button onClick={() => fileRefs.current[it.id]?.click()} style={{ ...btnSec, fontSize: '0.7rem', padding: '0.32rem 0.7rem' }}><FaCamera size={10} /> Foto</button>
                                    {(fotos[it.id] || []).map((src, idx) => (
                                        <div key={idx} style={{ position: 'relative' }}>
                                            <img src={src} alt="" style={{ width: 42, height: 42, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border-color-dark)' }} />
                                            <button onClick={() => setFotos(p => ({ ...p, [it.id]: p[it.id].filter((_, i) => i !== idx) }))} style={{ position: 'absolute', top: -6, right: -6, width: 17, height: 17, borderRadius: '50%', background: '#DC2626', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FaTimes size={7} /></button>
                                        </div>
                                    ))}
                                    <button onClick={() => setPlanos(p => [...p, { id: uid(), senso: g.id, descricao: `${it.label}: `, resp: '', prazo: '', status: 'aberta' }])} style={{ ...btnSec, fontSize: '0.7rem', padding: '0.32rem 0.7rem', borderColor: '#D9770666', color: '#D97706' }}><FaBolt size={10} /> Gerar ação</button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 5000, background: 'var(--bg-app)', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ flexShrink: 0, padding: '0.9rem 1.2rem', borderBottom: '1px solid var(--border-color-dark)', display: 'flex', alignItems: 'center', gap: '0.9rem', background: 'rgba(0,0,0,0.25)', flexWrap: 'wrap' }}>
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 700 }}><FaArrowLeft size={14} /> Voltar</button>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 900, color: 'var(--color-text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <FaBroom color={ACCENT} /> {aud.titulo}
                    </div>
                    <div style={{ fontSize: '0.64rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span>{respondidos}/{totalItens} critérios · Auditor: {aud.auditor || '—'}</span>
                        <span style={{ display: 'inline-flex', gap: '0.4rem' }}>
                            <span style={{ color: ACCENT, fontWeight: 800 }}>5S {sc.geral != null ? `${sc.geral}%` : '—'}</span>
                            <span style={{ color: SOL_ACCENT, fontWeight: 800 }}>SOL {scSol.geral != null ? `${scSol.geral}%` : '—'}</span>
                        </span>
                    </div>
                </div>
                {!isMobile && <SolNascente value={solar} size={116} label={false} />}
                {!isMobile && <Radar5S scores={sc} size={100} mini />}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <RingGauge value={solar} size={52} stroke={6} />
                    <span style={{ fontSize: '0.5rem', fontWeight: 800, letterSpacing: '0.5px', color: 'var(--color-text-subtle)' }}>SOLAR</span>
                </div>
            </div>

            {/* Corpo */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.2rem 6.5rem' }}>
                {/* Legenda da escala — mostra quanto cada nota vale de fato (curva progressiva) */}
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                    {ESCALA_5S.map(e => (
                        <span key={e.nota} title={`${e.desc} · vale ${PONTOS_NOTA[e.nota]}% do critério`} style={{ fontSize: '0.62rem', fontWeight: 700, color: notaCor(e.nota), border: `1px solid ${notaCor(e.nota)}55`, background: `${notaCor(e.nota)}12`, borderRadius: 6, padding: '0.18rem 0.5rem', cursor: 'help' }}>
                            {e.nota} · {e.rotulo} <span style={{ opacity: 0.75, fontWeight: 800 }}>{PONTOS_NOTA[e.nota]}%</span>
                        </span>
                    ))}
                </div>
                <div style={{ fontSize: '0.6rem', color: 'var(--color-text-subtle)', marginBottom: '1.1rem', lineHeight: 1.45 }}>
                    A escala não é linear: o valor cresce no topo, então só a nota 5 entrega 100% do critério.
                </div>

                {/* ── Bloco 5S ── */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 0.9rem' }}>
                    <FaBroom color={ACCENT} size={13} />
                    <span style={{ fontSize: '0.78rem', fontWeight: 900, letterSpacing: '0.5px', color: ACCENT }}>PROGRAMA 5S</span>
                    <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${ACCENT}55, transparent)` }} />
                </div>
                {SENSOS.map(senso => renderGrupo(senso, sc[senso.id]))}

                {/* ── Bloco SOL ── */}
                <div style={{ marginTop: '0.5rem', marginBottom: '1rem', borderRadius: 14, border: `1px solid ${SOL_ACCENT}44`, background: `linear-gradient(135deg, ${SOL_ACCENT}14, transparent 55%)`, padding: '0.9rem 1rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <SolNascente value={solar} size={132} />
                    <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ fontSize: '0.95rem', fontWeight: 900, color: SOL_ACCENT, display: 'flex', alignItems: 'center', gap: '0.4rem' }}><FaSun /> Programa SOL · Segurança · Organização · Limpeza</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-main)', fontWeight: 700, marginTop: 2 }}>Segurança · Organização · Limpeza</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginTop: 4, lineHeight: 1.4 }}>{solSelo(solar).frase}</div>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                            {SOL_PILARES.map(p => (
                                <span key={p.id} style={{ fontSize: '0.62rem', fontWeight: 800, color: p.cor, background: `${p.cor}18`, border: `1px solid ${p.cor}55`, borderRadius: 6, padding: '0.15rem 0.5rem' }}>{p.num} {p.nome.split(' & ')[0]} {scSol[p.id] != null ? `${scSol[p.id]}%` : '—'}</span>
                            ))}
                        </div>
                    </div>
                </div>
                {SOL_PILARES.map(pilar => renderGrupo(pilar, scSol[pilar.id]))}

                {/* Pendências das auditorias anteriores — renovar o que não foi feito */}
                {pendenciasAnteriores.length > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', color: '#DC2626', marginBottom: '0.35rem' }}>
                            Pendências de auditorias anteriores ({pendenciasAnteriores.length})
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginBottom: '0.55rem', lineHeight: 1.5 }}>
                            Ações propostas nesta linha/máquina e não concluídas. <b>Renovar</b> traz a ação para o plano desta auditoria, destacada como reincidente no relatório — o registro antigo continua como está.
                        </div>
                        {pendenciasAnteriores.map(({ p, a }) => {
                            const s = DIM_BY_ID[p.senso] || SENSOS[0];
                            const renovada = jaRenovada(p);
                            const atrasada = p.prazo && String(p.prazo).slice(0, 10) < hojeISO();
                            return (
                                <div key={`${a.id}_${p.id}`} style={{ background: 'var(--bg-surface-glass)', border: '1px solid var(--border-color-dark)', borderLeft: `4px solid ${atrasada ? '#DC2626' : '#D97706'}`, borderRadius: 10, padding: '0.55rem 0.75rem', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', opacity: renovada ? 0.6 : 1 }}>
                                    <span style={{ fontSize: '0.58rem', fontWeight: 900, color: '#fff', background: s.cor, padding: '0.1rem 0.45rem', borderRadius: 7 }}>{s.num}</span>
                                    <div style={{ flex: 1, minWidth: 180 }}>
                                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-main)' }}>{p.descricao || '—'}</div>
                                        <div style={{ fontSize: '0.64rem', color: 'var(--color-text-subtle)', marginTop: '0.1rem' }}>
                                            auditoria de {fmtData(a.data_auditoria)} · {p.resp || 'sem responsável'}{p.prazo ? ` · prazo ${fmtData(p.prazo)}` : ''}
                                            {atrasada && <span style={{ color: '#DC2626', fontWeight: 800 }}> · VENCIDA</span>}
                                        </div>
                                    </div>
                                    <button onClick={() => renovarAcao(p, a)} disabled={renovada}
                                        style={{ ...btnSec, fontSize: '0.68rem', padding: '0.3rem 0.7rem', borderColor: renovada ? 'var(--border-color-dark)' : '#DC262655', color: renovada ? 'var(--color-text-subtle)' : '#F87171', cursor: renovada ? 'default' : 'pointer' }}>
                                        {renovada ? 'Renovada' : 'Renovar'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Plano de ação 5S + SOL */}
                <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', color: '#D97706', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><FaClipboardCheck size={11} /> Plano de Ação 5S + SOL ({planos.length})</span>
                        <button onClick={() => setPlanos(p => [...p, { id: uid(), senso: 'seiri', descricao: '', resp: '', prazo: '', status: 'aberta' }])} style={{ ...btnSec, fontSize: '0.68rem', padding: '0.3rem 0.7rem' }}><FaPlus size={9} /> Adicionar</button>
                    </div>
                    {planos.map(pl => {
                        const s = DIM_BY_ID[pl.senso] || SENSOS[0];
                        const done = pl.status === 'concluida';
                        return (
                            <div key={pl.id} style={{ background: pl.origem && !done ? 'rgba(220,38,38,0.07)' : 'var(--bg-surface-glass)', border: `1px solid ${done ? '#16A34A44' : pl.origem ? '#DC262655' : 'var(--border-color-dark)'}`, borderLeft: `4px solid ${s.cor}`, borderRadius: 10, padding: '0.65rem 0.8rem', marginBottom: '0.5rem', opacity: done ? 0.75 : 1, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'auto 2fr 1fr auto auto', gap: '0.5rem', alignItems: 'end' }}>
                                {pl.origem && (
                                    <div style={{ gridColumn: '1 / -1', fontSize: '0.6rem', fontWeight: 900, letterSpacing: '0.5px', color: done ? '#16A34A' : '#F87171' }}>
                                        RENOVADA · {Number(pl.vez) || 2}ª VEZ · PENDENTE DESDE {fmtData(pl.origem.data)}{pl.origem.prazo ? ` · PRAZO ORIGINAL ${fmtData(pl.origem.prazo)}` : ''}
                                    </div>
                                )}
                                <div><label style={labelSty}>Pilar</label>
                                    <select style={{ ...inputSty, padding: '0.35rem 0.5rem' }} value={pl.senso} onChange={e => setPlanos(p => p.map(x => x.id === pl.id ? { ...x, senso: e.target.value } : x))}>
                                        <optgroup label="5S">{SENSOS.map(x => <option key={x.id} value={x.id}>{x.num}</option>)}</optgroup>
                                        <optgroup label="SOL">{SOL_PILARES.map(x => <option key={x.id} value={x.id}>SOL·{x.num}</option>)}</optgroup>
                                    </select></div>
                                <div><label style={labelSty}>Ação</label><input style={inputSty} value={pl.descricao} onChange={e => setPlanos(p => p.map(x => x.id === pl.id ? { ...x, descricao: e.target.value } : x))} /></div>
                                <div><label style={labelSty}>Responsável</label><input style={inputSty} value={pl.resp} onChange={e => setPlanos(p => p.map(x => x.id === pl.id ? { ...x, resp: e.target.value } : x))} /></div>
                                <button onClick={() => setPlanos(p => p.map(x => x.id === pl.id ? { ...x, status: done ? 'aberta' : 'concluida' } : x))}
                                    style={{ padding: '0.45rem 0.7rem', borderRadius: 7, border: 'none', background: done ? '#16A34A' : '#D97706', color: '#fff', fontSize: '0.66rem', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}>{done ? '✓ Feita' : 'Concluir'}</button>
                                <button onClick={() => setPlanos(p => p.filter(x => x.id !== pl.id))} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', padding: '0.35rem', justifySelf: 'end' }}><FaTrash size={11} /></button>
                            </div>
                        );
                    })}
                </div>

            </div>

            {/* Rodapé */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: isMobile ? '0.7rem 0.8rem' : '0.85rem 1.2rem', borderTop: '1px solid var(--border-color-dark)', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', gap: '0.7rem', flexWrap: 'wrap' }}>
                <div style={{ flex: isMobile ? '1 1 100%' : 1, fontSize: '0.7rem', color: 'var(--color-text-muted)', order: isMobile ? -1 : 0, display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    {respondidos === totalItens ? <span style={{ color: '#16A34A', fontWeight: 700 }}>✓ Tudo avaliado · 5S {sc.geral}% · SOL {scSol.geral}%</span> : <span>Faltam {totalItens - respondidos} critérios</span>}
                    <SolSeloPill value={solar} />
                </div>
                <button onClick={() => abrirRelatorio(montarRelatorio5S({ ...aud, respostas, observacoes, fotos, planos, score: sc.geral, scores: scoresIntegrado(respostas) }, historico))}
                    style={{ ...btnSec, flex: isMobile ? 1 : 'none', justifyContent: 'center', padding: '0.62rem 1rem' }} title="Gerar relatório analítico (imprimir/PDF)">
                    <FaFilePdf size={11} color="#DC2626" /> Relatório
                </button>
                <button onClick={() => doSave(false)} disabled={saving} style={{ ...btnSec, flex: isMobile ? 1 : 'none', justifyContent: 'center', padding: '0.62rem 1.1rem' }}>Salvar rascunho</button>
                <button onClick={() => doSave(true)} disabled={saving || respondidos < totalItens} title={respondidos < totalItens ? 'Avalie todos os critérios para concluir' : ''}
                    style={{ ...btnPrim, flex: isMobile ? 1.3 : 'none', opacity: (saving || respondidos < totalItens) ? 0.55 : 1 }}>
                    {saving ? <FaSync className="spin" size={12} /> : <FaCheckCircle size={13} />} Concluir auditoria
                </button>
            </div>
            {/* Modal de informação sobre item em avaliação */}
            {infoItem && (
                <ModalShell
                    title="Item em Avaliação"
                    onClose={() => setInfoItem(null)}
                    footer={<button onClick={() => setInfoItem(null)} style={btnPrim}>Entendido</button>}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(59, 130, 246, 0.18)', color: '#60A5FA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <FaInfoCircle size={20} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--color-text-main)' }}>{infoItem.label}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{infoItem.desc}</div>
                            </div>
                        </div>
                        <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color-dark)', borderRadius: 10, padding: '0.9rem 1rem', fontSize: '0.82rem', color: 'var(--color-text-main)', lineHeight: 1.5 }}>
                            ℹ️ <b>Status do critério:</b> {infoItem.infoMsg || 'Este item está temporariamente em avaliação. Ele permanece visível para consulta, mas não é pontuável nem contabilizado no cálculo dos scores da auditoria nesta fase.'}
                        </div>
                    </div>
                </ModalShell>
            )}

            {relViewer}

            <style>{`@keyframes spin{to{transform:rotate(360deg)}}.spin{animation:spin 1s linear infinite}`}</style>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export default function Gestao5SView() {
    const isMobile = useIsMobile();
    const userName = getUsuario();

    const [auditorias, setAuditorias] = useState([]);
    const [estrutura, setEstrutura] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('mapa'); // mapa | auditorias | indicadores
    const [sel, setSel] = useState(null);
    const [saving, setSaving] = useState(false);
    const [showNova, setShowNova] = useState(false);
    const [novaPrefill, setNovaPrefill] = useState(null);
    const [msg, setMsg] = useState(null);
    const [confirmDel, setConfirmDel] = useState(null);
    const [periodo, setPeriodo] = useState('tudo'); // tudo | mes | mes_passado | 3m | ano | custom
    const [pDe, setPDe] = useState('');
    const [pAte, setPAte] = useState('');
    const [openSetores, setOpenSetores] = useState(() => new Set()); // setores expandidos no mapa (recolhidos por padrão)
    const toggleSetor = (k) => setOpenSetores(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });
    const [collapsedAud, setCollapsedAud] = useState(() => new Set()); // setores recolhidos na aba Auditorias (abertos por padrão)
    const toggleAud = (k) => setCollapsedAud(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });
    const [relViewer, abrirRelatorio] = useRelatorioViewer();
    const [buscaSetorRank, setBuscaSetorRank] = useState('');
    // Auditorias marcadas na aba Auditorias para o comparativo de evolução
    const [selecao, setSelecao] = useState(() => new Set());
    const [showEvolucao, setShowEvolucao] = useState(false);
    const toggleSelecao = (id) => setSelecao(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

    const showMsg = (text, type = 'success') => { setMsg({ text, type }); setTimeout(() => setMsg(null), 2800); };

    const load = useCallback(async () => {
        setLoading(true);
        const [{ data: auds }, estRes] = await Promise.all([
            supabase.from('cinco_s_auditoria').select('*').order('updated_at', { ascending: false }),
            supabase.from('cadastro_planta_area').select('id, planta, fabrica, setor, maquina, tipo, linha_id'),
        ]);
        // Banco sem as colunas de linha (schema.sql ainda não rodado): lê o básico.
        let est = estRes.data;
        if (estRes.error) ({ data: est } = await supabase.from('cadastro_planta_area').select('id, planta, fabrica, setor, maquina'));

        const audsTratadas = (auds || []).map(tratarAuditoria);
        
        setAuditorias(audsTratadas);
        setEstrutura(est || []);
        setLoading(false);
    }, []);
    useEffect(() => {
        load();
        const channel = supabase
            .channel('cinco_s_auditoria_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'cinco_s_auditoria' }, () => {
                load();
            })
            .subscribe();
        return () => {
            supabase.removeChannel(channel);
        };
    }, [load]);

    const saveAuditoria = async (aud) => {
        setSaving(true);
        const maquinaAlvo = aud.maquina || extractMaquina(aud);
        let payload = {
            titulo: aud.titulo, planta: aud.planta, fabrica: aud.fabrica, setor: aud.setor, maquina: maquinaAlvo ?? null,
            auditor: aud.auditor, acompanhante: aud.acompanhante, data_auditoria: aud.data_auditoria,
            status: aud.status, respostas: aud.respostas, observacoes: aud.observacoes, fotos: aud.fotos,
            planos: aud.planos, score: aud.score, scores: aud.scores, analise_ia: aud.analise_ia ?? null,
            criado_por: aud.criado_por || userName,
        };
        // Grava; se alguma coluna nova (analise_ia / maquina) ainda não existe
        // no banco, remove a coluna reclamada e regrava (rode o database/schema.sql p/ persistir tudo).
        const write = (pl) => aud.id
            ? supabase.from('cinco_s_auditoria').update(pl).eq('id', aud.id).select().single()
            : supabase.from('cinco_s_auditoria').insert([pl]).select().single();
        let data, error, faltou = false;
        for (let i = 0; i < 3; i++) {
            ({ data, error } = await write(payload));
            if (!error) break;
            const col = (error.message || '').match(/'([a-z_]+)' column|column [^.]*\.?([a-z_]+) does not exist/i);
            const nome = col && (col[1] || col[2]);
            if (nome && nome in payload) { const { [nome]: _drop, ...rest } = payload; payload = rest; faltou = true; continue; }
            break;
        }
        if (!error && faltou) showMsg('Salvo — mas falta coluna no banco (rode database/schema.sql p/ guardar resumo/máquina)', 'success');
        if (error) { setSaving(false); showMsg('Erro: ' + error.message, 'error'); return; }
        const saved = tratarAuditoria({ ...aud, ...data, maquina: maquinaAlvo });
        setAuditorias(prev => aud.id ? prev.map(a => a.id === saved.id ? saved : a) : [saved, ...prev]);
        setSaving(false);
        setSel(null);
        showMsg(aud.status === 'concluida' ? `Auditoria concluída · ${aud.score}% 🧹` : 'Rascunho salvo');
    };

    const criarAuditoria = ({ planta, fabrica, setor, maquina, auditor, acompanhante }) => {
        let max = 0;
        auditorias.forEach(a => { const m = String(a.titulo || '').match(/Nº\s*(\d+)/i); if (m) max = Math.max(max, parseInt(m[1], 10)); });
        const num = String(Math.max(max, auditorias.length) + 1).padStart(3, '0');
        const mes = new Date().toLocaleDateString('pt-BR', { month: 'long' });
        const alvo = `${setor}${maquina ? ` · ${maquina}` : ''}`;
        const titulo = `5S Nº ${num} · ${fabrica} · ${alvo} · ${mes.charAt(0).toUpperCase()}${mes.slice(1)}/${new Date().getFullYear()}`;
        setShowNova(false);
        setNovaPrefill(null);
        setSel({ titulo, planta, fabrica, setor, maquina: maquina || null, auditor: auditor || userName, acompanhante, data_auditoria: hojeISO(), status: 'aberta', respostas: {}, observacoes: {}, fotos: {}, planos: [], criado_por: userName });
    };

    const excluir = async (a) => {
        await supabase.from('cinco_s_auditoria').delete().eq('id', a.id);
        setAuditorias(prev => prev.filter(x => x.id !== a.id));
        setConfirmDel(null);
    };

    // ── Filtro de período (afeta mapa, lista e indicadores) ──
    const periodoBounds = (() => {
        const hoje = new Date(); const y = hoje.getFullYear(), m = hoje.getMonth();
        const iso = (d) => d.toISOString().slice(0, 10);
        if (periodo === 'mes') return { de: iso(new Date(y, m, 1)), ate: iso(new Date(y, m + 1, 0)) };
        if (periodo === 'mes_passado') return { de: iso(new Date(y, m - 1, 1)), ate: iso(new Date(y, m, 0)) };
        if (periodo === '3m') return { de: iso(new Date(y, m - 2, 1)), ate: iso(new Date(y, m + 1, 0)) };
        if (periodo === 'ano') return { de: `${y}-01-01`, ate: `${y}-12-31` };
        if (periodo === 'custom') return { de: pDe || null, ate: pAte || null };
        return { de: null, ate: null };
    })();
    const dentroPeriodo = (a) => {
        if (!periodoBounds.de && !periodoBounds.ate) return true;
        const d = String(a.data_auditoria || a.created_at || '').slice(0, 10);
        if (!d) return false;
        if (periodoBounds.de && d < periodoBounds.de) return false;
        if (periodoBounds.ate && d > periodoBounds.ate) return false;
        return true;
    };
    const periodoLabel = { tudo: 'Todo o período', mes: 'Este mês', mes_passado: 'Mês passado', '3m': 'Últimos 3 meses', ano: 'Este ano', custom: 'Personalizado' }[periodo];
    const fmtBound = (d) => d ? fmtData(d) : '…';

    // ── Mapa das áreas: cruza cadastro (plantas/setores) com últimas auditorias ──
    const auditoriasFiltradas = auditorias.filter(dentroPeriodo);
    const concluidas = auditoriasFiltradas.filter(a => a.status === 'concluida');
    // Índice solar. `solar_bruto` vem das auditorias gravadas enquanto o veto de
    // segurança existiu e traz o índice sem o teto; `score` é o fallback das
    // auditorias antigas, que só tinham 5S.
    const solarDe = (aud) => aud?.scores?.solar_bruto ?? aud?.scores?.solar ?? aud?.score ?? null;
    // Áreas até o nível de LINHA/MÁQUINA. Onde o setor tem linhas/máquinas
    // cadastradas, cada uma vira uma área; setores sem máquinas ficam como "setor inteiro".
    const areasCadastro = [];
    const seen = new Set();
    const setorTemMaquina = new Set();
    estrutura.forEach(e => {
        if (e.fabrica && e.setor && e.maquina) {
            setorTemMaquina.add(`${norm(e.planta)}|${norm(e.fabrica)}|${norm(e.setor)}`);
        }
    });
    estrutura.forEach(e => {
        if (!e.fabrica || !e.setor) return;
        // Máquina que compõe uma linha é auditada dentro da linha, não sozinha
        if (emLinha(estrutura, e)) return;
        const setorK = `${norm(e.planta)}|${norm(e.fabrica)}|${norm(e.setor)}`;
        // pula a linha "setor sem máquina" quando o setor possui máquinas cadastradas
        if (!e.maquina && setorTemMaquina.has(setorK)) return;
        const k = `${setorK}|${norm(e.maquina)}`;
        if (seen.has(k)) return;
        seen.add(k);
        areasCadastro.push({ planta: e.planta, fabrica: e.fabrica, setor: e.setor, maquina: e.maquina || null });
    });

    // Inclui dinamicamente qualquer área/máquina presente nas auditorias (garante que novas auditorias atualizem o mapa na hora)
    auditorias.forEach(a => {
        if (!a.fabrica || !a.setor) return;
        const maq = a.maquina || extractMaquina(a);
        const k = `${norm(a.planta)}|${norm(a.fabrica)}|${norm(a.setor)}|${norm(maq)}`;
        if (!seen.has(k)) {
            seen.add(k);
            areasCadastro.push({ planta: a.planta, fabrica: a.fabrica, setor: a.setor, maquina: maq || null });
        }
    });

    const mapa = areasCadastro.map(area => {
        const hist = concluidas.filter(a => areaKey(a) === areaKey(area))
            .sort((a, b) => {
                const db = new Date(b.data_auditoria || b.updated_at || b.created_at || 0).getTime();
                const da = new Date(a.data_auditoria || a.updated_at || a.created_at || 0).getTime();
                if (db !== da) return db - da;
                return (b.id || 0) - (a.id || 0);
            });
        const ult = hist[0] || null;
        const ant = hist[1] || null;
        const acoesAbertas = hist.reduce((s, a) => s + (a.planos || []).filter(p => p.status !== 'concluida').length, 0);
        return { ...area, ult, ant, hist, acoesAbertas, delta: (ult && ant && ult.score != null && ant.score != null) ? Math.round(ult.score - ant.score) : null };
    }).sort((a, b) => (a.ult?.score ?? -1) - (b.ult?.score ?? -1));

    // Mapa agrupado por setor (linhas/máquinas ficam dentro do setor)
    const mapaSetores = (() => {
        const g = new Map();
        mapa.forEach(m => {
            const k = `${m.planta || ''}|${m.fabrica}|${m.setor}`;
            if (!g.has(k)) g.set(k, { planta: m.planta, fabrica: m.fabrica, setor: m.setor, itens: [] });
            g.get(k).itens.push(m);
        });
        // ordena setores pela pior área e mostra piores primeiro dentro do setor
        return [...g.values()].map(s => {
            const aud = s.itens.filter(i => i.ult);
            const mediaSolar = aud.length ? Math.round(aud.reduce((a, i) => a + (solarDe(i.ult) || 0), 0) / aud.length) : null;
            const mediaSol = aud.length ? Math.round(aud.reduce((a, i) => a + (i.ult.scores?.sol_geral ?? 0), 0) / aud.length) : null;
            const acoes = s.itens.reduce((a, i) => a + (i.acoesAbertas || 0), 0);
            const datas = aud.map(i => i.ult.data_auditoria).filter(Boolean).sort();
            const ultData = datas.length ? datas[datas.length - 1] : null;
            const dias = ultData ? Math.round((Date.now() - new Date(String(ultData).slice(0, 10) + 'T12:00:00')) / 86400000) : null;
            return {
                ...s,
                itens: s.itens.sort((a, b) => (a.ult?.score ?? -1) - (b.ult?.score ?? -1)),
                auditadas: aud.length, mediaSolar, mediaSol, acoes, ultData,
                atrasada: dias != null && dias > 60,
                piorScore: Math.min(...s.itens.map(i => i.ult ? solarDe(i.ult) : 999)),
            };
        }).sort((a, b) => a.piorScore - b.piorScore);
    })();

    // Auditorias agrupadas por setor (aba Auditorias, no estilo do Mapa)
    const audsPorSetor = (() => {
        const g = new Map();
        auditoriasFiltradas.forEach(a => {
            const k = `${a.planta || ''}|${a.fabrica || ''}|${a.setor || ''}`;
            if (!g.has(k)) g.set(k, { planta: a.planta, fabrica: a.fabrica, setor: a.setor, itens: [] });
            g.get(k).itens.push(a);
        });
        const ts = (a) => new Date(a.data_auditoria || a.created_at || 0).getTime();
        return [...g.values()].map(s => ({
            ...s,
            itens: s.itens.sort((a, b) => ts(b) - ts(a)),
            concl: s.itens.filter(a => a.status === 'concluida').length,
        })).sort((a, b) => ts(b.itens[0]) - ts(a.itens[0]));
    })();

    // ── Comparativo de evolução: auditorias marcadas nos cards ───────────────
    const audsSelecionadas = auditorias.filter(a => selecao.has(a.id));
    // Com uma só marcada, o atalho traz o histórico inteiro daquela linha/máquina
    // — que é a comparação que quase sempre se quer fazer.
    const irmasDaSelecionada = audsSelecionadas.length === 1
        ? auditoriasFiltradas.filter(a => areaKey(a) === areaKey(audsSelecionadas[0]) && !selecao.has(a.id))
        : [];

    // ── Indicadores ──────────────────────────────────────────────────────────────
    const auditadas = mapa.filter(m => m.ult);
    const mediaGeral = auditadas.length ? Math.round(auditadas.reduce((s, m) => s + (m.ult.score || 0), 0) / auditadas.length) : null;
    const acoesAbertasTot = auditoriasFiltradas.reduce((s, a) => s + (a.planos || []).filter(p => p.status !== 'concluida').length, 0);
    // Rotina semanal: conta todas as auditorias concluídas, independente do filtro de período
    const semanas = indexarSemanas(auditorias);
    const semanaAgora = semanaAtualKey();
    const pendenteSemana = (m) => !semanas.get(areaKey(m))?.has(semanaAgora);
    const pendentesSemana = mapa.filter(pendenteSemana).length;
    const radarMedio = (() => {
        const out = {};
        SENSOS.forEach(s => {
            const vals = auditadas.map(m => m.ult.scores?.[s.id]).filter(v => v != null);
            out[s.id] = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
        });
        return out;
    })();

    // ── Programa SOL: índice solar por área e agregados do parque ──
    const solarMedio = auditadas.length ? Math.round(auditadas.reduce((s, m) => s + (solarDe(m.ult) ?? 0), 0) / auditadas.length) : null;
    const radarSOL = (() => {
        const out = {};
        SOL_PILARES.forEach(p => {
            const vals = auditadas.map(m => m.ult.scores?.[p.id]).filter(v => v != null);
            out[p.id] = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
        });
        return out;
    })();
    // Mural do Sol: áreas que "viram o sol nascer" (índice solar ≥ FAIXA_EXCELENCIA), ranqueadas
    const muralSol = auditadas.filter(m => (solarDe(m.ult) ?? 0) >= FAIXA_EXCELENCIA).sort((a, b) => (solarDe(b.ult) - solarDe(a.ult)));

    // Quem mais audita — ranking por auditorias concluídas
    const porAuditor = {};
    concluidas.forEach(a => { const nome = (a.auditor || '').trim() || '—'; porAuditor[nome] = (porAuditor[nome] || 0) + 1; });
    const rankAuditores = Object.entries(porAuditor).map(([nome, qtd]) => ({ nome, qtd })).sort((a, b) => b.qtd - a.qtd);

    const gerarRelatorioGeral = () => {
        const nowStr = new Date().toLocaleDateString('pt-BR');
        const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const scCorHex = (s) => tinta(s == null ? '#475569' : s >= FAIXA_EXCELENCIA ? '#16a34a' : s >= FAIXA_CONSOLIDA ? '#d97706' : '#dc2626');

        const rankingHtml = [...mapaSetores].filter(s => s.mediaSolar != null).sort((a, b) => b.mediaSolar - a.mediaSolar).map((s, i) => `
            <tr>
                <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-weight:700;font-size:11px">${i + 1}º</td>
                <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:11px">${esc(s.fabrica)} · ${esc(s.setor)}</td>
                <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-weight:900;color:${scCorHex(s.mediaSolar)};text-align:right">${s.mediaSolar}%</td>
            </tr>
        `).join('');

        const muralHtml = muralSol.map((m, i) => `
            <div style="display:inline-block;margin:4px;padding:6px 10px;border-radius:6px;background:#fffbeb;border:1px solid #fde68a;font-size:11px;font-weight:700;color:#92400e">
                ${esc(areaLabel(m))} (${solarDe(m.ult)}%)
            </div>
        `).join('');

        const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Relatório Geral 5S+SOL</title>
        <style>
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family:'Segoe UI',Roboto,Arial,sans-serif; }
            @page { size: A4; margin: 10mm; }
            @media print { body { background: #fff !important; margin: 0 !important; } .no-print { display: none !important; } }
        </style></head>
        <body style="margin:0;background:#f3f4f6;">
        <button class="no-print" onclick="window.print()" style="position:fixed;top:16px;right:16px;background:#16a34a;color:#fff;border:none;border-radius:8px;padding:10px 18px;cursor:pointer;font-size:13px;font-weight:800;box-shadow:0 4px 14px rgba(22,163,74,.4)">🖨️ Imprimir / Salvar PDF</button>
        <div style="max-width:900px;margin:24px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,.1)">
            <div style="background:linear-gradient(120deg,#0d2818 55%,#7c2d12);padding:20px 30px;color:#fff;">
                <h1 style="margin:0;font-size:20px;font-weight:900">Relatório Geral 5S <span style="color:#fbbf24">+ SOL</span></h1>
                <p style="margin:3px 0 0;color:#fcd34d;font-size:10px;text-transform:uppercase;">Visão Global do Parque · Emitido em ${nowStr}</p>
            </div>
            <div style="padding:22px 30px">
                <div style="display:flex;gap:10px;margin-bottom:20px">
                    <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;text-align:center">
                        <div style="font-size:24px;font-weight:900;color:${scCorHex(solarMedio)}">${solarMedio != null ? solarMedio + '%' : '—'}</div>
                        <div style="font-size:10px;color:#475569;text-transform:uppercase;font-weight:700">Índice Solar Médio</div>
                    </div>
                    <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;text-align:center">
                        <div style="font-size:24px;font-weight:900;color:${scCorHex(mediaGeral)}">${mediaGeral != null ? mediaGeral + '%' : '—'}</div>
                        <div style="font-size:10px;color:#475569;text-transform:uppercase;font-weight:700">Score 5S Médio</div>
                    </div>
                    <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;text-align:center">
                        <div style="font-size:24px;font-weight:900;color:${tinta('#3B82F6')}">${auditadas.length}/${areasCadastro.length}</div>
                        <div style="font-size:10px;color:#475569;text-transform:uppercase;font-weight:700">Áreas Auditadas</div>
                    </div>
                    <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;text-align:center">
                        <div style="font-size:24px;font-weight:900;color:${tinta(acoesAbertasTot ? '#d97706' : '#16a34a')}">${acoesAbertasTot}</div>
                        <div style="font-size:10px;color:#475569;text-transform:uppercase;font-weight:700">Ações Abertas</div>
                    </div>
                </div>

                <h2 style="font-size:14px;color:#0f172a;border-bottom:2px solid #22c55e;padding-bottom:5px;margin-bottom:10px">Mural do Sol (Áreas ≥ ${FAIXA_EXCELENCIA}%)</h2>
                <div style="margin-bottom:20px">${muralHtml || '<span style="font-size:12px;color:#475569">Nenhuma área no Mural do Sol ainda.</span>'}</div>

                <h2 style="font-size:14px;color:#0f172a;border-bottom:2px solid #22c55e;padding-bottom:5px;margin-bottom:10px">Ranking dos Setores</h2>
                <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
                    <tr style="background:#f1f5f9">
                        <th style="padding:6px 10px;font-size:10px;color:#475569;text-align:left">Posição</th>
                        <th style="padding:6px 10px;font-size:10px;color:#475569;text-align:left">Setor</th>
                        <th style="padding:6px 10px;font-size:10px;color:#475569;text-align:right">Índice Solar</th>
                    </tr>
                    ${rankingHtml || '<tr><td colspan="3" style="padding:10px;text-align:center;font-size:12px;color:#475569">Nenhum setor avaliado</td></tr>'}
                </table>
                <div style="margin-top:28px;padding-top:12px;border-top:1px solid #e2e8f0;text-align:center;color:#475569;font-size:10px;font-weight:700">Documento gerado automaticamente · ${nowStr}</div>
            </div>
        </div></body></html>`;

        abrirRelatorio({ html, nomeArquivo: `Relatorio_Geral_5S_${nowStr.replace(/\//g, '-')}.html` });
    };

    if (sel) return <Auditoria5S aud={sel} historico={historicoDaMaquina(sel, auditorias)} onClose={() => setSel(null)} onSave={saveAuditoria} saving={saving} />;

    return (
        <div style={{ padding: isMobile ? '0.8rem' : '1rem 1.25rem', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', gap: '0.7rem' }}>
            {msg && <Toast msg={msg} />}
            {relViewer}
            {/* Ação rápida */}
            <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                {tab === 'indicadores' && (
                    <button onClick={gerarRelatorioGeral} style={{ ...btnSec, borderColor: '#3B82F655', color: '#3B82F6' }}>
                        <FaFilePdf size={12} /> Relatório Geral
                    </button>
                )}
                <button onClick={() => setShowNova(true)} style={btnPrim}><FaPlus size={12} /> Nova Auditoria</button>
            </div>

            {/* Área rolável: hero + KPIs + abas (sticky) + conteúdo. Só o header fica fixo. */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.7rem', minHeight: 0, margin: '0 -0.25rem', padding: '0 0.25rem' }}>



            {/* KPIs */}
            <div style={{ flexShrink: 0, display: isMobile ? 'grid' : 'flex', gridTemplateColumns: isMobile ? '1fr 1fr' : undefined, gap: isMobile ? '0.5rem' : '0.8rem', flexWrap: 'wrap' }}>
                <KpiMini icon={<FaSun />} label="Índice Solar do parque" value={solarMedio != null ? `${solarMedio}%` : '—'} cor={scoreCor(solarMedio)} />
                <KpiMini icon={<FaChartPie />} label="Score 5S médio" value={mediaGeral != null ? `${mediaGeral}%` : '—'} cor={scoreCor(mediaGeral)} />
                <KpiMini icon={<FaMapMarkedAlt />} label="Áreas auditadas" value={`${auditadas.length}/${areasCadastro.length}`} cor="#3B82F6" />
                <div onClick={() => setTab('semana')} style={{ cursor: 'pointer', display: 'contents' }}>
                    <KpiMini icon={<FaCalendarAlt />} label="Pendentes nesta semana" value={`${pendentesSemana}/${mapa.length}`} cor={pendentesSemana ? '#DC2626' : '#16A34A'} />
                </div>
                <KpiMini icon={<FaExclamationTriangle />} label="Ações abertas" value={acoesAbertasTot} cor={acoesAbertasTot ? '#D97706' : '#16A34A'} />
                <KpiMini icon={<FaCheckCircle />} label={periodo === 'tudo' ? 'Auditorias concluídas' : 'Auditorias no período'} value={concluidas.length} cor={ACCENT} />
            </div>

            {/* Tabs + filtro de período — grudam no topo ao rolar (sticky) */}
            <div style={{ position: 'sticky', top: 0, zIndex: 5, flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.3rem', borderBottom: '1px solid var(--border-color-dark)', overflowX: 'auto', background: 'var(--bg-app)', paddingTop: '0.3rem' }}>
                {[['mapa', 'Mapa das Áreas', <FaMapMarkedAlt size={11} />], ['semana', `Rotina semanal${pendentesSemana ? ` (${pendentesSemana})` : ''}`, <FaCalendarAlt size={11} />], ['auditorias', 'Auditorias', <FaListUl size={11} />], ['indicadores', 'Indicadores', <FaChartPie size={11} />]].map(([id, label, icon]) => (
                    <button key={id} onClick={() => setTab(id)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1rem', border: 'none', borderBottom: `2px solid ${tab === id ? ACCENT : 'transparent'}`, background: 'transparent', color: tab === id ? ACCENT : 'var(--color-text-muted)', fontSize: '0.78rem', fontWeight: tab === id ? 800 : 600, cursor: 'pointer', marginBottom: -1, whiteSpace: 'nowrap' }}>
                        {icon} {label}
                    </button>
                ))}
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem', paddingBottom: '0.35rem', flexShrink: 0 }}>
                    <FaCalendarAlt size={11} color={periodo === 'tudo' ? 'var(--color-text-subtle)' : ACCENT} />
                    <select value={periodo} onChange={e => setPeriodo(e.target.value)}
                        style={{ ...inputSty, padding: '0.3rem 0.5rem', fontSize: '0.74rem', width: 'auto', borderColor: periodo === 'tudo' ? 'var(--border-color-dark)' : `${ACCENT}66`, color: periodo === 'tudo' ? 'var(--color-text-muted)' : ACCENT, fontWeight: 700 }}>
                        <option value="tudo">Todo o período</option>
                        <option value="mes">Este mês</option>
                        <option value="mes_passado">Mês passado</option>
                        <option value="3m">Últimos 3 meses</option>
                        <option value="ano">Este ano</option>
                        <option value="custom">Personalizado…</option>
                    </select>
                    {periodo === 'custom' && (<>
                        <input type="date" value={pDe} onChange={e => setPDe(e.target.value)} title="De" style={{ ...inputSty, padding: '0.3rem 0.4rem', fontSize: '0.72rem', width: 'auto' }} />
                        <span style={{ color: 'var(--color-text-subtle)', fontSize: '0.72rem' }}>a</span>
                        <input type="date" value={pAte} onChange={e => setPAte(e.target.value)} title="Até" style={{ ...inputSty, padding: '0.3rem 0.4rem', fontSize: '0.72rem', width: 'auto' }} />
                    </>)}
                </div>
            </div>
            {periodo !== 'tudo' && (
                <div style={{ flexShrink: 0, fontSize: '0.66rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '-0.2rem' }}>
                    <span style={{ color: ACCENT, fontWeight: 700 }}>Filtro:</span> {periodoLabel}
                    {(periodoBounds.de || periodoBounds.ate) && <span>({fmtBound(periodoBounds.de)} — {fmtBound(periodoBounds.ate)})</span>}
                    <span>· {concluidas.length} auditoria(s) · {auditadas.length} área(s)</span>
                    <button onClick={() => setPeriodo('tudo')} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: '0.66rem', fontWeight: 700, padding: 0 }}>limpar</button>
                </div>
            )}

            <div style={{ paddingTop: '0.6rem', paddingBottom: '2rem' }}>
                {/* ── MAPA DAS ÁREAS ── */}
                {tab === 'mapa' && (
                    loading ? <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>Carregando…</div>
                        : areasCadastro.length === 0 ? (
                            <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                <FaMapMarkedAlt size={36} color="var(--border-color-dark)" style={{ marginBottom: '0.8rem' }} />
                                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-main)' }}>Nenhuma área cadastrada</div>
                                <div style={{ fontSize: '0.78rem', marginTop: 4 }}>Cadastre fábricas e setores em Plantas/Moldes para o mapa 5S aparecer aqui.</div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                                {/* Ação global: expandir / recolher todos os setores */}
                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <button onClick={() => setOpenSetores(openSetores.size >= mapaSetores.length ? new Set() : new Set(mapaSetores.map(g => `${g.planta}|${g.fabrica}|${g.setor}`)))}
                                        style={{ ...btnSec, fontSize: '0.68rem', padding: '0.3rem 0.7rem' }}>
                                        {openSetores.size >= mapaSetores.length ? '▾ Recolher tudo' : '▸ Expandir tudo'}
                                    </button>
                                </div>
                                {mapaSetores.map(grp => {
                                    const gKey = `${grp.planta}|${grp.fabrica}|${grp.setor}`;
                                    const aberto = openSetores.has(gKey);
                                    const selo = solSelo(grp.mediaSolar);
                                    return (
                                    <div key={gKey} className="glass-panel" style={{ borderRadius: 12, border: '1px solid var(--border-color-dark)', overflow: 'hidden' }}>
                                        {/* Cabeçalho do setor (clicável, com % geral) */}
                                        <button onClick={() => toggleSetor(gKey)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.75rem 0.9rem', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                                            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', width: 12, flexShrink: 0 }}>{aberto ? '▾' : '▸'}</span>
                                            <FaIndustry size={12} color={ACCENT} style={{ flexShrink: 0 }} />
                                            <span style={{ fontSize: '0.82rem', fontWeight: 900, color: 'var(--color-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{grp.fabrica} · {grp.setor}</span>
                                            <span style={{ fontSize: '0.6rem', color: 'var(--color-text-subtle)', fontWeight: 700, flexShrink: 0 }}>{grp.planta}</span>
                                            <div style={{ flex: 1 }} />
                                            {(() => { const pend = grp.itens.filter(pendenteSemana).length; return pend > 0 && <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#DC2626', flexShrink: 0 }}>{pend} pendente(s) na semana</span>; })()}
                                            {grp.acoes > 0 && <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#D97706', flexShrink: 0 }}>{grp.acoes} ação(ões)</span>}
                                            <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--color-text-muted)', background: 'var(--bg-surface-glass)', border: '1px solid var(--border-color-dark)', borderRadius: 20, padding: '0.1rem 0.55rem', flexShrink: 0 }}>{grp.auditadas}/{grp.itens.length}</span>
                                            {/* % geral do setor */}
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', fontWeight: 900, color: scoreCor(grp.mediaSolar), minWidth: 54, justifyContent: 'flex-end', flexShrink: 0 }}>
                                                {grp.mediaSolar != null ? <>{selo.emoji} {grp.mediaSolar}%</> : <span style={{ fontSize: '0.62rem', color: 'var(--color-text-subtle)', fontWeight: 700 }}>sem auditoria</span>}
                                            </span>
                                        </button>
                                        {/* Linhas / máquinas do setor (só quando expandido) */}
                                        {aberto && (
                                        <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? '100%' : '240px'}, 1fr))`, gap: '0.7rem', padding: '0 0.9rem 0.9rem' }}>
                                            {grp.itens.map(m => (
                                                <div key={areaKey(m)} className="glass-panel" style={{ borderRadius: 12, border: `1px solid ${m.ult ? `${solSelo(solarDe(m.ult)).cor}55` : 'var(--border-color-dark)'}`, padding: '0.8rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                                                        <div style={{ minWidth: 0 }}>
                                                            <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--color-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.maquina || 'Setor inteiro'}</div>
                                                            <div style={{ fontSize: '0.6rem', color: 'var(--color-text-subtle)', fontWeight: 700 }}>{m.setor}</div>
                                                        </div>
                                                        {m.ult ? <SolNascente value={solarDe(m.ult)} size={54} label={false} /> : <RingGauge value={null} size={42} stroke={5} />}
                                                    </div>
                                                    {m.ult && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.45rem', flexWrap: 'wrap' }}>
                                                            <SolSeloPill value={solarDe(m.ult)} small />
                                                            <span style={{ fontSize: '0.58rem', fontWeight: 800, color: ACCENT }}>5S {m.ult.score != null ? `${Math.round(m.ult.score)}%` : '—'}</span>
                                                            {m.ult.scores?.sol_geral != null && <span style={{ fontSize: '0.58rem', fontWeight: 800, color: SOL_ACCENT }}>SOL {m.ult.scores.sol_geral}%</span>}
                                                        </div>
                                                    )}
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.45rem', fontSize: '0.63rem', color: 'var(--color-text-muted)', flexWrap: 'wrap' }}>
                                                        {pendenteSemana(m)
                                                            ? <span style={{ color: '#DC2626', fontWeight: 800 }}>⚠️ Pendente nesta semana</span>
                                                            : <span style={{ color: '#16A34A', fontWeight: 800 }}>✓ Avaliada nesta semana</span>}
                                                        {m.ult ? (() => {
                                                            return <>
                                                                <span>Última: {fmtData(m.ult.data_auditoria)}</span>
                                                                {m.delta != null && <span style={{ fontWeight: 800, color: m.delta >= 0 ? '#16A34A' : '#DC2626' }}>{m.delta >= 0 ? '▲' : '▼'} {Math.abs(m.delta)} pts</span>}
                                                                {m.acoesAbertas > 0 && <span style={{ color: '#D97706', fontWeight: 700 }}>{m.acoesAbertas} ação(ões)</span>}
                                                            </>;
                                                        })() : <span style={{ color: 'var(--color-text-subtle)', fontStyle: 'italic' }}>Nunca auditada</span>}
                                                    </div>
                                                    <button onClick={() => { setNovaPrefill({ planta: m.planta, fabrica: m.fabrica, setor: m.setor, maquina: m.maquina }); setShowNova(true); }}
                                                        style={{ ...btnSec, width: '100%', justifyContent: 'center', marginTop: '0.6rem', borderColor: `${ACCENT}55`, color: ACCENT, fontSize: '0.7rem' }}>
                                                        <FaBroom size={10} /> Auditar agora
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                        )}
                                    </div>
                                );})}
                            </div>
                        )
                )}

                {/* ── ROTINA SEMANAL ── */}
                {tab === 'semana' && (
                    loading ? <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>Carregando…</div>
                        : <RotinaSemanal mapa={mapa} semanas={semanas} isMobile={isMobile} onAbrir={setSel}
                            onAuditar={m => { setNovaPrefill({ planta: m.planta, fabrica: m.fabrica, setor: m.setor, maquina: m.maquina }); setShowNova(true); }} />
                )}

                {/* ── AUDITORIAS ── */}
                {tab === 'auditorias' && (
                    auditoriasFiltradas.length === 0 ? (
                        <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                            <FaBroom size={36} color="var(--border-color-dark)" style={{ marginBottom: '0.8rem' }} />
                            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-main)' }}>{auditorias.length === 0 ? 'Nenhuma auditoria ainda' : 'Nenhuma auditoria no período'}</div>
                            <div style={{ fontSize: '0.78rem', marginTop: 4 }}>{auditorias.length === 0 ? 'Use o Mapa das Áreas ou "Nova Auditoria" para começar.' : 'Ajuste o filtro de período ou selecione "Todo o período".'}</div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                            {/* Barra de comparação: marca relatórios e abre a evolução */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', background: audsSelecionadas.length ? `${SOL_ACCENT}12` : 'var(--bg-surface-glass)', border: `1px solid ${audsSelecionadas.length ? `${SOL_ACCENT}55` : 'var(--border-color-dark)'}`, borderRadius: 10, padding: '0.45rem 0.7rem' }}>
                                <FaChartLine size={12} color={audsSelecionadas.length ? SOL_ACCENT : 'var(--color-text-subtle)'} style={{ flexShrink: 0 }} />
                                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: audsSelecionadas.length ? 'var(--color-text-main)' : 'var(--color-text-muted)' }}>
                                    {audsSelecionadas.length === 0
                                        ? 'Marque 2 ou mais auditorias nos cards para ver a evolução entre elas'
                                        : `${audsSelecionadas.length} auditoria(s) marcada(s)`}
                                </span>
                                {irmasDaSelecionada.length > 0 && (
                                    <button onClick={() => setSelecao(prev => { const n = new Set(prev); irmasDaSelecionada.forEach(a => n.add(a.id)); return n; })}
                                        style={{ ...btnSec, fontSize: '0.66rem', padding: '0.25rem 0.6rem', borderColor: `${ACCENT}55`, color: ACCENT }}>
                                        + as {irmasDaSelecionada.length} desta linha/máquina
                                    </button>
                                )}
                                {audsSelecionadas.length > 0 && (
                                    <button onClick={() => setSelecao(new Set())} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: '0.66rem', fontWeight: 700, padding: 0 }}>limpar</button>
                                )}
                                <div style={{ flex: 1, minWidth: 8 }} />
                                <button onClick={() => setShowEvolucao(true)} disabled={audsSelecionadas.length < 2}
                                    title={audsSelecionadas.length < 2 ? 'Marque pelo menos duas auditorias' : 'Ver evolução e retrocesso entre as marcadas'}
                                    style={{ ...btnPrim, fontSize: '0.72rem', padding: '0.42rem 0.9rem', background: SOL_ACCENT, color: '#3B1D00', opacity: audsSelecionadas.length < 2 ? 0.45 : 1, cursor: audsSelecionadas.length < 2 ? 'default' : 'pointer' }}>
                                    <FaSun size={11} /> Ver evolução
                                </button>
                            </div>
                            {/* Ação global: expandir / recolher todos os setores */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button onClick={() => setCollapsedAud(collapsedAud.size === 0 ? new Set(audsPorSetor.map(g => `${g.planta}|${g.fabrica}|${g.setor}`)) : new Set())}
                                    style={{ ...btnSec, fontSize: '0.68rem', padding: '0.3rem 0.7rem' }}>
                                    {collapsedAud.size === 0 ? '▾ Recolher tudo' : '▸ Expandir tudo'}
                                </button>
                            </div>
                            {audsPorSetor.map(grp => {
                                const gKey = `${grp.planta}|${grp.fabrica}|${grp.setor}`;
                                const aberto = !collapsedAud.has(gKey);
                                return (
                                <div key={gKey} className="glass-panel" style={{ borderRadius: 12, border: '1px solid var(--border-color-dark)', overflow: 'hidden' }}>
                                    {/* Cabeçalho do setor (clicável) */}
                                    <button onClick={() => toggleAud(gKey)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.75rem 0.9rem', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', width: 12, flexShrink: 0 }}>{aberto ? '▾' : '▸'}</span>
                                        <FaIndustry size={12} color={ACCENT} style={{ flexShrink: 0 }} />
                                        <span style={{ fontSize: '0.82rem', fontWeight: 900, color: 'var(--color-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{grp.fabrica} · {grp.setor}</span>
                                        <span style={{ fontSize: '0.6rem', color: 'var(--color-text-subtle)', fontWeight: 700, flexShrink: 0 }}>{grp.planta}</span>
                                        <div style={{ flex: 1 }} />
                                        <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--color-text-muted)', background: 'var(--bg-surface-glass)', border: '1px solid var(--border-color-dark)', borderRadius: 20, padding: '0.1rem 0.6rem', flexShrink: 0 }}>{grp.itens.length} auditoria(s)</span>
                                    </button>
                                    {/* Cards das auditorias do setor */}
                                    {aberto && (
                                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? '100%' : '280px'}, 1fr))`, gap: '0.7rem', padding: '0 0.9rem 0.9rem' }}>
                                        {grp.itens.map(a => { const sc = scoresDaAuditoria(a); const marcada = selecao.has(a.id); return (
                                            <div key={a.id} className="glass-panel s5-card" onClick={() => setSel(a)} style={{ borderRadius: 11, border: `1px solid ${marcada ? `${SOL_ACCENT}88` : 'var(--border-color-dark)'}`, background: marcada ? `${SOL_ACCENT}0f` : undefined, padding: '0.85rem', cursor: 'pointer', position: 'relative', transition: 'transform 0.15s' }}
                                                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'} onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                                                <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4, alignItems: 'center' }}>
                                                    <button onClick={e => { e.stopPropagation(); toggleSelecao(a.id); }} title={marcada ? 'Tirar do comparativo de evolução' : 'Marcar para comparar a evolução'}
                                                        style={{ width: 22, height: 22, borderRadius: 6, background: marcada ? SOL_ACCENT : 'transparent', border: `1.5px solid ${marcada ? SOL_ACCENT : 'var(--border-color-dark)'}`, color: '#3B1D00', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                                                        {marcada && <FaCheck size={10} />}
                                                    </button>
                                                    <button className="s5-del" onClick={e => { e.stopPropagation(); abrirRelatorio(montarRelatorio5S(a, historicoDaMaquina(a, auditorias))); }} title="Relatório analítico"
                                                        style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(59,130,246,0.18)', border: 'none', color: '#3B82F6', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.15s' }}><FaFilePdf size={10} /></button>
                                                    <button className="s5-del" onClick={e => { e.stopPropagation(); setConfirmDel(a); }} style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(220,38,38,0.15)', border: 'none', color: '#DC2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.15s' }}><FaTimes size={10} /></button>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', paddingRight: 80 }}>
                                                    <span style={{ fontSize: '0.58rem', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: 5, textTransform: 'uppercase', background: a.status === 'concluida' ? '#16A34A22' : '#D9770622', color: a.status === 'concluida' ? '#16A34A' : '#D97706' }}>{a.status === 'concluida' ? 'Concluída' : 'Aberta'}</span>
                                                    <span style={{ fontSize: '0.62rem', color: 'var(--color-text-subtle)' }}>{fmtData(a.data_auditoria)}</span>
                                                    {a.maquina && <span style={{ fontSize: '0.58rem', fontWeight: 800, color: ACCENT, background: `${ACCENT}18`, borderRadius: 5, padding: '0.1rem 0.45rem' }}>{a.maquina}</span>}
                                                </div>
                                                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-text-main)', marginTop: '0.5rem', lineHeight: 1.3 }}>{a.titulo}</div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', marginTop: '0.6rem' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem', flexShrink: 0 }}>
                                                        <RingGauge value={sc.solar} size={46} stroke={5} />
                                                        <span style={{ fontSize: '0.5rem', fontWeight: 800, letterSpacing: '0.4px', textTransform: 'uppercase', color: 'var(--color-text-subtle)' }}>Índice Solar</span>
                                                    </div>
                                                    <div style={{ flex: 1, fontSize: '0.66rem', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                                        <span>Auditor: <b style={{ color: 'var(--color-text-main)' }}>{a.auditor || '—'}</b></span>
                                                        <span>5S <b style={{ color: scoreCor(sc.g5) }}>{sc.g5 != null ? `${sc.g5}%` : '—'}</b> · SOL <b style={{ color: scoreCor(sc.gSol) }}>{sc.gSol != null ? `${sc.gSol}%` : '—'}</b></span>
                                                        <span>{(a.planos || []).filter(p => p.status !== 'concluida').length} ação(ões) aberta(s)</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );})}
                                    </div>
                                    )}
                                </div>
                            );})}
                        </div>
                    )
                )}

                {/* ── INDICADORES ── */}
                {tab === 'indicadores' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>

                        {/* ══════════════════════════════════════════════════════════════════════════════════
                            2. RADAR MÉDIO DO PARQUE (5S) & RAIOS DO SOL (SOL)
                        ══════════════════════════════════════════════════════════════════════════════════ */}
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem', alignItems: 'stretch' }}>
                            <div className="glass-panel" style={{ borderRadius: 14, border: '1px solid var(--border-color-dark)', padding: '1.2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
                                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <FaBroom color={ACCENT} size={12} /> Radar 5S Médio do Parque
                                    </div>
                                    <span style={{ fontSize: '0.66rem', fontWeight: 800, color: scoreCor(mediaGeral) }}>Geral: {mediaGeral != null ? `${mediaGeral}%` : '—'}</span>
                                </div>
                                <Radar5S scores={radarMedio} size={210} />
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', justifyContent: 'center', marginTop: '0.8rem' }}>
                                    {SENSOS.map(s => (
                                        <span key={s.id} style={{ fontSize: '0.62rem', fontWeight: 800, color: s.cor, background: `${s.cor}18`, border: `1px solid ${s.cor}44`, borderRadius: 6, padding: '0.15rem 0.5rem' }}>
                                            {s.num} {s.nome.split('·')[1]} {radarMedio[s.id] != null ? `(${radarMedio[s.id]}%)` : ''}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="glass-panel" style={{ borderRadius: 14, border: `1px solid ${SOL_ACCENT}44`, padding: '1.2rem', background: `linear-gradient(135deg, ${SOL_ACCENT}10, transparent 60%)` }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
                                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: SOL_ACCENT, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <FaSun size={13} /> Raios do Sol — Pilares SOL do Parque
                                    </div>
                                    <span style={{ fontSize: '0.66rem', fontWeight: 800, color: solSelo(solarMedio).cor }}>Índice Solar: {solarMedio != null ? `${solarMedio}%` : '—'}</span>
                                </div>
                                {SOL_PILARES.map(p => (
                                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
                                        <span style={{ width: isMobile ? 95 : 130, fontSize: '0.74rem', fontWeight: 800, color: p.cor, whiteSpace: 'nowrap' }}>{p.num} · {p.nome}</span>
                                        <div style={{ flex: 1, height: 14, background: 'rgba(255,255,255,0.06)', borderRadius: 7, overflow: 'hidden' }}>
                                            <div style={{ width: `${radarSOL[p.id] || 0}%`, height: '100%', background: `linear-gradient(90deg, ${p.cor}, ${p.cor}cc)`, borderRadius: 7, transition: 'width 0.4s' }} />
                                        </div>
                                        <span style={{ width: 42, textAlign: 'right', fontSize: '0.76rem', fontWeight: 900, color: scoreCor(radarSOL[p.id]) }}>{radarSOL[p.id] || 0}%</span>
                                    </div>
                                ))}
                                <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginTop: '0.5rem', lineHeight: 1.4 }}>
                                    ☀️ O <b>Índice Solar</b> combina os 5 Sensos com a Segurança, Organização e Limpeza & Luz para avaliar a maturidade industrial.
                                </div>
                            </div>
                        </div>

                        {/* ══════════════════════════════════════════════════════════════════════════════════
                            3. RANKING GERAL DOS SETORES & MURAL DO SOL
                        ══════════════════════════════════════════════════════════════════════════════════ */}
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.3fr 1fr', gap: '1rem', alignItems: 'start' }}>
                            <div className="glass-panel" style={{ borderRadius: 14, border: '1px solid var(--border-color-dark)', padding: '1.2rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.8rem' }}>
                                    <div>
                                        <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-text-main)' }}>Ranking dos Setores (Índice Solar)</div>
                                        <div style={{ fontSize: '0.62rem', color: 'var(--color-text-subtle)' }}>Média consolidada das linhas e máquinas auditadas</div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <FaSearch size={10} color="var(--color-text-muted)" />
                                        <input
                                            type="text"
                                            placeholder="Filtrar ranking…"
                                            value={buscaSetorRank}
                                            onChange={e => setBuscaSetorRank(e.target.value)}
                                            style={{ ...inputSty, width: 130, padding: '0.2rem 0.45rem', fontSize: '0.68rem' }}
                                        />
                                    </div>
                                </div>

                                {mapaSetores.filter(s => s.mediaSolar != null).length === 0 ? (
                                    <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', padding: '1rem 0' }}>Conclua auditorias para gerar o ranking dos setores.</div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: 360, overflowY: 'auto', paddingRight: '0.2rem' }}>
                                        {[...mapaSetores]
                                            .filter(s => s.mediaSolar != null)
                                            .filter(s => !buscaSetorRank.trim() || `${s.fabrica} ${s.setor}`.toUpperCase().includes(buscaSetorRank.trim().toUpperCase()))
                                            .sort((a, b) => b.mediaSolar - a.mediaSolar)
                                            .map((s, i) => {
                                                const seloS = solSelo(s.mediaSolar);
                                                return (
                                                    <div key={`${s.planta}|${s.fabrica}|${s.setor}`} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.35rem 0.5rem', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color-dark)' }}>
                                                        <span style={{ width: 22, fontSize: '0.7rem', color: i < 3 ? '#EAB308' : 'var(--color-text-subtle)', fontWeight: 900, textAlign: 'right' }}>
                                                            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`}
                                                        </span>
                                                        <div style={{ width: isMobile ? 110 : 160, minWidth: 0 }}>
                                                            <div style={{ fontSize: '0.74rem', color: 'var(--color-text-main)', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.setor}</div>
                                                            <div style={{ fontSize: '0.58rem', color: 'var(--color-text-subtle)' }}>{s.fabrica}</div>
                                                        </div>
                                                        <div style={{ flex: 1, height: 12, background: 'rgba(255,255,255,0.06)', borderRadius: 6, overflow: 'hidden' }}>
                                                            <div style={{ width: `${s.mediaSolar}%`, height: '100%', background: scoreCor(s.mediaSolar), borderRadius: 6, transition: 'width 0.4s' }} />
                                                        </div>
                                                        <span style={{ width: 44, textAlign: 'right', fontSize: '0.76rem', fontWeight: 900, color: scoreCor(s.mediaSolar) }}>{s.mediaSolar}%</span>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                )}
                            </div>

                            <div className="glass-panel" style={{ borderRadius: 14, border: '1px solid var(--border-color-dark)', padding: '1.2rem' }}>
                                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-text-main)', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <FaTrophy size={13} color="#EAB308" /> Mural do Sol — Excelência (≥ {FAIXA_EXCELENCIA}%) ☀️
                                </div>
                                {muralSol.length === 0 ? (
                                    <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', lineHeight: 1.5, padding: '1rem 0' }}>
                                        Nenhuma área atingiu <b>Sol Pleno</b> (Índice Solar ≥ {FAIXA_EXCELENCIA}%) ainda. A primeira a chegar lá entra no mural como referência!
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: 360, overflowY: 'auto' }}>
                                        {muralSol.map((m, i) => (
                                            <div key={areaKey(m)} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.45rem 0.65rem', borderRadius: 8, background: '#EAB30814', border: '1px solid #EAB30833' }}>
                                                <span style={{ fontSize: '1.1rem' }}>{i === 0 ? '🏆' : '☀️'}</span>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--color-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{areaLabel(m)}</div>
                                                    <div style={{ fontSize: '0.58rem', color: 'var(--color-text-subtle)' }}>{m.planta}</div>
                                                </div>
                                                <SolSeloPill value={solarDe(m.ult)} small />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ══════════════════════════════════════════════════════════════════════════════════
                            4. QUEM MAIS AUDITA & EVOLUÇÃO MENSAL
                        ══════════════════════════════════════════════════════════════════════════════════ */}
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem', alignItems: 'start' }}>
                            <div className="glass-panel" style={{ borderRadius: 14, border: '1px solid var(--border-color-dark)', padding: '1.2rem' }}>
                                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-text-main)', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <FaTrophy size={12} color={ACCENT} /> Quem Mais Audita (Auditores)
                                </div>
                                {rankAuditores.length === 0 ? (
                                    <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>Conclua auditorias para ver o ranking dos auditores.</div>
                                ) : (() => {
                                    const maxQ = rankAuditores[0].qtd || 1;
                                    return rankAuditores.map((r, i) => (
                                        <div key={r.nome} style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.5rem' }}>
                                            <span style={{ width: 22, fontSize: '0.9rem', textAlign: 'center' }}>
                                                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span style={{ fontSize: '0.66rem', color: 'var(--color-text-subtle)', fontWeight: 800 }}>{i + 1}º</span>}
                                            </span>
                                            <span style={{ flex: 1, minWidth: 0 }}>
                                                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--color-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{r.nome}</span>
                                                <span style={{ display: 'block', height: 6, borderRadius: 3, marginTop: 2, background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT}77)`, width: `${Math.max(12, (r.qtd / maxQ) * 100)}%` }} />
                                            </span>
                                            <span style={{ fontSize: '0.74rem', fontWeight: 900, color: ACCENT, whiteSpace: 'nowrap' }}>{r.qtd}</span>
                                        </div>
                                    ));
                                })()}
                                <div style={{ fontSize: '0.62rem', color: 'var(--color-text-subtle)', marginTop: '0.6rem' }}>Total: {concluidas.length} auditoria(s) concluída(s) · {rankAuditores.length} auditor(es).</div>
                            </div>

                            <div className="glass-panel" style={{ borderRadius: 14, border: '1px solid var(--border-color-dark)', padding: '1.2rem' }}>
                                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-text-main)', marginBottom: '0.8rem' }}>Evolução Mensal do Score Médio</div>
                                <Evolucao5S auditorias={concluidas} />
                            </div>
                        </div>

                    </div>
                )}
            </div>
            </div>{/* fim da área rolável */}

            {/* Evolução × retrocesso das auditorias marcadas */}
            {showEvolucao && audsSelecionadas.length >= 2 && (
                <EvolucaoSelecionadas auds={audsSelecionadas} onClose={() => setShowEvolucao(false)} />
            )}

            {/* Modal nova auditoria */}
            {showNova && (
                <NovaAuditoriaModal estrutura={estrutura} prefill={novaPrefill} userName={userName}
                    onClose={() => { setShowNova(false); setNovaPrefill(null); }} onCreate={criarAuditoria} />
            )}

            {confirmDel && (
                <ModalShell title={<><FaTrash color="#DC2626" /> Excluir auditoria</>} onClose={() => setConfirmDel(null)}
                    footer={<>
                        <button onClick={() => setConfirmDel(null)} style={btnSec}>Cancelar</button>
                        <button onClick={() => excluir(confirmDel)} style={{ ...btnPrim, background: '#DC2626', color: '#fff' }}>Excluir</button>
                    </>}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-main)' }}>Excluir <b>{confirmDel.titulo}</b>? Notas, fotos e plano de ação serão perdidos.</div>
                </ModalShell>
            )}
            <style>{`.s5-card:hover .s5-del{opacity:1!important}`}</style>
        </div>
    );
}

// Linha de evolução mensal do score médio (SVG)
const Evolucao5S = ({ auditorias }) => {
    const porMes = {};
    auditorias.forEach(a => {
        if (a.score == null) return;
        const k = String(a.data_auditoria || a.created_at).slice(0, 7);
        (porMes[k] = porMes[k] || []).push(Number(a.score));
    });
    const meses = Object.keys(porMes).sort().slice(-12);
    if (meses.length === 0) return <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>Sem auditorias concluídas ainda.</div>;
    const pts = meses.map(m => ({ mes: m, v: Math.round(porMes[m].reduce((a, b) => a + b, 0) / porMes[m].length) }));
    const W = 720, H = 150, padB = 24, padT = 12, padX = 26;
    const x = (i) => meses.length === 1 ? W / 2 : padX + (i / (meses.length - 1)) * (W - padX * 2);
    const y = (v) => H - padB - (v / 100) * (H - padB - padT);
    const line = pts.map((p, i) => `${x(i)},${y(p.v)}`).join(' ');
    return (
        <div style={{ overflowX: 'auto' }}>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: 320, display: 'block' }}>
                {[25, 50, 75, 100].map(g => <line key={g} x1={padX} y1={y(g)} x2={W - padX} y2={y(g)} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />)}
                <polyline points={line} fill="none" stroke={ACCENT} strokeWidth="2.5" strokeLinejoin="round" />
                {pts.map((p, i) => (
                    <g key={p.mes}>
                        <circle cx={x(i)} cy={y(p.v)} r="4" fill={scoreCor(p.v)} stroke="#0B0E16" strokeWidth="1.5" />
                        <text x={x(i)} y={y(p.v) - 9} textAnchor="middle" fontSize="11" fontWeight="800" fill={scoreCor(p.v)}>{p.v}%</text>
                        <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.4)">{p.mes.slice(5)}/{p.mes.slice(2, 4)}</text>
                    </g>
                ))}
            </svg>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  EVOLUÇÃO × RETROCESSO — comparativo lúdico dos relatórios marcados
// ═══════════════════════════════════════════════════════════════════════════════
/*
 * O gestor marca dois ou mais relatórios e vê numa tela só o sol subir ou cair
 * entre eles. Não há média do período, projeção nem suavização: cada sol é o
 * Índice Solar daquela auditoria e cada seta é a diferença entre duas datas.
 * Embaixo, as 8 dimensões (5 sensos + 3 pilares) abrem o que puxou para cima e
 * o que puxou para baixo — é a parte que responde "retrocedeu em quê?".
 *
 * O que a tela NÃO faz de propósito: comparar auditorias de áreas diferentes
 * como se fossem a mesma série. Quando isso acontece ela avisa, em vez de
 * entregar um número que ninguém pode usar.
 */
const EvolucaoSelecionadas = ({ auds, onClose }) => {
    const isMobile = useIsMobile();
    // Fundo branco: a mesma tela vira folha para projetar, imprimir ou anexar.
    // A paleta escura do app é desenhada para o tablet no chão de fábrica e
    // encosta no branco quando sai daqui — as duas convivem, e quem está com o
    // relatório na mão escolhe na hora.
    const [claro, setClaro] = useState(false);
    const T = claro
        ? { fg: '#0F172A', mut: '#475569', sub: '#64748B', bd: '#E2E8F0', trilho: 'rgba(15,23,42,0.06)', centro: '#CBD5E1', aviso: '#B45309', painel: '#F8FAFC' }
        : { fg: 'var(--color-text-main)', mut: 'var(--color-text-muted)', sub: 'var(--color-text-subtle)', bd: 'var(--border-color-dark)', trilho: 'rgba(255,255,255,0.04)', centro: 'var(--border-color-dark)', aviso: '#FBBF24', painel: 'transparent' };

    const VERDE = '#16A34A', VERMELHO = '#DC2626', NEUTRO = '#64748B';
    const dataDe = (a) => String(a?.data_auditoria || a?.created_at || '').slice(0, 10);

    const serie = [...auds]
        .sort((a, b) => dataDe(a).localeCompare(dataDe(b)) || Number(a.id || 0) - Number(b.id || 0))
        .map(a => ({ a, s: scoresDaAuditoria(a), dims: dimsDaAuditoria(a) }));

    const n = serie.length;
    const prim = serie[0], ult = serie[n - 1];
    const deltaTotal = (prim.s.solar != null && ult.s.solar != null) ? ult.s.solar - prim.s.solar : null;
    const passos = serie.slice(1).map((e, i) => ({
        d: (serie[i].s.solar != null && e.s.solar != null) ? e.s.solar - serie[i].s.solar : null,
    }));

    const rascunhos = serie.filter(e => e.a.status !== 'concluida').length;
    const areas = new Set(serie.map(e => areaKey(e.a)));
    const mesmaArea = areas.size === 1;

    // Dimensões: da primeira para a última auditoria marcada
    const DIMS = [
        ...SENSOS.map(s => ({ id: s.id, num: s.num, nome: (s.nome.split('·')[1] || s.nome).trim(), cor: s.cor })),
        ...SOL_PILARES.map(p => ({ id: p.id, num: `SOL·${p.num}`, nome: p.nome, cor: p.cor })),
    ];
    const dimDeltas = DIMS.map(d => {
        const de = prim.dims[d.id], para = ult.dims[d.id];
        return { ...d, de, para, delta: (de != null && para != null) ? para - de : null };
    }).sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0));
    const maxAbs = Math.max(10, ...dimDeltas.map(x => Math.abs(x.delta ?? 0)));

    // ── Céu: o sol de cada auditoria, na ordem das datas ────────────────────
    // Na tela larga a faixa do céu é achatada de propósito: o print vai parar
    // num A4, e quanto mais larga a imagem, menos altura da folha ela come.
    // No celular volta a ser quadrada, senão o texto do SVG encolhe junto.
    const W = isMobile ? 760 : 1120, H = isMobile ? 214 : 226, horiz = isMobile ? 158 : 172, topo = 34;
    const seloUlt = solSelo(ult.s.solar);
    const skyPairs = claro
        ? { none: ['#F8FAFC', '#E2E8F0'], madrugada: ['#F5F3FF', '#DDD6FE'], amanhecer: ['#FFF7ED', '#FED7AA'], raiando: ['#FFFBEB', '#FDE68A'], pleno: ['#F0F9FF', '#FEF3C7'] }
        : { none: ['#1e293b', '#334155'], madrugada: ['#312e81', '#4338ca'], amanhecer: ['#7c2d12', '#fb923c'], raiando: ['#b45309', '#fcd34d'], pleno: ['#0284c7', '#fde68a'] };
    const [sky0, sky1] = skyPairs[seloUlt.key] || skyPairs.none;
    const solo = claro ? '#CBD5E1' : '#0d2818';
    const silhueta = claro ? '#94A3B8' : '#08160e';
    const linhaHoriz = claro ? '#D97706' : '#fcd34d';
    const gradeCor = claro ? 'rgba(15,23,42,0.22)' : 'rgba(255,255,255,0.18)';
    const gradeTexto = claro ? '#64748B' : 'rgba(255,255,255,0.5)';
    const rotuloData = claro ? '#0F172A' : '#e2e8f0';
    const rotuloSub = claro ? '#475569' : '#94a3b8';
    // No claro o sol precisa de pigmento: amarelo-claro sobre folha branca some.
    const corSol = (key) => claro
        ? ({ pleno: '#EAB308', raiando: '#F59E0B', amanhecer: '#EA580C', madrugada: '#6366F1' }[key] || '#94A3B8')
        : ({ pleno: '#FDE047', raiando: '#FBBF24', amanhecer: '#FB923C', madrugada: '#818CF8' }[key] || '#94A3B8');
    const px = (i) => n === 1 ? W / 2 : 44 + (i / (n - 1)) * (W - 88);
    const py = (v) => v == null ? horiz : horiz - (v / 100) * (horiz - topo);
    const corDelta = (d) => d == null ? NEUTRO : d > 0 ? (claro ? VERDE : '#4ADE80') : d < 0 ? (claro ? VERMELHO : '#F87171') : NEUTRO;

    return (
        <ModalShell claro={claro} onClose={onClose} largura={1180}
            title={<><FaChartLine color={SOL_ACCENT} /> Evolução × retrocesso · {n} relatórios</>}
            acoes={
                <button onClick={() => setClaro(c => !c)} title="Alterna entre o tema escuro do app e a folha branca — para projetar, imprimir ou colar num A4"
                    style={{ ...btnSec, fontSize: '0.68rem', padding: '0.3rem 0.7rem', border: `1px solid ${T.bd}`, color: T.mut, background: T.painel }}>
                    {claro ? 'Fundo escuro' : 'Fundo branco'}
                </button>
            }
            footer={<button onClick={onClose} style={btnPrim}>Fechar</button>}>

            {/* Placar: primeira → última marcada */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', flexWrap: 'wrap', marginBottom: '0.7rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                    <span style={{ fontSize: '1.35rem', fontWeight: 900, color: scoreCor(prim.s.solar) }}>{prim.s.solar != null ? `${prim.s.solar}%` : '—'}</span>
                    <span style={{ color: T.sub }}>→</span>
                    <span style={{ fontSize: '1.7rem', fontWeight: 900, color: scoreCor(ult.s.solar) }}>{ult.s.solar != null ? `${ult.s.solar}%` : '—'}</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 900, color: deltaTotal == null ? NEUTRO : deltaTotal > 0 ? VERDE : deltaTotal < 0 ? VERMELHO : NEUTRO, whiteSpace: 'nowrap' }}>
                        {deltaTotal == null ? '—' : deltaTotal === 0 ? '= 0 pt' : `${deltaTotal > 0 ? '▲' : '▼'} ${Math.abs(deltaTotal)} pt${Math.abs(deltaTotal) === 1 ? '' : 's'}`}
                    </span>
                </div>
            </div>

            {/* Avisos honestos: área misturada e rascunho no meio da série */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '0.8rem' }}>
                <div style={{ fontSize: '0.66rem', color: mesmaArea ? T.sub : T.aviso, lineHeight: 1.45 }}>
                    {mesmaArea
                        ? <>Mesma linha/máquina: <b>{areaLabel(prim.a)}</b>.</>
                        : <><b>Atenção:</b> os relatórios marcados são de {areas.size} áreas diferentes. A linha compara áreas distintas — a diferença não é evolução de uma mesma linha.</>}
                </div>
                {rascunhos > 0 && (
                    <div style={{ fontSize: '0.66rem', color: T.aviso, lineHeight: 1.45 }}>
                        <b>{rascunhos} rascunho(s)</b> na seleção: o score deles cobre só os critérios já avaliados.
                    </div>
                )}
            </div>

            {/* Trajetória do sol */}
            <div style={{ overflowX: 'auto', borderRadius: 12, border: `1px solid ${T.bd}`, marginBottom: '1rem' }}>
                <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: isMobile ? 560 : 0, display: 'block' }}>
                    <defs>
                        <linearGradient id={`evoSky${claro ? 'L' : 'D'}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={sky0} /><stop offset="100%" stopColor={sky1} />
                        </linearGradient>
                    </defs>
                    <rect x="0" y="0" width={W} height={H} fill={`url(#evoSky${claro ? 'L' : 'D'})`} />
                    {/* réguas das faixas do selo */}
                    {[FAIXA_ATENCAO, FAIXA_CONSOLIDA, FAIXA_EXCELENCIA].map(f => (
                        <g key={f}>
                            <line x1="30" y1={py(f)} x2={W - 10} y2={py(f)} stroke={gradeCor} strokeWidth="1" strokeDasharray="4 5" />
                            <text x="26" y={py(f) + 3} textAnchor="end" fontSize="9" fontWeight="700" fill={gradeTexto}>{f}</text>
                        </g>
                    ))}
                    {/* trechos entre auditorias: verde sobe, vermelho cai */}
                    {serie.slice(1).map((e, i) => {
                        const x1 = px(i), y1 = py(serie[i].s.solar), x2 = px(i + 1), y2 = py(e.s.solar);
                        const d = passos[i].d;
                        return (
                            <g key={`t${i}`}>
                                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={corDelta(d)} strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />
                                <text x={(x1 + x2) / 2} y={Math.min(y1, y2) - 13} textAnchor="middle" fontSize="12" fontWeight="900" fill={corDelta(d)}>
                                    {d == null ? '' : d === 0 ? '=' : `${d > 0 ? '▲' : '▼'}${Math.abs(d)}`}
                                </text>
                            </g>
                        );
                    })}
                    {/* solo */}
                    <rect x="0" y={horiz} width={W} height={H - horiz} fill={solo} />
                    <rect x="0" y={horiz} width={W} height="2" fill={linhaHoriz} opacity="0.45" />
                    <g fill={silhueta}>
                        <rect x="14" y={horiz - 11} width="22" height="11" /><rect x="24" y={horiz - 17} width="6" height="6" />
                        <rect x={W - 44} y={horiz - 14} width="26" height="14" /><rect x={W - 36} y={horiz - 21} width="5" height="7" />
                    </g>
                    {/* um sol por auditoria */}
                    {serie.map((e, i) => {
                        const v = e.s.solar, cx = px(i), cy = py(v);
                        const cor = corSol(solSelo(v).key);
                        const R = 15;
                        const num = numeroRelatorio(e.a);
                        return (
                            <g key={e.a.id}>
                                <g stroke={cor} strokeWidth="2" strokeLinecap="round" opacity={0.3 + ((v ?? 0) / 100) * 0.6}>
                                    {Array.from({ length: 8 }, (_, k) => k * 45).map(ang => {
                                        const rad = ang * Math.PI / 180, r1 = R + 4, r2 = R + 4 + 5 + ((v ?? 0) / 100) * 7;
                                        return <line key={ang} x1={cx + Math.cos(rad) * r1} y1={cy + Math.sin(rad) * r1} x2={cx + Math.cos(rad) * r2} y2={cy + Math.sin(rad) * r2} />;
                                    })}
                                </g>
                                <circle cx={cx} cy={cy} r={R} fill={cor} stroke={claro ? 'rgba(15,23,42,0.3)' : 'rgba(0,0,0,0.35)'} strokeWidth="1.5" />
                                <text x={cx} y={cy + 4} textAnchor="middle" fontSize="11" fontWeight="900" fill="#1a1000">{v != null ? v : '—'}</text>
                                <text x={cx} y={horiz + 17} textAnchor="middle" fontSize="10" fontWeight="800" fill={rotuloData}>{fmtData(e.a.data_auditoria)}</text>
                                <text x={cx} y={horiz + 31} textAnchor="middle" fontSize="9" fill={rotuloSub}>
                                    {num ? `Nº ${num}` : (e.a.maquina || e.a.setor || '')}
                                </text>
                                {e.a.status !== 'concluida' && (
                                    <text x={cx} y={horiz + 44} textAnchor="middle" fontSize="9" fontWeight="700" fill={claro ? '#B45309' : '#fbbf24'}>rascunho</text>
                                )}
                            </g>
                        );
                    })}
                </svg>
            </div>

            {/* O que subiu e o que caiu, por dimensão */}
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: T.fg, marginBottom: '0.15rem' }}>
                O que mudou, dimensão por dimensão
            </div>
            <div style={{ fontSize: '0.64rem', color: T.mut, marginBottom: '0.6rem' }}>
                Da primeira ({fmtData(prim.a.data_auditoria)}) para a última ({fmtData(ult.a.data_auditoria)}) marcada. Retrocesso à esquerda, evolução à direita.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {dimDeltas.map(d => {
                    const larg = d.delta == null ? 0 : (Math.abs(d.delta) / maxAbs) * 50;
                    const cor = d.delta == null ? NEUTRO : d.delta > 0 ? VERDE : d.delta < 0 ? VERMELHO : NEUTRO;
                    return (
                        <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ width: isMobile ? 84 : 132, flexShrink: 0, fontSize: isMobile ? '0.62rem' : '0.66rem', fontWeight: 800, color: claro ? tinta(d.cor) : d.cor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.num} {d.nome}</span>
                            <div style={{ flex: 1, minWidth: 80, height: 14, position: 'relative', background: T.trilho, borderRadius: 4 }}>
                                <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: T.centro }} />
                                {d.delta != null && d.delta !== 0 && (
                                    <div style={{ position: 'absolute', top: 2, bottom: 2, borderRadius: 3, background: cor, ...(d.delta > 0 ? { left: '50%', width: `${larg}%` } : { right: '50%', width: `${larg}%` }) }} />
                                )}
                            </div>
                            <span style={{ width: 46, textAlign: 'right', flexShrink: 0, fontSize: '0.68rem', fontWeight: 900, color: cor, whiteSpace: 'nowrap' }}>
                                {d.delta == null ? '—' : d.delta > 0 ? `+${d.delta}` : d.delta}
                            </span>
                            <span style={{ width: isMobile ? 64 : 74, textAlign: 'right', flexShrink: 0, fontSize: isMobile ? '0.56rem' : '0.62rem', color: T.sub, whiteSpace: 'nowrap' }}>
                                {d.de != null ? `${d.de}%` : '—'} → {d.para != null ? `${d.para}%` : '—'}
                            </span>
                        </div>
                    );
                })}
            </div>

            <div style={{ fontSize: '0.62rem', color: T.sub, marginTop: '0.8rem', lineHeight: 1.5 }}>
                Cada sol é o Índice Solar daquela auditoria; cada seta é a diferença entre duas datas marcadas. Não há média do período nem projeção — só o que foi medido.
            </div>
        </ModalShell>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  ROTINA SEMANAL — quem já foi auditado nesta semana e quem está pendente
// ═══════════════════════════════════════════════════════════════════════════════
const corCobertura = (p) => p == null ? 'var(--color-text-subtle)' : p >= 100 ? '#16A34A' : p >= 50 ? '#D97706' : '#DC2626';
const pct = (a, b) => b ? Math.round((a / b) * 100) : null;
// Mesmo critério do solarDe do painel (solar_bruto > solar > score antigo)
const solarDeAud = (aud) => aud?.scores?.solar_bruto ?? aud?.scores?.solar ?? aud?.score ?? null;

const RotinaSemanal = ({ mapa, semanas, isMobile, onAuditar, onAbrir }) => {
    const atual = semanaAtualKey();
    const [semana, setSemana] = useState(atual);
    const [fabrica, setFabrica] = useState('todas');
    const [ver, setVer] = useState('pendentes'); // pendentes | avaliadas | todas
    const [busca, setBusca] = useState('');
    const ehAtual = semana === atual;

    const fabricas = [...new Set(mapa.map(m => m.fabrica).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    // Área (setor) pelo nome, juntando as fábricas: INJEÇÃO, MONTAGEM, TAMPOGRAFIA…
    const areas = [...new Set(mapa.filter(m => fabrica === 'todas' || m.fabrica === fabrica).map(m => norm(m.setor)).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b));
    const [areaSel, setArea] = useState(() => mapa.some(m => norm(m.setor) === 'TAMPOGRAFIA') ? 'TAMPOGRAFIA' : 'todas');
    // Fábrica sem essa área: mostra todas em vez de uma lista vazia
    const area = areaSel === 'todas' || areas.includes(areaSel) ? areaSel : 'todas';
    const daFabrica = mapa.filter(m => fabrica === 'todas' || m.fabrica === fabrica);
    const base = daFabrica.filter(m => area === 'todas' || norm(m.setor) === area);
    const pendArea = (a) => daFabrica.filter(m => (a === 'todas' || norm(m.setor) === a) && !audDe(m, semana)).length;
    const audDe = (m, s) => semanas.get(areaKey(m))?.get(s) || null;
    const feitas = base.filter(m => audDe(m, semana)).length;
    const cobertura = pct(feitas, base.length);
    // Dias que ainda restam para fechar a semana (conta hoje)
    const restam = ehAtual ? 7 - ((new Date().getDay() + 6) % 7) : 0;

    // Agrupa por fábrica · setor, pior cobertura primeiro
    const grupos = (() => {
        const g = new Map();
        base.forEach(m => {
            const k = `${m.fabrica}|${m.setor}`;
            if (!g.has(k)) g.set(k, { k, fabrica: m.fabrica, setor: m.setor, itens: [] });
            g.get(k).itens.push({ ...m, aud: audDe(m, semana) });
        });
        const q = norm(busca);
        return [...g.values()].map(gr => {
            const ok = gr.itens.filter(i => i.aud).length;
            const visiveis = gr.itens
                .filter(i => ver === 'todas' || (ver === 'pendentes' ? !i.aud : i.aud))
                .filter(i => !q || `${norm(gr.fabrica)} ${norm(gr.setor)} ${norm(i.maquina)}`.includes(q))
                .sort((a, b) => String(a.maquina || '').localeCompare(String(b.maquina || ''), undefined, { numeric: true }));
            return { ...gr, ok, total: gr.itens.length, visiveis };
        }).filter(gr => gr.visiveis.length).sort((a, b) => (a.ok / a.total) - (b.ok / b.total) || `${a.fabrica}${a.setor}`.localeCompare(`${b.fabrica}${b.setor}`));
    })();

    // Histórico: 8 semanas terminando na selecionada, por setor
    const colunas = Array.from({ length: 8 }, (_, i) => somaDias(semana, -7 * (7 - i)));
    const setoresHist = (() => {
        const g = new Map();
        base.forEach(m => { const k = `${m.fabrica}|${m.setor}`; if (!g.has(k)) g.set(k, { k, nome: `${m.fabrica} · ${m.setor}`, itens: [] }); g.get(k).itens.push(m); });
        return [...g.values()].sort((a, b) => a.nome.localeCompare(b.nome, undefined, { numeric: true }));
    })();
    const celula = (itens, s) => pct(itens.filter(m => audDe(m, s)).length, itens.length);

    const chip = (ativo) => ({ ...btnSec, padding: '0.3rem 0.7rem', fontSize: '0.7rem', borderColor: ativo ? `${ACCENT}88` : 'var(--border-color-dark)', color: ativo ? ACCENT : 'var(--color-text-muted)', background: ativo ? `${ACCENT}14` : 'transparent' });
    const navBtn = (habilitado) => ({ ...btnSec, padding: '0.35rem 0.6rem', opacity: habilitado ? 1 : 0.35, cursor: habilitado ? 'pointer' : 'default' });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Cabeçalho da semana */}
            <div className="glass-panel" style={{ borderRadius: 14, border: '1px solid var(--border-color-dark)', padding: '1rem 1.1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.8rem', flexWrap: 'wrap' }}>
                    <div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 900, color: 'var(--color-text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <FaCalendarAlt color={ACCENT} size={14} /> Rotina semanal
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginTop: 2 }}>Toda linha e máquina precisa de uma auditoria concluída por semana (segunda a domingo).</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <button onClick={() => setSemana(somaDias(semana, -7))} style={navBtn(true)} title="Semana anterior"><FaChevronLeft size={10} /></button>
                        <div style={{ minWidth: isMobile ? 0 : 210, textAlign: 'center', fontSize: '0.76rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                            {rotuloSemana(semana)}
                            {ehAtual ? <div style={{ fontSize: '0.6rem', color: ACCENT, fontWeight: 700 }}>semana atual · {restam === 1 ? 'último dia' : `faltam ${restam} dias`}</div>
                                : <button onClick={() => setSemana(atual)} style={{ display: 'block', margin: '0 auto', background: 'none', border: 'none', color: ACCENT, fontSize: '0.6rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}>voltar para a semana atual</button>}
                        </div>
                        <button onClick={() => !ehAtual && setSemana(somaDias(semana, 7))} disabled={ehAtual} style={navBtn(!ehAtual)} title="Próxima semana"><FaChevronRight size={10} /></button>
                    </div>
                </div>

                {/* Números da semana */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '0.6rem', marginTop: '0.9rem' }}>
                    {[
                        ['Cobertura', cobertura != null ? `${cobertura}%` : '—', corCobertura(cobertura)],
                        ['Avaliadas', `${feitas}/${base.length}`, 'var(--color-text-main)'],
                        ['Pendentes', base.length - feitas, base.length - feitas ? '#DC2626' : '#16A34A'],
                        [ehAtual ? 'Por dia até domingo' : 'Situação', ehAtual ? (base.length - feitas ? Math.ceil((base.length - feitas) / restam) : 0) : (feitas === base.length ? 'Fechada' : 'Não fechou'), ehAtual ? 'var(--color-text-main)' : corCobertura(cobertura)],
                    ].map(([l, v, c]) => (
                        <div key={l} style={{ background: 'var(--bg-surface-glass)', border: '1px solid var(--border-color-dark)', borderRadius: 10, padding: '0.55rem 0.7rem' }}>
                            <div style={{ fontSize: '1.15rem', fontWeight: 900, color: c }}>{v}</div>
                            <div style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{l}</div>
                        </div>
                    ))}
                </div>
                <div style={{ height: 6, borderRadius: 4, background: 'var(--border-color-dark)', marginTop: '0.7rem', overflow: 'hidden' }}>
                    <div style={{ width: `${cobertura || 0}%`, height: '100%', background: corCobertura(cobertura), transition: 'width 0.3s' }} />
                </div>
            </div>

            {/* Área — o número é o que está pendente nela na semana escolhida */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginRight: '0.2rem' }}>Área</span>
                {['todas', ...areas].map(a => {
                    const n = pendArea(a);
                    return (
                        <button key={a} onClick={() => setArea(a)} style={chip(area === a)}>
                            {a === 'todas' ? 'Todas' : a}
                            <span style={{ fontSize: '0.6rem', fontWeight: 900, color: n ? '#DC2626' : '#16A34A' }}>{n || '✓'}</span>
                        </button>
                    );
                })}
            </div>

            {/* Filtros */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                {[['pendentes', 'Pendentes'], ['avaliadas', 'Avaliadas'], ['todas', 'Todas']].map(([k, l]) => (
                    <button key={k} onClick={() => setVer(k)} style={chip(ver === k)}>{l}</button>
                ))}
                <select value={fabrica} onChange={e => setFabrica(e.target.value)} style={{ ...inputSty, width: 'auto', padding: '0.3rem 0.5rem', fontSize: '0.72rem' }}>
                    <option value="todas">Todas as fábricas</option>
                    {fabricas.map(f => <option key={f}>{f}</option>)}
                </select>
                <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar setor, linha ou máquina…" style={{ ...inputSty, flex: '1 1 200px', padding: '0.35rem 0.6rem', fontSize: '0.74rem' }} />
            </div>

            {/* Lista da semana, por setor */}
            {grupos.length === 0 ? (
                <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                    {ver === 'pendentes' && base.length ? <><FaCheckCircle size={28} color="#16A34A" style={{ marginBottom: '0.6rem' }} /><div style={{ fontWeight: 800, color: 'var(--color-text-main)' }}>Nenhuma pendência nesta semana.</div></> : 'Nada para mostrar com esses filtros.'}
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {grupos.map(gr => {
                        const p = pct(gr.ok, gr.total);
                        return (
                            <div key={gr.k} className="glass-panel" style={{ borderRadius: 12, border: '1px solid var(--border-color-dark)', padding: '0.75rem 0.9rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.55rem' }}>
                                    <FaIndustry size={11} color={ACCENT} />
                                    <span style={{ fontSize: '0.8rem', fontWeight: 900, color: 'var(--color-text-main)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{gr.fabrica} · {gr.setor}</span>
                                    <span style={{ fontSize: '0.66rem', fontWeight: 800, color: corCobertura(p) }}>{gr.ok}/{gr.total}</span>
                                    <div style={{ width: 70, height: 5, borderRadius: 3, background: 'var(--border-color-dark)', overflow: 'hidden', flexShrink: 0 }}>
                                        <div style={{ width: `${p}%`, height: '100%', background: corCobertura(p) }} />
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? '100%' : '210px'}, 1fr))`, gap: '0.4rem' }}>
                                    {gr.visiveis.map(m => m.aud ? (
                                        <button key={areaKey(m)} onClick={() => onAbrir(m.aud)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#16A34A10', border: '1px solid #16A34A44', borderRadius: 8, padding: '0.4rem 0.55rem', cursor: 'pointer', textAlign: 'left' }}>
                                            <FaCheckCircle size={11} color="#16A34A" style={{ flexShrink: 0 }} />
                                            <span style={{ flex: 1, minWidth: 0 }}>
                                                <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.maquina || 'Setor inteiro'}</span>
                                                <span style={{ display: 'block', fontSize: '0.58rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fmtCurto(m.aud.data_auditoria)}{m.aud.auditor ? ` · ${m.aud.auditor}` : ''}</span>
                                            </span>
                                            {solarDeAud(m.aud) != null && <span style={{ fontSize: '0.66rem', fontWeight: 900, color: scoreCor(solarDeAud(m.aud)) }}>{Math.round(solarDeAud(m.aud))}%</span>}
                                        </button>
                                    ) : (
                                        <div key={areaKey(m)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid #DC262644', background: '#DC26260a', borderRadius: 8, padding: '0.4rem 0.55rem' }}>
                                            <FaExclamationTriangle size={10} color="#DC2626" style={{ flexShrink: 0 }} />
                                            <span style={{ flex: 1, minWidth: 0 }}>
                                                <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.maquina || 'Setor inteiro'}</span>
                                                <span style={{ display: 'block', fontSize: '0.58rem', color: 'var(--color-text-subtle)' }}>{m.ult ? `última: ${fmtCurto(m.ult.data_auditoria)}` : 'nunca auditada'}</span>
                                            </span>
                                            {ehAtual && <button onClick={() => onAuditar(m)} style={{ ...btnSec, padding: '0.25rem 0.55rem', fontSize: '0.64rem', borderColor: `${ACCENT}55`, color: ACCENT }}><FaBroom size={9} /> Auditar</button>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Últimas 8 semanas por setor */}
            <div className="glass-panel" style={{ borderRadius: 14, border: '1px solid var(--border-color-dark)', padding: '1rem 1.1rem' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-text-main)' }}>Últimas 8 semanas</div>
                <div style={{ fontSize: '0.64rem', color: 'var(--color-text-muted)', margin: '0.15rem 0 0.7rem' }}>% das linhas/máquinas do setor avaliadas em cada semana. Clique numa semana para abri-la.</div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ borderCollapse: 'separate', borderSpacing: 3, fontSize: '0.66rem', width: '100%' }}>
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'left', color: 'var(--color-text-subtle)', fontWeight: 700, padding: '0 0.4rem', minWidth: 150 }}>Setor</th>
                                {colunas.map(s => (
                                    <th key={s} onClick={() => setSemana(s)} style={{ cursor: 'pointer', color: s === semana ? ACCENT : 'var(--color-text-subtle)', fontWeight: 800, whiteSpace: 'nowrap', padding: '0 0.2rem' }}>S{numSemana(s)}<div style={{ fontWeight: 600, fontSize: '0.56rem' }}>{fmtCurto(s)}</div></th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {[{ k: '__total', nome: 'Total', itens: base }, ...setoresHist].map(row => (
                                <tr key={row.k}>
                                    <td style={{ padding: '0.25rem 0.4rem', fontWeight: row.k === '__total' ? 900 : 700, color: 'var(--color-text-main)', whiteSpace: 'nowrap' }}>{row.nome} <span style={{ color: 'var(--color-text-subtle)', fontWeight: 600 }}>({row.itens.length})</span></td>
                                    {colunas.map(s => {
                                        const v = s > atual ? null : celula(row.itens, s);
                                        const c = corCobertura(v);
                                        return (
                                            <td key={s} onClick={() => setSemana(s)} title={v != null ? `${rotuloSemana(s)}: ${v}%` : ''}
                                                style={{ cursor: 'pointer', textAlign: 'center', fontWeight: 800, color: v == null ? 'var(--color-text-subtle)' : c, background: v == null ? 'transparent' : `${c}1a`, border: `1px solid ${s === semana ? ACCENT : 'transparent'}`, borderRadius: 5, padding: '0.25rem 0.3rem', minWidth: 42 }}>
                                                {v == null ? '—' : `${v}%`}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// Modal: nova auditoria (planta → fábrica → setor → linha/máquina do cadastro)
const NovaAuditoriaModal = ({ estrutura, prefill, userName, onClose, onCreate }) => {
    const [planta, setPlanta] = useState(prefill?.planta || '');
    const [fabrica, setFabrica] = useState(prefill?.fabrica || '');
    const [setor, setSetor] = useState(prefill?.setor || '');
    const [maquina, setMaquina] = useState(prefill?.maquina || '');
    const [auditor, setAuditor] = useState(userName);
    const [acompanhante, setAcompanhante] = useState('');
    const plantas = [...new Set(estrutura.map(e => e.planta))].filter(Boolean).sort();
    const fabricas = [...new Set(estrutura.filter(e => e.planta === planta).map(e => e.fabrica))].filter(Boolean).sort();
    const setores = [...new Set(estrutura.filter(e => e.planta === planta && e.fabrica === fabrica).map(e => e.setor))].filter(Boolean).sort();
    // Linhas/máquinas do setor selecionado (ordenadas numericamente)
    // (as que compõem uma linha não entram: quem audita, audita a linha)
    const maquinas = [...new Set(estrutura.filter(e => e.planta === planta && e.fabrica === fabrica && e.setor === setor && !emLinha(estrutura, e)).map(e => e.maquina))]
        .filter(Boolean).sort((a, b) => { const na = parseInt(String(a).match(/\d+/)?.[0] || 0, 10), nb = parseInt(String(b).match(/\d+/)?.[0] || 0, 10); return na - nb || String(a).localeCompare(String(b)); });
    const composicao = maquina ? composicaoLinha(estrutura, { planta, fabrica, setor, maquina }) : [];
    const ok = planta && fabrica && setor;
    return (
        <ModalShell title={<><FaBroom color={ACCENT} /> Nova Auditoria 5S</>} onClose={onClose}
            footer={<>
                <button onClick={onClose} style={btnSec}>Cancelar</button>
                <button disabled={!ok} onClick={() => onCreate({ planta, fabrica, setor, maquina: maquina || null, auditor, acompanhante })} style={{ ...btnPrim, opacity: ok ? 1 : 0.5 }}><FaPlus size={12} /> Iniciar auditoria</button>
            </>}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                <div><label style={labelSty}>Planta *</label>
                    <select style={inputSty} value={planta} onChange={e => { setPlanta(e.target.value); setFabrica(''); setSetor(''); setMaquina(''); }}>
                        <option value="">Selecione…</option>{plantas.map(p => <option key={p}>{p}</option>)}
                    </select></div>
                <div><label style={labelSty}>Fábrica *</label>
                    <select style={inputSty} value={fabrica} disabled={!planta} onChange={e => { setFabrica(e.target.value); setSetor(''); setMaquina(''); }}>
                        <option value="">{planta ? 'Selecione…' : 'Escolha a planta'}</option>{fabricas.map(f => <option key={f}>{f}</option>)}
                    </select></div>
                <div><label style={labelSty}>Setor *</label>
                    <select style={inputSty} value={setor} disabled={!fabrica} onChange={e => { setSetor(e.target.value); setMaquina(''); }}>
                        <option value="">{fabrica ? 'Selecione…' : 'Escolha a fábrica'}</option>{setores.map(s => <option key={s}>{s}</option>)}
                    </select></div>
                <div><label style={labelSty}>Linha / Máquina</label>
                    <select style={{ ...inputSty, opacity: maquinas.length ? 1 : 0.6 }} value={maquina} disabled={!setor || !maquinas.length} onChange={e => setMaquina(e.target.value)}>
                        <option value="">{maquinas.length ? 'Setor inteiro' : (setor ? 'Sem linhas/máquinas' : 'Escolha o setor')}</option>
                        {maquinas.map(m => <option key={m}>{m}</option>)}
                    </select></div>
                <div><label style={labelSty}>Auditor</label><input style={inputSty} value={auditor} onChange={e => setAuditor(e.target.value)} /></div>
                <div><label style={labelSty}>Acompanhante</label><input style={inputSty} value={acompanhante} onChange={e => setAcompanhante(e.target.value)} placeholder="Líder da área (opcional)" /></div>
            </div>
            {composicao.length > 0 && <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.6rem' }}><b style={{ color: 'var(--color-text-main)' }}>{maquina}</b> é composta por: {composicao.join(', ')}. Avalie o conjunto.</div>}
            {maquinas.length > 0 && !maquina && <div style={{ fontSize: '0.66rem', color: 'var(--color-text-muted)', marginTop: '0.6rem' }}>Deixe em <b>Setor inteiro</b> para auditar o setor como um todo, ou escolha uma linha/máquina específica.</div>}
        </ModalShell>
    );
};
