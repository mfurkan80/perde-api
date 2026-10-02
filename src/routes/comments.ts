import { Router } from "express";
import { pool } from "../db.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";

const router = Router();

const MEDIA_TYPES = ["movie", "tv"];

router.get("/:mediaType/:mediaId", optionalAuth, async (req, res) => {
  const { mediaType } = req.params;
  const mediaId = Number(req.params.mediaId);

  if (isNaN(mediaId)) {
    return res.status(400).json({ message: "Geçersiz içerik." });
  }

  if (typeof mediaType !== "string" || !MEDIA_TYPES.includes(mediaType)) {
    return res
      .status(400)
      .json({ message: "İçerik türü 'movie' veya 'tv' olmalıdır." });
  }

  try {
    const [rows] = await pool.query(
      `SELECT c.id, c.parent_id, c.content, c.is_spoiler, c.status, c.created_at, u.username
       FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.media_id = ? AND c.media_type = ?
         AND (c.status = 'approved' OR (c.status = 'pending' AND c.user_id = ?))
       ORDER BY c.created_at ASC, c.id ASC`,
      [mediaId, mediaType, req.userId ?? null],
    );

    const comments = (rows as any[]).map((row) => ({
      id: row.id,
      parentId: row.parent_id,
      content: row.content,
      isSpoiler: Boolean(row.is_spoiler),
      status: row.status,
      createdAt: row.created_at,
      username: row.username,
    }));

    const threads = comments
      .filter((comment) => comment.parentId === null)
      .map((comment) => ({
        ...comment,
        replies: comments.filter((reply) => reply.parentId === comment.id),
      }))
      .reverse();

    res.json({ comments: threads });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Sunucu hatası." });
  }
});

router.post("/", requireAuth, async (req, res) => {
  const { mediaId, mediaType, content, isSpoiler, parentId } = req.body;

  if (!mediaId || typeof mediaId !== "number") {
    return res.status(400).json({ message: "Geçerli bir içerik id gerekli." });
  }

  if (!MEDIA_TYPES.includes(mediaType)) {
    return res
      .status(400)
      .json({ message: "İçerik türü 'movie' veya 'tv' olmalıdır." });
  }

  if (typeof content !== "string") {
    return res.status(400).json({ message: "Yorum metin olmalıdır." });
  }

  const cleanContent = content.trim();

  if (cleanContent.length < 2 || cleanContent.length > 2000) {
    return res
      .status(400)
      .json({ message: "Yorum 2 ile 2000 karakter arasında olmalıdır." });
  }

  const spoiler = isSpoiler === true;
  const hasParent = parentId !== undefined && parentId !== null;

  if (hasParent && typeof parentId !== "number") {
    return res.status(400).json({ message: "Geçersiz yanıt." });
  }

  try {
    if (hasParent) {
      const [parentRows] = await pool.query(
        "SELECT media_id, media_type, parent_id, status FROM comments WHERE id = ?",
        [parentId],
      );
      const parent = (parentRows as any[])[0];

      if (!parent) {
        return res
          .status(400)
          .json({ message: "Yanıtlanan yorum bulunamadı." });
      }

      if (parent.media_id !== mediaId || parent.media_type !== mediaType) {
        return res
          .status(400)
          .json({ message: "Yanıtlanan yorum bu içeriğe ait değil." });
      }

      if (parent.status !== "approved") {
        return res
          .status(400)
          .json({ message: "Sadece yayınlanmış yorumlara yanıt verilebilir." });
      }

      if (parent.parent_id !== null) {
        return res.status(400).json({ message: "Yanıtlara yanıt verilemez." });
      }
    }

    await pool.query(
      "INSERT INTO comments (user_id, media_id, media_type, parent_id, content, is_spoiler) VALUES (?, ?, ?, ?, ?, ?)",
      [
        req.userId,
        mediaId,
        mediaType,
        hasParent ? parentId : null,
        cleanContent,
        spoiler,
      ],
    );

    res
      .status(201)
      .json({ message: "Yorumunuz alındı, onaylandıktan sonra yayınlanacak." });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Sunucu hatası." });
  }
});

export default router;
