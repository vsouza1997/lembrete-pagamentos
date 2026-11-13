import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ultimoDiaDoMes,
  vencimentoEfetivo,
  hojeEmSaoPaulo,
  chaveDoMes,
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

import { semanasDoMes, mesVizinho } from '../public/js/core/vencimentos.js';

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
