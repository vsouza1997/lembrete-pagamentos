export const MENSAGEM_PADRAO =
  'Oi {nome}! Passando para lembrar que a mensalidade vence dia {dia} 💛';

export function formatarValor(valor) {
  if (valor === null || valor === undefined || valor === '') return '';
  return Number(valor)
    .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    .replace(/\u00a0/g, ' ');
}

export function renderMensagem(modelo, aluna, diaEfetivo) {
  const variaveis = {
    nome: aluna.nome.trim().split(/\s+/)[0],
    valor: formatarValor(aluna.valor),
    dia: String(diaEfetivo),
  };
  return modelo.replace(/\{(nome|valor|dia)\}/g, (_, chave) => variaveis[chave]);
}

export function linkWhatsapp(telefone, mensagem) {
  return `https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`;
}
