import { ultimoDiaDoMes } from './vencimentos.js';

// Datas como { ano, mes, dia } (mes de 1 a 12), guardadas no Firestore como 'AAAA-MM-DD'.
const DIA_EM_MS = 86400000;
const doisDigitos = (n) => String(n).padStart(2, '0');
const emMs = ({ ano, mes, dia }) => Date.UTC(ano, mes - 1, dia);
const deMs = (ms) => {
  const d = new Date(ms);
  return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() };
};

export function paraTexto({ ano, mes, dia }) {
  return `${ano}-${doisDigitos(mes)}-${doisDigitos(dia)}`;
}

// 'AAAA-MM-DD' -> { ano, mes, dia }, ou null se o texto não for uma data válida.
export function deTexto(texto) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(texto ?? ''));
  if (!m) return null;
  const data = { ano: Number(m[1]), mes: Number(m[2]), dia: Number(m[3]) };
  return paraTexto(deMs(emMs(data))) === texto ? data : null;
}

export function somarDias(data, dias) {
  return deMs(emMs(data) + dias * DIA_EM_MS);
}

// Soma meses mantendo o dia; se o mês de destino for mais curto, usa o último dia dele.
export function somarMeses({ ano, mes, dia }, meses) {
  const indice = ano * 12 + (mes - 1) + meses;
  const novoAno = Math.floor(indice / 12);
  const novoMes = (indice % 12) + 1;
  return { ano: novoAno, mes: novoMes, dia: Math.min(dia, ultimoDiaDoMes(novoAno, novoMes)) };
}

// Negativo se a < b, zero se iguais, positivo se a > b.
export function comparar(a, b) {
  return emMs(a) - emMs(b);
}

export function diasEntre(de, ate) {
  return Math.round((emMs(ate) - emMs(de)) / DIA_EM_MS);
}

// 0 = domingo ... 6 = sábado
export function diaDaSemana(data) {
  return new Date(emMs(data)).getUTCDay();
}

export function formatarCurta({ mes, dia }) {
  return `${doisDigitos(dia)}/${doisDigitos(mes)}`;
}
