// src/app/signup/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { 
  Activity, Eye, EyeOff, Check, ArrowRight, ShieldCheck, 
  RefreshCw, CheckCircle2 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // ✅ États pour le renvoi d'e-mail
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  // Consentements RGPD
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [acceptHealth, setAcceptHealth] = useState(false);
  const [acceptAI, setAcceptAI] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!acceptTerms || !acceptPrivacy) {
      setError("Veuillez accepter les conditions d'utilisation et la politique de confidentialité.");
      return;
    }

    setLoading(true);

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin + '/login', // ✅ Redirection après clic sur le mail
      }
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (authData.user) {
      const consents = [
        { user_id: authData.user.id, consent_type: "terms", granted: acceptTerms },
        { user_id: authData.user.id, consent_type: "privacy", granted: acceptPrivacy },
        { user_id: authData.user.id, consent_type: "health_data", granted: acceptHealth },
        { user_id: authData.user.id, consent_type: "ai_analysis", granted: acceptAI },
      ];
      await supabase.from("user_consents").insert(consents);
    }

    setSuccess(true);
    setLoading(false);
  };

  // ✅ Fonction pour renvoyer l'e-mail
  const handleResendEmail = async () => {
    setResendLoading(true);
    setResendSuccess(false);

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
      options: {
        emailRedirectTo: window.location.origin + '/login',
      }
    });

    if (!error) {
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 5000);
    }
    setResendLoading(false);
  };

  const CustomCheckbox = ({ checked, onChange, label }: { checked: boolean, onChange: () => void, label: React.ReactNode }) => (
    <button 
      type="button" 
      onClick={onChange} 
      className="flex items-start gap-3 text-left w-full group py-1"
    >
      <div className={`shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-all mt-0.5 ${checked ? 'bg-strain border-strain text-white' : 'bg-black/40 border-white/20 text-transparent group-hover:border-white/40'}`}>
        <Check size={14} strokeWidth={3} />
      </div>
      <span className={`text-[11px] md:text-xs leading-relaxed transition-colors ${checked ? 'text-white' : 'text-text-muted group-hover:text-gray-300'}`}>
        {label}
      </span>
    </button>
  );

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#020202] p-4 py-8 relative overflow-hidden">
      
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500/10 blur-[100px] md:blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-strain/10 blur-[100px] md:blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none mix-blend-overlay"></div>

      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }} 
        animate={{ opacity: 1, y: 0, scale: 1 }} 
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-lg bg-surface/80 md:bg-surface/60 backdrop-blur-xl border border-white/10 rounded-3xl p-5 md:p-10 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative z-10"
      >
        
        <div className="flex flex-col items-center mb-6 md:mb-8">
          <motion.div 
            initial={{ rotate: 10 }} animate={{ rotate: 0 }} transition={{ type: "spring", stiffness: 200 }}
            className="w-12 h-12 md:w-14 md:h-14 bg-white rounded-2xl flex items-center justify-center mb-4 md:mb-5 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
          >
            <Activity className="text-black" size={24} />
          </motion.div>
          <h1 className="text-xl md:text-2xl font-bold tracking-widest text-white mb-1">OMNIA</h1>
          <p className="text-[10px] md:text-xs text-text-muted font-medium tracking-[0.2em] uppercase">Créer votre compte</p>
        </div>

        <AnimatePresence mode="wait">
          {success ? (
            <motion.div 
              key="success"
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-4 md:space-y-5 py-4 md:py-6"
            >
              <div className="w-16 h-16 md:w-20 md:h-20 bg-recovery/10 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6 shadow-[0_0_30px_rgba(0,230,118,0.2)]">
                <ShieldCheck size={32} className="text-recovery md:w-10 md:h-10" />
              </div>
              <h2 className="text-lg md:text-xl font-bold text-white">Compte créé !</h2>
              <p className="text-xs md:text-sm text-text-muted px-4">
                Un e-mail de confirmation a été envoyé à <strong className="text-white">{email}</strong>. 
                Cliquez sur le lien pour activer votre compte.
              </p>

              {/* ✅ Bouton Renvoyer l'e-mail */}
              <div className="pt-4 border-t border-white/10 mt-4 flex flex-col items-center gap-3">
                <p className="text-[10px] text-text-muted">Vous n'avez rien reçu ?</p>
                <button
                  onClick={handleResendEmail}
                  disabled={resendLoading}
                  className="flex items-center gap-2 text-xs font-semibold text-strain bg-strain/10 px-4 py-2 rounded-lg hover:bg-strain/20 transition-colors disabled:opacity-50"
                >
                  {resendLoading ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  Renvoyer l'e-mail
                </button>
                {resendSuccess && (
                  <span className="text-[10px] text-recovery flex items-center gap-1">
                    <CheckCircle2 size={12} /> E-mail renvoyé !
                  </span>
                )}
              </div>

              <div className="pt-6">
                <Link href="/login" className="w-full block bg-white text-black font-bold rounded-xl py-3 text-sm hover:bg-gray-100 transition-all">
                  Aller à la connexion
                </Link>
              </div>
            </motion.div>
          ) : (
            <motion.form 
              key="form"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              onSubmit={handleSignUp} className="space-y-4 md:space-y-5"
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
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 md:py-3.5 text-base md:text-sm text-white placeholder:text-text-muted/50 focus:outline-none focus:border-strain focus:ring-1 focus:ring-strain transition-all"
                  placeholder="votre@email.com"
                  required
                />
              </div>

              <div>
                <label className="block text-[9px] md:text-[10px] font-semibold text-text-muted tracking-widest uppercase mb-1.5 md:mb-2 ml-1">Mot de passe</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 md:py-3.5 text-base md:text-sm text-white placeholder:text-text-muted/50 focus:outline-none focus:border-strain focus:ring-1 focus:ring-strain transition-all pr-12"
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 md:right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-white transition-colors p-1"
                  >
                    {showPassword ? <EyeOff size={16} className="md:w-[18px] md:h-[18px]" /> : <Eye size={16} className="md:w-[18px] md:h-[18px]" />}
                  </button>
                </div>
              </div>

              <div className="pt-3 md:pt-4 border-t border-white/10 space-y-2 md:space-y-3">
                <p className="text-[9px] md:text-[10px] font-semibold text-text-muted tracking-widest uppercase mb-2 md:mb-3">Autorisations</p>
                
                <CustomCheckbox 
                  checked={acceptTerms} 
                  onChange={() => setAcceptTerms(!acceptTerms)} 
                  label={
                    <>
                      J'accepte les{" "}
                      <Link href="/terms" target="_blank" rel="noopener noreferrer" className="text-strain hover:underline font-medium">
                        Conditions
                      </Link>{" "}
                      et la{" "}
                      <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="text-strain hover:underline font-medium">
                        Politique de confidentialité
                      </Link>
                      .
                    </>
                  } 
                />
                
                <CustomCheckbox 
                  checked={acceptPrivacy} 
                  onChange={() => setAcceptPrivacy(!acceptPrivacy)} 
                  label={<>J'accepte que mes données soient stockées de manière sécurisée dans l'UE.</>} 
                />
                
                <CustomCheckbox 
                  checked={acceptHealth} 
                  onChange={() => setAcceptHealth(!acceptHealth)} 
                  label={<>J'accepte le suivi de mes données de santé.</>} 
                />
                
                <CustomCheckbox 
                  checked={acceptAI} 
                  onChange={() => setAcceptAI(!acceptAI)} 
                  label={<>J'accepte que mes données anonymisées soient analysées par l'IA.</>} 
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group w-full bg-white text-black font-bold text-sm md:text-base rounded-xl py-3 md:py-4 mt-2 md:mt-4 hover:bg-gray-100 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? "Création en cours..." : (
                  <>
                    Créer mon compte
                    <ArrowRight size={16} className="md:w-[18px] md:h-[18px] group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        {!success && (
          <div className="mt-6 md:mt-8 pt-4 md:pt-6 border-t border-white/10 flex flex-col items-center gap-3 md:gap-4">
            <p className="text-center text-[11px] md:text-xs text-text-muted">
              Déjà un compte ?{" "}
              <Link href="/login" className="text-white font-semibold hover:text-strain transition-colors">
                Se connecter
              </Link>
            </p>
            <div className="flex items-center gap-1 text-[9px] md:text-[10px] text-text-muted/50">
              <ShieldCheck size={10} className="md:w-3 md:h-3" />
              <span>Inscription sécurisée & conforme RGPD</span>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}