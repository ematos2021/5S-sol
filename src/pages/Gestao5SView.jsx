import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';
import { getUsuario } from '../services/usuario';
import { compressImage } from '../services/imageCompressor';
import { gerarResumoExecutivo } from '../services/ia';
import { entregarRelatorio } from '../services/relatorio';
import { SENSOS, ESCALA_5S, scores5S, SOL_PILARES, scoresSOL, scoresIntegrado, indiceSolar, solSelo } from '../data/cincoS';
import {
    FaPlus, FaTrash, FaSync, FaCheck, FaTimes, FaChevronLeft, FaBroom,
    FaChartPie, FaListUl, FaMapMarkedAlt, FaCamera, FaArrowLeft, FaCheckCircle,
    FaIndustry, FaExclamationTriangle, FaBolt, FaGraduationCap, FaClipboardCheck, FaFilePdf,
    FaSun, FaShieldAlt, FaHardHat, FaTrophy, FaMagic, FaRobot, FaSave, FaPen, FaSpinner, FaCalendarAlt,
} from 'react-icons/fa';

const ACCENT = '#22C55E';
const SOL_ACCENT = '#F59E0B';
// Lookup unificado de dimensões (5S + SOL) para plano de ação e relatório
const DIM_BY_ID = Object.fromEntries([...SENSOS, ...SOL_PILARES].map(d => [d.id, d]));

// O resumo por IA agora passa por uma Edge Function do Supabase: a chave do
// Gemini é cobrada por uso e ficava aqui, legível para qualquer um que abrisse
// o código-fonte da página ou descompactasse o APK. Ver src/services/ia.js.
const gerarResumoIA5S = (aud, sc, scSol, solar) => gerarResumoExecutivo(aud, sc, scSol, solar);

// ─── Helpers ─────────────────────────────────────────────────────────────────
const hojeISO = () => new Date().toISOString().slice(0, 10);
const fmtData = (d) => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const scoreCor = (s) => s == null ? '#64748B' : s >= 85 ? '#16A34A' : s >= 70 ? '#D97706' : '#DC2626';
const notaCor = (n) => n == null ? 'var(--border-color-dark)' : n <= 1 ? '#DC2626' : n === 2 ? '#EA580C' : n === 3 ? '#D97706' : n === 4 ? '#84CC16' : '#16A34A';
const areaKey = (a) => `${a.planta || ''}|${a.fabrica || ''}|${a.setor || ''}|${a.maquina || ''}`;
// Rótulo curto da área (inclui a linha/máquina quando houver)
const areaLabel = (a) => `${a.fabrica || ''} · ${a.setor || ''}${a.maquina ? ` · ${a.maquina}` : ''}`;

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

// ─── "O sol vai nascer na Mondial" — nascer do sol por Índice Solar (SVG) ─────
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
                <text x={W / 2} y={H - 7} textAnchor="middle" fontSize="11" fontWeight="900" fill="#fde68a" opacity="0.85" letterSpacing="1">MONDIAL</text>
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

const ModalShell = ({ title, children, footer, onClose, wide }) => (
    <div style={{ position: 'fixed', inset: 0, zIndex: 6000, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.9rem' }}>
        <div className="glass-panel" style={{ width: '100%', maxWidth: wide ? 760 : 600, maxHeight: '88vh', borderRadius: 16, border: '1px solid var(--border-color-dark)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-app)' }}>
            <div style={{ padding: '1rem 1.3rem', borderBottom: '1px solid var(--border-color-dark)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--color-text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>{title}</div>
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}><FaTimes size={16} /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.3rem' }}>{children}</div>
            <div style={{ padding: '0.9rem 1.3rem', borderTop: '1px solid var(--border-color-dark)', display: 'flex', justifyContent: 'flex-end', gap: '0.7rem', alignItems: 'center' }}>{footer}</div>
        </div>
    </div>
);

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
function gerarRelatorio5S(aud, emitente) {
    const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const respostas = aud.respostas || {};
    const sc = aud.scores && aud.scores.geral != null ? aud.scores : scores5S(respostas);
    const geral = sc.geral;
    const scSol = scoresSOL(respostas);
    const solar = aud.scores?.solar != null ? aud.scores.solar : indiceSolar(geral, scSol.geral);
    const selo = solSelo(solar);
    const nowStr = new Date().toLocaleDateString('pt-BR');
    const scCorHex = (s) => s == null ? '#94a3b8' : s >= 85 ? '#16a34a' : s >= 70 ? '#d97706' : '#dc2626';
    const notaHex = (n) => n == null ? '#94a3b8' : n <= 1 ? '#dc2626' : n === 2 ? '#ea580c' : n === 3 ? '#d97706' : n === 4 ? '#84cc16' : '#16a34a';

    const avaliados = SENSOS.map(s => ({ s, v: sc[s.id] })).filter(x => x.v != null);
    const melhor = avaliados.length ? avaliados.reduce((a, b) => (b.v > a.v ? b : a)) : null;
    const pior = avaliados.length ? avaliados.reduce((a, b) => (b.v < a.v ? b : a)) : null;
    const criticos = SENSOS.flatMap(s => s.itens.filter(it => respostas[it.id] != null && respostas[it.id] <= 2).map(it => ({ senso: s, it, nota: respostas[it.id] })));
    const planos = aud.planos || [];
    const planosAbertos = planos.filter(p => p.status !== 'concluida');

    // Leitura executiva (regras)
    const insights = [];
    if (geral == null) insights.push('📝 Auditoria ainda sem critérios avaliados.');
    else if (geral >= 85) insights.push(`🏆 Área em nível de excelência (${geral}%). Foco em sustentar rituais e disseminar as práticas como referência.`);
    else if (geral >= 70) insights.push(`📈 Área em consolidação (${geral}%). Atacar o senso mais frágil eleva o patamar geral.`);
    else insights.push(`🚨 Área em atenção (${geral}%): priorizar o plano de ação e reauditar em até 30 dias.`);
    if (pior && melhor && pior.s.id !== melhor.s.id) {
        insights.push(`🔧 Senso mais frágil: ${pior.s.num} ${pior.s.nome.split('·')[1].trim()} (${pior.v}%).`);
        insights.push(`⭐ Destaque: ${melhor.s.num} ${melhor.s.nome.split('·')[1].trim()} (${melhor.v}%).`);
    }
    if (criticos.length) insights.push(`⛔ ${criticos.length} critério(s) em condição crítica (nota ≤ 2) com desvio registrado.`);
    // SOL
    if (scSol.geral != null) {
        insights.push(`${selo.emoji} Índice Solar ${solar}% — ${selo.label}. ${selo.frase}`);
        const solAval = SOL_PILARES.map(p => ({ p, v: scSol[p.id] })).filter(x => x.v != null);
        if (solAval.length) {
            const solPior = solAval.reduce((a, b) => (b.v < a.v ? b : a));
            if (solPior.v < 85) insights.push(`🔆 Raio do sol a fortalecer: ${solPior.p.num} · ${solPior.p.nome} (${solPior.v}%).`);
        }
        const segScore = scSol.sol_seg;
        if (segScore != null && segScore < 70) insights.push(`🦺 Atenção à Segurança (${segScore}%): tratar antes de avançar — o sol só nasce onde é seguro trabalhar.`);
    }
    if (planosAbertos.length) insights.push(`📋 ${planosAbertos.length} ação(ões) do plano 5S+SOL em aberto${planos.length > planosAbertos.length ? ` (${planos.length - planosAbertos.length} concluída(s))` : ''}.`);
    else if (planos.length) insights.push(`✅ Plano de ação 5S+SOL 100% concluído (${planos.length} ação(ões)).`);

    // Radar SVG (pentágono) inline
    const radarSvg = (() => {
        const size = 250, cx = size / 2, cy = size / 2, R = 86;
        const ang = (i) => (-90 + i * 72) * Math.PI / 180;
        const pt = (i, f) => `${(cx + Math.cos(ang(i)) * R * f).toFixed(1)},${(cy + Math.sin(ang(i)) * R * f).toFixed(1)}`;
        const ring = (f) => SENSOS.map((_, i) => pt(i, f)).join(' ');
        const poly = SENSOS.map((s, i) => pt(i, Math.max((sc[s.id] ?? 0) / 100, 0.02))).join(' ');
        const labels = SENSOS.map((s, i) => {
            const lx = cx + Math.cos(ang(i)) * R * 1.32, ly = cy + Math.sin(ang(i)) * R * 1.32;
            return `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="11" font-weight="800" fill="${s.cor}">${s.num} ${sc[s.id] != null ? sc[s.id] + '%' : '—'}</text>`;
        }).join('');
        const axes = SENSOS.map((s, i) => `<line x1="${cx}" y1="${cy}" x2="${pt(i, 1).split(',')[0]}" y2="${pt(i, 1).split(',')[1]}" stroke="#e2e8f0" stroke-width="1"/>`).join('');
        const dots = SENSOS.map((s, i) => { const [x, y] = pt(i, Math.max((sc[s.id] ?? 0) / 100, 0.02)).split(','); return `<circle cx="${x}" cy="${y}" r="4" fill="${s.cor}" stroke="#fff" stroke-width="1.5"/>`; }).join('');
        return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
            ${[0.25, 0.5, 0.75, 1].map(f => `<polygon points="${ring(f)}" fill="none" stroke="#e2e8f0" stroke-width="1"/>`).join('')}
            ${axes}<polygon points="${poly}" fill="#22c55e33" stroke="#16a34a" stroke-width="2"/>${dots}${labels}</svg>`;
    })();

    const barrasSensos = SENSOS.map(s => {
        const v = sc[s.id];
        return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
            <span style="width:150px;font-size:11px;font-weight:800;color:${s.cor};text-align:right;white-space:nowrap">${s.num} · ${esc(s.nome.split('·')[1].trim())}</span>
            <div style="flex:1;height:14px;background:#f1f5f9;border-radius:7px;overflow:hidden"><div style="width:${v ?? 0}%;height:100%;background:${s.cor};border-radius:7px"></div></div>
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
            const n = respostas[it.id];
            const obs = aud.observacoes?.[it.id] || '';
            const fts = aud.fotos?.[it.id] || [];
            return `<tr>
                <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-weight:700;font-size:11px">${esc(it.label)}<div style="font-size:9.5px;color:#94a3b8;font-weight:400;margin-top:1px">${esc(it.desc)}</div>
                ${obs ? `<div style="font-size:10.5px;color:#b91c1c;margin-top:3px"><b>Desvio:</b> ${esc(obs)}</div>` : ''}
                ${fts.length ? `<div style="display:flex;gap:6px;margin-top:5px;flex-wrap:wrap">${fts.map(f => `<div style="text-align:center"><img src="${f}" style="width:96px;height:72px;object-fit:cover;border-radius:4px;border:1px solid #e2e8f0"/><div style="font-size:9px;font-weight:800;color:#0f172a;margin-top:1px">Fig. ${figOf.get(f)}</div></div>`).join('')}</div>` : ''}</td>
                <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;text-align:center;vertical-align:top;width:70px">
                    <span style="display:inline-flex;width:30px;height:30px;border-radius:50%;background:${notaHex(n)};color:#fff;font-size:13px;font-weight:900;align-items:center;justify-content:center">${n != null ? n : '—'}</span>
                    <div style="font-size:8.5px;color:#94a3b8;margin-top:2px">${n != null ? esc(ESCALA_5S[n].rotulo) : 'não avaliado'}</div></td></tr>`;
        }).join('');
        return `<div class="avoid-break" style="margin-bottom:14px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
            <div style="background:${s.cor};padding:7px 12px;display:flex;justify-content:space-between;align-items:center">
                <span style="font-weight:900;color:#fff;font-size:12px">${s.num} · ${esc(s.nome)}</span>
                <span style="font-weight:900;color:#fff;font-size:13px">${scoresObj[s.id] != null ? scoresObj[s.id] + '%' : '—'}</span></div>
            <table style="width:100%;border-collapse:collapse">${linhas}</table></div>`;
    }).join('');
    const detalheHtml = detalheDe(SENSOS, sc);
    const solDetalheHtml = detalheDe(SOL_PILARES, scSol);

    // Barras dos pilares SOL + nascer do sol (SVG) para o relatório
    const barrasSol = SOL_PILARES.map(p => {
        const v = scSol[p.id];
        return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
            <span style="width:150px;font-size:11px;font-weight:800;color:${p.cor};text-align:right;white-space:nowrap">${p.num} · ${esc(p.nome)}</span>
            <div style="flex:1;height:14px;background:#f1f5f9;border-radius:7px;overflow:hidden"><div style="width:${v ?? 0}%;height:100%;background:${p.cor};border-radius:7px"></div></div>
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
            <text x="${W / 2}" y="${H - 8}" text-anchor="middle" font-size="12" font-weight="900" fill="#fde68a" opacity="0.85" letter-spacing="1">MONDIAL</text></svg>`;
    })();

    const planoRows = planos.map(pl => {
        const s = DIM_BY_ID[pl.senso] || SENSOS[0];
        const done = pl.status === 'concluida';
        return `<tr><td style="padding:6px 10px;border-bottom:1px solid #f1f5f9"><span style="font-size:9px;font-weight:900;color:#fff;background:${s.cor};padding:2px 7px;border-radius:8px">${s.num}</span></td>
        <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-weight:700;font-size:11px">${esc(pl.descricao) || '—'}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:11px">${esc(pl.resp) || '—'}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;text-align:center;font-size:11px">${pl.prazo ? fmtData(pl.prazo) : '—'}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;text-align:center"><span style="font-size:9px;font-weight:800;padding:2px 9px;border-radius:9px;background:${done ? '#dcfce7' : '#fef3c7'};color:${done ? '#16a34a' : '#d97706'}">${done ? 'CONCLUÍDA' : 'ABERTA'}</span></td></tr>`;
    }).join('');

    const galleryHtml = allPhotos.length === 0 ? '' : `
        <h2 class="page-break" style="font-size:13px;color:#0f172a;border-bottom:2px solid #22c55e;padding-bottom:5px;margin:24px 0 10px">📷 Anexos fotográficos (${allPhotos.length})</h2>
        ${allPhotos.map(p => `<div class="avoid-break" style="border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin-bottom:16px">
            <div style="background:#f1f5f9;border-left:5px solid #22c55e;padding:8px 12px;margin-bottom:10px;font-size:12px;font-weight:700;color:#0f172a;display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px">
                <span>FIGURA ${p.fig}</span><span style="font-weight:400;color:#64748b">${p.senso} · ${esc(p.item)}</span></div>
            <img src="${p.src}" style="width:100%;max-height:640px;object-fit:contain;display:block;border-radius:4px;border:1px solid #eee"/></div>`).join('')}`;

    const h2 = (t) => `<h2 style="font-size:13px;color:#0f172a;border-bottom:2px solid #22c55e;padding-bottom:5px;margin:24px 0 10px">${t}</h2>`;
    const kpi = (val, lbl, cor) => `<div style="flex:1;min-width:0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:9px 6px;text-align:center">
        <div style="font-size:19px;font-weight:900;color:${cor};line-height:1.15;white-space:nowrap">${val}</div>
        <div style="font-size:8.5px;color:#64748b;text-transform:uppercase;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${lbl}</div></div>`;

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(aud.titulo)} · Relatório</title>
<style>
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    @page { size: A4; margin: 10mm; }
    @media print {
        body { background: #fff !important; margin: 0 !important; }
        .sheet { margin: 0 auto !important; box-shadow: none !important; border-radius: 0 !important; max-width: 100% !important; }
        .no-print { display: none !important; }
        .avoid-break { page-break-inside: avoid; break-inside: avoid; }
        h2 { page-break-after: avoid; }
        tr { page-break-inside: avoid; }
        .page-break { page-break-before: always; }
        img { max-height: 560px !important; }
    }
</style></head>
<body style="margin:0;background:#f3f4f6;font-family:'Segoe UI',Roboto,Arial,sans-serif">
<button class="no-print" onclick="window.print()" style="position:fixed;top:16px;right:16px;z-index:99;background:#16a34a;color:#fff;border:none;border-radius:8px;padding:10px 18px;font-size:13px;font-weight:800;cursor:pointer;box-shadow:0 4px 14px rgba(22,163,74,.4)">🖨️ Imprimir / Salvar PDF</button>
<div class="sheet" style="max-width:900px;margin:24px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,.1)">
    <div style="background:linear-gradient(120deg,#0d2818 55%,#7c2d12);padding:20px 30px;display:flex;justify-content:space-between;align-items:center;gap:14px">
        <div><h1 style="margin:0;color:#fff;font-size:20px;font-weight:900">🧹 Relatório 5S <span style="color:#fbbf24">☀️ SOL</span></h1>
        <p style="margin:3px 0 0;color:#fcd34d;font-size:10px;text-transform:uppercase;letter-spacing:1px;font-weight:700">PRIME SGI · 5S + Programa SOL · “O sol vai nascer na Mondial”</p></div>
        <div style="text-align:right;color:#cbd5e1;font-size:10px"><div style="font-size:13px;color:#fff;font-weight:900">${esc(aud.fabrica)} · ${esc(aud.setor)}${aud.maquina ? ` · ${esc(aud.maquina)}` : ''}</div><div>${esc(aud.planta)}</div><div>Emitido em ${nowStr} por ${esc(emitente)}</div></div>
    </div>
    <div style="padding:22px 30px">
        <div style="font-size:15px;font-weight:900;color:#0f172a;margin-bottom:4px">${esc(aud.titulo)}</div>
        <div style="font-size:11px;color:#64748b;margin-bottom:14px">Auditor: <b>${esc(aud.auditor) || '—'}</b>${aud.acompanhante ? ` · Acompanhante: <b>${esc(aud.acompanhante)}</b>` : ''} · Data: <b>${fmtData(aud.data_auditoria)}</b> · Status: <span style="font-weight:800;color:${aud.status === 'concluida' ? '#16a34a' : '#d97706'}">${aud.status === 'concluida' ? 'CONCLUÍDA' : 'EM ABERTO'}</span></div>

        <div class="avoid-break" style="display:flex;gap:10px;margin-bottom:6px">
            ${kpi(solar != null ? solar + '%' : '—', `${selo.emoji} Índice Solar`, selo.cor)}
            ${kpi(geral != null ? geral + '%' : '—', 'Score 5S', scCorHex(geral))}
            ${kpi(scSol.geral != null ? scSol.geral + '%' : '—', 'Score SOL', scCorHex(scSol.geral))}
            ${kpi(String(criticos.length), 'Críticos (≤2)', criticos.length ? '#dc2626' : '#16a34a')}
            ${kpi(String(planosAbertos.length), 'Ações abertas', planosAbertos.length ? '#d97706' : '#16a34a')}
        </div>

        ${(aud.analise_ia || '').trim() ? `${h2('🤖 Resumo Executivo')}
        <div class="avoid-break" style="background:#f0fdf4;border:1px solid #bbf7d0;border-left:4px solid #16a34a;border-radius:8px;padding:12px 16px;margin-bottom:6px">
            ${aud.analise_ia.trim().split(/\n{2,}/).map(p => p.trim()).filter(Boolean).map(p => `<p style="margin:0 0 8px;font-size:12.5px;line-height:1.65;color:#334155">${esc(p)}</p>`).join('')}
        </div>` : ''}

        ${h2('🧭 Leitura executiva')}
        ${insights.map(t => `<div style="font-size:12px;color:#334155;padding:5px 0;border-bottom:1px dashed #f1f5f9">${esc(t)}</div>`).join('')}

        ${h2('📡 Radar dos sensos')}
        <div class="avoid-break" style="display:flex;gap:24px;align-items:center;flex-wrap:wrap">
            <div style="flex-shrink:0">${radarSvg}</div>
            <div style="flex:1;min-width:280px">${barrasSensos}
                <div style="font-size:9.5px;color:#94a3b8;margin-top:8px">Escala: ${ESCALA_5S.map(e => `<b>${e.nota}</b> ${e.rotulo}`).join(' · ')}. Score do senso = média dos critérios × 20.</div>
            </div>
        </div>

        ${scSol.geral != null ? `
        ${h2('☀️ Programa SOL — o sol nascendo na Mondial')}
        <div class="avoid-break" style="display:flex;gap:24px;align-items:center;flex-wrap:wrap;background:linear-gradient(120deg,#fff7ed,#fff);border:1px solid #fed7aa;border-radius:10px;padding:16px">
            <div style="flex-shrink:0;text-align:center">${solSvg}<div style="font-size:13px;font-weight:900;color:${selo.cor};margin-top:6px">${selo.emoji} ${solar}% · ${selo.label}</div></div>
            <div style="flex:1;min-width:280px">${barrasSol}
                <div style="font-size:10.5px;color:#7c2d12;margin-top:8px;font-style:italic">“${selo.frase}”</div>
                <div style="font-size:9.5px;color:#94a3b8;margin-top:4px">Índice Solar = média do Score 5S com o Score SOL. SOL = Segurança · Organização · Limpeza (mesma escala 0–5).</div>
            </div>
        </div>
        ${h2('🔆 Detalhamento por pilar SOL')}
        ${solDetalheHtml}` : ''}

        ${h2('🔎 Detalhamento por senso (5S)')}
        ${detalheHtml}

        ${planos.length ? h2(`📋 Plano de Ação 5S + SOL (${planos.length - planosAbertos.length}/${planos.length} concluídas)`) + `
        <table style="width:100%;border-collapse:collapse">
            <thead><tr style="background:#f1f5f9"><th style="padding:6px 10px;font-size:10px;color:#64748b">Pilar</th><th style="padding:6px 10px;font-size:10px;text-align:left;color:#64748b">Ação</th><th style="padding:6px 10px;font-size:10px;text-align:left;color:#64748b">Responsável</th><th style="padding:6px 10px;font-size:10px;color:#64748b">Prazo</th><th style="padding:6px 10px;font-size:10px;color:#64748b">Status</th></tr></thead>
            <tbody>${planoRows}</tbody></table>` : ''}

        ${galleryHtml}

        <div style="margin-top:28px;padding-top:12px;border-top:1px solid #e2e8f0;text-align:center;color:#94a3b8;font-size:10px;font-weight:700">Documento gerado automaticamente pelo PRIME SGI — Grupo MK · ${nowStr}</div>
    </div>
</div></body></html>`;

    const nomeArquivo = `5S_${String(aud.fabrica || '').replace(/[^a-z0-9]/gi, '_')}_${String(aud.setor || '').replace(/[^a-z0-9]/gi, '_')}${aud.maquina ? '_' + String(aud.maquina).replace(/[^a-z0-9]/gi, '_') : ''}_${nowStr.replace(/\//g, '-')}.html`;
    // No tablet isto vira arquivo + folha de compartilhamento; no navegador,
    // o comportamento de sempre. Ver src/services/relatorio.js.
    entregarRelatorio(html, nomeArquivo).catch(e => {
        console.error('[relatorio]', e);
        alert('Não foi possível gerar o relatório neste aparelho.');
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  WORKSPACE DA AUDITORIA (overlay em tela cheia)
// ═══════════════════════════════════════════════════════════════════════════════
const Auditoria5S = ({ aud, onClose, onSave, saving }) => {
    const isMobile = useIsMobile();
    const [respostas, setRespostas] = useState(aud.respostas || {});
    const [observacoes, setObservacoes] = useState(aud.observacoes || {});
    const [fotos, setFotos] = useState(aud.fotos || {});
    const [planos, setPlanos] = useState(aud.planos || []);
    const [analiseIa, setAnaliseIa] = useState(aud.analise_ia || '');
    const [iaLoading, setIaLoading] = useState(false);
    const [iaEditing, setIaEditing] = useState(false);
    const [iaDraft, setIaDraft] = useState('');
    const [iaErr, setIaErr] = useState('');
    const fileRefs = useRef({});

    const countResp = (grupos) => grupos.reduce((s, x) => s + x.itens.filter(it => respostas[it.id] != null && respostas[it.id] !== '').length, 0);
    const total5S = SENSOS.reduce((s, x) => s + x.itens.length, 0);
    const totalSOL = SOL_PILARES.reduce((s, x) => s + x.itens.length, 0);
    const totalItens = total5S + totalSOL;
    const respondidos = countResp(SENSOS) + countResp(SOL_PILARES);
    const sc = scores5S(respostas);           // 5S (radar + geral)
    const scSol = scoresSOL(respostas);        // SOL (3 pilares + geral)
    const solar = indiceSolar(sc.geral, scSol.geral); // índice combinado

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

    const gerarResumo = async () => {
        setIaLoading(true); setIaErr('');
        try {
            const novo = await gerarResumoIA5S({ ...aud, respostas, observacoes, planos }, sc, scSol, solar);
            setAnaliseIa(novo); setIaEditing(false);
        } catch (e) { console.error(e); setIaErr('O Assistente PRIME não conseguiu gerar agora. Tente novamente.'); }
        finally { setIaLoading(false); }
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
                const nota = respostas[it.id];
                const critico = nota != null && nota <= 2;
                return (
                    <div key={it.id} style={{ background: 'var(--bg-surface-glass)', border: `1px solid ${critico ? '#DC262655' : 'var(--border-color-dark)'}`, borderRadius: 10, padding: '0.7rem 0.85rem', marginBottom: '0.55rem' }}>
                        <div style={{ display: 'flex', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? '0.5rem' : '0.9rem', flexDirection: isMobile ? 'column' : 'row' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-main)' }}>{it.label}</div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginTop: 2, lineHeight: 1.3 }}>{it.desc}</div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                                {[0, 1, 2, 3, 4, 5].map(n => (
                                    <button key={n} onClick={() => setNota(it.id, n)} title={`${n} · ${ESCALA_5S[n].rotulo}: ${ESCALA_5S[n].desc}`}
                                        style={{ flex: isMobile ? 1 : 'none', width: isMobile ? 'auto' : 38, height: isMobile ? 42 : 36, borderRadius: 8, border: `1.5px solid ${nota === n ? notaCor(n) : 'var(--border-color-dark)'}`, background: nota === n ? notaCor(n) : 'transparent', color: nota === n ? '#fff' : 'var(--color-text-muted)', fontSize: '0.82rem', fontWeight: 900, cursor: 'pointer', transition: 'all 0.12s' }}>{n}</button>
                                ))}
                            </div>
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
                {/* Legenda da escala */}
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1.1rem' }}>
                    {ESCALA_5S.map(e => (
                        <span key={e.nota} title={e.desc} style={{ fontSize: '0.62rem', fontWeight: 700, color: notaCor(e.nota), border: `1px solid ${notaCor(e.nota)}55`, background: `${notaCor(e.nota)}12`, borderRadius: 6, padding: '0.18rem 0.5rem', cursor: 'help' }}>{e.nota} · {e.rotulo}</span>
                    ))}
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
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-main)', fontWeight: 700, marginTop: 2 }}>“O sol vai nascer na Mondial.”</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginTop: 4, lineHeight: 1.4 }}>{solSelo(solar).frase}</div>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                            {SOL_PILARES.map(p => (
                                <span key={p.id} style={{ fontSize: '0.62rem', fontWeight: 800, color: p.cor, background: `${p.cor}18`, border: `1px solid ${p.cor}55`, borderRadius: 6, padding: '0.15rem 0.5rem' }}>{p.num} {p.nome.split(' & ')[0]} {scSol[p.id] != null ? `${scSol[p.id]}%` : '—'}</span>
                            ))}
                        </div>
                    </div>
                </div>
                {SOL_PILARES.map(pilar => renderGrupo(pilar, scSol[pilar.id]))}

                {/* ── Resumo Executivo (IA) — sai no relatório ── */}
                <div style={{ marginBottom: '1.2rem', borderRadius: 12, border: `1px solid ${ACCENT}44`, background: `linear-gradient(160deg, ${ACCENT}0d, transparent 60%)`, padding: '0.9rem 1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.7rem' }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${ACCENT}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><FaRobot color={ACCENT} size={15} /></div>
                        <div style={{ flex: 1, minWidth: 130 }}>
                            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-text-main)' }}>Resumo Executivo</div>
                            <div style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Gerado pelo Assistente PRIME · editável · sai no relatório</div>
                        </div>
                        {!iaEditing && !iaLoading && (
                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                {analiseIa && <button onClick={() => { setIaDraft(analiseIa); setIaEditing(true); }} style={{ ...btnSec, fontSize: '0.68rem', padding: '0.3rem 0.7rem' }}><FaPen size={10} /> Editar</button>}
                                <button onClick={gerarResumo} style={{ ...btnPrim, fontSize: '0.72rem', padding: '0.4rem 0.85rem' }}><FaMagic size={11} /> {analiseIa ? 'Regenerar' : 'Gerar com IA'}</button>
                            </div>
                        )}
                    </div>
                    {iaErr && <div style={{ fontSize: '0.7rem', color: '#DC2626', marginBottom: '0.5rem' }}>{iaErr}</div>}
                    {iaLoading ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem 0.3rem', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}><FaSpinner className="spin" color={ACCENT} /> O Assistente PRIME está analisando a auditoria…</div>
                    ) : iaEditing ? (
                        <div>
                            <textarea value={iaDraft} onChange={e => setIaDraft(e.target.value)} rows={6}
                                style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-app)', border: '1px solid var(--border-color-dark)', borderRadius: 8, color: 'var(--color-text-main)', fontSize: '0.82rem', lineHeight: 1.6, padding: '0.6rem 0.8rem', resize: 'vertical', fontFamily: 'inherit' }} />
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                <button onClick={() => { setAnaliseIa(iaDraft.trim()); setIaEditing(false); }} style={{ ...btnPrim, fontSize: '0.72rem', padding: '0.4rem 0.9rem', background: '#16A34A', color: '#fff' }}><FaSave size={11} /> Aplicar</button>
                                <button onClick={() => setIaEditing(false)} style={{ ...btnSec, fontSize: '0.7rem', padding: '0.4rem 0.8rem' }}><FaTimes size={11} /> Cancelar</button>
                            </div>
                        </div>
                    ) : analiseIa ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            {analiseIa.split(/\n{2,}/).map(p => p.trim()).filter(Boolean).map((p, i) => (
                                <p key={i} style={{ margin: 0, fontSize: '0.84rem', lineHeight: 1.6, color: 'var(--color-text-main)' }}>{p}</p>
                            ))}
                        </div>
                    ) : (
                        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Clique em <b>Gerar com IA</b> para um resumo do resultado (5S + SOL) — você pode editar antes de sair no relatório.</div>
                    )}
                </div>

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
                            <div key={pl.id} style={{ background: 'var(--bg-surface-glass)', border: `1px solid ${done ? '#16A34A44' : 'var(--border-color-dark)'}`, borderLeft: `4px solid ${s.cor}`, borderRadius: 10, padding: '0.65rem 0.8rem', marginBottom: '0.5rem', opacity: done ? 0.75 : 1, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'auto 2fr 1fr 0.9fr auto auto', gap: '0.5rem', alignItems: 'end' }}>
                                <div><label style={labelSty}>Pilar</label>
                                    <select style={{ ...inputSty, padding: '0.35rem 0.5rem' }} value={pl.senso} onChange={e => setPlanos(p => p.map(x => x.id === pl.id ? { ...x, senso: e.target.value } : x))}>
                                        <optgroup label="5S">{SENSOS.map(x => <option key={x.id} value={x.id}>{x.num}</option>)}</optgroup>
                                        <optgroup label="SOL">{SOL_PILARES.map(x => <option key={x.id} value={x.id}>SOL·{x.num}</option>)}</optgroup>
                                    </select></div>
                                <div><label style={labelSty}>Ação</label><input style={inputSty} value={pl.descricao} onChange={e => setPlanos(p => p.map(x => x.id === pl.id ? { ...x, descricao: e.target.value } : x))} /></div>
                                <div><label style={labelSty}>Responsável</label><input style={inputSty} value={pl.resp} onChange={e => setPlanos(p => p.map(x => x.id === pl.id ? { ...x, resp: e.target.value } : x))} /></div>
                                <div><label style={labelSty}>Prazo</label><input type="date" style={inputSty} value={pl.prazo || ''} onChange={e => setPlanos(p => p.map(x => x.id === pl.id ? { ...x, prazo: e.target.value } : x))} /></div>
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
                <button onClick={() => gerarRelatorio5S({ ...aud, respostas, observacoes, fotos, planos, score: sc.geral, scores: scoresIntegrado(respostas) }, aud.auditor || 'Sistema')}
                    style={{ ...btnSec, flex: isMobile ? 1 : 'none', justifyContent: 'center', padding: '0.62rem 1rem' }} title="Gerar relatório analítico (imprimir/PDF)">
                    <FaFilePdf size={11} color="#DC2626" /> Relatório
                </button>
                <button onClick={() => doSave(false)} disabled={saving} style={{ ...btnSec, flex: isMobile ? 1 : 'none', justifyContent: 'center', padding: '0.62rem 1.1rem' }}>Salvar rascunho</button>
                <button onClick={() => doSave(true)} disabled={saving || respondidos < totalItens} title={respondidos < totalItens ? 'Avalie todos os critérios para concluir' : ''}
                    style={{ ...btnPrim, flex: isMobile ? 1.3 : 'none', opacity: (saving || respondidos < totalItens) ? 0.55 : 1 }}>
                    {saving ? <FaSync className="spin" size={12} /> : <FaCheckCircle size={13} />} Concluir auditoria
                </button>
            </div>
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

    const showMsg = (text, type = 'success') => { setMsg({ text, type }); setTimeout(() => setMsg(null), 2800); };

    const load = useCallback(async () => {
        setLoading(true);
        const [{ data: auds }, { data: est }] = await Promise.all([
            supabase.from('cinco_s_auditoria').select('*').order('updated_at', { ascending: false }),
            supabase.from('cadastro_planta_area').select('planta, fabrica, setor, maquina'),
        ]);
        setAuditorias(auds || []);
        setEstrutura(est || []);
        setLoading(false);
    }, []);
    useEffect(() => { load(); }, [load]);

    const saveAuditoria = async (aud) => {
        setSaving(true);
        let payload = {
            titulo: aud.titulo, planta: aud.planta, fabrica: aud.fabrica, setor: aud.setor, maquina: aud.maquina ?? null,
            auditor: aud.auditor, acompanhante: aud.acompanhante, data_auditoria: aud.data_auditoria,
            status: aud.status, respostas: aud.respostas, observacoes: aud.observacoes, fotos: aud.fotos,
            planos: aud.planos, score: aud.score, scores: aud.scores, analise_ia: aud.analise_ia ?? null, criado_por: aud.criado_por || userName,
        };
        // Grava; se alguma coluna nova (analise_ia / maquina) ainda não existe no banco,
        // remove a coluna reclamada e regrava (rode os cinco_s_update*.sql p/ persistir tudo).
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
        if (!error && faltou) showMsg('Salvo (rode os cinco_s_update*.sql p/ guardar resumo/máquina)', 'success');
        if (error) { setSaving(false); showMsg('Erro: ' + error.message, 'error'); return; }
        const saved = data;
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
    const solarDe = (aud) => aud?.scores?.solar ?? aud?.score ?? null; // índice solar (fallback p/ auditorias antigas só 5S)
    // Áreas até o nível de LINHA/MÁQUINA. Onde o setor tem linhas/máquinas
    // cadastradas, cada uma vira uma área; setores sem máquinas ficam como "setor inteiro".
    const areasCadastro = [];
    const seen = new Set();
    const setorTemMaquina = new Set();
    estrutura.forEach(e => { if (e.fabrica && e.setor && e.maquina) setorTemMaquina.add(`${e.planta || ''}|${e.fabrica}|${e.setor}`); });
    estrutura.forEach(e => {
        if (!e.fabrica || !e.setor) return;
        const setorK = `${e.planta || ''}|${e.fabrica}|${e.setor}`;
        // pula a linha "setor sem máquina" quando o setor possui máquinas cadastradas
        if (!e.maquina && setorTemMaquina.has(setorK)) return;
        const k = `${setorK}|${e.maquina || ''}`;
        if (seen.has(k)) return;
        seen.add(k);
        areasCadastro.push({ planta: e.planta, fabrica: e.fabrica, setor: e.setor, maquina: e.maquina || null });
    });
    const mapa = areasCadastro.map(area => {
        const hist = concluidas.filter(a => areaKey(a) === areaKey(area))
            .sort((a, b) => new Date(b.data_auditoria || b.created_at) - new Date(a.data_auditoria || a.created_at));
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

    // ── Indicadores ──────────────────────────────────────────────────────────────
    const auditadas = mapa.filter(m => m.ult);
    const mediaGeral = auditadas.length ? Math.round(auditadas.reduce((s, m) => s + (m.ult.score || 0), 0) / auditadas.length) : null;
    const acoesAbertasTot = auditoriasFiltradas.reduce((s, a) => s + (a.planos || []).filter(p => p.status !== 'concluida').length, 0);
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
    // Mural do Sol: áreas que "viram o sol nascer" (índice solar ≥ 85), ranqueadas
    const muralSol = auditadas.filter(m => (solarDe(m.ult) ?? 0) >= 85).sort((a, b) => (solarDe(b.ult) - solarDe(a.ult)));

    // Quem mais audita — ranking por auditorias concluídas
    const porAuditor = {};
    concluidas.forEach(a => { const nome = (a.auditor || '').trim() || '—'; porAuditor[nome] = (porAuditor[nome] || 0) + 1; });
    const rankAuditores = Object.entries(porAuditor).map(([nome, qtd]) => ({ nome, qtd })).sort((a, b) => b.qtd - a.qtd);

    if (sel) return <Auditoria5S aud={sel} onClose={() => setSel(null)} onSave={saveAuditoria} saving={saving} />;

    return (
        <div style={{ padding: isMobile ? '0.8rem' : '1rem 1.25rem', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', gap: '0.7rem' }}>
            {msg && <Toast msg={msg} />}
            {/* Header */}
            <div style={{ flexShrink: 0, display: 'flex', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', gap: '0.6rem', flexDirection: isMobile ? 'column' : 'row' }}>
                <div>
                    <div style={{ fontSize: isMobile ? '1rem' : '1.1rem', fontWeight: 900, color: 'var(--color-text-main)', display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
                        <FaBroom color={ACCENT} /> Programa 5S <FaSun color={SOL_ACCENT} /> <span style={{ color: SOL_ACCENT }}>SOL</span>
                        <span title="5S (maturidade 0–5) integrado ao Programa SOL — Segurança, Organização e Limpeza. Juntos formam o Índice Solar." style={{ fontSize: '0.58rem', fontWeight: 800, letterSpacing: '1px', color: SOL_ACCENT, background: `${SOL_ACCENT}18`, padding: '0.15rem 0.55rem', borderRadius: 5, cursor: 'help', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><FaGraduationCap size={9} /> 5S + SOL</span>
                    </div>

                </div>
                <button onClick={() => setShowNova(true)} style={btnPrim}><FaPlus size={12} /> Nova Auditoria</button>
            </div>

            {/* Área rolável: hero + KPIs + abas (sticky) + conteúdo. Só o header fica fixo. */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.7rem', minHeight: 0, margin: '0 -0.25rem', padding: '0 0.25rem' }}>



            {/* KPIs */}
            <div style={{ flexShrink: 0, display: isMobile ? 'grid' : 'flex', gridTemplateColumns: isMobile ? '1fr 1fr' : undefined, gap: isMobile ? '0.5rem' : '0.8rem', flexWrap: 'wrap' }}>
                <KpiMini icon={<FaSun />} label="Índice Solar do parque" value={solarMedio != null ? `${solarMedio}%` : '—'} cor={scoreCor(solarMedio)} />
                <KpiMini icon={<FaChartPie />} label="Score 5S médio" value={mediaGeral != null ? `${mediaGeral}%` : '—'} cor={scoreCor(mediaGeral)} />
                <KpiMini icon={<FaMapMarkedAlt />} label="Áreas auditadas" value={`${auditadas.length}/${areasCadastro.length}`} cor="#3B82F6" />
                <KpiMini icon={<FaExclamationTriangle />} label="Ações abertas" value={acoesAbertasTot} cor={acoesAbertasTot ? '#D97706' : '#16A34A'} />
                <KpiMini icon={<FaCheckCircle />} label={periodo === 'tudo' ? 'Auditorias concluídas' : 'Auditorias no período'} value={concluidas.length} cor={ACCENT} />
            </div>

            {/* Tabs + filtro de período — grudam no topo ao rolar (sticky) */}
            <div style={{ position: 'sticky', top: 0, zIndex: 5, flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.3rem', borderBottom: '1px solid var(--border-color-dark)', overflowX: 'auto', background: 'var(--bg-app)', paddingTop: '0.3rem' }}>
                {[['mapa', 'Mapa das Áreas', <FaMapMarkedAlt size={11} />], ['auditorias', 'Auditorias', <FaListUl size={11} />], ['indicadores', 'Indicadores', <FaChartPie size={11} />]].map(([id, label, icon]) => (
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
                                                        {m.ult ? (<>
                                                            <span>Última: {fmtData(m.ult.data_auditoria)}</span>
                                                            {m.delta != null && <span style={{ fontWeight: 800, color: m.delta >= 0 ? '#16A34A' : '#DC2626' }}>{m.delta >= 0 ? '▲' : '▼'} {Math.abs(m.delta)} pts</span>}
                                                            {m.acoesAbertas > 0 && <span style={{ color: '#D97706', fontWeight: 700 }}>{m.acoesAbertas} ação(ões)</span>}
                                                        </>) : <span style={{ color: 'var(--color-text-subtle)', fontStyle: 'italic' }}>Nunca auditada</span>}
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
                                        {grp.itens.map(a => (
                                            <div key={a.id} className="glass-panel s5-card" onClick={() => setSel(a)} style={{ borderRadius: 11, border: '1px solid var(--border-color-dark)', padding: '0.85rem', cursor: 'pointer', position: 'relative', transition: 'transform 0.15s' }}
                                                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'} onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                                                <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4 }}>
                                                    <button className="s5-del" onClick={e => { e.stopPropagation(); gerarRelatorio5S(a, a.auditor || 'Sistema'); }} title="Relatório analítico"
                                                        style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(59,130,246,0.18)', border: 'none', color: '#3B82F6', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.15s' }}><FaFilePdf size={10} /></button>
                                                    <button className="s5-del" onClick={e => { e.stopPropagation(); setConfirmDel(a); }} style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(220,38,38,0.15)', border: 'none', color: '#DC2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.15s' }}><FaTimes size={10} /></button>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', paddingRight: 52 }}>
                                                    <span style={{ fontSize: '0.58rem', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: 5, textTransform: 'uppercase', background: a.status === 'concluida' ? '#16A34A22' : '#D9770622', color: a.status === 'concluida' ? '#16A34A' : '#D97706' }}>{a.status === 'concluida' ? 'Concluída' : 'Aberta'}</span>
                                                    <span style={{ fontSize: '0.62rem', color: 'var(--color-text-subtle)' }}>{fmtData(a.data_auditoria)}</span>
                                                    {a.maquina && <span style={{ fontSize: '0.58rem', fontWeight: 800, color: ACCENT, background: `${ACCENT}18`, borderRadius: 5, padding: '0.1rem 0.45rem' }}>{a.maquina}</span>}
                                                </div>
                                                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-text-main)', marginTop: '0.5rem', lineHeight: 1.3 }}>{a.titulo}</div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', marginTop: '0.6rem' }}>
                                                    <RingGauge value={a.score != null ? Math.round(a.score) : null} size={46} stroke={5} />
                                                    <div style={{ flex: 1, fontSize: '0.66rem', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                                        <span>Auditor: <b style={{ color: 'var(--color-text-main)' }}>{a.auditor || '—'}</b></span>
                                                        <span>{(a.planos || []).filter(p => p.status !== 'concluida').length} ação(ões) aberta(s)</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    )}
                                </div>
                            );})}
                        </div>
                    )
                )}

                {/* ── INDICADORES ── */}
                {tab === 'indicadores' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'auto 1fr', gap: '1rem', alignItems: 'start' }}>
                            <div className="glass-panel" style={{ borderRadius: 13, border: '1px solid var(--border-color-dark)', padding: '1.1rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-text-main)', marginBottom: '0.5rem' }}>Radar médio do parque</div>
                                <Radar5S scores={radarMedio} size={220} />
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', justifyContent: 'center', marginTop: '0.5rem' }}>
                                    {SENSOS.map(s => <span key={s.id} style={{ fontSize: '0.6rem', fontWeight: 700, color: s.cor }}>{s.num} {s.nome.split('·')[1]}</span>)}
                                </div>
                            </div>
                            <div className="glass-panel" style={{ borderRadius: 13, border: '1px solid var(--border-color-dark)', padding: '1.1rem' }}>
                                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-text-main)', marginBottom: '0.2rem' }}>Ranking dos setores (Índice Solar)</div>
                                <div style={{ fontSize: '0.62rem', color: 'var(--color-text-subtle)', marginBottom: '0.7rem' }}>Média das linhas/máquinas auditadas de cada setor</div>
                                {mapaSetores.filter(s => s.mediaSolar != null).length === 0 ? <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>Conclua auditorias para gerar o ranking.</div> : (
                                    [...mapaSetores].filter(s => s.mediaSolar != null).sort((a, b) => b.mediaSolar - a.mediaSolar).map((s, i) => (
                                        <div key={`${s.planta}|${s.fabrica}|${s.setor}`} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                                            <span style={{ width: 22, fontSize: '0.66rem', color: 'var(--color-text-subtle)', fontWeight: 800, textAlign: 'right' }}>{i + 1}º</span>
                                            <span style={{ width: isMobile ? 120 : 180, fontSize: '0.72rem', color: 'var(--color-text-main)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.fabrica} · {s.setor}</span>
                                            <div style={{ flex: 1, height: 14, background: 'rgba(255,255,255,0.06)', borderRadius: 7, overflow: 'hidden' }}>
                                                <div style={{ width: `${s.mediaSolar}%`, height: '100%', background: scoreCor(s.mediaSolar), borderRadius: 7, transition: 'width 0.4s' }} />
                                            </div>
                                            <span style={{ width: 40, textAlign: 'right', fontSize: '0.74rem', fontWeight: 900, color: scoreCor(s.mediaSolar) }}>{s.mediaSolar}%</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* ── Programa SOL: raios (pilares) + Mural do Sol ── */}
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.1fr 1fr', gap: '1rem', alignItems: 'stretch' }}>
                            <div className="glass-panel" style={{ borderRadius: 13, border: `1px solid ${SOL_ACCENT}44`, padding: '1.1rem', background: `linear-gradient(135deg, ${SOL_ACCENT}10, transparent 60%)` }}>
                                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: SOL_ACCENT, marginBottom: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><FaSun size={12} /> Raios do Sol — pilares SOL do parque</div>
                                {SOL_PILARES.map(p => (
                                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.7rem' }}>
                                        <span style={{ width: isMobile ? 92 : 130, fontSize: '0.72rem', fontWeight: 800, color: p.cor, whiteSpace: 'nowrap' }}>{p.num} · {p.nome}</span>
                                        <div style={{ flex: 1, height: 14, background: 'rgba(255,255,255,0.06)', borderRadius: 7, overflow: 'hidden' }}>
                                            <div style={{ width: `${radarSOL[p.id] || 0}%`, height: '100%', background: `linear-gradient(90deg, ${p.cor}, ${p.cor}cc)`, borderRadius: 7, transition: 'width 0.4s' }} />
                                        </div>
                                        <span style={{ width: 40, textAlign: 'right', fontSize: '0.74rem', fontWeight: 900, color: scoreCor(radarSOL[p.id]) }}>{radarSOL[p.id] || 0}%</span>
                                    </div>
                                ))}
                                <div style={{ fontSize: '0.64rem', color: 'var(--color-text-muted)', marginTop: '0.4rem' }}>Índice Solar médio do parque: <b style={{ color: solSelo(solarMedio).cor }}>{solarMedio != null ? `${solarMedio}%` : '—'}</b> · média do 5S com o SOL.</div>
                            </div>
                            <div className="glass-panel" style={{ borderRadius: 13, border: '1px solid var(--border-color-dark)', padding: '1.1rem' }}>
                                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-text-main)', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><FaTrophy size={12} color="#EAB308" /> Mural do Sol — o sol nasceu aqui ☀️</div>
                                {muralSol.length === 0 ? (
                                    <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>Nenhuma área em <b>sol pleno</b> (Índice Solar ≥ 85%) ainda. A primeira a chegar lá entra no mural e vira referência da Mondial!</div>
                                ) : muralSol.slice(0, 12).map((m, i) => (
                                    <div key={areaKey(m)} style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.5rem', padding: '0.35rem 0.5rem', borderRadius: 8, background: '#EAB30812' }}>
                                        <span style={{ fontSize: '1rem' }}>{i === 0 ? '🏆' : '☀️'}</span>
                                        <span style={{ flex: 1, fontSize: '0.74rem', fontWeight: 700, color: 'var(--color-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{areaLabel(m)}</span>
                                        <SolSeloPill value={solarDe(m.ult)} small />
                                    </div>
                                ))}
                                {muralSol.length > 12 && <div style={{ fontSize: '0.66rem', color: 'var(--color-text-muted)', marginTop: '0.3rem' }}>+ {muralSol.length - 12} outra(s) em sol pleno ☀️</div>}
                            </div>
                        </div>

                        {/* ── Status de cada área + Quem mais audita ── */}
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.7fr 1fr', gap: '1rem', alignItems: 'start' }}>
                            <div className="glass-panel" style={{ borderRadius: 13, border: '1px solid var(--border-color-dark)', padding: '1.1rem' }}>
                                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-text-main)', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><FaMapMarkedAlt size={12} color={ACCENT} /> Status por setor</div>
                                <div style={{ fontSize: '0.62rem', color: 'var(--color-text-subtle)', marginBottom: '0.7rem' }}>Detalhe por linha/máquina no Mapa das Áreas</div>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem', minWidth: 440 }}>
                                        <thead><tr style={{ textAlign: 'left', color: 'var(--color-text-subtle)' }}>
                                            {['Setor', 'Estágio', 'Solar', 'SOL', 'Cobertura', 'Ações', 'Última'].map((h, i) => <th key={h} style={{ padding: '0.3rem 0.5rem', fontWeight: 700, textAlign: i >= 2 && i <= 5 ? 'center' : 'left', whiteSpace: 'nowrap' }}>{h}</th>)}
                                        </tr></thead>
                                        <tbody>
                                            {mapaSetores.map(s => {
                                                const se = solSelo(s.mediaSolar);
                                                const cobPct = Math.round((s.auditadas / s.itens.length) * 100);
                                                return (
                                                    <tr key={`${s.planta}|${s.fabrica}|${s.setor}`} style={{ borderTop: '1px solid var(--border-color-dark)' }}>
                                                        <td style={{ padding: '0.4rem 0.5rem' }}>
                                                            <div style={{ fontWeight: 700, color: 'var(--color-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 170 }}>{s.fabrica} · {s.setor}</div>
                                                            <div style={{ fontSize: '0.58rem', color: 'var(--color-text-subtle)' }}>{s.planta}</div>
                                                        </td>
                                                        <td style={{ padding: '0.4rem 0.5rem' }}>
                                                            {s.mediaSolar != null ? <span style={{ color: se.cor, fontWeight: 800, whiteSpace: 'nowrap' }}>{se.emoji} {se.label}</span>
                                                                : <span style={{ color: 'var(--color-text-subtle)', fontStyle: 'italic' }}>Nunca auditada</span>}
                                                            {s.atrasada && <span title="Mais de 60 dias sem auditar" style={{ marginLeft: 5, fontSize: '0.56rem', fontWeight: 800, color: '#DC2626', background: '#DC262618', borderRadius: 5, padding: '0.05rem 0.35rem', whiteSpace: 'nowrap' }}>⏰ atrasado</span>}
                                                        </td>
                                                        <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center', fontWeight: 900, color: scoreCor(s.mediaSolar) }}>{s.mediaSolar != null ? `${s.mediaSolar}%` : '—'}</td>
                                                        <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>{s.mediaSol != null ? `${s.mediaSol}%` : '—'}</td>
                                                        <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center', color: cobPct >= 100 ? '#16A34A' : cobPct > 0 ? '#D97706' : 'var(--color-text-subtle)', fontWeight: 700, whiteSpace: 'nowrap' }}>{s.auditadas}/{s.itens.length}</td>
                                                        <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center', fontWeight: 800, color: s.acoes ? '#D97706' : 'var(--color-text-subtle)' }}>{s.acoes || '—'}</td>
                                                        <td style={{ padding: '0.4rem 0.5rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{s.ultData ? fmtData(s.ultData) : '—'}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div className="glass-panel" style={{ borderRadius: 13, border: '1px solid var(--border-color-dark)', padding: '1.1rem' }}>
                                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-text-main)', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><FaTrophy size={12} color={ACCENT} /> Quem mais audita</div>
                                {rankAuditores.length === 0 ? <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>Conclua auditorias para ver o ranking dos auditores.</div> : (() => {
                                    const maxQ = rankAuditores[0].qtd || 1;
                                    return rankAuditores.map((r, i) => (
                                        <div key={r.nome} style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.5rem' }}>
                                            <span style={{ width: 20, fontSize: '0.9rem', textAlign: 'center' }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span style={{ fontSize: '0.66rem', color: 'var(--color-text-subtle)', fontWeight: 800 }}>{i + 1}º</span>}</span>
                                            <span style={{ flex: 1, minWidth: 0 }}>
                                                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--color-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{r.nome}</span>
                                                <span style={{ display: 'block', height: 6, borderRadius: 3, marginTop: 2, background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT}77)`, width: `${Math.max(12, (r.qtd / maxQ) * 100)}%` }} />
                                            </span>
                                            <span style={{ fontSize: '0.74rem', fontWeight: 900, color: ACCENT, whiteSpace: 'nowrap' }}>{r.qtd}</span>
                                        </div>
                                    ));
                                })()}
                                <div style={{ fontSize: '0.62rem', color: 'var(--color-text-subtle)', marginTop: '0.5rem' }}>Total: {concluidas.length} auditoria(s) concluída(s) · {rankAuditores.length} auditor(es).</div>
                            </div>
                        </div>

                        {/* Evolução mensal */}
                        <div className="glass-panel" style={{ borderRadius: 13, border: '1px solid var(--border-color-dark)', padding: '1.1rem' }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-text-main)', marginBottom: '0.8rem' }}>Evolução do score médio (mensal)</div>
                            <Evolucao5S auditorias={concluidas} />
                        </div>
                    </div>
                )}
            </div>
            </div>{/* fim da área rolável */}

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
    const maquinas = [...new Set(estrutura.filter(e => e.planta === planta && e.fabrica === fabrica && e.setor === setor).map(e => e.maquina))]
        .filter(Boolean).sort((a, b) => { const na = parseInt(String(a).match(/\d+/)?.[0] || 0, 10), nb = parseInt(String(b).match(/\d+/)?.[0] || 0, 10); return na - nb || String(a).localeCompare(String(b)); });
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
            {maquinas.length > 0 && !maquina && <div style={{ fontSize: '0.66rem', color: 'var(--color-text-muted)', marginTop: '0.6rem' }}>Deixe em <b>Setor inteiro</b> para auditar o setor como um todo, ou escolha uma linha/máquina específica.</div>}
        </ModalShell>
    );
};
