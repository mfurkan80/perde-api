import express from "express";
import cors from "cors";
import "dotenv/config";
import authRouter from "./routes/auth.js";
import commentsRouter from "./routes/comments.js";
import contactRouter from "./routes/contact.js";
import favoritesRouter from "./routes/favorites.js";
import tmdbRouter from "./routes/tmdb.js";
import watchLogsRouter from "./routes/watchLogs.js";
import adminRouter from "./routes/admin.js";
import { verifyMailConnection } from "./mail.js";
import { apiLimiter } from "./middleware/rateLimit.js";

const app = express();
app.set("trust proxy", Number(process.env.TRUST_PROXY ?? 0));
const PORT = process.env.PORT ?? 3000;

app.use(cors());
app.use(express.json());
app.use("/api", apiLimiter);

app.use("/api/auth", authRouter);
app.use("/api/favorites", favoritesRouter);
app.use("/api/tmdb", tmdbRouter);
app.use("/api/contact", contactRouter);
app.use("/api/comments", commentsRouter);
app.use("/api/watch-logs", watchLogsRouter);
app.use("/api/admin", adminRouter);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda çalışıyor.`);
  verifyMailConnection();
});
