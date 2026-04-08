import React, { useState, useEffect } from 'react';
import { Fuel, ArrowRight, Loader2 } from 'lucide-react';

const AUTO_CLEAR_ERROR_MS = 5000;

const AuthScreen: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(''), AUTO_CLEAR_ERROR_MS);
    return () => clearTimeout(timer);
  }, [error]);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError('');
    const { signInWithGoogle } = await import('../services/supabaseClient');
    const { error: authError } = await signInWithGoogle();
    if (authError) {
      console.error('[Auth] Google Login Error:', authError);
      setError('Error al iniciar sesión con Google. Verificá tu conexión.');
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[5000] bg-slate-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 z-0">
        <img
          src="https://images.unsplash.com/photo-1545262810-77515befe149?q=80&w=2070&auto=format&fit=crop"
          alt="Station-OS"
          className="w-full h-full object-cover opacity-25"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-slate-900/40" />
      </div>
      <div
          className="relative z-10 w-full max-w-md p-10 rounded-3xl animate-spring-in"
          style={{
              background: 'rgba(15,23,42,0.65)',
              backdropFilter: 'blur(32px) saturate(180%)',
              WebkitBackdropFilter: 'blur(32px) saturate(180%)',
              border: '1px solid rgba(255,255,255,0.10)',
              boxShadow: '0 32px 80px rgba(0,0,0,0.60), 0 8px 24px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.08)',
          }}
      >
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-amber-500/20 border border-amber-400/30 mb-5">
            <Fuel className="w-10 h-10 text-amber-400" />
          </div>
          <h1 className="text-5xl font-black text-white tracking-tight">Station-OS</h1>
          <p className="text-amber-400/80 mt-1.5 text-base font-semibold uppercase tracking-widest">Red de Estaciones</p>
          <p className="text-slate-400 mt-4 text-base">Inteligencia central para la red de estaciones de servicio</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full bg-white hover:bg-gray-50 text-gray-900 font-bold py-5 min-h-[56px] rounded-3xl text-lg
                       transition-all duration-150 active:scale-[0.97]
                       flex items-center justify-center gap-3 group"
            style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.30), 0 2px 4px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.90)' }}
          >
            {isLoading ? (
              <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
            ) : (
              <>
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                <span>Continuar con Google</span>
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          <p className="text-center text-slate-500 text-sm">
            Acceso exclusivo para administradores y operadores registrados.
          </p>
        </div>
      </div>

      <p className="absolute bottom-6 text-slate-600 text-xs text-center w-full z-10">
        &copy; {new Date().getFullYear()} Station-OS
      </p>
    </div>
  );
};

export default AuthScreen;
