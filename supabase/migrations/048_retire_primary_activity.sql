-- Retira do questionário de cadastro a atividade principal em texto livre.
-- Indicadores e dashboard já vêm do ramo, modelo de receita e operação.
-- Respostas antigas permanecem no perfil e no hero.
update public.onboarding_questions
set is_active = false
where code = 'primary_activity'
   or question = 'Qual é a atividade principal da empresa?';
