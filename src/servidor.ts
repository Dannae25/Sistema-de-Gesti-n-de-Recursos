import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { pool, inicializarBD } from './conexionBD';

const app = express();

app.use(cors());
app.use(express.json());

// Ruta de prueba
app.get('/', (req: Request, res: Response) => {
  res.json({ mensaje: 'API de Recursos de Aprendizaje funcionando' });
});

// Ruta para comprobar que la base de datos responde
app.get('/salud', async (req: Request, res: Response) => {
  try {
    const resultado = await pool.query('SELECT NOW() AS hora');
    res.json({ estado: 'ok', horaBD: resultado.rows[0].hora });
  } catch (error) {
    console.error(error);
    res.status(500).json({ estado: 'error', mensaje: 'No hay conexión con la BD' });
  }
});

const PUERTO = Number(process.env.PORT) || 3000;

// Primero preparamos la BD y luego encendemos el servidor
inicializarBD()
  .then(() => {
    app.listen(PUERTO, () => {
      console.log(`Servidor escuchando en el puerto ${PUERTO}`);
    });
  })
  .catch((error) => {
    console.error('No se pudo inicializar la base de datos:', error);
    process.exit(1);
  });