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
