import test from 'node:test';
import assert from 'node:assert/strict';
import { MENSAGEM_PADRAO, formatarValor, renderMensagem, linkWhatsapp, partesWhatsapp } from '../public/js/core/mensagem.js';

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

test('renderMensagem mantém a linha quando outra variável dela tem valor', () => {
  assert.equal(renderMensagem('Oi {nome}, valor {valor}.', { nome: 'Ana', valor: null }, 5), 'Oi Ana, valor .');
});

test('renderMensagem remove a linha cujas variáveis estão todas vazias', () => {
  const modelo = 'Oi {nome}!\n\n*Valor:* {valor}\n\n*Chave Pix:* {pix}\n\nAté mais';
  assert.equal(renderMensagem(modelo, { nome: 'Ana', valor: null }, 5), 'Oi Ana!\n\nAté mais');
  assert.equal(
    renderMensagem(modelo, { nome: 'Ana', valor: 100 }, 5, 'abc@pix.com'),
    'Oi Ana!\n\n*Valor:* R$ 100,00\n\n*Chave Pix:* abc@pix.com\n\nAté mais',
  );
});

test('a mensagem padrão leva vencimento, valor e Pix em negrito', () => {
  const texto = renderMensagem(MENSAGEM_PADRAO, { nome: 'Ana Lima', valor: 150 }, 10, '11912345678');
  assert.match(texto, /\*Vencimento:\* dia 10/);
  assert.match(texto, /\*Valor:\* R\$ 150,00/);
  assert.match(texto, /\*Chave Pix:\* 11912345678/);
  const semPix = renderMensagem(MENSAGEM_PADRAO, { nome: 'Ana Lima', valor: null }, 10);
  assert.doesNotMatch(semPix, /Pix|Valor/);
  assert.doesNotMatch(semPix, /\n{3,}/);
});

test('partesWhatsapp separa os trechos em negrito', () => {
  assert.deepEqual(partesWhatsapp('Oi *Ana*, vence *dia 10*!'), [
    { texto: 'Oi ', negrito: false },
    { texto: 'Ana', negrito: true },
    { texto: ', vence ', negrito: false },
    { texto: 'dia 10', negrito: true },
    { texto: '!', negrito: false },
  ]);
  assert.deepEqual(partesWhatsapp('2 * 3 = 6'), [{ texto: '2 * 3 = 6', negrito: false }]);
  assert.deepEqual(partesWhatsapp(''), []);
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
