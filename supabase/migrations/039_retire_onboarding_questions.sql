-- Retira do questionário de cadastro as perguntas de maturidade financeira
-- e "Quais custos são mais relevantes?".
update public.onboarding_questions
set is_active = false
where code in ('maturity', 'tech_costs', 'hlt_costs', 'min_costs', 'media_costs')
   or question in (
     'Como você avalia a maturidade do controle financeiro?',
     'Quais custos são mais relevantes?'
   );
