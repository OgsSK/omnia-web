// src/app/goals/page.tsx
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Target, Plus, Trash2, CheckCircle2, 
  TrendingUp, TrendingDown, Award, Clock, X, 
  Sparkles, BrainCircuit, Scale, Flame, Zap,
  History
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";

type Goal = {
  id: string;
  title: string;
  target_value: number;
  current_value: number;
  unit: string;
  direction: string;
  metric_type: string;
  ai_advice: string | null;
};

type SuggestionGeneration = {
  id: string;
  suggestions: any[];
  created_at: string;
};

const DEFAULT_TESTS = [
  { id: "sprint_10m", label: "Sprint 10m", unit: "s", direction: "lower_is_better", category: "Test" },
  { id: "sprint_20m", label: "Sprint 20m", unit: "s", direction: "lower_is_better", category: "Test" },
  { id: "run_5km", label: "Course 5km", unit: "min", direction: "lower_is_better", category: "Test" },
  { id: "squat_1rm", label: "Squat (1RM)", unit: "kg", direction: "higher_is_better", category: "Test" },
  { id: "weight", label: "Poids", unit: "kg", direction: "lower_is_better", category: "Santé" },
  { id: "calories", label: "Calories / jour", unit: "kcal", direction: "lower_is_better", category: "Nutrition" },
];

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [customTests, setCustomTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  // Formulaire
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("s");
  const [direction, setDirection] = useState("lower_is_better");
  const [metricType, setMetricType] = useState("sprint_20m");
  const [saving, setSaving] = useState(false);

  // ✅ IA & Historique
  const [suggestionHistories, setSuggestionHistories] = useState<SuggestionGeneration[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [showSuggestionsHistory, setShowSuggestionsHistory] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [analyzingGoalId, setAnalyzingGoalId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const [goalsRes, customRes, healthRes, measurementsRes, historyRes] = await Promise.all([
        supabase.from("goals").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("custom_tests").select("*").eq("user_id", user.id),
        supabase.from("health_metrics").select("weight").eq("user_id", user.id).not("weight", "is", null).order("date", { ascending: false }).limit(1),
        supabase.from("measurements").select("metric_type, value").eq("user_id", user.id).order("measured_at", { ascending: false }),
        // ✅ On récupère TOUT l'historique des suggestions
        supabase.from("ai_generations")
          .select("id, content, created_at")
          .eq("user_id", user.id)
          .eq("type", "goals_suggestion")
          .order("created_at", { ascending: false })
      ]);

      if (customRes.data) setCustomTests(customRes.data);

      if (goalsRes.data) {
        const latestWeight = healthRes.data?.[0]?.weight || 0;
        const allMeasurements = measurementsRes.data || [];

        const goalsWithRealValues = goalsRes.data.map(goal => {
          let realCurrentValue = 0;
          if (goal.metric_type === "weight") {
            realCurrentValue = latestWeight;
          } else {
            const match = allMeasurements.find(m => m.metric_type === goal.metric_type);
            if (match) realCurrentValue = match.value;
          }
          return { ...goal, current_value: realCurrentValue };
        });

        setGoals(goalsWithRealValues);
      }

      if (historyRes.data) {
        const formatted = historyRes.data
          .filter(h => h.content?.suggestions)
          .map(h => ({
            id: h.id,
            suggestions: h.content.suggestions,
            created_at: h.created_at
          }));
        setSuggestionHistories(formatted);
      }
    }
    setLoading(false);
  };

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const { error } = await supabase.from("goals").insert({
        user_id: user.id,
        title,
        target_value: parseFloat(target),
        current_value: 0,
        unit,
        direction,
        metric_type: metricType
      });

      if (!error) {
        if (metricType === "weight") {
          const meta = user.user_metadata || {};
          await supabase.auth.updateUser({
            data: {
              ...meta,
              target_weight: parseFloat(target).toString(),
              weight_goal: direction === "lower_is_better" ? "lose" : "gain",
            }
          });
        }
        setTitle(""); setTarget(""); setShowForm(false);
        fetchData();
      }
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if(confirm("Supprimer cet objectif ?")) {
      const goalToDelete = goals.find(g => g.id === id);
      await supabase.from("goals").delete().eq("id", id);
      
      if (goalToDelete?.metric_type === "weight") {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const meta = user.user_metadata || {};
          await supabase.auth.updateUser({
            data: { ...meta, target_weight: null, weight_goal: "maintain" }
          });
        }
      }
      fetchData();
    }
  };

  const getSuggestions = async () => {
    setLoadingSuggestions(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [measurements, health] = await Promise.all([
      supabase.from("measurements").select("metric_type, value").eq("user_id", user.id).order("measured_at", { ascending: false }).limit(5),
      supabase.from("health_metrics").select("weight").eq("user_id", user.id).order("date", { ascending: false }).limit(1)
    ]);

    try {
      const res = await fetch("/api/goals-suggestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userContext: "Athlète cherchant à progresser.",
          goals: goals.map(g => g.title),
          recentData: { measurements: measurements.data, health: health.data },
          requestType: "suggestion"
        })
      });
      const data = await res.json();

      if (data.suggestions && data.suggestions.length > 0) {
        // ✅ Sauvegarde en BDD et ajout dans l'historique en mémoire
        const { data: newHistory, error } = await supabase.from("ai_generations").insert({
          user_id: user.id,
          type: "goals_suggestion",
          content: { suggestions: data.suggestions }
        }).select().single();

        if (!error && newHistory) {
          setSuggestionHistories(prev => [
            { id: newHistory.id, suggestions: data.suggestions, created_at: newHistory.created_at },
            ...prev
          ]);
          setSelectedSuggestionIndex(0);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // ✅ Suppression d'une suggestion dans l'historique
  const deleteSuggestionHistory = async (id: string, index: number) => {
    if (!confirm("Supprimer cette génération de l'historique ?")) return;

    const { error } = await supabase.from("ai_generations").delete().eq("id", id);
    if (error) {
      alert("Erreur lors de la suppression.");
      return;
    }

    setSuggestionHistories(prev => prev.filter(h => h.id !== id));
    
    if (index === selectedSuggestionIndex) {
      setSelectedSuggestionIndex(0);
    } else if (index < selectedSuggestionIndex) {
      setSelectedSuggestionIndex(prev => prev - 1);
    }
  };

  const analyzeGoal = async (goal: Goal) => {
    setAnalyzingGoalId(goal.id);
    try {
      const res = await fetch("/api/goals-suggestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userContext: `Objectif : ${goal.title}. Actuel : ${goal.current_value}, Cible : ${goal.target_value}.`,
          goals: [goal],
          recentData: [],
          requestType: "analysis"
        })
      });
      const data = await res.json();
      const advice = data.analysis;

      await supabase.from("goals").update({ ai_advice: advice }).eq("id", goal.id);
      fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setAnalyzingGoalId(null);
    }
  };

  const handleTestChange = (testId: string) => {
    setMetricType(testId);
    const allTests = [...DEFAULT_TESTS, ...customTests];
    const selected = allTests.find(t => t.id === testId);
    if (selected) {
      setUnit(selected.unit);
      setDirection(selected.direction || (selected.lower_is_better ? "lower_is_better" : "higher_is_better"));
    }
  };

  const getProgress = (current: number, target: number, dir: string) => {
    if (current === 0) return 0;
    if (dir === "lower_is_better") {
      if (current <= target) return 100;
      const baseline = target * 1.3;
      const pct = ((baseline - current) / (baseline - target)) * 100;
      return Math.min(100, Math.max(0, pct));
    } else {
      const pct = (current / target) * 100;
      return Math.min(100, Math.max(0, pct));
    }
  };

  const totalGoals = goals.length;
  const completedGoals = goals.filter(g => getProgress(g.current_value, g.target_value, g.direction) >= 100).length;
  const inProgressGoals = totalGoals - completedGoals;

  const availableTests = [
    ...DEFAULT_TESTS, 
    ...customTests.map(t => ({ id: t.id, label: t.label, unit: t.unit, direction: t.lower_is_better ? "lower_is_better" : "higher_is_better", category: "Test" }))
  ];

  // Raccourci pour les suggestions actuelles
  const currentSuggestions = suggestionHistories[selectedSuggestionIndex]?.suggestions || [];

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto bg-[#020202] min-h-screen space-y-4 md:space-y-6">
      
      <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-4 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white mb-1">Objectifs</h1>
          <p className="text-xs md:text-sm text-text-muted">Définissez vos cibles et laissez OMNIA vous guider.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button onClick={getSuggestions} disabled={loadingSuggestions} className="flex-1 md:flex-none justify-center flex items-center gap-2 bg-purple-500/10 border border-purple-500/30 text-purple-400 font-semibold rounded-xl px-3 md:px-4 py-2 md:py-2.5 hover:bg-purple-500/20 transition-all text-[10px] md:text-sm">
            <Sparkles size={14} className="md:w-4 md:h-4" /> {loadingSuggestions ? "Analyse..." : "Suggérer par l'IA"}
          </button>
          <button onClick={() => setShowForm(true)} className="flex-1 md:flex-none justify-center flex items-center gap-2 bg-white text-black font-semibold rounded-xl px-3 md:px-5 py-2 md:py-2.5 hover:bg-gray-200 transition-all text-[10px] md:text-sm shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:scale-105 active:scale-95">
            <Plus size={14} className="md:w-4 md:h-4" /> Nouvel objectif
          </button>
        </div>
      </header>

      {/* ✅ BLOC SUGGESTIONS AVEC HISTORIQUE ET SUPPRESSION */}
      <AnimatePresence>
        {currentSuggestions.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="bg-purple-500/5 border border-purple-500/20 rounded-3xl p-4 md:p-6 mb-6 md:mb-8 relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 relative z-10">
              <div className="flex items-center gap-2">
                <BrainCircuit size={16} className="text-purple-500 md:w-[18px] md:h-[18px]" />
                <h2 className="text-[10px] md:text-sm font-semibold text-purple-400 uppercase tracking-widest">Suggestions d'OMNIA</h2>
              </div>
              
              <div className="flex items-center gap-2">
                {suggestionHistories.length > 1 && (
                  <button 
                    onClick={() => setShowSuggestionsHistory(!showSuggestionsHistory)}
                    className="flex items-center gap-1.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] md:text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-purple-500/20 transition-colors"
                  >
                    <History size={12} />
                    {showSuggestionsHistory ? "Masquer" : `Historique (${suggestionHistories.length})`}
                  </button>
                )}
                <button
                  onClick={() => deleteSuggestionHistory(suggestionHistories[selectedSuggestionIndex].id, selectedSuggestionIndex)}
                  className="text-alert hover:bg-alert/10 p-1.5 md:p-2 rounded-lg transition-colors"
                  title="Supprimer cette génération"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Menu déroulant historique */}
            <AnimatePresence>
              {showSuggestionsHistory && suggestionHistories.length > 1 && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-4 relative z-10">
                  <div className="bg-background border border-border rounded-2xl p-2 max-h-48 overflow-y-auto custom-scrollbar flex flex-col gap-1">
                    {suggestionHistories.map((history, index) => (
                      <div
                        key={history.id}
                        className={`flex items-center gap-1 rounded-xl transition-colors ${
                          selectedSuggestionIndex === index ? "bg-purple-500/20" : "hover:bg-surface-hover"
                        }`}
                      >
                        <button
                          onClick={() => { setSelectedSuggestionIndex(index); setShowSuggestionsHistory(false); }}
                          className={`flex-1 text-left px-3 py-2 rounded-xl text-xs md:text-sm ${
                            selectedSuggestionIndex === index ? "text-purple-300 font-semibold" : "text-text-muted hover:text-white"
                          }`}
                        >
                          <span>Génération du {new Date(history.created_at).toLocaleDateString("fr-FR")}</span>
                          {selectedSuggestionIndex === index && (
                            <span className="ml-2 text-[10px] bg-purple-500/30 px-2 py-0.5 rounded uppercase">Actuel</span>
                          )}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteSuggestionHistory(history.id, index); }}
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 relative z-10">
              {currentSuggestions.map((s, i) => (
                <div key={i} className="bg-background border border-border rounded-xl md:rounded-2xl p-3 md:p-4 hover:border-purple-500/50 transition-colors cursor-pointer" onClick={() => {
                  setTitle(s.title); setTarget(s.target); setMetricType(s.metric_type); setUnit(s.unit); setDirection(s.direction);
                  setShowForm(true);
                }}>
                  <p className="font-semibold text-white text-xs md:text-sm mb-1">{s.title}</p>
                  <p className="text-[10px] md:text-xs text-text-muted">Cible : {s.target} {s.unit}</p>
                  <p className="text-[9px] md:text-[10px] text-purple-400 mt-1.5 md:mt-2">Cliquer pour ajouter</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-surface border border-border rounded-2xl p-3 md:p-5">
          <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-4">
            <Target size={14} className="text-strain md:w-4 md:h-4" />
            <span className="text-[10px] md:text-xs font-semibold text-text-muted uppercase truncate">Total</span>
          </div>
          <span className="text-2xl md:text-4xl font-bold text-white">{totalGoals}</span>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-surface border border-border rounded-2xl p-3 md:p-5">
          <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-4">
            <CheckCircle2 size={14} className="text-recovery md:w-4 md:h-4" />
            <span className="text-[10px] md:text-xs font-semibold text-text-muted uppercase truncate">Atteints</span>
          </div>
          <span className="text-2xl md:text-4xl font-bold text-white">{completedGoals}</span>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="col-span-2 md:col-span-1 bg-surface border border-border rounded-2xl p-3 md:p-5">
          <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-4">
            <Clock size={14} className="text-purple-500 md:w-4 md:h-4" />
            <span className="text-[10px] md:text-xs font-semibold text-text-muted uppercase truncate">En cours</span>
          </div>
          <span className="text-2xl md:text-4xl font-bold text-white">{inProgressGoals}</span>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
        {loading ? <p className="text-text-muted text-xs md:text-sm col-span-full">Chargement...</p> : goals.length === 0 ? (
          <div className="col-span-full bg-surface border border-border border-dashed rounded-3xl p-8 md:p-16 text-center">
            <Target size={48} className="text-text-muted mb-4 md:mb-6 opacity-30 mx-auto md:w-16 md:h-16" />
            <h3 className="text-lg md:text-xl font-semibold text-white mb-2">Aucun objectif</h3>
            <p className="text-xs md:text-sm text-text-muted mb-4 md:mb-6">Fixez-vous un défi mesurable ou laissez l'IA vous suggérer des objectifs.</p>
            <button onClick={() => setShowForm(true)} className="bg-white text-black font-semibold rounded-xl px-5 md:px-6 py-2.5 md:py-3 text-xs md:text-sm hover:bg-gray-200 transition-colors">Créer un objectif</button>
          </div>
        ) : (
          <AnimatePresence>
            {goals.map((goal) => {
              const progress = getProgress(goal.current_value, goal.target_value, goal.direction);
              const isCompleted = progress >= 100;
              const testLabel = availableTests.find(t => t.id === goal.metric_type)?.label || goal.metric_type;
              const category = availableTests.find(t => t.id === goal.metric_type)?.category || "Test";

              return (
                <motion.div key={goal.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-surface border border-border rounded-3xl p-4 md:p-6 relative group overflow-hidden flex flex-col justify-between">
                  
                  <div className={`absolute top-0 right-0 w-32 h-32 blur-3xl opacity-20 pointer-events-none rounded-full ${isCompleted ? 'bg-recovery' : 'bg-strain'}`} />

                  <div className="flex justify-between items-start mb-4 md:mb-6 relative z-10">
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className={`w-8 h-8 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center ${isCompleted ? 'bg-recovery/10 text-recovery' : 'bg-strain/10 text-strain'}`}>
                        {isCompleted ? <Award size={16} className="md:w-6 md:h-6" /> : category === "Santé" ? <Scale size={16} className="md:w-6 md:h-6" /> : category === "Nutrition" ? <Flame size={16} className="md:w-6 md:h-6" /> : <Target size={16} className="md:w-6 md:h-6" />}
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm md:text-lg text-white leading-tight line-clamp-2">{goal.title}</h3>
                        <span className="text-[9px] md:text-[10px] bg-background border border-border px-1.5 md:px-2 py-0.5 rounded-md text-text-muted uppercase tracking-wider mt-1 inline-block">{testLabel}</span>
                      </div>
                    </div>
                    <button onClick={() => handleDelete(goal.id)} className="text-text-muted hover:text-alert opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1.5 md:p-2 bg-background rounded-lg">
                      <Trash2 size={14} className="md:w-4 md:h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-3 md:gap-6 mb-4 md:mb-6 relative z-10">
                    <div className="relative w-14 h-14 md:w-20 md:h-20 flex items-center justify-center shrink-0">
                      <svg viewBox="0 0 80 80" className="w-full h-full transform -rotate-90">
                        <circle cx="40" cy="40" r="34" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-background" />
                        <motion.circle cx="40" cy="40" r="34" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray="213" initial={{ strokeDashoffset: 213 }} animate={{ strokeDashoffset: 213 - (213 * progress) / 100 }} transition={{ duration: 1 }} strokeLinecap="round" className={isCompleted ? "text-recovery" : "text-strain"} />
                      </svg>
                      <span className={`absolute text-xs md:text-lg font-bold ${isCompleted ? "text-recovery" : "text-white"}`}>{Math.round(progress)}%</span>
                    </div>
                    <div className="flex-1 space-y-2 md:space-y-3">
                      <div>
                        <p className="text-[9px] md:text-[10px] text-text-muted uppercase mb-0.5 md:mb-1">Actuel</p>
                        <p className="text-base md:text-xl font-bold text-white">{goal.current_value} <span className="text-[10px] md:text-sm text-text-muted">{goal.unit}</span></p>
                      </div>
                      <div>
                        <p className="text-[9px] md:text-[10px] text-text-muted uppercase mb-0.5 md:mb-1">Cible</p>
                        <p className="text-[10px] md:text-sm font-semibold text-text-muted flex items-center gap-1">
                          {goal.direction === 'lower_is_better' ? <TrendingDown size={10} className="text-strain md:w-3 md:h-3"/> : <TrendingUp size={10} className="text-recovery md:w-3 md:h-3"/>}
                          {goal.target_value} {goal.unit}
                        </p>
                      </div>
                    </div>
                  </div>

                  {goal.ai_advice ? (
                    <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-2.5 md:p-3 mb-3 md:mb-4 relative z-10">
                      <div className="text-[10px] md:text-xs text-purple-300 italic line-clamp-3 md:line-clamp-none">
                        <ReactMarkdown components={{
                          strong: ({node, ...props}) => <span className="font-bold text-purple-200" {...props} />,
                          p: ({node, ...props}) => <p className="mb-1" {...props} />,
                        }}>
                          {goal.ai_advice || ""}
                        </ReactMarkdown>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => analyzeGoal(goal)} disabled={analyzingGoalId === goal.id} className="w-full mb-3 md:mb-4 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-[10px] md:text-xs font-semibold rounded-xl py-1.5 md:py-2 transition-colors flex items-center justify-center gap-1 relative z-10">
                      <Sparkles size={10} className="md:w-3 md:h-3" /> {analyzingGoalId === goal.id ? "Analyse..." : "Conseil IA"}
                    </button>
                  )}

                  <div className="w-full h-1.5 bg-background rounded-full overflow-hidden relative z-10">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 1 }} className={`h-full rounded-full ${isCompleted ? 'bg-recovery' : 'bg-strain'}`} />
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      <AnimatePresence>
        {showForm && (
          <div onClick={() => setShowForm(false)} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div onClick={(e) => e.stopPropagation()} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-surface border border-border rounded-3xl p-5 md:p-8 w-full max-w-lg relative overflow-hidden max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4 md:mb-6 relative z-10">
                <h2 className="text-lg md:text-xl font-bold text-white">Nouvel Objectif</h2>
                <button onClick={() => setShowForm(false)} className="text-text-muted hover:text-white bg-background p-1.5 md:p-2 rounded-lg"><X size={18} className="md:w-5 md:h-5" /></button>
              </div>

              <form onSubmit={handleAddGoal} className="space-y-4 md:space-y-5 relative z-10">
                <div>
                  <label className="block text-[10px] md:text-xs font-semibold text-text-muted uppercase mb-1 md:mb-2">Titre de l'objectif</label>
                  <input type="text" value={title} onChange={e => setTitle(e.target.value)} required placeholder="ex: Perdre 2kg" className="w-full bg-background border border-border rounded-xl px-3 md:px-4 py-2 md:py-3 text-xs md:text-sm text-white focus:outline-none focus:border-strain" />
                </div>

                <div className="grid grid-cols-2 gap-3 md:gap-4">
                  <div>
                    <label className="block text-[10px] md:text-xs font-semibold text-text-muted uppercase mb-1 md:mb-2">Cible</label>
                    <div className="flex gap-1 md:gap-2">
                      <input type="number" step="0.01" value={target} onChange={e => setTarget(e.target.value)} required className="w-full bg-background border border-border rounded-xl px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm text-white focus:outline-none" />
                      <input type="text" value={unit} readOnly className="w-12 md:w-20 bg-surface border border-border rounded-xl px-1 md:px-3 text-[10px] md:text-sm text-text-muted text-center" />
                    </div>
                    {metricType === "weight" && (
                      <p className="text-[9px] text-text-muted mt-1 leading-tight">
                        Mettez le <strong>poids final</strong> (ex: 73), pas la perte (ex: 2).
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-[10px] md:text-xs font-semibold text-text-muted uppercase mb-1 md:mb-2">Catégorie</label>
                    <select value={metricType} onChange={e => handleTestChange(e.target.value)} className="w-full bg-background border border-border rounded-xl px-2 md:px-4 py-2 md:py-3 text-[10px] md:text-sm text-white focus:outline-none">
                      {availableTests.map(test => <option key={test.id} value={test.id}>{test.label}</option>)}
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className="block text-[10px] md:text-xs font-semibold text-text-muted uppercase mb-1 md:mb-2">Sens de progression</label>
                  <div className="grid grid-cols-2 gap-2 bg-background border border-border rounded-xl p-1">
                    <button type="button" onClick={() => setDirection("lower_is_better")} className={`py-1.5 md:py-2 text-[10px] md:text-xs font-semibold rounded-lg ${direction === "lower_is_better" ? "bg-strain text-white" : "text-text-muted"}`}>Plus bas = Mieux</button>
                    <button type="button" onClick={() => setDirection("higher_is_better")} className={`py-1.5 md:py-2 text-[10px] md:text-xs font-semibold rounded-lg ${direction === "higher_is_better" ? "bg-recovery text-white" : "text-text-muted"}`}>Plus haut = Mieux</button>
                  </div>
                </div>

                <div className="pt-2 md:pt-4 flex justify-end gap-2 md:gap-3">
                  <button type="button" onClick={() => setShowForm(false)} className="px-3 md:px-5 py-2 md:py-3 text-[10px] md:text-sm font-semibold text-text-muted hover:text-white">Annuler</button>
                  <button type="submit" disabled={saving} className="bg-white text-black font-semibold rounded-xl px-4 md:px-6 py-2 md:py-3 text-[10px] md:text-sm hover:bg-gray-200 disabled:opacity-50">{saving ? "Création..." : "Créer"}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}