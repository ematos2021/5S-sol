// Identidade do avaliador — sem login. O nome fica salvo no navegador
// (localStorage) e é usado como auditor padrão nas auditorias.
const KEY = 'p5s_usuario';

export function getUsuario() {
    try { return localStorage.getItem(KEY) || 'Auditor'; } catch { return 'Auditor'; }
}

export function setUsuario(nome) {
    try { localStorage.setItem(KEY, (nome || '').trim() || 'Auditor'); } catch { /* noop */ }
}
