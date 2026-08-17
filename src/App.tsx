import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
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
                <Route path="/app" element={<AppHomePage />} />
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
