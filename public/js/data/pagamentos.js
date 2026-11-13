import { collection, doc, getDocs, setDoc, deleteDoc, serverTimestamp } from '../firebase.js';
import { chavePagamento } from '../core/cobrancas.js';

// pagamentos/{alunaId}_{chave}: chave = 'AAAA-MM' (mensal) ou 'AAAA-MM-DD' (demais planos).
export async function listarPagamentos(db) {
  const snap = await getDocs(collection(db, 'pagamentos'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function marcarPaga(db, alunaId, chave) {
  await setDoc(doc(db, 'pagamentos', chavePagamento(alunaId, chave)), {
    alunaId,
    chave,
    mes: chave.slice(0, 7),
    pagoEm: serverTimestamp(),
  });
}

export async function desfazerPaga(db, alunaId, chave) {
  await deleteDoc(doc(db, 'pagamentos', chavePagamento(alunaId, chave)));
}
