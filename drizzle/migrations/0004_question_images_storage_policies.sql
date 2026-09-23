CREATE POLICY "authenticated read question images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'question-images');

CREATE POLICY "admins write question images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'question-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins update question images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'question-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins delete question images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'question-images' AND public.has_role(auth.uid(), 'admin'));