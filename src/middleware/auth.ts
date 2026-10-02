import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";

declare global {
  namespace Express {
    interface Request {
      userId?: number;
    }
  }
}

export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Yetkilendirme gerekli." });
  }

  const token = authHeader.substring(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as {
      userId: number;
    };
    req.userId = payload.userId;
    next();
  } catch (error) {
    return res
      .status(401)
      .json({ message: "Geçersiz veya süresi dolmuş token." });
  }
};

export const optionalAuth = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.substring(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as {
      userId: number;
    };
    req.userId = payload.userId;
  } catch {}

  next();
};

export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const [rows] = await pool.query("SELECT role FROM users WHERE id = ?", [
      req.userId,
    ]);
    const user = (rows as any[])[0];

    if (!user || user.role !== "admin") {
      return res.status(403).json({ message: "Bu işlem için yetkin yok." });
    }

    next();
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Sunucu hatası." });
  }
};
