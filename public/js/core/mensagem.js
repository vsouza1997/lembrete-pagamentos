export const MENSAGEM_PADRAO = [
  'Oi {nome}! 💛',
  '',
  'Passando para lembrar da mensalidade:',
  '*Vencimento:* dia {dia}',
  '*Valor:* {valor}',
  '',
  '*Chave Pix:* {pix}',
  '',
  'Qualquer dúvida, me chama!',
].join('\n');

const VARIAVEL = /\{(nome|valor|dia|pix)\}/g;

export function formatarValor(valor) {
  if (valor === null || valor === undefined || valor === '') return '';
  return Number(valor)
    .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    .replace(/ /g, ' ');
}

// Troca {nome}, {valor}, {dia} e {pix}. Uma linha cujas variáveis estão todas vazias
// (ex.: "*Chave Pix:* {pix}" sem chave cadastrada) é removida da mensagem.
export function renderMensagem(modelo, aluna, diaEfetivo, pix = '') {
  const variaveis = {
    nome: aluna.nome.trim().split(/\s+/)[0],
    valor: formatarValor(aluna.valor),
    dia: String(diaEfetivo),
    pix: String(pix ?? '').trim(),
  };
  return modelo
    .split('\n')
    .filter((linha) => {
      const usadas = [...linha.matchAll(VARIAVEL)].map((m) => m[1]);
      return usadas.length === 0 || usadas.some((chave) => variaveis[chave] !== '');
    })
    .map((linha) => linha.replace(VARIAVEL, (_, chave) => variaveis[chave]))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Divide o texto nos trechos que o WhatsApp mostra em negrito (*assim*), para a prévia.
export function partesWhatsapp(texto) {
  const partes = [];
  let ultimo = 0;
  for (const m of texto.matchAll(/\*(\S(?:[^*\n]*\S)?)\*/g)) {
    if (m.index > ultimo) partes.push({ texto: texto.slice(ultimo, m.index), negrito: false });
    partes.push({ texto: m[1], negrito: true });
    ultimo = m.index + m[0].length;
  }
  if (ultimo < texto.length) partes.push({ texto: texto.slice(ultimo), negrito: false });
  return partes;
}

export function linkWhatsapp(telefone, mensagem) {
  return `https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`;
}
