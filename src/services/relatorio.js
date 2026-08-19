import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/*
 * Entrega do relatório da auditoria como ARQUIVO. Quem exibe o relatório na tela
 * é o RelatorioViewer (iframe), que funciona em qualquer aparelho — aqui só se
 * cuida de salvar/compartilhar, sempre a partir de um toque do usuário.
 *
 * No navegador: baixa o arquivo. Não se usa mais `window.open`: no tablet a aba
 * nova é barrada como popup e a blob URL não abre, então o botão não fazia nada
 * e nem erro dava. Como o relatório já está visível no viewer, a aba era supérflua.
 *
 * No tablet com o app nativo: grava em Documents e chama a folha de
 * compartilhamento do sistema — dali o auditor manda por WhatsApp ou e-mail na
 * hora, ou abre no Chrome e usa Imprimir → Salvar como PDF.
 */

export const nativo = Capacitor.isNativePlatform();

export async function entregarRelatorio(html, nomeArquivo) {
  const nome = `${nomeArquivo}`.replace(/[^\w.-]+/g, '_').slice(0, 120);
  const arquivo = nome.endsWith('.html') ? nome : `${nome}.html`;

  if (!nativo) {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = arquivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return { modo: 'navegador' };
  }

  // Documents em vez de Cache: o auditor pode querer reabrir o relatório
  // depois, pelo gerenciador de arquivos, sem depender do app.
  await Filesystem.writeFile({
    path: arquivo, data: html, directory: Directory.Documents,
    encoding: Encoding.UTF8, recursive: true,
  });
  const { uri } = await Filesystem.getUri({ path: arquivo, directory: Directory.Documents });

  await Share.share({
    title: 'Relatório 5S + SOL',
    text: 'Relatório da auditoria 5S + Programa SOL.',
    files: [uri],
    dialogTitle: 'Enviar relatório',
  });

  return { modo: 'compartilhado', uri };
}
