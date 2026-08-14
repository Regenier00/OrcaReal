create policy "Users can create companies"
on public.companies
for insert
to authenticated
with check (true);