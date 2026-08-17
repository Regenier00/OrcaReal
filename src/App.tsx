import { BrowserRouter, Navigate, Route, Routes, useSearchParams } from 'react-router-dom'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { CompanyProvider } from '@/features/company/CompanyProvider'
import { AuthenticatedLayout } from '@/features/company/AuthenticatedLayout'
import { HomePage } from '@/pages/HomePage'
import { FeaturesPage } from '@/pages/FeaturesPage'
import { LoginPage } from '@/pages/LoginPage'
import { SignUpPage } from '@/pages/SignUpPage'
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage'
import { AppHomePage } from '@/pages/AppHomePage'
import { CompanyPage } from '@/pages/CompanyPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { DemoPage } from '@/pages/DemoPage'
import { CreateCompanyPage } from '@/pages/CreateCompanyPage'
import { CompanyCreatedPage } from '@/pages/CompanyCreatedPage'
import { CompanySetupPage } from '@/pages/CompanySetupPage'
import { ExperienceWizardPage } from '@/pages/ExperienceWizardPage'
import { ExperienceReadyPage } from '@/pages/ExperienceReadyPage'
import { BudgetsPage } from '@/pages/BudgetsPage'
import { BudgetWizardPage } from '@/pages/BudgetWizardPage'
import { BudgetDetailPage } from '@/pages/BudgetDetailPage'
import { ActualPage } from '@/pages/ActualPage'
import { ImportStatementPage } from '@/pages/ImportStatementPage'
import { ClassifyTransactionsPage } from '@/pages/ClassifyTransactionsPage'
import { ActualsPage } from '@/pages/ActualsPage'
import { ActualWizardPage } from '@/pages/ActualWizardPage'
import { ActualDetailPage } from '@/pages/ActualDetailPage'
import { BudgetVsActualPage } from '@/pages/BudgetVsActualPage'
import { IndicatorsPage } from '@/pages/IndicatorsPage'
import { ACTUAL_PATHS } from '@/features/actual/model'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/funcionalidades" element={<FeaturesPage />} />
          <Route path="/demo" element={<DemoPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/cadastro" element={<SignUpPage />} />
          <Route path="/recuperar-senha" element={<ForgotPasswordPage />} />

          <Route element={<RequireAuth />}>
            <Route element={<CompanyProvider />}>
              <Route element={<AuthenticatedLayout />}>
                <Route path="/app/criar-empresa" element={<CreateCompanyPage />} />
                <Route path="/app/empresa-criada" element={<CompanyCreatedPage />} />
                <Route
                  path="/app/configurar-ambiente"
                  element={<CompanySetupPage />}
                />
                <Route
                  path="/app/conhecer-empresa"
                  element={<ExperienceWizardPage />}
                />
                <Route
                  path="/app/ambiente-pronto"
                  element={<ExperienceReadyPage />}
                />
                <Route path="/app" element={<AppHomePage />} />
                <Route path="/app/orcamentos" element={<BudgetsPage />} />
                <Route path="/app/orcamentos/novo" element={<BudgetWizardPage />} />
                <Route path="/app/orcamentos/:id" element={<BudgetDetailPage />} />
                <Route
                  path="/app/orcamentos/:id/editar"
                  element={<BudgetWizardPage />}
                />
                <Route path={ACTUAL_PATHS.root} element={<ActualPage />} />
                <Route
                  path={ACTUAL_PATHS.import}
                  element={<ImportStatementPage />}
                />
                <Route
                  path={ACTUAL_PATHS.unappropriated}
                  element={<ClassifyTransactionsPage />}
                />
                <Route
                  path="/app/realizado/classificar"
                  element={<RedirectUnappropriated />}
                />
                <Route path={ACTUAL_PATHS.byBudget} element={<ActualsPage />} />
                <Route path="/app/realizado/novo" element={<ActualWizardPage />} />
                <Route path="/app/realizado/:id" element={<ActualDetailPage />} />
                <Route
                  path="/app/realizado/:id/editar"
                  element={<ActualWizardPage />}
                />
                <Route
                  path="/app/orcado-realizado"
                  element={<BudgetVsActualPage />}
                />
                <Route path="/app/indicadores" element={<IndicatorsPage />} />
                <Route path="/app/empresa" element={<CompanyPage />} />
                <Route path="/app/perfil" element={<ProfilePage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

function RedirectUnappropriated() {
  const [params] = useSearchParams()
  const search = params.toString()
  return (
    <Navigate
      to={`${ACTUAL_PATHS.unappropriated}${search ? `?${search}` : ''}`}
      replace
    />
  )
}
