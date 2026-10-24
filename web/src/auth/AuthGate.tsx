import type { ReactNode } from 'react';
import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { OrganizationProvider, useOrganization } from './contexts/OrganizationContext';
import { Navigate, useLocation } from './shim/router';
import { BrandMark } from './components/Logo';
import Landing from '../landing/Landing';
import LoginPage from './pages/auth/LoginPage';
import SignUpPage from './pages/auth/SignUpPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import OnboardingPage from './pages/onboarding/OnboardingPage';
import CreateOrganizationPage from './pages/onboarding/CreateOrganizationPage';
import InvitationsPage from './pages/onboarding/InvitationsPage';
import SelectOrganizationPage from './pages/dashboard/SelectOrganizationPage';
import './auth.css';

const PUBLIC: Record<string, () => JSX.Element> = { '/login': LoginPage, '/signup': SignUpPage, '/forgot-password': ForgotPasswordPage };
const SETUP: Record<string, () => JSX.Element> = { '/onboarding': OnboardingPage, '/onboarding/create-organization': CreateOrganizationPage, '/onboarding/invitations': InvitationsPage, '/organizations/select': SelectOrganizationPage };

function Loader({ label }: { label: string }) {
  return (
    <div className="u-root au-root au-theme flex min-h-screen flex-col items-center justify-center gap-4">
      <div className="flex flex-col items-center">
        <BrandMark size="lg" />
        <p className="mt-5 text-[12.5px] font-medium text-u-ink2">{label}</p>
        <p className="mt-1.5 text-[10.5px] text-u-muted">Resolving account & organization access</p>
      </div>
    </div>
  );
}

function Routes({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { user, initializing } = useAuth();
  const { loading, workspaces, activeOrganization } = useOrganization();
  const path = pathname.replace(/\/+$/, '') || '/';
  const Public = PUBLIC[path];
  const Setup = SETUP[path];

  if (initializing) return <Loader label="Checking your session" />;
  if (!user) {
    if (path === '/') return <Landing />;
    if (Public) return <div className="u-root au-root au-theme"><Public /></div>;
    return <Navigate to="/login" replace />;
  }
  if (loading) return <Loader label="Resolving organizations" />;
  const home = workspaces.length === 0 ? '/onboarding' : activeOrganization ? '/app/dashboard' : '/organizations/select';
  if (Public) return <Navigate to={home} replace />;
  if (Setup) return <div className="u-root au-root au-theme"><Setup /></div>;
  if (workspaces.length === 0) return <Navigate to="/onboarding" replace />;
  if (!activeOrganization) return <Navigate to="/organizations/select" replace />;
  return <>{children}</>;
}

/** Puts the whole app behind the prototype's sign-in, onboarding and organization selection. */
export default function AuthGate({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <OrganizationProvider>
          <Routes>{children}</Routes>
        </OrganizationProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
