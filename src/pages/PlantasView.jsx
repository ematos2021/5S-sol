import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import {
    FaPlus, FaTrash, FaSync, FaIndustry, FaLayerGroup, FaSitemap, FaCog, FaChevronDown, FaChevronRight,
} from 'react-icons/fa';

const ACCENT = '#22C55E';
const inputSty = { width: '100%', boxSizing: 'border-box', background: 'var(--bg-surface-glass)', border: '1px solid var(--border-color-dark)', borderRadius: 8, color: 'var(--color-text-main)', fontSize: '0.85rem', padding: '0.55rem 0.7rem', outline: 'none' };
const labelSty = { fontSize: '0.66rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '0.3rem' };
const btnPrim = { display: 'inline-flex', alignItems: 'center', gap: '0.45rem', background: ACCENT, color: '#04210f', border: 'none', borderRadius: 8, padding: '0.6rem 1.1rem', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' };

// Ordena "LINHA 2" / "MÁQUINA 118" numericamente
const cmpMaq = (a, b) => {
    const na = parseInt(String(a).match(/\d+/)?.[0] ?? 1e9, 10), nb = parseInt(String(b).match(/\d+/)?.[0] ?? 1e9, 10);
    return na - nb || String(a).localeCompare(String(b));
};

export default function PlantasView() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState(null);
    const [open, setOpen] = useState(() => new Set());
    const [form, setForm] = useState({ planta: '', fabrica: '', setor: '', maquina: '' });

    const showMsg = (text, type = 'success') => { setMsg({ text, type }); setTimeout(() => setMsg(null), 2600); };

    const load = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase.from('cadastro_planta_area').select('*').order('planta').order('fabrica').order('setor').order('maquina');
        if (!error) setRows(data || []);
        setLoading(false);
    }, []);
    useEffect(() => { load(); }, [load]);

    const plantasExistentes = [...new Set(rows.map(r => r.planta).filter(Boolean))].sort();

    const adicionar = async () => {
        const planta = form.planta.trim(), fabrica = form.fabrica.trim(), setor = form.setor.trim();
        if (!planta) { showMsg('Informe ao menos a Planta.', 'error'); return; }
        // Linha/Máquina aceita vários separados por vírgula
        const maquinas = form.maquina.split(',').map(s => s.trim()).filter(Boolean);
        const payloads = maquinas.length
            ? maquinas.map(m => ({ planta, fabrica: fabrica || null, setor: setor || null, maquina: m }))
            : [{ planta, fabrica: fabrica || null, setor: setor || null, maquina: null }];
        setSaving(true);
        const { error } = await supabase.from('cadastro_planta_area').insert(payloads);
        setSaving(false);
        if (error) { showMsg('Erro: ' + error.message, 'error'); return; }
        showMsg(`${payloads.length} registro(s) adicionado(s)`);
        setForm(f => ({ ...f, maquina: '' }));
        load();
    };

    const remover = async (id) => {
        const { error } = await supabase.from('cadastro_planta_area').delete().eq('id', id);
        if (error) { showMsg('Erro ao remover: ' + error.message, 'error'); return; }
        setRows(prev => prev.filter(r => r.id !== id));
        showMsg('Removido');
    };

    // Árvore: planta → fábrica → setor → [linhas/máquinas]
    const arvore = (() => {
        const P = new Map();
        rows.forEach(r => {
            const pk = r.planta || '—';
            if (!P.has(pk)) P.set(pk, { planta: pk, fabricas: new Map() });
            if (!r.fabrica) return;
            const p = P.get(pk);
            if (!p.fabricas.has(r.fabrica)) p.fabricas.set(r.fabrica, { fabrica: r.fabrica, setores: new Map() });
            if (!r.setor) return;
            const f = p.fabricas.get(r.fabrica);
            if (!f.setores.has(r.setor)) f.setores.set(r.setor, { setor: r.setor, maquinas: [] });
            if (r.maquina) f.setores.get(r.setor).maquinas.push({ id: r.id, nome: r.maquina });
        });
        return [...P.values()].map(p => ({
            ...p,
            fabricas: [...p.fabricas.values()].map(f => ({
                ...f,
                setores: [...f.setores.values()].map(s => ({ ...s, maquinas: s.maquinas.sort((a, b) => cmpMaq(a.nome, b.nome)) })),
            })),
        }));
    })();

    const toggle = (k) => setOpen(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });
    const total = rows.length;

    return (
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0.5rem 0 2rem' }}>
            {msg && (
                <div style={{ position: 'fixed', top: '1.2rem', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, padding: '0.6rem 1.3rem', borderRadius: 8, fontSize: '0.82rem', fontWeight: 700, background: msg.type === 'error' ? '#DC2626' : '#16A34A', color: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
                    {msg.type === 'error' ? '✕' : '✓'} {msg.text}
                </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
                <FaSitemap color={ACCENT} size={16} />
                <div style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--color-text-main)' }}>Cadastro de Plantas & Áreas</div>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: '1.2rem' }}>A base das áreas auditadas — Planta → Fábrica → Setor → Linha/Máquina.</div>

            {/* Formulário de inclusão */}
            <div className="glass-panel" style={{ borderRadius: 14, border: '1px solid var(--border-color-dark)', padding: '1.1rem', marginBottom: '1.4rem' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-text-main)', marginBottom: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><FaPlus size={12} color={ACCENT} /> Adicionar área</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.8rem', alignItems: 'end' }}>
                    <div>
                        <label style={labelSty}>Planta *</label>
                        <input list="plantas-dl" style={inputSty} value={form.planta} onChange={e => setForm(f => ({ ...f, planta: e.target.value }))} placeholder="Ex: MKBR" />
                        <datalist id="plantas-dl">{plantasExistentes.map(p => <option key={p} value={p} />)}</datalist>
                    </div>
                    <div><label style={labelSty}>Fábrica</label><input style={inputSty} value={form.fabrica} onChange={e => setForm(f => ({ ...f, fabrica: e.target.value }))} placeholder="Ex: FÁBRICA 1" /></div>
                    <div><label style={labelSty}>Setor</label><input style={inputSty} value={form.setor} onChange={e => setForm(f => ({ ...f, setor: e.target.value }))} placeholder="Ex: INJEÇÃO" /></div>
                    <div><label style={labelSty}>Linha / Máquina</label><input style={inputSty} value={form.maquina} onChange={e => setForm(f => ({ ...f, maquina: e.target.value }))} placeholder="Ex: MÁQUINA 118 (vários: separe por vírgula)" onKeyDown={e => { if (e.key === 'Enter') adicionar(); }} /></div>
                    <button onClick={adicionar} disabled={saving} style={{ ...btnPrim, opacity: saving ? 0.6 : 1, height: 38, justifyContent: 'center' }}>{saving ? 'Salvando…' : 'Adicionar'}</button>
                </div>
                <div style={{ fontSize: '0.66rem', color: 'var(--color-text-subtle)', marginTop: '0.7rem' }}>Deixe <b>Linha/Máquina</b> em branco para cadastrar o setor inteiro. Para várias de uma vez, separe por vírgula (ex.: <i>LINHA 1, LINHA 2, LINHA 3</i>).</div>
            </div>

            {/* Árvore de áreas */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.7rem' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-text-main)' }}>Estrutura cadastrada <span style={{ color: 'var(--color-text-subtle)', fontWeight: 600 }}>· {total} registro(s)</span></div>
                <button onClick={load} style={{ ...btnPrim, background: 'transparent', color: 'var(--color-text-muted)', border: '1px solid var(--border-color-dark)', fontWeight: 700 }}><FaSync size={11} /> Atualizar</button>
            </div>

            {loading ? <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>Carregando…</div>
                : arvore.length === 0 ? (
                    <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        <FaSitemap size={34} color="var(--border-color-dark)" style={{ marginBottom: '0.8rem' }} />
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-main)' }}>Nenhuma área cadastrada</div>
                        <div style={{ fontSize: '0.78rem', marginTop: 4 }}>Use o formulário acima para montar a base de plantas e setores.</div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                        {arvore.map(p => (
                            <div key={p.planta} className="glass-panel" style={{ borderRadius: 12, border: '1px solid var(--border-color-dark)', padding: '0.9rem 1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: p.fabricas.length ? '0.7rem' : 0 }}>
                                    <FaLayerGroup color={ACCENT} size={13} />
                                    <span style={{ fontSize: '0.9rem', fontWeight: 900, color: 'var(--color-text-main)' }}>{p.planta}</span>
                                    <span style={{ fontSize: '0.6rem', color: 'var(--color-text-subtle)', fontWeight: 700 }}>{p.fabricas.length} fábrica(s)</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingLeft: '0.4rem' }}>
                                    {p.fabricas.map(f => (
                                        <div key={f.fabrica} style={{ borderLeft: `2px solid ${ACCENT}33`, paddingLeft: '0.8rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.2rem 0 0.4rem' }}>
                                                <FaIndustry color="var(--color-text-muted)" size={11} />
                                                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-text-main)' }}>{f.fabrica}</span>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '0.5rem' }}>
                                                {f.setores.map(s => {
                                                    const sk = `${p.planta}|${f.fabrica}|${s.setor}`;
                                                    const aberto = open.has(sk);
                                                    return (
                                                        <div key={s.setor} style={{ border: '1px solid var(--border-color-dark)', borderRadius: 9, overflow: 'hidden' }}>
                                                            <button onClick={() => s.maquinas.length && toggle(sk)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.5rem 0.6rem', background: 'transparent', border: 'none', cursor: s.maquinas.length ? 'pointer' : 'default', textAlign: 'left' }}>
                                                                {s.maquinas.length ? (aberto ? <FaChevronDown size={9} color="var(--color-text-subtle)" /> : <FaChevronRight size={9} color="var(--color-text-subtle)" />) : <span style={{ width: 9 }} />}
                                                                <span style={{ flex: 1, fontSize: '0.74rem', fontWeight: 700, color: 'var(--color-text-main)' }}>{s.setor}</span>
                                                                <span style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--color-text-muted)', background: 'var(--bg-surface-glass)', border: '1px solid var(--border-color-dark)', borderRadius: 20, padding: '0.05rem 0.5rem' }}>{s.maquinas.length || 'setor'}</span>
                                                            </button>
                                                            {aberto && s.maquinas.length > 0 && (
                                                                <div style={{ padding: '0 0.6rem 0.5rem' }}>
                                                                    {s.maquinas.map(m => (
                                                                        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.25rem 0', borderTop: '1px solid var(--border-color-dark)' }}>
                                                                            <FaCog size={9} color="var(--color-text-subtle)" />
                                                                            <span style={{ flex: 1, fontSize: '0.7rem', color: 'var(--color-text-main)' }}>{m.nome}</span>
                                                                            <button onClick={() => remover(m.id)} title="Remover" style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', opacity: 0.6, padding: 2 }} onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0.6}><FaTrash size={9} /></button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
        </div>
    );
}
