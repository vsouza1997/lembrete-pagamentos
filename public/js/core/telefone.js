export function normalizarTelefone(entrada) {
  const digitos = String(entrada ?? '').replace(/\D/g, '');
  // Números nacionais têm no máximo 11 dígitos, então 12+ só pode vir com o 55.
  const nacional = digitos.length >= 12 && digitos.startsWith('55') ? digitos.slice(2) : digitos;
  if (nacional.length !== 10 && nacional.length !== 11) return null;
  if (!/^[1-9]\d/.test(nacional)) return null; // DDD não começa com 0
  if (nacional.length === 11 && nacional[2] !== '9') return null; // celular de 11 dígitos começa com 9
  return `55${nacional}`;
}
