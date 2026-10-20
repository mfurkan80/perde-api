import { Router } from "express";
import { pool } from "../db.js";
import bcrypt from "bcrypt";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { sendMail } from "../mail.js";
import { requireAuth } from "../middleware/auth.js";
import {
  loginLimiter,
  passwordResetLimiter,
  registerLimiter,
} from "../middleware/rateLimit.js";

const router = Router();
const USERNAME_MIN = 2;
const USERNAME_MAX = 50;

const cleanUsername = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();

  if (trimmed.length < USERNAME_MIN || trimmed.length > USERNAME_MAX) {
    return null;
  }
  return trimmed;
};

const PASSWORD_MIN = 6;
const RESET_TOKEN_TTL_MINUTES = 60;

const hashToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

router.post("/register", registerLimiter, async (req, res) => {
  const { email, password, username } = req.body;

  if (!email || !password || !username) {
    return res.status(400).json({ message: "Tüm alanlar zorunludur." });
  }

  const name = cleanUsername(username);
  if (name === null) {
    return res.status(400).json({
      message: `Kullanıcı adı ${USERNAME_MIN} ile ${USERNAME_MAX} karakter arasında olmalıdır.`,
    });
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
      [email, passwordHash, name],
    );

    res.status(201).json({
      message: "Kayıt başarılı.",
      user: {
        id: (result as any).insertId,
        email,
        username: name,
        role: "user",
      },
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Sunucu hatası." });
  }
});

router.post("/login", loginLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "E-posta ve şifre zorunludur." });
  }
  try {
    const [rows] = await pool.query(
      "SELECT id, email, username, password_hash, role FROM users WHERE email = ?",
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
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

router.post("/forgot-password", passwordResetLimiter, async (req, res) => {
  const { email } = req.body;

  if (typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({ message: "Geçersiz e-posta adresi." });
  }

  const okMessage =
    "Bu adres kayıtlıysa şifre sıfırlama bağlantısı gönderildi.";

  try {
    const [rows] = await pool.query(
      "SELECT id, email, username FROM users WHERE email = ?",
      [email.trim()],
    );
    const users = rows as any[];

    if (users.length === 0) {
      return res.json({ message: okMessage });
    }

    const user = users[0];
    const token = crypto.randomBytes(32).toString("hex");

    await pool.query("DELETE FROM password_resets WHERE user_id = ?", [
      user.id,
    ]);
    await pool.query(
      `INSERT INTO password_resets (user_id, token_hash, expires_at)
       VALUES (?, ?, NOW() + INTERVAL ? MINUTE)`,
      [user.id, hashToken(token), RESET_TOKEN_TTL_MINUTES],
    );

    const link = `${process.env.APP_URL}/reset-password?token=${token}`;

    await sendMail({
      to: user.email,
      subject: "Perde şifre sıfırlama",
      text: [
        `Merhaba ${user.username},`,
        "",
        "Perde hesabın için şifre sıfırlama isteği aldık. Yeni şifreni belirlemek için bu bağlantıya tıkla:",
        "",
        link,
        "",
        "Bu bağlantı 1 saat geçerlidir ve yalnızca bir kez kullanılabilir.",
        "Bu isteği sen yapmadıysan bu e-postayı görmezden gelebilirsin, şifren değişmeyecek.",
      ].join("\n"),
    });

    res.json({ message: okMessage });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Sunucu hatası." });
  }
});

router.post("/reset-password", passwordResetLimiter, async (req, res) => {
  const { token, password } = req.body;

  if (typeof token !== "string" || typeof password !== "string") {
    return res.status(400).json({ message: "Tüm alanlar zorunludur." });
  }

  if (password.length < PASSWORD_MIN) {
    return res
      .status(400)
      .json({ message: `Şifre en az ${PASSWORD_MIN} karakter olmalıdır.` });
  }

  const invalidMessage =
    "Bağlantı geçersiz ya da süresi dolmuş. Yeni bir bağlantı iste.";

  try {
    const [rows] = await pool.query(
      `SELECT id, user_id FROM password_resets
       WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()`,
      [hashToken(token)],
    );
    const resets = rows as any[];

    if (resets.length === 0) {
      return res.status(400).json({ message: invalidMessage });
    }

    const reset = resets[0];
    const [result] = await pool.query(
      "UPDATE password_resets SET used_at = NOW() WHERE id = ? AND used_at IS NULL",
      [reset.id],
    );

    if ((result as any).affectedRows === 0) {
      return res.status(400).json({ message: invalidMessage });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await pool.query("UPDATE users SET password_hash = ? WHERE id = ?", [
      passwordHash,
      reset.user_id,
    ]);

    res.json({ message: "Şifren güncellendi. Artık giriş yapabilirsin." });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Sunucu hatası." });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, email, username, created_at, role FROM users WHERE id = ?",
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
  const name = cleanUsername(username);
  if (name === null) {
    return res.status(400).json({
      message: `Kullanıcı adı ${USERNAME_MIN} ile ${USERNAME_MAX} karakter arasında olmalıdır.`,
    });
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
      name,
      email,
      req.userId,
    ]);

    const [userRows] = await pool.query(
      "SELECT id, email, username, role FROM users WHERE id = ?",
      [req.userId],
    );

    res.json({ user: (userRows as any[])[0] });
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
