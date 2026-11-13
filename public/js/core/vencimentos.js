const FUSO = 'America/Sao_Paulo';

export function ultimoDiaDoMes(ano, mes) {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

export function vencimentoEfetivo(diaVencimento, ano, mes) {
  return Math.min(diaVencimento, ultimoDiaDoMes(ano, mes));
}

export function hojeEmSaoPaulo(agora = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(agora);
  const pega = (tipo) => Number(partes.find((p) => p.type === tipo).value);
  return { ano: pega('year'), mes: pega('month'), dia: pega('day') };
}

export function chaveDoMes({ ano, mes }) {
  return `${ano}-${String(mes).padStart(2, '0')}`;
}

export function mesmoDia(a, b) {
  return a.ano === b.ano && a.mes === b.mes && a.dia === b.dia;
}

export function formatarData({ ano, mes, dia }) {
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
}

export function listasDoDia(alunas, pagamentos, hoje) {
  const chave = chaveDoMes(hoje);
  const pagas = new Set(pagamentos.filter((p) => p.mes === chave).map((p) => p.alunaId));
  const resultado = { venceHoje: [], atrasadas: [], pagas: [] };

  for (const aluna of alunas.filter((a) => a.ativa)) {
    const diaEfetivo = vencimentoEfetivo(aluna.diaVencimento, hoje.ano, hoje.mes);
    const item = { aluna, diaEfetivo };
    if (pagas.has(aluna.id)) resultado.pagas.push(item);
    else if (diaEfetivo === hoje.dia) resultado.venceHoje.push(item);
    else if (diaEfetivo < hoje.dia) resultado.atrasadas.push(item);
  }

  const porNome = (a, b) => a.aluna.nome.localeCompare(b.aluna.nome, 'pt-BR');
  resultado.venceHoje.sort(porNome);
  resultado.pagas.sort(porNome);
  resultado.atrasadas.sort((a, b) => a.diaEfetivo - b.diaEfetivo || porNome(a, b));
  return resultado;
}

// Situação de cada aluna ativa no mês `ref` (por padrão, o mês de hoje).
// status: 'paga' | 'pendente' | 'atrasada' | 'semRegistro' (mês passado sem pagamento marcado).
export function statusDoMes(alunas, pagamentos, hoje, ref = hoje) {
  const chave = chaveDoMes(ref);
  const pagas = new Set(pagamentos.filter((p) => p.mes === chave).map((p) => p.alunaId));
  const indice = ({ ano, mes }) => ano * 12 + mes;
  const distancia = indice(ref) - indice(hoje);

  const itens = alunas
    .filter((a) => a.ativa)
    .map((aluna) => {
      const diaEfetivo = vencimentoEfetivo(aluna.diaVencimento, ref.ano, ref.mes);
      let status;
      if (pagas.has(aluna.id)) status = 'paga';
      else if (distancia < 0) status = 'semRegistro';
      else if (distancia > 0) status = 'pendente';
      else status = diaEfetivo < hoje.dia ? 'atrasada' : 'pendente';
      return { aluna, diaEfetivo, status };
    });

  return itens.sort(
    (a, b) => a.diaEfetivo - b.diaEfetivo || a.aluna.nome.localeCompare(b.aluna.nome, 'pt-BR'),
  );
}

export function resumoDoMes(itens) {
  const centavos = (valor) => Math.round((valor ?? 0) * 100);
  const soma = (lista) => lista.reduce((total, i) => total + centavos(i.aluna.valor), 0) / 100;
  const com = (status) => itens.filter((i) => i.status === status);
  const total = soma(itens);
  const recebido = soma(com('paga'));
  return {
    ativas: itens.length,
    semValor: itens.filter((i) => i.aluna.valor == null).length,
    totalMensal: total,
    recebido,
    aReceber: Math.round((total - recebido) * 100) / 100,
    pagas: com('paga').length,
    pendentes: com('pendente').length,
    atrasadas: com('atrasada').length,
  };
}

// Grade do mês em semanas de 7 posições (domingo primeiro); `null` nas posições fora do mês.
export function semanasDoMes(ano, mes) {
  const primeiroDiaDaSemana = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay();
  const celulas = Array(primeiroDiaDaSemana).fill(null);
  for (let dia = 1; dia <= ultimoDiaDoMes(ano, mes); dia += 1) celulas.push(dia);
  while (celulas.length % 7 !== 0) celulas.push(null);
  const semanas = [];
  for (let i = 0; i < celulas.length; i += 7) semanas.push(celulas.slice(i, i + 7));
  return semanas;
}

export function mesVizinho({ ano, mes }, delta) {
  const indice = ano * 12 + (mes - 1) + delta;
  return { ano: Math.floor(indice / 12), mes: (indice % 12) + 1 };
}
