// src/components/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { isAIEnabled } from "@/lib/ai-guard";
import { 
  Home, BookOpen, Activity, Sparkles, Settings, Target, 
  TrendingUp, UserCircle, Heart, BrainCircuit, 
  Menu, X, Utensils, Dumbbell, Zap, AlertTriangle,
  Watch // ✅ Ajout de l'icône Watch pour les appareils
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function Sidebar() {
  const pathname = usePathname();
  const [userName, setUserName] = useState("Utilisateur");
  const [initials, setInitials] = useState("U");
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // États pour l'IA et le chargement
  const [aiEnabled, setAiEnabled] = useState(true);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    setMounted(true);
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const name = user.user_metadata?.full_name || "Utilisateur";
        setUserName(name);
        setInitials(name.charAt(0).toUpperCase());
      }
    }
    getUser();
  }, []);

  // Vérification de l'état de l'IA
  useEffect(() => {
    const checkAIStatus = async () => {
      const enabled = await isAIEnabled();
      setAiEnabled(enabled);
      setIsChecking(false);
    };
    
    checkAIStatus();

    window.addEventListener("focus", checkAIStatus);
    window.addEventListener("omnia_ai_status_changed", checkAIStatus);
    
    return () => {
      window.removeEventListener("focus", checkAIStatus);
      window.removeEventListener("omnia_ai_status_changed", checkAIStatus);
    };
  }, []);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => { document.body.style.overflow = "unset"; };
  }, [isOpen]);

  const menuItems = [
    { name: "Dashboard", href: "/", icon: Home },
    { name: "Journal", href: "/journal", icon: BookOpen },
    { name: "Performance", href: "/football", icon: Zap },
    { name: "Entraînement", href: "/training", icon: Dumbbell },
    { name: "Nutrition", href: "/nutrition", icon: Utensils },
    { name: "Tendances", href: "/trends", icon: TrendingUp },
    { name: "Objectifs", href: "/goals", icon: Target },
    { name: "Santé", href: "/health", icon: Heart },
    { name: "Jumeau", href: "/twin", icon: UserCircle },
    { name: "OMNIA IA", href: "/omnia", icon: BrainCircuit },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-[#050505]">
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${aiEnabled ? 'bg-gradient-to-br from-strain to-blue-600' : 'bg-surface border border-border'}`}>
              <Activity size={16} className={aiEnabled ? "text-white" : "text-text-muted"} />
            </div>
            <div>
              <h1 className={`text-xl font-bold tracking-widest ${aiEnabled ? 'text-white' : 'text-text-muted'}`}>OMNIA</h1>
              <p className="text-[9px] text-text-muted tracking-wider uppercase">Personal Intelligence</p>
            </div>
          </div>
          <button className="md:hidden text-white" onClick={() => setIsOpen(false)}>
            <X size={24} />
          </button>
        </div>

        <nav className="px-3 mt-4 space-y-1">
          {menuItems.map((item) => {
            const isActive = mounted && pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                  isActive 
                    ? "bg-strain/10 text-strain font-medium border border-strain/20" 
                    : "text-text-muted hover:bg-surface hover:text-white"
                }`}
              >
                <item.icon size={18} className={isActive ? "text-strain" : ""} />
                <span className="text-sm">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-4 mt-8 border-t border-border/50">
        {/* BLOC ETAT DU SYSTEME DYNAMIQUE */}
        <div className={`border rounded-xl p-4 mb-4 transition-colors duration-300 ${
          isChecking ? 'bg-surface border-border' : 
          aiEnabled ? 'bg-surface border-border' : 
          'bg-alert/5 border-alert/20'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-2 h-2 rounded-full ${
              isChecking ? 'bg-text-muted animate-pulse' : 
              aiEnabled ? 'bg-recovery animate-pulse' : 
              'bg-alert'
            }`} />
            <p className={`text-xs font-semibold ${
              isChecking ? 'text-text-muted' : 
              aiEnabled ? 'text-white' : 
              'text-alert'
            }`}>
              État du système
            </p>
          </div>
          <p className={`text-[10px] flex items-center gap-1.5 ${
            isChecking ? 'text-text-muted' : 
            aiEnabled ? 'text-recovery' : 
            'text-alert font-medium'
          }`}>
            {isChecking ? (
              "Vérification en cours..."
            ) : aiEnabled ? (
              "Données synchronisées ✓"
            ) : (
              <>
                <AlertTriangle size={10} /> Mode hors ligne (IA)
              </>
            )}
          </p>
        </div>

        <Link href="/profile" className="flex items-center gap-3 px-2 py-2 cursor-pointer hover:bg-surface rounded-xl transition-all">
          <div className="w-10 h-10 rounded-full bg-surface-hover border border-border flex items-center justify-center text-sm font-bold text-white">
            {initials}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-white">{userName}</p>
            <p className="text-[10px] text-text-muted">Mon profil</p>
          </div>
        </Link>
        
        <Link href="/settings" className={`flex items-center gap-3 px-3 py-2 mt-2 rounded-lg transition-all ${
          mounted && pathname === "/settings" ? "bg-surface text-white font-medium" : "text-text-muted hover:bg-surface hover:text-white"
        }`}>
          <Settings size={18} />
          <span className="text-sm">Paramètres</span>
        </Link>
      </div>
    </div>
  );

  return (
    <>
      <div className="md:hidden fixed top-safe left-4 z-40 mt-4">
        <button 
          onClick={() => setIsOpen(true)}
          className="w-10 h-10 bg-surface border border-border rounded-xl flex items-center justify-center text-white shadow-lg backdrop-blur-md"
        >
          <Menu size={20} />
        </button>
      </div>

      <aside className="hidden md:flex w-64 h-screen border-r border-border bg-[#050505] flex-col justify-between fixed left-0 top-0 z-30">
        <SidebarContent />
      </aside>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
            />
            <motion.aside 
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", bounce: 0, duration: 0.3 }}
              className="fixed top-0 left-0 w-72 h-full z-50 md:hidden shadow-2xl"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}