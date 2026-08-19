import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';
import { getUsuario } from '../services/usuario';
import { compressImage } from '../services/imageCompressor';
import { gerarResumoExecutivo } from '../services/ia';
import { entregarRelatorio } from '../services/relatorio';
import {
    SENSOS, ESCALA_5S, scores5S, SOL_PILARES, scoresSOL, scoresIntegrado, indiceSolar, solSelo,
    PONTOS_NOTA, demonstrativoNota,
    FAIXA_EXCELENCIA, FAIXA_CONSOLIDA, FAIXA_ATENCAO,
} from '../data/cincoS';
import {
    FaPlus, FaTrash, FaSync, FaCheck, FaTimes, FaChevronLeft, FaBroom,
    FaChartPie, FaListUl, FaMapMarkedAlt, FaCamera, FaArrowLeft, FaCheckCircle,
    FaIndustry, FaExclamationTriangle, FaBolt, FaGraduationCap, FaClipboardCheck, FaFilePdf,
    FaSun, FaShieldAlt, FaHardHat, FaTrophy, FaMagic, FaRobot, FaSave, FaPen, FaSpinner, FaCalendarAlt, FaInfoCircle,
    FaSearch, FaFilter, FaLayerGroup, FaArrowUp, FaArrowDown, FaEye, FaBuilding,
} from 'react-icons/fa';

const ACCENT = '#22C55E';
const SOL_ACCENT = '#F59E0B';
// Lookup unificado de dimensões (5S + SOL) para plano de ação e relatório
const DIM_BY_ID = Object.fromEntries([...SENSOS, ...SOL_PILARES].map(d => [d.id, d]));

// O resumo por IA passa por uma Edge Function do Supabase. A chave do Gemini é
// cobrada por uso e ficava aqui, legível para quem abrisse o código-fonte da
// página ou descompactasse o APK — que é um zip. Ver src/services/ia.js.
const gerarResumoIA5S = (aud, sc, scSol, solar) => gerarResumoExecutivo(aud, sc, scSol, solar);

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
// Monta o relatório e devolve { html, nomeArquivo } — quem exibe é o RelatorioViewer.
function montarRelatorio5S(aud, emitente) {
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
    const scCorHex = (s) => s == null ? '#94a3b8' : s >= FAIXA_EXCELENCIA ? '#16a34a' : s >= FAIXA_CONSOLIDA ? '#d97706' : '#dc2626';
    const notaHex = (n) => n == null ? '#94a3b8' : n <= 1 ? '#dc2626' : n === 2 ? '#ea580c' : n === 3 ? '#d97706' : n === 4 ? '#84cc16' : '#16a34a';

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
            if (it.emAvaliacao || it.desabilitado) {
                return `<tr>
                    <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-weight:700;font-size:11px">${esc(it.label)} <span style="display:inline-block;margin-left:6px;font-size:9px;color:#64748b;background:#f1f5f9;border:1px solid #e2e8f0;padding:1px 6px;border-radius:4px">Em avaliação</span><div style="font-size:9.5px;color:#94a3b8;font-weight:400;margin-top:1px">${esc(it.desc)}</div></td>
                    <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;text-align:center;vertical-align:top;width:70px">
                        <span style="display:inline-flex;padding:3px 7px;border-radius:6px;background:#f1f5f9;color:#64748b;font-size:10px;font-weight:800">Em avaliação</span>
                        <div style="font-size:8.5px;color:#94a3b8;margin-top:2px">não pontuável</div></td></tr>`;
            }
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
        // A faixa colorida é um thead (não um div acima da tabela) para se repetir
        // no topo de cada página quando o senso não cabe inteiro em uma folha.
        return `<div class="bloco" style="margin-bottom:14px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
            <table style="width:100%;border-collapse:collapse">
                <thead><tr><th colspan="2" style="background:${s.cor};padding:7px 12px;text-align:left">
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
            <text x="${W / 2}" y="${H - 8}" text-anchor="middle" font-size="12" font-weight="900" fill="#fde68a" opacity="0.85" letter-spacing="1">5S + SOL</text></svg>`;
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
        <div><h1 style="margin:0;color:#fff;font-size:20px;font-weight:900">🧹 Relatório 5S <span style="color:#fbbf24">☀️ SOL</span></h1>
        <p style="margin:3px 0 0;color:#fcd34d;font-size:10px;text-transform:uppercase;letter-spacing:1px;font-weight:700">5S + Programa SOL · Segurança · Organização · Limpeza</p></div>
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

        ${h2('📡 Radar dos sensos')}
        <div class="avoid-break" style="display:flex;gap:24px;align-items:center;flex-wrap:wrap">
            <div style="flex-shrink:0">${radarSvg}</div>
            <div style="flex:1;min-width:280px">${barrasSensos}
                <div style="font-size:9.5px;color:#94a3b8;margin-top:8px">Escala: ${ESCALA_5S.map(e => `<b>${e.nota}</b> ${e.rotulo} (${PONTOS_NOTA[e.nota]}%)`).join(' · ')}. A escala não é linear — só a nota 5 vale 100% do critério. Score do senso = média dos critérios.</div>
            </div>
        </div>

        ${scSol.geral != null ? `
        ${h2('☀️ Programa SOL — Segurança · Organização · Limpeza')}
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
        <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0">
            <thead><tr style="background:#f1f5f9"><th style="padding:6px 10px;font-size:10px;color:#64748b">Pilar</th><th style="padding:6px 10px;font-size:10px;text-align:left;color:#64748b">Ação</th><th style="padding:6px 10px;font-size:10px;text-align:left;color:#64748b">Responsável</th><th style="padding:6px 10px;font-size:10px;color:#64748b">Prazo</th><th style="padding:6px 10px;font-size:10px;color:#64748b">Status</th></tr></thead>
            <tbody>${planoRows}</tbody></table>` : ''}

        ${galleryHtml}

        <div style="margin-top:28px;padding-top:12px;border-top:1px solid #e2e8f0;text-align:center;color:#94a3b8;font-size:10px;font-weight:700">Documento gerado automaticamente · ${nowStr}</div>
    </div>
</div></body></html>`;

    const nomeArquivo = `5S_${String(aud.fabrica || '').replace(/[^a-z0-9]/gi, '_')}_${String(aud.setor || '').replace(/[^a-z0-9]/gi, '_')}${aud.maquina ? '_' + String(aud.maquina).replace(/[^a-z0-9]/gi, '_') : ''}_${nowStr.replace(/\//g, '-')}.html`;
    return { html, nomeArquivo };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  DEMONSTRATIVO DA NOTA — a conta aberta, do critério ao Índice Solar
// ═══════════════════════════════════════════════════════════════════════════════
/*
 * Com a curva progressiva (nota 3 = 45%, 4 = 72%) o número final deixou de ser
 * uma conta que a área faz de cabeça. Esta tabela mostra cada etapa: quanto cada
 * nota virou de ponto, a média de cada senso e como 5S e SOL se combinam. Fica
 * no formulário para o auditor ter a resposta pronta quando perguntarem
 * "de onde saiu esse número?".
 */
const DemonstrativoNota = ({ respostas, isMobile }) => {
    const d = demonstrativoNota(respostas);
    const selo = solSelo(d.solar);

    const th = { fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.3px', textTransform: 'uppercase', color: 'var(--color-text-subtle)', padding: '0.4rem 0.5rem', textAlign: 'right', whiteSpace: 'nowrap' };
    const td = { fontSize: '0.72rem', color: 'var(--color-text-main)', padding: '0.35rem 0.5rem', textAlign: 'right', borderTop: '1px solid var(--border-color-dark)', whiteSpace: 'nowrap' };
    const tdL = { ...td, textAlign: 'left', whiteSpace: 'normal' };

    const bloco = (grupos, titulo, corTitulo, media, formula) => (
        <div style={{ marginBottom: '0.9rem' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 900, letterSpacing: '0.5px', textTransform: 'uppercase', color: corTitulo, marginBottom: '0.35rem' }}>{titulo}</div>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: isMobile ? 380 : 0 }}>
                    <thead>
                        <tr>
                            <th style={{ ...th, textAlign: 'left', width: '100%' }}>Critério</th>
                            <th style={th}>Nota</th>
                            <th style={th}>Vale</th>
                        </tr>
                    </thead>
                    <tbody>
                        {grupos.map(g => (
                            <React.Fragment key={g.id}>
                                <tr>
                                    <td colSpan={3} style={{ ...td, textAlign: 'left', background: `${g.cor}18`, borderLeft: `3px solid ${g.cor}`, fontWeight: 900, fontSize: '0.7rem', color: g.cor }}>
                                        {g.num} · {g.nome}
                                        <span style={{ float: 'right', color: scoreCor(g.score) }}>{g.score != null ? `${g.score}%` : '—'}</span>
                                    </td>
                                </tr>
                                {g.itens.map(i => (
                                    <tr key={i.id} style={{ opacity: i.fora ? 0.5 : 1 }}>
                                        <td style={tdL}>{i.label}</td>
                                        <td style={{ ...td, fontWeight: 800, color: i.fora ? 'var(--color-text-subtle)' : notaCor(i.nota) }}>{i.fora ? '—' : (i.nota ?? '—')}</td>
                                        <td style={{ ...td, fontWeight: 800 }}>{i.fora ? 'não pontua' : (i.pontos != null ? `${i.pontos}%` : '—')}</td>
                                    </tr>
                                ))}
                                <tr>
                                    <td colSpan={3} style={{ ...td, textAlign: 'right', fontSize: '0.64rem', color: 'var(--color-text-muted)', borderTop: 'none', paddingTop: 0, paddingBottom: '0.5rem' }}>
                                        {g.respondidos ? `${g.soma}% ÷ ${g.respondidos} critério(s) = ` : 'sem critério avaliado — '}
                                        <b style={{ color: scoreCor(g.score) }}>{g.score != null ? `${g.score}%` : '—'}</b>
                                    </td>
                                </tr>
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--color-text-main)', textAlign: 'right', marginTop: '0.3rem' }}>
                {formula} = <span style={{ color: scoreCor(media), fontWeight: 900 }}>{media != null ? `${media}%` : '—'}</span>
            </div>
        </div>
    );

    const linhaFinal = (rotulo, valor, cor, obs) => (
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.6rem', padding: '0.3rem 0' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{rotulo}{obs && <span style={{ fontSize: '0.62rem', color: 'var(--color-text-subtle)' }}> · {obs}</span>}</span>
            <span style={{ fontSize: '0.82rem', fontWeight: 900, color: cor, whiteSpace: 'nowrap' }}>{valor}</span>
        </div>
    );

    return (
        <div style={{ marginBottom: '1rem', borderRadius: 12, border: '1px solid var(--border-color-dark)', background: 'var(--bg-surface-glass)', padding: '0.9rem 1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.15rem' }}>
                <FaListUl size={11} color="#60A5FA" />
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-text-main)' }}>Demonstrativo da nota final</span>
                <span style={{ fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.5px', color: '#60A5FA', background: '#3B82F61f', border: '1px solid #3B82F655', borderRadius: 5, padding: '0.1rem 0.4rem' }}>USO INTERNO · NÃO SAI NO RELATÓRIO</span>
            </div>
            <div style={{ fontSize: '0.66rem', color: 'var(--color-text-muted)', marginBottom: '0.8rem', lineHeight: 1.5 }}>
                A escala não é linear: <b>0</b>→{PONTOS_NOTA[0]}% · <b>1</b>→{PONTOS_NOTA[1]}% · <b>2</b>→{PONTOS_NOTA[2]}% · <b>3</b>→{PONTOS_NOTA[3]}% · <b>4</b>→{PONTOS_NOTA[4]}% · <b>5</b>→{PONTOS_NOTA[5]}%. Cada senso/pilar é a média dos seus critérios; critérios ainda não avaliados ficam fora da conta.
            </div>

            {bloco(d.grupos5S, 'Programa 5S', ACCENT, d.geral5S, 'Score 5S = média dos 5 sensos')}
            {bloco(d.gruposSOL, 'Programa SOL', SOL_ACCENT, d.geralSOL, 'Score SOL = média dos 3 pilares')}

            <div style={{ borderTop: `2px solid ${SOL_ACCENT}55`, marginTop: '0.6rem', paddingTop: '0.5rem' }}>
                {linhaFinal('Score 5S', d.geral5S != null ? `${d.geral5S}%` : '—', scoreCor(d.geral5S))}
                {linhaFinal('Score SOL', d.geralSOL != null ? `${d.geralSOL}%` : '—', scoreCor(d.geralSOL))}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color-dark)' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 900, color: 'var(--color-text-main)' }}>Nota final <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--color-text-subtle)' }}>(média do 5S com o SOL)</span></span>
                    <span style={{ fontSize: '1.15rem', fontWeight: 900, color: selo.cor, whiteSpace: 'nowrap' }}>{selo.emoji} {d.solar != null ? `${d.solar}%` : '—'}</span>
                </div>
                <div style={{ fontSize: '0.64rem', color: 'var(--color-text-muted)', textAlign: 'right' }}>{selo.label} · faixas: 🌑 &lt;{FAIXA_ATENCAO}% · 🌅 {FAIXA_ATENCAO}–{FAIXA_CONSOLIDA - 1}% · 🌤️ {FAIXA_CONSOLIDA}–{FAIXA_EXCELENCIA - 1}% · ☀️ ≥{FAIXA_EXCELENCIA}%</div>
            </div>
        </div>
    );
};

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
        } catch (e) { console.error(e); setIaErr('O Assistente IA não conseguiu gerar agora. Tente novamente.'); }
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

                {/* ── Resumo Executivo (IA) — sai no relatório ── */}
                <div style={{ marginBottom: '1.2rem', borderRadius: 12, border: `1px solid ${ACCENT}44`, background: `linear-gradient(160deg, ${ACCENT}0d, transparent 60%)`, padding: '0.9rem 1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.7rem' }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${ACCENT}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><FaRobot color={ACCENT} size={15} /></div>
                        <div style={{ flex: 1, minWidth: 130 }}>
                            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-text-main)' }}>Resumo Executivo</div>
                            <div style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Gerado por IA · editável · sai no relatório</div>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem 0.3rem', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}><FaSpinner className="spin" color={ACCENT} /> O Assistente IA está analisando a auditoria…</div>
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

                {/* Demonstrativo da nota — abre a conta inteira até o Índice Solar */}
                <DemonstrativoNota respostas={respostas} isMobile={isMobile} />
            </div>

            {/* Rodapé */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: isMobile ? '0.7rem 0.8rem' : '0.85rem 1.2rem', borderTop: '1px solid var(--border-color-dark)', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', gap: '0.7rem', flexWrap: 'wrap' }}>
                <div style={{ flex: isMobile ? '1 1 100%' : 1, fontSize: '0.7rem', color: 'var(--color-text-muted)', order: isMobile ? -1 : 0, display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    {respondidos === totalItens ? <span style={{ color: '#16A34A', fontWeight: 700 }}>✓ Tudo avaliado · 5S {sc.geral}% · SOL {scSol.geral}%</span> : <span>Faltam {totalItens - respondidos} critérios</span>}
                    <SolSeloPill value={solar} />
                </div>
                <button onClick={() => abrirRelatorio(montarRelatorio5S({ ...aud, respostas, observacoes, fotos, planos, score: sc.geral, scores: scoresIntegrado(respostas) }, aud.auditor || 'Sistema'))}
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
    const [fabricaInd, setFabricaInd] = useState('todas'); // filtro de fábrica em Indicadores
    const [statusInd, setStatusInd] = useState('todas'); // todas | auditadas | excelencia | atencao | sem_auditoria
    const [buscaInd, setBuscaInd] = useState('');
    const [ordemInd, setOrdemInd] = useState('pior'); // pior | melhor | recente | nome
    const [relViewer, abrirRelatorio] = useRelatorioViewer();
    const [buscaSetorRank, setBuscaSetorRank] = useState('');

    const showMsg = (text, type = 'success') => { setMsg({ text, type }); setTimeout(() => setMsg(null), 2800); };

    const load = useCallback(async () => {
        setLoading(true);
        const [{ data: auds }, { data: est }] = await Promise.all([
            supabase.from('cinco_s_auditoria').select('*').order('updated_at', { ascending: false }),
            supabase.from('cadastro_planta_area').select('planta, fabrica, setor, maquina'),
        ]);
        
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
    // Mural do Sol: áreas que "viram o sol nascer" (índice solar ≥ FAIXA_EXCELENCIA), ranqueadas
    const muralSol = auditadas.filter(m => (solarDe(m.ult) ?? 0) >= FAIXA_EXCELENCIA).sort((a, b) => (solarDe(b.ult) - solarDe(a.ult)));

    // ── Diagnóstico estruturado por Fábrica (Fábrica 1, 2, 3...) em Indicadores ──
    const fabricasLista = (() => {
        const set = new Set();
        areasCadastro.forEach(a => { if (a.fabrica) set.add(a.fabrica.trim()); });
        auditorias.forEach(a => { if (a.fabrica) set.add(a.fabrica.trim()); });
        if (set.size === 0) {
            ['FÁBRICA 1', 'FÁBRICA 2', 'FÁBRICA 3'].forEach(f => set.add(f));
        }
        return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    })();

    const metricasFabricaSel = (() => {
        const base = mapa.filter(m => fabricaInd === 'todas' || norm(m.fabrica) === norm(fabricaInd));
        const auditadasF = base.filter(m => m.ult);
        const solarM = auditadasF.length ? Math.round(auditadasF.reduce((s, m) => s + (solarDe(m.ult) || 0), 0) / auditadasF.length) : null;
        const s5M = auditadasF.length ? Math.round(auditadasF.reduce((s, m) => s + (m.ult.score || 0), 0) / auditadasF.length) : null;
        const solM = auditadasF.length ? Math.round(auditadasF.reduce((s, m) => s + (m.ult.scores?.sol_geral || 0), 0) / auditadasF.length) : null;
        const acoes = base.reduce((s, m) => s + (m.acoesAbertas || 0), 0);
        const cob = Math.round((auditadasF.length / (base.length || 1)) * 100);
        return {
            total: base.length,
            auditadas: auditadasF.length,
            solarM,
            s5M,
            solM,
            acoes,
            cob,
        };
    })();

    const areasFabricaFiltradas = (() => {
        return mapa.filter(m => {
            if (fabricaInd !== 'todas' && norm(m.fabrica) !== norm(fabricaInd)) return false;
            
            if (buscaInd.trim()) {
                const q = norm(buscaInd);
                const str = `${norm(m.fabrica)} ${norm(m.setor)} ${norm(m.maquina)}`;
                if (!str.includes(q)) return false;
            }

            const score = m.ult ? solarDe(m.ult) : null;
            if (statusInd === 'auditadas' && !m.ult) return false;
            if (statusInd === 'excelencia' && (score == null || score < FAIXA_EXCELENCIA)) return false;
            if (statusInd === 'atencao' && (score == null || score >= FAIXA_CONSOLIDA)) return false;
            if (statusInd === 'sem_auditoria' && m.ult) return false;

            return true;
        }).sort((a, b) => {
            const scA = a.ult ? solarDe(a.ult) : -1;
            const scB = b.ult ? solarDe(b.ult) : -1;
            if (ordemInd === 'pior') return scA - scB;
            if (ordemInd === 'melhor') return scB - scA;
            if (ordemInd === 'nome') return `${a.fabrica} ${a.setor} ${a.maquina || ''}`.localeCompare(`${b.fabrica} ${b.setor} ${b.maquina || ''}`);
            if (ordemInd === 'recente') {
                const da = new Date(a.ult?.data_auditoria || a.ult?.created_at || 0).getTime();
                const db = new Date(b.ult?.data_auditoria || b.ult?.created_at || 0).getTime();
                return db - da;
            }
            return 0;
        });
    })();

    // Quem mais audita — ranking por auditorias concluídas
    const porAuditor = {};
    concluidas.forEach(a => { const nome = (a.auditor || '').trim() || '—'; porAuditor[nome] = (porAuditor[nome] || 0) + 1; });
    const rankAuditores = Object.entries(porAuditor).map(([nome, qtd]) => ({ nome, qtd })).sort((a, b) => b.qtd - a.qtd);

    const gerarRelatorioGeral = () => {
        const nowStr = new Date().toLocaleDateString('pt-BR');
        const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const scCorHex = (s) => s == null ? '#94a3b8' : s >= FAIXA_EXCELENCIA ? '#16a34a' : s >= FAIXA_CONSOLIDA ? '#d97706' : '#dc2626';

        const rankingHtml = [...mapaSetores].filter(s => s.mediaSolar != null).sort((a, b) => b.mediaSolar - a.mediaSolar).map((s, i) => `
            <tr>
                <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-weight:700;font-size:11px">${i + 1}º</td>
                <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:11px">${esc(s.fabrica)} · ${esc(s.setor)}</td>
                <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-weight:900;color:${scCorHex(s.mediaSolar)};text-align:right">${s.mediaSolar}%</td>
            </tr>
        `).join('');

        const muralHtml = muralSol.map((m, i) => `
            <div style="display:inline-block;margin:4px;padding:6px 10px;border-radius:6px;background:#fffbeb;border:1px solid #fde68a;font-size:11px;font-weight:700;color:#92400e">
                ${i === 0 ? '🏆' : '☀️'} ${esc(areaLabel(m))} (${solarDe(m.ult)}%)
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
                <h1 style="margin:0;font-size:20px;font-weight:900">📊 Relatório Geral 5S <span style="color:#fbbf24">☀️ SOL</span></h1>
                <p style="margin:3px 0 0;color:#fcd34d;font-size:10px;text-transform:uppercase;">Visão Global do Parque · Emitido em ${nowStr}</p>
            </div>
            <div style="padding:22px 30px">
                <div style="display:flex;gap:10px;margin-bottom:20px">
                    <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;text-align:center">
                        <div style="font-size:24px;font-weight:900;color:${scCorHex(solarMedio)}">${solarMedio != null ? solarMedio + '%' : '—'}</div>
                        <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700">Índice Solar Médio</div>
                    </div>
                    <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;text-align:center">
                        <div style="font-size:24px;font-weight:900;color:${scCorHex(mediaGeral)}">${mediaGeral != null ? mediaGeral + '%' : '—'}</div>
                        <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700">Score 5S Médio</div>
                    </div>
                    <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;text-align:center">
                        <div style="font-size:24px;font-weight:900;color:#3B82F6">${auditadas.length}/${areasCadastro.length}</div>
                        <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700">Áreas Auditadas</div>
                    </div>
                    <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;text-align:center">
                        <div style="font-size:24px;font-weight:900;color:${acoesAbertasTot ? '#d97706' : '#16a34a'}">${acoesAbertasTot}</div>
                        <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700">Ações Abertas</div>
                    </div>
                </div>

                <h2 style="font-size:14px;color:#0f172a;border-bottom:2px solid #22c55e;padding-bottom:5px;margin-bottom:10px">🏆 Mural do Sol (Áreas ≥ ${FAIXA_EXCELENCIA}%)</h2>
                <div style="margin-bottom:20px">${muralHtml || '<span style="font-size:12px;color:#64748b">Nenhuma área no Mural do Sol ainda.</span>'}</div>

                <h2 style="font-size:14px;color:#0f172a;border-bottom:2px solid #22c55e;padding-bottom:5px;margin-bottom:10px">📈 Ranking dos Setores</h2>
                <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
                    <tr style="background:#f1f5f9">
                        <th style="padding:6px 10px;font-size:10px;color:#64748b;text-align:left">Posição</th>
                        <th style="padding:6px 10px;font-size:10px;color:#64748b;text-align:left">Setor</th>
                        <th style="padding:6px 10px;font-size:10px;color:#64748b;text-align:right">Índice Solar</th>
                    </tr>
                    ${rankingHtml || '<tr><td colspan="3" style="padding:10px;text-align:center;font-size:12px;color:#64748b">Nenhum setor avaliado</td></tr>'}
                </table>
                <div style="margin-top:28px;padding-top:12px;border-top:1px solid #e2e8f0;text-align:center;color:#94a3b8;font-size:10px;font-weight:700">Documento gerado automaticamente · ${nowStr}</div>
            </div>
        </div></body></html>`;

        abrirRelatorio({ html, nomeArquivo: `Relatorio_Geral_5S_${nowStr.replace(/\//g, '-')}.html` });
    };

    if (sel) return <Auditoria5S aud={sel} onClose={() => setSel(null)} onSave={saveAuditoria} saving={saving} />;

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
                                                        {m.ult ? (() => {
                                                            const diasAtraso = Math.round((Date.now() - new Date(String(m.ult.data_auditoria).slice(0, 10) + 'T12:00:00')) / 86400000);
                                                            const atrasada = diasAtraso > 30;
                                                            return <>
                                                                <span>Última: {fmtData(m.ult.data_auditoria)}</span>
                                                                {atrasada && <span style={{ color: '#DC2626', fontWeight: 800 }}>⚠️ +30 dias</span>}
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
                                                    <button className="s5-del" onClick={e => { e.stopPropagation(); abrirRelatorio(montarRelatorio5S(a, a.auditor || 'Sistema')); }} title="Relatório analítico"
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>

                        {/* ══════════════════════════════════════════════════════════════════════════════════
                            1. SEÇÃO DE DIAGNÓSTICO POR FÁBRICA (FÁBRICA 1, 2, 3 E TODAS) COM FILTROS
                        ══════════════════════════════════════════════════════════════════════════════════ */}
                        <div className="glass-panel" style={{ borderRadius: 16, border: '1px solid var(--border-color-dark)', padding: '1.2rem', background: 'linear-gradient(145deg, rgba(34,197,94,0.04), transparent 50%), var(--bg-surface-glass)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.8rem', marginBottom: '1rem' }}>
                                <div>
                                    <div style={{ fontSize: '0.98rem', fontWeight: 900, color: 'var(--color-text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <FaIndustry color={ACCENT} size={15} /> Diagnóstico por Fábrica & Áreas
                                    </div>
                                    <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                                        Visão aprofundada de desempenho, cobertura e planos de ação por planta fabril
                                    </div>
                                </div>
                                
                                {/* Seletor de Fábrica */}
                                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                                    <button
                                        type="button"
                                        onClick={() => setFabricaInd('todas')}
                                        style={{
                                            padding: '0.4rem 0.85rem',
                                            borderRadius: 9,
                                            border: `1.5px solid ${fabricaInd === 'todas' ? ACCENT : 'var(--border-color-dark)'}`,
                                            background: fabricaInd === 'todas' ? `${ACCENT}22` : 'transparent',
                                            color: fabricaInd === 'todas' ? ACCENT : 'var(--color-text-muted)',
                                            fontSize: '0.74rem',
                                            fontWeight: 800,
                                            cursor: 'pointer',
                                            transition: 'all 0.15s'
                                        }}
                                    >
                                        🌐 Todas as Fábricas ({mapa.length})
                                    </button>
                                    {fabricasLista.map(f => {
                                        const countF = mapa.filter(m => norm(m.fabrica) === norm(f)).length;
                                        const isSel = norm(fabricaInd) === norm(f);
                                        return (
                                            <button
                                                key={f}
                                                type="button"
                                                onClick={() => setFabricaInd(f)}
                                                style={{
                                                    padding: '0.4rem 0.85rem',
                                                    borderRadius: 9,
                                                    border: `1.5px solid ${isSel ? ACCENT : 'var(--border-color-dark)'}`,
                                                    background: isSel ? `${ACCENT}22` : 'transparent',
                                                    color: isSel ? ACCENT : 'var(--color-text-muted)',
                                                    fontSize: '0.74rem',
                                                    fontWeight: 800,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.15s'
                                                }}
                                            >
                                                🏭 {f} ({countF})
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Resumo Executivo da Fábrica Selecionada */}
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.7rem', marginBottom: '1.1rem' }}>
                                <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color-dark)', borderRadius: 12, padding: '0.75rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{ width: 38, height: 38, borderRadius: 10, background: `${solSelo(metricasFabricaSel.solarM).cor}22`, color: solSelo(metricasFabricaSel.solarM).cor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.2rem' }}>
                                        {solSelo(metricasFabricaSel.solarM).emoji}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '1.15rem', fontWeight: 900, color: scoreCor(metricasFabricaSel.solarM), lineHeight: 1 }}>{metricasFabricaSel.solarM != null ? `${metricasFabricaSel.solarM}%` : '—'}</div>
                                        <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', marginTop: 3 }}>Índice Solar Fábrica</div>
                                    </div>
                                </div>

                                <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color-dark)', borderRadius: 12, padding: '0.75rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{ width: 38, height: 38, borderRadius: 10, background: `${ACCENT}22`, color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <FaBroom size={16} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '1.15rem', fontWeight: 900, color: scoreCor(metricasFabricaSel.s5M), lineHeight: 1 }}>{metricasFabricaSel.s5M != null ? `${metricasFabricaSel.s5M}%` : '—'}</div>
                                        <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', marginTop: 3 }}>Score 5S Médio</div>
                                    </div>
                                </div>

                                <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color-dark)', borderRadius: 12, padding: '0.75rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{ width: 38, height: 38, borderRadius: 10, background: `${SOL_ACCENT}22`, color: SOL_ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <FaSun size={16} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '1.15rem', fontWeight: 900, color: scoreCor(metricasFabricaSel.solM), lineHeight: 1 }}>{metricasFabricaSel.solM != null ? `${metricasFabricaSel.solM}%` : '—'}</div>
                                        <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', marginTop: 3 }}>Score SOL Médio</div>
                                    </div>
                                </div>

                                <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color-dark)', borderRadius: 12, padding: '0.75rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{ width: 38, height: 38, borderRadius: 10, background: '#3B82F622', color: '#60A5FA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <FaMapMarkedAlt size={16} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#60A5FA', lineHeight: 1 }}>{metricasFabricaSel.auditadas}/{metricasFabricaSel.total}</div>
                                        <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', marginTop: 3 }}>Cobertura ({metricasFabricaSel.cob}%)</div>
                                    </div>
                                </div>

                                <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color-dark)', borderRadius: 12, padding: '0.75rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{ width: 38, height: 38, borderRadius: 10, background: metricasFabricaSel.acoes > 0 ? '#D9770622' : '#16A34A22', color: metricasFabricaSel.acoes > 0 ? '#D97706' : '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <FaBolt size={16} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '1.15rem', fontWeight: 900, color: metricasFabricaSel.acoes > 0 ? '#D97706' : '#16A34A', lineHeight: 1 }}>{metricasFabricaSel.acoes}</div>
                                        <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', marginTop: 3 }}>Ações Pendentes</div>
                                    </div>
                                </div>
                            </div>

                            {/* Barra de Filtros e Busca de Áreas */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', flexWrap: 'wrap', background: 'rgba(0,0,0,0.2)', padding: '0.65rem 0.85rem', borderRadius: 12, border: '1px solid var(--border-color-dark)', marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: isMobile ? '1 1 100%' : '1', minWidth: isMobile ? '100%' : 220 }}>
                                    <FaSearch size={12} color="var(--color-text-muted)" />
                                    <input
                                        type="text"
                                        placeholder="Buscar setor, linha ou máquina…"
                                        value={buscaInd}
                                        onChange={e => setBuscaInd(e.target.value)}
                                        style={{ ...inputSty, padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
                                    />
                                    {buscaInd && (
                                        <button onClick={() => setBuscaInd('')} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                                            <FaTimes size={11} />
                                        </button>
                                    )}
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '0.64rem', fontWeight: 700, color: 'var(--color-text-subtle)', textTransform: 'uppercase' }}>Status:</span>
                                    {[
                                        ['todas', 'Todas'],
                                        ['auditadas', 'Auditadas'],
                                        ['excelencia', 'Sol Pleno ☀️'],
                                        ['atencao', 'Atenção ⚠️'],
                                        ['sem_auditoria', 'Sem Auditoria 🌑']
                                    ].map(([k, lbl]) => (
                                        <button
                                            key={k}
                                            type="button"
                                            onClick={() => setStatusInd(k)}
                                            style={{
                                                fontSize: '0.65rem',
                                                fontWeight: 800,
                                                padding: '0.22rem 0.55rem',
                                                borderRadius: 6,
                                                border: `1px solid ${statusInd === k ? ACCENT : 'var(--border-color-dark)'}`,
                                                background: statusInd === k ? `${ACCENT}22` : 'transparent',
                                                color: statusInd === k ? ACCENT : 'var(--color-text-muted)',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {lbl}
                                        </button>
                                    ))}
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <span style={{ fontSize: '0.64rem', fontWeight: 700, color: 'var(--color-text-subtle)', textTransform: 'uppercase' }}>Ordem:</span>
                                    <select
                                        value={ordemInd}
                                        onChange={e => setOrdemInd(e.target.value)}
                                        style={{ ...inputSty, width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.72rem', fontWeight: 700 }}
                                    >
                                        <option value="pior">Pior Score Primeiro</option>
                                        <option value="melhor">Melhor Score Primeiro</option>
                                        <option value="recente">Mais Recente</option>
                                        <option value="nome">Nome A-Z</option>
                                    </select>
                                </div>
                            </div>

                            {/* Grid das Áreas da Fábrica */}
                            {areasFabricaFiltradas.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                                    Nenhuma área encontrada com os filtros selecionados.
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? '100%' : '260px'}, 1fr))`, gap: '0.75rem' }}>
                                    {areasFabricaFiltradas.map(m => {
                                        const score = m.ult ? solarDe(m.ult) : null;
                                        const selo = solSelo(score);
                                        const diasAtraso = m.ult ? Math.round((Date.now() - new Date(String(m.ult.data_auditoria || m.ult.created_at).slice(0, 10) + 'T12:00:00')) / 86400000) : null;
                                        const atrasada = diasAtraso != null && diasAtraso > 30;

                                        return (
                                            <div
                                                key={areaKey(m)}
                                                className="glass-panel"
                                                style={{
                                                    borderRadius: 12,
                                                    border: `1px solid ${m.ult ? `${selo.cor}44` : 'var(--border-color-dark)'}`,
                                                    padding: '0.85rem',
                                                    background: 'var(--bg-app)',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    justifyContent: 'space-between',
                                                    gap: '0.6rem'
                                                }}
                                            >
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', marginBottom: '0.35rem' }}>
                                                        <span style={{ fontSize: '0.58rem', fontWeight: 800, color: ACCENT, background: `${ACCENT}18`, borderRadius: 4, padding: '0.1rem 0.4rem', textTransform: 'uppercase' }}>
                                                            {m.fabrica}
                                                        </span>
                                                        <SolSeloPill value={score} small />
                                                    </div>

                                                    <div style={{ fontSize: '0.88rem', fontWeight: 900, color: 'var(--color-text-main)', lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {m.maquina || 'Setor inteiro'}
                                                    </div>
                                                    <div style={{ fontSize: '0.64rem', color: 'var(--color-text-subtle)', fontWeight: 700, marginTop: 2 }}>
                                                        {m.setor} · {m.planta}
                                                    </div>
                                                </div>

                                                {/* Medidor e Métricas Rápidas */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', background: 'rgba(255,255,255,0.02)', padding: '0.45rem 0.6rem', borderRadius: 8, border: '1px solid var(--border-color-dark)' }}>
                                                    <RingGauge value={score} size={42} stroke={4.5} />
                                                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.64rem', fontWeight: 800 }}>
                                                            <span style={{ color: ACCENT }}>5S: {m.ult?.score != null ? `${Math.round(m.ult.score)}%` : '—'}</span>
                                                            <span style={{ color: SOL_ACCENT }}>SOL: {m.ult?.scores?.sol_geral != null ? `${m.ult.scores.sol_geral}%` : '—'}</span>
                                                        </div>
                                                        <div style={{ fontSize: '0.58rem', color: 'var(--color-text-muted)' }}>
                                                            {m.ult ? `Última: ${fmtData(m.ult.data_auditoria)}` : 'Nunca auditada'}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Detalhes de status & Ações */}
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.62rem', color: 'var(--color-text-muted)' }}>
                                                    <div>
                                                        {atrasada && <span style={{ color: '#DC2626', fontWeight: 800 }}>⚠️ +30 dias</span>}
                                                        {!atrasada && diasAtraso != null && <span>Há {diasAtraso} dia(s)</span>}
                                                        {m.acoesAbertas > 0 && <span style={{ marginLeft: 6, color: '#D97706', fontWeight: 800 }}>{m.acoesAbertas} ação(ões)</span>}
                                                    </div>
                                                    {m.delta != null && (
                                                        <span style={{ fontWeight: 800, color: m.delta >= 0 ? '#16A34A' : '#DC2626' }}>
                                                            {m.delta >= 0 ? '▲' : '▼'} {Math.abs(m.delta)} pts
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Botões de Ação */}
                                                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem' }}>
                                                    {m.ult && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setSel(m.ult)}
                                                            style={{ ...btnSec, flex: 1, padding: '0.35rem 0.5rem', fontSize: '0.66rem', justifyContent: 'center' }}
                                                            title="Visualizar última auditoria"
                                                        >
                                                            <FaEye size={10} /> Ver
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => { setNovaPrefill({ planta: m.planta, fabrica: m.fabrica, setor: m.setor, maquina: m.maquina }); setShowNova(true); }}
                                                        style={{ ...btnPrim, flex: 1.3, padding: '0.35rem 0.5rem', fontSize: '0.68rem', justifyContent: 'center' }}
                                                    >
                                                        <FaBroom size={10} /> Auditar
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

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
