CREATE TABLE IF NOT EXISTS comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  media_id INT NOT NULL,
  media_type ENUM('movie', 'tv') NOT NULL,
  parent_id INT NULL,
  content TEXT NOT NULL,
  is_spoiler BOOLEAN NOT NULL DEFAULT FALSE,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE,
  INDEX idx_media (media_id, media_type, status)
);
