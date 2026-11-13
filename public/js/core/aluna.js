import { normalizarTelefone } from './telefone.js';

export function validarAluna({ nome, telefone, dia, valor }) {
  const erros = {};

  const nomeLimpo = String(nome ?? '').trim();
  if (!nomeLimpo) erros.nome = 'Informe o nome.';

  const telefoneNormalizado = normalizarTelefone(telefone);
  if (!telefoneNormalizado) erros.telefone = 'Telefone inválido. Use DDD + número.';

  const diaNumero = Number(dia);
  if (!Number.isInteger(diaNumero) || diaNumero < 1 || diaNumero > 31) {
    erros.dia = 'Use um dia entre 1 e 31.';
  }

  let valorNumero = null;
  const valorTexto = String(valor ?? '').trim();
  if (valorTexto !== '') {
    valorNumero = Number(valorTexto.replace(',', '.'));
    if (Number.isNaN(valorNumero) || valorNumero < 0) {
      erros.valor = 'Valor inválido. Use só números, ex.: 150 ou 150,50.';
      valorNumero = null;
    }
  }

  return {
    ok: Object.keys(erros).length === 0,
    erros,
    aluna: {
      nome: nomeLimpo,
      telefone: telefoneNormalizado,
      diaVencimento: diaNumero,
      valor: valorNumero,
    },
  };
}
