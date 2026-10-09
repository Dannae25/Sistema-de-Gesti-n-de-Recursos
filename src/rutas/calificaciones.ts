import { Router, Response } from 'express';
import { pool } from '../conexionBD';
import { verificarToken, soloEstudiante, SolicitudAutenticada } from '../middleware/autenticacion';

export const rutasCalificaciones = Router();

rutasCalificaciones.use(verificarToken, soloEstudiante);

// Calcula el promedio y el total de votos actualizados de un recurso
async function obtenerPromedio(recursoId: number) {
  const resultado = await pool.query(
    `SELECT COALESCE(ROUND(AVG(puntuacion)::numeric, 1), 0)::float AS promedio,
            COUNT(*)::int AS total_votos
     FROM calificaciones
     WHERE recurso_id = $1`,
    [recursoId]
  );
  return resultado.rows[0] as { promedio: number; total_votos: number };
}

// ---------- MIS CALIFICACIONES ----------
rutasCalificaciones.get('/mias', async (req: SolicitudAutenticada, res: Response) => {
  try {
    const resultado = await pool.query(
      'SELECT recurso_id, puntuacion FROM calificaciones WHERE usuario_id = $1',
      [req.usuario!.id]
    );
    res.json(resultado.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al obtener tus calificaciones' });
  }
});

// ---------- CALIFICAR Y QUITAR MI CALIFICACIÓN ----------
rutasCalificaciones.put('/:recursoId', async (req: SolicitudAutenticada, res: Response) => {
  const recursoId = Number(req.params.recursoId);
  const puntuacion = Number(req.body.puntuacion);

  if (!Number.isInteger(recursoId)) {
    res.status(400).json({ mensaje: 'El id del recurso debe ser un número' });
    return;
  }
  if (!Number.isInteger(puntuacion) || puntuacion < 1 || puntuacion > 5) {
    res.status(400).json({ mensaje: 'La puntuación debe ser un número entero de 1 a 5' });
    return;
  }

  try {
    const existe = await pool.query('SELECT id FROM recursos WHERE id = $1', [recursoId]);
    if (existe.rows.length === 0) {
      res.status(404).json({ mensaje: 'Recurso no encontrado' });
      return;
    }

    // UPSERT: crea la calificación o actualiza la que ya existía
    await pool.query(
      `INSERT INTO calificaciones (usuario_id, recurso_id, puntuacion)
       VALUES ($1, $2, $3)
       ON CONFLICT (usuario_id, recurso_id)
       DO UPDATE SET puntuacion = EXCLUDED.puntuacion`,
      [req.usuario!.id, recursoId, puntuacion]
    );

    const datos = await obtenerPromedio(recursoId);
    res.json({
      mensaje: 'Calificación guardada',
      recursoId,
      miPuntuacion: puntuacion,
      promedio: datos.promedio,
      totalVotos: datos.total_votos,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al guardar la calificación' });
  }
});

// ---------- QUITAR MI CALIFICACIÓN ----------
rutasCalificaciones.delete('/:recursoId', async (req: SolicitudAutenticada, res: Response) => {
  const recursoId = Number(req.params.recursoId);

  if (!Number.isInteger(recursoId)) {
    res.status(400).json({ mensaje: 'El id del recurso debe ser un número' });
    return;
  }

  try {
    // Solo borra la calificación de este usuario, nunca la de otros
    await pool.query('DELETE FROM calificaciones WHERE usuario_id = $1 AND recurso_id = $2', [
      req.usuario!.id,
      recursoId,
    ]);

    const datos = await obtenerPromedio(recursoId);
    res.json({
      mensaje: 'Calificación eliminada',
      recursoId,
      miPuntuacion: 0,
      promedio: datos.promedio,
      totalVotos: datos.total_votos,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al eliminar la calificación' });
  }
});