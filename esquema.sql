CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  correo VARCHAR(150) UNIQUE NOT NULL,
  clave_hash VARCHAR(255) NOT NULL,
  /* solo roles válidos y notas*/
  rol VARCHAR(20) NOT NULL CHECK (rol IN ('estudiante', 'docente'))
);

CREATE TABLE IF NOT EXISTS recursos (
  id SERIAL PRIMARY KEY,
  titulo VARCHAR(200) NOT NULL,
  descripcion TEXT NOT NULL,
  tipo VARCHAR(50) NOT NULL,
  enlace TEXT NOT NULL,
  imagen TEXT
);

CREATE TABLE IF NOT EXISTS favoritos (
  usuario_id INT REFERENCES usuarios(id) ON DELETE CASCADE,
  recurso_id INT REFERENCES recursos(id) ON DELETE CASCADE,
  PRIMARY KEY (usuario_id, recurso_id)
);

CREATE TABLE IF NOT EXISTS calificaciones (
  usuario_id INT REFERENCES usuarios(id) ON DELETE CASCADE,
  recurso_id INT REFERENCES recursos(id) ON DELETE CASCADE,
  puntuacion INT NOT NULL CHECK (puntuacion BETWEEN 1 AND 5),
  PRIMARY KEY (usuario_id, recurso_id)
);