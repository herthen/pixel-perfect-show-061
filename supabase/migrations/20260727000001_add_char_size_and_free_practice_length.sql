ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS char_size TEXT NOT NULL DEFAULT 'md',
  ADD COLUMN IF NOT EXISTS free_practice_session_length INTEGER NOT NULL DEFAULT 20;
