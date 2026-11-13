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
