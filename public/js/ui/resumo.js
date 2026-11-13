import { h, mostrarErro } from './dom.js';
import { hojeEmSaoPaulo } from '../core/vencimentos.js';
import { resumoDoMes } from '../core/cobrancas.js';
import { formatarValor } from '../core/mensagem.js';
import { listarAlunas } from '../data/alunas.js';
import { listarPagamentos } from '../data/pagamentos.js';

export const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export async function telaResumo(alvo, { db }) {
  alvo.replaceChildren(h('p', {}, 'Carregando…'));
  const hoje = hojeEmSaoPaulo();

  let alunas, pagamentos;
  try {
    [alunas, pagamentos] = await Promise.all([listarAlunas(db), listarPagamentos(db)]);
  } catch (erro) {
    mostrarErro(alvo, erro);
    return;
  }

  const r = resumoDoMes(alunas, pagamentos, hoje);
  const numero = (rotulo, valor, classe = '') =>
    h('div', { class: `numero ${classe}` }, h('div', { class: 'valor' }, String(valor)), h('div', { class: 'rotulo' }, rotulo));

  alvo.replaceChildren(
    h('h2', {}, 'Alunas'),
    h('div', { class: 'numeros' }, numero('Alunas ativas', r.ativas)),
    r.porPlano.length > 0
      ? h('p', { class: 'detalhe' }, r.porPlano.map((p) => `${p.quantidade} ${p.rotulo.toLowerCase()}`).join(' · '))
      : '',
    h('h2', {}, `${MESES[hoje.mes - 1]} de ${hoje.ano}`),
    h(
      'div',
      { class: 'numeros' },
      numero('Previsto no mês', formatarValor(r.previsto)),
      numero('Recebido', formatarValor(r.recebido), 'paga'),
      numero('Falta receber', formatarValor(r.faltaReceber), 'pendente'),
      numero('Em atraso', formatarValor(r.emAtraso), 'atrasada'),
      numero('Cobranças pagas', r.pagas, 'paga'),
      numero('Pendentes', r.pendentes, 'pendente'),
      numero('Atrasadas', r.atrasadas, 'atrasada'),
    ),
    r.semValor > 0
      ? h(
        'p',
        { class: 'detalhe' },
        r.semValor === 1
          ? '1 cobrança deste mês está sem valor cadastrado e não entra nas somas.'
          : `${r.semValor} cobranças deste mês estão sem valor cadastrado e não entram nas somas.`,
      )
      : '',
    h('p', { class: 'detalhe' }, '"Em atraso" inclui parcelas de meses anteriores que ainda não foram pagas.'),
  );
}
