create policy "admins upload books" on storage.objects for insert to authenticated
  with check (bucket_id = 'books' and public.has_role(auth.uid(),'admin'));
create policy "admins read books" on storage.objects for select to authenticated
  using (bucket_id = 'books' and public.has_role(auth.uid(),'admin'));
create policy "admins delete books" on storage.objects for delete to authenticated
  using (bucket_id = 'books' and public.has_role(auth.uid(),'admin'));