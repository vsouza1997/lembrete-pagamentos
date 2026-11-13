export function h(tag, atributos = {}, ...filhos) {
  const el = document.createElement(tag);
  for (const [chave, valor] of Object.entries(atributos)) {
    if (chave.startsWith('on')) el.addEventListener(chave.slice(2).toLowerCase(), valor);
    else if (valor === true) el.setAttribute(chave, '');
    else if (valor !== false && valor != null) el.setAttribute(chave, valor);
  }
  for (const filho of filhos.flat()) {
    if (filho == null || filho === false) continue;
    el.append(filho instanceof Node ? filho : document.createTextNode(String(filho)));
  }
  return el;
}

export function limpar(el) {
  el.replaceChildren();
}

export function mostrarErro(alvo, erro) {
  const semPermissao = erro?.code === 'permission-denied';
  alvo.replaceChildren(
    h(
      'p',
      { class: 'erro' },
      semPermissao
        ? 'Esta conta não tem acesso. Saia e entre com a conta correta.'
        : 'Não foi possível carregar. Verifique a internet e tente de novo.',
    ),
  );
}
