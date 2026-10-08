import { Router, Request, Response } from 'express';
import { pool } from '../conexionBD';
import { verificarToken, soloDocente } from '../middleware/autenticacion';

export const rutasRecursos = Router();

// Todas las rutas de este archivo exigen haber iniciado sesión con el token del middleware
rutasRecursos.use(verificarToken);

const TIPOS_VALIDOS = ['libro', 'video', 'artículo', 'tutorial', 'curso'];

// Consulta SQL trae el recurso con su promedio de calificaciones
const CONSULTA_BASE = `
  SELECT r.id, r.titulo, r.descripcion, r.tipo, r.enlace, r.imagen,
         COALESCE(ROUND(AVG(c.puntuacion)::numeric, 1), 0)::float AS promedio,
         COUNT(c.puntuacion)::int AS total_votos
  FROM recursos r
  LEFT JOIN calificaciones c ON c.recurso_id = r.id
`;

interface DatosRecurso {
  titulo?: string;
  descripcion?: string;
  tipo?: string;
  enlace?: string;
  imagen?: string;
}

function esUrlValida(texto: string): boolean {
  try {
    const url = new URL(texto);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

//Valida los datos de un recurso y devuleve errores si los hay, sino devuelve un array vacío
function validarRecurso(datos: DatosRecurso): string[] {
  const errores: string[] = [];

  if (!datos.titulo || datos.titulo.trim().length < 3) {
    errores.push('El título es obligatorio (mínimo 3 caracteres)');
  }
  if (!datos.descripcion || datos.descripcion.trim().length < 10) {
    errores.push('La descripción es obligatoria (mínimo 10 caracteres)');
  }
  if (!datos.tipo || !TIPOS_VALIDOS.includes(datos.tipo.toLowerCase())) {
    errores.push(`El tipo debe ser uno de: ${TIPOS_VALIDOS.join(', ')}`);
  }
  if (!datos.enlace || !esUrlValida(datos.enlace)) {
    errores.push('El enlace debe ser una URL válida (http o https)');
  }
  if (datos.imagen && !esUrlValida(datos.imagen)) {
    errores.push('La imagen debe ser una URL válida (http o https)');
  }
  return errores;
}

// lista para obtener los recursos con filtros de búsqueda, tipo, orden y dirección
rutasRecursos.get('/', async (req: Request, res: Response) => {
  const { busqueda, tipo, orden, direccion } = req.query;

  const condiciones: string[] = [];
  const valores: string[] = [];

  // Búsqueda por ID, título o tipo
  if (typeof busqueda === 'string' && busqueda.trim() !== '') {
    const texto = busqueda.trim();
    valores.push(`%${texto}%`, texto);
    const n = valores.length - 1; // posición del primer valor
    condiciones.push(
      `(r.titulo ILIKE $${n} OR r.tipo ILIKE $${n} OR CAST(r.id AS TEXT) = $${n + 1})`
    );
  }

  // Filtro por tipo exacto
  if (typeof tipo === 'string' && tipo.trim() !== '') {
    valores.push(tipo.trim().toLowerCase());
    condiciones.push(`LOWER(r.tipo) = $${valores.length}`);
  }

  // solo permite ordenar por columnas válidas y dirección ascendente o descendente
  const columnasOrden: Record<string, string> = {
    id: 'r.id',
    titulo: 'r.titulo',
    tipo: 'r.tipo',
    promedio: 'promedio',
  };
  const columna = columnasOrden[String(orden)] ?? 'r.id';
  const sentido = String(direccion).toLowerCase() === 'desc' ? 'DESC' : 'ASC';

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

  try {
    const resultado = await pool.query(
      `${CONSULTA_BASE} ${where} GROUP BY r.id ORDER BY ${columna} ${sentido}`,
      valores
    );
    res.json(resultado.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al obtener los recursos' });
  }
});

// ---------- OBTENER UNO ----------
rutasRecursos.get('/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ mensaje: 'El id debe ser un número' });
    return;
  }

  try {
    const resultado = await pool.query(`${CONSULTA_BASE} WHERE r.id = $1 GROUP BY r.id`, [id]);
    if (resultado.rows.length === 0) {
      res.status(404).json({ mensaje: 'Recurso no encontrado' });
      return;
    }
    res.json(resultado.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al obtener el recurso' });
  }
});

//*************CRUD PARA ROL DOCENTE*********************************/
// ---------- CREATE ----------
rutasRecursos.post('/', soloDocente, async (req: Request, res: Response) => {
  const datos = req.body as DatosRecurso;

  const errores = validarRecurso(datos);
  if (errores.length > 0) {
    res.status(400).json({ mensaje: 'Datos inválidos', errores });
    return;
  }

  try {
    const resultado = await pool.query(
      `INSERT INTO recursos (titulo, descripcion, tipo, enlace, imagen)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        datos.titulo!.trim(),
        datos.descripcion!.trim(),
        datos.tipo!.toLowerCase(),
        datos.enlace,
        datos.imagen || null,
      ]
    );
    res.status(201).json(resultado.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al crear el recurso' });
  }
});

// ---------- UPDATE  ----------
rutasRecursos.put('/:id', soloDocente, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ mensaje: 'El id debe ser un número' });
    return;
  }

  const datos = req.body as DatosRecurso;
  const errores = validarRecurso(datos);
  if (errores.length > 0) {
    res.status(400).json({ mensaje: 'Datos inválidos', errores });
    return;
  }

  try {
    const resultado = await pool.query(
      `UPDATE recursos
       SET titulo = $1, descripcion = $2, tipo = $3, enlace = $4, imagen = $5
       WHERE id = $6
       RETURNING *`,
      [
        datos.titulo!.trim(),
        datos.descripcion!.trim(),
        datos.tipo!.toLowerCase(),
        datos.enlace,
        datos.imagen || null,
        id,
      ]
    );
    if (resultado.rows.length === 0) {
      res.status(404).json({ mensaje: 'Recurso no encontrado' });
      return;
    }
    res.json(resultado.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al modificar el recurso' });
  }
});

// ---------- DELETE----------
rutasRecursos.delete('/:id', soloDocente, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ mensaje: 'El id debe ser un número' });
    return;
  }

  try {
    const resultado = await pool.query('DELETE FROM recursos WHERE id = $1 RETURNING id', [id]);
    if (resultado.rows.length === 0) {
      res.status(404).json({ mensaje: 'Recurso no encontrado' });
      return;
    }
    res.json({ mensaje: 'Recurso eliminado', id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al eliminar el recurso' });
  }
});