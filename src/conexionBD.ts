import { Pool } from 'pg'; //gestiona conexión en todas las rutas
import fs from 'fs';
import path from 'path';

const urlBD = process.env.DATABASE_URL;

// El pool administra las conexiones a PostgreSQL
export const pool = new Pool({
  connectionString: urlBD,
// Se conecta fuera de railway como conexión interna
  ssl: urlBD?.includes('railway.internal') ? false : { rejectUnauthorized: false },
});

// Lee esquema.sql y crea las tablas si todavía no existen
export async function inicializarBD(): Promise<void> {
  const ruta = path.join(process.cwd(), 'esquema.sql'); //encuentra la base de datos en mi PC y en Railway
  const sql = fs.readFileSync(ruta, 'utf-8');
  await pool.query(sql);
  console.log('Base de datos lista: tablas verificadas');
}