import React, { useState, useEffect, useCallback, Suspense, lazy, useRef } from 'react';
import { Toaster } from 'sonner';
import { Menu } from 'lucide-react';
import { handleError } from './utils/errorHandler';

import MapBoard from './components/MapBoard';
import Sidebar, { ViewState } from './components/Sidebar';
import AuthScreen from './components/AuthScreen';
import Header from './components/Header';
import BottomTabBar from './components/BottomTabBar';

import { User, Station } from './types';
import { DataProvider, useDataContext } from './context/DataContext';
import { supabase, signOut } from './services/supabaseClient';
import { ALLOWED_EMAILS } from './constants';

import { useStations } from './hooks/useStations';
import { useEmployees } from './hooks/useEmployees';
import { useSalesTransactions } from './hooks/useSalesTransactions';
import { useDailyClosings } from './hooks/useDailyClosings';
import { useTankLevels } from './hooks/useTankLevels';
import { useAlerts } from './hooks/useAlerts';
import { useAnalytics } from './hooks/useAnalytics';

import type { Session } from '@supabase/supabase-js';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

// Lazy load views
const StationsView       = lazy(() => import('./components/StationsView'));
const SalesHistoryView   = lazy(() => import('./components/SalesHistoryView'));
const TankLevelsView     = lazy(() => import('./components/TankLevelsView'));
const AlertsView         = lazy(() => import('./components/AlertsView'));
const PlayaView          = lazy(() => import('./components/PlayaView'));
const ShopView           = lazy(() => import('./components/ShopView'));
const CardPaymentsView   = lazy(() => import('./components/CardPaymentsView'));
const AnalyticsDashboard = lazy(() => import('./components/AnalyticsDashboard'));
const AdminSettings      = lazy(() => import('./components/AdminSettings'));
const StationCard        = lazy(() => import('./components/StationCard'));

const VALID_VIEWS: ViewState[] = ['MAP', 'STATIONS', 'SALES', 'TANKS', 'ALERTS', 'PLAYA', 'SHOP', 'ACCOUNTS', 'ANALYTICS', 'SETTINGS'];

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
  const [currentUser, setCurrentUser]         = useState<User | null>(null);
  const [currentView, setCurrentView]         = useState<ViewState>('MAP');
  const [isSidebarOpen, setIsSidebarOpen]     = useState(false);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [activeStationId, setActiveStationId] = useState<string | null>(null);
  const [mapFlyTo, setMapFlyTo]               = useState<[number, number] | undefined>(undefined);

  const { isLoading, refreshData, unresolvedAlertCount, criticalAlertCount } = useDataContext();
  const { stations, saveStation, deactivateStation, deleteStation } = useStations();
  const { employees } = useEmployees();
  const { salesTransactions }                           = useSalesTransactions();
  const { dailyClosings, addNotes, discrepancyCount }   = useDailyClosings();
  const { tankLevels }                                  = useTankLevels();
  const { alerts, resolveAlert }                        = useAlerts();
  const { getStationMetrics, getDailyTimeSeries, getNetworkSummary, getPeriodSummary } = useAnalytics();

  // ── Refresh button (triggers edge agent scan via Supabase) ──
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    // Find which station to refresh (active or first)
    const stationId = activeStationId || stations[0]?.id;
    if (!stationId) return;

    setIsRefreshing(true);
    const { toast } = await import('sonner');
    try {
      const { generateUUID } = await import('./utils/generateUUID');
      const requestId = generateUUID();
      // Insert scan request
      const { error } = await supabase.from('scan_requests').insert({
        id: requestId,
        station_id: stationId,
        requested_by: currentUser?.email ?? null,
      });
      if (error) throw error;

      toast.info('Solicitando actualizacion de datos...');

      // Poll for completion (max 60 seconds)
      const start = Date.now();
      const poll = setInterval(async () => {
        const { data } = await supabase
          .from('scan_requests')
          .select('status,files_processed')
          .eq('id', requestId)
          .limit(1)
          .maybeSingle();

        if (data?.status === 'completed') {
          clearInterval(poll);
          toast.success(`Datos actualizados (${data.files_processed ?? 0} archivos)`);
          setIsRefreshing(false);
          refreshData();
        } else if (data?.status === 'failed') {
          clearInterval(poll);
          toast.error('Error al actualizar datos');
          setIsRefreshing(false);
        } else if (Date.now() - start > 60000) {
          clearInterval(poll);
          toast.warning('Tiempo agotado. El agente puede no estar activo.');
          setIsRefreshing(false);
        }
      }, 3000);
    } catch (err) {
      handleError(err, 'Error al solicitar actualizacion');
      setIsRefreshing(false);
    }
  }, [isRefreshing, activeStationId, stations, currentUser, refreshData]);

  // Sync selectedStation with fresh data
  useEffect(() => {
    if (selectedStation) {
      const updated = stations.find(s => s.id === selectedStation.id);
      if (updated && updated !== selectedStation) setSelectedStation(updated);
    }
  }, [stations, selectedStation]);

  // ── URL State ──
  const isHydrated = useRef(false);

  useEffect(() => {
    if (!isLoading && !isHydrated.current) {
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get('view') as ViewState;
      if (viewParam && (VALID_VIEWS as string[]).includes(viewParam)) {
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

          // ── Step 2: allowed_emails table (dynamic admins) ──────────────
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

          // ── No match — deny access ─────────────────────────────────────
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

    // Deep link for Capacitor (Android)
    const handleAppUrlOpen = (data: any) => {
      if (data.url.includes('com.stationos.app://login-callback')) {
        const urlStr = data.url.replace('#', '?');
        try {
          const url = new URL(urlStr);
          const code = url.searchParams.get('code');
          if (code) {
            supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
              if (error) console.error('[Auth] PKCE exchange failed:', error);
            });
          } else {
            const access_token  = url.searchParams.get('access_token');
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
          unresolvedAlertCount={unresolvedAlertCount}
          criticalAlertCount={criticalAlertCount}
          discrepancyCount={discrepancyCount}
          currentUser={currentUser}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />
      </div>

      {/* Desktop: permanent sidebar */}
      <div className="hidden lg:flex shrink-0">
        <Sidebar
          currentView={currentView}
          onViewChange={setCurrentView}
          isOpen={false}
          onClose={() => {}}
          onLogout={handleLogout}
          unresolvedAlertCount={unresolvedAlertCount}
          criticalAlertCount={criticalAlertCount}
          discrepancyCount={discrepancyCount}
          currentUser={currentUser}
          permanent={true}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />
      </div>

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <main className="flex-1 overflow-hidden relative">

          {/* Header — only on MAP view */}
          {currentView === 'MAP' && (
            <Header
              currentUser={currentUser}
              onMenuClick={() => setIsSidebarOpen(true)}
              onLogout={handleLogout}
              onRefresh={refreshData}
              isLoading={isLoading}
              onMapSearch={(lat: number, lng: number) => setMapFlyTo([lat, lng])}
              unresolvedAlertCount={unresolvedAlertCount}
              criticalAlertCount={criticalAlertCount}
            />
          )}

          {/* Mobile menu button — non-MAP views (sidebar handles nav on desktop) */}
          {currentView !== 'MAP' && (
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden absolute top-4 left-4 z-[800] p-2.5 w-11 h-11 flex items-center justify-center
                         bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl
                         border border-white/60 dark:border-white/10
                         rounded-xl text-gray-700 dark:text-white
                         transition-all active:scale-95"
              style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}
              aria-label="Abrir menú"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          {/* MAP */}
          {currentView === 'MAP' && (
            <>
              <MapBoard
                stations={stations}
                selectedStation={selectedStation}
                onStationSelect={(s) => { setSelectedStation(s); if (s) setActiveStationId(s.id); }}
                flyToCenter={mapFlyTo}
              />
            </>
          )}

          {/* Station side card on map */}
          {currentView === 'MAP' && selectedStation && (
            <Suspense fallback={null}>
              <StationCard
                station={selectedStation}
                employees={employees.filter(e => e.stationId === selectedStation.id)}
                salesTransactions={salesTransactions.filter(t => t.stationId === selectedStation.id)}
                alerts={alerts.filter(a => a.stationId === selectedStation.id && !a.resolved)}
                onClose={() => setSelectedStation(null)}
                onViewDetails={() => setCurrentView('STATIONS')}
              />
            </Suspense>
          )}

          {/* STATIONS */}
          {currentView === 'STATIONS' && (
            <Suspense fallback={<LoadingFallback />}>
              <StationsView
                stations={stations}
                employees={employees}
                alerts={alerts}
                onSaveStation={saveStation}
                onDeactivateStation={deactivateStation}
                onDeleteStation={deleteStation}
                onViewOnMap={(station) => { setSelectedStation(station); setCurrentView('MAP'); }}
                currentUser={currentUser}
              />
            </Suspense>
          )}

          {/* SALES */}
          {currentView === 'SALES' && (
            <Suspense fallback={<LoadingFallback />}>
              <SalesHistoryView
                stations={stations}
                salesTransactions={salesTransactions}
                currentUser={currentUser}
                activeStationId={activeStationId}
                onStationChange={setActiveStationId}
              />
            </Suspense>
          )}

          {/* TANKS */}
          {currentView === 'TANKS' && (
            <Suspense fallback={<LoadingFallback />}>
              <TankLevelsView
                stations={stations}
                currentUser={currentUser}
                activeStationId={activeStationId}
                onStationChange={setActiveStationId}
              />
            </Suspense>
          )}

          {/* ALERTS */}
          {currentView === 'ALERTS' && (
            <Suspense fallback={<LoadingFallback />}>
              <AlertsView
                alerts={alerts}
                stations={stations}
                onResolveAlert={resolveAlert}
                currentUser={currentUser}
                activeStationId={activeStationId}
                onStationChange={setActiveStationId}
              />
            </Suspense>
          )}

          {/* PLAYA (Forecourt totals from P*.TXT) */}
          {currentView === 'PLAYA' && (
            <Suspense fallback={<LoadingFallback />}>
              <PlayaView
                stations={stations}
                dailyClosings={dailyClosings}
                salesTransactions={salesTransactions}
                currentUser={currentUser}
                activeStationId={activeStationId}
                onStationChange={setActiveStationId}
              />
            </Suspense>
          )}

          {/* SHOP (Mini Mercado totals from S*.TXT) */}
          {currentView === 'SHOP' && (
            <Suspense fallback={<LoadingFallback />}>
              <ShopView
                stations={stations}
                dailyClosings={dailyClosings}
                salesTransactions={salesTransactions}
                currentUser={currentUser}
                activeStationId={activeStationId}
                onStationChange={setActiveStationId}
              />
            </Suspense>
          )}

          {/* ACCOUNTS (Cuentas Corrientes) */}
          {currentView === 'ACCOUNTS' && (
            <Suspense fallback={<LoadingFallback />}>
              <CardPaymentsView
                stations={stations}
                currentUser={currentUser}
                activeStationId={activeStationId}
                onStationChange={setActiveStationId}
              />
            </Suspense>
          )}

          {/* ANALYTICS */}
          {currentView === 'ANALYTICS' && (
            <Suspense fallback={<LoadingFallback />}>
              <AnalyticsDashboard
                stations={stations}
                getStationMetrics={getStationMetrics}
                getDailyTimeSeries={getDailyTimeSeries}
                getNetworkSummary={getNetworkSummary}
                getPeriodSummary={getPeriodSummary}
              />
            </Suspense>
          )}

          {/* SETTINGS */}
          {currentView === 'SETTINGS' && (
            <Suspense fallback={<LoadingFallback />}>
              <AdminSettings
                stations={stations}
                onSaveStation={saveStation}
                onDeactivateStation={deactivateStation}
                currentUser={currentUser}
              />
            </Suspense>
          )}

        </main>

        {/* Mobile: bottom tab bar */}
        <BottomTabBar
          currentView={currentView}
          onViewChange={setCurrentView}
          unresolvedAlertCount={unresolvedAlertCount}
          criticalAlertCount={criticalAlertCount}
          className="lg:hidden shrink-0"
        />
      </div>

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
