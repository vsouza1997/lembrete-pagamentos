import { h, mostrarErro } from './dom.js';
import { chaveDoMes, hojeEmSaoPaulo, resumoDoMes, statusDoMes } from '../core/vencimentos.js';
import { formatarValor } from '../core/mensagem.js';
import { listarAlunas } from '../data/alunas.js';
import { listarPagamentosDoMes } from '../data/pagamentos.js';

export const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export async function telaResumo(alvo, { db }) {
  alvo.replaceChildren(h('p', {}, 'Carregando…'));
  const hoje = hojeEmSaoPaulo();

  let alunas, pagamentos;
  try {
    [alunas, pagamentos] = await Promise.all([listarAlunas(db), listarPagamentosDoMes(db, chaveDoMes(hoje))]);
  } catch (erro) {
    mostrarErro(alvo, erro);
    return;
  }

  const r = resumoDoMes(statusDoMes(alunas, pagamentos, hoje));
  const numero = (rotulo, valor, classe = '') =>
    h('div', { class: `numero ${classe}` }, h('div', { class: 'valor' }, String(valor)), h('div', { class: 'rotulo' }, rotulo));

  alvo.replaceChildren(
    h('h2', {}, 'Alunas'),
    h(
      'div',
      { class: 'numeros' },
      numero('Alunas ativas', r.ativas),
      numero('Total por mês', formatarValor(r.totalMensal)),
    ),
    r.semValor > 0 &&
      h(
        'p',
        { class: 'detalhe' },
        r.semValor === 1
          ? '1 aluna está sem valor cadastrado e não entra nas somas.'
          : `${r.semValor} alunas estão sem valor cadastrado e não entram nas somas.`,
      ),
    h('h2', {}, `${MESES[hoje.mes - 1]} de ${hoje.ano}`),
    h(
      'div',
      { class: 'numeros' },
      numero('Recebido', formatarValor(r.recebido), 'paga'),
      numero('A receber', formatarValor(r.aReceber)),
      numero('Pagas', r.pagas, 'paga'),
      numero('Pendentes', r.pendentes, 'pendente'),
      numero('Atrasadas', r.atrasadas, 'atrasada'),
    ),
  );
}
