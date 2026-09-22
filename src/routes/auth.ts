import { Router } from "express";
import { pool } from "../db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/register", async (req, res) => {
  const { email, password, username } = req.body;

  if (!email || !password || !username) {
    return res.status(400).json({ message: "Tüm alanlar zorunludur." });
  }

  if (password.length < 6) {
    return res
      .status(400)
      .json({ message: "Şifre en az 6 karakter olmalıdır." });
  }

  if (!email.includes("@")) {
    return res.status(400).json({ message: "Geçersiz e-posta adresi." });
  }
  try {
    const [rows] = await pool.query("SELECT id FROM users WHERE email = ?", [
      email,
    ]);

    if ((rows as any[]).length > 0) {
      return res.status(409).json({ message: "Bu e-posta zaten kayıtlı." });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      "INSERT INTO users (email, password_hash, username) VALUES (?, ?, ?)",
      [email, passwordHash, username],
    );

    res.status(201).json({
      message: "Kayıt başarılı.",
      user: { id: (result as any).insertId, email, username },
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Sunucu hatası." });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "E-posta ve şifre zorunludur." });
  }
  try {
    const [rows] = await pool.query(
      "SELECT id, email, username, password_hash FROM users WHERE email = ?",
      [email],
    );
    const users = rows as any[];
    if (users.length === 0) {
      return res.status(401).json({ message: "E-posta veya şifre hatalı." });
    }
    const user = users[0];
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return res.status(401).json({ message: "E-posta veya şifre hatalı." });
    }
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET as string,
      { expiresIn: "7d" },
    );
    res.json({
      token,
      user: { id: user.id, email: user.email, username: user.username },
    });
  } catch (error) {
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, email, username, created_at FROM users WHERE id = ?",
      [req.userId],
    );
    const users = rows as any[];
    if (users.length === 0) {
      return res.status(404).json({ message: "Kullanıcı bulunamadı." });
    }

    res.json({ user: users[0] });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Sunucu hatası." });
  }
});

router.put("/profile", requireAuth, async (req, res) => {
  const { username, email } = req.body;

  if (!username || !email) {
    return res.status(400).json({ message: "Tüm alanlar zorunludur." });
  }

  if (!email.includes("@")) {
    return res.status(400).json({ message: "Geçersiz e-posta adresi." });
  }
  try {
    const [rows] = await pool.query(
      "SELECT id FROM users WHERE email = ? AND id != ?",
      [email, req.userId],
    );

    if ((rows as any[]).length > 0) {
      return res
        .status(409)
        .json({ message: "Bu e-posta başka bir hesapta kayıtlı." });
    }
    await pool.query("UPDATE users SET username = ?, email = ? WHERE id = ?", [
      username,
      email,
      req.userId,
    ]);

    res.json({
      user: { id: req.userId, username, email },
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Sunucu hatası." });
  }
});

router.put("/password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "Tüm alanlar zorunludur." });
  }
  if (newPassword.length < 6) {
    return res
      .status(400)
      .json({ message: "Şifreniz en az 6 karakterli olmalıdır." });
  }

  try {
    const [rows] = await pool.query(
      "SELECT password_hash FROM users WHERE id = ?",
      [req.userId],
    );
    const users = rows as any[];

    if (users.length === 0) {
      return res.status(404).json({ message: "Kullanıcı bulunamadı." });
    }
    const isValid = await bcrypt.compare(
      currentPassword,
      users[0].password_hash,
    );

    if (!isValid) {
      return res.status(401).json({ message: "Mevcut şifre hatalı." });
    }
    const newHash = await bcrypt.hash(newPassword, 10);

    await pool.query("UPDATE users SET password_hash = ? WHERE id = ?", [
      newHash,
      req.userId,
    ]);

    res.json({ message: "Şifre güncellendi." });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

export default router;
