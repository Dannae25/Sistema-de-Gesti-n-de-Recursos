import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Datos que guardamos dentro del token
export interface PayloadToken {
  id: number;
  nombre: string;
  rol: 'estudiante' | 'docente';
}

// Petición normal de Express + el usuario que sacamos del token
export interface SolicitudAutenticada extends Request {
  usuario?: PayloadToken;
}

// Guardia 1: revisa que exista un token válido
export function verificarToken(
  req: SolicitudAutenticada,
  res: Response,
  next: NextFunction
): void {
  const cabecera = req.headers.authorization; // llega como "Bearer abc123..."

  if (!cabecera || !cabecera.startsWith('Bearer ')) {
    res.status(401).json({ mensaje: 'Debes iniciar sesión' });
    return;
  }

  const token = cabecera.split(' ')[1];

  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRETO as string) as PayloadToken;
    next(); // deja pasar a la siguiente función
  } catch {
    res.status(401).json({ mensaje: 'Sesión inválida o expirada' });
  }
}

// Guardia 2: solo deja pasar a docentes
export function soloDocente(
  req: SolicitudAutenticada,
  res: Response,
  next: NextFunction
): void {
  if (req.usuario?.rol !== 'docente') {
    res.status(403).json({ mensaje: 'Solo los docentes pueden hacer esto' });
    return;
  }
  next();
}