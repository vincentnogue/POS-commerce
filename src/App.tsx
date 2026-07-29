import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { I18nProvider } from './lib/i18n';
import { ThemeProvider } from './lib/theme';
import { CookieProvider } from './lib/cookies';
import { CookieBanner } from './components/CookieBanner';
import { ToastProvider } from './components/ui';
import { AppLayout } from './components/AppLayout';
import { RequireAuth, RequireActiveSubscription } from './components/RouteGuards';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { PricingPage } from './pages/PricingPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { TermsPage } from './pages/TermsPage';
import { LegalPage } from './pages/LegalPage';
import { AboutPage } from './pages/AboutPage';
import { BlogPage } from './pages/BlogPage';
import { CareersPage } from './pages/CareersPage';
import { ContactPage } from './pages/ContactPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { SubscribePage } from './pages/SubscribePage';
import { DashboardPage } from './pages/modules/DashboardPage';
import { POSPage } from './pages/modules/POSPage';
import { ProductsPage } from './pages/modules/ProductsPage';
import { StockPage } from './pages/modules/StockPage';
import { StoresPage } from './pages/modules/StoresPage';
import { InvoicesPage } from './pages/modules/InvoicesPage';
import { DeliveriesPage } from './pages/modules/DeliveriesPage';
import { CustomersPage } from './pages/modules/CustomersPage';
import { SuppliersPage } from './pages/modules/SuppliersPage';
import { ExpensesPage } from './pages/modules/ExpensesPage';
import { PurchasesPage } from './pages/modules/PurchasesPage';
import { QuotesPage } from './pages/modules/QuotesPage';
import { ReportsPage } from './pages/modules/ReportsPage';
import { AccountingPage } from './pages/modules/AccountingPage';
import { UsersPage } from './pages/modules/UsersPage';
import { AdministrationPage } from './pages/modules/AdministrationPage';
import { SettingsPage } from './pages/modules/SettingsPage';
import { SuperAdminPage } from './pages/modules/SuperAdminPage';

export default function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <CookieProvider>
          <AuthProvider>
            <ToastProvider>
              <BrowserRouter>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/legal" element={<LegalPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/blog" element={<BlogPage />} />
              <Route path="/careers" element={<CareersPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/onboarding" element={<RequireAuth><OnboardingPage /></RequireAuth>} />
              <Route path="/subscribe" element={<RequireAuth><SubscribePage /></RequireAuth>} />

              <Route element={<RequireActiveSubscription><AppLayout /></RequireActiveSubscription>}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/pos" element={<POSPage />} />
                <Route path="/products" element={<ProductsPage />} />
                <Route path="/stock" element={<StockPage />} />
                <Route path="/stores" element={<StoresPage />} />
                <Route path="/invoices" element={<InvoicesPage />} />
                <Route path="/deliveries" element={<DeliveriesPage />} />
                <Route path="/customers" element={<CustomersPage />} />
                <Route path="/suppliers" element={<SuppliersPage />} />
                <Route path="/expenses" element={<ExpensesPage />} />
                <Route path="/purchases" element={<PurchasesPage />} />
                <Route path="/quotes" element={<QuotesPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/accounting" element={<AccountingPage />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/administration" element={<AdministrationPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/superadmin" element={<SuperAdminPage />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
          <CookieBanner />
            </ToastProvider>
          </AuthProvider>
        </CookieProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
