import { MSG_SEM_INTERNET, estaOnline, h, mostrarErro } from './dom.js';
import { periodosAoSalvar, validarAluna } from '../core/aluna.js';
import { DIAS_DA_SEMANA, PLANOS, fimDoPeriodo, planoDe, proximoPeriodo, resumoDoPlano } from '../core/cobrancas.js';
import { deTexto, paraTexto } from '../core/datas.js';
import { formatarData, hojeEmSaoPaulo } from '../core/vencimentos.js';
import { formatarValor } from '../core/mensagem.js';
import { listarAlunas, salvarAluna } from '../data/alunas.js';

const mesesDoPlano = (id) => PLANOS.find((p) => p.id === id)?.meses;
const valorParaCampo = (valor) => (valor == null || valor === '' ? '' : String(valor).replace('.', ','));
const numeroDoCampo = (texto) => {
  const n = Number(String(texto).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

function campo(rotulo, controle) {
  const titulo = h('span', {}, rotulo);
  const erro = h('small', { class: 'erro' });
  return { input: controle, titulo, erro, el: h('label', {}, titulo, controle, erro) };
}

// Valores com que o formulário abre: nova aluna, edição ou renovação do período.
function valoresIniciais(aluna, renovar) {
  const hoje = paraTexto(hojeEmSaoPaulo());
  const plano = aluna?.plano ?? 'mensal';
  const meses = mesesDoPlano(plano);
  const ultimo = aluna?.periodos?.at(-1);
  let periodo = { inicio: hoje, valorTotal: null, parcelas: [] };
  if (meses && ultimo) periodo = renovar ? proximoPeriodo(ultimo, meses) : ultimo;
  const parcelas = plano === 'avulso' ? (aluna?.parcelas ?? []) : periodo.parcelas;
  return { plano, periodo, parcelas: parcelas.length ? parcelas : [{ data: hoje, valor: '' }] };
}

// Lista editável de parcelas (data + valor), com botão para adicionar e remover.
function editorDeParcelas(iniciais, aoMudar) {
  const lista = h('div', { class: 'parcelas' });
  const linhas = [];

  const adicionar = ({ data = '', valor = '' } = {}) => {
    const inputData = h('input', { type: 'date', value: data, 'aria-label': 'Data da parcela' });
    const inputValor = h('input', { inputmode: 'decimal', placeholder: 'Valor', value: valorParaCampo(valor), 'aria-label': 'Valor da parcela' });
    const linha = { inputData, inputValor };
    const el = h('div', { class: 'parcela' }, inputData, inputValor);
    el.append(
      h(
        'button',
        {
          type: 'button',
          class: 'link',
          'aria-label': 'Remover parcela',
          onClick: () => {
            linhas.splice(linhas.indexOf(linha), 1);
            el.remove();
            aoMudar();
          },
        },
        '✕',
      ),
    );
    inputData.addEventListener('input', aoMudar);
    inputValor.addEventListener('input', aoMudar);
    linhas.push(linha);
    lista.append(el);
    aoMudar();
  };

  iniciais.forEach(adicionar);
  const maisUma = h('button', { type: 'button', class: 'secundario', onClick: () => adicionar() }, '+ Parcela');
  return {
    el: h('div', {}, lista, maisUma),
    valores: () => linhas.map((l) => ({ data: l.inputData.value, valor: l.inputValor.value })),
  };
}

function formulario(db, { aluna = null, renovar = false }, aoSalvar, aoCancelar) {
  const iniciais = valoresIniciais(aluna, renovar);

  const nome = campo('Nome', h('input', { name: 'nome', autocomplete: 'off', value: aluna?.nome ?? '' }));
  const telefone = campo(
    'WhatsApp (com DDD)',
    h('input', { name: 'telefone', type: 'tel', inputmode: 'tel', value: aluna ? aluna.telefone.replace(/^55/, '') : '' }),
  );
  const plano = campo(
    'Plano',
    h('select', { name: 'plano' }, PLANOS.map((p) => h('option', { value: p.id, selected: p.id === iniciais.plano }, p.rotulo))),
  );
  const dia = campo(
    'Dia do vencimento',
    h('input', { name: 'dia', type: 'number', min: 1, max: 31, inputmode: 'numeric', value: aluna?.diaVencimento ?? '' }),
  );
  const diaSemana = campo(
    'Dia da semana',
    h('select', { name: 'diaSemana' }, DIAS_DA_SEMANA.map((nomeDia, i) => h('option', { value: i, selected: i === (aluna?.diaSemana ?? 1) }, nomeDia))),
  );
  const valor = campo('Valor (opcional)', h('input', { name: 'valor', inputmode: 'decimal', value: valorParaCampo(aluna?.valor) }));
  const inicio = campo('Início do período', h('input', { name: 'inicio', type: 'date', value: iniciais.periodo.inicio }));
  const valorTotal = campo(
    'Valor total (opcional)',
    h('input', { name: 'valorTotal', inputmode: 'decimal', value: valorParaCampo(iniciais.periodo.valorTotal) }),
  );
  const periodoTexto = h('p', { class: 'detalhe' });
  const somaTexto = h('p', { class: 'detalhe' });
  const parcelasErro = h('small', { class: 'erro' });
  const secaoParcelas = h('div', { class: 'secao-parcelas' }, h('span', {}, 'Parcelas (data e valor)'));

  let editor = null;
  const atualizar = () => {
    const id = plano.input.value;
    const meses = mesesDoPlano(id);
    dia.el.hidden = id !== 'mensal';
    diaSemana.el.hidden = id !== 'semanal';
    valor.el.hidden = id !== 'mensal' && id !== 'semanal';
    valor.titulo.textContent = id === 'semanal' ? 'Valor por semana (opcional)' : 'Valor (opcional)';
    inicio.el.hidden = !meses;
    valorTotal.el.hidden = !meses;
    periodoTexto.hidden = !meses;
    secaoParcelas.hidden = !meses && id !== 'avulso';
    if (!editor) return;

    const ini = deTexto(inicio.input.value);
    periodoTexto.textContent =
      meses && ini ? `Período: ${formatarData(ini)} a ${formatarData(fimDoPeriodo({ inicio: inicio.input.value }, meses))}` : '';
    const soma = editor.valores().reduce((s, p) => s + Math.round(numeroDoCampo(p.valor) * 100), 0) / 100;
    const totalTexto = valorTotal.input.value.trim();
    const total = numeroDoCampo(totalTexto);
    const diferente = meses && totalTexto !== '' && Math.round(total * 100) !== Math.round(soma * 100);
    somaTexto.textContent = `Soma das parcelas: ${formatarValor(soma)}${diferente ? ` (o total informado é ${formatarValor(total)})` : ''}`;
    somaTexto.className = diferente ? 'detalhe aviso' : 'detalhe';
  };

  editor = editorDeParcelas(iniciais.parcelas, atualizar);
  secaoParcelas.append(editor.el, somaTexto, parcelasErro);
  plano.input.addEventListener('change', atualizar);
  inicio.input.addEventListener('input', atualizar);
  valorTotal.input.addEventListener('input', atualizar);
  atualizar();

  const campos = { nome, telefone, plano, dia, diaSemana, valor, inicio, valorTotal };
  const geral = h('small', { class: 'erro' });
  const rotuloBotao = renovar ? 'Salvar renovação' : aluna ? 'Salvar alterações' : 'Adicionar aluna';
  const botao = h('button', { type: 'submit', class: 'principal' }, rotuloBotao);
  const titulo = renovar ? `Renovar plano de ${aluna.nome}` : aluna ? 'Editar aluna' : 'Nova aluna';

  return h(
    'form',
    {
      onSubmit: async (evento) => {
        evento.preventDefault();
        const r = validarAluna({
          nome: nome.input.value,
          telefone: telefone.input.value,
          plano: plano.input.value,
          dia: dia.input.value,
          diaSemana: diaSemana.input.value,
          valor: valor.input.value,
          inicio: inicio.input.value,
          valorTotal: valorTotal.input.value,
          parcelas: editor.valores(),
        });
        for (const [chave, c] of Object.entries(campos)) c.erro.textContent = r.erros[chave] ?? '';
        parcelasErro.textContent = r.erros.parcelas ?? '';
        if (!r.ok) return;

        geral.textContent = '';
        if (!estaOnline()) {
          geral.textContent = MSG_SEM_INTERNET;
          return;
        }
        const { periodo, ...dados } = r.aluna;
        if (periodo) dados.periodos = periodosAoSalvar(aluna, dados.plano, periodo, renovar);
        botao.disabled = true;
        try {
          await salvarAluna(db, { ...dados, ativa: aluna?.ativa ?? true, id: aluna?.id });
          aoSalvar();
        } catch (erro) {
          console.error(erro);
          botao.disabled = false;
          geral.textContent = 'Não foi possível salvar. Tente de novo.';
        }
      },
    },
    h('h2', {}, titulo),
    nome.el,
    telefone.el,
    plano.el,
    dia.el,
    diaSemana.el,
    valor.el,
    inicio.el,
    valorTotal.el,
    periodoTexto,
    secaoParcelas,
    geral,
    botao,
    aluna && h('button', { type: 'button', class: 'link', onClick: aoCancelar }, 'Cancelar'),
  );
}

function linhaAluna(aluna, { aoEditar, aoRenovar, aoAlternar }) {
  const alternar = h('button', { type: 'button', class: 'secundario' }, aluna.ativa ? 'Desativar' : 'Ativar');
  alternar.addEventListener('click', async () => {
    if (!estaOnline()) {
      alternar.textContent = MSG_SEM_INTERNET;
      return;
    }
    alternar.disabled = true;
    try {
      await aoAlternar();
    } catch (erro) {
      console.error(erro);
      alternar.disabled = false;
      alternar.textContent = 'Falhou, tente de novo';
    }
  });
  const podeRenovar = Boolean(planoDe(aluna).meses && aluna.periodos?.length);
  return h(
    'div',
    { class: aluna.ativa ? 'cartao' : 'cartao inativa' },
    h('div', { class: 'nome' }, aluna.ativa ? aluna.nome : `${aluna.nome} (inativa)`),
    h('div', { class: 'detalhe' }, `${resumoDoPlano(aluna)} • +${aluna.telefone}`),
    h(
      'div',
      { class: 'acoes' },
      h('button', { type: 'button', class: 'secundario', onClick: aoEditar }, 'Editar'),
      podeRenovar ? h('button', { type: 'button', class: 'secundario', onClick: aoRenovar }, 'Renovar') : null,
      alternar,
    ),
  );
}

// `opcoes.renovarId`: abre direto o formulário de renovação dessa aluna (vindo da tela Hoje).
export async function telaAlunas(alvo, { db }, opcoes = {}) {
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
  const desenhar = (estado) => {
    alvo.replaceChildren(
      formulario(db, estado, recarregar, () => desenhar({})),
      h('h2', {}, `Alunas (${alunas.length})`),
      alunas.length ? null : h('p', { class: 'vazio' }, 'Nenhuma aluna cadastrada ainda.'),
      ...alunas.map((aluna) =>
        linhaAluna(aluna, {
          aoEditar: () => {
            desenhar({ aluna });
            window.scrollTo(0, 0);
          },
          aoRenovar: () => {
            desenhar({ aluna, renovar: true });
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

  const paraRenovar = alunas.find((a) => a.id === opcoes.renovarId);
  desenhar(paraRenovar ? { aluna: paraRenovar, renovar: true } : {});
}
