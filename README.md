# Programa 5S + SOL ☀️

Aplicativo **independente** para auditorias de **5S** integradas ao **Programa SOL** (Segurança · Organização · Limpeza). Gestão à vista, Índice Solar, plano de ação, resumo por IA e relatórios prontos para impressão. *"O sol vai nascer na Mondial."*

> App autônomo (não depende de nenhum outro sistema). Sem login — abre direto.
> Roda no navegador e como **app instalado no tablet do auditor** (APK Android).

## O que tem

- **Programa 5S** — auditorias por Planta → Fábrica → Setor → **Linha/Máquina**, com escala de maturidade 0–5, radar dos sensos, Índice Solar (nascer do sol), plano de ação, **Resumo Executivo por IA** e relatório analítico com fotos.
- **Plantas & Áreas** — cadastro da base de áreas (a fonte de tudo). Monte a estrutura Planta → Fábrica → Setor → Linha/Máquina.

## Como rodar (desenvolvimento)

```powershell
npm.cmd install
copy .env.example .env    # e preencha as duas linhas
npm.cmd run dev           # http://localhost:5180
```

## Configurações

| O quê | Onde |
|---|---|
| **Supabase** (URL + anon key) | `.env` — copie de `.env.example`. Fora do git. |
| **IA (Resumo Executivo)** | Segredo da Edge Function, **no servidor**. Ver abaixo. |
| **Avaliador** | Definido no topo do app, salvo no aparelho. |

### Por que a chave da IA não fica no `.env`

O Vite **embute qualquer variável `VITE_*` no pacote final**. Num app que roda no
navegador — e mais ainda dentro de um APK, que é um zip que qualquer um abre — isso
não esconde nada: a chave sai legível. E chave do Gemini é cobrada por uso.

Por isso a chamada à IA passa por uma **Edge Function do Supabase**, que guarda a chave
no servidor e só aceita números de auditoria (não texto livre, senão viraria um proxy
de IA gratuito para quem tivesse a anon key):

```bash
supabase secrets set GEMINI_API_KEY=AIza...
supabase functions deploy resumo-executivo
```

Enquanto não fizer isso, **o app funciona normalmente** — só o botão de resumo por IA
avisa que está indisponível. Código em `supabase/functions/resumo-executivo/index.ts`.

## Como instalar num cliente novo

1. Crie um projeto no [Supabase](https://supabase.com).
2. No **SQL Editor**, rode `database/schema.sql`.
3. Copie `.env.example` para `.env` e preencha URL + anon key.
4. `npm install && npm run build` → publique `dist/` em qualquer hospedagem estática,
   e/ou gere o APK (abaixo).
5. Abra o app, vá em **Plantas & Áreas** e cadastre a estrutura. Pronto para auditar.

## Gerar o APK

### Caminho A — na nuvem (nada para instalar)

1. Suba o projeto para um repositório no GitHub.
2. Cadastre os secrets `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
   (*Settings → Secrets and variables → Actions*).
3. **Actions → "APK Android (5S + SOL)" → Run workflow** → baixe o `.apk` em *Artifacts*.

### Caminho B — na sua máquina

Requer [Android Studio](https://developer.android.com/studio) (traz JDK e SDK):

```powershell
npm.cmd run apk        # android\app\build\outputs\apk\debug\app-debug.apk
```

### Chave de assinatura

Sem chave própria o APK é assinado com a de debug: instala e roda, mas **não aceita
atualização por cima** — é preciso desinstalar antes de cada versão nova.

```powershell
cd android
keytool -genkeypair -v -keystore programa5s.jks -alias programa5s -keyalg RSA -keysize 2048 -validity 10000 -storepass "SUA_SENHA" -keypass "SUA_SENHA" -dname "CN=Mondial 5S, O=Mondial, C=BR"
```

Crie `android/keystore.properties` com `storeFile=programa5s.jks`, `storePassword`,
`keyAlias=programa5s` e `keyPassword` (ambos no `.gitignore`). Para o Caminho A,
cadastre `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` e
`ANDROID_KEYSTORE_BASE64`:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$PWD\programa5s.jks")) | Set-Clipboard
```

## O que muda no tablet

- **Relatório**: no navegador abre numa aba e baixa. No APK, a WebView ignora
  `window.open` de blob, o download e o `window.print()` — os três em silêncio. Então o
  relatório é gravado em *Documentos* e entregue à folha de compartilhamento: dá para
  mandar por WhatsApp na hora, ou abrir no Chrome e usar Imprimir → Salvar como PDF.
- **Botão voltar** do Android volta à aba inicial antes de encerrar o app.
- **Fotos**: a permissão `CAMERA` **não é declarada de propósito**. O Capacitor só
  oferece a câmera em `<input type="file" capture>` quando ela não está declarada; se
  estivesse, uma recusa do usuário deixaria o auditor sem conseguir fotografar.
- **Backup automático desligado** e tráfego sem HTTPS bloqueado.

## Segurança — o que já está resolvido e o que não está

**Resolvido:** as chaves saíram do código-fonte (`.env` + segredo de servidor para a IA).

**Em aberto, e você precisa decidir:** o `database/schema.sql` habilita RLS mas com
políticas `using (true) with check (true)` — ou seja, **qualquer pessoa com a anon key
pode ler, alterar e apagar todas as auditorias e áreas**. Isso é coerente com o app não
ter login, mas é um risco real com dados de cliente. Não mudei sozinho porque endurecer
a política pode quebrar o app em produção. Dois caminhos:

- **Login por e-mail** (Supabase Auth) e políticas exigindo `auth.uid()`;
- **manter sem login** e restringir ao menos o `DELETE`, deixando o app só criar e editar.

## Stack

React 19 · Vite · Supabase · Capacitor 8 · react-icons. Sem backend próprio, exceto a
Edge Function do resumo por IA.
