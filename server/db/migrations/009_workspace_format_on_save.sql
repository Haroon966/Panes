-- Optional Monaco formatDocument before manual workspace save (Ctrl+S / Save button).
ALTER TABLE app_prefs ADD COLUMN workspace_format_on_save INTEGER NOT NULL DEFAULT 0;
