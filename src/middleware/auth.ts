import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
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
