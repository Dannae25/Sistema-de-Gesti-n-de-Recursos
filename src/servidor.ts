import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';

const app = express();

// Middleware: permite llamadas desde la app (Snack)
app.use(cors());
// Middleware: convierte el cuerpo JSON de las peticiones en un objeto
app.use(express.json());

// Ruta de prueba
app.get('/', (req: Request, res: Response) => {
  res.json({ mensaje: 'API de Recursos de Aprendizaje funcionando' });
});

// Railway asigna el puerto con la variable PORT
const PUERTO = Number(process.env.PORT) || 3000;
app.listen(PUERTO, () => {
  console.log(`Servidor escuchando en el puerto ${PUERTO}`);
});