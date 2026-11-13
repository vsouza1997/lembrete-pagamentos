import { MSG_SEM_INTERNET, estaOnline, h, mostrarErro } from './dom.js';
import { validarAluna } from '../core/aluna.js';
import { formatarValor } from '../core/mensagem.js';
import { listarAlunas, salvarAluna } from '../data/alunas.js';

function formulario(db, aluna, aoSalvar, aoCancelar) {
  const campo = (rotulo, atributos) => {
    const input = h('input', atributos);
    const erro = h('small', { class: 'erro' });
    return { input, erro, el: h('label', {}, rotulo, input, erro) };
  };

  const nome = campo('Nome', { name: 'nome', autocomplete: 'off', value: aluna?.nome ?? '' });
  const telefone = campo('WhatsApp (com DDD)', {
    name: 'telefone',
    type: 'tel',
    inputmode: 'tel',
    value: aluna ? aluna.telefone.replace(/^55/, '') : '',
  });
  const dia = campo('Dia do vencimento', {
    name: 'dia',
    type: 'number',
    min: 1,
    max: 31,
    inputmode: 'numeric',
    value: aluna?.diaVencimento ?? '',
  });
  const valor = campo('Valor (opcional)', { name: 'valor', inputmode: 'decimal', value: aluna?.valor ?? '' });
  const campos = { nome, telefone, dia, valor };

  const geral = h('small', { class: 'erro' });
  const botao = h('button', { type: 'submit', class: 'principal' }, aluna ? 'Salvar alterações' : 'Adicionar aluna');

  const form = h(
    'form',
    {
      onSubmit: async (evento) => {
        evento.preventDefault();
        const r = validarAluna({
          nome: nome.input.value,
          telefone: telefone.input.value,
          dia: dia.input.value,
          valor: valor.input.value,
        });
        for (const [chave, c] of Object.entries(campos)) c.erro.textContent = r.erros[chave] ?? '';
        if (!r.ok) return;

        geral.textContent = '';
        if (!estaOnline()) {
          geral.textContent = MSG_SEM_INTERNET;
          return;
        }
        botao.disabled = true;
        try {
          await salvarAluna(db, { ...r.aluna, ativa: aluna?.ativa ?? true, id: aluna?.id });
          aoSalvar();
        } catch {
          botao.disabled = false;
          geral.textContent = 'Não foi possível salvar. Tente de novo.';
        }
      },
    },
    h('h2', {}, aluna ? 'Editar aluna' : 'Nova aluna'),
    nome.el,
    telefone.el,
    dia.el,
    valor.el,
    geral,
    botao,
    aluna && h('button', { type: 'button', class: 'link', onClick: aoCancelar }, 'Cancelar'),
  );
  return form;
}

function linhaAluna(aluna, { aoEditar, aoAlternar }) {
  const detalhe = [`dia ${aluna.diaVencimento}`, formatarValor(aluna.valor), `+${aluna.telefone}`]
    .filter(Boolean)
    .join(' • ');
  const alternar = h('button', { type: 'button', class: 'secundario' }, aluna.ativa ? 'Desativar' : 'Ativar');
  alternar.addEventListener('click', async () => {
    if (!estaOnline()) {
      alternar.textContent = MSG_SEM_INTERNET;
      return;
    }
    alternar.disabled = true;
    try {
      await aoAlternar();
    } catch {
      alternar.disabled = false;
      alternar.textContent = 'Falhou, tente de novo';
    }
  });
  return h(
    'div',
    { class: aluna.ativa ? 'cartao' : 'cartao inativa' },
    h('div', { class: 'nome' }, aluna.ativa ? aluna.nome : `${aluna.nome} (inativa)`),
    h('div', { class: 'detalhe' }, detalhe),
    h('div', { class: 'acoes' }, h('button', { type: 'button', class: 'secundario', onClick: aoEditar }, 'Editar'), alternar),
  );
}

export async function telaAlunas(alvo, { db }) {
  alvo.replaceChildren(h('p', {}, 'Carregando…'));
  let alunas;
  try {
    alunas = await listarAlunas(db);
  } catch (erro) {
    mostrarErro(alvo, erro);
    return;
  }
  alunas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  const recarregar = () => telaAlunas(alvo, { db });
  const desenhar = (editando) => {
    alvo.replaceChildren(
      formulario(db, editando, recarregar, () => desenhar(null)),
      h('h2', {}, `Alunas (${alunas.length})`),
      alunas.length ? '' : h('p', { class: 'vazio' }, 'Nenhuma aluna cadastrada ainda.'),
      ...alunas.map((aluna) =>
        linhaAluna(aluna, {
          aoEditar: () => {
            desenhar(aluna);
            window.scrollTo(0, 0);
          },
          aoAlternar: async () => {
            await salvarAluna(db, { ...aluna, ativa: !aluna.ativa });
            await recarregar();
          },
        }),
      ),
    );
  };
  desenhar(null);
}
