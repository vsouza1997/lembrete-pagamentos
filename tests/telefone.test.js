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
