import test from 'node:test';
import assert from 'node:assert/strict';
import { periodosAoSalvar, validarAluna } from '../public/js/core/aluna.js';

const base = { nome: 'Maria Souza', telefone: '(11) 91234-5678', dia: '10', valor: '150,50' };

test('cadastro válido normaliza os campos', () => {
  const r = validarAluna(base);
  assert.equal(r.ok, true);
  assert.deepEqual(r.aluna, {
    nome: 'Maria Souza',
    telefone: '5511912345678',
    plano: 'mensal',
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

const pessoa = { nome: 'Ana', telefone: '11912345678' };

test('semanal guarda o dia da semana e o valor', () => {
  const r = validarAluna({ ...pessoa, plano: 'semanal', diaSemana: '1', valor: '50' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.aluna, { nome: 'Ana', telefone: '5511912345678', plano: 'semanal', diaSemana: 1, valor: 50 });
  assert.ok(validarAluna({ ...pessoa, plano: 'semanal', diaSemana: '7' }).erros.diaSemana);
  assert.ok(validarAluna({ ...pessoa, plano: 'semanal', diaSemana: '' }).erros.diaSemana);
});

test('avulso guarda as parcelas em ordem de data', () => {
  const r = validarAluna({
    ...pessoa,
    plano: 'avulso',
    parcelas: [{ data: '2026-12-10', valor: '80' }, { data: '2026-11-20', valor: '70,5' }],
  });
  assert.equal(r.ok, true);
  assert.deepEqual(r.aluna.parcelas, [{ data: '2026-11-20', valor: 70.5 }, { data: '2026-12-10', valor: 80 }]);
  assert.equal('diaVencimento' in r.aluna, false);
});

test('parcelas exigem data, valor, pelo menos uma e datas diferentes', () => {
  const erro = (parcelas) => validarAluna({ ...pessoa, plano: 'avulso', parcelas }).erros.parcelas;
  assert.match(erro([]), /pelo menos uma/);
  assert.match(erro([{ data: '', valor: '10' }]), /Parcela 1: informe a data/);
  assert.match(erro([{ data: '2026-02-30', valor: '10' }]), /Parcela 1: informe a data/);
  assert.match(erro([{ data: '2026-11-01', valor: '10' }, { data: '2026-11-02', valor: '' }]), /Parcela 2: informe o valor/);
  assert.match(erro([{ data: '2026-11-01', valor: '10' }, { data: '2026-11-01', valor: '20' }]), /mesmo dia/);
});

test('trimestral guarda o período com total livre e avisa se a soma não bate', () => {
  const base = { ...pessoa, plano: 'trimestral', inicio: '2026-11-01', valorTotal: '3000' };
  const r = validarAluna({ ...base, parcelas: [{ data: '2026-11-01', valor: '2100' }, { data: '2026-12-01', valor: '900' }] });
  assert.equal(r.ok, true);
  assert.deepEqual(r.avisos, {});
  assert.deepEqual(r.aluna.periodo, {
    inicio: '2026-11-01',
    valorTotal: 3000,
    parcelas: [{ data: '2026-11-01', valor: 2100 }, { data: '2026-12-01', valor: 900 }],
  });
  const diferente = validarAluna({ ...base, parcelas: [{ data: '2026-11-01', valor: '1500' }] });
  assert.equal(diferente.ok, true, 'o aviso não impede salvar');
  assert.equal(diferente.avisos.valorTotal, 'As parcelas somam R$ 1.500,00, mas o total é R$ 3.000,00.');
  assert.ok(validarAluna({ ...base, inicio: '', parcelas: [{ data: '2026-11-01', valor: '1' }] }).erros.inicio);
  assert.equal(validarAluna({ ...base, valorTotal: '', parcelas: [{ data: '2026-11-01', valor: '1' }] }).aluna.periodo.valorTotal, null);
});

test('plano desconhecido é erro', () => {
  assert.ok(validarAluna({ ...pessoa, plano: 'diario' }).erros.plano);
});

test('periodosAoSalvar: edição troca o último, renovação acrescenta, troca de plano recomeça', () => {
  const p1 = { inicio: '2026-01-01' };
  const p2 = { inicio: '2026-04-01' };
  const novo = { inicio: '2026-07-01' };
  const anterior = { plano: 'trimestral', periodos: [p1, p2] };
  assert.deepEqual(periodosAoSalvar(anterior, 'trimestral', novo), [p1, novo]);
  assert.deepEqual(periodosAoSalvar(anterior, 'trimestral', novo, true), [p1, p2, novo]);
  assert.deepEqual(periodosAoSalvar(anterior, 'semestral', novo), [novo]);
  assert.deepEqual(periodosAoSalvar(null, 'anual', novo), [novo]);
});
