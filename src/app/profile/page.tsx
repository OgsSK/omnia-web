// src/app/profile/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  LogOut, Mail, Shield, Target, Activity, Flame, 
  BookOpen, Award, Settings, Ruler, Scale
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<{ email: string; name: string; meta: any }>({
    email: "",
    name: "Utilisateur",
    meta: {},
  });
  
  // Stats
  const [stats, setStats] = useState({ 
    sprints: 0, 
    checkins: 0, 
    goals: 0, 
    journal: 0 
  });

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserData({
          email: user.email || "",
          name: user.user_metadata?.full_name || "Utilisateur",
          meta: user.user_metadata || {},
        });

        // Récupérer toutes les stats
        const [sprintsRes, checkinsRes, goalsRes, journalRes] = await Promise.all([
          supabase.from("measurements").select("*", { count: 'exact', head: true }).eq("user_id", user.id),
          supabase.from("daily_metrics").select("*", { count: 'exact', head: true }).eq("user_id", user.id),
          supabase.from("goals").select("*", { count: 'exact', head: true }).eq("user_id", user.id),
          supabase.from("journal_entries").select("*", { count: 'exact', head: true }).eq("user_id", user.id),
        ]);

        setStats({
          sprints: sprintsRes.count || 0,
          checkins: checkinsRes.count || 0,
          goals: goalsRes.count || 0,
          journal: journalRes.count || 0,
        });
      } else {
        router.push("/login");
      }
      setLoading(false);
    }
    getUser();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) return <div className="p-8 text-white min-h-screen bg-[#020202]">Chargement...</div>;

  const initials = userData.name.substring(0, 2).toUpperCase();

  // Formatage de l'objectif pour l'affichage
  const getWeightGoalLabel = (goal: string) => {
    if (goal === "lose") return "Perte de poids";
    if (goal === "gain") return "Prise de masse";
    return "Maintien";
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto bg-[#020202] min-h-screen space-y-4 md:space-y-6">
      
      <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-3 md:gap-0 mb-4 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white mb-1">Mon Profil</h1>
          <p className="text-xs md:text-sm text-text-muted">Votre identité et votre empreinte OMNIA.</p>
        </div>
        <Link href="/settings" className="w-full md:w-auto justify-center flex items-center gap-2 bg-surface border border-border rounded-xl px-4 py-2 text-xs md:text-sm text-white hover:bg-surface-hover transition-colors">
          <Settings size={14} className="md:w-4 md:h-4" /> Modifier le profil
        </Link>
      </header>

      {/* CARTE D'IDENTITÉ (Hero) */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="bg-surface border border-border rounded-3xl overflow-hidden relative"
      >
        {/* Bannière de fond avec dégradé */}
        <div className="h-28 md:h-40 w-full bg-gradient-to-r from-strain/20 via-surface to-purple-500/20 relative">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
        </div>

        <div className="px-4 md:px-8 pb-6 md:pb-8 relative">
          <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-start md:items-end -mt-10 md:-mt-12 mb-4 md:mb-6">
            {/* Avatar */}
            <div className="w-20 h-20 md:w-28 md:h-28 rounded-2xl md:rounded-3xl bg-background border-4 border-surface flex items-center justify-center text-2xl md:text-4xl font-bold text-white shadow-xl relative z-10">
              {initials}
            </div>
            
            {/* Infos principales */}
            <div className="flex-1 pb-0 md:pb-2">
              <h2 className="text-xl md:text-3xl font-bold text-white">{userData.name}</h2>
              <div className="flex items-center gap-4 text-text-muted mt-1 md:mt-2 text-xs md:text-sm">
                <span className="flex items-center gap-1.5"><Mail size={12} className="md:w-3.5 md:h-3.5" /> {userData.email}</span>
              </div>
            </div>

            {/* Badge Statut */}
            <div className="bg-recovery/10 border border-recovery/20 px-3 md:px-4 py-1.5 md:py-2 rounded-xl flex items-center gap-2 w-full md:w-auto">
              <Shield size={14} className="text-recovery md:w-4 md:h-4" />
              <div>
                <p className="text-[10px] md:text-xs font-bold text-white uppercase tracking-widest">Membre Actif</p>
                <p className="text-[9px] md:text-[10px] text-recovery">Données synchronisées</p>
              </div>
            </div>
          </div>

          {/* Infos Physiques (Metadata) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 pt-4 md:pt-6 border-t border-border/50">
            <div>
              <p className="text-[9px] md:text-[10px] font-semibold text-text-muted tracking-widest uppercase mb-1 flex items-center gap-1">
                <Ruler size={10} className="md:w-3 md:h-3" /> Taille
              </p>
              <p className="text-xs md:text-sm font-medium text-white">
                {userData.meta.height ? `${userData.meta.height} cm` : "Non définie"}
              </p>
            </div>
            <div>
              <p className="text-[9px] md:text-[10px] font-semibold text-text-muted tracking-widest uppercase mb-1 flex items-center gap-1">
                <Scale size={10} className="md:w-3 md:h-3" /> Poids cible
              </p>
              <p className="text-xs md:text-sm font-medium text-white">
                {userData.meta.target_weight ? `${userData.meta.target_weight} kg` : "Non défini"}
              </p>
            </div>
            <div>
              <p className="text-[9px] md:text-[10px] font-semibold text-text-muted tracking-widest uppercase mb-1 flex items-center gap-1">
                <Target size={10} className="md:w-3 md:h-3" /> Objectif
              </p>
              <p className="text-xs md:text-sm font-medium text-white">
                {getWeightGoalLabel(userData.meta.weight_goal)}
              </p>
            </div>
            <div>
              <p className="text-[9px] md:text-[10px] font-semibold text-text-muted tracking-widest uppercase mb-1">Date de naissance</p>
              <p className="text-xs md:text-sm font-medium text-white">
                {userData.meta.birth_date ? new Date(userData.meta.birth_date).toLocaleDateString("fr-FR") : "Non définie"}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* EMPREINTE OMNIA (Statistiques) */}
      <div>
        <h3 className="text-[10px] md:text-sm font-semibold tracking-widest text-text-muted uppercase mb-3 md:mb-4 flex items-center gap-2">
          <Award size={14} className="md:w-4 md:h-4" /> Votre Empreinte OMNIA
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="bg-surface border border-border rounded-2xl p-3 md:p-5 hover:border-strain/50 transition-colors group">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-strain/10 flex items-center justify-center mb-2 md:mb-4 group-hover:scale-110 transition-transform">
              <Activity size={14} className="text-strain md:w-5 md:h-5" />
            </div>
            <p className="text-xl md:text-3xl font-bold text-white">{stats.sprints}</p>
            <p className="text-[9px] md:text-xs text-text-muted mt-1">Tests physiques</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="bg-surface border border-border rounded-2xl p-3 md:p-5 hover:border-warning/50 transition-colors group">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-warning/10 flex items-center justify-center mb-2 md:mb-4 group-hover:scale-110 transition-transform">
              <Flame size={14} className="text-warning md:w-5 md:h-5" />
            </div>
            <p className="text-xl md:text-3xl font-bold text-white">{stats.checkins}</p>
            <p className="text-[9px] md:text-xs text-text-muted mt-1">Check-ins</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }} className="bg-surface border border-border rounded-2xl p-3 md:p-5 hover:border-recovery/50 transition-colors group">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-recovery/10 flex items-center justify-center mb-2 md:mb-4 group-hover:scale-110 transition-transform">
              <Target size={14} className="text-recovery md:w-5 md:h-5" />
            </div>
            <p className="text-xl md:text-3xl font-bold text-white">{stats.goals}</p>
            <p className="text-[9px] md:text-xs text-text-muted mt-1">Objectifs fixés</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }} className="bg-surface border border-border rounded-2xl p-3 md:p-5 hover:border-sleep/50 transition-colors group">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-sleep/10 flex items-center justify-center mb-2 md:mb-4 group-hover:scale-110 transition-transform">
              <BookOpen size={14} className="text-sleep md:w-5 md:h-5" />
            </div>
            <p className="text-xl md:text-3xl font-bold text-white">{stats.journal}</p>
            <p className="text-[9px] md:text-xs text-text-muted mt-1">Notes de journal</p>
          </motion.div>
        </div>
      </div>

      {/* DÉCONNEXION */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="bg-surface border border-border rounded-3xl p-4 md:p-6 mt-6 md:mt-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-center md:text-left">
            <h3 className="text-xs md:text-sm font-semibold text-white">Gérer votre session</h3>
            <p className="text-[10px] md:text-xs text-text-muted mt-1">Vous pouvez vous déconnecter en toute sécurité. Vos données resteront sauvegardées dans le cloud.</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full md:w-auto justify-center flex items-center gap-2 bg-alert/10 text-alert border border-alert/20 hover:bg-alert/20 transition-colors rounded-xl px-4 md:px-6 py-2.5 md:py-3 text-xs md:text-sm font-semibold whitespace-nowrap"
          >
            <LogOut size={14} className="md:w-[18px] md:h-[18px]" />
            Se déconnecter
          </button>
        </div>
      </motion.div>

    </div>
  );
}