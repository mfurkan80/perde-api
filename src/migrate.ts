import mysql from "mysql2/promise";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import "dotenv/config";

const runMigrations = async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true,
  });
  await connection.query(
    `CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME}`,
  );
  await connection.query(`USE ${process.env.DB_NAME}`);
  await connection.query(`
  CREATE TABLE IF NOT EXISTS migrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);
  const dir = path.join(process.cwd(), "migrations");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    const [rows] = await connection.query(
      "SELECT id FROM migrations WHERE name = ?",
      [file],
    );

    if ((rows as any[]).length > 0) {
      console.log(`atlandı: ${file}`);
      continue;
    }

    const sql = await readFile(path.join(dir, file), "utf-8");
    await connection.query(sql);
    await connection.query("INSERT INTO migrations (name) VALUES (?)", [file]);
    console.log(`çalıştı: ${file}`);
  }

  await connection.end();
};

runMigrations();
