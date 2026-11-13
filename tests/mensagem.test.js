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
