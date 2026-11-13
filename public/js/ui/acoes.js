import { MSG_SEM_INTERNET, estaOnline, h } from './dom.js';
import { formatarValor, renderMensagem } from '../core/mensagem.js';
import { desfazerPaga, marcarPaga } from '../data/pagamentos.js';

// Cartão de cobrança e botões Lembrar / Paga / Desfazer, usados nas telas Hoje e Calendário.
// `item` é uma cobrança: { aluna, data, valor, chave, diaTexto }.
export function criarAcoes({ db, sender, modelo, pix, recarregar }) {
  // Botão que grava no Firestore e recarrega a tela; em caso de falha, avisa no próprio botão.
  const botaoAcao = (rotulo, acao) => {
    const botao = h('button', { type: 'button', class: 'secundario' }, rotulo);
    botao.addEventListener('click', async () => {
      if (!estaOnline()) {
        botao.textContent = MSG_SEM_INTERNET;
        return;
      }
      botao.disabled = true;
      try {
        await acao();
        await recarregar();
      } catch (erro) {
        console.error(erro);
        botao.disabled = false;
        botao.textContent = 'Falhou, tente de novo';
      }
    });
    return botao;
  };

  return {
    cartao: ({ aluna, valor }, detalhe, acoes) =>
      h(
        'div',
        { class: 'cartao' },
        h('div', { class: 'nome' }, aluna.nome),
        h('div', { class: 'detalhe' }, [detalhe, formatarValor(valor)].filter(Boolean).join(' • ')),
        h('div', { class: 'acoes' }, acoes),
      ),

    // Só abre o WhatsApp; não recarrega a tela.
    lembrar: (item) => {
      const botao = h('button', { type: 'button', class: 'principal' }, 'Lembrar no WhatsApp');
      botao.addEventListener('click', async () => {
        try {
          const mensagem = renderMensagem(modelo, { nome: item.aluna.nome, valor: item.valor }, item.diaTexto, pix);
          await sender.enviar(item.aluna, mensagem);
        } catch (erro) {
          console.error(erro);
          botao.textContent = 'Falhou, tente de novo';
        }
      });
      return botao;
    },

    paga: (item) => botaoAcao('Paga', () => marcarPaga(db, item.aluna.id, item.chave)),
    desfazer: (item) => botaoAcao('Desfazer', () => desfazerPaga(db, item.aluna.id, item.chave)),
  };
}
