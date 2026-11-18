// src/app/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { 
  Activity, Eye, EyeOff, ArrowRight, ShieldCheck, 
  Mail, ArrowLeft, CheckCircle2, Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // États pour le mot de passe oublié
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false); // ✅ On arrête le chargement en cas d'erreur
    } else {
      setLoading(false); // ✅ On arrête le chargement avant de rediriger
      
      // ✅ Utilisation de window.location pour forcer un rechargement complet.
      // Cela évite les bugs de cache de Next.js et s'assure que le middleware
      // lit bien le nouveau cookie de session Supabase.
      window.location.href = "/"; 
    }
  };

  // ✅ Nouvelle fonction pour la connexion avec Google
 const handleGoogleLogin = async () => {
  setLoading(true);
  setError(null);

  // On utilise une variable d'environnement pour plus de robustesse
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      // On construit l'URL de redirection de manière fiable
      redirectTo: `${baseUrl}/auth/callback`,
    },
  });

  if (error) {
    setError(error.message);
    setLoading(false);
  }
};

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    setResetError(null);

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: window.location.origin + '/update-password', 
    });

    if (error) {
      setResetError(error.message);
    } else {
      setResetSuccess(true);
    }
    setResetLoading(false);
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#020202] p-4 md:p-6 relative overflow-hidden">
      
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-strain/10 blur-[100px] md:blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-recovery/10 blur-[100px] md:blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none mix-blend-overlay"></div>

      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }} 
        animate={{ opacity: 1, y: 0, scale: 1 }} 
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-[400px] bg-surface/80 md:bg-surface/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-10 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative z-10"
      >
        
        <div className="flex flex-col items-center mb-6 md:mb-10">
          <motion.div 
            initial={{ rotate: -10 }} animate={{ rotate: 0 }} transition={{ type: "spring", stiffness: 200 }}
            className="w-12 h-12 md:w-14 md:h-14 bg-white rounded-2xl flex items-center justify-center mb-4 md:mb-6 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
          >
            <Activity className="text-black" size={24} />
          </motion.div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-widest text-white mb-1 md:mb-2">OMNIA</h1>
          <p className="text-[10px] md:text-xs text-text-muted font-medium tracking-[0.2em] uppercase">
            {isForgotPassword ? "Réinitialiser" : "Understand yourself"}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {isForgotPassword ? (
            <motion.div 
              key="forgot"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            >
              {resetSuccess ? (
                <div className="text-center space-y-4 py-4">
                  <div className="w-16 h-16 bg-recovery/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 size={32} className="text-recovery" />
                  </div>
                  <h2 className="text-lg font-bold text-white">E-mail envoyé !</h2>
                  <p className="text-xs text-text-muted">
                    Si un compte est associé à cette adresse, vous recevrez un lien de réinitialisation.
                  </p>
                  <button 
                    onClick={() => { setIsForgotPassword(false); setResetSuccess(false); setResetEmail(""); }} 
                    className="w-full mt-4 bg-white text-black font-bold rounded-xl py-3 text-sm hover:bg-gray-100 transition-all"
                  >
                    Retour à la connexion
                  </button>
                </div>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  {resetError && (
                    <div className="p-2.5 bg-alert/10 border border-alert/20 rounded-xl text-alert text-[10px] text-center font-medium">
                      {resetError}
                    </div>
                  )}
                  <p className="text-xs text-text-muted text-center mb-4">
                    Entrez votre adresse e-mail pour recevoir un lien de réinitialisation.
                  </p>
                  
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl pl-12 pr-4 py-3.5 text-base md:text-sm text-white placeholder:text-text-muted/50 focus:outline-none focus:border-strain focus:ring-1 focus:ring-strain transition-all"
                      placeholder="votre@email.com"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={resetLoading || !resetEmail}
                    className="group w-full bg-white text-black font-bold text-sm rounded-xl py-3.5 hover:bg-gray-100 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {resetLoading ? <Loader2 size={16} className="animate-spin" /> : "Envoyer le lien"}
                  </button>

                  <button 
                    type="button"
                    onClick={() => setIsForgotPassword(false)}
                    className="w-full flex items-center justify-center gap-2 text-xs text-text-muted hover:text-white transition-colors mt-2"
                  >
                    <ArrowLeft size={14} /> Retour
                  </button>
                </form>
              )}
            </motion.div>
          ) : (
            <motion.form 
              key="login"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onSubmit={handleLogin} className="space-y-4 md:space-y-5"
            >
              {error && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="p-2.5 md:p-3 bg-alert/10 border border-alert/20 rounded-xl text-alert text-[10px] md:text-xs text-center font-medium">
                  {error}
                </motion.div>
              )}
              
              <div>
                <label className="block text-[9px] md:text-[10px] font-semibold text-text-muted tracking-widest uppercase mb-1.5 md:mb-2 ml-1">Adresse E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 md:py-4 text-base md:text-sm text-white placeholder:text-text-muted/50 focus:outline-none focus:border-strain focus:ring-1 focus:ring-strain transition-all"
                  placeholder="votre@email.com"
                  autoComplete="email"
                  required
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5 md:mb-2 ml-1">
                  <label className="block text-[9px] md:text-[10px] font-semibold text-text-muted tracking-widest uppercase">Mot de passe</label>
                  <button 
                    type="button" 
                    onClick={() => setIsForgotPassword(true)} 
                    className="text-[9px] md:text-[10px] text-strain hover:text-white transition-colors"
                  >
                    Oublié ?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 md:py-4 text-base md:text-sm text-white placeholder:text-text-muted/50 focus:outline-none focus:border-strain focus:ring-1 focus:ring-strain transition-all pr-12"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-white transition-colors p-1"
                  >
                    {showPassword ? <EyeOff size={16} className="md:w-[18px] md:h-[18px]" /> : <Eye size={16} className="md:w-[18px] md:h-[18px]" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group w-full bg-white text-black font-bold text-sm md:text-base rounded-xl py-3.5 md:py-4 mt-4 md:mt-6 hover:bg-gray-100 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? "Connexion..." : (
                  <>
                    Se connecter
                    <ArrowRight size={16} className="md:w-[18px] md:h-[18px] group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>

              {/* ✅ Ajout du séparateur et du bouton Google */}
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-white/10"></div>
                <span className="flex-shrink mx-4 text-text-muted text-[10px] uppercase tracking-widest">Ou</span>
                <div className="flex-grow border-t border-white/10"></div>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full bg-transparent border border-white/10 text-white font-semibold text-sm rounded-xl py-3.5 hover:bg-white/5 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continuer avec Google
              </button>
              {/* ✅ Fin de l'ajout */}

            </motion.form>
          )}
        </AnimatePresence>

        {!isForgotPassword && (
          <div className="mt-6 md:mt-8 pt-4 md:pt-6 border-t border-white/10 flex flex-col items-center gap-3 md:gap-4">
            <p className="text-center text-[11px] md:text-xs text-text-muted">
              Pas encore de compte ?{" "}
              <Link href="/signup" className="text-white font-semibold hover:text-strain transition-colors">
                Créer un compte
              </Link>
            </p>
            <div className="flex items-center gap-1 text-[9px] md:text-[10px] text-text-muted/50">
              <ShieldCheck size={10} className="md:w-3 md:h-3" />
              <span>Connexion sécurisée</span>
            </div>
            
            {/* ✅ Liens Légaux */}
            <div className="flex items-center gap-2 text-[9px] md:text-[10px] text-text-muted/50 mt-1">
              <Link href="/terms" target="_blank" className="hover:text-white transition-colors">CGU</Link>
              <span>•</span>
              <Link href="/privacy" target="_blank" className="hover:text-white transition-colors">Confidentialité</Link>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}