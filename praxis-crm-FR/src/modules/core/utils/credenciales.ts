// Texto del SuccessModal después de crear un usuario (visitador o
// administrador). El formulario ya no pide contraseña: la genera el backend
// y la manda por correo al email del alta.
//
// El backend solo devuelve password_generado cuando NO se pudo enviar el
// correo (sin SMTP o fallo del servidor). En ese caso es la única copia en
// claro que existe y hay que mostrarla una vez para que el administrador la
// reparta a mano.
export const credencialesDetail = (passwordGenerado: string | undefined, email: string): string => {
  if (passwordGenerado) {
    return `El correo no se pudo enviar. Contraseña temporal: ${passwordGenerado} — pasásela a ${email} y que la cambie al ingresar.`
  }
  return `Se enviaron el usuario y la contraseña a ${email}.`
}
