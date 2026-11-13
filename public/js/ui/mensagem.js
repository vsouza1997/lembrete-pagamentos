import { MSG_SEM_INTERNET, estaOnline, h, mostrarErro } from './dom.js';
import { MENSAGEM_PADRAO, partesWhatsapp, renderMensagem } from '../core/mensagem.js';
import { lerConfig, salvarConfig } from '../data/config.js';

const EXEMPLO = { nome: 'Maria Souza', valor: 150 };

export async function telaMensagem(alvo, { db }) {
  alvo.replaceChildren(h('p', {}, 'Carregando…'));
  let config;
  try {
    config = await lerConfig(db);
  } catch (erro) {
    mostrarErro(alvo, erro);
    return;
  }

  const pix = h('input', { name: 'pix', autocomplete: 'off', autocapitalize: 'off', value: config.pix });
  const texto = h('textarea', { rows: 10, name: 'modelo' });
  texto.value = config.modelo;
  const previa = h('div', { class: 'previa' });
  const status = h('small', {}, '');

  // Prévia com o negrito do WhatsApp (*assim*).
  const atualizar = () => {
    const mensagem = renderMensagem(texto.value, EXEMPLO, 10, pix.value);
    previa.replaceChildren(
      ...partesWhatsapp(mensagem).map((parte) => (parte.negrito ? h('strong', {}, parte.texto) : parte.texto)),
    );
  };
  texto.addEventListener('input', atualizar);
  pix.addEventListener('input', atualizar);
  atualizar();

  const salvar = h('button', { type: 'button', class: 'principal' }, 'Salvar');
  salvar.addEventListener('click', async () => {
    if (!estaOnline()) {
      status.className = 'erro';
      status.textContent = MSG_SEM_INTERNET;
      return;
    }
    salvar.disabled = true;
    try {
      await salvarConfig(db, { texto: texto.value.trim() || MENSAGEM_PADRAO, pix: pix.value.trim() });
      status.className = '';
      status.textContent = 'Salvo ✓';
    } catch (erro) {
      console.error(erro);
      status.className = 'erro';
      status.textContent = 'Não foi possível salvar. Tente de novo.';
    }
    salvar.disabled = false;
  });

  const restaurar = h('button', { type: 'button', class: 'link' }, 'Restaurar padrão');
  restaurar.addEventListener('click', () => {
    texto.value = MENSAGEM_PADRAO;
    atualizar();
  });

  alvo.replaceChildren(
    h('h2', {}, 'Mensagem do lembrete'),
    h(
      'form',
      { onSubmit: (e) => e.preventDefault() },
      h('label', {}, 'Chave Pix', pix),
      h('label', {}, 'Texto', texto),
    ),
    h(
      'p',
      { class: 'detalhe' },
      'Use {nome} (primeiro nome), {dia}, {valor} e {pix}. Para negrito, coloque o trecho entre *asteriscos*. ' +
        'A linha do valor ou do Pix some da mensagem quando não há valor ou chave cadastrada.',
    ),
    h('h2', {}, 'Prévia'),
    previa,
    h('p', {}, salvar, restaurar),
    status,
  );
}
