-- Retira do questionário de cadastro a pergunta de atividades genéricas.
update public.onboarding_questions
set is_active = false
where code = 'activities'
   or question = 'Quais atividades a empresa realiza?';
