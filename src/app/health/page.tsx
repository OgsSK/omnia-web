// src/app/health/page.tsx
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Heart, Activity, AlertTriangle, Plus, CheckCircle2, 
  ShieldAlert, Scale, HeartPulse, Stethoscope, 
  Percent, Dumbbell, Zap, Brain, ChevronRight,
  BrainCircuit, TrendingDown, TrendingUp, RefreshCw,
  Calculator, Pencil, Trash2, Check, X, Loader2,
  History, Clock
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import ReactMarkdown from "react-markdown";

type HealthMetric = { 
  date: string; 
  weight: number | null; 
  body_fat: number | null;
  muscle_mass: number | null;
  resting_hr: number | null; 
  hrv: number | null;
  systolic_bp: number | null;
  diastolic_bp: number | null;
  energy_level: number | null;
  stress_level: number | null;
};

type Injury = { id: string; body_part: string; severity: number; status: string; notes: string; created_at: string };

type HealthInsight = {
  id: string;
  insight: string;
  created_at: string;
};

type InjuryAnalysis = {
  id: string;
  analysis: string;
  created_at: string;
};

export default function HealthPage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<HealthMetric[]>([]);
  const [injuries, setInjuries] = useState<Injury[]>([]);
  
  // Taille de l'utilisateur pour l'IMC
  const [userHeight, setUserHeight] = useState<number | null>(null);

  // Formulaire Vitals
  const [weight, setWeight] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [muscleMass, setMuscleMass] = useState("");
  const [hr, setHr] = useState("");
  const [hrv, setHrv] = useState("");
  const [sysBp, setSysBp] = useState("");
  const [diaBp, setDiaBp] = useState("");
  
  // Formulaire Bien-être
  const [energy, setEnergy] = useState("3");
  const [stress, setStress] = useState("3");

  // Formulaire Blessure
  const [bodyPart, setBodyPart] = useState("");
  const [severity, setSeverity] = useState("1");
  const [notes, setNotes] = useState("");
  
  const [savingVitals, setSavingVitals] = useState(false);
  const [savingWellbeing, setSavingWellbeing] = useState(false);
  const [savingInjury, setSavingInjury] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ✅ Édition / Suppression des blessures
  const [editingInjuryId, setEditingInjuryId] = useState<string | null>(null);
  const [editBodyPart, setEditBodyPart] = useState("");
  const [editSeverity, setEditSeverity] = useState("1");
  const [editNotes, setEditNotes] = useState("");
  const [deletingInjuryId, setDeletingInjuryId] = useState<string | null>(null);
  const [busyInjuryId, setBusyInjuryId] = useState<string | null>(null);

  // ✅ Bilan Santé IA (historique + suppression)
  const [healthInsights, setHealthInsights] = useState<HealthInsight[]>([]);
  const [selectedInsightIndex, setSelectedInsightIndex] = useState(0);
  const [showInsightHistory, setShowInsightHistory] = useState(false);
  const [loadingHealthInsight, setLoadingHealthInsight] = useState(false);

  // ✅ Analyse blessure (historique + suppression)
  const [injuryAnalyses, setInjuryAnalyses] = useState<InjuryAnalysis[]>([]);
  const [selectedAnalysisIndex, setSelectedAnalysisIndex] = useState(0);
  const [showAnalysisHistory, setShowAnalysisHistory] = useState(false);
  const [loadingInjuryAnalysis, setLoadingInjuryAnalysis] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      if (user.user_metadata?.height) {
        setUserHeight(parseFloat(user.user_metadata.height));
      }

      const [metricsRes, injuriesRes, insightsRes, injuryAnalysesRes] = await Promise.all([
        supabase.from("health_metrics").select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(7),
        supabase.from("injuries").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("ai_generations")
          .select("id, content, created_at")
          .eq("user_id", user.id)
          .eq("type", "health_insight")
          .order("created_at", { ascending: false }),
        supabase.from("ai_generations")
          .select("id, content, created_at")
          .eq("user_id", user.id)
          .eq("type", "injury_analysis")
          .order("created_at", { ascending: false })
      ]);
      
      if (metricsRes.data) {
        setMetrics(metricsRes.data);
        if (metricsRes.data.length > 0) {
          const latest = metricsRes.data[0];
          setWeight(latest.weight?.toString() || "");
          setBodyFat(latest.body_fat?.toString() || "");
          setMuscleMass(latest.muscle_mass?.toString() || "");
          setHr(latest.resting_hr?.toString() || "");
          setHrv(latest.hrv?.toString() || "");
          setSysBp(latest.systolic_bp?.toString() || "");
          setDiaBp(latest.diastolic_bp?.toString() || "");
          setEnergy(latest.energy_level?.toString() || "3");
          setStress(latest.stress_level?.toString() || "3");
        }
      }
      
      if (injuriesRes.data) setInjuries(injuriesRes.data);

      // ✅ Charge tous les bilans santé
      if (insightsRes.data) {
        const formatted = insightsRes.data
          .filter(i => i.content?.insight)
          .map(i => ({
            id: i.id,
            insight: i.content.insight,
            created_at: i.created_at
          }));
        setHealthInsights(formatted);
      }

      // ✅ Charge toutes les analyses de blessure
      if (injuryAnalysesRes.data) {
        const formatted = injuryAnalysesRes.data
          .filter(i => i.content?.analysis)
          .map(i => ({
            id: i.id,
            analysis: i.content.analysis,
            created_at: i.created_at
          }));
        setInjuryAnalyses(formatted);
      }
    }
    setLoading(false);
  };

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleSaveVitals = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingVitals(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      await supabase.from("health_metrics").upsert({
        user_id: user.id,
        date: new Date().toISOString().split("T")[0],
        weight: weight ? parseFloat(weight) : null,
        body_fat: bodyFat ? parseFloat(bodyFat) : null,
        muscle_mass: muscleMass ? parseFloat(muscleMass) : null,
        resting_hr: hr ? parseInt(hr) : null,
        hrv: hrv ? parseInt(hrv) : null,
        systolic_bp: sysBp ? parseInt(sysBp) : null,
        diastolic_bp: diaBp ? parseInt(diaBp) : null,
        energy_level: energy ? parseInt(energy) : null,
        stress_level: stress ? parseInt(stress) : null,
      }, { onConflict: "user_id,date" });
      
      showSuccess("Constantes mises à jour !");
      fetchData();
    }
    setSavingVitals(false);
  };

  const handleSaveWellbeing = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingWellbeing(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      await supabase.from("health_metrics").upsert({
        user_id: user.id,
        date: new Date().toISOString().split("T")[0],
        energy_level: parseInt(energy),
        stress_level: parseInt(stress),
      }, { onConflict: "user_id,date" });
      
      showSuccess("Bien-être enregistré !");
      fetchData();
    }
    setSavingWellbeing(false);
  };

  const generateHealthInsight = async () => {
    if (metrics.length === 0) return;
    setLoadingHealthInsight(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoadingHealthInsight(false);
      return;
    }

    const recentMetrics = metrics.slice(0, 7).map(m => ({
      date: m.date,
      weight: m.weight,
      body_fat: m.body_fat,
      systolic_bp: m.systolic_bp,
      diastolic_bp: m.diastolic_bp,
      energy: m.energy_level,
      stress: m.stress_level
    }));

    try {
      const res = await fetch("/api/deep-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: "Analyse mes constantes de santé des 7 derniers jours (poids, tension, énergie, stress) et dis-moi ce qui doit être amélioré.",
          userContext: "Bilan de santé préventif.",
          historicalData: JSON.stringify(recentMetrics)
        })
      });
      const data = await res.json();

      if (data.analysis) {
        // ✅ Sauvegarde en BDD
        const { data: newInsight, error } = await supabase
          .from("ai_generations")
          .insert({
            user_id: user.id,
            type: "health_insight",
            content: { insight: data.analysis }
          })
          .select()
          .single();

        if (error) throw error;

        // ✅ Ajout immédiat en mémoire
        if (newInsight) {
          setHealthInsights(prev => [
            { id: newInsight.id, insight: data.analysis, created_at: newInsight.created_at },
            ...prev
          ]);
          setSelectedInsightIndex(0);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHealthInsight(false);
    }
  };

  const handleAddInjury = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingInjury(true);

    const injurySnapshot = { bodyPart, severity: parseInt(severity), notes };

    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      await supabase.from("injuries").insert({
        user_id: user.id,
        body_part: injurySnapshot.bodyPart,
        severity: injurySnapshot.severity,
        notes: injurySnapshot.notes,
        status: "active"
      });

      showSuccess("Douleur enregistrée. OMNIA analyse...");
      setBodyPart(""); setNotes(""); setSeverity("1");
      fetchData();

      setLoadingInjuryAnalysis(true);
      try {
        const analysisRes = await fetch("/api/deep-analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: `Je viens de déclarer une blessure à ${injurySnapshot.bodyPart} (intensité ${injurySnapshot.severity}/5). Quelle pourrait être la cause selon mes derniers entraînements et comment adapter ma récupération ?`,
            userContext: `Notes sur la blessure: ${injurySnapshot.notes || 'Aucune'}.`,
            historicalData: "Analyse basée sur les derniers entraînements."
          })
        });
        const analysisData = await analysisRes.json();
        
        if (analysisData.analysis) {
          // ✅ Sauvegarde en BDD
          const { data: newAnalysis, error } = await supabase
            .from("ai_generations")
            .insert({
              user_id: user.id,
              type: "injury_analysis",
              content: { analysis: analysisData.analysis }
            })
            .select()
            .single();

          if (error) throw error;

          // ✅ Ajout immédiat en mémoire
          if (newAnalysis) {
            setInjuryAnalyses(prev => [
              { id: newAnalysis.id, analysis: analysisData.analysis, created_at: newAnalysis.created_at },
              ...prev
            ]);
            setSelectedAnalysisIndex(0);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingInjuryAnalysis(false);
      }
    }
    setSavingInjury(false);
  };

  const updateInjuryStatus = async (id: string, newStatus: string) => {
    await supabase.from("injuries").update({ status: newStatus }).eq("id", id);
    fetchData();
  };

  const startEditInjury = (inj: Injury) => {
    setEditingInjuryId(inj.id);
    setEditBodyPart(inj.body_part);
    setEditSeverity(inj.severity.toString());
    setEditNotes(inj.notes || "");
    setDeletingInjuryId(null);
  };

  const cancelEditInjury = () => {
    setEditingInjuryId(null);
    setEditBodyPart("");
    setEditSeverity("1");
    setEditNotes("");
  };

  const handleUpdateInjury = async (id: string) => {
    if (!editBodyPart.trim()) return;
    setBusyInjuryId(id);

    const { error } = await supabase
      .from("injuries")
      .update({
        body_part: editBodyPart.trim(),
        severity: parseInt(editSeverity),
        notes: editNotes.trim()
      })
      .eq("id", id);

    if (error) {
      console.error("[health] update injury:", error);
    } else {
      setInjuries(prev =>
        prev.map(i =>
          i.id === id ? { ...i, body_part: editBodyPart.trim(), severity: parseInt(editSeverity), notes: editNotes.trim() } : i
        )
      );
      cancelEditInjury();
    }
    setBusyInjuryId(null);
  };

  const handleDeleteInjury = async (id: string) => {
    setBusyInjuryId(id);
    const { error } = await supabase.from("injuries").delete().eq("id", id);

    if (error) {
      console.error("[health] delete injury:", error);
    } else {
      setInjuries(prev => prev.filter(i => i.id !== id));
      setDeletingInjuryId(null);
    }
    setBusyInjuryId(null);
  };

  // ✅ Suppression d'un bilan santé (gère les 3 cas d'index)
  const deleteHealthInsight = async (id: string, index: number) => {
    if (!confirm("Supprimer définitivement ce bilan de l'historique ?")) return;

    const { error } = await supabase.from("ai_generations").delete().eq("id", id);
    if (error) {
      console.error("❌ [deleteHealthInsight] Erreur Supabase:", error);
      alert(`Erreur lors de la suppression : ${error.message}`);
      return;
    }

    setHealthInsights(prev => prev.filter(i => i.id !== id));

    if (index === selectedInsightIndex) {
      setSelectedInsightIndex(0);
    } else if (index < selectedInsightIndex) {
      setSelectedInsightIndex(prev => prev - 1);
    }
  };

  // ✅ Suppression d'une analyse de blessure
  const deleteInjuryAnalysis = async (id: string, index: number) => {
    if (!confirm("Supprimer définitivement cette analyse ?")) return;

    const { error } = await supabase.from("ai_generations").delete().eq("id", id);
    if (error) {
      console.error("❌ [deleteInjuryAnalysis] Erreur Supabase:", error);
      alert(`Erreur lors de la suppression : ${error.message}`);
      return;
    }

    setInjuryAnalyses(prev => prev.filter(i => i.id !== id));

    if (index === selectedAnalysisIndex) {
      setSelectedAnalysisIndex(0);
    } else if (index < selectedAnalysisIndex) {
      setSelectedAnalysisIndex(prev => prev - 1);
    }
  };

  if (loading) return <div className="p-8 text-white min-h-screen bg-[#020202]">Chargement...</div>;

  const latest = metrics[0];
  const activeInjuries = injuries.filter(i => i.status === 'active').length;

  const bmi = (latest?.weight && userHeight) 
    ? (latest.weight / Math.pow(userHeight / 100, 2)).toFixed(1) 
    : "--";

  const alerts = [];
  if (latest?.systolic_bp && latest.systolic_bp > 140) {
    alerts.push({ title: "Tension élevée", desc: "Votre tension systolique est supérieure à 140. Pensez à vous hydrater et à réduire le stress.", color: "text-alert", bg: "bg-alert/10", icon: HeartPulse });
  }
  if (latest?.stress_level && latest.stress_level >= 4) {
    alerts.push({ title: "Stress élevé", desc: "Votre niveau de stress est très élevé. Privilégiez la récupération et les exercices de respiration.", color: "text-warning", bg: "bg-warning/10", icon: Brain });
  }
  if (latest?.energy_level && latest.energy_level <= 2) {
    alerts.push({ title: "Énergie basse", desc: "Vous êtes à plat. Assurez-vous de dormir suffisamment et de manger à votre faim.", color: "text-strain", bg: "bg-strain/10", icon: Zap });
  }

  const weightData = metrics.filter(m => m.weight).map(m => ({
    date: new Date(m.date).toLocaleDateString("fr-FR", { day: '2-digit', month: 'short' }),
    weight: m.weight
  })).reverse();

  const currentInsight = healthInsights[selectedInsightIndex];
  const currentAnalysis = injuryAnalyses[selectedAnalysisIndex];

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto bg-[#020202] min-h-screen space-y-4 md:space-y-6">
      
      <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-4 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white mb-1 flex items-center gap-2">
            Santé & Récupération
          </h1>
          <p className="text-xs md:text-sm text-text-muted">Suivez vos constantes, votre composition corporelle et vos blessures.</p>
        </div>
        <button 
          onClick={generateHealthInsight} 
          disabled={loadingHealthInsight || metrics.length === 0}
          className="w-full md:w-auto flex items-center justify-center gap-2 bg-purple-500/10 border border-purple-500/30 text-purple-400 font-semibold rounded-xl px-4 py-2.5 hover:bg-purple-500/20 transition-all text-xs md:text-sm disabled:opacity-50"
        >
          <BrainCircuit size={16} className="md:w-[18px] md:h-[18px]" /> 
          {loadingHealthInsight ? "Analyse..." : healthInsights.length > 0 ? "Regénérer le bilan" : "Bilan Santé IA"}
        </button>
      </header>

      <AnimatePresence>
        {successMessage && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bg-recovery/10 border border-recovery/20 rounded-xl p-3 text-recovery text-xs md:text-sm text-center">
            {successMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* BILAN IA (avec historique + suppression) */}
      <AnimatePresence>
        {(currentInsight || loadingHealthInsight) && (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="bg-purple-500/5 border border-purple-500/20 rounded-3xl p-4 md:p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 blur-3xl pointer-events-none rounded-full" />
            
            <div className="flex items-start justify-between gap-3 md:gap-4 relative z-10">
              <div className="flex items-start gap-3 md:gap-4 flex-1 min-w-0">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                  <BrainCircuit className="text-purple-500" size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="text-[10px] md:text-xs font-semibold tracking-widest text-purple-400 uppercase">Bilan OMNIA</h3>
                    <span className="text-[8px] md:text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded uppercase font-bold">Global</span>
                    {currentInsight && !loadingHealthInsight && (
                      <span className="text-[9px] md:text-[10px] text-text-muted flex items-center gap-1">
                        <Clock size={9} /> {new Date(currentInsight.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* ✅ Actions : Historique + Supprimer */}
              {currentInsight && !loadingHealthInsight && (
                <div className="flex items-center gap-1.5 shrink-0">
                  {healthInsights.length > 1 && (
                    <button
                      onClick={() => setShowInsightHistory(!showInsightHistory)}
                      className="flex items-center gap-1 bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] md:text-xs font-semibold px-2 md:px-3 py-1.5 rounded-lg hover:bg-purple-500/20 transition-colors"
                      title="Historique"
                    >
                      <History size={12} />
                      <span className="hidden md:inline">{healthInsights.length}</span>
                    </button>
                  )}
                  <button
                    onClick={() => deleteHealthInsight(currentInsight.id, selectedInsightIndex)}
                    className="text-alert hover:bg-alert/10 p-1.5 md:p-2 rounded-lg transition-colors"
                    title="Supprimer ce bilan"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* ✅ Historique déroulant */}
            <AnimatePresence>
              {showInsightHistory && healthInsights.length > 1 && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-3 relative z-10">
                  <div className="bg-background border border-border rounded-2xl p-2 max-h-48 overflow-y-auto custom-scrollbar flex flex-col gap-1">
                    {healthInsights.map((item, index) => (
                      <div
                        key={item.id}
                        className={`flex items-center gap-1 rounded-xl transition-colors ${
                          selectedInsightIndex === index ? "bg-purple-500/20" : "hover:bg-surface-hover"
                        }`}
                      >
                        <button
                          onClick={() => { setSelectedInsightIndex(index); setShowInsightHistory(false); }}
                          className={`flex-1 text-left px-3 py-2 rounded-xl text-xs md:text-sm ${
                            selectedInsightIndex === index
                              ? "text-purple-300 font-semibold"
                              : "text-text-muted hover:text-white"
                          }`}
                        >
                          <span>Bilan du {new Date(item.created_at).toLocaleDateString("fr-FR")}</span>
                          {selectedInsightIndex === index && (
                            <span className="ml-2 text-[10px] bg-purple-500/30 px-2 py-0.5 rounded uppercase">Actuel</span>
                          )}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteHealthInsight(item.id, index); }}
                          className="text-alert hover:bg-alert/10 p-2 rounded-lg mr-1 shrink-0 transition-colors"
                          title="Supprimer ce bilan"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Contenu */}
            <div className="mt-3 relative z-10">
              {loadingHealthInsight ? (
                <p className="text-xs md:text-sm text-text-main animate-pulse">Analyse de vos constantes...</p>
              ) : currentInsight ? (
                <div className="text-xs md:text-sm text-text-main leading-relaxed">
                  <ReactMarkdown components={{
                    strong: ({node, ...props}) => <span className="font-bold text-white" {...props} />,
                    li: ({node, ...props}) => <li className="ml-4 list-disc marker:text-strain mb-1" {...props} />,
                    p: ({node, ...props}) => <p className="mb-2" {...props} />,
                  }}>
                    {currentInsight.insight}
                  </ReactMarkdown>
                </div>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ALERTES AUTOMATIQUES */}
      {alerts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          {alerts.map((alert, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className={`${alert.bg} border border-border/50 rounded-2xl p-3 md:p-4 flex items-start gap-2 md:gap-3`}>
              <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full bg-background flex items-center justify-center shrink-0 ${alert.color}`}>
                <alert.icon size={12} className="md:w-4 md:h-4" />
              </div>
              <div>
                <p className={`text-xs md:text-sm font-bold ${alert.color}`}>{alert.title}</p>
                <p className="text-[9px] md:text-[10px] text-text-muted mt-1 leading-relaxed">{alert.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* TOP METRICS (2 cols sur mobile) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4 mb-6 md:mb-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-surface border border-border rounded-2xl p-3 md:p-5 relative overflow-hidden group">
          <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-4">
            <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-blue-500/10 flex items-center justify-center"><Scale size={14} className="text-blue-500" /></div>
            <span className="text-[10px] md:text-xs font-semibold text-text-muted tracking-widest uppercase truncate">Poids</span>
          </div>
          <div className="flex items-baseline gap-1 relative z-10">
            <span className="text-2xl md:text-4xl font-bold text-white">{latest?.weight || "--"}</span>
            <span className="text-xs md:text-sm text-text-muted">kg</span>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-surface border border-border rounded-2xl p-3 md:p-5 relative overflow-hidden group">
          <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-4">
            <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-indigo-500/10 flex items-center justify-center"><Calculator size={14} className="text-indigo-500" /></div>
            <span className="text-[10px] md:text-xs font-semibold text-text-muted tracking-widest uppercase truncate">IMC</span>
          </div>
          <div className="flex items-baseline gap-1 relative z-10">
            <span className="text-2xl md:text-4xl font-bold text-white">{bmi}</span>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-surface border border-border rounded-2xl p-3 md:p-5 relative overflow-hidden group">
          <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-4">
            <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-warning/10 flex items-center justify-center"><Percent size={14} className="text-warning" /></div>
            <span className="text-[10px] md:text-xs font-semibold text-text-muted tracking-widest uppercase truncate">Masse Grasse</span>
          </div>
          <div className="flex items-baseline gap-1 relative z-10">
            <span className="text-2xl md:text-4xl font-bold text-white">{latest?.body_fat || "--"}</span>
            <span className="text-xs md:text-sm text-text-muted">%</span>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-surface border border-border rounded-2xl p-3 md:p-5 relative overflow-hidden group">
          <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-4">
            <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-recovery/10 flex items-center justify-center"><HeartPulse size={14} className="text-recovery" /></div>
            <span className="text-[10px] md:text-xs font-semibold text-text-muted tracking-widest uppercase truncate">FC Repos</span>
          </div>
          <div className="flex items-baseline gap-1 relative z-10">
            <span className="text-2xl md:text-4xl font-bold text-white">{latest?.resting_hr || "--"}</span>
            <span className="text-xs md:text-sm text-text-muted">bpm</span>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="col-span-2 lg:col-span-1 bg-surface border border-border rounded-2xl p-3 md:p-5 relative overflow-hidden group">
          <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-4">
            <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center ${activeInjuries > 0 ? 'bg-alert/10 text-alert' : 'bg-recovery/10 text-recovery'}`}>
              <Stethoscope size={14} />
            </div>
            <span className="text-[10px] md:text-xs font-semibold text-text-muted tracking-widest uppercase truncate">Blessures</span>
          </div>
          <div className="flex items-baseline gap-1 relative z-10">
            <span className={`text-2xl md:text-4xl font-bold ${activeInjuries > 0 ? 'text-alert' : 'text-white'}`}>{activeInjuries}</span>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 mb-6">
        
        {/* FORMULAIRE VITALS */}
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="lg:col-span-7 bg-surface border border-border rounded-3xl p-4 md:p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-strain/5 blur-3xl pointer-events-none rounded-full" />
          
          <div className="flex items-center gap-2 mb-4 md:mb-8 relative z-10">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-strain/10 flex items-center justify-center">
              <Activity size={16} className="text-strain md:w-5 md:h-5" />
            </div>
            <div>
              <h2 className="text-sm md:text-lg font-semibold text-white">Composition & Constantes</h2>
              <p className="text-[10px] md:text-xs text-text-muted">Mettez à jour vos données physiologiques.</p>
            </div>
          </div>
          
          <form onSubmit={handleSaveVitals} className="space-y-4 md:space-y-6 relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
              <div>
                <label className="block text-[9px] md:text-[10px] font-semibold text-text-muted tracking-widest uppercase mb-1 md:mb-2">Poids (kg)</label>
                <input type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} className="w-full bg-background border border-border rounded-xl px-3 md:px-4 py-2 md:py-3 text-xs md:text-sm text-white font-mono focus:outline-none focus:border-strain transition-colors" placeholder="74.5" />
              </div>
              <div>
                <label className="block text-[9px] md:text-[10px] font-semibold text-text-muted tracking-widest uppercase mb-1 md:mb-2">Masse Grasse (%)</label>
                <input type="number" step="0.1" value={bodyFat} onChange={e => setBodyFat(e.target.value)} className="w-full bg-background border border-border rounded-xl px-3 md:px-4 py-2 md:py-3 text-xs md:text-sm text-white font-mono focus:outline-none focus:border-strain transition-colors" placeholder="12.5" />
              </div>
              <div>
                <label className="block text-[9px] md:text-[10px] font-semibold text-text-muted tracking-widest uppercase mb-1 md:mb-2">Masse Musc. (kg)</label>
                <input type="number" step="0.1" value={muscleMass} onChange={e => setMuscleMass(e.target.value)} className="w-full bg-background border border-border rounded-xl px-3 md:px-4 py-2 md:py-3 text-xs md:text-sm text-white font-mono focus:outline-none focus:border-strain transition-colors" placeholder="65.0" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
              <div>
                <label className="block text-[9px] md:text-[10px] font-semibold text-text-muted tracking-widest uppercase mb-1 md:mb-2">FC Repos (bpm)</label>
                <input type="number" value={hr} onChange={e => setHr(e.target.value)} className="w-full bg-background border border-border rounded-xl px-3 md:px-4 py-2 md:py-3 text-xs md:text-sm text-white font-mono focus:outline-none focus:border-strain transition-colors" placeholder="48" />
              </div>
              <div>
                <label className="block text-[9px] md:text-[10px] font-semibold text-text-muted tracking-widest uppercase mb-1 md:mb-2">HRV (ms)</label>
                <input type="number" value={hrv} onChange={e => setHrv(e.target.value)} className="w-full bg-background border border-border rounded-xl px-3 md:px-4 py-2 md:py-3 text-xs md:text-sm text-white font-mono focus:outline-none focus:border-strain transition-colors" placeholder="65" />
              </div>
              <div>
                <label className="block text-[9px] md:text-[10px] font-semibold text-text-muted tracking-widest uppercase mb-1 md:mb-2">Tension (Sys/Dia)</label>
                <div className="flex gap-1 md:gap-2">
                  <input type="number" value={sysBp} onChange={e => setSysBp(e.target.value)} className="w-full bg-background border border-border rounded-xl px-2 py-2 md:py-3 text-xs md:text-sm text-white font-mono text-center focus:outline-none focus:border-strain transition-colors" placeholder="120" />
                  <span className="text-text-muted mt-2 md:mt-3 text-xs md:text-sm">/</span>
                  <input type="number" value={diaBp} onChange={e => setDiaBp(e.target.value)} className="w-full bg-background border border-border rounded-xl px-2 py-2 md:py-3 text-xs md:text-sm text-white font-mono text-center focus:outline-none focus:border-strain transition-colors" placeholder="80" />
                </div>
              </div>
            </div>
            
            <button type="submit" disabled={savingVitals} className="w-full bg-white text-black font-semibold rounded-xl py-3 md:py-4 hover:bg-gray-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2 md:mt-4 text-xs md:text-sm">
              {savingVitals ? "Enregistrement..." : <><CheckCircle2 size={16} className="md:w-[18px] md:h-[18px]"/> Mettre à jour mes constantes</>}
            </button>
          </form>
        </motion.div>

        {/* FORMULAIRE BIEN-ÊTRE & BLESSURE */}
        <div className="lg:col-span-5 space-y-4 md:space-y-6">
          
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="bg-surface border border-border rounded-3xl p-4 md:p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 blur-3xl pointer-events-none rounded-full" />
            
            <div className="flex items-center gap-2 mb-4 md:mb-6 relative z-10">
              <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-purple-500/10 flex items-center justify-center">
                <Brain size={14} className="text-purple-500 md:w-4 md:h-4" />
              </div>
              <h2 className="text-xs md:text-sm font-semibold text-white uppercase tracking-widest">Ressenti du jour</h2>
            </div>
            
            <form onSubmit={handleSaveWellbeing} className="space-y-4 md:space-y-6 relative z-10">
              <div>
                <div className="flex justify-between items-center mb-1 md:mb-2">
                  <label className="block text-[9px] md:text-[10px] font-semibold text-text-muted tracking-widest uppercase">Niveau d'énergie</label>
                  <span className="text-[9px] md:text-[10px] font-bold text-recovery bg-recovery/10 px-2 py-0.5 rounded">{energy}/5</span>
                </div>
                <input type="range" min="1" max="5" value={energy} onChange={e => setEnergy(e.target.value)} className="w-full accent-recovery" />
                <div className="flex justify-between text-[8px] md:text-[10px] text-text-muted mt-1"><span>Épuisé</span><span>En feu</span></div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1 md:mb-2">
                  <label className="block text-[9px] md:text-[10px] font-semibold text-text-muted tracking-widest uppercase">Niveau de stress</label>
                  <span className="text-[9px] md:text-[10px] font-bold text-alert bg-alert/10 px-2 py-0.5 rounded">{stress}/5</span>
                </div>
                <input type="range" min="1" max="5" value={stress} onChange={e => setStress(e.target.value)} className="w-full accent-alert" />
                <div className="flex justify-between text-[8px] md:text-[10px] text-text-muted mt-1"><span>Détendu</span><span>Très stressé</span></div>
              </div>
              <button type="submit" disabled={savingWellbeing} className="w-full bg-surface-hover border border-border text-white font-semibold rounded-xl py-2.5 md:py-3 hover:bg-border transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-xs md:text-sm">
                <Zap size={14} className="md:w-4 md:h-4" /> {savingWellbeing ? "..." : "Enregistrer le ressenti"}
              </button>
            </form>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="bg-surface border border-border rounded-3xl p-4 md:p-6 relative overflow-hidden">
            <div className="flex items-center gap-2 mb-4 md:mb-6 relative z-10">
              <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-alert/10 flex items-center justify-center">
                <ShieldAlert size={14} className="text-alert md:w-4 md:h-4" />
              </div>
              <h2 className="text-xs md:text-sm font-semibold text-white uppercase tracking-widest">Déclarer une douleur</h2>
            </div>
            
            <form onSubmit={handleAddInjury} className="space-y-3 md:space-y-4 relative z-10">
              <div>
                <input type="text" value={bodyPart} onChange={e => setBodyPart(e.target.value)} required placeholder="Zone (ex: Ischio droit)" className="w-full bg-background border border-border rounded-xl px-3 md:px-4 py-2.5 md:py-3 text-xs md:text-sm text-white focus:outline-none focus:border-alert transition-colors" />
              </div>
              <div className="flex items-center gap-3 md:gap-4">
                <input type="range" min="1" max="5" value={severity} onChange={e => setSeverity(e.target.value)} className="flex-1 accent-alert" />
                <span className="text-[10px] md:text-xs font-bold text-alert bg-alert/10 px-2 py-1 rounded w-8 md:w-10 text-center">{severity}/5</span>
              </div>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optionnel)" className="w-full bg-background border border-border rounded-xl px-3 md:px-4 py-2 md:py-2 text-[10px] md:text-sm text-white focus:outline-none focus:border-alert transition-colors" />
              <button type="submit" disabled={savingInjury} className="w-full bg-alert/20 text-alert font-semibold rounded-xl py-2 md:py-2.5 hover:bg-alert/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-xs md:text-sm">
                <Plus size={14} className="md:w-4 md:h-4" /> Ajouter
              </button>
            </form>
          </motion.div>

          {/* ✅ ANALYSE BLESSURE (avec historique + suppression) */}
          <AnimatePresence>
            {(currentAnalysis || loadingInjuryAnalysis) && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="bg-purple-500/10 border border-purple-500/20 rounded-3xl p-4 md:p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/10 blur-3xl pointer-events-none rounded-full" />
                
                <div className="flex items-start justify-between gap-2 relative z-10">
                  <div className="flex items-start gap-2 md:gap-3 flex-1 min-w-0">
                    <div className="w-7 h-7 md:w-9 md:h-9 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                      <BrainCircuit className="text-purple-400" size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-[10px] md:text-xs font-semibold tracking-widest text-purple-400 uppercase">Conseil OMNIA</h3>
                        <span className="text-[8px] md:text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded uppercase font-bold">Analyse</span>
                        {currentAnalysis && !loadingInjuryAnalysis && (
                          <span className="text-[9px] md:text-[10px] text-text-muted flex items-center gap-1">
                            <Clock size={9} /> {new Date(currentAnalysis.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {currentAnalysis && !loadingInjuryAnalysis && (
                    <div className="flex items-center gap-1 shrink-0">
                      {injuryAnalyses.length > 1 && (
                        <button
                          onClick={() => setShowAnalysisHistory(!showAnalysisHistory)}
                          className="flex items-center gap-1 bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-semibold px-2 py-1.5 rounded-lg hover:bg-purple-500/20 transition-colors"
                          title="Historique"
                        >
                          <History size={11} />
                        </button>
                      )}
                      <button
                        onClick={() => deleteInjuryAnalysis(currentAnalysis.id, selectedAnalysisIndex)}
                        className="text-alert hover:bg-alert/10 p-1.5 rounded-lg transition-colors"
                        title="Supprimer cette analyse"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>

                {/* ✅ Historique déroulant */}
                <AnimatePresence>
                  {showAnalysisHistory && injuryAnalyses.length > 1 && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-2 relative z-10">
                      <div className="bg-background border border-border rounded-xl p-1.5 max-h-40 overflow-y-auto custom-scrollbar flex flex-col gap-1">
                        {injuryAnalyses.map((item, index) => (
                          <div
                            key={item.id}
                            className={`flex items-center gap-1 rounded-lg transition-colors ${
                              selectedAnalysisIndex === index ? "bg-purple-500/20" : "hover:bg-surface-hover"
                            }`}
                          >
                            <button
                              onClick={() => { setSelectedAnalysisIndex(index); setShowAnalysisHistory(false); }}
                              className={`flex-1 text-left px-2 py-1.5 rounded-lg text-[10px] md:text-xs ${
                                selectedAnalysisIndex === index
                                  ? "text-purple-300 font-semibold"
                                  : "text-text-muted hover:text-white"
                              }`}
                            >
                              {new Date(item.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" })}
                              {selectedAnalysisIndex === index && (
                                <span className="ml-1.5 text-[8px] bg-purple-500/30 px-1.5 py-0.5 rounded uppercase">Actuel</span>
                              )}
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteInjuryAnalysis(item.id, index); }}
                              className="text-alert hover:bg-alert/10 p-1.5 rounded-md shrink-0 transition-colors"
                              title="Supprimer"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="mt-2 relative z-10">
                  {loadingInjuryAnalysis ? (
                    <p className="text-xs md:text-sm text-text-main animate-pulse">Analyse de vos derniers entraînements...</p>
                  ) : currentAnalysis ? (
                    <div className="text-xs md:text-sm text-text-main leading-relaxed">
                      <ReactMarkdown components={{
                        strong: ({node, ...props}) => <span className="font-bold text-white" {...props} />,
                        li: ({node, ...props}) => <li className="ml-4 list-disc marker:text-strain mb-1" {...props} />,
                        p: ({node, ...props}) => <p className="mb-1" {...props} />,
                      }}>
                        {currentAnalysis.analysis}
                      </ReactMarkdown>
                    </div>
                  ) : null}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* GRAPHIQUE DE POIDS */}
      {weightData.length > 1 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-surface border border-border rounded-3xl p-4 md:p-6 mb-6">
          <div className="flex items-center gap-2 mb-4 md:mb-6">
            <TrendingUp size={16} className="text-strain md:w-[18px] md:h-[18px]" />
            <h2 className="text-[10px] md:text-sm font-semibold tracking-widest text-text-muted uppercase">Évolution du poids</h2>
          </div>
          <div className="h-40 md:h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weightData} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                <XAxis dataKey="date" stroke="#636366" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="#636366" fontSize={10} tickLine={false} axisLine={false} domain={['dataMin - 1', 'dataMax + 1']} width={35} />
                <Tooltip contentStyle={{ backgroundColor: '#111111', borderColor: '#222222', borderRadius: '8px', color: '#FFF', fontSize: '12px' }} />
                <Line type="monotone" dataKey="weight" name="Poids (kg)" stroke="#0093E7" strokeWidth={2.5} dot={{ fill: '#0093E7', r: 3 }} activeDot={{ r: 5, fill: '#FFF' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* HISTORIQUE DES BLESSURES */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-surface border border-border rounded-3xl p-4 md:p-8">
        <div className="flex items-center justify-between mb-4 md:mb-6">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-text-muted md:w-[18px] md:h-[18px]" />
            <h2 className="text-[10px] md:text-sm font-semibold text-white uppercase tracking-widest">Historique des blessures</h2>
          </div>
        </div>
        
        {injuries.length === 0 ? (
          <div className="text-center py-8 md:py-12 border border-dashed border-border rounded-2xl">
            <CheckCircle2 size={32} className="mx-auto text-recovery mb-3 md:mb-4 opacity-50 md:w-12 md:h-12" />
            <p className="text-xs md:text-sm text-text-muted">Aucune blessure déclarée. Votre corps vous dit merci !</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            {injuries.map(inj => {
              const isEditing = editingInjuryId === inj.id;
              const isDeleting = deletingInjuryId === inj.id;
              const isBusy = busyInjuryId === inj.id;

              return (
                <div key={inj.id} className={`flex flex-col justify-between p-3 md:p-5 rounded-2xl border transition-all ${
                  isEditing ? 'border-alert/50 bg-alert/5' : inj.status === 'active' ? 'bg-alert/5 border-alert/20' : 'bg-background border-border group hover:border-border/80'
                }`}>
                  
                  <div className="flex items-start justify-between mb-3 md:mb-4">
                    <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center shrink-0 ${inj.status === 'active' ? 'bg-alert/20 text-alert' : 'bg-surface-hover text-text-muted'}`}>
                      <AlertTriangle size={14} className="md:w-[18px] md:h-[18px]" />
                    </div>

                    {!isEditing && !isDeleting && (
                      <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEditInjury(inj)}
                          className="p-1.5 rounded-md text-text-muted hover:text-white hover:bg-surface-hover transition-colors"
                        >
                          <Pencil size={14} className="md:w-[14px] md:h-[14px]" />
                        </button>
                        <button
                          onClick={() => setDeletingInjuryId(inj.id)}
                          className="p-1.5 rounded-md text-text-muted hover:text-alert hover:bg-alert/10 transition-colors"
                        >
                          <Trash2 size={14} className="md:w-[14px] md:h-[14px]" />
                        </button>
                      </div>
                    )}
                  </div>

                  {isDeleting ? (
                    <div className="bg-alert/5 border border-alert/30 rounded-xl p-3 space-y-2">
                      <p className="text-[10px] md:text-xs text-alert font-medium">Supprimer cette blessure ?</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setDeletingInjuryId(null)}
                          disabled={isBusy}
                          className="flex-1 text-[10px] md:text-xs font-semibold text-text-muted hover:bg-surface-hover rounded-md py-1.5 transition-colors disabled:opacity-50"
                        >
                          Annuler
                        </button>
                        <button
                          onClick={() => handleDeleteInjury(inj.id)}
                          disabled={isBusy}
                          className="flex-1 flex items-center justify-center gap-1 text-[10px] md:text-xs font-semibold bg-alert text-white rounded-md py-1.5 hover:bg-alert/80 transition-colors disabled:opacity-50"
                        >
                          {isBusy ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                          Supprimer
                        </button>
                      </div>
                    </div>
                  ) : isEditing ? (
                    <div className="space-y-2 md:space-y-3">
                      <input
                        type="text"
                        value={editBodyPart}
                        onChange={(e) => setEditBodyPart(e.target.value)}
                        autoFocus
                        className="w-full bg-surface border border-border rounded-lg px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm text-white focus:outline-none focus:border-alert"
                      />
                      
                      <div className="flex items-center gap-3 md:gap-4">
                        <input 
                          type="range" min="1" max="5" 
                          value={editSeverity} 
                          onChange={e => setEditSeverity(e.target.value)} 
                          className="flex-1 accent-alert" 
                        />
                        <span className="text-[9px] md:text-[10px] font-bold text-alert bg-alert/20 px-1.5 md:px-2 py-0.5 rounded w-8 md:w-10 text-center">{editSeverity}/5</span>
                      </div>

                      <input
                        type="text"
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="Notes (optionnel)"
                        className="w-full bg-surface border border-border rounded-lg px-2 md:px-3 py-1.5 md:py-2 text-[10px] md:text-xs text-white focus:outline-none focus:border-alert"
                      />

                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={cancelEditInjury}
                          disabled={isBusy}
                          className="flex-1 flex items-center justify-center gap-1 text-[10px] md:text-xs font-semibold text-text-muted hover:bg-surface-hover rounded-md py-1.5 transition-colors disabled:opacity-50"
                        >
                          <X size={12} /> Annuler
                        </button>
                        <button
                          onClick={() => handleUpdateInjury(inj.id)}
                          disabled={!editBodyPart.trim() || isBusy}
                          className="flex-1 flex items-center justify-center gap-1 text-[10px] md:text-xs font-semibold bg-alert text-white rounded-md py-1.5 hover:bg-alert/80 transition-colors disabled:opacity-50"
                        >
                          {isBusy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                          Enregistrer
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <p className="text-xs md:text-sm font-semibold text-white">{inj.body_part}</p>
                        <div className="flex items-center gap-1.5 md:gap-2 mt-1">
                          <span className={`text-[8px] md:text-[10px] uppercase font-bold px-1.5 md:px-2 py-0.5 rounded ${inj.severity >= 4 ? 'bg-alert/20 text-alert' : inj.severity >= 3 ? 'bg-warning/20 text-warning' : 'bg-recovery/20 text-recovery'}`}>
                            {inj.severity}/5
                          </span>
                          <span className="text-[8px] md:text-[10px] text-text-muted">{new Date(inj.created_at).toLocaleDateString("fr-FR")}</span>
                        </div>
                        {inj.notes && <p className="text-[10px] md:text-xs text-text-muted italic mt-1.5 md:mt-2">"{inj.notes}"</p>}
                      </div>
                      
                      <div className="flex justify-end mt-3 md:mt-4">
                        {inj.status === 'active' && (
                          <button onClick={() => updateInjuryStatus(inj.id, 'recovering')} className="text-[9px] md:text-xs font-semibold bg-warning/10 text-warning border border-warning/20 px-3 md:px-4 py-1.5 md:py-2 rounded-lg hover:bg-warning/20 transition-colors">
                            En récupération
                          </button>
                        )}
                        {inj.status === 'recovering' && (
                          <button onClick={() => updateInjuryStatus(inj.id, 'healed')} className="text-[9px] md:text-xs font-semibold bg-recovery/10 text-recovery border border-recovery/20 px-3 md:px-4 py-1.5 md:py-2 rounded-lg hover:bg-recovery/20 transition-colors flex items-center gap-1.5 md:gap-2">
                            <CheckCircle2 size={12} className="md:w-3.5 md:h-3.5"/> Guéri
                          </button>
                        )}
                        {inj.status === 'healed' && (
                          <span className="text-[9px] md:text-xs font-semibold text-recovery flex items-center gap-1.5 md:gap-2 bg-recovery/5 px-3 md:px-4 py-1.5 md:py-2 rounded-lg border border-recovery/10">
                            <CheckCircle2 size={12} className="md:w-3.5 md:h-3.5"/> Guéri
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}