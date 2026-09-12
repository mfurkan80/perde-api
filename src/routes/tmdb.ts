import { Router } from "express";
import "dotenv/config";

const router = Router();

const BASE_URL = "https://api.themoviedb.org/3";

router.get("/*path", async (req, res) => {
  const path = (req.params.path as string[]).join("/");
  const queryString = new URLSearchParams(req.query as any).toString();

  try {
    const response = await fetch(`${BASE_URL}/${path}?${queryString}`, {
      headers: {
        Authorization: `Bearer ${process.env.TMDB_TOKEN}`,
        accept: "application/json",
      },
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "TMDB isteği başarısız." });
  }
});

export default router;
