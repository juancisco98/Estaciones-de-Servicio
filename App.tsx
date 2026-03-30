import React, { useState, useEffect, useCallback, Suspense, lazy, useRef } from 'react';
import { Toaster } from 'sonner';
import { handleError } from './utils/errorHandler';

import MapBoard from './components/MapBoard';
import Sidebar, { ViewState } from './components/Sidebar';
import AuthScreen from './components/AuthScreen';
import Header from './components/Header';
import BottomTabBar from './components/BottomTabBar';

import { User, Barbershop, Barber, ShiftClosingMetadata } from './types';
import { DataProvider, useDataContext } from './context/DataContext';
import { supabase, signOut } from './services/supabaseClient';
import { ALLOWED_EMAILS } from './constants';

import { useBarbershops } from './hooks/useBarbershops';
import { useBarbers } from './hooks/useBarbers';
import { useSessions } from './hooks/useSessions';
import { useShiftClosings } from './hooks/useShiftClosings';
import { useAnalytics } from './hooks/useAnalytics';
import { useServices } from './hooks/useServices';

import type { Session } from '@supabase/supabase-js';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

// Lazy load views
const BarbershopCard     = lazy(() => import('./components/BarbershopCard'));
const BarbershopsView    = lazy(() => import('./components/BarbershopsView'));
const BarbersView        = lazy(() => import('./components/BarbersView'));
const SessionHistoryView = lazy(() => import('./components/SessionHistoryView'));
const AnalyticsDashboard = lazy(() => import('./components/AnalyticsDashboard'));
const AdminSettings      = lazy(() => import('./components/AdminSettings'));
const BarberPortal            = lazy(() => import('./components/BarberPortal'));
const LiveDashboardView       = lazy(() => import('./components/LiveDashboardView'));
const ShiftClosingDetailModal = lazy(() => import('./components/ShiftClosingDetailModal'));
const FinancesView            = lazy(() => import('./components/FinancesView'));

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-full">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD (authenticated shell)
// ─────────────────────────────────────────────────────────────────────────────

const Dashboard: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<ViewState>('LIVE');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const { isLoading, refreshData, initBarberMode } = useDataContext();
  const { barbershops, saveBarbershop, deactivateBarbershop } = useBarbershops();
  const { barbers, saveBarber, deactivateBarber } = useBarbers();
  const { sessions, registerSession, updateSession, deleteSession } = useSessions();
  const { shiftClosings, openShift, closeShift, getActiveShift } = useShiftClosings();
  const { getDailySummary, getRevenueByBarbershop, getTopBarbers, getPeriodSummary, getFinancialsByBarbershop, getNetworkFinancials } = useAnalytics();
  const { services, saveService, deactivateService, getServicesForShop } = useServices();

  // Selección en el mapa
  const [selectedBarbershop, setSelectedBarbershop] = useState<Barbershop | null>(null);
  const [mapFlyTo, setMapFlyTo] = useState<[number, number] | undefined>(undefined);
  const [closingDetail, setClosingDetail] = useState<ShiftClosingMetadata | null>(null);

  // Sync selectedBarbershop con datos frescos
  useEffect(() => {
    if (selectedBarbershop) {
      const updated = barbershops.find(b => b.id === selectedBarbershop.id);
      if (updated && updated !== selectedBarbershop) setSelectedBarbershop(updated);
    }
  }, [barbershops, selectedBarbershop]);

  // ── URL State ──
  const isHydrated = useRef(false);

  useEffect(() => {
    if (!isLoading && !isHydrated.current) {
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get('view') as ViewState;
      if (viewParam && (['LIVE', 'MAP', 'BARBERSHOPS', 'BARBERS', 'SESSIONS', 'ANALYTICS', 'SETTINGS'] as string[]).includes(viewParam)) {
        setCurrentView(viewParam);
      }
      isHydrated.current = true;
    }
  }, [isLoading]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set('view', currentView);
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
  }, [currentView]);

  // ── Auth ──
  useEffect(() => {
    const handleAuthChange = async (event: string, session: Session | null) => {
      console.log(`[Auth] Event: ${event}`);

      if (session?.user?.email) {
        const userEmail = session.user.email.toLowerCase();
        console.log('[Auth] Checking access for:', userEmail);

        try {
          // ── Step 1: hardcoded admin list ───────────────────────────────
          if (ALLOWED_EMAILS.map(e => e.toLowerCase()).includes(userEmail)) {
            setCurrentUser({
              id: session.user.id,
              name: session.user.user_metadata?.full_name || userEmail.split('@')[0],
              email: userEmail,
              photoURL: session.user.user_metadata?.avatar_url,
              role: 'ADMIN',
            });
            setIsAuthenticated(true);
            console.log('[Auth] OK → ADMIN (hardcoded)');
            return;
          }

          // ── Step 2: tabla allowed_emails (admins dinámicos) ────────────
          console.log('[Auth] Step 2: checking allowed_emails...');
          const { data: adminData } = await supabase
            .from('allowed_emails')
            .select('email')
            .ilike('email', userEmail)
            .limit(1)
            .maybeSingle();

          if (adminData) {
            setCurrentUser({
              id: session.user.id,
              name: session.user.user_metadata?.full_name || userEmail.split('@')[0],
              email: userEmail,
              photoURL: session.user.user_metadata?.avatar_url,
              role: 'ADMIN',
            });
            setIsAuthenticated(true);
            console.log('[Auth] OK → ADMIN (database)');
            return;
          }

          // ── Step 3: tabla barber_auth → rol BARBER ─────────────────────
          console.log('[Auth] Step 3: checking barber_auth...');
          const { data: barberAuthData } = await supabase
            .from('barber_auth')
            .select('barber_id, barbers(id, name, barbershop_id, is_active)')
            .eq('user_id', session.user.id)
            .limit(1)
            .maybeSingle();

          const grantBarberRole = (barberRecord: any) => {
            setCurrentUser({
              id: session.user.id,
              name: session.user.user_metadata?.full_name || barberRecord.name,
              email: userEmail,
              photoURL: session.user.user_metadata?.avatar_url,
              role: 'BARBER',
              barberId: barberRecord.id,
              barbershopId: barberRecord.barbershop_id,
            });
            setIsAuthenticated(true);
            console.log('[Auth] OK → BARBER:', barberRecord.name);
            // Recarga datos filtrados solo por la barbería del barbero
            initBarberMode(barberRecord.barbershop_id).catch(console.error);
          };

          if (barberAuthData) {
            const barberRecord = (barberAuthData as any).barbers;
            if (!barberRecord?.is_active) {
              console.error('[Auth] DENIED — barber is inactive');
              await signOut();
              handleError(new Error('Barber inactive'), 'Tu cuenta de barbero está desactivada. Contactá al administrador.');
              setIsAuthenticated(false);
              return;
            }
            grantBarberRole(barberRecord);
            return;
          }

          // ── Step 3b: primer login — buscar barbero por email ──────────
          console.log('[Auth] Step 3b: no barber_auth found, looking up barber by email...');
          const { data: barberByEmail } = await supabase
            .from('barbers')
            .select('id, name, barbershop_id, is_active')
            .ilike('email', userEmail)
            .eq('is_active', true)
            .limit(1)
            .maybeSingle();

          if (barberByEmail) {
            console.log('[Auth] Step 3b: barber found by email, creating barber_auth row...');
            const { error: insertError } = await supabase
              .from('barber_auth')
              .insert({ user_id: session.user.id, barber_id: barberByEmail.id });

            if (insertError) {
              if (insertError.code === '23505') {
                // Clave duplicada: la fila ya fue insertada en un disparo previo del evento auth
                // Es seguro continuar — el barbero ya está registrado
                console.log('[Auth] Step 3b: barber_auth already exists (race condition), proceeding...');
                grantBarberRole(barberByEmail);
                return;
              }
              console.error('[Auth] Step 3b: failed to insert barber_auth:', insertError);
              await signOut();
              handleError(insertError, 'Error al registrar tu acceso. Contactá al administrador.');
              setIsAuthenticated(false);
              return;
            }
            grantBarberRole(barberByEmail);
            return;
          }

          // ── No match — denegar acceso ──────────────────────────────────
          console.error('[Auth] DENIED for', userEmail);
          await signOut();
          handleError(new Error('Unauthorized'), `Acceso denegado: ${userEmail} no está registrado. Contactá al administrador.`);
          setIsAuthenticated(false);
          setCurrentUser(null);

        } catch (authFlowError: any) {
          console.error('[Auth] CRITICAL ERROR:', authFlowError);
          await signOut();
          handleError(authFlowError, `Error de autenticación: ${authFlowError?.message || 'desconocido'}`);
          setIsAuthenticated(false);
          setCurrentUser(null);
        }
      } else {
        if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && session === null)) {
          setIsAuthenticated(false);
          setCurrentUser(null);
        }
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      handleAuthChange(event, session);
    });

    // Deep link para Capacitor (Android)
    const handleAppUrlOpen = (data: any) => {
      if (data.url.includes('com.rufianes.app://login-callback')) {
        const urlStr = data.url.replace('#', '?');
        try {
          const url = new URL(urlStr);
          const code = url.searchParams.get('code');
          if (code) {
            supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
              if (error) console.error('[Auth] PKCE exchange failed:', error);
            });
          } else {
            const access_token = url.searchParams.get('access_token');
            const refresh_token = url.searchParams.get('refresh_token');
            if (access_token && refresh_token) supabase.auth.setSession({ access_token, refresh_token });
          }
        } catch (e) {
          console.error('[Auth] Error parsing deep link', e);
        }
      }
    };

    if (Capacitor.isNativePlatform()) CapacitorApp.addListener('appUrlOpen', handleAppUrlOpen);

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) { console.error('[Auth] Error getting session:', error); return; }
      if (session) handleAuthChange('INITIAL_SESSION', session);
    });

    return () => {
      subscription.unsubscribe();
      if (Capacitor.isNativePlatform()) CapacitorApp.removeAllListeners();
    };
  }, []);

  const handleLogout = useCallback(async () => {
    await signOut();
    setIsAuthenticated(false);
    setCurrentUser(null);
  }, []);

  // ── Render ──

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  // Barberos ven solo su portal
  if (currentUser?.role === 'BARBER') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <BarberPortal
          currentUser={currentUser}
          sessions={sessions}
          shiftClosings={shiftClosings}
          services={services}
          barbers={barbers}
          barbershops={barbershops}
          getActiveShift={getActiveShift}
          openShift={openShift}
          closeShift={closeShift}
          registerSession={registerSession}
          getServicesForShop={getServicesForShop}
          onLogout={handleLogout}
        />
      </Suspense>
    );
  }

  // Admin: vista completa — sidebar permanente en desktop, bottom tab bar en mobile
  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">

      {/* Mobile overlay sidebar */}
      <div className="lg:hidden">
        <Sidebar
          currentView={currentView}
          onViewChange={setCurrentView}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          onLogout={handleLogout}
        />
      </div>

      {/* Desktop: sidebar permanente */}
      <div className="hidden lg:flex shrink-0">
        <Sidebar
          currentView={currentView}
          onViewChange={setCurrentView}
          isOpen={false}
          onClose={() => {}}
          onLogout={handleLogout}
          permanent={true}
        />
      </div>

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <main className="flex-1 overflow-hidden relative">
          {/* LIVE DASHBOARD */}
          {currentView === 'LIVE' && (
            <Suspense fallback={<LoadingFallback />}>
              <LiveDashboardView
                barbershops={barbershops}
                barbers={barbers}
                sessions={sessions}
                shiftClosings={shiftClosings}
                getDailySummary={getDailySummary}
                onViewOnMap={(shop) => { setSelectedBarbershop(shop); setCurrentView('MAP'); }}
              />
            </Suspense>
          )}

          {/* MAP */}
          {currentView === 'MAP' && (
            <>
              <MapBoard
                barbershops={barbershops}
                selectedBarbershop={selectedBarbershop}
                onBarbershopSelect={setSelectedBarbershop}
                getDailySummary={getDailySummary}
                flyToCenter={mapFlyTo}
              />
              <Header
                currentUser={currentUser}
                onMenuClick={() => setIsSidebarOpen(true)}
                onLogout={handleLogout}
                onRefresh={refreshData}
                isLoading={isLoading}
                onMapSearch={(lat, lng) => setMapFlyTo([lat, lng])}
                onShiftClosingClick={setClosingDetail}
              />
            </>
          )}

          {/* CARD lateral/bottom sheet en el mapa */}
          {currentView === 'MAP' && selectedBarbershop && (
            <Suspense fallback={null}>
              <BarbershopCard
                barbershop={selectedBarbershop}
                barbers={barbers.filter(b => b.barbershopId === selectedBarbershop.id)}
                sessions={sessions}
                getDailySummary={getDailySummary}
                onClose={() => setSelectedBarbershop(null)}
                onViewBarbers={() => setCurrentView('BARBERS')}
              />
            </Suspense>
          )}

          {/* BARBERSHOPS */}
          {currentView === 'BARBERSHOPS' && (
            <Suspense fallback={<LoadingFallback />}>
              <BarbershopsView
                barbershops={barbershops}
                barbers={barbers}
                sessions={sessions}
                getDailySummary={getDailySummary}
                onSaveBarbershop={saveBarbershop}
                onDeactivateBarbershop={deactivateBarbershop}
                onViewOnMap={(shop) => { setSelectedBarbershop(shop); setCurrentView('MAP'); }}
              />
            </Suspense>
          )}

          {/* BARBERS */}
          {currentView === 'BARBERS' && (
            <Suspense fallback={<LoadingFallback />}>
              <BarbersView
                barbershops={barbershops}
                barbers={barbers}
                sessions={sessions}
                services={services}
                onSaveBarber={saveBarber}
                onDeactivateBarber={deactivateBarber}
                onRegisterSession={registerSession}
                getServicesForShop={getServicesForShop}
              />
            </Suspense>
          )}

          {/* SESSIONS */}
          {currentView === 'SESSIONS' && (
            <Suspense fallback={<LoadingFallback />}>
              <SessionHistoryView
                sessions={sessions}
                barbers={barbers}
                barbershops={barbershops}
                onUpdateSession={updateSession}
                onDeleteSession={deleteSession}
                currentUser={currentUser}
              />
            </Suspense>
          )}

          {/* ANALYTICS */}
          {currentView === 'ANALYTICS' && (
            <Suspense fallback={<LoadingFallback />}>
              <AnalyticsDashboard
                barbershops={barbershops}
                barbers={barbers}
                getRevenueByBarbershop={getRevenueByBarbershop}
                getTopBarbers={getTopBarbers}
                getPeriodSummary={getPeriodSummary}
              />
            </Suspense>
          )}

          {/* FINANCES */}
          {currentView === 'FINANCES' && (
            <Suspense fallback={<LoadingFallback />}>
              <FinancesView
                getFinancialsByBarbershop={getFinancialsByBarbershop}
                getNetworkFinancials={getNetworkFinancials}
              />
            </Suspense>
          )}

          {/* SETTINGS */}
          {currentView === 'SETTINGS' && (
            <Suspense fallback={<LoadingFallback />}>
              <AdminSettings
                barbershops={barbershops}
                barbers={barbers}
                services={services}
                onSaveBarbershop={saveBarbershop}
                onDeactivateBarbershop={deactivateBarbershop}
                onSaveService={saveService}
                onDeactivateService={deactivateService}
              />
            </Suspense>
          )}
        </main>

        {/* Mobile: bottom tab bar */}
        <BottomTabBar
          currentView={currentView}
          onViewChange={setCurrentView}
          className="lg:hidden shrink-0"
        />
      </div>

      {/* Modal desglose de cierre de turno */}
      {closingDetail && (
        <Suspense fallback={null}>
          <ShiftClosingDetailModal
            metadata={closingDetail}
            onClose={() => setClosingDetail(null)}
          />
        </Suspense>
      )}

      <Toaster richColors position="top-right" />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────────────────────

const App: React.FC = () => (
  <DataProvider>
    <Dashboard />
  </DataProvider>
);

export default App;
