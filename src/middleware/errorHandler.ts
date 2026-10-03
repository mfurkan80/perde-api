import type { NextFunction, Request, Response } from "express";

export const notFound = (req: Request, res: Response) => {
  res.status(404).json({ message: "Böyle bir adres yok." });
};

const getStatus = (err: unknown) =>
  typeof err === "object" &&
  err !== null &&
  "status" in err &&
  typeof err.status === "number"
    ? err.status
    : 500;

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const status = getStatus(err);

  if (status >= 500) {
    console.log(err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }

  return res.status(status).json({ message: "Geçersiz istek." });
};
