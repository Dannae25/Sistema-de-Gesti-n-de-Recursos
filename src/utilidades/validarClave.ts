// Devuelve una lista con los requisitos que la clave NO cumple
export function validarClave(clave: string): string[] {
  const errores: string[] = [];

  if (clave.length < 12) errores.push('Debe tener mínimo 12 caracteres');
  if (!/[A-Z]/.test(clave)) errores.push('Debe tener al menos una letra mayúscula');
  if (!/[a-z]/.test(clave)) errores.push('Debe tener al menos una letra minúscula');
  if (!/[0-9]/.test(clave)) errores.push('Debe tener al menos un número');
  if (!/[!@#$%^&*]/.test(clave)) errores.push('Debe tener al menos un carácter especial (! @ # $ % ^ & *)');

  return errores;
}