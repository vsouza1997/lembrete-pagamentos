import { h, mostrarErro } from './dom.js';
import { chaveDoMes, hojeEmSaoPaulo, listasDoDia } from '../core/vencimentos.js';
import { formatarValor, renderMensagem } from '../core/mensagem.js';
import { listarAlunas } from '../data/alunas.js';
import { desfazerPaga, listarPagamentosDoMes, marcarPaga } from '../data/pagamentos.js';
import { lerModelo } from '../data/config.js';

function textoAtraso(dias) {
  return dias === 1 ? '1 dia de atraso' : `${dias} dias de atraso`;
}

export async function telaHoje(alvo, { db, sender }) {
  alvo.replaceChildren(h('p', {}, 'Carregando…'));
  const hoje = hojeEmSaoPaulo();
  const mes = chaveDoMes(hoje);

  let alunas, pagamentos, modelo;
  try {
    [alunas, pagamentos, modelo] = await Promise.all([
      listarAlunas(db),
      listarPagamentosDoMes(db, mes),
      lerModelo(db),
    ]);
  } catch (erro) {
    mostrarErro(alvo, erro);
    return;
  }

  const recarregar = () => telaHoje(alvo, { db, sender });
  const listas = listasDoDia(alunas, pagamentos, hoje);

  // Botão que executa uma ação assíncrona e recarrega a tela; em caso de falha, avisa no próprio botão.
  const botaoAcao = (rotulo, classe, acao) => {
    const botao = h('button', { type: 'button', class: classe }, rotulo);
    botao.addEventListener('click', async () => {
      botao.disabled = true;
      try {
        await acao();
        await recarregar();
      } catch {
        botao.disabled = false;
        botao.textContent = 'Falhou, tente de novo';
      }
    });
    return botao;
  };

  const cartao = ({ aluna, diaEfetivo }, detalhe, acoes) =>
    h(
      'div',
      { class: 'cartao' },
      h('div', { class: 'nome' }, aluna.nome),
      h('div', { class: 'detalhe' }, [detalhe, formatarValor(aluna.valor)].filter(Boolean).join(' • ')),
      h('div', { class: 'acoes' }, acoes),
    );

  const botaoPaga = (item) => botaoAcao('Paga', 'secundario', () => marcarPaga(db, item.aluna.id, mes));
  const botaoDesfazer = (item) => botaoAcao('Desfazer', 'secundario', () => desfazerPaga(db, item.aluna.id, mes));

  // O botão Lembrar só abre o WhatsApp; não deve recarregar a tela.
  const lembrarSemRecarregar = (item) => {
    const botao = h('button', { type: 'button', class: 'principal' }, 'Lembrar no WhatsApp');
    botao.addEventListener('click', () =>
      sender.enviar(item.aluna, renderMensagem(modelo, item.aluna, item.diaEfetivo)),
    );
    return botao;
  };

  const secao = (titulo, itens, vazio, montar) =>
    h('section', {}, h('h2', {}, `${titulo} (${itens.length})`), itens.length ? itens.map(montar) : h('p', { class: 'vazio' }, vazio));

  alvo.replaceChildren(
    secao('Vencem hoje', listas.venceHoje, 'Ninguém vence hoje 🎉', (item) =>
      cartao(item, `Vence dia ${item.diaEfetivo}`, [lembrarSemRecarregar(item), botaoPaga(item)]),
    ),
    secao('Atrasadas', listas.atrasadas, 'Nenhuma aluna atrasada.', (item) =>
      cartao(item, `Venceu dia ${item.diaEfetivo} (${textoAtraso(hoje.dia - item.diaEfetivo)})`, [
        lembrarSemRecarregar(item),
        botaoPaga(item),
      ]),
    ),
    secao('Pagas neste mês', listas.pagas, 'Nenhuma paga ainda.', (item) =>
      cartao(item, 'Paga neste mês', [botaoDesfazer(item)]),
    ),
  );
}
