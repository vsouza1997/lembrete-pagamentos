import { chaveDoMes, formatarData, mesVizinho, ultimoDiaDoMes, vencimentoEfetivo } from './vencimentos.js';
import { comparar, deTexto, diaDaSemana, diasEntre, formatarCurta, paraTexto, somarDias, somarMeses } from './datas.js';
import { formatarValor } from './mensagem.js';

export const PLANOS = [
  { id: 'avulso', rotulo: 'Avulso' },
  { id: 'semanal', rotulo: 'Semanal' },
  { id: 'mensal', rotulo: 'Mensal' },
  { id: 'trimestral', rotulo: 'Trimestral', meses: 3 },
  { id: 'semestral', rotulo: 'Semestral', meses: 6 },
  { id: 'anual', rotulo: 'Anual', meses: 12 },
];

export const DIAS_DA_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

// Alunas cadastradas antes dos planos não têm o campo `plano`: são mensais.
export function planoDe(aluna) {
  return PLANOS.find((p) => p.id === (aluna?.plano ?? 'mensal')) ?? PLANOS.find((p) => p.id === 'mensal');
}

// Último dia do período (início + N meses - 1 dia).
export function fimDoPeriodo(periodo, meses) {
  return somarDias(somarMeses(deTexto(periodo.inicio), meses), -1);
}

// Período seguinte com as mesmas parcelas, datas avançadas em N meses.
export function proximoPeriodo(periodo, meses) {
  const avancar = (texto) => paraTexto(somarMeses(deTexto(texto), meses));
  return {
    inicio: avancar(periodo.inicio),
    valorTotal: periodo.valorTotal ?? null,
    parcelas: periodo.parcelas.map((p) => ({ data: avancar(p.data), valor: p.valor })),
  };
}

function parcelasDe(aluna, plano) {
  if (plano.id === 'avulso') return aluna.parcelas ?? [];
  return (aluna.periodos ?? []).flatMap((periodo) => periodo.parcelas ?? []);
}

// Cobrança = um vencimento de uma aluna. `chave` identifica o pagamento:
// 'AAAA-MM' no mensal (compatível com os pagamentos antigos), 'AAAA-MM-DD' nos demais.
// `diaTexto` é o que entra no {dia} da mensagem.
function cobranca(aluna, plano, data, valor, chave, diaTexto) {
  return { aluna, plano: plano.id, data, valor: valor ?? null, chave, diaTexto };
}

// Cobranças da aluna com vencimento entre `de` e `ate` (inclusive).
export function cobrancasNoIntervalo(aluna, de, ate) {
  const plano = planoDe(aluna);
  const dentro = (data) => comparar(data, de) >= 0 && comparar(data, ate) <= 0;
  const lista = [];

  if (plano.id === 'mensal') {
    const fim = ate.ano * 12 + ate.mes;
    for (let ref = { ano: de.ano, mes: de.mes }; ref.ano * 12 + ref.mes <= fim; ref = mesVizinho(ref, 1)) {
      const data = { ...ref, dia: vencimentoEfetivo(aluna.diaVencimento, ref.ano, ref.mes) };
      if (dentro(data)) lista.push(cobranca(aluna, plano, data, aluna.valor, chaveDoMes(ref), String(data.dia)));
    }
  } else if (plano.id === 'semanal') {
    for (
      let data = somarDias(de, (aluna.diaSemana - diaDaSemana(de) + 7) % 7);
      comparar(data, ate) <= 0;
      data = somarDias(data, 7)
    ) {
      lista.push(cobranca(aluna, plano, data, aluna.valor, paraTexto(data), formatarCurta(data)));
    }
  } else {
    for (const parcela of parcelasDe(aluna, plano)) {
      const data = deTexto(parcela.data);
      if (data && dentro(data)) {
        lista.push(cobranca(aluna, plano, data, parcela.valor, parcela.data, formatarCurta(data)));
      }
    }
  }
  return lista;
}

export function chavePagamento(alunaId, chave) {
  return `${alunaId}_${chave}`;
}

// Pagamentos antigos (só mensal) não têm `chave`; a chave deles é o mês.
export function conjuntoDePagas(pagamentos) {
  return new Set(pagamentos.map((p) => chavePagamento(p.alunaId, p.chave ?? p.mes)));
}

// 'paga' | 'pendente' | 'atrasada' | 'semRegistro'
// Atraso: mensal só no mês atual; semanal só nos últimos 7 dias; parcelas até serem pagas.
export function statusDaCobranca(c, pagas, hoje) {
  if (pagas.has(chavePagamento(c.aluna.id, c.chave))) return 'paga';
  if (comparar(c.data, hoje) >= 0) return 'pendente';
  if (c.plano === 'mensal') return c.data.ano === hoje.ano && c.data.mes === hoje.mes ? 'atrasada' : 'semRegistro';
  if (c.plano === 'semanal') return diasEntre(c.data, hoje) < 7 ? 'atrasada' : 'semRegistro';
  return 'atrasada';
}

const porNome = (a, b) => a.aluna.nome.localeCompare(b.aluna.nome, 'pt-BR');
const porDataENome = (a, b) => comparar(a.data, b.data) || porNome(a, b);
const ehDoMes = (data, ref) => data.ano === ref.ano && data.mes === ref.mes;
const DIAS_DE_AVISO_DE_RENOVACAO = 7;

export function listasDoDia(alunas, pagamentos, hoje) {
  const pagas = conjuntoDePagas(pagamentos);
  const inicioDoMes = { ano: hoje.ano, mes: hoje.mes, dia: 1 };
  const fimDoMes = { ...inicioDoMes, dia: ultimoDiaDoMes(hoje.ano, hoje.mes) };
  const semanaPassada = somarDias(hoje, -6);
  const inicioRecorrente = comparar(semanaPassada, inicioDoMes) < 0 ? semanaPassada : inicioDoMes;
  const resultado = { venceHoje: [], atrasadas: [], pagas: [], terminando: [] };

  for (const aluna of alunas.filter((a) => a.ativa)) {
    const plano = planoDe(aluna);
    const recorrente = plano.id === 'mensal' || plano.id === 'semanal';
    const de = recorrente ? inicioRecorrente : { ano: 1900, mes: 1, dia: 1 };

    for (const c of cobrancasNoIntervalo(aluna, de, fimDoMes)) {
      const status = statusDaCobranca(c, pagas, hoje);
      const item = { ...c, status };
      if (status === 'paga') {
        if (ehDoMes(c.data, hoje)) resultado.pagas.push(item);
      } else if (comparar(c.data, hoje) === 0) {
        resultado.venceHoje.push(item);
      } else if (status === 'atrasada') {
        resultado.atrasadas.push({ ...item, diasDeAtraso: diasEntre(c.data, hoje) });
      }
    }

    const ultimo = aluna.periodos?.at(-1);
    if (plano.meses && ultimo) {
      const fim = fimDoPeriodo(ultimo, plano.meses);
      const diasParaFim = diasEntre(hoje, fim);
      if (diasParaFim <= DIAS_DE_AVISO_DE_RENOVACAO) resultado.terminando.push({ aluna, plano: plano.id, fim, diasParaFim });
    }
  }

  resultado.venceHoje.sort(porNome);
  resultado.pagas.sort(porNome);
  resultado.atrasadas.sort(porDataENome);
  resultado.terminando.sort((a, b) => a.diasParaFim - b.diasParaFim || porNome(a, b));
  return resultado;
}

// Todas as cobranças das alunas ativas que vencem no mês `ref`, com status, por data.
export function cobrancasDoMes(alunas, pagamentos, hoje, ref = hoje) {
  const pagas = conjuntoDePagas(pagamentos);
  const de = { ano: ref.ano, mes: ref.mes, dia: 1 };
  const ate = { ...de, dia: ultimoDiaDoMes(ref.ano, ref.mes) };
  return alunas
    .filter((a) => a.ativa)
    .flatMap((aluna) => cobrancasNoIntervalo(aluna, de, ate))
    .map((c) => ({ ...c, status: statusDaCobranca(c, pagas, hoje) }))
    .sort(porDataENome);
}

export function resumoDoMes(alunas, pagamentos, hoje) {
  const centavos = (lista) => lista.reduce((total, c) => total + Math.round((c.valor ?? 0) * 100), 0);
  const doMes = cobrancasDoMes(alunas, pagamentos, hoje);
  const { atrasadas } = listasDoDia(alunas, pagamentos, hoje);
  const ativas = alunas.filter((a) => a.ativa);
  const pagasDoMes = doMes.filter((c) => c.status === 'paga');
  const previsto = centavos(doMes);
  const recebido = centavos(pagasDoMes);
  return {
    ativas: ativas.length,
    porPlano: PLANOS.map((p) => ({ rotulo: p.rotulo, quantidade: ativas.filter((a) => planoDe(a).id === p.id).length })).filter(
      (p) => p.quantidade > 0,
    ),
    previsto: previsto / 100,
    recebido: recebido / 100,
    faltaReceber: (previsto - recebido) / 100,
    emAtraso: centavos(atrasadas) / 100,
    pagas: pagasDoMes.length,
    pendentes: doMes.filter((c) => c.status === 'pendente').length,
    atrasadas: atrasadas.length,
    semValor: doMes.filter((c) => c.valor == null).length,
  };
}

// Uma linha descrevendo o plano da aluna, para a lista de alunas.
export function resumoDoPlano(aluna) {
  const plano = planoDe(aluna);
  if (plano.id === 'mensal') return [plano.rotulo, `dia ${aluna.diaVencimento}`, formatarValor(aluna.valor)].filter(Boolean).join(' • ');
  if (plano.id === 'semanal') {
    return [plano.rotulo, DIAS_DA_SEMANA[aluna.diaSemana]?.toLowerCase(), formatarValor(aluna.valor)].filter(Boolean).join(' • ');
  }
  if (plano.id === 'avulso') {
    const n = aluna.parcelas?.length ?? 0;
    return `${plano.rotulo} • ${n === 1 ? '1 cobrança' : `${n} cobranças`}`;
  }
  const periodo = aluna.periodos?.at(-1);
  if (!periodo) return plano.rotulo;
  const n = periodo.parcelas.length;
  const total = periodo.valorTotal ?? periodo.parcelas.reduce((s, p) => s + Math.round(p.valor * 100), 0) / 100;
  return [
    plano.rotulo,
    `${formatarData(deTexto(periodo.inicio))} a ${formatarData(fimDoPeriodo(periodo, plano.meses))}`,
    `${formatarValor(total)} em ${n === 1 ? '1 parcela' : `${n} parcelas`}`,
  ].join(' • ');
}
