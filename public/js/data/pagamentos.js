import { collection, doc, getDocs, query, where, setDoc, deleteDoc, serverTimestamp } from '../firebase.js';

export function idDoPagamento(alunaId, mes) {
  return `${alunaId}_${mes}`;
}

export async function listarPagamentosDoMes(db, mes) {
  const snap = await getDocs(query(collection(db, 'pagamentos'), where('mes', '==', mes)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function marcarPaga(db, alunaId, mes) {
  await setDoc(doc(db, 'pagamentos', idDoPagamento(alunaId, mes)), {
    alunaId,
    mes,
    pagoEm: serverTimestamp(),
  });
}

export async function desfazerPaga(db, alunaId, mes) {
  await deleteDoc(doc(db, 'pagamentos', idDoPagamento(alunaId, mes)));
}
