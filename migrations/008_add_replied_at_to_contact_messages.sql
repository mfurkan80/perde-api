ALTER TABLE contact_messages
  ADD COLUMN replied_at TIMESTAMP NULL DEFAULT NULL AFTER is_read;
