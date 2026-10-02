import { pool } from "../db.js";

const email = process.argv[2];

if (!email) {
  console.log("Kullanım: npm run make-admin -- <e-posta>");
  process.exit(1);
}

const [result] = await pool.query(
  "UPDATE users SET role = 'admin' WHERE email = ?",
  [email],
);

if ((result as any).affectedRows === 0) {
  console.log(`${email} adresiyle kayıtlı kullanıcı yok.`);
} else {
  console.log(`${email} artık admin.`);
}

await pool.end();
