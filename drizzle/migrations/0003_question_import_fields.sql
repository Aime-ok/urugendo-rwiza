ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS source_order integer,
  ADD COLUMN IF NOT EXISTS source_page integer,
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS raw_text text,
  ADD COLUMN IF NOT EXISTS import_source text NOT NULL DEFAULT 'manual';

CREATE INDEX IF NOT EXISTS questions_source_order_idx ON public.questions (book_id, source_order);

COMMENT ON COLUMN public.questions.source_order IS 'Original question number/order in the source PDF';
COMMENT ON COLUMN public.questions.needs_review IS 'True when the importer could not extract the question cleanly';