ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS char_size TEXT NOT NULL DEFAULT 'md',
  ADD COLUMN IF NOT EXISTS free_practice_session_length INTEGER NOT NULL DEFAULT 20;

COMMENT ON COLUMN public.user_settings.char_size IS 'Chinese character display size during study: sm, md, or lg';
COMMENT ON COLUMN public.user_settings.free_practice_session_length IS 'Number of cards to show in a free practice session';