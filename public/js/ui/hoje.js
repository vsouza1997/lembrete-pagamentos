import { h, mostrarErro } from './dom.js';
import { criarAcoes } from './acoes.js';
import { chaveDoMes, formatarData, hojeEmSaoPaulo, listasDoDia } from '../core/vencimentos.js';
import { listarAlunas } from '../data/alunas.js';
import { listarPagamentosDoMes } from '../data/pagamentos.js';
import { lerConfig } from '../data/config.js';

function textoAtraso(dias) {
  return dias === 1 ? '1 dia de atraso' : `${dias} dias de atraso`;
}

export async function telaHoje(alvo, { db, sender }) {
  alvo.replaceChildren(h('p', {}, 'Carregando…'));
  const hoje = hojeEmSaoPaulo();
  const mes = chaveDoMes(hoje);

  let alunas, pagamentos, config;
  try {
    [alunas, pagamentos, config] = await Promise.all([
      listarAlunas(db),
      listarPagamentosDoMes(db, mes),
      lerConfig(db),
    ]);
  } catch (erro) {
    mostrarErro(alvo, erro);
    return;
  }

  const acoes = criarAcoes({ db, sender, ...config, recarregar: () => telaHoje(alvo, { db, sender }) });
  const listas = listasDoDia(alunas, pagamentos, hoje);

  const secao = (titulo, itens, vazio, montar) =>
    h('section', {}, h('h2', {}, `${titulo} (${itens.length})`), itens.length ? itens.map(montar) : h('p', { class: 'vazio' }, vazio));

  alvo.replaceChildren(
    h('p', { class: 'detalhe' }, `Hoje: ${formatarData(hoje)}`),
    secao('Vencem hoje', listas.venceHoje, 'Ninguém vence hoje 🎉', (item) =>
      acoes.cartao(item, `Vence dia ${item.diaEfetivo}`, [acoes.lembrar(item), acoes.paga(item, mes)]),
    ),
    secao('Atrasadas', listas.atrasadas, 'Nenhuma aluna atrasada.', (item) =>
      acoes.cartao(item, `Venceu dia ${item.diaEfetivo} (${textoAtraso(hoje.dia - item.diaEfetivo)})`, [
        acoes.lembrar(item),
        acoes.paga(item, mes),
      ]),
    ),
    secao('Pagas neste mês', listas.pagas, 'Nenhuma paga ainda.', (item) =>
      acoes.cartao(item, 'Paga neste mês', [acoes.desfazer(item, mes)]),
    ),
  );
}
