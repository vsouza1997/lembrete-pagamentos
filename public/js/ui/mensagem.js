import { h, mostrarErro } from './dom.js';
import { MENSAGEM_PADRAO, renderMensagem } from '../core/mensagem.js';
import { lerModelo, salvarModelo } from '../data/config.js';

const EXEMPLO = { nome: 'Maria Souza', valor: 150 };

export async function telaMensagem(alvo, { db }) {
  alvo.replaceChildren(h('p', {}, 'Carregando…'));
  let modelo;
  try {
    modelo = await lerModelo(db);
  } catch (erro) {
    mostrarErro(alvo, erro);
    return;
  }

  const texto = h('textarea', { rows: 5, name: 'modelo' });
  texto.value = modelo;
  const previa = h('div', { class: 'previa' });
  const status = h('small', {}, '');
  const atualizar = () => {
    previa.textContent = renderMensagem(texto.value, EXEMPLO, 10);
  };
  texto.addEventListener('input', atualizar);
  atualizar();

  const salvar = h('button', { type: 'button', class: 'principal' }, 'Salvar mensagem');
  salvar.addEventListener('click', async () => {
    salvar.disabled = true;
    try {
      await salvarModelo(db, texto.value.trim() || MENSAGEM_PADRAO);
      status.className = '';
      status.textContent = 'Mensagem salva ✓';
    } catch {
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
    h('p', { class: 'detalhe' }, 'Use {nome} (primeiro nome), {dia} e {valor}.'),
    h('form', { onSubmit: (e) => e.preventDefault() }, h('label', {}, 'Texto', texto)),
    h('h2', {}, 'Prévia'),
    previa,
    h('p', {}, salvar, restaurar),
    status,
  );
}
