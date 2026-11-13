import test from 'node:test';
import assert from 'node:assert/strict';
import { comparar, deTexto, diaDaSemana, diasEntre, paraTexto, somarDias, somarMeses } from '../public/js/core/datas.js';
import {
  cobrancasDoMes,
  cobrancasNoIntervalo,
  conjuntoDePagas,
  fimDoPeriodo,
  listasDoDia,
  planoDe,
  proximoPeriodo,
  resumoDoMes,
  resumoDoPlano,
  statusDaCobranca,
} from '../public/js/core/cobrancas.js';

const d = (texto) => deTexto(texto);
const textos = (lista) => lista.map((c) => `${c.aluna.nome} ${paraTexto(c.data)}`);
const base = { telefone: '5511912345678', ativa: true };
const mensal = (id, nome, diaVencimento, valor = null, extra = {}) => ({ ...base, id, nome, diaVencimento, valor, ...extra });
const semanal = (id, nome, diaSemana, valor = null) => ({ ...base, id, nome, plano: 'semanal', diaSemana, valor });
const avulso = (id, nome, parcelas) => ({ ...base, id, nome, plano: 'avulso', parcelas });
const periodico = (id, nome, plano, periodos) => ({ ...base, id, nome, plano, periodos });
const pago = (alunaId, chave) => ({ alunaId, chave, mes: chave.slice(0, 7) });

test('datas: texto, soma de dias e meses, comparação e dia da semana', () => {
  assert.deepEqual(d('2026-11-12'), { ano: 2026, mes: 11, dia: 12 });
  assert.equal(d('2026-02-29'), null);
  assert.equal(d('12/11/2026'), null);
  assert.equal(paraTexto(somarDias(d('2026-12-30'), 3)), '2027-01-02');
  assert.equal(paraTexto(somarMeses(d('2026-11-30'), 3)), '2027-02-28');
  assert.equal(paraTexto(somarMeses(d('2027-01-15'), -2)), '2026-11-15');
  assert.ok(comparar(d('2026-11-01'), d('2026-11-02')) < 0);
  assert.equal(diasEntre(d('2026-11-03'), d('2026-11-12')), 9);
  assert.equal(diaDaSemana(d('2026-11-12')), 4); // quinta
});

test('aluna sem plano (cadastro antigo) é mensal', () => {
  assert.equal(planoDe({ nome: 'Ana' }).id, 'mensal');
  assert.equal(planoDe({ plano: 'anual' }).meses, 12);
});

test('mensal gera uma cobrança por mês com chave do mês', () => {
  const lista = cobrancasNoIntervalo(mensal('a', 'Ana', 31, 150), d('2026-01-15'), d('2026-03-31'));
  assert.deepEqual(lista.map((c) => [paraTexto(c.data), c.chave, c.diaTexto, c.valor]), [
    ['2026-01-31', '2026-01', '31', 150],
    ['2026-02-28', '2026-02', '28', 150],
    ['2026-03-31', '2026-03', '31', 150],
  ]);
});

test('semanal gera uma cobrança por semana no dia escolhido', () => {
  const lista = cobrancasNoIntervalo(semanal('s', 'Sol', 1, 50), d('2026-11-01'), d('2026-11-30'));
  assert.deepEqual(lista.map((c) => c.chave), ['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30']);
  assert.equal(lista[0].diaTexto, '02/11');
});

test('parcelas: avulso e todos os períodos do plano, filtradas pelo intervalo', () => {
  const a = avulso('v', 'Vera', [{ data: '2026-11-05', valor: 80 }, { data: '2026-12-05', valor: 90 }]);
  assert.deepEqual(cobrancasNoIntervalo(a, d('2026-11-01'), d('2026-11-30')).map((c) => [c.chave, c.valor]), [['2026-11-05', 80]]);
  const t = periodico('t', 'Tina', 'trimestral', [
    { inicio: '2026-08-01', valorTotal: 3000, parcelas: [{ data: '2026-08-01', valor: 2100 }, { data: '2026-09-01', valor: 900 }] },
    { inicio: '2026-11-01', valorTotal: 3000, parcelas: [{ data: '2026-11-01', valor: 1500 }, { data: '2026-12-01', valor: 1500 }] },
  ]);
  assert.deepEqual(cobrancasNoIntervalo(t, d('2026-01-01'), d('2026-12-31')).map((c) => c.chave), [
    '2026-08-01', '2026-09-01', '2026-11-01', '2026-12-01',
  ]);
});

test('status: mensal atrasa só no mês atual, semanal só por 7 dias, parcela até ser paga', () => {
  const hoje = d('2026-11-12');
  const status = (aluna, data, pagas = new Set()) => {
    const [c] = cobrancasNoIntervalo(aluna, d(data), d(data));
    return statusDaCobranca(c, pagas, hoje);
  };
  const m = mensal('m', 'Mia', 3);
  assert.equal(status(m, '2026-11-03'), 'atrasada');
  assert.equal(status(m, '2026-10-03'), 'semRegistro');
  assert.equal(status(mensal('h', 'Hoje', 12), '2026-11-12'), 'pendente');
  assert.equal(status(m, '2026-11-03', conjuntoDePagas([{ alunaId: 'm', mes: '2026-11' }])), 'paga', 'pagamento antigo, sem chave');
  const s = semanal('s', 'Sol', 1);
  assert.equal(status(s, '2026-11-09'), 'atrasada');
  assert.equal(status(s, '2026-11-02'), 'semRegistro');
  const p = avulso('p', 'Pri', [{ data: '2026-06-10', valor: 100 }]);
  assert.equal(status(p, '2026-06-10'), 'atrasada');
  assert.equal(status(p, '2026-06-10', conjuntoDePagas([pago('p', '2026-06-10')])), 'paga');
});

test('listasDoDia: vence hoje, atrasadas de todos os planos, pagas do mês e planos terminando', () => {
  const hoje = d('2026-11-12');
  const alunas = [
    mensal('m1', 'Ana', 12, 150),
    mensal('m2', 'Bia', 3, 150),
    mensal('m3', 'Cris', 20, 150), // paga adiantado
    semanal('s1', 'Dora', 4, 50), // quinta = hoje
    semanal('s2', 'Edu', 1, 50), // segunda, 09/11 em atraso
    avulso('v1', 'Fábio', [{ data: '2026-06-10', valor: 100 }]), // parcela antiga em atraso
    periodico('t1', 'Gil', 'trimestral', [
      { inicio: '2026-08-20', valorTotal: 3000, parcelas: [{ data: '2026-08-20', valor: 2100 }, { data: '2026-10-20', valor: 900 }] },
    ]), // termina 19/11; parcela de 20/10 paga
    periodico('t2', 'Hugo', 'semestral', [
      { inicio: '2026-11-01', valorTotal: null, parcelas: [{ data: '2026-11-01', valor: 600 }] },
    ]),
    mensal('x', 'Inativa', 12, 999, { ativa: false }),
  ];
  const pagamentos = [pago('m3', '2026-11'), pago('t1', '2026-08-20'), pago('t1', '2026-10-20'), pago('t2', '2026-11-01')];
  const r = listasDoDia(alunas, pagamentos, hoje);
  assert.deepEqual(textos(r.venceHoje), ['Ana 2026-11-12', 'Dora 2026-11-12']);
  assert.deepEqual(textos(r.atrasadas), ['Fábio 2026-06-10', 'Bia 2026-11-03', 'Edu 2026-11-09']);
  assert.deepEqual(r.atrasadas.map((i) => i.diasDeAtraso), [155, 9, 3]);
  assert.deepEqual(textos(r.pagas), ['Cris 2026-11-20', 'Hugo 2026-11-01']);
  assert.deepEqual(r.terminando.map((t) => [t.aluna.nome, paraTexto(t.fim), t.diasParaFim]), [['Gil', '2026-11-19', 7]]);
});

test('cobrancasDoMes lista o mês pedido com status', () => {
  const hoje = d('2026-11-12');
  const alunas = [mensal('m', 'Ana', 5, 100), semanal('s', 'Bia', 1, 50)];
  const nov = cobrancasDoMes(alunas, [pago('s', '2026-11-02')], hoje);
  assert.deepEqual(nov.map((c) => [c.aluna.nome, c.data.dia, c.status]), [
    ['Bia', 2, 'paga'], ['Ana', 5, 'atrasada'], ['Bia', 9, 'atrasada'], ['Bia', 16, 'pendente'], ['Bia', 23, 'pendente'], ['Bia', 30, 'pendente'],
  ]);
  const out = cobrancasDoMes(alunas, [], hoje, { ano: 2026, mes: 10 });
  assert.ok(out.every((c) => c.status === 'semRegistro'));
});

test('resumoDoMes soma previsto, recebido, falta e atraso', () => {
  const hoje = d('2026-11-12');
  const alunas = [
    mensal('m', 'Ana', 5, 150),
    mensal('n', 'Sem Valor', 20, null),
    avulso('v', 'Vera', [{ data: '2026-10-01', valor: 80 }, { data: '2026-11-25', valor: 100.5 }]),
    periodico('t', 'Tina', 'trimestral', [
      { inicio: '2026-11-01', valorTotal: 3000, parcelas: [{ data: '2026-11-01', valor: 2100 }, { data: '2026-12-01', valor: 900 }] },
    ]),
  ];
  const r = resumoDoMes(alunas, [pago('t', '2026-11-01')], hoje);
  assert.deepEqual(r, {
    ativas: 4,
    porPlano: [{ rotulo: 'Avulso', quantidade: 1 }, { rotulo: 'Mensal', quantidade: 2 }, { rotulo: 'Trimestral', quantidade: 1 }],
    previsto: 2350.5,
    recebido: 2100,
    faltaReceber: 250.5,
    emAtraso: 230,
    pagas: 1,
    pendentes: 2,
    atrasadas: 2,
    semValor: 1,
  });
});

test('fimDoPeriodo e proximoPeriodo avançam pelos meses do plano', () => {
  const periodo = { inicio: '2026-11-30', valorTotal: 3000, parcelas: [{ data: '2026-11-30', valor: 2100 }, { data: '2027-01-31', valor: 900 }] };
  assert.equal(paraTexto(fimDoPeriodo(periodo, 3)), '2027-02-27');
  assert.deepEqual(proximoPeriodo(periodo, 3), {
    inicio: '2027-02-28',
    valorTotal: 3000,
    parcelas: [{ data: '2027-02-28', valor: 2100 }, { data: '2027-04-30', valor: 900 }],
  });
});

test('resumoDoPlano descreve cada plano', () => {
  assert.equal(resumoDoPlano(mensal('m', 'Ana', 10, 150)), 'Mensal • dia 10 • R$ 150,00');
  assert.equal(resumoDoPlano(mensal('m', 'Ana', 10, null)), 'Mensal • dia 10');
  assert.equal(resumoDoPlano(semanal('s', 'Bia', 1, 50)), 'Semanal • segunda • R$ 50,00');
  assert.equal(resumoDoPlano(avulso('v', 'Vera', [{ data: '2026-11-05', valor: 80 }])), 'Avulso • 1 cobrança');
  const t = periodico('t', 'Tina', 'trimestral', [
    { inicio: '2026-11-01', valorTotal: null, parcelas: [{ data: '2026-11-01', valor: 2100 }, { data: '2026-12-01', valor: 900 }] },
  ]);
  assert.equal(resumoDoPlano(t), 'Trimestral • 01/11/2026 a 31/01/2027 • R$ 3.000,00 em 2 parcelas');
});
