/*
 * Sessão do app.
 *
 * O login vivia só na memória: fechou o app, logou de novo. No navegador isso
 * já incomoda; num tablet de auditoria, onde a pessoa entra e sai do app o dia
 * inteiro entre uma área e outra, é atrito diário. Fica guardado no aparelho.
 *
 * Aviso honesto: isto lembra quem entrou, não protege dado nenhum. As
 * credenciais estão no próprio pacote do app (ver USERS em App.jsx) e o banco
 * hoje aceita qualquer um com a anon key — ver a seção de segurança do README.
 * É uma portaria, não um cofre.
 */
const KEY = 'p5s_sessao';

export function getSessao() {
    try {
        const bruto = localStorage.getItem(KEY);
        return bruto ? JSON.parse(bruto) : null;
    } catch { return null; }
}

export function setSessao(usuario) {
    try {
        if (usuario) localStorage.setItem(KEY, JSON.stringify({ user: usuario.user, nome: usuario.nome }));
        else localStorage.removeItem(KEY);
    } catch { /* modo privado / cota cheia: segue sem lembrar */ }
}
