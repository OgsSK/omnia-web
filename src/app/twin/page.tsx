// src/app/twin/page.tsx
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer 
} from "recharts";
import { 
  UserCircle, Sparkles, TrendingUp, Activity, Brain, 
  Target, Zap, BookOpen, HeartPulse, Calendar, Award, Loader2,
  History, ChevronDown, ChevronUp, Clock, AlertTriangle,
  Trash2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";

type TwinScores = {
  physique: number;
  recuperation: number;
  mental: number;
  regularite: number;
  nutrition: number;
  objectifs: number;
};

type PlanHistory = {
  id: string;
  plan: string;
  created_at: string;
};

export default function TwinPage() {
  const [loading, setLoading] = useState(true);
  const [scores, setScores] = useState<TwinScores>({
    physique: 0, recuperation: 0, mental: 0, regularite: 0, nutrition: 0, objectifs: 0
  });

  const [actionPlans, setActionPlans] = useState<PlanHistory[]>([]);
  const [selectedPlanIndex, setSelectedPlanIndex] = useState(0);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [errorPlan, setErrorPlan] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const getLabel = (key: string) => {
    const labels: Record<string, string> = {
      physique: "Physique", recuperation: "Récupération", mental: "Mental",
      regularite: "Régularité", nutrition: "Nutrition", objectifs: "Objectifs"
    };
    return labels[key] || key;
  };

  useEffect(() => {
    async function fetchTwinData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const [measurements, checkins, journal, goals, health, nutrition] = await Promise.all([
          supabase.from("measurements").select("id").eq("user_id", user.id),
          supabase.from("daily_metrics").select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(30),
          supabase.from("journal_entries").select("id").eq("user_id", user.id),
          supabase.from("goals").select("id").eq("user_id", user.id),
          supabase.from("health_metrics").select("stress_level").eq("user_id", user.id).order("date", { ascending: false }).limit(1),
          supabase.from("meal_logs").select("id").eq("user_id", user.id)
        ]);

        const testCount = measurements.data?.length || 0;
        const checkinCount = checkins.data?.length || 0;
        const journalCount = journal.data?.length || 0;
        const goalCount = goals.data?.length || 0;
        const mealCount = nutrition.data?.length || 0;
        
        let avgRecovery = 0;
        if (checkinCount > 0) {
          avgRecovery = checkins.data!.reduce((acc, curr) => acc + curr.recovery_score, 0) / checkinCount;
        }

        let mentalScore = 30 + (journalCount * 5);
        const currentStress = health.data?.[0]?.stress_level || 3;
        if (currentStress >= 4) mentalScore -= 15;
        else if (currentStress <= 2) mentalScore += 10;

        setScores({
          physique: Math.min(100, 20 + (testCount * 5)), 
          recuperation: Math.min(100, Math.round(avgRecovery)),
          mental: Math.min(100, Math.max(0, mentalScore)),
          regularite: Math.min(100, Math.round((checkinCount / 30) * 100)),
          nutrition: Math.min(100, 10 + (mealCount * 3)),
          objectifs: Math.min(100, 20 + (goalCount * 10))
        });

        // ✅ Récupérer TOUT l'historique des plans
        const { data: plans } = await supabase
          .from("ai_generations")
          .select("id, content, created_at")
          .eq("user_id", user.id)
          .eq("type", "twin")
          .order("created_at", { ascending: false });

        if (plans) {
          const formattedPlans = plans
            .filter(p => p.content?.plan)
            .map(p => ({
              id: p.id,
              plan: p.content.plan,
              created_at: p.created_at
            }));
          setActionPlans(formattedPlans);
        }
      }
      setLoading(false);
    }
    fetchTwinData();
  }, []);

  const generateActionPlan = async () => {
    setLoadingPlan(true);
    setErrorPlan(null);

    const { data: { user } } = await supabase.auth.getUser();
    const sorted = Object.entries(scores).sort((a, b) => a[1] - b[1]);
    const worstPillar = getLabel(sorted[0][0]);

    try {
      const res = await fetch("/api/twin-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scores, worstPillar, userName: "l'athlète" })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Erreur lors de la génération");

      if (data.plan) {
        // ✅ Sauvegarde en BDD
        const { data: newPlan, error } = await supabase
          .from("ai_generations")
          .insert({
            user_id: user?.id,
            type: "twin",
            content: { plan: data.plan }
          })
          .select()
          .single();

        if (error) throw error;

        // ✅ Ajout immédiat à l'historique en mémoire
        if (newPlan) {
          setActionPlans(prev => [
            { id: newPlan.id, plan: data.plan, created_at: newPlan.created_at },
            ...prev
          ]);
          setSelectedPlanIndex(0);
        }
      }
    } catch (e: any) {
      console.error(e);
      setErrorPlan(e.message || "Erreur lors de la création du plan.");
    } finally {
      setLoadingPlan(false);
    }
  };

  // ✅ Suppression d'un plan (gère les 3 cas d'index)
  const deletePlan = async (id: string, index: number) => {
    if (!confirm("Supprimer définitivement ce plan de l'historique ?")) return;

    const { error } = await supabase
      .from("ai_generations")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("❌ [deletePlan] Erreur Supabase:", error);
      alert(`Erreur lors de la suppression : ${error.message}`);
      return;
    }

    // 1. Retire le plan de la liste
    setActionPlans(prev => prev.filter(p => p.id !== id));

    // 2. Ajuste l'index courant
    if (index === selectedPlanIndex) {
      // Le plan affiché vient d'être supprimé → on remonte au plus récent
      setSelectedPlanIndex(0);
    } else if (index < selectedPlanIndex) {
      // On supprime un plan plus ancien → décale pour garder le même plan affiché
      setSelectedPlanIndex(prev => prev - 1);
    }
    // si index > selectedPlanIndex → rien à faire
  };

  const data = [
    { subject: 'Physique', A: scores.physique, fullMark: 100 },
    { subject: 'Récupération', A: scores.recuperation, fullMark: 100 },
    { subject: 'Mental', A: scores.mental, fullMark: 100 },
    { subject: 'Régularité', A: scores.regularite, fullMark: 100 },
    { subject: 'Nutrition', A: scores.nutrition, fullMark: 100 },
    { subject: 'Objectifs', A: scores.objectifs, fullMark: 100 },
  ];

  const globalScore = Math.round((scores.physique + scores.recuperation + scores.mental + scores.regularite + scores.nutrition + scores.objectifs) / 6);
  const sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const bestStat = sortedScores[0];
  const worstStat = sortedScores[sortedScores.length - 1];

  const getIcon = (key: string, size = 18) => {
    const props = { size, className: "text-white" };
    switch (key) {
      case 'physique': return <Activity {...props} />;
      case 'recuperation': return <HeartPulse {...props} />;
      case 'mental': return <Brain {...props} />;
      case 'regularite': return <Calendar {...props} />;
      case 'nutrition': return <BookOpen {...props} />;
      case 'objectifs': return <Target {...props} />;
      default: return <Zap {...props} />;
    }
  };

  if (loading) return <div className="p-8 text-white min-h-screen bg-[#020202] flex items-center justify-center">Initialisation du jumeau...</div>;

  const currentPlan = actionPlans[selectedPlanIndex];

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto bg-[#020202] min-h-screen space-y-4 md:space-y-6">
      
      <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-2 md:gap-0 mb-4 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white mb-1 flex items-center gap-2">
            Jumeau Personnel
            <span className="text-[9px] md:text-[10px] bg-purple-500/20 text-purple-400 px-1.5 md:px-2 py-0.5 rounded uppercase tracking-wider font-semibold">BETA</span>
          </h1>
          <p className="text-[10px] md:text-sm text-text-muted">Votre représentation numérique à 360° basée sur vos données réelles.</p>
        </div>
      </header>

      {/* METRICS (Grille 2 cols sur mobile) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-surface border border-border rounded-2xl p-3 md:p-5 relative overflow-hidden group">
          <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-4">
            <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-strain/10 flex items-center justify-center"><UserCircle size={14} className="text-strain" /></div>
            <span className="text-[10px] md:text-xs font-semibold text-text-muted tracking-widest uppercase truncate">Global</span>
          </div>
          <div className="flex items-baseline gap-1 relative z-10">
            <span className="text-3xl md:text-5xl font-bold text-white">{globalScore}</span>
            <span className="text-[10px] md:text-sm text-text-muted">/100</span>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-surface border border-border rounded-2xl p-3 md:p-5 relative overflow-hidden group">
          <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-4">
            <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-recovery/10 flex items-center justify-center"><TrendingUp size={14} className="text-recovery" /></div>
            <span className="text-[10px] md:text-xs font-semibold text-text-muted tracking-widest uppercase truncate">Point fort</span>
          </div>
          <div className="relative z-10">
            <span className="text-sm md:text-xl font-bold text-white block capitalize truncate">{getLabel(bestStat[0])}</span>
            <span className="text-[10px] md:text-sm text-recovery font-semibold">{bestStat[1]}/100</span>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-surface border border-border rounded-2xl p-3 md:p-5 relative overflow-hidden group">
          <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-4">
            <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-alert/10 flex items-center justify-center"><Activity size={14} className="text-alert" /></div>
            <span className="text-[10px] md:text-xs font-semibold text-text-muted tracking-widest uppercase truncate">À améliorer</span>
          </div>
          <div className="relative z-10">
            <span className="text-sm md:text-xl font-bold text-white block capitalize truncate">{getLabel(worstStat[0])}</span>
            <span className="text-[10px] md:text-sm text-alert font-semibold">{worstStat[1]}/100</span>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-surface border border-border rounded-2xl p-3 md:p-5 relative overflow-hidden group">
          <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-4">
            <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-purple-500/10 flex items-center justify-center"><Sparkles size={14} className="text-purple-500" /></div>
            <span className="text-[10px] md:text-xs font-semibold text-text-muted tracking-widest uppercase truncate">Potentiel</span>
          </div>
          <div className="flex items-baseline gap-1 relative z-10">
            <span className="text-3xl md:text-4xl font-bold text-purple-400">{Math.min(100, globalScore + 15)}</span>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
        
        {/* RADAR (Prend 6 cols sur PC) */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="lg:col-span-6 bg-surface border border-border rounded-3xl p-4 md:p-8 relative overflow-hidden flex flex-col items-center justify-center min-h-[350px] md:min-h-[450px]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-strain/5 via-transparent to-transparent pointer-events-none" />
          <h2 className="text-[10px] md:text-sm font-semibold tracking-widest text-white uppercase mb-4 md:mb-8 relative z-10">Radar de Compétences</h2>
          <div className="w-full h-64 md:h-80 relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="65%" data={data}>
                <PolarGrid stroke="#333333" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#A1A1A6', fontSize: 10, fontWeight: 600 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name="Jumeau" dataKey="A" stroke="#0093E7" strokeWidth={2.5} fill="#0093E7" fillOpacity={0.25} dot={{ r: 3, fill: '#0093E7' }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* DÉTAILS ET PLAN D'ACTION (Prend 6 cols sur PC) */}
        <div className="lg:col-span-6 space-y-4 md:space-y-6">
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="bg-surface border border-border rounded-3xl p-4 md:p-6">
            <h2 className="text-[10px] md:text-sm font-semibold tracking-widest text-text-muted uppercase mb-4 md:mb-6">Détail des attributs</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 md:gap-x-8 gap-y-4 md:gap-y-6">
              {Object.entries(scores).map(([key, value]) => (
                <div key={key}>
                  <div className="flex justify-between items-center text-[10px] md:text-xs mb-1.5 md:mb-2">
                    <span className="flex items-center gap-1.5 md:gap-2 text-white font-medium capitalize">{getIcon(key, 12)} {getLabel(key)}</span>
                    <span className="text-text-muted font-mono font-bold">{value}/100</span>
                  </div>
                  <div className="w-full h-1.5 md:h-2 bg-background rounded-full overflow-hidden border border-border/50">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 1, delay: 0.2 }} className={`h-full rounded-full ${value >= 70 ? 'bg-recovery' : value >= 40 ? 'bg-strain' : 'bg-alert'}`} />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="bg-purple-500/5 border border-purple-500/20 rounded-3xl p-4 md:p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/10 blur-3xl pointer-events-none rounded-full" />
            <div className="flex items-center gap-2 mb-3 md:mb-4 relative z-10">
              <Sparkles size={16} className="text-purple-500 md:w-[18px] md:h-[18px]" />
              <h2 className="text-[10px] md:text-sm font-semibold text-purple-400 uppercase tracking-widest">Analyse & Plan d'action</h2>
            </div>
            <p className="text-xs md:text-sm text-text-main leading-relaxed mb-3 md:mb-4 relative z-10">
              Votre jumeau numérique se précise à chaque nouvelle donnée. 
              {globalScore > 60 ? " Votre profil global est solide et équilibré." : " Votre jumeau a besoin de plus de données pour être précis."}
              <br/><br/>
              <span className="text-purple-300 font-medium">Priorité :</span> Concentrez-vous sur votre <strong className="text-white capitalize">{getLabel(worstStat[0])}</strong> pour équilibrer votre profil.
            </p>

            {errorPlan && (
              <div className="mb-3 bg-alert/10 border border-alert/30 rounded-xl p-3 flex items-start gap-2 relative z-10">
                <AlertTriangle size={14} className="text-alert mt-0.5 shrink-0" />
                <p className="text-[10px] md:text-xs text-alert">{errorPlan}</p>
              </div>
            )}
            
            <button onClick={generateActionPlan} disabled={loadingPlan} className="w-full bg-white text-black font-semibold rounded-xl py-2.5 md:py-3 text-xs md:text-sm hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 relative z-10 disabled:opacity-50">
              {loadingPlan ? <Loader2 size={16} className="animate-spin md:w-[18px] md:h-[18px]" /> : <Award size={16} className="md:w-[18px] md:h-[18px]" />}
              {loadingPlan ? "Création du plan..." : actionPlans.length > 0 ? "Regénérer un nouveau plan" : "Générer mon plan (30 jours)"}
            </button>
          </motion.div>
        </div>
      </div>

      {/* PLAN D'ACTION MARKDOWN ACTUEL */}
      {currentPlan && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-surface border border-border rounded-3xl p-4 md:p-8 relative overflow-hidden mt-4 md:mt-6">
          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 blur-3xl pointer-events-none rounded-full" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 md:mb-6 relative z-10">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                <Target size={16} className="text-purple-500 md:w-5 md:h-5" />
              </div>
              <div>
                <h2 className="text-sm md:text-lg font-semibold text-white">Votre Plan d'Action Personnalisé</h2>
                <p className="text-[10px] md:text-xs text-text-muted flex items-center gap-1 mt-0.5">
                  <Clock size={10} /> Généré le {new Date(currentPlan.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>
            </div>
            
            {/* ✅ Actions : Historique + Supprimer */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              {actionPlans.length > 1 && (
                <button 
                  onClick={() => setShowHistory(!showHistory)}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-semibold px-3 py-2 rounded-lg hover:bg-purple-500/20 transition-colors shrink-0"
                >
                  <History size={14} /> 
                  {showHistory ? "Masquer" : `Historique (${actionPlans.length})`}
                </button>
              )}
              <button
                onClick={() => deletePlan(currentPlan.id, selectedPlanIndex)}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-alert/10 border border-alert/20 text-alert text-xs font-semibold px-3 py-2 rounded-lg hover:bg-alert/20 transition-colors shrink-0"
                title="Supprimer ce plan"
              >
                <Trash2 size={14} />
                <span className="hidden md:inline">Supprimer</span>
              </button>
            </div>
          </div>

          {/* ✅ MENU DÉROULANT DE L'HISTORIQUE */}
          <AnimatePresence>
            {showHistory && actionPlans.length > 1 && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-4 relative z-10">
                <div className="bg-background border border-border rounded-2xl p-2 max-h-48 overflow-y-auto custom-scrollbar flex flex-col gap-1">
                  {actionPlans.map((plan, index) => (
                    <div
                      key={plan.id}
                      className={`flex items-center gap-1 rounded-xl transition-colors ${
                        selectedPlanIndex === index ? "bg-purple-500/20" : "hover:bg-surface-hover"
                      }`}
                    >
                      {/* Zone cliquable : sélection */}
                      <button
                        onClick={() => { setSelectedPlanIndex(index); setShowHistory(false); }}
                        className={`flex-1 text-left px-3 py-2 rounded-xl text-xs md:text-sm ${
                          selectedPlanIndex === index
                            ? "text-purple-300 font-semibold"
                            : "text-text-muted hover:text-white"
                        }`}
                      >
                        <span>Plan du {new Date(plan.created_at).toLocaleDateString("fr-FR")}</span>
                        {selectedPlanIndex === index && (
                          <span className="ml-2 text-[10px] bg-purple-500/30 px-2 py-0.5 rounded uppercase">Actuel</span>
                        )}
                      </button>

                      {/* Bouton supprimer */}
                      <button
                        onClick={(e) => { e.stopPropagation(); deletePlan(plan.id, index); }}
                        className="text-alert hover:bg-alert/10 p-2 rounded-lg mr-1 shrink-0 transition-colors"
                        title="Supprimer ce plan"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative z-10 bg-background/50 p-4 md:p-6 rounded-2xl border border-border/50">
            <ReactMarkdown components={{
                strong: ({node, ...props}) => <span className="font-bold text-white" {...props} />,
                li: ({node, ...props}) => <li className="ml-4 list-disc marker:text-strain mb-1.5 md:mb-2 text-text-main text-xs md:text-sm" {...props} />,
                p: ({node, ...props}) => <p className="mb-3 md:mb-4 text-xs md:text-sm leading-relaxed text-text-main" {...props} />,
              }}>
              {currentPlan.plan}
            </ReactMarkdown>
          </div>
        </motion.div>
      )}
    </div>
  );
}