import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const MEDIA_TYPES = ["movie", "tv"];

router.get("/", requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT media_id, media_type FROM favorites WHERE user_id = ? ORDER BY created_at DESC",
      [req.userId],
    );

    const favorites = (rows as any[]).map((row) => ({
      mediaId: row.media_id,
      mediaType: row.media_type,
    }));

    res.json({ favorites });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Sunucu hatası." });
  }
});

router.post("/", requireAuth, async (req, res) => {
  const { mediaId, mediaType } = req.body;

  if (!mediaId || typeof mediaId !== "number") {
    return res.status(400).json({ message: "Geçerli bir içerik id gerekli." });
  }

  if (!MEDIA_TYPES.includes(mediaType)) {
    return res
      .status(400)
      .json({ message: "İçerik türü 'movie' veya 'tv' olmalıdır." });
  }

  try {
    await pool.query(
      "INSERT IGNORE INTO favorites (user_id, media_id, media_type) VALUES (?, ?, ?)",
      [req.userId, mediaId, mediaType],
    );
    res.status(201).json({ message: "Favorilere eklendi." });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Sunucu hatası." });
  }
});

router.delete("/:mediaType/:mediaId", requireAuth, async (req, res) => {
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
    await pool.query(
      "DELETE FROM favorites WHERE user_id = ? AND media_id = ? AND media_type = ?",
      [req.userId, mediaId, mediaType],
    );

    res.json({ message: "Favorilerden çıkarıldı." });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Sunucu hatası." });
  }
});

export default router;
