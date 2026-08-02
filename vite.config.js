import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    server: { port: 5180 },
    build: {
        // Dentro do APK quem executa é a WebView do tablet, que num aparelho de
        // chão de fábrica costuma ser antiga. Sintaxe nova demais não dá erro de
        // execução: o pacote inteiro falha ao ser interpretado e a tela fica
        // preta, sem pista nenhuma. es2017 é transpilado pelo esbuild.
        target: 'es2017',
    },
});
