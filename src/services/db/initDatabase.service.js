const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

/**
 * Inicializa la base de datos ejecutando el script SQL
 */
async function initializeDatabase() {
  console.log('Iniciando la creación de la base de datos...');
  
  // Leer el archivo SQL
  const sqlFilePath = path.join(__dirname, '../../config/db/database.sql');
  let sqlScript;
  
  try {
    sqlScript = fs.readFileSync(sqlFilePath, 'utf8');
  } catch (error) {
    console.error('Error al leer el archivo SQL:', error);
    throw error;
  }
  
  console.log('Archivo SQL leído correctamente');
  
  console.log(`Intentando conectar a ${process.env.MYSQL_HOST}...`);
  
  // Crear conexión a MySQL sin especificar base de datos
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: process.env.MYSQL_PORT || 3306,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    connectTimeout: 60000, // 60 segundos de timeout
    ssl: {
      // Aceptar certificados autofirmados para RDS
      rejectUnauthorized: false
    }
  });
  
  try {
    console.log('Conexión establecida con el servidor MySQL');
    
    // Crear base de datos si no existe
    console.log(`Creando base de datos '${process.env.MYSQL_DATABASE}' si no existe...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.MYSQL_DATABASE}`);
    console.log(`Base de datos '${process.env.MYSQL_DATABASE}' creada o ya existe`);
    
    // Seleccionar base de datos
    console.log(`Seleccionando base de datos '${process.env.MYSQL_DATABASE}'...`);
    await connection.query(`USE ${process.env.MYSQL_DATABASE}`);
    console.log(`Usando base de datos '${process.env.MYSQL_DATABASE}'`);
    
    // Dividir el script SQL por instrucciones (separadas por ;)
    const sqlStatements = sqlScript
      .split(';')
      .filter(statement => statement.trim() !== '');
    
    console.log(`Ejecutando ${sqlStatements.length} instrucciones SQL...`);
    
    // Ejecutar cada instrucción SQL
    let successCount = 0;
    let errorCount = 0;
    
    for (const statement of sqlStatements) {
      try {
        await connection.query(statement);
        successCount++;
      } catch (error) {
        console.error(`Error ejecutando SQL: ${statement.substring(0, 100)}...`);
        console.error(`Mensaje de error: ${error.message}`);
        errorCount++;
        // Continuar con las siguientes instrucciones
      }
    }
    
    console.log(`Ejecución completada: ${successCount} instrucciones exitosas, ${errorCount} errores`);
    console.log('Base de datos inicializada correctamente');
  } catch (error) {
    console.error('Error al inicializar la base de datos:', error);
    throw error;
  } finally {
    try {
      await connection.end();
      console.log('Conexión a la base de datos cerrada');
    } catch (err) {
      console.error('Error al cerrar la conexión:', err);
    }
  }
  
  return true;
}

module.exports = { initializeDatabase }; 