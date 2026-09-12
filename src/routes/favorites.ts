import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT movie_id FROM favorites WHERE user_id = ? ORDER BY created_at DESC",
      [req.userId],
    );
    const movieIds = (rows as any[]).map((row) => row.movie_id);
    res.json({ movieIds });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Sunucu hatası." });
  }
});

router.post("/", requireAuth, async (req, res) => {
  const { movieId } = req.body;

  if (!movieId || typeof movieId !== "number") {
    return res.status(400).json({ message: "Geçerli bir film id gerekli." });
  }

  try {
    await pool.query(
      "INSERT IGNORE INTO favorites (user_id, movie_id) VALUES (?, ?)",
      [req.userId, movieId],
    );
    res.status(201).json({ message: "Favorilere eklendi." });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Sunucu hatası." });
  }
});

router.delete("/:movieId", requireAuth, async (req, res) => {
  const movieId = Number(req.params.movieId);
  if (isNaN(movieId)) {
    return res.status(400).json({ message: "Geçersiz film." });
  }

  try {
    await pool.query(
      "DELETE FROM favorites WHERE user_id = ? AND movie_id = ?",
      [req.userId, movieId],
    );

    res.json({ message: "Favorilerden çıkarıldı." });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Sunucu hatası." });
  }
});

export default router;
