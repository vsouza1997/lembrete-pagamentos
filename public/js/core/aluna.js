import { normalizarTelefone } from './telefone.js';
import { deTexto } from './datas.js';
import { PLANOS } from './cobrancas.js';
import { formatarValor } from './mensagem.js';

const MSG_VALOR = 'Valor inválido. Use só números, ex.: 150 ou 150,50.';

// '' -> { valor: null }; '150,50' -> { valor: 150.5 }; formato inválido -> { erro: true }
function lerValor(entrada) {
  const texto = String(entrada ?? '').trim();
  if (texto === '') return { valor: null };
  if (/^\d+([.,]\d{1,2})?$/.test(texto)) return { valor: Number(texto.replace(',', '.')) };
  return { erro: true };
}

function lerParcelas(parcelas, erros) {
  const lidas = [];
  for (const [i, parcela] of parcelas.entries()) {
    const data = String(parcela.data ?? '').trim();
    if (!deTexto(data)) {
      erros.parcelas = `Parcela ${i + 1}: informe a data.`;
      return [];
    }
    const { valor, erro } = lerValor(parcela.valor);
    if (erro || valor === null) {
      erros.parcelas = `Parcela ${i + 1}: informe o valor, ex.: 150 ou 150,50.`;
      return [];
    }
    lidas.push({ data, valor });
  }
  if (lidas.length === 0) erros.parcelas = 'Adicione pelo menos uma parcela.';
  else if (new Set(lidas.map((p) => p.data)).size !== lidas.length) {
    erros.parcelas = 'Duas parcelas não podem cair no mesmo dia.';
  }
  return lidas.sort((a, b) => a.data.localeCompare(b.data));
}

// Valida o formulário. A saída `aluna` traz só os campos do plano escolhido;
// nos planos trimestral, semestral e anual ela traz `periodo` (ver periodosAoSalvar).
// `avisos` não impedem salvar.
export function validarAluna({ nome, telefone, plano = 'mensal', dia, diaSemana, valor, inicio, valorTotal, parcelas = [] }) {
  const erros = {};
  const avisos = {};

  const nomeLimpo = String(nome ?? '').trim();
  if (!nomeLimpo) erros.nome = 'Informe o nome.';

  const telefoneNormalizado = normalizarTelefone(telefone);
  if (!telefoneNormalizado) erros.telefone = 'Telefone inválido. Use DDD + número.';

  const definicao = PLANOS.find((p) => p.id === plano);
  if (!definicao) erros.plano = 'Escolha um plano.';

  const aluna = { nome: nomeLimpo, telefone: telefoneNormalizado, plano };

  if (plano === 'mensal' || plano === 'semanal') {
    if (plano === 'mensal') {
      const diaTexto = String(dia ?? '').trim();
      const diaNumero = /^\d{1,2}$/.test(diaTexto) ? Number(diaTexto) : NaN;
      if (!Number.isInteger(diaNumero) || diaNumero < 1 || diaNumero > 31) erros.dia = 'Use um dia entre 1 e 31.';
      aluna.diaVencimento = diaNumero;
    } else {
      const texto = String(diaSemana ?? '').trim();
      if (!/^[0-6]$/.test(texto)) erros.diaSemana = 'Escolha o dia da semana.';
      aluna.diaSemana = Number(texto);
    }
    const lido = lerValor(valor);
    if (lido.erro) erros.valor = MSG_VALOR;
    aluna.valor = lido.valor ?? null;
  } else if (definicao) {
    const lidas = lerParcelas(parcelas, erros);
    if (plano === 'avulso') {
      aluna.parcelas = lidas;
    } else {
      const inicioTexto = String(inicio ?? '').trim();
      if (!deTexto(inicioTexto)) erros.inicio = 'Informe a data de início.';
      const total = lerValor(valorTotal);
      if (total.erro) erros.valorTotal = MSG_VALOR;
      aluna.periodo = { inicio: inicioTexto, valorTotal: total.valor ?? null, parcelas: lidas };

      if (total.valor != null && !erros.parcelas) {
        const soma = lidas.reduce((s, p) => s + Math.round(p.valor * 100), 0);
        if (soma !== Math.round(total.valor * 100)) {
          avisos.valorTotal = `As parcelas somam ${formatarValor(soma / 100)}, mas o total é ${formatarValor(total.valor)}.`;
        }
      }
    }
  }

  return { ok: Object.keys(erros).length === 0, erros, avisos, aluna };
}

// Períodos a gravar: na renovação o novo período entra depois dos antigos; na edição
// ele substitui o último. Se o plano mudou, o histórico do plano anterior não vale.
export function periodosAoSalvar(anterior, plano, periodo, renovar = false) {
  const antigos = anterior?.plano === plano ? (anterior.periodos ?? []) : [];
  return renovar ? [...antigos, periodo] : [...antigos.slice(0, -1), periodo];
}
