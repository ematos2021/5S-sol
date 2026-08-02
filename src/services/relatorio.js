import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/*
 * Entrega do relatório da auditoria.
 *
 * No navegador: abre numa aba e baixa o arquivo — comportamento de sempre.
 *
 * No tablet é outra história. Dentro da WebView do Android, `window.open` de
 * uma blob URL não abre nada, o link de download é ignorado e `window.print()`
 * é um no-op silencioso. O botão existiria e não faria nada — pior do que não
 * existir. Então o relatório é gravado como arquivo e entregue à folha de
 * compartilhamento do sistema: dali o auditor manda por WhatsApp ou e-mail na
 * hora, ou abre no Chrome e usa Imprimir → Salvar como PDF.
 */

export const nativo = Capacitor.isNativePlatform();

export async function entregarRelatorio(html, nomeArquivo) {
  const nome = `${nomeArquivo}`.replace(/[^\w.-]+/g, '_').slice(0, 120);
  const arquivo = nome.endsWith('.html') ? nome : `${nome}.html`;

  if (!nativo) {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
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
