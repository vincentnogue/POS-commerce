import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { I18nProvider } from './lib/i18n';
import { ThemeProvider } from './lib/theme';
import { CookieProvider } from './lib/cookies';
import { CookieBanner } from './components/CookieBanner';
import { SupportChatWidget } from './components/SupportChatWidget';
import { ToastProvider } from './components/ui';
import { RequireAuth, RequireActiveSubscription, RequireSuperAdmin } from './components/RouteGuards';

// Every route is code-split: the initial bundle only ships the app shell
// (providers, router, layout chrome) plus whichever single page matches
// the current URL, instead of all ~30 pages (and their dependencies, like
// jsPDF for invoices) loading eagerly on every visit regardless of what
// the person actually opened.
//
// PERF FIX: AppLayout (Sidebar + Header + TrialBanner, all using
// framer-motion) used to be a plain top-level import — so it, and
// everything it pulls in, shipped in the main bundle for EVERY visitor,
// including an anonymous person just reading the landing page who will
// never see the authenticated app shell at all. Made lazy like every
// other route below.
const AppLayout = lazy(() => import('./components/AppLayout').then((m) => ({ default: m.AppLayout })));
const LandingPage = lazy(() => import('./pages/LandingPage').then((m) => ({ default: m.LandingPage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const SignupPage = lazy(() => import('./pages/SignupPage').then((m) => ({ default: m.SignupPage })));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })));
const PricingPage = lazy(() => import('./pages/PricingPage').then((m) => ({ default: m.PricingPage })));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage').then((m) => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import('./pages/TermsPage').then((m) => ({ default: m.TermsPage })));
const LegalPage = lazy(() => import('./pages/LegalPage').then((m) => ({ default: m.LegalPage })));
const RefundPolicyPage = lazy(() => import('./pages/RefundPolicyPage').then((m) => ({ default: m.RefundPolicyPage })));
const CookiePolicyPage = lazy(() => import('./pages/CookiePolicyPage').then((m) => ({ default: m.CookiePolicyPage })));
const AcceptableUsePage = lazy(() => import('./pages/AcceptableUsePage').then((m) => ({ default: m.AcceptableUsePage })));
const SlaPage = lazy(() => import('./pages/SlaPage').then((m) => ({ default: m.SlaPage })));
const AboutPage = lazy(() => import('./pages/AboutPage').then((m) => ({ default: m.AboutPage })));
const BlogPage = lazy(() => import('./pages/BlogPage').then((m) => ({ default: m.BlogPage })));
const CareersPage = lazy(() => import('./pages/CareersPage').then((m) => ({ default: m.CareersPage })));
const ContactPage = lazy(() => import('./pages/ContactPage').then((m) => ({ default: m.ContactPage })));
const HelpCenterPage = lazy(() => import('./pages/HelpCenterPage').then((m) => ({ default: m.HelpCenterPage })));
const DocumentationPage = lazy(() => import('./pages/DocumentationPage').then((m) => ({ default: m.DocumentationPage })));
const ResourcesPage = lazy(() => import('./pages/ResourcesPage').then((m) => ({ default: m.ResourcesPage })));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage').then((m) => ({ default: m.OnboardingPage })));
const SubscribePage = lazy(() => import('./pages/SubscribePage').then((m) => ({ default: m.SubscribePage })));
const HardwarePage = lazy(() => import('./pages/HardwarePage').then((m) => ({ default: m.HardwarePage })));
const IndustrySolutionsPage = lazy(() => import('./pages/IndustrySolutionsPage').then((m) => ({ default: m.IndustrySolutionsPage })));
const CaseStudiesPage = lazy(() => import('./pages/CaseStudiesPage').then((m) => ({ default: m.CaseStudiesPage })));
const AddOnsPage = lazy(() => import('./pages/AddOnsPage').then((m) => ({ default: m.AddOnsPage })));
const DashboardPage = lazy(() => import('./pages/modules/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const POSPage = lazy(() => import('./pages/modules/POSPage').then((m) => ({ default: m.POSPage })));
const ProductsPage = lazy(() => import('./pages/modules/ProductsPage').then((m) => ({ default: m.ProductsPage })));
const StockPage = lazy(() => import('./pages/modules/StockPage').then((m) => ({ default: m.StockPage })));
const StoresPage = lazy(() => import('./pages/modules/StoresPage').then((m) => ({ default: m.StoresPage })));
const InvoicesPage = lazy(() => import('./pages/modules/InvoicesPage').then((m) => ({ default: m.InvoicesPage })));
const DeliveriesPage = lazy(() => import('./pages/modules/DeliveriesPage').then((m) => ({ default: m.DeliveriesPage })));
const CustomersPage = lazy(() => import('./pages/modules/CustomersPage').then((m) => ({ default: m.CustomersPage })));
const SuppliersPage = lazy(() => import('./pages/modules/SuppliersPage').then((m) => ({ default: m.SuppliersPage })));
const ExpensesPage = lazy(() => import('./pages/modules/ExpensesPage').then((m) => ({ default: m.ExpensesPage })));
const PurchasesPage = lazy(() => import('./pages/modules/PurchasesPage').then((m) => ({ default: m.PurchasesPage })));
const QuotesPage = lazy(() => import('./pages/modules/QuotesPage').then((m) => ({ default: m.QuotesPage })));
const TimeClockPage = lazy(() => import('./pages/modules/TimeClockPage').then((m) => ({ default: m.TimeClockPage })));
const TasksPage = lazy(() => import('./pages/modules/TasksPage').then((m) => ({ default: m.TasksPage })));
const CommissionsPage = lazy(() => import('./pages/modules/CommissionsPage').then((m) => ({ default: m.CommissionsPage })));
const PromotionsPage = lazy(() => import('./pages/modules/PromotionsPage').then((m) => ({ default: m.PromotionsPage })));
const MessagesPage = lazy(() => import('./pages/modules/MessagesPage').then((m) => ({ default: m.MessagesPage })));
const ReportsPage = lazy(() => import('./pages/modules/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const AccountingPage = lazy(() => import('./pages/modules/AccountingPage').then((m) => ({ default: m.AccountingPage })));
const UsersPage = lazy(() => import('./pages/modules/UsersPage').then((m) => ({ default: m.UsersPage })));
const AdministrationPage = lazy(() => import('./pages/modules/AdministrationPage').then((m) => ({ default: m.AdministrationPage })));
const SettingsPage = lazy(() => import('./pages/modules/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const SuperAdminPage = lazy(() => import('./pages/modules/SuperAdminPage').then((m) => ({ default: m.SuperAdminPage })));
const MarketplacePage = lazy(() => import('./pages/modules/MarketplacePage').then((m) => ({ default: m.MarketplacePage })));
const IntegrationDetailPage = lazy(() => import('./pages/IntegrationDetailPage').then((m) => ({ default: m.IntegrationDetailPage })));

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 dark:bg-ink-900">
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-brand-200 border-t-brand-500" />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <CookieProvider>
          <AuthProvider>
            <ToastProvider>
              <BrowserRouter>
                <Suspense fallback={<RouteFallback />}>
                  <Routes>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/pricing" element={<PricingPage />} />
                    <Route path="/privacy" element={<PrivacyPage />} />
                    <Route path="/terms" element={<TermsPage />} />
                    <Route path="/legal" element={<LegalPage />} />
                    <Route path="/refund-policy" element={<RefundPolicyPage />} />
                    <Route path="/cookie-policy" element={<CookiePolicyPage />} />
                    <Route path="/acceptable-use" element={<AcceptableUsePage />} />
                    <Route path="/sla" element={<SlaPage />} />
                    <Route path="/about" element={<AboutPage />} />
                    <Route path="/blog" element={<BlogPage />} />
                    <Route path="/careers" element={<CareersPage />} />
                    <Route path="/contact" element={<ContactPage />} />
                    <Route path="/documentation" element={<DocumentationPage />} />
                    <Route path="/resources" element={<ResourcesPage />} />
                    <Route path="/help" element={<HelpCenterPage />} />
                    <Route path="/hardware" element={<HardwarePage />} />
                    <Route path="/industry-solutions" element={<IndustrySolutionsPage />} />
                    <Route path="/case-studies" element={<CaseStudiesPage />} />
                    <Route path="/addons" element={<AddOnsPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/signup" element={<SignupPage />} />
                    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />
                    <Route
                      path="/onboarding"
                      element={
                        <RequireAuth>
                          <OnboardingPage />
                        </RequireAuth>
                      }
                    />
                    <Route
                      path="/subscribe"
                      element={
                        <RequireAuth>
                          <SubscribePage />
                        </RequireAuth>
                      }
                    />

                    <Route
                      element={
                        <RequireActiveSubscription>
                          <AppLayout />
                        </RequireActiveSubscription>
                      }
                    >
                      <Route
                        path="/superadmin"
                        element={
                          <RequireSuperAdmin>
                            <SuperAdminPage />
                          </RequireSuperAdmin>
                        }
                      />
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
                      <Route path="/timeclock" element={<TimeClockPage />} />
                      <Route path="/tasks" element={<TasksPage />} />
                      <Route path="/commissions" element={<CommissionsPage />} />
                      <Route path="/promotions" element={<PromotionsPage />} />
                      <Route path="/messages" element={<MessagesPage />} />
                      <Route path="/administration" element={<AdministrationPage />} />
                      <Route path="/marketplace" element={<MarketplacePage />} />
                      <Route path="/integration/:id" element={<IntegrationDetailPage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                    </Route>

                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Suspense>

                {/* Déplacés dans BrowserRouter */}
                <CookieBanner />
                <SupportChatWidget />
              </BrowserRouter>
            </ToastProvider>
          </AuthProvider>
        </CookieProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
