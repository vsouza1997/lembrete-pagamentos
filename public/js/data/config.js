import { doc, getDoc, setDoc } from '../firebase.js';
import { MENSAGEM_PADRAO } from '../core/mensagem.js';

// config/mensagem = { texto, pix }
export async function lerConfig(db) {
  const snap = await getDoc(doc(db, 'config', 'mensagem'));
  const dados = snap.exists() ? snap.data() : {};
  return { modelo: dados.texto || MENSAGEM_PADRAO, pix: dados.pix || '' };
}

export async function salvarConfig(db, { texto, pix }) {
  await setDoc(doc(db, 'config', 'mensagem'), { texto, pix });
}
