/*
 * Ponte com o tablet. No navegador tudo aqui é no-op, então o mesmo código
 * roda em http://localhost:5180 e dentro do APK.
 */
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

export const nativo = Capacitor.isNativePlatform();
export const plataforma = Capacitor.getPlatform();

if (nativo) document.documentElement.classList.add('app-nativo', `app-${plataforma}`);

/*
 * Pilha de camadas fecháveis. Sem isto, "voltar" no meio de uma auditoria
 * fecharia o app e o auditor perderia o caminho até ali — num formulário de
 * 5 sensos isso é inaceitável.
 */
const pilha = [];
export function aoVoltar(fn) {
    pilha.push(fn);
    return () => { const i = pilha.lastIndexOf(fn); if (i >= 0) pilha.splice(i, 1); };
}

export function iniciarNativo({ aoVoltarRaiz } = {}) {
    if (!nativo) return () => {};
    const inscricoes = [];

    (async () => {
        try {
            await StatusBar.setStyle({ style: Style.Dark });   // ícones claros sobre o fundo escuro
            if (plataforma === 'android') {
                await StatusBar.setOverlaysWebView({ overlay: false });
                await StatusBar.setBackgroundColor({ color: '#0f1014' });
            }
        } catch { /* aparelho sem barra configurável */ }
        try { await SplashScreen.hide(); } catch { /* já escondida */ }
    })();

    CapApp.addListener('backButton', () => {
        const topo = pilha[pilha.length - 1];
        if (topo) { topo(); return; }
        if (aoVoltarRaiz && aoVoltarRaiz()) return;
        CapApp.exitApp();
    }).then(h => inscricoes.push(h)).catch(() => {});

    return () => inscricoes.forEach(h => h.remove?.());
}
