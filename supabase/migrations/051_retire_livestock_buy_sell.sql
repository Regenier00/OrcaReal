-- Retira do questionário de cadastro a pergunta de compra e venda
-- frequente de animais na pecuária. A resposta só era gravada no perfil
-- e não ativa indicadores, centros de custo nem o dashboard.
-- Compra e venda de animais continuam na estrutura padrão do ramo.

update public.onboarding_questions
set is_active = false
where code = 'pec_buy_sell'
   or question = 'A empresa compra e vende animais com frequência?';
