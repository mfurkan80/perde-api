import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const MEDIA_TYPES = ["movie", "tv"];
const LOCATIONS = ["cinema", "home", "other"];
const COMPANIONS_MAX = 255;
const NOTE_MAX = 2000;

const SELECT_COLUMNS = `id, media_id, media_type, DATE_FORMAT(watched_on, '%Y-%m-%d') AS watched_on,
  companions, location, rating, note, created_at`;

const mapRow = (row: any) => ({
  id: row.id,
  mediaId: row.media_id,
  mediaType: row.media_type,
  watchedOn: row.watched_on,
  companions: row.companions,
  location: row.location,
  rating: row.rating,
  note: row.note,
  createdAt: row.created_at,
});

const isValidDate = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !isNaN(date.getTime()) && date.toISOString().startsWith(value);
};

const latestAllowedDate = () => {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return tomorrow.toISOString().slice(0, 10);
};

const cleanOptionalText = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : null;

const isEmpty = (value: unknown) =>
  value === undefined || value === null || value === "";

type WatchLogFields = {
  watchedOn: string;
  companions: string | null;
  location: string | null;
  rating: number | null;
  note: string | null;
};

const parseFields = (
  body: any,
): { error: string } | { fields: WatchLogFields } => {
  const { watchedOn, companions, location, rating, note } = body;

  if (!isValidDate(watchedOn)) {
    return { error: "Geçerli bir tarih gerekli." };
  }

  if (watchedOn > latestAllowedDate()) {
    return { error: "İleri bir tarih seçilemez." };
  }

  const cleanCompanions = cleanOptionalText(companions);
  if (cleanCompanions !== null && cleanCompanions.length > COMPANIONS_MAX) {
    return {
      error: `Kiminle alanı en fazla ${COMPANIONS_MAX} karakter olabilir.`,
    };
  }

  const cleanNote = cleanOptionalText(note);
  if (cleanNote !== null && cleanNote.length > NOTE_MAX) {
    return { error: `Not en fazla ${NOTE_MAX} karakter olabilir.` };
  }

  if (!isEmpty(location) && !LOCATIONS.includes(location)) {
    return { error: "Geçersiz izleme yeri." };
  }

  if (
    !isEmpty(rating) &&
    !(Number.isInteger(rating) && rating >= 1 && rating <= 10)
  ) {
    return { error: "Puan 1 ile 10 arasında bir tam sayı olmalıdır." };
  }

  return {
    fields: {
      watchedOn,
      companions: cleanCompanions,
      location: isEmpty(location) ? null : location,
      rating: isEmpty(rating) ? null : rating,
      note: cleanNote,
    },
  };
};

const parseId = (value: unknown) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

router.get("/", requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ${SELECT_COLUMNS} FROM watch_logs
       WHERE user_id = ?
       ORDER BY watched_on DESC, id DESC`,
      [req.userId],
    );

    res.json({ logs: (rows as any[]).map(mapRow) });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Sunucu hatası." });
  }
});

router.get("/:mediaType/:mediaId", requireAuth, async (req, res) => {
  const { mediaType } = req.params;
  const mediaId = parseId(req.params.mediaId);

  if (mediaId === null) {
    return res.status(400).json({ message: "Geçersiz içerik." });
  }

  if (typeof mediaType !== "string" || !MEDIA_TYPES.includes(mediaType)) {
    return res
      .status(400)
      .json({ message: "İçerik türü 'movie' veya 'tv' olmalıdır." });
  }

  try {
    const [rows] = await pool.query(
      `SELECT ${SELECT_COLUMNS} FROM watch_logs
       WHERE user_id = ? AND media_id = ? AND media_type = ?
       ORDER BY watched_on DESC, id DESC`,
      [req.userId, mediaId, mediaType],
    );

    res.json({ logs: (rows as any[]).map(mapRow) });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Sunucu hatası." });
  }
});

router.post("/", requireAuth, async (req, res) => {
  const { mediaId, mediaType } = req.body;

  if (!Number.isInteger(mediaId) || mediaId <= 0) {
    return res.status(400).json({ message: "Geçerli bir içerik id gerekli." });
  }

  if (!MEDIA_TYPES.includes(mediaType)) {
    return res
      .status(400)
      .json({ message: "İçerik türü 'movie' veya 'tv' olmalıdır." });
  }

  const parsed = parseFields(req.body);
  if ("error" in parsed) {
    return res.status(400).json({ message: parsed.error });
  }
  const { watchedOn, companions, location, rating, note } = parsed.fields;

  try {
    const [result] = await pool.query(
      `INSERT INTO watch_logs
         (user_id, media_id, media_type, watched_on, companions, location, rating, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.userId,
        mediaId,
        mediaType,
        watchedOn,
        companions,
        location,
        rating,
        note,
      ],
    );

    res.status(201).json({
      id: (result as any).insertId,
      message: "İzleme kaydedildi.",
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Sunucu hatası." });
  }
});

router.put("/:id", requireAuth, async (req, res) => {
  const id = parseId(req.params.id);

  if (id === null) {
    return res.status(400).json({ message: "Geçersiz kayıt." });
  }

  const parsed = parseFields(req.body);
  if ("error" in parsed) {
    return res.status(400).json({ message: parsed.error });
  }
  const { watchedOn, companions, location, rating, note } = parsed.fields;

  try {
    const [result] = await pool.query(
      `UPDATE watch_logs
       SET watched_on = ?, companions = ?, location = ?, rating = ?, note = ?
       WHERE id = ? AND user_id = ?`,
      [watchedOn, companions, location, rating, note, id, req.userId],
    );

    if ((result as any).affectedRows === 0) {
      return res.status(404).json({ message: "Kayıt bulunamadı." });
    }

    res.json({ message: "Kayıt güncellendi." });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Sunucu hatası." });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  const id = parseId(req.params.id);

  if (id === null) {
    return res.status(400).json({ message: "Geçersiz kayıt." });
  }

  try {
    const [result] = await pool.query(
      "DELETE FROM watch_logs WHERE id = ? AND user_id = ?",
      [id, req.userId],
    );

    if ((result as any).affectedRows === 0) {
      return res.status(404).json({ message: "Kayıt bulunamadı." });
    }

    res.json({ message: "Kayıt silindi." });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Sunucu hatası." });
  }
});

export default router;
