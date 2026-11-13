import { collection, doc, getDocs, addDoc, setDoc } from '../firebase.js';

export async function listarAlunas(db) {
  const snap = await getDocs(collection(db, 'alunas'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function salvarAluna(db, aluna) {
  const { id, ...dados } = aluna;
  if (id) {
    await setDoc(doc(db, 'alunas', id), dados);
    return id;
  }
  const ref = await addDoc(collection(db, 'alunas'), dados);
  return ref.id;
}
