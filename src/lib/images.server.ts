type StorageClient = {
  storage: {
    from: (bucket: string) => {
      createSignedUrls: (
        paths: string[],
        expiresIn: number,
      ) => Promise<{ data: Array<{ path: string | null; signedUrl: string }> | null }>;
    };
  };
};

export const QUESTION_IMAGE_BUCKET = "question-images";

/** Turns stored image paths into temporary readable URLs, keeping row order. */
export async function withSignedImages<T extends { image_url?: string | null }>(
  supabase: StorageClient,
  rows: T[],
): Promise<Array<T & { image_url: string | null }>> {
  const paths = Array.from(new Set(rows.map((r) => r.image_url).filter((p): p is string => !!p)));
  if (paths.length === 0) return rows.map((r) => ({ ...r, image_url: null }));

  const { data } = await supabase.storage.from(QUESTION_IMAGE_BUCKET).createSignedUrls(paths, 60 * 60 * 3);
  const map = new Map((data ?? []).map((d) => [d.path ?? "", d.signedUrl]));
  return rows.map((r) => ({ ...r, image_url: r.image_url ? (map.get(r.image_url) ?? null) : null }));
}
