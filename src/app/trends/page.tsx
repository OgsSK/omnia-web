// src/app/trends/page.tsx
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { 
  TrendingUp, Moon, Heart, Sparkles, Activity, 
  BrainCircuit, Zap, ChevronDown, Check, History, Trash2, Clock
} from "lucide-react";
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  AreaChart, Area, BarChart, Bar, Legend 
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";

type DailyMetric = {
  date: string;
  sleep_hours: number;
  fatigue_level: number;
  recovery_score: number;
};

type Measurement = {
  id: string;
  metric_type: string;
  measured_at: string;
  value: number;
};

type AnalysisHistory = {
  id: string;
  analysis: string;
  created_at: string;
};

export default function TrendsPage() {
  const [metrics, setMetrics] = useState<DailyMetric[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [nutrition, setNutrition] = useState<any[]>([]);
  const [journal, setJournal] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Sélecteur de test
  const [selectedTest, setSelectedTest] = useState("sprint_20m");
  const [showTestDropdown, setShowTestDropdown] = useState(false);

  // ✅ IA & Historique
  const [analysisHistories, setAnalysisHistories] = useState<AnalysisHistory[]>([]);
  const [selectedAnalysisIndex, setSelectedAnalysisIndex] = useState(0);
  const [showAnalysisHistory, setShowAnalysisHistory] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const [
        { data: metricsData },
        { data: measurementsData },
        { data: nutritionData },
        { data: journalData },
        { data: historyData }
      ] = await Promise.all([
        supabase.from("daily_metrics").select("*").eq("user_id", user.id).order("date", { ascending: true }),
        supabase.from("measurements").select("*").eq("user_id", user.id).order("measured_at", { ascending: true }),
        supabase.from("meal_logs").select("date, calories").eq("user_id", user.id).order("date", { ascending: true }),
        supabase.from("journal_entries").select("created_at, mood").eq("user_id", user.id).order("created_at", { ascending: true }),
        // ✅ On récupère TOUT l'historique des analyses
        supabase.from("ai_generations")
          .select("id, content, created_at")
          .eq("user_id", user.id)
          .eq("type", "trends")
          .order("created_at", { ascending: false })
      ]);

      if (metricsData) setMetrics(metricsData);
      if (nutritionData) setNutrition(nutritionData);
      if (journalData) setJournal(journalData);
      
      if (measurementsData) {
        setMeasurements(measurementsData);
        if (measurementsData.length > 0 && !measurementsData.find(m => m.metric_type === selectedTest)) {
          setSelectedTest(measurementsData[measurementsData.length - 1].metric_type);
        }
      }

      if (historyData) {
        const formatted = historyData
          .filter(h => h.content?.analysis)
          .map(h => ({
            id: h.id,
            analysis: h.content.analysis,
            created_at: h.created_at
          }));
        setAnalysisHistories(formatted);
      }
    }
    setLoading(false);
  };

  const generateAnalysis = async () => {
    if (metrics.length === 0) return;
    setLoadingAI(true);

    const { data: { user } } = await supabase.auth.getUser();

    const summaryMetrics = metrics.map(m => ({
      date: new Date(m.date).toLocaleDateString("fr-FR"),
      sleep: m.sleep_hours,
      recovery: m.recovery_score,
      fatigue: m.fatigue_level
    }));

    const recentTests = measurements.slice(-10).map(m => ({
      test: m.metric_type,
      date: new Date(m.measured_at).toLocaleDateString("fr-FR"),
      value: m.value
    }));

    const dailyCalories = nutrition.reduce((acc: any, curr) => {
      const d = curr.date;
      if (!acc[d]) acc[d] = 0;
      acc[d] += curr.calories || 0;
      return acc;
    }, {});
    const nutritionArray = Object.keys(dailyCalories).map(date => ({ date, calories: dailyCalories[date] }));

    const journalMoods = journal.map(j => ({
      date: new Date(j.created_at).toLocaleDateString("fr-FR"),
      mood: j.mood
    }));

    try {
      const res = await fetch("/api/trends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          metrics: summaryMetrics,
          tests: recentTests,
          nutrition: nutritionArray,
          journal: journalMoods
        })
      });
      const data = await res.json();

      if (user && data.analysis) {
        // ✅ Sauvegarde en BDD et ajout à l'historique
        const { data: newGen, error } = await supabase.from("ai_generations").insert({
          user_id: user.id,
          type: "trends",
          content: { analysis: data.analysis }
        }).select().single();

        if (!error && newGen) {
          setAnalysisHistories(prev => [
            { id: newGen.id, analysis: data.analysis, created_at: newGen.created_at },
            ...prev
          ]);
          setSelectedAnalysisIndex(0);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAI(false);
    }
  };

  // ✅ Suppression d'une analyse
  const deleteAnalysisHistory = async (id: string, index: number) => {
    if (!confirm("Supprimer cette analyse de l'historique ?")) return;

    const { error } = await supabase.from("ai_generations").delete().eq("id", id);
    if (error) {
      alert("Erreur lors de la suppression.");
      return;
    }

    setAnalysisHistories(prev => prev.filter(h => h.id !== id));
    
    if (index === selectedAnalysisIndex) {
      setSelectedAnalysisIndex(0);
    } else if (index < selectedAnalysisIndex) {
      setSelectedAnalysisIndex(prev => prev - 1);
    }
  };

  // --- CALCULS STATISTIQUES ---
  const avgRecovery = metrics.length > 0 
    ? Math.round(metrics.reduce((acc, curr) => acc + curr.recovery_score, 0) / metrics.length) 
    : 0;
    
  const avgSleep = metrics.length > 0 
    ? (metrics.reduce((acc, curr) => acc + curr.sleep_hours, 0) / metrics.length).toFixed(1) 
    : 0;

  const totalTests = measurements.length;
  const currentTestData = measurements.filter(m => m.metric_type === selectedTest);
  const lowerIsBetter = ["sprint", "run", "agility", "time"].some(k => selectedTest.toLowerCase().includes(k));
  const bestScore = currentTestData.length > 0 
    ? (lowerIsBetter ? Math.min(...currentTestData.map(m => m.value)) : Math.max(...currentTestData.map(m => m.value)))
    : null;

  const availableTests = Array.from(new Set(measurements.map(m => m.metric_type)));

  // Formatage pour les graphiques
  const recoveryData = metrics.map(m => ({
    date: new Date(m.date).toLocaleDateString("fr-FR", { day: '2-digit', month: 'short' }),
    score: m.recovery_score,
  }));

  const sleepData = metrics.map(m => ({
    date: new Date(m.date).toLocaleDateString("fr-FR", { day: '2-digit', month: 'short' }),
    heures: m.sleep_hours,
    fatigue: m.fatigue_level * 2,
  }));

  const performanceData = currentTestData.map(m => ({
    date: new Date(m.measured_at).toLocaleDateString("fr-FR", { day: '2-digit', month: 'short' }),
    value: m.value,
  }));

  const currentAnalysis = analysisHistories[selectedAnalysisIndex];

  if (loading) return <div className="p-8 text-white min-h-screen bg-[#020202]">Chargement de vos tendances...</div>;

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto bg-[#020202] min-h-screen space-y-4 md:space-y-6">
      
      <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-4 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white mb-1 flex items-center gap-2">
            Tendances & Analyses
          </h1>
          <p className="text-xs md:text-sm text-text-muted">Visualisez vos patterns et trouvez des corrélations cachées.</p>
        </div>
        <button 
          onClick={generateAnalysis} 
          disabled={loadingAI || metrics.length === 0}
          className="w-full md:w-auto justify-center flex items-center gap-2 bg-white text-black font-semibold rounded-xl px-4 md:px-5 py-2.5 text-xs md:text-sm hover:bg-gray-200 transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(255,255,255,0.1)] active:scale-95"
        >
          <Sparkles size={14} className="md:w-[18px] md:h-[18px]" /> 
          {loadingAI ? "Analyse croisée..." : analysisHistories.length > 0 ? "Regénérer l'analyse IA" : "Générer l'analyse IA"}
        </button>
      </header>

      {/* TOP METRICS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-surface border border-border rounded-2xl p-3 md:p-5 relative overflow-hidden group">
          <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-4">
            <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-recovery/10 flex items-center justify-center"><Heart size={14} className="text-recovery" /></div>
            <span className="text-[10px] md:text-xs font-semibold text-text-muted tracking-widest uppercase truncate">Récup. moy.</span>
          </div>
          <div className="flex items-baseline gap-1 relative z-10">
            <span className="text-2xl md:text-4xl font-bold text-white">{avgRecovery}</span>
            <span className="text-xs md:text-sm text-text-muted">%</span>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-surface border border-border rounded-2xl p-3 md:p-5 relative overflow-hidden group">
          <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-4">
            <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-sleep/10 flex items-center justify-center"><Moon size={14} className="text-sleep" /></div>
            <span className="text-[10px] md:text-xs font-semibold text-text-muted tracking-widest uppercase truncate">Sommeil moy.</span>
          </div>
          <div className="flex items-baseline gap-1 relative z-10">
            <span className="text-2xl md:text-4xl font-bold text-white">{avgSleep}</span>
            <span className="text-xs md:text-sm text-text-muted">h</span>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-surface border border-border rounded-2xl p-3 md:p-5 relative overflow-hidden group">
          <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-4">
            <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-strain/10 flex items-center justify-center"><Activity size={14} className="text-strain" /></div>
            <span className="text-[10px] md:text-xs font-semibold text-text-muted tracking-widest uppercase truncate">Tests total</span>
          </div>
          <div className="flex items-baseline gap-1 relative z-10">
            <span className="text-2xl md:text-4xl font-bold text-white">{totalTests}</span>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-surface border border-border rounded-2xl p-3 md:p-5 relative overflow-hidden group">
          <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-4">
            <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-yellow-500/10 flex items-center justify-center"><Zap size={14} className="text-yellow-500" /></div>
            <span className="text-[10px] md:text-xs font-semibold text-text-muted tracking-widest uppercase truncate">Meilleur score</span>
          </div>
          <div className="flex items-baseline gap-1 relative z-10">
            <span className="text-2xl md:text-4xl font-bold text-white">{bestScore ? bestScore : "--"}</span>
          </div>
        </motion.div>
      </div>

      {/* ✅ AI ANALYSIS BLOCK AVEC HISTORIQUE */}
      <AnimatePresence>
        {(currentAnalysis || loadingAI) && (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="bg-purple-500/5 border border-purple-500/20 rounded-3xl p-4 md:p-6 relative overflow-hidden mb-6 md:mb-8">
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 blur-3xl pointer-events-none rounded-full" />
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 relative z-10">
              <div className="flex items-center gap-2">
                <BrainCircuit size={18} className="text-purple-500 md:w-5 md:h-5" />
                <h2 className="text-[10px] md:text-sm font-semibold tracking-widest text-purple-400 uppercase">Analyse Croisée OMNIA</h2>
                {currentAnalysis && !loadingAI && (
                  <span className="text-[9px] md:text-[10px] text-text-muted flex items-center gap-1 ml-2">
                    <Clock size={10} /> {new Date(currentAnalysis.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                  </span>
                )}
              </div>
              
              {currentAnalysis && !loadingAI && (
                <div className="flex items-center gap-2">
                  {analysisHistories.length > 1 && (
                    <button 
                      onClick={() => setShowAnalysisHistory(!showAnalysisHistory)}
                      className="flex items-center gap-1.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] md:text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-purple-500/20 transition-colors"
                    >
                      <History size={12} />
                      {showAnalysisHistory ? "Masquer" : `Historique (${analysisHistories.length})`}
                    </button>
                  )}
                  <button
                    onClick={() => deleteAnalysisHistory(currentAnalysis.id, selectedAnalysisIndex)}
                    className="text-alert hover:bg-alert/10 p-1.5 md:p-2 rounded-lg transition-colors"
                    title="Supprimer cette analyse"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* ✅ Menu déroulant historique */}
            <AnimatePresence>
              {showAnalysisHistory && analysisHistories.length > 1 && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-4 relative z-10">
                  <div className="bg-background border border-border rounded-2xl p-2 max-h-48 overflow-y-auto custom-scrollbar flex flex-col gap-1">
                    {analysisHistories.map((history, index) => (
                      <div
                        key={history.id}
                        className={`flex items-center gap-1 rounded-xl transition-colors ${
                          selectedAnalysisIndex === index ? "bg-purple-500/20" : "hover:bg-surface-hover"
                        }`}
                      >
                        <button
                          onClick={() => { setSelectedAnalysisIndex(index); setShowAnalysisHistory(false); }}
                          className={`flex-1 text-left px-3 py-2 rounded-xl text-xs md:text-sm ${
                            selectedAnalysisIndex === index ? "text-purple-300 font-semibold" : "text-text-muted hover:text-white"
                          }`}
                        >
                          <span>Analyse du {new Date(history.created_at).toLocaleDateString("fr-FR")}</span>
                          {selectedAnalysisIndex === index && (
                            <span className="ml-2 text-[10px] bg-purple-500/30 px-2 py-0.5 rounded uppercase">Actuel</span>
                          )}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteAnalysisHistory(history.id, index); }}
                          className="text-alert hover:bg-alert/10 p-2 rounded-lg mr-1 shrink-0 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative z-10">
              {loadingAI ? (
                <p className="text-xs md:text-sm text-text-main animate-pulse">Recherche de corrélations...</p>
              ) : (
                <div className="text-xs md:text-sm text-text-main leading-relaxed">
                  <ReactMarkdown components={{
                    strong: ({node, ...props}) => <span className="font-bold text-white" {...props} />,
                    li: ({node, ...props}) => <li className="ml-4 list-disc marker:text-strain mb-1 md:mb-2" {...props} />,
                    p: ({node, ...props}) => <p className="mb-2 md:mb-4" {...props} />,
                  }}>
                    {currentAnalysis?.analysis || ""}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CHARTS GRID */}
      {metrics.length === 0 && measurements.length === 0 ? (
        <div className="bg-surface border border-border border-dashed rounded-3xl p-8 md:p-16 text-center">
          <TrendingUp size={48} className="mx-auto text-text-muted mb-4 md:mb-6 opacity-30 md:w-16 md:h-16" />
          <h3 className="text-lg md:text-xl font-semibold text-white mb-2">Pas encore assez de données</h3>
          <p className="text-xs md:text-sm text-text-muted">Faites des check-ins, enregistrez vos repas, vos tests et vos notes de journal pour voir vos tendances.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          
          {/* Graphique Récupération */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-surface border border-border rounded-3xl p-4 md:p-6">
            <div className="flex items-center gap-2 mb-4 md:mb-6">
              <Heart size={16} className="text-recovery md:w-[18px] md:h-[18px]" />
              <h2 className="text-[10px] md:text-sm font-semibold tracking-widest text-text-muted uppercase">Évolution de la récupération</h2>
            </div>
            <div className="h-56 md:h-72 w-full">
              {recoveryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={recoveryData} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRecovery" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00E676" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#00E676" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" stroke="#636366" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                    <YAxis stroke="#636366" fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} width={30} />
                    <Tooltip contentStyle={{ backgroundColor: '#111111', borderColor: '#222222', borderRadius: '8px', color: '#FFF', fontSize: '12px' }} />
                    <Area type="monotone" dataKey="score" name="Score" stroke="#00E676" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRecovery)" dot={{ r: 3 }} activeDot={{ r: 5, fill: '#FFF' }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <p className="text-center text-xs md:text-sm text-text-muted mt-20">Aucun check-in enregistré.</p>}
            </div>
          </motion.div>

          {/* Graphique Sommeil & Fatigue */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-surface border border-border rounded-3xl p-4 md:p-6">
            <div className="flex items-center gap-2 mb-4 md:mb-6">
              <Moon size={16} className="text-sleep md:w-[18px] md:h-[18px]" />
              <h2 className="text-[10px] md:text-sm font-semibold tracking-widest text-text-muted uppercase">Sommeil & Fatigue</h2>
            </div>
            <div className="h-56 md:h-72 w-full">
              {sleepData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sleepData} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                    <XAxis dataKey="date" stroke="#636366" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                    <YAxis stroke="#636366" fontSize={10} tickLine={false} axisLine={false} width={30} />
                    <Tooltip contentStyle={{ backgroundColor: '#111111', borderColor: '#222222', borderRadius: '8px', color: '#FFF', fontSize: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: 10, color: '#A1A1A6', paddingTop: 10 }} />
                    <Bar dataKey="heures" name="Sommeil (h)" fill="#AF52DE" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="fatigue" name="Fatigue (x2)" fill="#FFD60A" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-center text-xs md:text-sm text-text-muted mt-20">Aucun check-in enregistré.</p>}
            </div>
          </motion.div>

          {/* Graphique Performance Universel */}
          {measurements.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-surface border border-border rounded-3xl p-4 md:p-6 lg:col-span-2">
              
              <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 md:gap-0 mb-4 md:mb-6">
                <div className="flex items-center gap-2">
                  <Activity size={16} className="text-strain md:w-[18px] md:h-[18px]" />
                  <h2 className="text-[10px] md:text-sm font-semibold tracking-widest text-text-muted uppercase">Courbe de performance</h2>
                </div>
                
                {/* SÉLECTEUR DE TEST */}
                <div className="relative w-full md:w-auto">
                  <button 
                    onClick={() => setShowTestDropdown(!showTestDropdown)}
                    className="w-full md:w-auto flex items-center justify-between md:justify-start gap-2 bg-background border border-border rounded-lg px-3 md:px-4 py-2 text-[10px] md:text-sm text-white hover:bg-surface-hover transition-colors"
                  >
                    <span className="truncate">{selectedTest.replace(/_/g, ' ').toUpperCase()}</span>
                    <ChevronDown size={14} className={`text-text-muted transition-transform shrink-0 ${showTestDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {showTestDropdown && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowTestDropdown(false)} />
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute right-0 top-10 w-full md:w-56 bg-surface border border-border rounded-xl shadow-2xl z-50 overflow-hidden max-h-64 overflow-y-auto custom-scrollbar">
                          {availableTests.map(test => (
                            <button 
                              key={test} 
                              onClick={() => { setSelectedTest(test); setShowTestDropdown(false); }} 
                              className={`w-full text-left px-3 md:px-4 py-2 md:py-3 text-[10px] md:text-sm capitalize transition-colors flex items-center justify-between ${selectedTest === test ? 'bg-strain/10 text-strain font-medium' : 'text-text-muted hover:bg-surface-hover hover:text-white'}`}
                            >
                              <span className="truncate">{test.replace(/_/g, ' ')}</span>
                              {selectedTest === test && <Check size={12} className="shrink-0 ml-2" />}
                            </button>
                          ))}
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div className="h-64 md:h-80 w-full">
                {performanceData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={performanceData} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                      <XAxis dataKey="date" stroke="#636366" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                      <YAxis stroke="#636366" fontSize={10} tickLine={false} axisLine={false} domain={['dataMin - 1', 'dataMax + 1']} width={35} />
                      <Tooltip contentStyle={{ backgroundColor: '#111111', borderColor: '#222222', borderRadius: '8px', color: '#FFF', fontSize: '12px' }} />
                      <Line type="monotone" dataKey="value" name="Valeur" stroke="#0093E7" strokeWidth={2.5} dot={{ fill: '#0093E7', r: 3, strokeWidth: 2, stroke: '#020202' }} activeDot={{ r: 5, fill: '#FFF' }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center border border-dashed border-border rounded-xl">
                    <Activity size={24} className="text-text-muted mb-2 opacity-50 md:w-8 md:h-8" />
                    <p className="text-[10px] md:text-sm text-text-muted">Aucune donnée pour ce test sur cette période.</p>
                  </div>
                )}
              </div>

            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}