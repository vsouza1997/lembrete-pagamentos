# Lembrete de Pagamentos (WhatsApp) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Site instalável no celular (PWA) onde a esposa do Victor vê quem vence hoje e quem está atrasada, abre o WhatsApp com a mensagem pronta (toque em enviar) e marca quem já pagou.

**Architecture:** Front-end estático em JavaScript puro (ES modules, sem build) hospedado no Firebase Hosting, com login Google (Firebase Auth) e dados no Firestore. A lógica de negócio fica em módulos puros em `public/js/core/` (testados com `node --test`); o envio fica atrás de uma interface `Sender` para permitir um envio automático no futuro.

**Tech Stack:** JavaScript ES modules, Node 18+ (`node --test`, só para testes), Firebase Hosting + Auth + Firestore (SDK 10.14.1 via CDN `www.gstatic.com`), Python 3 (só para gerar os ícones).

## Global Constraints

- Todo texto de interface em português do Brasil.
- "Hoje" sempre no fuso `America/Sao_Paulo`.
- Telefone armazenado só com dígitos no formato `55DDDNÚMERO` (ex.: `5511912345678`).
- Vencimento efetivo no mês = `min(diaVencimento, último dia do mês)`.
- Vence hoje: aluna ativa, vencimento efetivo == hoje, sem pagamento no mês corrente. Atrasada: aluna ativa, vencimento efetivo < hoje, sem pagamento no mês corrente. Atrasos de meses anteriores não entram.
- Dados no Firestore: `alunas/{id}` = `nome`, `telefone`, `diaVencimento` (1–31), `valor` (número ou `null`), `ativa` (bool); `pagamentos/{alunaId}_{AAAA-MM}` = `alunaId`, `mes` ("AAAA-MM"), `pagoEm`; `config/mensagem` = `texto`.
- Regras do Firestore: somente o e-mail da esposa (verificado) lê e escreve.
- Sem framework de UI e sem build. Nenhum dado de aluna no código ou no git.
- Fora do escopo: envio automático (só deixar a interface `Sender`).

## File Structure

```
package.json
.gitignore
firebase.json
firestore.rules
scripts/gerar-icones.py
public/index.html
public/styles.css
public/manifest.webmanifest
public/sw.js
public/icons/icon-192.png, icon-512.png        (gerados)
public/js/app.js                               login, abas, registro do service worker
public/js/firebase-config.js                   config web do projeto Firebase
public/js/firebase.js                          init + re-exports do SDK (única fonte da versão)
public/js/core/vencimentos.js                  datas e listas do dia (puro)
public/js/core/telefone.js                     normalização de telefone (puro)
public/js/core/aluna.js                        validação do cadastro (puro)
public/js/core/mensagem.js                     modelo de mensagem e link wa.me (puro)
public/js/core/sender.js                       interface Sender + WaMeSender
public/js/data/alunas.js, pagamentos.js, config.js   acesso ao Firestore
public/js/ui/dom.js, hoje.js, alunas.js, mensagem.js telas
tests/vencimentos.test.js, telefone.test.js, aluna.test.js, mensagem.test.js, sender.test.js
```

---

### Task 1: Núcleo de vencimentos

**Files:**
- Create: `package.json`, `.gitignore`
- Create: `public/js/core/vencimentos.js`
- Test: `tests/vencimentos.test.js`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `ultimoDiaDoMes(ano: number, mes: number /*1-12*/): number`
  - `vencimentoEfetivo(diaVencimento: number, ano: number, mes: number): number`
  - `hojeEmSaoPaulo(agora?: Date): { ano: number, mes: number, dia: number }`
  - `chaveDoMes({ ano, mes }): string` ("AAAA-MM")
  - `listasDoDia(alunas: Aluna[], pagamentos: {alunaId, mes}[], hoje): { venceHoje: Item[], atrasadas: Item[], pagas: Item[] }` onde `Item = { aluna, diaEfetivo: number }` e `Aluna = { id, nome, telefone, diaVencimento, valor, ativa }`.

- [ ] **Step 1: Criar `package.json` e `.gitignore`**

`package.json`:
```json
{
  "name": "lembrete-pagamentos",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
```

`.gitignore`:
```
node_modules/
.firebase/
firebase-debug.log
```

- [ ] **Step 2: Escrever os testes que falham**

`tests/vencimentos.test.js`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ultimoDiaDoMes,
  vencimentoEfetivo,
  hojeEmSaoPaulo,
  chaveDoMes,
  listasDoDia,
} from '../public/js/core/vencimentos.js';

test('ultimoDiaDoMes cobre fevereiro, bissexto, 30 e 31 dias', () => {
  assert.equal(ultimoDiaDoMes(2025, 2), 28);
  assert.equal(ultimoDiaDoMes(2024, 2), 29);
  assert.equal(ultimoDiaDoMes(2025, 4), 30);
  assert.equal(ultimoDiaDoMes(2025, 12), 31);
});

test('vencimentoEfetivo limita ao último dia do mês', () => {
  assert.equal(vencimentoEfetivo(31, 2025, 2), 28);
  assert.equal(vencimentoEfetivo(30, 2024, 2), 29);
  assert.equal(vencimentoEfetivo(15, 2025, 2), 15);
  assert.equal(vencimentoEfetivo(31, 2025, 4), 30);
});

test('hojeEmSaoPaulo usa o fuso de São Paulo na virada do dia', () => {
  // 02:00 UTC de 1/mar = 23:00 de 28/fev em São Paulo
  assert.deepEqual(hojeEmSaoPaulo(new Date('2025-03-01T02:00:00Z')), { ano: 2025, mes: 2, dia: 28 });
  // 03:00 UTC de 1/mar = 00:00 de 1/mar em São Paulo
  assert.deepEqual(hojeEmSaoPaulo(new Date('2025-03-01T03:00:00Z')), { ano: 2025, mes: 3, dia: 1 });
});

test('chaveDoMes formata AAAA-MM', () => {
  assert.equal(chaveDoMes({ ano: 2025, mes: 3, dia: 9 }), '2025-03');
  assert.equal(chaveDoMes({ ano: 2025, mes: 11, dia: 9 }), '2025-11');
});

const aluna = (id, nome, diaVencimento, extra = {}) => ({
  id, nome, telefone: '5511912345678', diaVencimento, valor: null, ativa: true, ...extra,
});

test('listasDoDia separa vence hoje, atrasadas e pagas', () => {
  const hoje = { ano: 2025, mes: 3, dia: 10 };
  const alunas = [
    aluna('a', 'Bia', 10),
    aluna('b', 'Ana', 10),
    aluna('c', 'Carla', 5),
    aluna('d', 'Dani', 2),
    aluna('e', 'Eva', 20),
    aluna('f', 'Fabi', 10),
  ];
  const pagamentos = [{ alunaId: 'f', mes: '2025-03' }];
  const r = listasDoDia(alunas, pagamentos, hoje);
  assert.deepEqual(r.venceHoje.map((i) => i.aluna.nome), ['Ana', 'Bia']);
  assert.deepEqual(r.atrasadas.map((i) => i.aluna.nome), ['Dani', 'Carla']); // mais antigo primeiro
  assert.deepEqual(r.pagas.map((i) => i.aluna.nome), ['Fabi']);
  assert.equal(r.atrasadas[0].diaEfetivo, 2);
});

test('listasDoDia ignora inativas e pagamentos de outro mês', () => {
  const hoje = { ano: 2025, mes: 3, dia: 10 };
  const alunas = [aluna('a', 'Ana', 10, { ativa: false }), aluna('b', 'Bia', 10)];
  const pagamentos = [{ alunaId: 'b', mes: '2025-02' }];
  const r = listasDoDia(alunas, pagamentos, hoje);
  assert.deepEqual(r.venceHoje.map((i) => i.aluna.nome), ['Bia']);
  assert.equal(r.pagas.length, 0);
});

test('listasDoDia trata dia 31 em fevereiro', () => {
  const alunas = [aluna('a', 'Ana', 31)];
  assert.equal(listasDoDia(alunas, [], { ano: 2025, mes: 2, dia: 27 }).venceHoje.length, 0);
  assert.equal(listasDoDia(alunas, [], { ano: 2025, mes: 2, dia: 28 }).venceHoje.length, 1);
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL com "Cannot find module .../vencimentos.js".

- [ ] **Step 4: Implementar**

`public/js/core/vencimentos.js`:
```js
const FUSO = 'America/Sao_Paulo';

export function ultimoDiaDoMes(ano, mes) {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

export function vencimentoEfetivo(diaVencimento, ano, mes) {
  return Math.min(diaVencimento, ultimoDiaDoMes(ano, mes));
}

export function hojeEmSaoPaulo(agora = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(agora);
  const pega = (tipo) => Number(partes.find((p) => p.type === tipo).value);
  return { ano: pega('year'), mes: pega('month'), dia: pega('day') };
}

export function chaveDoMes({ ano, mes }) {
  return `${ano}-${String(mes).padStart(2, '0')}`;
}

export function listasDoDia(alunas, pagamentos, hoje) {
  const chave = chaveDoMes(hoje);
  const pagas = new Set(pagamentos.filter((p) => p.mes === chave).map((p) => p.alunaId));
  const resultado = { venceHoje: [], atrasadas: [], pagas: [] };

  for (const aluna of alunas.filter((a) => a.ativa)) {
    const diaEfetivo = vencimentoEfetivo(aluna.diaVencimento, hoje.ano, hoje.mes);
    const item = { aluna, diaEfetivo };
    if (pagas.has(aluna.id)) resultado.pagas.push(item);
    else if (diaEfetivo === hoje.dia) resultado.venceHoje.push(item);
    else if (diaEfetivo < hoje.dia) resultado.atrasadas.push(item);
  }

  const porNome = (a, b) => a.aluna.nome.localeCompare(b.aluna.nome, 'pt-BR');
  resultado.venceHoje.sort(porNome);
  resultado.pagas.sort(porNome);
  resultado.atrasadas.sort((a, b) => a.diaEfetivo - b.diaEfetivo || porNome(a, b));
  return resultado;
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npm test`
Expected: PASS, 7 testes.

- [ ] **Step 6: Commit**

```bash
git add package.json .gitignore public/js/core/vencimentos.js tests/vencimentos.test.js
git commit -m "feat: núcleo de vencimentos (vence hoje, atrasadas, pagas)"
```

---

### Task 2: Telefone e validação do cadastro

**Files:**
- Create: `public/js/core/telefone.js`, `public/js/core/aluna.js`
- Test: `tests/telefone.test.js`, `tests/aluna.test.js`

**Interfaces:**
- Consumes: nada de tarefas anteriores.
- Produces:
  - `normalizarTelefone(entrada: string | null): string | null` — devolve `55DDDNÚMERO` ou `null` se inválido.
  - `validarAluna({ nome, telefone, dia, valor }): { ok: boolean, erros: { nome?, telefone?, dia?, valor? }, aluna: { nome, telefone, diaVencimento, valor } }` (`valor` é número ou `null`; `ativa` e `id` NÃO vêm daqui).

- [ ] **Step 1: Escrever os testes que falham**

`tests/telefone.test.js`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarTelefone } from '../public/js/core/telefone.js';

test('aceita celular com máscara, com e sem +55', () => {
  assert.equal(normalizarTelefone('(11) 91234-5678'), '5511912345678');
  assert.equal(normalizarTelefone('+55 11 91234-5678'), '5511912345678');
  assert.equal(normalizarTelefone('5511912345678'), '5511912345678');
});

test('aceita número de 10 dígitos (sem o 9)', () => {
  assert.equal(normalizarTelefone('11 1234-5678'), '551112345678');
});

test('DDD 55 não é confundido com o código do país', () => {
  assert.equal(normalizarTelefone('(55) 99123-4567'), '5555991234567');
});

test('rejeita inválidos', () => {
  assert.equal(normalizarTelefone('11 81234-5678'), null); // 11 dígitos sem o 9
  assert.equal(normalizarTelefone('123'), null);
  assert.equal(normalizarTelefone(''), null);
  assert.equal(normalizarTelefone(null), null);
  assert.equal(normalizarTelefone('(01) 91234-5678'), null); // DDD começando com 0
});
```

`tests/aluna.test.js`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { validarAluna } from '../public/js/core/aluna.js';

const base = { nome: 'Maria Souza', telefone: '(11) 91234-5678', dia: '10', valor: '150,50' };

test('cadastro válido normaliza os campos', () => {
  const r = validarAluna(base);
  assert.equal(r.ok, true);
  assert.deepEqual(r.aluna, {
    nome: 'Maria Souza',
    telefone: '5511912345678',
    diaVencimento: 10,
    valor: 150.5,
  });
});

test('valor vazio vira null', () => {
  assert.equal(validarAluna({ ...base, valor: '' }).aluna.valor, null);
});

test('cada campo inválido gera seu erro', () => {
  const r = validarAluna({ nome: '  ', telefone: '123', dia: '32', valor: 'abc' });
  assert.equal(r.ok, false);
  assert.deepEqual(Object.keys(r.erros).sort(), ['dia', 'nome', 'telefone', 'valor']);
});

test('dia precisa ser inteiro de 1 a 31', () => {
  for (const dia of ['0', '32', '5.5', '', 'x']) {
    assert.ok(validarAluna({ ...base, dia }).erros.dia, `dia ${dia} deveria ser inválido`);
  }
  assert.equal(validarAluna({ ...base, dia: '31' }).ok, true);
});

test('valor negativo é inválido', () => {
  assert.ok(validarAluna({ ...base, valor: '-5' }).erros.valor);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL com "Cannot find module" para `telefone.js` e `aluna.js`.

- [ ] **Step 3: Implementar**

`public/js/core/telefone.js`:
```js
export function normalizarTelefone(entrada) {
  const digitos = String(entrada ?? '').replace(/\D/g, '');
  // Números nacionais têm no máximo 11 dígitos, então 12+ só pode vir com o 55.
  const nacional = digitos.length >= 12 && digitos.startsWith('55') ? digitos.slice(2) : digitos;
  if (nacional.length !== 10 && nacional.length !== 11) return null;
  if (!/^[1-9]\d/.test(nacional)) return null; // DDD não começa com 0
  if (nacional.length === 11 && nacional[2] !== '9') return null; // celular de 11 dígitos começa com 9
  return `55${nacional}`;
}
```

`public/js/core/aluna.js`:
```js
import { normalizarTelefone } from './telefone.js';

export function validarAluna({ nome, telefone, dia, valor }) {
  const erros = {};

  const nomeLimpo = String(nome ?? '').trim();
  if (!nomeLimpo) erros.nome = 'Informe o nome.';

  const telefoneNormalizado = normalizarTelefone(telefone);
  if (!telefoneNormalizado) erros.telefone = 'Telefone inválido. Use DDD + número.';

  const diaNumero = Number(dia);
  if (!Number.isInteger(diaNumero) || diaNumero < 1 || diaNumero > 31) {
    erros.dia = 'Use um dia entre 1 e 31.';
  }

  let valorNumero = null;
  const valorTexto = String(valor ?? '').trim();
  if (valorTexto !== '') {
    valorNumero = Number(valorTexto.replace(',', '.'));
    if (Number.isNaN(valorNumero) || valorNumero < 0) {
      erros.valor = 'Valor inválido. Use só números, ex.: 150 ou 150,50.';
      valorNumero = null;
    }
  }

  return {
    ok: Object.keys(erros).length === 0,
    erros,
    aluna: {
      nome: nomeLimpo,
      telefone: telefoneNormalizado,
      diaVencimento: diaNumero,
      valor: valorNumero,
    },
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS (todos os testes das Tasks 1 e 2).

- [ ] **Step 5: Commit**

```bash
git add public/js/core/telefone.js public/js/core/aluna.js tests/telefone.test.js tests/aluna.test.js
git commit -m "feat: normalização de telefone e validação do cadastro de alunas"
```

---

### Task 3: Mensagem e Sender

**Files:**
- Create: `public/js/core/mensagem.js`, `public/js/core/sender.js`
- Test: `tests/mensagem.test.js`, `tests/sender.test.js`

**Interfaces:**
- Consumes: nada de tarefas anteriores.
- Produces:
  - `MENSAGEM_PADRAO: string`
  - `formatarValor(valor: number | null): string` ("R$ 150,00" ou `''`)
  - `renderMensagem(modelo: string, aluna: { nome, valor }, diaEfetivo: number): string` (variáveis `{nome}` = primeiro nome, `{valor}`, `{dia}`)
  - `linkWhatsapp(telefone: string, mensagem: string): string`
  - `class WaMeSender { constructor(abrir?: (url) => void); enviar(aluna: { telefone }, mensagem: string): Promise<void> }` — contrato `Sender`: qualquer objeto com `enviar(aluna, mensagem)`.

- [ ] **Step 1: Escrever os testes que falham**

`tests/mensagem.test.js`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { MENSAGEM_PADRAO, formatarValor, renderMensagem, linkWhatsapp } from '../public/js/core/mensagem.js';

test('formatarValor em reais', () => {
  assert.equal(formatarValor(150), 'R$ 150,00');
  assert.equal(formatarValor(1500.5), 'R$ 1.500,50');
  assert.equal(formatarValor(null), '');
  assert.equal(formatarValor(undefined), '');
});

test('renderMensagem troca as variáveis e usa o primeiro nome', () => {
  const aluna = { nome: 'Maria Silva', valor: 150 };
  assert.equal(
    renderMensagem('Oi {nome}, vence dia {dia}. Valor {valor}', aluna, 5),
    'Oi Maria, vence dia 5. Valor R$ 150,00',
  );
});

test('renderMensagem deixa o valor vazio quando não há valor', () => {
  assert.equal(renderMensagem('Valor: {valor}.', { nome: 'Ana', valor: null }, 5), 'Valor: .');
});

test('a mensagem padrão usa nome e dia', () => {
  const texto = renderMensagem(MENSAGEM_PADRAO, { nome: 'Ana Lima', valor: null }, 10);
  assert.match(texto, /^Oi Ana!/);
  assert.match(texto, /dia 10/);
});

test('linkWhatsapp codifica acentos e emoji', () => {
  assert.equal(
    linkWhatsapp('5511912345678', 'Oi Ana! 💛'),
    'https://wa.me/5511912345678?text=Oi%20Ana!%20%F0%9F%92%9B',
  );
});
```

`tests/sender.test.js`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { WaMeSender } from '../public/js/core/sender.js';

test('WaMeSender abre o link do WhatsApp da aluna', async () => {
  const abertos = [];
  const sender = new WaMeSender((url) => abertos.push(url));
  await sender.enviar({ telefone: '5511912345678' }, 'Oi');
  assert.deepEqual(abertos, ['https://wa.me/5511912345678?text=Oi']);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL com "Cannot find module" para `mensagem.js` e `sender.js`.

- [ ] **Step 3: Implementar**

`public/js/core/mensagem.js`:
```js
export const MENSAGEM_PADRAO =
  'Oi {nome}! Passando para lembrar que a mensalidade vence dia {dia} 💛';

export function formatarValor(valor) {
  if (valor === null || valor === undefined || valor === '') return '';
  return Number(valor)
    .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    .replace(/ /g, ' ');
}

export function renderMensagem(modelo, aluna, diaEfetivo) {
  const variaveis = {
    nome: aluna.nome.trim().split(/\s+/)[0],
    valor: formatarValor(aluna.valor),
    dia: String(diaEfetivo),
  };
  return modelo.replace(/\{(nome|valor|dia)\}/g, (_, chave) => variaveis[chave]);
}

export function linkWhatsapp(telefone, mensagem) {
  return `https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`;
}
```

`public/js/core/sender.js`:
```js
import { linkWhatsapp } from './mensagem.js';

// Contrato Sender: objeto com `enviar(aluna, mensagem): Promise<void>`.
// Um futuro ApiSender (WhatsApp Business API) implementa o mesmo contrato.
export class WaMeSender {
  constructor(abrir = (url) => window.open(url, '_blank', 'noopener')) {
    this.abrir = abrir;
  }

  async enviar(aluna, mensagem) {
    this.abrir(linkWhatsapp(aluna.telefone, mensagem));
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS (todos os testes das Tasks 1 a 3).

- [ ] **Step 5: Commit**

```bash
git add public/js/core/mensagem.js public/js/core/sender.js tests/mensagem.test.js tests/sender.test.js
git commit -m "feat: modelo de mensagem, link wa.me e WaMeSender"
```

---

### Task 4: Firebase (projeto, regras e camada de dados)

**Files:**
- Create: `firebase.json`, `firestore.rules`
- Create: `public/js/firebase-config.js`, `public/js/firebase.js`
- Create: `public/js/data/alunas.js`, `public/js/data/pagamentos.js`, `public/js/data/config.js`

**Interfaces:**
- Consumes: `MENSAGEM_PADRAO` de `core/mensagem.js`.
- Produces:
  - `firebase.js`: `db`, `auth`, `observarLogin(cb: (usuario|null) => void)`, `entrarComGoogle()`, `sair()` e re-exports do Firestore (`collection, doc, getDoc, getDocs, addDoc, setDoc, deleteDoc, query, where, serverTimestamp`).
  - `data/alunas.js`: `listarAlunas(db): Promise<Aluna[]>`, `salvarAluna(db, aluna: {id?, nome, telefone, diaVencimento, valor, ativa}): Promise<string>` (devolve o id).
  - `data/pagamentos.js`: `idDoPagamento(alunaId, mes): string`, `listarPagamentosDoMes(db, mes): Promise<{id, alunaId, mes}[]>`, `marcarPaga(db, alunaId, mes): Promise<void>`, `desfazerPaga(db, alunaId, mes): Promise<void>`.
  - `data/config.js`: `lerModelo(db): Promise<string>`, `salvarModelo(db, texto): Promise<void>`.

- [ ] **Step 1: Criar o projeto Firebase (manual, no navegador)**

1. Em https://console.firebase.google.com crie um projeto (ou reutilize um existente).
2. Authentication → Sign-in method → ative **Google**.
3. Firestore Database → criar banco em **modo de produção**, região `southamerica-east1`.
4. Configurações do projeto → "Seus apps" → adicionar app **Web** (`</>`). Copie o objeto `firebaseConfig`.

- [ ] **Step 2: Instalar o CLI e vincular o projeto**

Run:
```bash
npm install -g firebase-tools
firebase login
firebase use --add
```
Expected: escolhe o projeto e cria `.firebaserc`. Depois: `git add .firebaserc`.

- [ ] **Step 3: Criar `firebase.json` e `firestore.rules`**

`firebase.json`:
```json
{
  "hosting": {
    "public": "public",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "headers": [
      { "source": "/sw.js", "headers": [{ "key": "Cache-Control", "value": "no-cache" }] }
    ]
  },
  "firestore": { "rules": "firestore.rules" }
}
```

`firestore.rules` (trocar o e-mail pelo Gmail da esposa — passo manual obrigatório):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null
        && request.auth.token.email_verified == true
        && request.auth.token.email == 'EMAIL_DA_ESPOSA@gmail.com';
    }
  }
}
```
Edite a linha `request.auth.token.email == ...` com o Gmail real dela (e o seu, se quiser testar: `in ['a@gmail.com', 'b@gmail.com']`).

- [ ] **Step 4: Publicar as regras**

Run: `firebase deploy --only firestore:rules`
Expected: "Deploy complete!".

- [ ] **Step 5: Criar `public/js/firebase-config.js`**

Cole os valores copiados no Step 1 (a config web do Firebase não é segredo; a proteção são as regras):
```js
export const firebaseConfig = {
  apiKey: 'COLE_AQUI',
  authDomain: 'COLE_AQUI',
  projectId: 'COLE_AQUI',
  storageBucket: 'COLE_AQUI',
  messagingSenderId: 'COLE_AQUI',
  appId: 'COLE_AQUI',
};
```
Substitua cada `COLE_AQUI` pelo valor correspondente do console.

- [ ] **Step 6: Criar `public/js/firebase.js`**

```js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

export {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

export function observarLogin(callback) {
  return onAuthStateChanged(auth, callback);
}

export function entrarComGoogle() {
  return signInWithPopup(auth, new GoogleAuthProvider());
}

export function sair() {
  return signOut(auth);
}
```

- [ ] **Step 7: Criar a camada de dados**

`public/js/data/alunas.js`:
```js
import { collection, doc, getDocs, addDoc, setDoc } from '../firebase.js';

export async function listarAlunas(db) {
  const snap = await getDocs(collection(db, 'alunas'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function salvarAluna(db, aluna) {
  const { id, ...dados } = aluna;
  if (id) {
    await setDoc(doc(db, 'alunas', id), dados);
    return id;
  }
  const ref = await addDoc(collection(db, 'alunas'), dados);
  return ref.id;
}
```

`public/js/data/pagamentos.js`:
```js
import { collection, doc, getDocs, query, where, setDoc, deleteDoc, serverTimestamp } from '../firebase.js';

export function idDoPagamento(alunaId, mes) {
  return `${alunaId}_${mes}`;
}

export async function listarPagamentosDoMes(db, mes) {
  const snap = await getDocs(query(collection(db, 'pagamentos'), where('mes', '==', mes)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function marcarPaga(db, alunaId, mes) {
  await setDoc(doc(db, 'pagamentos', idDoPagamento(alunaId, mes)), {
    alunaId,
    mes,
    pagoEm: serverTimestamp(),
  });
}

export async function desfazerPaga(db, alunaId, mes) {
  await deleteDoc(doc(db, 'pagamentos', idDoPagamento(alunaId, mes)));
}
```

`public/js/data/config.js`:
```js
import { doc, getDoc, setDoc } from '../firebase.js';
import { MENSAGEM_PADRAO } from '../core/mensagem.js';

export async function lerModelo(db) {
  const snap = await getDoc(doc(db, 'config', 'mensagem'));
  const texto = snap.exists() ? snap.data().texto : null;
  return texto || MENSAGEM_PADRAO;
}

export async function salvarModelo(db, texto) {
  await setDoc(doc(db, 'config', 'mensagem'), { texto });
}
```

- [ ] **Step 8: Checar a sintaxe**

Run: `node --check public/js/firebase.js && node --check public/js/data/alunas.js && node --check public/js/data/pagamentos.js && node --check public/js/data/config.js`
Expected: sem saída e código de saída 0. (A execução real com Firebase é verificada na Task 5.)

- [ ] **Step 9: Commit**

```bash
git add firebase.json firestore.rules .firebaserc public/js/firebase-config.js public/js/firebase.js public/js/data
git commit -m "feat: integração Firebase, regras do Firestore e camada de dados"
```

---

### Task 5: Shell do app, login e tela Hoje

**Files:**
- Create: `public/index.html`, `public/styles.css`
- Create: `public/js/ui/dom.js`, `public/js/ui/hoje.js`, `public/js/app.js`

**Interfaces:**
- Consumes: `observarLogin, entrarComGoogle, sair, db` (`firebase.js`); `listarAlunas`; `listarPagamentosDoMes, marcarPaga, desfazerPaga`; `lerModelo`; `hojeEmSaoPaulo, chaveDoMes, listasDoDia`; `renderMensagem, formatarValor`; `WaMeSender`.
- Produces:
  - `ui/dom.js`: `h(tag, atributos?, ...filhos): HTMLElement` (atributos `onXxx` viram listeners; textos entram via `textContent`, nunca `innerHTML`), `limpar(el)`, `mostrarErro(alvo, erro)`.
  - `ui/hoje.js`: `telaHoje(alvo: HTMLElement, { db, sender }): Promise<void>`.
  - `app.js`: array `TELAS = [{ id, titulo, montar(alvo) }]` — a Task 6 adiciona entradas.

- [ ] **Step 1: Criar `public/index.html`**

```html
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#25a56a">
  <link rel="manifest" href="manifest.webmanifest">
  <link rel="stylesheet" href="styles.css">
  <title>Lembretes de pagamento</title>
</head>
<body>
  <main id="app"></main>
  <script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Criar `public/styles.css`**

```css
:root { --verde: #25a56a; --texto: #1f2933; --fundo: #f6f8f7; --borda: #dde3e0; --erro: #c0392b; }
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; color: var(--texto); background: var(--fundo); }
#app { max-width: 560px; margin: 0 auto; padding-bottom: 3rem; }
.topo { display: flex; justify-content: space-between; align-items: center; padding: 1rem; }
.topo h1 { margin: 0; font-size: 1.25rem; }
.abas { display: flex; gap: .5rem; padding: 0 1rem; }
.abas button { flex: 1; padding: .6rem; border: 1px solid var(--borda); background: #fff; border-radius: 8px; font-size: 1rem; }
.abas button.ativa { background: var(--verde); color: #fff; border-color: var(--verde); }
.conteudo { padding: 1rem; }
h2 { font-size: 1rem; margin: 1.5rem 0 .5rem; }
.cartao { background: #fff; border: 1px solid var(--borda); border-radius: 10px; padding: .75rem; margin-bottom: .5rem; }
.cartao .nome { font-weight: 600; }
.cartao .detalhe { color: #52606d; font-size: .9rem; margin: .15rem 0 .5rem; }
.cartao .acoes { display: flex; gap: .5rem; }
button { font: inherit; cursor: pointer; }
button.principal { background: var(--verde); color: #fff; border: 0; border-radius: 8px; padding: .6rem 1rem; }
button.secundario { background: #fff; border: 1px solid var(--borda); border-radius: 8px; padding: .6rem 1rem; }
button.link { background: none; border: 0; color: #2b6cb0; padding: .25rem; }
button:disabled { opacity: .5; cursor: not-allowed; }
.vazio { color: #7b8794; }
.erro { color: var(--erro); }
.inativa { opacity: .6; }
form label { display: block; margin: .6rem 0; font-size: .9rem; }
form input, form textarea { display: block; width: 100%; margin-top: .25rem; padding: .6rem; font: inherit; border: 1px solid var(--borda); border-radius: 8px; }
form small.erro { display: block; min-height: 1em; }
.previa { background: #e7f7ee; border-radius: 10px; padding: .75rem; white-space: pre-wrap; }
.login { text-align: center; padding: 4rem 1rem; }
```

- [ ] **Step 3: Criar `public/js/ui/dom.js`**

```js
export function h(tag, atributos = {}, ...filhos) {
  const el = document.createElement(tag);
  for (const [chave, valor] of Object.entries(atributos)) {
    if (chave.startsWith('on')) el.addEventListener(chave.slice(2).toLowerCase(), valor);
    else if (valor === true) el.setAttribute(chave, '');
    else if (valor !== false && valor != null) el.setAttribute(chave, valor);
  }
  for (const filho of filhos.flat()) {
    if (filho == null || filho === false) continue;
    el.append(filho instanceof Node ? filho : document.createTextNode(String(filho)));
  }
  return el;
}

export function limpar(el) {
  el.replaceChildren();
}

export function mostrarErro(alvo, erro) {
  const semPermissao = erro?.code === 'permission-denied';
  alvo.replaceChildren(
    h(
      'p',
      { class: 'erro' },
      semPermissao
        ? 'Esta conta não tem acesso. Saia e entre com a conta correta.'
        : 'Não foi possível carregar. Verifique a internet e tente de novo.',
    ),
  );
}
```

- [ ] **Step 4: Criar `public/js/ui/hoje.js`**

```js
import { h, mostrarErro } from './dom.js';
import { chaveDoMes, hojeEmSaoPaulo, listasDoDia } from '../core/vencimentos.js';
import { formatarValor, renderMensagem } from '../core/mensagem.js';
import { listarAlunas } from '../data/alunas.js';
import { desfazerPaga, listarPagamentosDoMes, marcarPaga } from '../data/pagamentos.js';
import { lerModelo } from '../data/config.js';

function textoAtraso(dias) {
  return dias === 1 ? '1 dia de atraso' : `${dias} dias de atraso`;
}

export async function telaHoje(alvo, { db, sender }) {
  alvo.replaceChildren(h('p', {}, 'Carregando…'));
  const hoje = hojeEmSaoPaulo();
  const mes = chaveDoMes(hoje);

  let alunas, pagamentos, modelo;
  try {
    [alunas, pagamentos, modelo] = await Promise.all([
      listarAlunas(db),
      listarPagamentosDoMes(db, mes),
      lerModelo(db),
    ]);
  } catch (erro) {
    mostrarErro(alvo, erro);
    return;
  }

  const recarregar = () => telaHoje(alvo, { db, sender });
  const listas = listasDoDia(alunas, pagamentos, hoje);

  // Botão que executa uma ação assíncrona e recarrega a tela; em caso de falha, avisa no próprio botão.
  const botaoAcao = (rotulo, classe, acao) => {
    const botao = h('button', { type: 'button', class: classe }, rotulo);
    botao.addEventListener('click', async () => {
      botao.disabled = true;
      try {
        await acao();
        await recarregar();
      } catch {
        botao.disabled = false;
        botao.textContent = 'Falhou, tente de novo';
      }
    });
    return botao;
  };

  const cartao = ({ aluna, diaEfetivo }, detalhe, acoes) =>
    h(
      'div',
      { class: 'cartao' },
      h('div', { class: 'nome' }, aluna.nome),
      h('div', { class: 'detalhe' }, [detalhe, formatarValor(aluna.valor)].filter(Boolean).join(' • ')),
      h('div', { class: 'acoes' }, acoes),
    );

  const botaoPaga = (item) => botaoAcao('Paga', 'secundario', () => marcarPaga(db, item.aluna.id, mes));
  const botaoDesfazer = (item) => botaoAcao('Desfazer', 'secundario', () => desfazerPaga(db, item.aluna.id, mes));

  // O botão Lembrar só abre o WhatsApp; não deve recarregar a tela.
  const lembrarSemRecarregar = (item) => {
    const botao = h('button', { type: 'button', class: 'principal' }, 'Lembrar no WhatsApp');
    botao.addEventListener('click', () =>
      sender.enviar(item.aluna, renderMensagem(modelo, item.aluna, item.diaEfetivo)),
    );
    return botao;
  };

  const secao = (titulo, itens, vazio, montar) =>
    h('section', {}, h('h2', {}, `${titulo} (${itens.length})`), itens.length ? itens.map(montar) : h('p', { class: 'vazio' }, vazio));

  alvo.replaceChildren(
    secao('Vencem hoje', listas.venceHoje, 'Ninguém vence hoje 🎉', (item) =>
      cartao(item, `Vence dia ${item.diaEfetivo}`, [lembrarSemRecarregar(item), botaoPaga(item)]),
    ),
    secao('Atrasadas', listas.atrasadas, 'Nenhuma aluna atrasada.', (item) =>
      cartao(item, `Venceu dia ${item.diaEfetivo} (${textoAtraso(hoje.dia - item.diaEfetivo)})`, [
        lembrarSemRecarregar(item),
        botaoPaga(item),
      ]),
    ),
    secao('Pagas neste mês', listas.pagas, 'Nenhuma paga ainda.', (item) =>
      cartao(item, 'Paga neste mês', [botaoDesfazer(item)]),
    ),
  );
}
```

- [ ] **Step 5: Criar `public/js/app.js`**

```js
import { db, observarLogin, entrarComGoogle, sair } from './firebase.js';
import { h, limpar } from './ui/dom.js';
import { WaMeSender } from './core/sender.js';
import { telaHoje } from './ui/hoje.js';

const raiz = document.getElementById('app');
const sender = new WaMeSender();

const TELAS = [{ id: 'hoje', titulo: 'Hoje', montar: (alvo) => telaHoje(alvo, { db, sender }) }];

function mostrarLogin(mensagemErro = '') {
  limpar(raiz);
  raiz.append(
    h(
      'div',
      { class: 'login' },
      h('h1', {}, 'Lembretes de pagamento'),
      h(
        'button',
        {
          type: 'button',
          class: 'principal',
          onClick: () => entrarComGoogle().catch(() => mostrarLogin('Não foi possível entrar. Tente de novo.')),
        },
        'Entrar com Google',
      ),
      mensagemErro && h('p', { class: 'erro' }, mensagemErro),
    ),
  );
}

function mostrarApp() {
  limpar(raiz);
  const conteudo = h('section', { class: 'conteudo' });
  const botoes = TELAS.map((tela) =>
    h('button', { type: 'button', onClick: () => abrir(tela) }, tela.titulo),
  );

  function abrir(tela) {
    botoes.forEach((botao, i) => botao.classList.toggle('ativa', TELAS[i] === tela));
    limpar(conteudo);
    tela.montar(conteudo);
  }

  raiz.append(
    h(
      'header',
      { class: 'topo' },
      h('h1', {}, 'Lembretes'),
      h('button', { type: 'button', class: 'link', onClick: sair }, 'Sair'),
    ),
    h('nav', { class: 'abas' }, botoes),
    conteudo,
  );
  abrir(TELAS[0]);
}

observarLogin((usuario) => (usuario ? mostrarApp() : mostrarLogin()));
```

- [ ] **Step 6: Checar a sintaxe**

Run: `for f in public/js/ui/*.js public/js/app.js; do node --check "$f" || echo "ERRO em $f"; done`
Expected: sem "ERRO".

- [ ] **Step 7: Teste manual (fumaça)**

Run: `python3 -m http.server 5173 -d public` e abra `http://localhost:5173` no navegador (`localhost` já é domínio autorizado no Firebase Auth).
Expected:
1. Aparece "Entrar com Google"; entrar com o Gmail liberado nas regras mostra o app com a aba **Hoje** e as três seções vazias ("Ninguém vence hoje 🎉", etc.).
2. Entrar com outro Gmail mostra "Esta conta não tem acesso…".
3. Se o console do navegador mostrar erro de config, revise `firebase-config.js`.

- [ ] **Step 8: Commit**

```bash
git add public/index.html public/styles.css public/js/ui public/js/app.js
git commit -m "feat: login com Google e tela Hoje (vencem hoje, atrasadas, pagas)"
```

---

### Task 6: Telas Alunas e Mensagem

**Files:**
- Create: `public/js/ui/alunas.js`, `public/js/ui/mensagem.js`
- Modify: `public/js/app.js` (imports e array `TELAS`)

**Interfaces:**
- Consumes: `h, limpar, mostrarErro` (`dom.js`); `validarAluna`; `listarAlunas, salvarAluna`; `lerModelo, salvarModelo`; `MENSAGEM_PADRAO, renderMensagem`.
- Produces: `telaAlunas(alvo, { db }): Promise<void>`, `telaMensagem(alvo, { db }): Promise<void>`.

- [ ] **Step 1: Criar `public/js/ui/alunas.js`**

```js
import { h, mostrarErro } from './dom.js';
import { validarAluna } from '../core/aluna.js';
import { formatarValor } from '../core/mensagem.js';
import { listarAlunas, salvarAluna } from '../data/alunas.js';

function formulario(db, aluna, aoSalvar, aoCancelar) {
  const campo = (rotulo, atributos) => {
    const input = h('input', atributos);
    const erro = h('small', { class: 'erro' });
    return { input, erro, el: h('label', {}, rotulo, input, erro) };
  };

  const nome = campo('Nome', { name: 'nome', autocomplete: 'off', value: aluna?.nome ?? '' });
  const telefone = campo('WhatsApp (com DDD)', {
    name: 'telefone',
    type: 'tel',
    inputmode: 'tel',
    value: aluna ? aluna.telefone.replace(/^55/, '') : '',
  });
  const dia = campo('Dia do vencimento', {
    name: 'dia',
    type: 'number',
    min: 1,
    max: 31,
    inputmode: 'numeric',
    value: aluna?.diaVencimento ?? '',
  });
  const valor = campo('Valor (opcional)', { name: 'valor', inputmode: 'decimal', value: aluna?.valor ?? '' });
  const campos = { nome, telefone, dia, valor };

  const geral = h('small', { class: 'erro' });
  const botao = h('button', { type: 'submit', class: 'principal' }, aluna ? 'Salvar alterações' : 'Adicionar aluna');

  const form = h(
    'form',
    {
      onSubmit: async (evento) => {
        evento.preventDefault();
        const r = validarAluna({
          nome: nome.input.value,
          telefone: telefone.input.value,
          dia: dia.input.value,
          valor: valor.input.value,
        });
        for (const [chave, c] of Object.entries(campos)) c.erro.textContent = r.erros[chave] ?? '';
        if (!r.ok) return;

        botao.disabled = true;
        geral.textContent = '';
        try {
          await salvarAluna(db, { ...r.aluna, ativa: aluna?.ativa ?? true, id: aluna?.id });
          aoSalvar();
        } catch {
          botao.disabled = false;
          geral.textContent = 'Não foi possível salvar. Tente de novo.';
        }
      },
    },
    h('h2', {}, aluna ? 'Editar aluna' : 'Nova aluna'),
    nome.el,
    telefone.el,
    dia.el,
    valor.el,
    geral,
    botao,
    aluna && h('button', { type: 'button', class: 'link', onClick: aoCancelar }, 'Cancelar'),
  );
  return form;
}

function linhaAluna(aluna, { aoEditar, aoAlternar }) {
  const detalhe = [`dia ${aluna.diaVencimento}`, formatarValor(aluna.valor), `+${aluna.telefone}`]
    .filter(Boolean)
    .join(' • ');
  const alternar = h('button', { type: 'button', class: 'secundario' }, aluna.ativa ? 'Desativar' : 'Ativar');
  alternar.addEventListener('click', async () => {
    alternar.disabled = true;
    try {
      await aoAlternar();
    } catch {
      alternar.disabled = false;
      alternar.textContent = 'Falhou, tente de novo';
    }
  });
  return h(
    'div',
    { class: aluna.ativa ? 'cartao' : 'cartao inativa' },
    h('div', { class: 'nome' }, aluna.ativa ? aluna.nome : `${aluna.nome} (inativa)`),
    h('div', { class: 'detalhe' }, detalhe),
    h('div', { class: 'acoes' }, h('button', { type: 'button', class: 'secundario', onClick: aoEditar }, 'Editar'), alternar),
  );
}

export async function telaAlunas(alvo, { db }) {
  alvo.replaceChildren(h('p', {}, 'Carregando…'));
  let alunas;
  try {
    alunas = await listarAlunas(db);
  } catch (erro) {
    mostrarErro(alvo, erro);
    return;
  }
  alunas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  const recarregar = () => telaAlunas(alvo, { db });
  const desenhar = (editando) => {
    alvo.replaceChildren(
      formulario(db, editando, recarregar, () => desenhar(null)),
      h('h2', {}, `Alunas (${alunas.length})`),
      alunas.length ? '' : h('p', { class: 'vazio' }, 'Nenhuma aluna cadastrada ainda.'),
      ...alunas.map((aluna) =>
        linhaAluna(aluna, {
          aoEditar: () => {
            desenhar(aluna);
            window.scrollTo(0, 0);
          },
          aoAlternar: async () => {
            await salvarAluna(db, { ...aluna, ativa: !aluna.ativa });
            await recarregar();
          },
        }),
      ),
    );
  };
  desenhar(null);
}
```

- [ ] **Step 2: Criar `public/js/ui/mensagem.js`**

```js
import { h, mostrarErro } from './dom.js';
import { MENSAGEM_PADRAO, renderMensagem } from '../core/mensagem.js';
import { lerModelo, salvarModelo } from '../data/config.js';

const EXEMPLO = { nome: 'Maria Souza', valor: 150 };

export async function telaMensagem(alvo, { db }) {
  alvo.replaceChildren(h('p', {}, 'Carregando…'));
  let modelo;
  try {
    modelo = await lerModelo(db);
  } catch (erro) {
    mostrarErro(alvo, erro);
    return;
  }

  const texto = h('textarea', { rows: 5, name: 'modelo' });
  texto.value = modelo;
  const previa = h('div', { class: 'previa' });
  const status = h('small', {}, '');
  const atualizar = () => {
    previa.textContent = renderMensagem(texto.value, EXEMPLO, 10);
  };
  texto.addEventListener('input', atualizar);
  atualizar();

  const salvar = h('button', { type: 'button', class: 'principal' }, 'Salvar mensagem');
  salvar.addEventListener('click', async () => {
    salvar.disabled = true;
    try {
      await salvarModelo(db, texto.value.trim() || MENSAGEM_PADRAO);
      status.className = '';
      status.textContent = 'Mensagem salva ✓';
    } catch {
      status.className = 'erro';
      status.textContent = 'Não foi possível salvar. Tente de novo.';
    }
    salvar.disabled = false;
  });

  const restaurar = h('button', { type: 'button', class: 'link' }, 'Restaurar padrão');
  restaurar.addEventListener('click', () => {
    texto.value = MENSAGEM_PADRAO;
    atualizar();
  });

  alvo.replaceChildren(
    h('h2', {}, 'Mensagem do lembrete'),
    h('p', { class: 'detalhe' }, 'Use {nome} (primeiro nome), {dia} e {valor}.'),
    h('form', { onSubmit: (e) => e.preventDefault() }, h('label', {}, 'Texto', texto)),
    h('h2', {}, 'Prévia'),
    previa,
    h('p', {}, salvar, restaurar),
    status,
  );
}
```

- [ ] **Step 3: Registrar as telas em `app.js`**

Em `public/js/app.js`, adicione os imports logo abaixo de `import { telaHoje } from './ui/hoje.js';`:
```js
import { telaAlunas } from './ui/alunas.js';
import { telaMensagem } from './ui/mensagem.js';
```
e troque o array `TELAS` por:
```js
const TELAS = [
  { id: 'hoje', titulo: 'Hoje', montar: (alvo) => telaHoje(alvo, { db, sender }) },
  { id: 'alunas', titulo: 'Alunas', montar: (alvo) => telaAlunas(alvo, { db }) },
  { id: 'mensagem', titulo: 'Mensagem', montar: (alvo) => telaMensagem(alvo, { db }) },
];
```

- [ ] **Step 4: Checar sintaxe e rodar os testes**

Run: `for f in public/js/ui/*.js public/js/app.js; do node --check "$f" || echo "ERRO em $f"; done; npm test`
Expected: sem "ERRO" e todos os testes passando.

- [ ] **Step 5: Teste manual (aceitação local)**

Run: `python3 -m http.server 5173 -d public`, abra `http://localhost:5173` e entre com o Gmail liberado.
1. Aba **Alunas**: cadastre "Teste Um" com seu próprio WhatsApp, dia = o dia de hoje e valor 100. Telefone `123` deve mostrar "Telefone inválido…"; dia 32 deve mostrar "Use um dia entre 1 e 31."
2. Aba **Hoje**: "Teste Um" aparece em **Vencem hoje**. Toque em **Lembrar no WhatsApp**: abre o WhatsApp com a mensagem pronta (usa o primeiro nome e o dia).
3. Toque em **Paga**: ela vai para **Pagas neste mês**; **Desfazer** devolve para **Vencem hoje**.
4. Edite o dia da aluna para um dia anterior ao de hoje: ela aparece em **Atrasadas** com "N dias de atraso".
5. Aba **Mensagem**: altere o texto, veja a prévia mudar, salve e confirme na aba Hoje que o novo texto é usado.
6. **Desativar** a aluna: ela some de todas as listas da aba Hoje.
Apague os dados de teste depois (console do Firebase).

- [ ] **Step 6: Commit**

```bash
git add public/js/ui/alunas.js public/js/ui/mensagem.js public/js/app.js
git commit -m "feat: telas de cadastro de alunas e de modelo de mensagem"
```

---

### Task 7: PWA e publicação

**Files:**
- Create: `scripts/gerar-icones.py`, `public/icons/icon-192.png`, `public/icons/icon-512.png`
- Create: `public/manifest.webmanifest`, `public/sw.js`
- Modify: `public/js/app.js` (registro do service worker)

**Interfaces:**
- Consumes: o app completo das Tasks 1–6.
- Produces: app instalável publicado em `https://<projeto>.web.app`.

- [ ] **Step 1: Gerar os ícones**

`scripts/gerar-icones.py`:
```python
import pathlib
import struct
import zlib


def png(tamanho, rgb):
    linha = b"\x00" + bytes(rgb) * tamanho
    bruto = linha * tamanho

    def bloco(tipo, dados):
        corpo = tipo + dados
        return struct.pack(">I", len(dados)) + corpo + struct.pack(">I", zlib.crc32(corpo) & 0xFFFFFFFF)

    return (
        b"\x89PNG\r\n\x1a\n"
        + bloco(b"IHDR", struct.pack(">IIBBBBB", tamanho, tamanho, 8, 2, 0, 0, 0))
        + bloco(b"IDAT", zlib.compress(bruto))
        + bloco(b"IEND", b"")
    )


pasta = pathlib.Path("public/icons")
pasta.mkdir(parents=True, exist_ok=True)
for tamanho in (192, 512):
    (pasta / f"icon-{tamanho}.png").write_bytes(png(tamanho, (37, 165, 106)))
```

Run: `python3 scripts/gerar-icones.py && file public/icons/*.png`
Expected: dois arquivos `PNG image data, 192 x 192` e `512 x 512` (quadrados verdes; dá para trocar por um ícone mais bonito depois, mantendo os nomes).

- [ ] **Step 2: Criar `public/manifest.webmanifest`**

```json
{
  "name": "Lembretes de pagamento",
  "short_name": "Lembretes",
  "lang": "pt-BR",
  "start_url": "./",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#25a56a",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

- [ ] **Step 3: Criar `public/sw.js`**

```js
const CACHE = 'lembretes-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

// Cache "stale-while-revalidate" só para o app e para as bibliotecas do Firebase no gstatic.
// Dados do Firestore têm cache próprio (persistentLocalCache).
self.addEventListener('fetch', (evento) => {
  const { request } = evento;
  const url = new URL(request.url);
  const permitido =
    request.method === 'GET' && (url.origin === self.location.origin || url.hostname === 'www.gstatic.com');
  if (!permitido) return;

  evento.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const emCache = await cache.match(request);
      const rede = fetch(request)
        .then((resposta) => {
          if (resposta.ok) cache.put(request, resposta.clone());
          return resposta;
        })
        .catch(() => emCache || Response.error());
      return emCache || rede;
    }),
  );
});
```

- [ ] **Step 4: Registrar o service worker**

Acrescente ao final de `public/js/app.js`:
```js
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
```

- [ ] **Step 5: Verificar localmente**

Run: `python3 -m http.server 5173 -d public` e abra `http://localhost:5173`; no DevTools → Application: o manifest aparece sem erros e o service worker está "activated". Rode `npm test` (tudo passando).

- [ ] **Step 6: Publicar**

Run: `firebase deploy`
Expected: "Deploy complete!" com o Hosting URL `https://<projeto>.web.app`. (Esse domínio já é autorizado no Firebase Auth.)

- [ ] **Step 7: Aceitação no celular dela**

1. Abra o Hosting URL no Chrome do celular, entre com o Gmail dela.
2. Menu ⋮ → **Adicionar à tela inicial** (ou "Instalar app"). Abra pelo ícone.
3. Repita o roteiro da Task 6 Step 5 (cadastrar, Lembrar abrindo o WhatsApp, Paga/Desfazer).
4. Ative o modo avião e reabra o app: as listas carregam do cache e mostram os dados já vistos.

- [ ] **Step 8: Commit**

```bash
git add scripts/gerar-icones.py public/icons public/manifest.webmanifest public/sw.js public/js/app.js
git commit -m "feat: PWA instalável (manifest, service worker, ícones) e publicação"
```

---

## Self-Review (feito ao escrever o plano)

- **Cobertura da especificação:** login Google restrito (Task 4 regras + Task 5), tela Hoje com Vencem hoje/Atrasadas/Pagas + Lembrar + Paga/Desfazer (Tasks 1, 5), aba Alunas com cadastrar/editar/desativar (Task 6), modelo de mensagem com `{nome}`, `{valor}`, `{dia}` (Tasks 3, 6), `Sender`/`WaMeSender` (Task 3), regras de negócio e testes de borda (Task 1), validação de telefone no cadastro (Tasks 2, 6), cache offline (Task 4 `persistentLocalCache` + Task 7 service worker).
- **Desvio da especificação:** a spec previa o botão Lembrar desabilitado com telefone inválido. Como o cadastro já rejeita telefone inválido, a condição nunca ocorre e não há código para isso (YAGNI). A spec ganha as listas "Pagas neste mês" (suporte ao Desfazer) e o id determinístico do pagamento.
- **Placeholders:** os únicos valores a preencher são os dados do projeto Firebase (`firebase-config.js`) e o Gmail nas regras (Task 4, passos manuais explícitos).
- **Consistência de tipos:** `Item = { aluna, diaEfetivo }`, `idDoPagamento`, `salvarAluna` (`id` opcional) e `marcarPaga/desfazerPaga(db, alunaId, mes)` usados com as mesmas assinaturas nas Tasks 4, 5 e 6.
