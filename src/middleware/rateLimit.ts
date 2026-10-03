import { rateLimit } from "express-rate-limit";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const tooMany = (text: string) => ({ message: text });

export const loginLimiter = rateLimit({
  windowMs: 15 * MINUTE,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: tooMany(
    "Çok fazla başarısız giriş denemesi, 15 dakika sonra tekrar dene.",
  ),
});

export const registerLimiter = rateLimit({
  windowMs: HOUR,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: tooMany("Çok fazla kayıt denemesi, biraz sonra tekrar dene."),
});

export const contactLimiter = rateLimit({
  windowMs: HOUR,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: tooMany("Çok fazla mesaj gönderdin, biraz sonra tekrar dene."),
});

export const commentLimiter = rateLimit({
  windowMs: 10 * MINUTE,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: tooMany("Çok hızlı yorum yapıyorsun, biraz bekle."),
});

export const apiLimiter = rateLimit({
  windowMs: MINUTE,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: tooMany("Çok fazla istek gönderildi, biraz bekle."),
});
