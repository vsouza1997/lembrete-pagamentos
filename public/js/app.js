import { db, observarLogin, entrarComGoogle, sair } from './firebase.js';
import { h, limpar } from './ui/dom.js';
import { WaMeSender } from './core/sender.js';
import { telaHoje } from './ui/hoje.js';
import { telaAlunas } from './ui/alunas.js';
import { telaMensagem } from './ui/mensagem.js';

const raiz = document.getElementById('app');
const sender = new WaMeSender();

const TELAS = [
  { id: 'hoje', titulo: 'Hoje', montar: (alvo) => telaHoje(alvo, { db, sender }) },
  { id: 'alunas', titulo: 'Alunas', montar: (alvo) => telaAlunas(alvo, { db }) },
  { id: 'mensagem', titulo: 'Mensagem', montar: (alvo) => telaMensagem(alvo, { db }) },
];

function mostrarLogin(mensagemErro = '') {
  limpar(raiz);
  raiz.append(
    h(
      'div',
      { class: 'login' },
      h('h1', {}, 'Lembretes de pagamento'),
      h(
        'button',
        {
          type: 'button',
          class: 'principal',
          onClick: () => entrarComGoogle().catch(() => mostrarLogin('Não foi possível entrar. Tente de novo.')),
        },
        'Entrar com Google',
      ),
      mensagemErro && h('p', { class: 'erro' }, mensagemErro),
    ),
  );
}

function mostrarApp() {
  limpar(raiz);
  const conteudo = h('section', { class: 'conteudo' });
  const botoes = TELAS.map((tela) =>
    h('button', { type: 'button', onClick: () => abrir(tela) }, tela.titulo),
  );

  function abrir(tela) {
    botoes.forEach((botao, i) => botao.classList.toggle('ativa', TELAS[i] === tela));
    const alvo = h('div');
    conteudo.replaceChildren(alvo);
    tela.montar(alvo);
  }

  raiz.append(
    h(
      'header',
      { class: 'topo' },
      h('h1', {}, 'Lembretes'),
      h('button', { type: 'button', class: 'link', onClick: sair }, 'Sair'),
    ),
    h('nav', { class: 'abas' }, botoes),
    conteudo,
  );
  abrir(TELAS[0]);
}

observarLogin((usuario) => (usuario ? mostrarApp() : mostrarLogin()));
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
