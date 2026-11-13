import { h, mostrarErro } from './dom.js';
import { criarAcoes } from './acoes.js';
import { MESES } from './resumo.js';
import { chaveDoMes, hojeEmSaoPaulo, mesVizinho, semanasDoMes, statusDoMes } from '../core/vencimentos.js';
import { listarAlunas } from '../data/alunas.js';
import { listarPagamentosDoMes } from '../data/pagamentos.js';
import { lerConfig } from '../data/config.js';

const DIAS_DA_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const ROTULO = {
  paga: 'Paga',
  pendente: 'Pendente',
  atrasada: 'Atrasada',
  semRegistro: 'Sem pagamento registrado',
};
const ORDEM = ['atrasada', 'pendente', 'paga', 'semRegistro'];

// `ref` = mês mostrado ({ ano, mes }); `diaSelecionado` = dia cuja lista aparece embaixo.
export async function telaCalendario(alvo, { db, sender }, ref = null, diaSelecionado = null) {
  alvo.replaceChildren(h('p', {}, 'Carregando…'));
  const hoje = hojeEmSaoPaulo();
  const mesRef = ref ?? { ano: hoje.ano, mes: hoje.mes };
  const mesAtual = mesRef.ano === hoje.ano && mesRef.mes === hoje.mes;
  const chave = chaveDoMes(mesRef);

  let alunas, pagamentos, config;
  try {
    [alunas, pagamentos, config] = await Promise.all([
      listarAlunas(db),
      listarPagamentosDoMes(db, chave),
      lerConfig(db),
    ]);
  } catch (erro) {
    mostrarErro(alvo, erro);
    return;
  }

  const itens = statusDoMes(alunas, pagamentos, hoje, mesRef);
  const porDia = new Map();
  for (const item of itens) porDia.set(item.diaEfetivo, [...(porDia.get(item.diaEfetivo) ?? []), item]);

  const dia = diaSelecionado ?? (mesAtual ? hoje.dia : null);
  const ir = (novoRef, novoDia = null) => telaCalendario(alvo, { db, sender }, novoRef, novoDia);
  const acoes = criarAcoes({ db, sender, ...config, recarregar: () => ir(mesRef, dia) });

  const celula = (numero) => {
    if (numero === null) return h('div', { class: 'dia vazio' });
    const doDia = porDia.get(numero) ?? [];
    const classes = ['dia', numero === dia && 'selecionado', mesAtual && numero === hoje.dia && 'hoje']
      .filter(Boolean)
      .join(' ');
    const marcas = ORDEM.filter((status) => doDia.some((i) => i.status === status)).map((status) =>
      h('span', { class: `marca ${status}` }, String(doDia.filter((i) => i.status === status).length)),
    );
    return h(
      'button',
      { type: 'button', class: classes, onClick: () => ir(mesRef, numero) },
      h('span', { class: 'numero-dia' }, String(numero)),
      h('span', { class: 'marcas' }, marcas),
    );
  };

  const cartaoDoDia = (item) => {
    const botoes =
      item.status === 'paga' ? [acoes.desfazer(item, chave)] : [acoes.lembrar(item), acoes.paga(item, chave)];
    return acoes.cartao(item, ROTULO[item.status], botoes);
  };

  const doDiaSelecionado = dia === null ? [] : (porDia.get(dia) ?? []);

  alvo.replaceChildren(
    h(
      'div',
      { class: 'mes' },
      h('button', { type: 'button', class: 'secundario', 'aria-label': 'Mês anterior', onClick: () => ir(mesVizinho(mesRef, -1)) }, '‹'),
      h('strong', {}, `${MESES[mesRef.mes - 1]} de ${mesRef.ano}`),
      h('button', { type: 'button', class: 'secundario', 'aria-label': 'Próximo mês', onClick: () => ir(mesVizinho(mesRef, 1)) }, '›'),
    ),
    h(
      'div',
      { class: 'grade' },
      DIAS_DA_SEMANA.map((letra) => h('div', { class: 'semana' }, letra)),
      semanasDoMes(mesRef.ano, mesRef.mes).flat().map(celula),
    ),
    h(
      'p',
      { class: 'legenda' },
      h('span', { class: 'marca atrasada' }, ' '), ' atrasada ',
      h('span', { class: 'marca pendente' }, ' '), ' pendente ',
      h('span', { class: 'marca paga' }, ' '), ' paga',
    ),
    dia === null
      ? h('p', { class: 'vazio' }, 'Toque num dia para ver as alunas.')
      : h(
          'section',
          {},
          h('h2', {}, `Dia ${dia} (${doDiaSelecionado.length})`),
          doDiaSelecionado.length
            ? doDiaSelecionado.map(cartaoDoDia)
            : h('p', { class: 'vazio' }, 'Nenhum vencimento neste dia.'),
        ),
  );
}
