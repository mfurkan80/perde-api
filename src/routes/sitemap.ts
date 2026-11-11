import { Router } from "express";
import "dotenv/config";

const router = Router();

const TMDB_URL = "https://api.themoviedb.org/3";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const PAGES_PER_LIST = 5;

// Her liste sayfası 20 içerik döndürüyor: 4 liste x 5 sayfa = en fazla 400 adres.
const MEDIA_LISTS = [
  { mediaType: "movie", path: "movie/popular" },
  { mediaType: "movie", path: "movie/top_rated" },
  { mediaType: "tv", path: "tv/popular" },
  { mediaType: "tv", path: "tv/top_rated" },
] as const;

const STATIC_PATHS = ["/", "/movie", "/tv", "/contact", "/privacy"];

let cache: { xml: string; createdAt: number } | null = null;

const fetchListIds = async (path: string, page: number): Promise<number[]> => {
  const response = await fetch(
    `${TMDB_URL}/${path}?language=tr-TR&page=${page}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.TMDB_TOKEN}`,
        accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`TMDB ${path} isteği başarısız: ${response.status}`);
  }

  const data = (await response.json()) as { results: { id: number }[] };
  return data.results.map((item) => item.id);
};

const buildSitemap = async (): Promise<string> => {
  const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");

  const requests = MEDIA_LISTS.flatMap((list) =>
    Array.from({ length: PAGES_PER_LIST }, (_, index) =>
      fetchListIds(list.path, index + 1).then((ids) =>
        ids.map((id) => `/${list.mediaType}/${id}`),
      ),
    ),
  );

  const mediaPaths = (await Promise.all(requests)).flat();
  const paths = [...new Set([...STATIC_PATHS, ...mediaPaths])];

  const urls = paths
    .map((path) => `  <url><loc>${appUrl}${path}</loc></url>`)
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    "</urlset>",
    "",
  ].join("\n");
};

router.get("/", async (req, res) => {
  const isFresh = cache && Date.now() - cache.createdAt < CACHE_TTL_MS;

  try {
    if (!cache || !isFresh) {
      cache = { xml: await buildSitemap(), createdAt: Date.now() };
    }
  } catch (err) {
    console.log("Sitemap oluşturulamadı:", err);

    // TMDB'ye ulaşılamazsa eski sitemap varsa onu vermek boş dönmekten iyidir.
    if (!cache) {
      return res.status(503).json({ message: "Sitemap şu anda hazır değil." });
    }
  }

  res
    .type("application/xml")
    .set("Cache-Control", "public, max-age=3600")
    .send(cache.xml);
});

export default router;
