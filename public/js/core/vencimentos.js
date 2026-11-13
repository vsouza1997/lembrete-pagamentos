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
