import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ultimoDiaDoMes,
  vencimentoEfetivo,
  hojeEmSaoPaulo,
  chaveDoMes,
  listasDoDia,
  mesmoDia,
  formatarData,
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

test('mesmoDia compara ano, mes e dia', () => {
  assert.equal(mesmoDia({ ano: 2026, mes: 11, dia: 12 }, { ano: 2026, mes: 11, dia: 12 }), true);
  assert.equal(mesmoDia({ ano: 2026, mes: 11, dia: 12 }, { ano: 2026, mes: 11, dia: 13 }), false);
  assert.equal(mesmoDia({ ano: 2026, mes: 11, dia: 30 }, { ano: 2026, mes: 12, dia: 30 }), false);
  assert.equal(mesmoDia({ ano: 2026, mes: 12, dia: 31 }, { ano: 2027, mes: 12, dia: 31 }), false);
});

test('formatarData gera dd/mm/aaaa com zeros a esquerda', () => {
  assert.equal(formatarData({ ano: 2026, mes: 11, dia: 12 }), '12/11/2026');
  assert.equal(formatarData({ ano: 2026, mes: 3, dia: 5 }), '05/03/2026');
});

import { statusDoMes, resumoDoMes, semanasDoMes, mesVizinho } from '../public/js/core/vencimentos.js';

const al = (id, nome, diaVencimento, valor = null, ativa = true) => ({
  id, nome, telefone: '5511912345678', diaVencimento, valor, ativa,
});

test('statusDoMes no mês atual: paga, pendente e atrasada, ordenado por dia', () => {
  const hoje = { ano: 2025, mes: 3, dia: 10 };
  const alunas = [al('a', 'Ana', 20), al('b', 'Bia', 5), al('c', 'Carla', 10), al('d', 'Dani', 2), al('e', 'Eva', 1, null, false)];
  const r = statusDoMes(alunas, [{ alunaId: 'd', mes: '2025-03' }], hoje);
  assert.deepEqual(
    r.map((i) => [i.aluna.nome, i.diaEfetivo, i.status]),
    [['Dani', 2, 'paga'], ['Bia', 5, 'atrasada'], ['Carla', 10, 'pendente'], ['Ana', 20, 'pendente']],
  );
});

test('statusDoMes em outro mês: futuro é pendente, passado sem pagamento é semRegistro', () => {
  const hoje = { ano: 2025, mes: 3, dia: 10 };
  const alunas = [al('a', 'Ana', 31), al('b', 'Bia', 5)];
  const pagamentos = [{ alunaId: 'b', mes: '2025-02' }, { alunaId: 'a', mes: '2025-03' }];
  const fev = statusDoMes(alunas, pagamentos, hoje, { ano: 2025, mes: 2 });
  assert.deepEqual(fev.map((i) => [i.aluna.nome, i.diaEfetivo, i.status]), [['Bia', 5, 'paga'], ['Ana', 28, 'semRegistro']]);
  const abr = statusDoMes(alunas, pagamentos, hoje, { ano: 2025, mes: 4 });
  assert.deepEqual(abr.map((i) => i.status), ['pendente', 'pendente']);
  const dezAnterior = statusDoMes(alunas, [], { ano: 2026, mes: 1, dia: 5 }, { ano: 2025, mes: 12 });
  assert.deepEqual(dezAnterior.map((i) => i.status), ['semRegistro', 'semRegistro']);
});

test('resumoDoMes soma valores e conta status', () => {
  const hoje = { ano: 2025, mes: 3, dia: 10 };
  const alunas = [al('a', 'Ana', 20, 100), al('b', 'Bia', 5, 150.5), al('c', 'Carla', 2, 200), al('d', 'Dani', 3, null)];
  const itens = statusDoMes(alunas, [{ alunaId: 'c', mes: '2025-03' }], hoje);
  assert.deepEqual(resumoDoMes(itens), {
    ativas: 4, semValor: 1, totalMensal: 450.5, recebido: 200, aReceber: 250.5, pagas: 1, pendentes: 1, atrasadas: 2,
  });
  assert.deepEqual(resumoDoMes([]), {
    ativas: 0, semValor: 0, totalMensal: 0, recebido: 0, aReceber: 0, pagas: 0, pendentes: 0, atrasadas: 0,
  });
});

test('semanasDoMes monta a grade começando no domingo', () => {
  // março de 2025 começa num sábado e tem 31 dias
  const s = semanasDoMes(2025, 3);
  assert.deepEqual(s[0], [null, null, null, null, null, null, 1]);
  assert.deepEqual(s[1], [2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(s.at(-1), [30, 31, null, null, null, null, null]);
  assert.equal(s.length, 6);
  // fevereiro de 2026 começa num domingo e tem 28 dias: 4 semanas exatas
  assert.equal(semanasDoMes(2026, 2).length, 4);
  assert.deepEqual(semanasDoMes(2026, 2)[0], [1, 2, 3, 4, 5, 6, 7]);
});

test('mesVizinho vira o ano', () => {
  assert.deepEqual(mesVizinho({ ano: 2025, mes: 12 }, 1), { ano: 2026, mes: 1 });
  assert.deepEqual(mesVizinho({ ano: 2025, mes: 1 }, -1), { ano: 2024, mes: 12 });
  assert.deepEqual(mesVizinho({ ano: 2025, mes: 6 }, 1), { ano: 2025, mes: 7 });
});
