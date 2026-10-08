import { Router, Response } from 'express';
import { pool } from '../conexionBD';
import { verificarToken, soloEstudiante, SolicitudAutenticada } from '../middleware/autenticacion';

export const rutasFavoritos = Router();

// Todas las rutas exigen sesión y rol estudiante
rutasFavoritos.use(verificarToken, soloEstudiante);

// ---------- LISTAR MIS FAVORITOS ----------
rutasFavoritos.get('/', async (req: SolicitudAutenticada, res: Response) => {
  try {
    const resultado = await pool.query(
      `SELECT r.id, r.titulo, r.descripcion, r.tipo, r.enlace, r.imagen,
              COALESCE(ROUND(AVG(c.puntuacion)::numeric, 1), 0)::float AS promedio,
              COUNT(c.puntuacion)::int AS total_votos
       FROM favoritos f
       JOIN recursos r ON r.id = f.recurso_id
       LEFT JOIN calificaciones c ON c.recurso_id = r.id
       WHERE f.usuario_id = $1
       GROUP BY r.id
       ORDER BY r.titulo`,
      [req.usuario!.id]
    );
    res.json(resultado.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al obtener los favoritos' });
  }
});

// ---------- MARCAR COMO FAVORITO ----------
rutasFavoritos.post('/:recursoId', async (req: SolicitudAutenticada, res: Response) => {
  const recursoId = Number(req.params.recursoId);
  if (!Number.isInteger(recursoId)) {
    res.status(400).json({ mensaje: 'El id del recurso debe ser un número' });
    return;
  }

  try {
    // Verificar que el recurso existe
    const existe = await pool.query('SELECT id FROM recursos WHERE id = $1', [recursoId]);
    if (existe.rows.length === 0) {
      res.status(404).json({ mensaje: 'Recurso no encontrado' });
      return;
    }

    // Si ya era favorito, no hace nada y usamos (ON CONFLICT DO NOTHING)
    await pool.query(
      `INSERT INTO favoritos (usuario_id, recurso_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [req.usuario!.id, recursoId]
    );
    res.status(201).json({ mensaje: 'Recurso agregado a favoritos', recursoId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al agregar a favoritos' });
  }
});

// ---------- QUITAR DE FAVORITOS ----------
rutasFavoritos.delete('/:recursoId', async (req: SolicitudAutenticada, res: Response) => {
  const recursoId = Number(req.params.recursoId);
  if (!Number.isInteger(recursoId)) {
    res.status(400).json({ mensaje: 'El id del recurso debe ser un número' });
    return;
  }

  try {
    await pool.query('DELETE FROM favoritos WHERE usuario_id = $1 AND recurso_id = $2', [
      req.usuario!.id,
      recursoId,
    ]);
    res.json({ mensaje: 'Recurso quitado de favoritos', recursoId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al quitar de favoritos' });
  }
});