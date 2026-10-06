import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import {
    FaPlus, FaTrash, FaSync, FaIndustry, FaLayerGroup, FaSitemap, FaCog, FaChevronDown, FaChevronRight,
    FaStream, FaPen, FaUnlink, FaTimes, FaCheck,
} from 'react-icons/fa';

const ACCENT = '#22C55E';
const inputSty = { width: '100%', boxSizing: 'border-box', background: 'var(--bg-surface-glass)', border: '1px solid var(--border-color-dark)', borderRadius: 8, color: 'var(--color-text-main)', fontSize: '0.85rem', padding: '0.55rem 0.7rem', outline: 'none' };
const labelSty = { fontSize: '0.66rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '0.3rem' };
const btnPrim = { display: 'inline-flex', alignItems: 'center', gap: '0.45rem', background: ACCENT, color: '#04210f', border: 'none', borderRadius: 8, padding: '0.6rem 1.1rem', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' };
const btnIco = (cor) => ({ background: 'none', border: 'none', color: cor, cursor: 'pointer', opacity: 0.6, padding: 2, display: 'inline-flex' });
const hover = { onMouseEnter: e => { e.currentTarget.style.opacity = 1; }, onMouseLeave: e => { e.currentTarget.style.opacity = 0.6; } };
const badgeSty = { fontSize: '0.58rem', fontWeight: 800, color: 'var(--color-text-muted)', background: 'var(--bg-surface-glass)', border: '1px solid var(--border-color-dark)', borderRadius: 20, padding: '0.05rem 0.5rem', whiteSpace: 'nowrap' };

const NOVO = '__novo__';
const norm = (s) => String(s ?? '').trim().toUpperCase();

// Ordena "LINHA 2" / "MÁQUINA 118" numericamente
const cmpMaq = (a, b) => {
    const na = parseInt(String(a).match(/\d+/)?.[0] ?? 1e9, 10), nb = parseInt(String(b).match(/\d+/)?.[0] ?? 1e9, 10);
    return na - nb || String(a).localeCompare(String(b));
};

// Registros anteriores às colunas tipo/linha_id: o nome decide.
const tipoDe = (r) => r.tipo || (r.maquina ? (/^\s*linha/i.test(r.maquina) ? 'linha' : 'maquina') : null);

const SQL_FALTANDO = 'O banco ainda não tem as colunas de linha. Rode o database/schema.sql no SQL Editor do Supabase.';
const faltaColuna = (error) => /tipo|linha_id/i.test(error?.message || '');

// Campo com as opções já cadastradas + "Novo…" que abre a digitação.
const CampoLista = ({ label, valor, opcoes, novo, setNovo, onChange, placeholder, disabled }) => {
    const digitando = novo || opcoes.length === 0;
    return (
        <div>
            <label style={labelSty}>{label}</label>
            {digitando ? (
                <div style={{ position: 'relative' }}>
                    <input style={{ ...inputSty, paddingRight: opcoes.length ? '2rem' : inputSty.padding }} value={valor} disabled={disabled}
                        onChange={e => onChange(e.target.value.toUpperCase())} placeholder={placeholder} autoFocus={novo} />
                    {opcoes.length > 0 && (
                        <button title="Escolher da lista" onClick={() => { setNovo(false); onChange(''); }}
                            style={{ ...btnIco('var(--color-text-muted)'), position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)' }} {...hover}><FaTimes size={11} /></button>
                    )}
                </div>
            ) : (
                <select style={inputSty} value={valor} disabled={disabled}
                    onChange={e => { if (e.target.value === NOVO) { setNovo(true); onChange(''); } else onChange(e.target.value); }}>
                    <option value="">Selecione…</option>
                    {opcoes.map(o => <option key={o} value={o}>{o}</option>)}
                    <option value={NOVO}>+ Novo…</option>
                </select>
            )}
        </div>
    );
};

const Check = ({ marcado, onClick, children, sub }) => (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', width: '100%', background: marcado ? `${ACCENT}14` : 'transparent', border: `1px solid ${marcado ? ACCENT + '66' : 'var(--border-color-dark)'}`, borderRadius: 7, padding: '0.35rem 0.55rem', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ width: 14, height: 14, flexShrink: 0, borderRadius: 4, border: `1.5px solid ${marcado ? ACCENT : 'var(--color-text-subtle)'}`, background: marcado ? ACCENT : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            {marcado && <FaCheck size={8} color="#04210f" />}
        </span>
        <span style={{ flex: 1, fontSize: '0.74rem', fontWeight: 700, color: 'var(--color-text-main)' }}>{children}</span>
        {sub && <span style={{ fontSize: '0.6rem', color: 'var(--color-text-subtle)' }}>{sub}</span>}
    </button>
);

const FORM_VAZIO = { planta: '', fabrica: '', setor: '', tipo: 'maquina', nome: '', linhaId: '', sel: [], novas: '' };

export default function PlantasView() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState(null);
    const [open, setOpen] = useState(() => new Set());
    const [form, setForm] = useState(FORM_VAZIO);
    const [novo, setNovo] = useState({ planta: false, fabrica: false, setor: false });
    // Edição da composição de uma linha já cadastrada
    const [edit, setEdit] = useState(null); // { id, sel: [ids], novas: '' }

    const showMsg = (text, type = 'success') => { setMsg({ text, type }); setTimeout(() => setMsg(null), type === 'error' ? 5000 : 2600); };

    const load = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase.from('cadastro_planta_area').select('*').order('planta').order('fabrica').order('setor').order('maquina');
        if (!error) setRows(data || []);
        setLoading(false);
    }, []);
    useEffect(() => { load(); }, [load]);

    const temColunas = rows.length === 0 || 'linha_id' in rows[0];
    const set = (patch) => setForm(f => ({ ...f, ...patch }));
    const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort();

    // Opções em cascata, sempre do que já existe
    const plantas = uniq(rows.map(r => r.planta));
    const fabricas = uniq(rows.filter(r => r.planta === form.planta).map(r => r.fabrica));
    const setores = uniq(rows.filter(r => r.planta === form.planta && r.fabrica === form.fabrica).map(r => r.setor));
    const doSetor = rows.filter(r => r.maquina && r.planta === form.planta && r.fabrica === form.fabrica && r.setor === form.setor);
    const linhasSetor = doSetor.filter(r => tipoDe(r) === 'linha').sort((a, b) => cmpMaq(a.maquina, b.maquina));
    const idsLinha = new Set(rows.filter(r => tipoDe(r) === 'linha').map(r => r.id));
    const livre = (r) => !r.linha_id || !idsLinha.has(r.linha_id);
    const maquinasLivres = doSetor.filter(r => tipoDe(r) === 'maquina' && livre(r)).sort((a, b) => cmpMaq(a.maquina, b.maquina));

    const escolher = (campo, valor) => {
        // Trocar um nível limpa os de baixo
        if (campo === 'planta') { set({ planta: valor, fabrica: '', setor: '', linhaId: '', sel: [] }); setNovo(n => ({ ...n, fabrica: false, setor: false })); }
        if (campo === 'fabrica') { set({ fabrica: valor, setor: '', linhaId: '', sel: [] }); setNovo(n => ({ ...n, setor: false })); }
        if (campo === 'setor') set({ setor: valor, linhaId: '', sel: [] });
    };

    const nomes = (txt) => txt.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    const existeNoSetor = (nome, base = doSetor) => base.some(r => norm(r.maquina) === norm(nome));

    const adicionar = async () => {
        const planta = form.planta.trim(), fabrica = form.fabrica.trim(), setor = form.setor.trim();
        if (!planta) { showMsg('Informe ao menos a Planta.', 'error'); return; }
        const base = { planta, fabrica: fabrica || null, setor: setor || null };

        if (form.tipo === 'setor') {
            if (rows.some(r => !r.maquina && r.planta === planta && (r.fabrica || '') === fabrica && (r.setor || '') === setor)) { showMsg('Essa área já está cadastrada.', 'error'); return; }
            setSaving(true);
            const { error } = await supabase.from('cadastro_planta_area').insert([{ ...base, maquina: null }]);
            setSaving(false);
            if (error) { showMsg('Erro: ' + error.message, 'error'); return; }
            showMsg('Área adicionada');
            load();
            return;
        }

        if (!fabrica || !setor) { showMsg('Linha e máquina precisam de Fábrica e Setor.', 'error'); return; }
        if (!temColunas && (form.tipo === 'linha' || form.linhaId)) { showMsg(SQL_FALTANDO, 'error'); return; }

        if (form.tipo === 'maquina') {
            const lista = nomes(form.nome);
            if (!lista.length) { showMsg('Informe o nome da máquina.', 'error'); return; }
            const repetida = lista.find(n => existeNoSetor(n));
            if (repetida) { showMsg(`${repetida} já existe neste setor.`, 'error'); return; }
            const payloads = lista.map(m => temColunas
                ? { ...base, maquina: m, tipo: 'maquina', linha_id: form.linhaId ? Number(form.linhaId) : null }
                : { ...base, maquina: m });
            setSaving(true);
            const { error } = await supabase.from('cadastro_planta_area').insert(payloads);
            setSaving(false);
            if (error) { showMsg(faltaColuna(error) ? SQL_FALTANDO : 'Erro: ' + error.message, 'error'); return; }
            showMsg(`${payloads.length} máquina(s) adicionada(s)`);
            set({ nome: '' });
            load();
            return;
        }

        // Linha: cria a linha e depois pendura as máquinas nela
        const nome = form.nome.trim().toUpperCase();
        const novas = nomes(form.novas);
        if (!nome) { showMsg('Informe o nome da linha.', 'error'); return; }
        if (existeNoSetor(nome)) { showMsg(`${nome} já existe neste setor.`, 'error'); return; }
        if (!form.sel.length && !novas.length) { showMsg('Marque ou digite as máquinas que compõem a linha.', 'error'); return; }
        const repetida = novas.find(n => existeNoSetor(n) || n === nome);
        if (repetida) { showMsg(`${repetida} já existe neste setor — marque-a na lista em vez de digitar.`, 'error'); return; }

        setSaving(true);
        const { data: linha, error } = await supabase.from('cadastro_planta_area')
            .insert([{ ...base, maquina: nome, tipo: 'linha' }]).select().single();
        if (error) { setSaving(false); showMsg(faltaColuna(error) ? SQL_FALTANDO : 'Erro: ' + error.message, 'error'); return; }
        const erros = [];
        if (form.sel.length) {
            const { error: e1 } = await supabase.from('cadastro_planta_area').update({ linha_id: linha.id }).in('id', form.sel);
            if (e1) erros.push(e1.message);
        }
        if (novas.length) {
            const { error: e2 } = await supabase.from('cadastro_planta_area').insert(novas.map(m => ({ ...base, maquina: m, tipo: 'maquina', linha_id: linha.id })));
            if (e2) erros.push(e2.message);
        }
        setSaving(false);
        if (erros.length) showMsg(`Linha criada, mas faltou vincular máquinas: ${erros[0]}`, 'error');
        else showMsg(`${nome} criada com ${form.sel.length + novas.length} máquina(s)`);
        set({ nome: '', sel: [], novas: '' });
        setOpen(prev => new Set(prev).add(`${planta}|${fabrica}|${setor}`).add(`L${linha.id}`));
        load();
    };

    const remover = async (r, filhos = 0) => {
        if (filhos && !window.confirm(`Apagar a ${r.maquina}? As ${filhos} máquina(s) dela continuam cadastradas no setor, só saem da linha.`)) return;
        const { error } = await supabase.from('cadastro_planta_area').delete().eq('id', r.id);
        if (error) { showMsg('Erro ao remover: ' + error.message, 'error'); return; }
        if (filhos) load(); else setRows(prev => prev.filter(x => x.id !== r.id));
        showMsg('Removido');
    };

    const desvincular = async (m) => {
        const { error } = await supabase.from('cadastro_planta_area').update({ linha_id: null }).eq('id', m.id);
        if (error) { showMsg('Erro: ' + error.message, 'error'); return; }
        setRows(prev => prev.map(x => x.id === m.id ? { ...x, linha_id: null } : x));
        showMsg(`${m.maquina} saiu da linha`);
    };

    const salvarComposicao = async (linha, atuais) => {
        const sel = new Set(edit.sel);
        const entrar = [...sel].filter(id => !atuais.some(m => m.id === id));
        const sair = atuais.filter(m => !sel.has(m.id)).map(m => m.id);
        const novas = nomes(edit.novas);
        const irmas = rows.filter(r => r.maquina && r.planta === linha.planta && r.fabrica === linha.fabrica && r.setor === linha.setor);
        const repetida = novas.find(n => existeNoSetor(n, irmas));
        if (repetida) { showMsg(`${repetida} já existe neste setor — marque-a na lista.`, 'error'); return; }
        if (sel.size + novas.length === 0 && !window.confirm(`A ${linha.maquina} vai ficar sem máquinas. Continuar?`)) return;
        setSaving(true);
        const ops = [];
        if (entrar.length) ops.push(supabase.from('cadastro_planta_area').update({ linha_id: linha.id }).in('id', entrar));
        if (sair.length) ops.push(supabase.from('cadastro_planta_area').update({ linha_id: null }).in('id', sair));
        if (novas.length) ops.push(supabase.from('cadastro_planta_area').insert(novas.map(m => ({ planta: linha.planta, fabrica: linha.fabrica, setor: linha.setor, maquina: m, tipo: 'maquina', linha_id: linha.id }))));
        const res = await Promise.all(ops);
        setSaving(false);
        const err = res.find(r => r.error)?.error;
        if (err) { showMsg(faltaColuna(err) ? SQL_FALTANDO : 'Erro: ' + err.message, 'error'); return; }
        showMsg('Composição da linha salva');
        setEdit(null);
        load();
    };

    // Árvore: planta → fábrica → setor → linhas (com suas máquinas) + máquinas fora de linha
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
            if (!f.setores.has(r.setor)) f.setores.set(r.setor, { setor: r.setor, itens: [] });
            if (r.maquina) f.setores.get(r.setor).itens.push(r);
        });
        const porNome = (a, b) => cmpMaq(a.maquina, b.maquina);
        return [...P.values()].map(p => ({
            ...p,
            fabricas: [...p.fabricas.values()].map(f => ({
                ...f,
                setores: [...f.setores.values()].map(s => {
                    const linhas = s.itens.filter(r => tipoDe(r) === 'linha').sort(porNome)
                        .map(l => ({ ...l, maquinas: s.itens.filter(m => m.linha_id === l.id && tipoDe(m) === 'maquina').sort(porNome) }));
                    const ids = new Set(linhas.map(l => l.id));
                    const avulsas = s.itens.filter(r => tipoDe(r) === 'maquina' && !(r.linha_id && ids.has(r.linha_id))).sort(porNome);
                    return { setor: s.setor, linhas, avulsas, total: s.itens.length };
                }),
            })),
        }));
    })();

    const toggle = (k) => setOpen(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });
    const total = rows.length;
    const tipos = [['maquina', 'Máquina'], ['linha', 'Linha'], ['setor', 'Só a área']];

    const linhaMaquina = (m, { naLinha } = {}) => (
        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.25rem 0', borderTop: '1px solid var(--border-color-dark)' }}>
            <FaCog size={9} color="var(--color-text-subtle)" />
            <span style={{ flex: 1, fontSize: '0.7rem', color: 'var(--color-text-main)' }}>{m.maquina}</span>
            {naLinha && <button onClick={() => desvincular(m)} title="Tirar da linha" style={btnIco('var(--color-text-muted)')} {...hover}><FaUnlink size={9} /></button>}
            <button onClick={() => remover(m)} title="Remover" style={btnIco('#DC2626')} {...hover}><FaTrash size={9} /></button>
        </div>
    );

    return (
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0.5rem 0 2rem' }}>
            {msg && (
                <div style={{ position: 'fixed', top: '1.2rem', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, padding: '0.6rem 1.3rem', borderRadius: 8, fontSize: '0.82rem', fontWeight: 700, background: msg.type === 'error' ? '#DC2626' : '#16A34A', color: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.4)', maxWidth: 'calc(100vw - 32px)' }}>
                    {msg.type === 'error' ? '✕' : '✓'} {msg.text}
                </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
                <FaSitemap color={ACCENT} size={16} />
                <div style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--color-text-main)' }}>Cadastro de Plantas & Áreas</div>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: '1.2rem' }}>A base das áreas auditadas — Planta → Fábrica → Setor → Linha (união de máquinas) ou Máquina.</div>

            {!loading && !temColunas && (
                <div style={{ border: '1px solid #D9770666', background: '#D9770614', borderRadius: 10, padding: '0.7rem 0.9rem', fontSize: '0.74rem', color: 'var(--color-text-main)', marginBottom: '1rem' }}>
                    <b style={{ color: '#D97706' }}>Falta atualizar o banco.</b> Para montar linhas com máquinas, rode o <code>database/schema.sql</code> no SQL Editor do Supabase (cria as colunas <code>tipo</code> e <code>linha_id</code>). Até lá dá para cadastrar máquinas soltas.
                </div>
            )}

            {/* Formulário de inclusão */}
            <div className="glass-panel" style={{ borderRadius: 14, border: '1px solid var(--border-color-dark)', padding: '1.1rem', marginBottom: '1.4rem' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-text-main)', marginBottom: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><FaPlus size={12} color={ACCENT} /> Adicionar área</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.8rem', alignItems: 'end' }}>
                    <CampoLista label="Planta *" valor={form.planta} opcoes={plantas} novo={novo.planta} setNovo={v => setNovo(n => ({ ...n, planta: v }))}
                        onChange={v => escolher('planta', v)} placeholder="Ex: MKBR" />
                    <CampoLista label="Fábrica" valor={form.fabrica} opcoes={novo.planta ? [] : fabricas} novo={novo.fabrica} setNovo={v => setNovo(n => ({ ...n, fabrica: v }))}
                        onChange={v => escolher('fabrica', v)} placeholder="Ex: FÁBRICA 1" disabled={!form.planta} />
                    <CampoLista label="Setor" valor={form.setor} opcoes={novo.planta || novo.fabrica ? [] : setores} novo={novo.setor} setNovo={v => setNovo(n => ({ ...n, setor: v }))}
                        onChange={v => escolher('setor', v)} placeholder="Ex: TAMPOGRAFIA" disabled={!form.fabrica} />
                    <div>
                        <label style={labelSty}>Cadastrar</label>
                        <div style={{ display: 'flex', border: '1px solid var(--border-color-dark)', borderRadius: 8, overflow: 'hidden', height: 38 }}>
                            {tipos.map(([k, l]) => (
                                <button key={k} onClick={() => set({ tipo: k })} style={{ flex: 1, border: 'none', cursor: 'pointer', fontSize: '0.74rem', fontWeight: 800, background: form.tipo === k ? ACCENT : 'transparent', color: form.tipo === k ? '#04210f' : 'var(--color-text-muted)' }}>{l}</button>
                            ))}
                        </div>
                    </div>
                </div>

                {form.tipo !== 'setor' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.8rem', marginTop: '0.8rem', alignItems: 'end' }}>
                        <div>
                            <label style={labelSty}>{form.tipo === 'linha' ? 'Nome da linha *' : 'Máquina *'}</label>
                            <input style={inputSty} value={form.nome} onChange={e => set({ nome: e.target.value })}
                                placeholder={form.tipo === 'linha' ? 'Ex: LINHA 10' : 'Ex: MÁQUINA 118 (várias: separe por vírgula)'}
                                onKeyDown={e => { if (e.key === 'Enter' && form.tipo === 'maquina') adicionar(); }} />
                        </div>
                        {form.tipo === 'maquina' && (
                            <div>
                                <label style={labelSty}>Faz parte da linha</label>
                                <select style={inputSty} value={form.linhaId} disabled={!linhasSetor.length || !temColunas} onChange={e => set({ linhaId: e.target.value })}>
                                    <option value="">{linhasSetor.length ? 'Nenhuma (máquina solta)' : (form.setor ? 'Setor sem linhas' : 'Escolha o setor')}</option>
                                    {linhasSetor.map(l => <option key={l.id} value={l.id}>{l.maquina}</option>)}
                                </select>
                            </div>
                        )}
                        {form.tipo === 'linha' && (
                            <div>
                                <label style={labelSty}>Máquinas novas da linha</label>
                                <input style={inputSty} value={form.novas} onChange={e => set({ novas: e.target.value })} placeholder="Ex: MÁQUINA 11, MÁQUINA 12" />
                            </div>
                        )}
                    </div>
                )}

                {form.tipo === 'linha' && (
                    <div style={{ marginTop: '0.8rem' }}>
                        <label style={labelSty}>Máquinas já cadastradas no setor {form.sel.length > 0 && <span style={{ color: ACCENT }}>· {form.sel.length} marcada(s)</span>}</label>
                        {!form.setor ? <div style={{ fontSize: '0.7rem', color: 'var(--color-text-subtle)' }}>Escolha o setor para ver as máquinas.</div>
                            : maquinasLivres.length === 0 ? <div style={{ fontSize: '0.7rem', color: 'var(--color-text-subtle)' }}>Nenhuma máquina solta neste setor — digite as novas no campo acima.</div>
                                : (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.4rem' }}>
                                        {maquinasLivres.map(m => {
                                            const on = form.sel.includes(m.id);
                                            return <Check key={m.id} marcado={on} onClick={() => set({ sel: on ? form.sel.filter(x => x !== m.id) : [...form.sel, m.id] })}>{m.maquina}</Check>;
                                        })}
                                    </div>
                                )}
                        <div style={{ fontSize: '0.64rem', color: 'var(--color-text-subtle)', marginTop: '0.45rem' }}>Só aparecem as máquinas que ainda não estão em outra linha. Uma máquina pertence a uma linha só.</div>
                    </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.8rem', marginTop: '0.9rem', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '0.66rem', color: 'var(--color-text-subtle)', flex: '1 1 260px' }}>
                        {form.tipo === 'setor' && <>Cadastra a planta, a fábrica ou o setor sem máquina — auditado como <b>setor inteiro</b>.</>}
                        {form.tipo === 'maquina' && <>Várias de uma vez: separe por vírgula. Escolha uma linha para a máquina já entrar nela.</>}
                        {form.tipo === 'linha' && <>A linha é auditada como uma área só; as máquinas dela saem da lista de áreas avulsas.</>}
                    </div>
                    <button onClick={adicionar} disabled={saving} style={{ ...btnPrim, opacity: saving ? 0.6 : 1, height: 38, justifyContent: 'center', minWidth: 160 }}>
                        {saving ? 'Salvando…' : form.tipo === 'linha' ? 'Criar linha' : 'Adicionar'}
                    </button>
                </div>
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
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '0.5rem', alignItems: 'start' }}>
                                                {f.setores.map(s => {
                                                    const sk = `${p.planta}|${f.fabrica}|${s.setor}`;
                                                    const aberto = open.has(sk);
                                                    const tem = s.total > 0;
                                                    const resumo = !tem ? 'setor' : [s.linhas.length && `${s.linhas.length} lin.`, `${s.total - s.linhas.length} máq.`].filter(Boolean).join(' · ');
                                                    // Máquinas soltas do setor: candidatas a entrar na linha em edição
                                                    const soltas = s.avulsas;
                                                    return (
                                                        <div key={s.setor} style={{ border: '1px solid var(--border-color-dark)', borderRadius: 9, overflow: 'hidden' }}>
                                                            <button onClick={() => tem && toggle(sk)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.5rem 0.6rem', background: 'transparent', border: 'none', cursor: tem ? 'pointer' : 'default', textAlign: 'left' }}>
                                                                {tem ? (aberto ? <FaChevronDown size={9} color="var(--color-text-subtle)" /> : <FaChevronRight size={9} color="var(--color-text-subtle)" />) : <span style={{ width: 9 }} />}
                                                                <span style={{ flex: 1, fontSize: '0.74rem', fontWeight: 700, color: 'var(--color-text-main)' }}>{s.setor}</span>
                                                                <span style={badgeSty}>{resumo}</span>
                                                            </button>
                                                            {aberto && tem && (
                                                                <div style={{ padding: '0 0.6rem 0.5rem' }}>
                                                                    {s.linhas.map(l => {
                                                                        const lk = `L${l.id}`;
                                                                        const la = open.has(lk);
                                                                        const editando = edit?.id === l.id;
                                                                        return (
                                                                            <div key={l.id} style={{ borderTop: '1px solid var(--border-color-dark)' }}>
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0' }}>
                                                                                    <button onClick={() => toggle(lk)} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
                                                                                        {la ? <FaChevronDown size={8} color="var(--color-text-subtle)" /> : <FaChevronRight size={8} color="var(--color-text-subtle)" />}
                                                                                        <FaStream size={9} color={ACCENT} />
                                                                                        <span style={{ flex: 1, fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-text-main)' }}>{l.maquina}</span>
                                                                                        <span style={{ ...badgeSty, color: l.maquinas.length ? 'var(--color-text-muted)' : '#D97706' }}>{l.maquinas.length ? `${l.maquinas.length} máq.` : 'sem máquinas'}</span>
                                                                                    </button>
                                                                                    {temColunas && <button onClick={() => { setEdit(editando ? null : { id: l.id, sel: l.maquinas.map(m => m.id), novas: '' }); setOpen(prev => new Set(prev).add(lk)); }} title="Montar a linha" style={btnIco(ACCENT)} {...hover}><FaPen size={9} /></button>}
                                                                                    <button onClick={() => remover(l, l.maquinas.length)} title="Remover linha" style={btnIco('#DC2626')} {...hover}><FaTrash size={9} /></button>
                                                                                </div>
                                                                                {la && !editando && (
                                                                                    <div style={{ paddingLeft: '1rem', paddingBottom: '0.2rem' }}>
                                                                                        {l.maquinas.length ? l.maquinas.map(m => linhaMaquina(m, { naLinha: true }))
                                                                                            : <div style={{ fontSize: '0.64rem', color: 'var(--color-text-subtle)', padding: '0.2rem 0' }}>Nenhuma máquina. Use o lápis para montar a linha.</div>}
                                                                                    </div>
                                                                                )}
                                                                                {editando && (
                                                                                    <div style={{ padding: '0.3rem 0 0.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                                                                        {[...l.maquinas, ...soltas].length === 0 && <div style={{ fontSize: '0.64rem', color: 'var(--color-text-subtle)' }}>Nenhuma máquina solta no setor.</div>}
                                                                                        {[...l.maquinas, ...soltas].map(m => {
                                                                                            const on = edit.sel.includes(m.id);
                                                                                            return <Check key={m.id} marcado={on} sub={m.linha_id === l.id ? null : 'solta'}
                                                                                                onClick={() => setEdit(e => ({ ...e, sel: on ? e.sel.filter(x => x !== m.id) : [...e.sel, m.id] }))}>{m.maquina}</Check>;
                                                                                        })}
                                                                                        <input style={{ ...inputSty, fontSize: '0.74rem', padding: '0.4rem 0.55rem' }} value={edit.novas} onChange={e => setEdit(x => ({ ...x, novas: e.target.value }))} placeholder="Máquina nova (vírgula para várias)" />
                                                                                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                                                                                            <button onClick={() => setEdit(null)} style={{ ...btnPrim, background: 'transparent', color: 'var(--color-text-muted)', border: '1px solid var(--border-color-dark)', padding: '0.35rem 0.7rem', fontSize: '0.7rem' }}>Cancelar</button>
                                                                                            <button onClick={() => salvarComposicao(l, l.maquinas)} disabled={saving} style={{ ...btnPrim, padding: '0.35rem 0.8rem', fontSize: '0.7rem', opacity: saving ? 0.6 : 1 }}>Salvar</button>
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                    {s.linhas.length > 0 && s.avulsas.length > 0 && (
                                                                        <div style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--color-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.5px', borderTop: '1px solid var(--border-color-dark)', padding: '0.45rem 0 0.15rem' }}>Máquinas fora de linha</div>
                                                                    )}
                                                                    {s.avulsas.map(m => linhaMaquina(m))}
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
