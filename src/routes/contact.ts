import { Router } from "express";
import { pool } from "../db.js";
import { optionalAuth } from "../middleware/auth.js";

const router = Router();

router.post("/", optionalAuth, async (req, res) => {
  const { name, email, subject, message } = req.body;

  // Tip kontrolü trim'den önce gelmeli, yoksa .trim() TypeError fırlatır.
  if (
    typeof name !== "string" ||
    typeof email !== "string" ||
    typeof subject !== "string" ||
    typeof message !== "string"
  ) {
    return res.status(400).json({ message: "Tüm alanlar metin olmalıdır." });
  }

  const cleanName = name.trim();
  const cleanEmail = email.trim();
  const cleanSubject = subject.trim();
  const cleanMessage = message.trim();

  if (!cleanName || !cleanEmail || !cleanSubject || !cleanMessage) {
    return res.status(400).json({ message: "Tüm alanlar zorunludur." });
  }

  if (cleanName.length < 2 || cleanName.length > 100) {
    return res
      .status(400)
      .json({ message: "İsim 2 ile 100 karakter arasında olmalıdır." });
  }

  if (cleanEmail.length > 255) {
    return res
      .status(400)
      .json({ message: "E-posta adresi en fazla 255 karakter olabilir." });
  }

  if (!cleanEmail.includes("@")) {
    return res.status(400).json({ message: "Geçersiz e-posta adresi." });
  }

  if (cleanSubject.length < 3 || cleanSubject.length > 150) {
    return res
      .status(400)
      .json({ message: "Konu 3 ile 150 karakter arasında olmalıdır." });
  }

  if (cleanMessage.length < 10 || cleanMessage.length > 2000) {
    return res
      .status(400)
      .json({ message: "Mesaj 10 ile 2000 karakter arasında olmalıdır." });
  }

  try {
    await pool.query(
      "INSERT INTO contact_messages (name, email, subject, message, user_id) VALUES (?, ?, ?, ?, ?)",
      [cleanName, cleanEmail, cleanSubject, cleanMessage, req.userId ?? null],
    );

    res.status(201).json({ message: "Mesajınız alındı, teşekkürler." });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Sunucu hatası." });
  }
});

export default router;
