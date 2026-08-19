-- Dados padrão da plataforma (catálogos globais)
insert into public.segments (code, name, description) values
  ('services', 'Serviços', 'Empresas de serviços em geral'),
  ('commerce', 'Comércio', 'Varejo e atacado'),
  ('industry', 'Indústria', 'Produção e manufatura'),
  ('agro', 'Agronegócio', 'Agricultura, pecuária e correlatos'),
  ('tech', 'Tecnologia', 'Software, SaaS e tecnologia'),
  ('other', 'Outros', 'Outros ramos de atividade');

insert into public.activities (code, name, description, segment_id)
select v.code, v.name, v.description, s.id
from (
  values
    ('consulting', 'Consultoria', 'Prestação de consultoria', 'services'),
    ('retail', 'Varejo', 'Venda ao consumidor final', 'commerce'),
    ('manufacturing', 'Manufatura', 'Produção industrial', 'industry'),
    ('livestock', 'Pecuária', 'Criação animal', 'agro'),
    ('agriculture', 'Agricultura', 'Cultivo agrícola', 'agro'),
    ('saas', 'SaaS', 'Software como serviço', 'tech')
) as v(code, name, description, segment_code)
join public.segments s on s.code = v.segment_code;

insert into public.system_features (code, name, description, sort_order) values
  ('budget', 'Orçamento', 'Planejamento orçamentário e importação', 10),
  ('actual', 'Realizado', 'Lançamentos do realizado', 20),
  ('budget_vs_actual', 'Orçado × Realizado', 'Comparação entre orçado e realizado', 30),
  ('cost_analysis', 'Análise de Custos', 'Entendimento e concentração de custos', 40),
  ('indicators', 'Indicadores', 'Indicadores financeiros e simulações', 50),
  ('reports', 'Relatórios', 'Exportação de relatórios em Excel e PDF', 60);

insert into public.system_indicators (code, name, description, formula_hint, sort_order) values
  ('budget_variance', 'Desvio Orçamentário', 'Diferença entre orçado e realizado', 'realizado - orçado', 10),
  ('budget_variance_pct', 'Desvio Orçamentário %', 'Percentual de desvio', '(realizado - orçado) / orçado', 20),
  ('cost_concentration', 'Concentração de Custos', 'Participação dos maiores custos', 'top custos / custo total', 30);

insert into public.system_reports (code, name, description, sort_order) values
  ('dashboard_oxr', 'Dashboard Orçado × Realizado', 'Relatório do dashboard principal', 10),
  ('indicators', 'Indicadores', 'Relatório de indicadores', 20),
  ('budget_deviation', 'Desvio Orçamentário', 'Relatório de desvios', 30);

insert into public.onboarding_questions (code, question, help_text, answer_type, options, sort_order) values
  (
    'segment',
    'Qual é o ramo principal da sua empresa?',
    'Isso ajuda a recomendar estrutura e indicadores.',
    'single',
    '["Serviços","Comércio","Indústria","Agronegócio","Tecnologia","Outros"]'::jsonb,
    10
  );

insert into public.import_templates (code, name, version, kind, schema_definition) values
  (
    'budget_standard_v1',
    'Orçamento padrão',
    '1.0',
    'budget',
    '{"columns":["periodo","departamento","centro_custo","categoria","valor"]}'::jsonb
  );

insert into public.export_templates (code, name, version, kind) values
  ('report_oxr_v1', 'Exportação Orçado × Realizado', '1.0', 'report');
