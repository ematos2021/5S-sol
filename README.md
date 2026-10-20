# Programa 5S + SOL ☀️

Aplicativo **independente** para auditorias de **5S** integradas ao **Programa SOL**
(Segurança · Organização · Limpeza). Gestão à vista, Índice Solar, plano de ação,
resumo executivo por IA e relatório analítico com fotos.

> Versão de produto — sem marca de cliente, com tela de login.
> Roda no navegador e como **app instalado no tablet do auditor** (APK Android).

## O que tem

- **Programa 5S** — auditorias por Planta → Fábrica → Setor → **Linha/Máquina**, escala de
  maturidade 0–5, radar dos sensos, Índice Solar (nascer do sol), plano de ação,
  **Resumo Executivo por IA** e relatório analítico com anexos fotográficos.
- **Plantas & Áreas** — cadastro da base de áreas (a fonte de tudo).
- **Login** pelo Supabase Auth; a sessão não fica salva no aparelho.

## Como rodar (desenvolvimento)

```powershell
npm.cmd install
copy .env.example .env    # e preencha as duas linhas
npm.cmd run dev           # http://localhost:5180
```

Acesso: login pelo Supabase Auth. Os usuários são criados no painel (Authentication → Users, com "Auto Confirm User") como `nome@5s-sol.app`; na tela entra-se só com `nome`. O app sempre abre no login (a sessão não fica salva no aparelho).

## Configurações

| O quê | Onde |
|---|---|
| **Supabase** (URL + anon key) | `.env` — copie de `.env.example`. Fora do git. |
| **IA (Resumo Executivo)** | Segredo da Edge Function, **no servidor**. Ver abaixo. |
| **Usuários** | `USERS` no topo de `src/App.jsx`. |

### Por que a chave da IA não fica no `.env`

O Vite **embute qualquer variável `VITE_*` no pacote final**. Num app que roda no
navegador — e mais ainda dentro de um APK, que é um zip que qualquer um abre — isso não
esconde nada: a chave sai legível. E chave do Gemini é cobrada por uso.

Por isso a chamada à IA passa por uma **Edge Function do Supabase**, que guarda a chave no
servidor e só aceita números de auditoria (não texto livre, senão viraria um proxy de IA
gratuito para quem tivesse a anon key):

```bash
supabase secrets set GEMINI_API_KEY=AIza...
supabase functions deploy resumo-executivo
```

Enquanto não fizer isso o app funciona inteiro — só o botão de resumo por IA avisa que
está indisponível. Código em `supabase/functions/resumo-executivo/index.ts`.

## Instalar num cliente novo

1. Crie um projeto no [Supabase](https://supabase.com) e rode `database/schema.sql` no SQL Editor.
2. Copie `.env.example` para `.env` e preencha URL + anon key.
3. Crie os usuários em Authentication → Users (`nome@5s-sol.app`, "Auto Confirm User"). O nome exibido fica em `NOMES`, no `src/App.jsx`.
4. `npm run build` → publique `dist/`, e/ou gere o APK.
5. Cadastre a estrutura em **Plantas & Áreas**. Pronto para auditar.

## Gerar o APK

### Caminho A — na nuvem (nada para instalar)

Repositório: **https://github.com/ematos2021/5S-sol** (branch `main`).

1. Cadastre os secrets `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
   (*Settings → Secrets and variables → Actions*).
2. **Actions → "APK Android (5S + SOL)" → Run workflow** → baixe o `.apk` em *Artifacts*.

> Sem chave de assinatura própria, **desinstale o app antigo antes de instalar um novo**:
> cada execução gera uma chave de debug diferente e o Android recusa a instalação por cima.

### Caminho B — na sua máquina

Requer [Android Studio](https://developer.android.com/studio):

```powershell
npm.cmd run apk        # android\app\build\outputs\apk\debug\app-debug.apk
```

### Chave de assinatura

```powershell
cd android
keytool -genkeypair -v -keystore programa5s.jks -alias programa5s -keyalg RSA -keysize 2048 -validity 10000 -storepass "SUA_SENHA" -keypass "SUA_SENHA" -dname "CN=5S SOL, O=5S SOL, C=BR"
```

Crie `android/keystore.properties` com `storeFile=programa5s.jks`, `storePassword`,
`keyAlias=programa5s` e `keyPassword` (ambos no `.gitignore`). Para o Caminho A, cadastre
`ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` e
`ANDROID_KEYSTORE_BASE64`:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$PWD\programa5s.jks")) | Set-Clipboard
```

## O que muda no tablet

- **Relatório**: no navegador abre numa aba e baixa. No APK a WebView ignora `window.open`
  de blob, o download e o `window.print()` — os três em silêncio. Então o relatório é
  gravado em *Documentos* e entregue à folha de compartilhamento: dá para mandar por
  WhatsApp na hora ou abrir no Chrome e usar Imprimir → Salvar como PDF.
- **Sessão lembrada**: o auditor entra uma vez, não a cada vez que abre o app entre áreas.
- **Botão voltar** do Android volta à aba inicial antes de encerrar o app.
- **Fotos**: a permissão `CAMERA` **não é declarada de propósito**. O Capacitor só oferece
  a câmera em `<input type="file" capture>` quando ela não está declarada; se estivesse,
  uma recusa deixaria o auditor sem conseguir fotografar.
- Alvos de toque de 44px, sem zoom por pinça, sem seleção de texto em botões.
- Backup automático desligado e tráfego sem HTTPS bloqueado.

## Segurança — leia antes de vender

**Resolvido:** as chaves saíram do código-fonte (`.env` + segredo de servidor para a IA).

**Resolvido (20/10/2026):** login real pelo Supabase Auth. A anon key sozinha não lê nem grava
nada — as tabelas só abrem para o papel `authenticated` (`database/acesso_login.sql`).
Senhas não ficam mais no código.

**Em aberto:** todo usuário logado lê, altera e apaga tudo (políticas `using (true)` para
`authenticated`). Se um dia houver perfis diferentes, as políticas passam a olhar `auth.uid()`.

## Stack

React 19 · Vite · Supabase · Capacitor 8 · react-icons. Sem backend próprio, exceto a
Edge Function do resumo por IA.
