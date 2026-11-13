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

test('valor rejeita formatos que Number() aceita mas não são decimais', () => {
  for (const valor of ['Infinity', '1e3', '0x10']) {
    assert.ok(validarAluna({ ...base, valor }).erros.valor, `valor ${valor} deveria ser inválido`);
  }
});

test('dia rejeita formatos que Number() aceita mas não são inteiros decimais', () => {
  for (const dia of ['0x1F', '1e1']) {
    assert.ok(validarAluna({ ...base, dia }).erros.dia, `dia ${dia} deveria ser inválido`);
  }
});

test('valor aceita inteiro e decimal com vírgula ou ponto', () => {
  assert.equal(validarAluna({ ...base, valor: '150' }).aluna.valor, 150);
  assert.equal(validarAluna({ ...base, valor: '150,5' }).aluna.valor, 150.5);
  assert.equal(validarAluna({ ...base, valor: '150.50' }).aluna.valor, 150.5);
});
