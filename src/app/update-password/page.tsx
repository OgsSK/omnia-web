// src/app/update-password/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  Activity, Eye, EyeOff, CheckCircle2, Loader2, ShieldCheck,
  Check, X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // ✅ Règles de sécurité du mot de passe
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  // Calcul du score (0 à 100)
  const score = Object.values(checks).filter(Boolean).length * 20;
  
  // Définition de la couleur et du texte selon le score
  const getStrengthConfig = () => {
    if (password.length === 0) return { color: "bg-border", text: "", textColor: "text-text-muted", width: "w-0" };
    if (score <= 40) return { color: "bg-alert", text: "Faible", textColor: "text-alert", width: "w-1/4" };
    if (score <= 60) return { color: "bg-warning", text: "Moyen", textColor: "text-warning", width: "w-2/4" };
    if (score <= 80) return { color: "bg-strain", text: "Fort", textColor: "text-strain", width: "w-3/4" };
    return { color: "bg-recovery", text: "Très fort", textColor: "text-recovery", width: "w-full" };
  };

  const strength = getStrengthConfig();

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsReady(true);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setIsReady(true);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Vérification des champs
    if (password !== confirmPassword) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    if (score < 60) {
      setError("Votre mot de passe est trop faible. Suivez les indications ci-dessous.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      // ✅ Traduction des erreurs Supabase courantes
      let errorMsg = error.message;
      if (errorMsg.includes("New password should be different from the old password")) {
        errorMsg = "Le nouveau mot de passe doit être différent de l'ancien.";
      } else if (errorMsg.includes("Password should be at least 6 characters")) {
        errorMsg = "Le mot de passe doit contenir au moins 6 caractères.";
      }
      
      setError(errorMsg);
      setLoading(false);
    } else {
      setSuccess(true);
      await supabase.auth.signOut();
      setTimeout(() => router.push("/login"), 3000);
    }
  };

  if (!isReady) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#020202] text-white">
        <Loader2 className="animate-spin text-strain" size={32} />
      </div>
    );
  }

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
        <div className="flex flex-col items-center mb-6 md:mb-8">
          <motion.div 
            initial={{ rotate: -10 }} animate={{ rotate: 0 }} transition={{ type: "spring", stiffness: 200 }}
            className="w-12 h-12 md:w-14 md:h-14 bg-white rounded-2xl flex items-center justify-center mb-4 md:mb-6 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
          >
            <Activity className="text-black" size={24} />
          </motion.div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-widest text-white mb-1 md:mb-2">OMNIA</h1>
          <p className="text-[10px] md:text-xs text-text-muted font-medium tracking-[0.2em] uppercase">
            Nouveau mot de passe
          </p>
        </div>

        <AnimatePresence mode="wait">
          {success ? (
            <motion.div 
              key="success"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-4 py-4"
            >
              <div className="w-16 h-16 bg-recovery/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} className="text-recovery" />
              </div>
              <h2 className="text-lg font-bold text-white">Mot de passe mis à jour !</h2>
              <p className="text-xs text-text-muted">Redirection vers la page de connexion dans quelques secondes...</p>
            </motion.div>
          ) : (
            <motion.form 
              key="form"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              onSubmit={handleUpdatePassword} className="space-y-4 md:space-y-5"
            >
              {error && (
                <div className="p-2.5 md:p-3 bg-alert/10 border border-alert/20 rounded-xl text-alert text-[10px] md:text-xs text-center font-medium">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-[9px] md:text-[10px] font-semibold text-text-muted tracking-widest uppercase mb-1.5 md:mb-2 ml-1">Nouveau mot de passe</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 md:py-4 text-base md:text-sm text-white placeholder:text-text-muted/50 focus:outline-none focus:border-strain focus:ring-1 focus:ring-strain transition-all pr-12"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-white transition-colors p-1"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* ✅ INDICATEUR DE FORCE DU MOT DE PASSE */}
                <div className="mt-3">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[10px] text-text-muted font-medium">Sécurité du mot de passe</span>
                    <span className={`text-[10px] font-bold ${strength.textColor}`}>{strength.text}</span>
                  </div>
                  {/* Barre de progression */}
                  <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden border border-white/5">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: strength.width === 'w-0' ? '0%' : strength.width === 'w-1/4' ? '25%' : strength.width === 'w-2/4' ? '50%' : strength.width === 'w-3/4' ? '75%' : '100%' }}
                      transition={{ duration: 0.3 }}
                      className={`h-full ${strength.color} transition-colors`} 
                    />
                  </div>

                  {/* Checklist des critères */}
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-3">
                    {[
                      { label: "8 caractères min.", valid: checks.length },
                      { label: "Une majuscule", valid: checks.uppercase },
                      { label: "Une minuscule", valid: checks.lowercase },
                      { label: "Un chiffre", valid: checks.number },
                      { label: "Un caractère spécial", valid: checks.special },
                    ].map((check, i) => (
                      <div key={i} className={`flex items-center gap-1.5 text-[9px] md:text-[10px] ${check.valid ? 'text-recovery' : 'text-text-muted'}`}>
                        {check.valid ? <Check size={10} /> : <X size={10} />}
                        <span>{check.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[9px] md:text-[10px] font-semibold text-text-muted tracking-widest uppercase mb-1.5 md:mb-2 ml-1">Confirmer le mot de passe</label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 md:py-4 text-base md:text-sm text-white placeholder:text-text-muted/50 focus:outline-none focus:border-strain focus:ring-1 focus:ring-strain transition-all"
                  placeholder="••••••••"
                  required
                />
                {/* Indicateur visuel si les mots de passe ne correspondent pas */}
                {confirmPassword.length > 0 && password !== confirmPassword && (
                  <p className="text-[10px] text-alert mt-1.5 ml-1">Les mots de passe ne correspondent pas.</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || score < 60 || password !== confirmPassword}
                className="w-full bg-white text-black font-bold text-sm md:text-base rounded-xl py-3.5 md:py-4 mt-4 hover:bg-gray-100 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : "Mettre à jour le mot de passe"}
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        <div className="mt-6 md:mt-8 pt-4 md:pt-6 border-t border-white/10 flex justify-center">
          <div className="flex items-center gap-1 text-[9px] md:text-[10px] text-text-muted/50">
            <ShieldCheck size={10} />
            <span>Connexion sécurisée</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}