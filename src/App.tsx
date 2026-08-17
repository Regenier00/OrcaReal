import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { AppShell } from '@/components/layout/AppShell'
import { HomePage } from '@/pages/HomePage'
import { FeaturesPage } from '@/pages/FeaturesPage'
import { LoginPage } from '@/pages/LoginPage'
import { SignUpPage } from '@/pages/SignUpPage'
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage'
import { AppHomePage } from '@/pages/AppHomePage'
import { CompanyPage } from '@/pages/CompanyPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { DemoPage } from '@/pages/DemoPage'
import { BudgetsPage } from '@/pages/BudgetsPage'
import { BudgetWizardPage } from '@/pages/BudgetWizardPage'
import { BudgetDetailPage } from '@/pages/BudgetDetailPage'

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
            <Route path="/app" element={<AppShell />}>
              <Route index element={<AppHomePage />} />
              <Route path="orcamentos" element={<BudgetsPage />} />
              <Route path="orcamentos/novo" element={<BudgetWizardPage />} />
              <Route path="orcamentos/:id" element={<BudgetDetailPage />} />
              <Route path="orcamentos/:id/editar" element={<BudgetWizardPage />} />
              <Route path="empresa" element={<CompanyPage />} />
              <Route path="perfil" element={<ProfilePage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
