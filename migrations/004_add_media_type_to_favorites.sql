ALTER TABLE favorites
  CHANGE COLUMN movie_id media_id INT NOT NULL;

ALTER TABLE favorites
  ADD COLUMN media_type ENUM('movie', 'tv') NOT NULL DEFAULT 'movie' AFTER media_id;

ALTER TABLE favorites
  DROP INDEX unique_favorite,
  ADD UNIQUE KEY unique_favorite (user_id, media_id, media_type);
