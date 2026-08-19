-- Retira do questionário de cadastro a pergunta de como a empresa
-- controla as finanças hoje: resíduo do onboarding antigo, sem efeito
-- em indicadores, dashboard ou estrutura.
update public.onboarding_questions
set is_active = false
where code = 'control_method'
   or question = 'Como a empresa controla as finanças hoje?';
