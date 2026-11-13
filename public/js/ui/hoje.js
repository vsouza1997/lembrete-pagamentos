import { h, mostrarErro } from './dom.js';
import { criarAcoes } from './acoes.js';
import { formatarData, hojeEmSaoPaulo } from '../core/vencimentos.js';
import { listasDoDia, planoDe } from '../core/cobrancas.js';
import { listarAlunas } from '../data/alunas.js';
import { listarPagamentos } from '../data/pagamentos.js';
import { lerConfig } from '../data/config.js';

function textoAtraso(dias) {
  return dias === 1 ? '1 dia de atraso' : `${dias} dias de atraso`;
}

function textoFim({ fim, diasParaFim }) {
  if (diasParaFim < 0) return `terminou em ${formatarData(fim)}`;
  if (diasParaFim === 0) return 'termina hoje';
  return `termina em ${formatarData(fim)}`;
}

export async function telaHoje(alvo, { db, sender, navegar }) {
  alvo.replaceChildren(h('p', {}, 'Carregando…'));
  const hoje = hojeEmSaoPaulo();

  let alunas, pagamentos, config;
  try {
    [alunas, pagamentos, config] = await Promise.all([listarAlunas(db), listarPagamentos(db), lerConfig(db)]);
  } catch (erro) {
    mostrarErro(alvo, erro);
    return;
  }

  const acoes = criarAcoes({ db, sender, ...config, recarregar: () => telaHoje(alvo, { db, sender, navegar }) });
  const listas = listasDoDia(alunas, pagamentos, hoje);
  const plano = (item) => planoDe(item.aluna).rotulo;

  const secao = (titulo, itens, vazio, montar) =>
    h('section', {}, h('h2', {}, `${titulo} (${itens.length})`), itens.length ? itens.map(montar) : h('p', { class: 'vazio' }, vazio));

  const renovar = (item) =>
    h('button', { type: 'button', class: 'principal', onClick: () => navegar('alunas', { renovarId: item.aluna.id }) }, 'Renovar');

  alvo.replaceChildren(
    h('p', { class: 'detalhe' }, `Hoje: ${formatarData(hoje)}`),
    listas.terminando.length > 0
      ? secao('Planos terminando', listas.terminando, '', (item) =>
        acoes.cartao({ aluna: item.aluna, valor: null }, `${plano(item)} • ${textoFim(item)}`, [renovar(item)]),
      )
      : '',
    secao('Vencem hoje', listas.venceHoje, 'Ninguém vence hoje 🎉', (item) =>
      acoes.cartao(item, `${plano(item)} • vence hoje`, [acoes.lembrar(item), acoes.paga(item)]),
    ),
    secao('Atrasadas', listas.atrasadas, 'Nenhuma cobrança atrasada.', (item) =>
      acoes.cartao(item, `${plano(item)} • venceu ${formatarData(item.data)} (${textoAtraso(item.diasDeAtraso)})`, [
        acoes.lembrar(item),
        acoes.paga(item),
      ]),
    ),
    secao('Pagas neste mês', listas.pagas, 'Nenhuma paga ainda.', (item) =>
      acoes.cartao(item, `${plano(item)} • venc. ${formatarData(item.data)}`, [acoes.desfazer(item)]),
    ),
  );
}
