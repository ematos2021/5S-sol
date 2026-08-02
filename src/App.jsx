import React, { useState, useEffect, useRef } from 'react';
import { FaBroom, FaSun, FaSitemap, FaUserEdit } from 'react-icons/fa';
import Gestao5SView from './pages/Gestao5SView';
import PlantasView from './pages/PlantasView';
import { getUsuario, setUsuario } from './services/usuario';
import { iniciarNativo } from './services/nativo';

const ACCENT = '#22C55E';
const SOL = '#F59E0B';

export default function App() {
    const [tab, setTab] = useState('cinco-s');
    const [nome, setNome] = useState(getUsuario());
    const [editNome, setEditNome] = useState(false);

    const salvarNome = () => { setUsuario(nome); setNome(getUsuario()); setEditNome(false); };

    // App instalado: barra de status, splash e botão "voltar" do Android.
    // Espelhamos a aba num ref porque o callback nativo é registrado uma vez só
    // e não enxergaria as atualizações de estado por closure.
    const abaRef = useRef(tab);
    abaRef.current = tab;
    useEffect(() => iniciarNativo({
        aoVoltarRaiz: () => {
            if (abaRef.current !== 'cinco-s') { setTab('cinco-s'); return true; }
            return false;   // já na aba inicial: o "voltar" fecha o app
        },
    }), []);

    const tabBtn = (id, label, icon) => (
        <button onClick={() => setTab(id)} style={{
            display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.5rem 1rem', border: 'none',
            borderBottom: `2px solid ${tab === id ? ACCENT : 'transparent'}`, background: 'transparent',
            color: tab === id ? ACCENT : 'var(--color-text-muted)', fontSize: '0.82rem',
            fontWeight: tab === id ? 800 : 600, cursor: 'pointer', whiteSpace: 'nowrap',
        }}>{icon} {label}</button>
    );

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* Barra de topo */}
            <header style={{ flexShrink: 0, padding: '0.9rem 1.25rem 0', borderBottom: '1px solid var(--border-color-dark)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                    <div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--color-text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <FaBroom color={ACCENT} /> Programa 5S <FaSun color={SOL} /> <span style={{ color: SOL }}>SOL</span>
                            <span style={{ fontSize: '0.56rem', fontWeight: 800, letterSpacing: '1px', color: SOL, background: `${SOL}18`, padding: '0.15rem 0.55rem', borderRadius: 5 }}>MONDIAL</span>
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginTop: 2 }}>Segurança · Organização · Limpeza — “O sol vai nascer na Mondial”</div>
                    </div>
                    {/* Identificação do avaliador (sem login) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {editNome ? (
                            <>
                                <input autoFocus value={nome} onChange={e => setNome(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') salvarNome(); }}
                                    style={{ background: 'var(--bg-surface-glass)', border: '1px solid var(--border-color-dark)', borderRadius: 8, color: 'var(--color-text-main)', fontSize: '0.78rem', padding: '0.4rem 0.6rem', outline: 'none' }} placeholder="Seu nome" />
                                <button onClick={salvarNome} style={{ background: ACCENT, color: '#04210f', border: 'none', borderRadius: 8, padding: '0.4rem 0.8rem', fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer' }}>OK</button>
                            </>
                        ) : (
                            <button onClick={() => setEditNome(true)} title="Definir quem está avaliando" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--bg-surface-glass)', border: '1px solid var(--border-color-dark)', borderRadius: 20, padding: '0.35rem 0.85rem', color: 'var(--color-text-main)', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}>
                                <FaUserEdit size={12} color={ACCENT} /> {nome}
                            </button>
                        )}
                    </div>
                </div>
                {/* Abas */}
                <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.6rem' }}>
                    {tabBtn('cinco-s', 'Programa 5S', <FaBroom size={12} />)}
                    {tabBtn('plantas', 'Plantas & Áreas', <FaSitemap size={12} />)}
                </div>
            </header>

            {/* Conteúdo */}
            <main style={{ flex: 1, minHeight: 0, padding: tab === 'plantas' ? '1.25rem' : 0 }}>
                {tab === 'cinco-s' && <Gestao5SView />}
                {tab === 'plantas' && <PlantasView />}
            </main>
        </div>
    );
}
