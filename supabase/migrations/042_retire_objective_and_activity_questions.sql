-- Retira do questionário de cadastro perguntas que não personalizam
-- indicadores nem o dashboard: objetivo da plataforma e atividade principal.
update public.onboarding_questions
set is_active = false
where code in ('main_objective', 'primary_activity')
   or question in (
     'Qual é o objetivo principal ao usar a plataforma?',
     'Qual é a atividade principal da empresa?'
   );
