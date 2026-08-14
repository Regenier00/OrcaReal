create policy "Users can add themselves to companies"
on public.company_users
for insert
to authenticated
with check (auth.uid() = user_id);