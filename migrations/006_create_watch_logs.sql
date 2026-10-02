CREATE TABLE IF NOT EXISTS watch_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  media_id INT NOT NULL,
  media_type ENUM('movie', 'tv') NOT NULL,

  watched_on DATE NOT NULL,
  companions VARCHAR(255) NULL,
  location ENUM('cinema', 'home', 'other') NULL,
  rating TINYINT UNSIGNED NULL,
  note TEXT NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_watch_logs_rating CHECK (rating BETWEEN 1 AND 10),
  INDEX idx_user_date (user_id, watched_on),
  INDEX idx_user_media (user_id, media_id, media_type)
);
