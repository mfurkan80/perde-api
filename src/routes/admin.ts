import { Router } from "express";
import { pool } from "../db.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { isMailEnabled, sendMail } from "../mail.js";

const router = Router();

router.use(requireAuth, requireAdmin);

const COMMENT_STATUSES = ["pending", "approved", "rejected"];
const MODERATION_STATUSES = ["approved", "rejected"];

const parseId = (value: unknown) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

router.get("/comments", async (req, res) => {
  const status = req.query.status ?? "pending";

  if (typeof status !== "string" || !COMMENT_STATUSES.includes(status)) {
    return res.status(400).json({ message: "Geçersiz durum." });
  }

  try {
    const [rows] = await pool.query(
      `SELECT c.id, c.media_id, c.media_type, c.parent_id, c.content,
              c.is_spoiler, c.status, c.created_at, u.username
       FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.status = ?
       ORDER BY c.created_at ASC, c.id ASC
       LIMIT 100`,
      [status],
    );

    const comments = (rows as any[]).map((row) => ({
      id: row.id,
      mediaId: row.media_id,
      mediaType: row.media_type,
      parentId: row.parent_id,
      content: row.content,
      isSpoiler: Boolean(row.is_spoiler),
      status: row.status,
      createdAt: row.created_at,
      username: row.username,
    }));

    res.json({ comments });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Sunucu hatası." });
  }
});

router.patch("/comments/:id", async (req, res) => {
  const id = parseId(req.params.id);

  if (id === null) {
    return res.status(400).json({ message: "Geçersiz yorum." });
  }

  const { status } = req.body;

  if (!MODERATION_STATUSES.includes(status)) {
    return res.status(400).json({ message: "Geçersiz durum." });
  }

  try {
    const [result] = await pool.query(
      "UPDATE comments SET status = ? WHERE id = ?",
      [status, id],
    );

    if ((result as any).affectedRows === 0) {
      return res.status(404).json({ message: "Yorum bulunamadı." });
    }

    res.json({ message: "Yorum güncellendi." });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Sunucu hatası." });
  }
});

router.get("/messages", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT m.id, m.name, m.email, m.subject, m.message, m.is_read,m.replied_at,
              m.created_at, u.username
       FROM contact_messages m
       LEFT JOIN users u ON u.id = m.user_id
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT 100`,
    );

    const messages = (rows as any[]).map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      subject: row.subject,
      message: row.message,
      isRead: Boolean(row.is_read),
      createdAt: row.created_at,
      repliedAt: row.replied_at,
      username: row.username,
    }));

    res.json({ messages });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Sunucu hatası." });
  }
});

router.patch("/messages/:id", async (req, res) => {
  const id = parseId(req.params.id);

  if (id === null) {
    return res.status(400).json({ message: "Geçersiz mesaj." });
  }

  const { isRead } = req.body;

  if (typeof isRead !== "boolean") {
    return res.status(400).json({ message: "Geçersiz değer." });
  }

  try {
    const [result] = await pool.query(
      "UPDATE contact_messages SET is_read = ? WHERE id = ?",
      [isRead, id],
    );

    if ((result as any).affectedRows === 0) {
      return res.status(404).json({ message: "Mesaj bulunamadı." });
    }

    res.json({ message: "Mesaj güncellendi." });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Sunucu hatası." });
  }
});
router.post("/messages/:id/reply", async (req, res) => {
  const id = parseId(req.params.id);

  if (id === null) {
    return res.status(400).json({ message: "Geçersiz mesaj." });
  }

  if (!isMailEnabled) {
    return res
      .status(503)
      .json({ message: "E-posta gönderimi şuanda kapalı." });
  }

  const { reply } = req.body;

  if (typeof reply !== "string") {
    return res.status(400).json({ message: "Geçersiz mesaj türü." });
  }

  const cleanReply = reply.trim();

  if (cleanReply.length < 2 || cleanReply.length > 5000) {
    return res
      .status(400)
      .json({ message: "Yanıt 2 ile 5000 karakter arasında olmalıdır." });
  }

  try {
    const [rows] = await pool.query(
      "SELECT email, subject, message FROM contact_messages WHERE id = ?",
      [id],
    );
    const messages = rows as any[];

    if (messages.length === 0) {
      return res.status(404).json({ message: "Mesaj bulunamadı." });
    }

    const original = messages[0];

    await sendMail({
      to: original.email,
      subject: `Re: ${original.subject}`,
      text: `${cleanReply}\n\n---\nMesajınız:\n${original.message}`,
    });

    await pool.query(
      "UPDATE contact_messages SET is_read = TRUE, replied_at = NOW()  WHERE id = ?",
      [id],
    );

    res.json({ message: "Yanıt gönderildi." });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Yanıt gönderilemedi." });
  }
});

router.delete("/messages/:id", async (req, res) => {
  const id = parseId(req.params.id);

  if (id === null) {
    return res.status(400).json({ message: "Geçersiz mesaj." });
  }

  try {
    const [result] = await pool.query(
      "DELETE FROM contact_messages WHERE id = ?",
      [id],
    );

    if ((result as any).affectedRows === 0) {
      return res.status(404).json({ message: "Mesaj bulunamadı." });
    }

    res.json({ message: "Mesaj silindi." });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Sunucu hatası." });
  }
});

router.get("/users", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.email, u.role, u.created_at, u.email_verified_at,
              (SELECT COUNT(*) FROM comments c WHERE c.user_id = u.id) AS comment_count,
              (SELECT COUNT(*) FROM favorites f WHERE f.user_id = u.id) AS favorite_count,
              (SELECT COUNT(*) FROM watch_logs w WHERE w.user_id = u.id) AS watch_count
       FROM users u
       ORDER BY u.created_at DESC, u.id DESC
       LIMIT 200`,
    );

    const users = (rows as any[]).map((row) => ({
      id: row.id,
      username: row.username,
      email: row.email,
      role: row.role,
      createdAt: row.created_at,
      emailVerifiedAt: row.email_verified_at,
      commentCount: Number(row.comment_count),
      favoriteCount: Number(row.favorite_count),
      watchCount: Number(row.watch_count),
    }));

    res.json({ users });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Sunucu hatası." });
  }
});

router.get("/users/:id/activity", async (req, res) => {
  const id = parseId(req.params.id);

  if (id === null) {
    return res.status(400).json({ message: "Geçersiz kullanıcı." });
  }

  try {
    const [userRows] = await pool.query("SELECT id FROM users WHERE id = ?", [
      id,
    ]);

    if ((userRows as any[]).length === 0) {
      return res.status(404).json({ message: "Kullanıcı bulunamadı." });
    }

    const [[commentRows], [favoriteRows], [watchLogRows]] = await Promise.all([
      pool.query(
        `SELECT id, media_id, media_type, parent_id, content, is_spoiler, status, created_at
         FROM comments WHERE user_id = ?
         ORDER BY created_at DESC, id DESC`,
        [id],
      ),
      pool.query(
        `SELECT media_id, media_type, created_at
         FROM favorites WHERE user_id = ?
         ORDER BY created_at DESC, id DESC`,
        [id],
      ),
      pool.query(
        `SELECT id, media_id, media_type,
                DATE_FORMAT(watched_on, '%Y-%m-%d') AS watched_on,
                companions, location, rating, note, created_at
         FROM watch_logs WHERE user_id = ?
         ORDER BY watched_on DESC, id DESC`,
        [id],
      ),
    ]);

    const comments = (commentRows as any[]).map((row) => ({
      id: row.id,
      mediaId: row.media_id,
      mediaType: row.media_type,
      parentId: row.parent_id,
      content: row.content,
      isSpoiler: Boolean(row.is_spoiler),
      status: row.status,
      createdAt: row.created_at,
    }));

    const favorites = (favoriteRows as any[]).map((row) => ({
      mediaId: row.media_id,
      mediaType: row.media_type,
      createdAt: row.created_at,
    }));

    const watchLogs = (watchLogRows as any[]).map((row) => ({
      id: row.id,
      mediaId: row.media_id,
      mediaType: row.media_type,
      watchedOn: row.watched_on,
      companions: row.companions,
      location: row.location,
      rating: row.rating,
      note: row.note,
      createdAt: row.created_at,
    }));

    res.json({ comments, favorites, watchLogs });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Sunucu hatası." });
  }
});

router.delete("/users/:id", async (req, res) => {
  const id = parseId(req.params.id);

  if (id === null) {
    return res.status(400).json({ message: "Geçersiz kullanıcı." });
  }

  if (id === req.userId) {
    return res.status(400).json({ message: "Kendi hesabını silemezsin." });
  }

  try {
    const [rows] = await pool.query("SELECT role FROM users WHERE id = ?", [
      id,
    ]);
    const user = (rows as any[])[0];

    if (!user) {
      return res.status(404).json({ message: "Kullanıcı bulunamadı." });
    }

    if (user.role === "admin") {
      return res.status(403).json({ message: "Admin hesapları silinemez." });
    }

    const [result] = await pool.query(
      "DELETE FROM users WHERE id = ? AND role <> 'admin'",
      [id],
    );

    if ((result as any).affectedRows === 0) {
      return res.status(409).json({ message: "Kullanıcı silinemedi." });
    }

    res.json({ message: "Kullanıcı silindi." });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Sunucu hatası." });
  }
});

export default router;
