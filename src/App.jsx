import React, { useState, useEffect, useRef } from 'react';
import { FaBroom, FaSun, FaSitemap, FaSignOutAlt, FaUserCircle, FaLock, FaUser } from 'react-icons/fa';
import Gestao5SView from './pages/Gestao5SView';
import PlantasView from './pages/PlantasView';
import { setUsuario } from './services/usuario';
import { getSessao, setSessao } from './services/sessao';
import { iniciarNativo } from './services/nativo';

const ACCENT = '#22C55E';
const SOL = '#F59E0B';

/* ── Credenciais fictícias ── */
const USERS = [
    { user: 'admin', pass: 'admin123', nome: 'Administrador' },
    { user: 'auditor', pass: 'auditor1', nome: 'Auditor SGI' },
    { user: 'gestor', pass: 'gestor1', nome: 'Gestor 5S' },
];

/* ═══════════════ Tela de Login ═══════════════ */
function LoginScreen({ onLogin }) {
    const [user, setUser] = useState('');
    const [pass, setPass] = useState('');
    const [error, setError] = useState('');
    const [shake, setShake] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        const found = USERS.find(u => u.user === user.trim().toLowerCase() && u.pass === pass);
        if (found) {
            setUsuario(found.nome);
            onLogin(found);
        } else {
            setError('Usuário ou senha inválidos');
            setShake(true);
            setTimeout(() => setShake(false), 500);
        }
    };

    const inputStyle = {
        width: '100%',
        padding: '0.75rem 0.85rem 0.75rem 2.6rem',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 10,
        color: '#fff',
        fontSize: '0.88rem',
        outline: 'none',
        transition: 'border-color 0.25s, box-shadow 0.25s',
    };

    const inputFocusStyle = {
        borderColor: `${ACCENT}88`,
        boxShadow: `0 0 0 3px ${ACCENT}22`,
    };

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `radial-gradient(ellipse at 30% 20%, ${ACCENT}08 0%, transparent 60%),
                         radial-gradient(ellipse at 70% 80%, ${SOL}06 0%, transparent 60%),
                         var(--bg-app)`,
        }}>
            <div style={{
                width: '100%', maxWidth: 400, padding: '2.5rem 2rem',
                background: 'rgba(20, 21, 27, 0.85)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 20,
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                animation: 'fadeInUp 0.5s ease-out',
            }}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <FaBroom size={22} color={ACCENT} />
                        <span style={{ fontSize: '1.3rem', fontWeight: 900, color: '#fff' }}>5S</span>
                        <FaSun size={20} color={SOL} />
                        <span style={{ fontSize: '1.3rem', fontWeight: 900, color: SOL }}>SOL</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', letterSpacing: '0.5px' }}>
                        Sistema de Gestão 5S + SOL
                    </div>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Usuário */}
                    <div style={{ position: 'relative' }}>
                        <FaUser size={13} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-subtle)', pointerEvents: 'none' }} />
                        <input
                            type="text" placeholder="Usuário" value={user}
                            onChange={e => { setUser(e.target.value); setError(''); }}
                            onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                            onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }}
                            style={inputStyle} autoComplete="username"
                        />
                    </div>

                    {/* Senha */}
                    <div style={{ position: 'relative' }}>
                        <FaLock size={13} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-subtle)', pointerEvents: 'none' }} />
                        <input
                            type="password" placeholder="Senha" value={pass}
                            onChange={e => { setPass(e.target.value); setError(''); }}
                            onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                            onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }}
                            style={inputStyle} autoComplete="current-password"
                        />
                    </div>

                    {/* Erro */}
                    {error && (
                        <div style={{
                            fontSize: '0.76rem', color: '#f87171', textAlign: 'center', fontWeight: 600,
                            animation: shake ? 'shakeX 0.4s' : 'none',
                        }}>
                            {error}
                        </div>
                    )}

                    {/* Botão */}
                    <button type="submit" style={{
                        width: '100%', padding: '0.8rem', border: 'none', borderRadius: 10,
                        background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}cc)`,
                        color: '#04210f', fontSize: '0.88rem', fontWeight: 800,
                        cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.25s',
                        boxShadow: `0 4px 20px ${ACCENT}33`,
                        marginTop: '0.3rem',
                    }}
                        onMouseEnter={e => { e.target.style.transform = 'translateY(-1px)'; e.target.style.boxShadow = `0 6px 25px ${ACCENT}55`; }}
                        onMouseLeave={e => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = `0 4px 20px ${ACCENT}33`; }}
                    >
                        Entrar
                    </button>
                </form>

                {/* Credenciais de teste */}
                <div style={{
                    marginTop: '1.6rem', padding: '0.7rem 0.85rem',
                    background: 'rgba(255,255,255,0.03)', borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.05)',
                }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-text-subtle)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.4rem' }}>
                        Credenciais de teste
                    </div>
                    {USERS.map(u => (
                        <div key={u.user} style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                            <span style={{ color: ACCENT, fontWeight: 700 }}>{u.user}</span>
                            <span style={{ color: 'var(--color-text-subtle)', margin: '0 0.3rem' }}>/</span>
                            <span style={{ fontFamily: 'monospace' }}>{u.pass}</span>
                            <span style={{ color: 'var(--color-text-subtle)', fontSize: '0.64rem', marginLeft: '0.4rem' }}>— {u.nome}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/* ═══════════════ App Principal ═══════════════ */
export default function App() {
    // A sessão é lida do aparelho: quem já entrou não precisa logar de novo a
    // cada vez que abre o app entre uma área e outra.
    const [loggedUser, setLoggedUser] = useState(() => getSessao());
    const [tab, setTab] = useState('cinco-s');

    const entrar = (u) => { setSessao(u); setUsuario(u.nome); setLoggedUser(u); };
    const sair = () => { setSessao(null); setLoggedUser(null); };

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

    if (!loggedUser) return <LoginScreen onLogin={entrar} />;

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
            {/* Header limpo — sem repetição */}
            <header style={{ flexShrink: 0, padding: '0.7rem 1.25rem 0', borderBottom: '1px solid var(--border-color-dark)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                    {/* Abas integradas ao header */}
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                        {tabBtn('cinco-s', 'Programa 5S', <FaBroom size={13} />)}
                        {tabBtn('plantas', 'Plantas & Áreas', <FaSitemap size={13} />)}
                    </div>

                    {/* Usuário logado + logout */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                            background: 'var(--bg-surface-glass)', border: '1px solid var(--border-color-dark)',
                            borderRadius: 20, padding: '0.35rem 0.85rem',
                        }}>
                            <FaUserCircle size={14} color={ACCENT} />
                            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                                {loggedUser.nome}
                            </span>
                        </div>
                        <button
                            onClick={sair}
                            title="Sair"
                            style={{
                                display: 'flex', alignItems: 'center', gap: '0.3rem',
                                background: 'transparent', border: '1px solid rgba(248,113,113,0.25)',
                                borderRadius: 8, padding: '0.35rem 0.65rem',
                                color: '#f87171', fontSize: '0.72rem', fontWeight: 700,
                                cursor: 'pointer', transition: 'background 0.2s',
                            }}
                            onMouseEnter={e => e.target.style.background = 'rgba(248,113,113,0.08)'}
                            onMouseLeave={e => e.target.style.background = 'transparent'}
                        >
                            <FaSignOutAlt size={12} /> Sair
                        </button>
                    </div>
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
