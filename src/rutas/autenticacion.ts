import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../conexionBD';
import { validarClave } from '../utilidades/validarClave';
import { verificarToken, SolicitudAutenticada } from '../middleware/autenticacion';

export const rutasAuth = Router();

const ROLES_VALIDOS = ['estudiante', 'docente'];

// ---------- REGISTRO ----------
rutasAuth.post('/registro', async (req: Request, res: Response) => {
  const { nombre, correo, clave, rol } = req.body;

  // 1. Validar los campos
  if (!nombre || !correo || !clave || !rol) {
    res.status(400).json({ mensaje: 'Todos los campos son obligatorios' });
    return;
  }
  if (!/^\S+@\S+\.\S+$/.test(correo)) {
    res.status(400).json({ mensaje: 'El correo no es válido' });
    return;
  }
  if (!ROLES_VALIDOS.includes(rol)) {
    res.status(400).json({ mensaje: 'El rol debe ser estudiante o docente' });
    return;
  }
  const erroresClave = validarClave(clave);
  if (erroresClave.length > 0) {
    res.status(400).json({ mensaje: 'La contraseña no es segura', errores: erroresClave });
    return;
  }

  try {
    // 2. Cifrar la contraseña (el 10 es la "fuerza" del cifrado)
    const claveHash = await bcrypt.hash(clave, 10);

    // 3. Guardar en la base de datos
    const resultado = await pool.query(
      `INSERT INTO usuarios (nombre, correo, clave_hash, rol)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nombre, correo, rol`,
      [nombre, correo.toLowerCase(), claveHash, rol]
    );

    res.status(201).json({ mensaje: 'Usuario registrado', usuario: resultado.rows[0] });
  } catch (error) {
    // 23505 = el correo ya existe (restricción UNIQUE)
    if ((error as { code?: string }).code === '23505') {
      res.status(409).json({ mensaje: 'Ese correo ya está registrado' });
      return;
    }
    console.error(error);
    res.status(500).json({ mensaje: 'Error al registrar el usuario' });
  }
});

// ---------- LOGIN ----------
rutasAuth.post('/login', async (req: Request, res: Response) => {
  const { correo, clave } = req.body;

  if (!correo || !clave) {
    res.status(400).json({ mensaje: 'Correo y contraseña son obligatorios' });
    return;
  }

  try {
    // 1. Buscar al usuario por correo
    const resultado = await pool.query('SELECT * FROM usuarios WHERE correo = $1', [
      correo.toLowerCase(),
    ]);
    const usuario = resultado.rows[0];

    // 2. Comparar la clave escrita con el hash guardado
    const claveCorrecta = usuario && (await bcrypt.compare(clave, usuario.clave_hash));

    // Mismo mensaje en ambos casos para no revelar si el correo existe
    if (!claveCorrecta) {
      res.status(401).json({ mensaje: 'Correo o contraseña incorrectos' });
      return;
    }

    // 3. Crear el token (carnet digital) válido por 7 días
    const token = jwt.sign(
      { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol },
      process.env.JWT_SECRETO as string,
      { expiresIn: '7d' }
    );

    res.json({
      mensaje: 'Inicio de sesión exitoso',
      token,
      usuario: { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al iniciar sesión' });
  }
});

// ---------- PERFIL (ruta protegida de prueba) ----------
rutasAuth.get('/perfil', verificarToken, (req: SolicitudAutenticada, res: Response) => {
  res.json({ usuario: req.usuario });
});