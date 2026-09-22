import express from "express";
import cors from "cors";
import "dotenv/config";
import authRouter from "./routes/auth.js";
import contactRouter from "./routes/contact.js";
import favoritesRouter from "./routes/favorites.js";
import tmdbRouter from "./routes/tmdb.js";

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/favorites", favoritesRouter);
app.use("/api/tmdb", tmdbRouter);
app.use("/api/contact", contactRouter);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda çalışıyor.`);
});
