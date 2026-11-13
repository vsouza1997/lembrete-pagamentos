import { doc, getDoc, setDoc } from '../firebase.js';
import { MENSAGEM_PADRAO } from '../core/mensagem.js';

export async function lerModelo(db) {
  const snap = await getDoc(doc(db, 'config', 'mensagem'));
  const texto = snap.exists() ? snap.data().texto : null;
  return texto || MENSAGEM_PADRAO;
}

export async function salvarModelo(db, texto) {
  await setDoc(doc(db, 'config', 'mensagem'), { texto });
}
