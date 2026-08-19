-- Retira do questionário de cadastro a pergunta de objetivo ao usar a
-- plataforma: resíduo do onboarding antigo, sem efeito em indicadores,
-- dashboard ou estrutura.
update public.onboarding_questions
set is_active = false
where code = 'main_objective'
   or question = 'Qual é o objetivo principal ao usar a plataforma?';
