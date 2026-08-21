-- Campo "Outro" passa a ser descrito na mesma tela de produtos (wizard).
-- Mantém a pergunta no banco só para maps_to / perfil econômico.

update public.onboarding_questions
set
  help_text =
    'As opções vêm do ramo e das outras operações, com base nas fontes setoriais. Pode marcar mais de um. Se não encontrar, marque Outro e descreva na mesma tela.',
  is_active = true
where code = 'products_offered';

update public.onboarding_questions
set
  help_text =
    'Preenchido na tela de produtos quando Outro é marcado. Usamos a descrição para buscar opções relacionadas.',
  -- show_when impossível: a UI coleta embutido; o frontend também ignora este código no wizard
  show_when = '{"eq":{"answer":"__inline_only__","value":"__inline_only__"}}'::jsonb,
  is_optional = true,
  is_active = true
where code = 'products_other_describe';
