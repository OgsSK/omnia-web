// src/app/football/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { 
  Timer, Play, Square, RotateCcw, Save, 
  Trophy, TrendingDown, TrendingUp, History, 
  Activity, Target, Zap, ChevronRight, CheckCircle2,
  Dumbbell, Gauge, ArrowUpRight, Plus, X,
  BrainCircuit, Loader2, Sparkles,
  Pencil, Trash2, Check, Clock
} from "lucide-react";
import { SprintChart } from "@/components/SprintChart";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";

type Measurement = {
  id: string;
  value: number;
  notes: string;
  measured_at: string;
};

type Goal = {
  id: string;
  title: string;
  target_value: number;
  current_value: number;
  unit: string;
};

type TestType = {
  id: string;
  label: string;
  unit: string;
  type: string;
  desc: string;
  icon: any;
  lowerIsBetter: boolean;
  category: string;
  isCustom?: boolean;
};

type AnalysisHistory = {
  id: string;
  analysis: string;
  created_at: string;
};

const DEFAULT_TESTS: TestType[] = [
  { id: "sprint_10m", label: "Sprint 10m", unit: "s", type: "stopwatch", desc: "Explosivité / Démarrage", icon: Zap, lowerIsBetter: true, category: "Vitesse & Explosivité" },
  { id: "sprint_20m", label: "Sprint 20m", unit: "s", type: "stopwatch", desc: "Accélération", icon: Timer, lowerIsBetter: true, category: "Vitesse & Explosivité" },
  { id: "agility_5_10_5", label: "Agilité 5-10-5", unit: "s", type: "stopwatch", desc: "Changements de direction", icon: Activity, lowerIsBetter: true, category: "Vitesse & Explosivité" },
  { id: "run_5km", label: "Course 5km", unit: "min", type: "manual_time", desc: "Endurance fondamentale", icon: Gauge, lowerIsBetter: true, category: "Endurance" },
  { id: "vma", label: "VMA (Vitesse Max Aérobie)", unit: "km/h", type: "manual_value", desc: "Capacité cardio", icon: Activity, lowerIsBetter: false, category: "Endurance" },
  { id: "squat_1rm", label: "Squat (1RM)", unit: "kg", type: "manual_value", desc: "Force maximale", icon: Dumbbell, lowerIsBetter: false, category: "Force & Puissance" },
  { id: "vertical_jump", label: "Détente Verticale", unit: "cm", type: "manual_value", desc: "Puissance explosive", icon: ArrowUpRight, lowerIsBetter: false, category: "Force & Puissance" },
];

export default function PerformancePage() {
  const [customTests, setCustomTests] = useState<TestType[]>([]);
  const [selectedTest, setSelectedTest] = useState<TestType>(DEFAULT_TESTS[1]);

  // Modale d'ajout de test
  const [showAddTestModal, setShowAddTestModal] = useState(false);
  const [newTestName, setNewTestName] = useState("");
  const [newTestCategory, setNewTestCategory] = useState("");
  const [newTestUnit, setNewTestUnit] = useState("s");
  const [newTestType, setNewTestType] = useState("manual_value");
  const [newTestLowerBetter, setNewTestLowerBetter] = useState(true);
  const [savingTest, setSavingTest] = useState(false);

  // États Chronomètre
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  // États Saisie Manuelle
  const [manualValue, setManualValue] = useState("");
  const [manualMinutes, setManualMinutes] = useState("");
  const [manualSeconds, setManualSeconds] = useState("");
  const [isManualMode, setIsManualMode] = useState(false);

  // États Données
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [history, setHistory] = useState<Measurement[]>([]);
  const [sprintGoal, setSprintGoal] = useState<Goal | null>(null);
  const [fetching, setFetching] = useState(true);

  // Analyse Approfondie IA
  const [analysisHistories, setAnalysisHistories] = useState<AnalysisHistory[]>([]);
  const [selectedAnalysisIndex, setSelectedAnalysisIndex] = useState(0);
  const [showAnalysisHistory, setShowAnalysisHistory] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);

  // Édition / Suppression d'une mesure de l'historique
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editMinutes, setEditMinutes] = useState("");
  const [editSeconds, setEditSeconds] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    fetchCustomTests();
  }, []);

  useEffect(() => {
    fetchData();
    resetTimer();
    cancelEdit();
    setDeletingId(null);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [selectedTest]);

  const fetchCustomTests = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from("custom_tests").select("*").eq("user_id", user.id);
      if (data) {
        const mapped = data.map(t => ({
          ...t,
          icon: Activity,
          desc: "Test personnalisé",
          isCustom: true
        }));
        setCustomTests(mapped);
      }
    }
  };

  const fetchData = async () => {
    setFetching(true);
    setAnalysisHistories([]); // Reset quand on change de test
    
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const [sprintRes, goalRes, analysesRes] = await Promise.all([
        supabase.from("measurements").select("*").eq("user_id", user.id).eq("metric_type", selectedTest.id).order("measured_at", { ascending: true }),
        supabase.from("goals").select("*").eq("user_id", user.id).eq("metric_type", selectedTest.id).order("created_at", { ascending: false }).limit(1),
        // ✅ Récupérer TOUT l'historique des analyses pour ce test
        supabase.from("ai_generations")
          .select("id, content, created_at")
          .eq("user_id", user.id)
          .eq("type", "football_analysis")
          .order("created_at", { ascending: false })
      ]);

      if (sprintRes.data) setHistory(sprintRes.data);
      if (goalRes.data && goalRes.data.length > 0) setSprintGoal(goalRes.data[0]);
      else setSprintGoal(null);

      if (analysesRes.data) {
        // Filtrer sur le testId spécifique
        const formatted = analysesRes.data
          .filter(a => a.content?.testId === selectedTest.id && a.content?.analysis)
          .map(a => ({
            id: a.id,
            analysis: a.content.analysis,
            created_at: a.created_at
          }));
        setAnalysisHistories(formatted);
        setSelectedAnalysisIndex(0);
      }
    }
    setFetching(false);
  };

  const generateDeepAnalysis = async () => {
    if (history.length < 2) return;
    setLoadingAnalysis(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoadingAnalysis(false); return; }

    const today = new Date().toISOString().split("T")[0];

    const [metricRes, injuriesRes, nutritionRes] = await Promise.all([
      supabase.from("daily_metrics").select("*").eq("user_id", user.id).eq("date", today).maybeSingle(),
      supabase.from("injuries").select("*").eq("user_id", user.id).eq("status", "active"),
      supabase.from("meal_logs").select("calories").eq("user_id", user.id).eq("date", today)
    ]);

    const todayMetric = metricRes.data;
    const activeInjuries = injuriesRes.data?.map(i => i.body_part).join(", ") || "Aucune";
    const todayCalories = nutritionRes.data?.reduce((acc, curr) => acc + (curr.calories || 0), 0) || 0;

    const last5Tests = history.slice(-5).map(h => 
      `${formatValue(h.value)}${selectedTest.unit} le ${new Date(h.measured_at).toLocaleDateString("fr-FR")}`
    ).join(" | ");

    // ✅ Ajout d'espaces pour un meilleur rendu (80 % au lieu de 80%)
    const contextPrompt = `
    TEST : ${selectedTest.label}
    Historique des 5 derniers tests : ${last5Tests}
    Tendance : ${isPositive ? "En amélioration" : "En baisse"}.
    
    ÉTAT DU JOUR :
    - Récupération : ${todayMetric ? todayMetric.recovery_score + " %" : "Non renseignée"}.
    - Sommeil : ${todayMetric ? todayMetric.sleep_hours + " h" : "Non renseigné"}.
    - Calories consommées aujourd'hui : ${todayCalories} kcal.
    - Blessures actives : ${activeInjuries}.
    `;

    try {
      const res = await fetch("/api/deep-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // ✅ Demande à l'IA de structurer sa réponse pour un meilleur affichage
          question: `Analyse ma performance sur le ${selectedTest.label}. Pourquoi est-ce que je progresse ou stagne ? Y a-t-il un lien avec mon sommeil, ma nutrition ou mes blessures ? Structure ta réponse en paragraphes distincts et aérés pour une meilleure lisibilité.`,
          userContext: "Analyse de performance croisée.",
          historicalData: contextPrompt
        })
      });
      const data = await res.json();
      
      if (data.analysis) {
        // ✅ Sauvegarde en BDD et ajout à l'historique
        const { data: newGen, error } = await supabase.from("ai_generations").insert({
          user_id: user.id,
          type: "football_analysis",
          content: { testId: selectedTest.id, analysis: data.analysis }
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
      setLoadingAnalysis(false);
    }
  };

  // ✅ Suppression d'une analyse de l'historique
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

  const handleCreateTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTest(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const { error } = await supabase.from("custom_tests").insert({
        user_id: user.id,
        category: newTestCategory,
        label: newTestName,
        unit: newTestUnit,
        type: newTestType,
        lower_is_better: newTestLowerBetter
      });

      if (!error) {
        await fetchCustomTests();
        setShowAddTestModal(false);
        setNewTestName("");
        setNewTestCategory("");
      }
    }
    setSavingTest(false);
  };

  const startTimer = () => {
    setIsRunning(true);
    startTimeRef.current = Date.now() - elapsedTime;
    timerRef.current = setInterval(() => {
      setElapsedTime(Date.now() - startTimeRef.current);
    }, 10);
  };

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRunning(false);
  };

  const resetTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRunning(false);
    setElapsedTime(0);
    setCountdown(null);
    setManualValue("");
    setManualMinutes("");
    setManualSeconds("");
    setIsManualMode(false);
  };

  const handleStartClick = () => {
    if (countdown !== null || isRunning) return;
    setCountdown(3);
    let count = 3;
    const interval = setInterval(() => {
      count -= 1;
      if (count > 0) setCountdown(count);
      else if (count === 0) setCountdown(0);
      else {
        clearInterval(interval);
        setCountdown(null);
        startTimer();
      }
    }, 1000);
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const hundredths = Math.floor((ms % 1000) / 10);
    return `${seconds}.${hundredths.toString().padStart(2, "0")}`;
  };

  const handleSave = async () => {
    setLoading(true);
    let finalValue = 0;
    if (selectedTest.type === "stopwatch" && !isManualMode) {
      finalValue = parseFloat(formatTime(elapsedTime));
    } else if (selectedTest.type === "manual_time") {
      finalValue = (parseInt(manualMinutes) * 60) + parseFloat(manualSeconds || "0");
    } else {
      finalValue = parseFloat(manualValue);
    }

    if (!finalValue || finalValue <= 0) {
      alert("Veuillez entrer une valeur valide supérieure à 0.");
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { error } = await supabase.from("measurements").insert({
      user_id: user.id,
      metric_type: selectedTest.id,
      value: finalValue,
      notes: notes,
    });

    if (!error) {
      setSuccess(true);
      setNotes("");
      resetTimer();
      fetchData();
      setTimeout(() => setSuccess(false), 3000);
    } else {
      console.error("[football] insert:", error);
    }
    setLoading(false);
  };

  const startEdit = (m: Measurement) => {
    setEditingId(m.id);
    setEditNotes(m.notes ?? "");
    if (selectedTest.type === "manual_time") {
      const mins = Math.floor(m.value / 60);
      const secs = Math.round(m.value % 60);
      setEditMinutes(String(mins));
      setEditSeconds(String(secs));
      setEditValue("");
    } else {
      setEditValue(String(m.value));
      setEditMinutes("");
      setEditSeconds("");
    }
    setDeletingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
    setEditMinutes("");
    setEditSeconds("");
    setEditNotes("");
  };

  const handleUpdate = async (id: string) => {
    let finalValue = 0;
    if (selectedTest.type === "manual_time") {
      finalValue = (parseInt(editMinutes || "0") * 60) + parseFloat(editSeconds || "0");
    } else {
      finalValue = parseFloat(editValue);
    }

    if (!finalValue || finalValue <= 0) return;

    setBusyId(id);
    const { error } = await supabase
      .from("measurements")
      .update({ value: finalValue, notes: editNotes })
      .eq("id", id);

    if (error) {
      console.error("[football] update:", error);
    } else {
      setHistory(prev =>
        prev.map(m => m.id === id ? { ...m, value: finalValue, notes: editNotes } : m)
      );
      cancelEdit();
    }
    setBusyId(null);
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    const { error } = await supabase.from("measurements").delete().eq("id", id);

    if (error) {
      console.error("[football] delete:", error);
    } else {
      setHistory(prev => prev.filter(m => m.id !== id));
      setDeletingId(null);
    }
    setBusyId(null);
  };

  const values = history.map(h => h.value);
  const bestTime = values.length > 0 ? (selectedTest.lowerIsBetter ? Math.min(...values) : Math.max(...values)) : null;
  const lastTime = history.length > 0 ? history[history.length - 1].value : null;
  const prevTime = history.length > 1 ? history[history.length - 2].value : null;
  const avgTime = values.length > 0 ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2) : null;
  
  let trendDiff = 0;
  let isPositive = true;
  if (lastTime && prevTime) {
    trendDiff = lastTime - prevTime;
    isPositive = selectedTest.lowerIsBetter ? trendDiff <= 0 : trendDiff >= 0;
  }

  const goalProgress = sprintGoal ? Math.min(100, Math.round((sprintGoal.current_value / sprintGoal.target_value) * 100)) : 0;

  const formatValue = (val: number) => {
    if (selectedTest.type === "manual_time") {
      const m = Math.floor(val / 60);
      const s = Math.floor(val % 60);
      return `${m}:${s.toString().padStart(2, '0')}`;
    }
    return val.toFixed(2);
  };

  const allTests = [...DEFAULT_TESTS, ...customTests];
  const categories = Array.from(new Set(allTests.map(t => t.category)));

  const currentAnalysis = analysisHistories[selectedAnalysisIndex];

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto bg-[#020202] min-h-screen space-y-4 md:space-y-6">
      
      <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-4 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white mb-1 flex items-center gap-2">
            Performance <span className="text-[10px] md:text-xs bg-strain/20 text-strain px-2 py-1 rounded-md uppercase tracking-wider font-semibold">Laboratoire</span>
          </h1>
          <p className="text-xs md:text-sm text-text-muted">Évaluez vos capacités athlétiques globales.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button onClick={() => setShowAddTestModal(true)} className="flex-1 md:flex-none justify-center flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-2 text-xs md:text-sm text-white hover:bg-surface-hover transition-colors">
            <Plus size={14} className="text-strain" /> Créer un test
          </button>
          <Link href="/goals" className="flex-1 md:flex-none justify-center flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-2 text-xs md:text-sm text-white hover:bg-surface-hover transition-colors">
            <Target size={14} className="text-strain" /> Objectifs
          </Link>
        </div>
      </header>

      {/* CATALOGUE DES TESTS DYNAMIQUE */}
      <div className="space-y-3 md:space-y-4 mb-4 md:mb-6">
        {categories.map((catName) => {
          const testsInCat = allTests.filter(t => t.category === catName);
          return (
            <div key={catName}>
              <h3 className="text-[10px] md:text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">{catName}</h3>
              <div className="flex flex-wrap gap-1.5 md:gap-2">
                {testsInCat.map((test) => (
                  <button
                    key={test.id}
                    onClick={() => setSelectedTest(test)}
                    className={`flex items-center gap-1.5 md:gap-2 px-3 py-2 md:px-4 md:py-2.5 rounded-xl border text-[10px] md:text-sm font-medium transition-all ${
                      selectedTest.id === test.id 
                        ? "bg-strain/10 border-strain/30 text-strain shadow-[0_0_15px_rgba(0,147,231,0.15)]" 
                        : "bg-surface border-border text-text-muted hover:bg-surface-hover hover:text-white"
                    }`}
                  >
                    <test.icon size={14} className="md:w-4 md:h-4" />
                    {test.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* TOP METRICS */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-surface border border-border rounded-2xl p-3 md:p-5 relative overflow-hidden group">
          <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-4">
            <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-recovery/10 flex items-center justify-center"><Trophy size={14} className="text-recovery" /></div>
            <span className="text-[10px] md:text-xs font-semibold text-text-muted tracking-widest uppercase truncate">Record</span>
          </div>
          <div className="flex items-baseline gap-1 relative z-10">
            <span className="text-2xl md:text-4xl font-bold text-white">{bestTime ? formatValue(bestTime) : "--"}</span>
            <span className="text-xs md:text-sm text-text-muted">{selectedTest.unit}</span>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-surface border border-border rounded-2xl p-3 md:p-5 relative overflow-hidden group">
          <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-4">
            <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-strain/10 flex items-center justify-center"><Activity size={14} className="text-strain" /></div>
            <span className="text-[10px] md:text-xs font-semibold text-text-muted tracking-widest uppercase truncate">Moyenne</span>
          </div>
          <div className="flex items-baseline gap-1 relative z-10">
            <span className="text-2xl md:text-4xl font-bold text-white">{avgTime ? (selectedTest.type === 'manual_time' ? formatValue(parseFloat(avgTime)) : avgTime) : "--"}</span>
            <span className="text-xs md:text-sm text-text-muted">{selectedTest.unit}</span>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-surface border border-border rounded-2xl p-3 md:p-5 relative overflow-hidden group">
          <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-4">
            <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-purple-500/10 flex items-center justify-center"><Zap size={14} className="text-purple-500" /></div>
            <span className="text-[10px] md:text-xs font-semibold text-text-muted tracking-widest uppercase truncate">Dernier</span>
          </div>
          <div className="flex items-baseline justify-between relative z-10">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl md:text-4xl font-bold text-white">{lastTime ? formatValue(lastTime) : "--"}</span>
              <span className="text-xs md:text-sm text-text-muted">{selectedTest.unit}</span>
            </div>
            {lastTime && prevTime && (
              <span className={`text-[10px] md:text-xs font-bold flex items-center gap-1 ${isPositive ? 'text-recovery' : 'text-alert'}`}>
                {isPositive ? <TrendingUp size={10} className="md:w-3.5 md:h-3.5" /> : <TrendingDown size={10} className="md:w-3.5 md:h-3.5" />} 
                {selectedTest.type === 'manual_time' ? Math.abs(trendDiff).toFixed(0) + 's' : Math.abs(trendDiff).toFixed(2)}
              </span>
            )}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-surface border border-border rounded-2xl p-3 md:p-5 relative overflow-hidden group">
          <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-4">
            <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-blue-500/10 flex items-center justify-center"><History size={14} className="text-blue-500" /></div>
            <span className="text-[10px] md:text-xs font-semibold text-text-muted tracking-widest uppercase truncate">Volume</span>
          </div>
          <div className="flex items-baseline gap-1 relative z-10">
            <span className="text-2xl md:text-4xl font-bold text-white">{history.length}</span>
            <span className="text-xs md:text-sm text-text-muted">tests</span>
          </div>
        </motion.div>
      </div>

      {/* ZONE DE SAISIE DYNAMIQUE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 mb-4 md:mb-6">
        
        <motion.div 
          key={selectedTest.id}
          initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
          className="lg:col-span-7 bg-surface border border-border rounded-3xl p-4 md:p-8 relative overflow-hidden flex flex-col items-center justify-center min-h-[350px] md:min-h-[450px]"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-strain/5 via-transparent to-transparent pointer-events-none" />

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between w-full mb-6 md:mb-8 relative z-10 gap-3 md:gap-0">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-strain/10 flex items-center justify-center">
                <selectedTest.icon className="text-strain" size={16} />
              </div>
              <div>
                <h2 className="text-sm md:text-lg font-semibold text-white">{selectedTest.label}</h2>
                <p className="text-[10px] md:text-xs text-text-muted">{selectedTest.desc}</p>
              </div>
            </div>
            
            {selectedTest.type === "stopwatch" && (
              <button onClick={() => setIsManualMode(!isManualMode)} className="w-full md:w-auto text-[10px] md:text-xs text-text-muted hover:text-white border border-border px-3 py-1.5 rounded-lg transition-colors bg-background">
                {isManualMode ? "Utiliser le chrono" : "Saisie manuelle"}
              </button>
            )}
          </div>

          {/* AFFICHAGE DU CHRONOMÈTRE */}
          {selectedTest.type === "stopwatch" && !isManualMode && (
            <>
              <div className="relative flex items-center justify-center mb-8 md:mb-10 w-48 h-48 md:w-64 md:h-64">
                <svg viewBox="0 0 256 256" className="absolute inset-0 w-full h-full transform -rotate-90">
                  <circle cx="128" cy="128" r="120" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-border/30" />
                  <circle cx="128" cy="128" r="120" stroke="currentColor" strokeWidth="4" fill="transparent" 
                    strokeDasharray="754" 
                    strokeDashoffset={isRunning ? 754 - (754 * (elapsedTime % 10000)) / 10000 : 754} 
                    className={`${countdown === 0 ? 'text-recovery' : 'text-strain'} transition-all duration-75 ease-linear`} 
                  />
                </svg>

                <div className="text-center z-10">
                  <AnimatePresence mode="wait">
                    {countdown !== null ? (
                      <motion.div key={countdown} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.5, opacity: 0 }} className={`text-6xl md:text-8xl font-bold ${countdown === 0 ? "text-recovery" : "text-strain"}`}>
                        {countdown === 0 ? "GO" : countdown}
                      </motion.div>
                    ) : (
                      <motion.div key="timer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`text-5xl md:text-7xl font-mono tracking-tighter ${isRunning ? 'text-white' : 'text-text-muted'}`}>
                        {formatTime(elapsedTime)}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div className="flex gap-2 md:gap-4 relative z-10 w-full md:w-auto">
                {!isRunning ? (
                  <button onClick={handleStartClick} disabled={countdown !== null} className="flex-1 md:flex-none justify-center flex items-center gap-2 bg-strain text-white font-semibold rounded-xl px-6 md:px-10 py-3 md:py-4 hover:bg-strain/80 transition-all disabled:opacity-50 text-sm md:text-lg shadow-[0_0_30px_rgba(0,147,231,0.3)] hover:scale-105 active:scale-95">
                    <Play size={16} className="md:w-5 md:h-5" /> Démarrer
                  </button>
                ) : (
                  <button onClick={stopTimer} className="flex-1 md:flex-none justify-center flex items-center gap-2 bg-alert text-white font-semibold rounded-xl px-6 md:px-10 py-3 md:py-4 hover:bg-alert/80 transition-all text-sm md:text-lg shadow-[0_0_30px_rgba(255,59,48,0.3)] hover:scale-105 active:scale-95">
                    <Square size={16} className="md:w-5 md:h-5" /> Arrêter
                  </button>
                )}
                <button onClick={resetTimer} disabled={countdown !== null || isRunning} className="flex items-center justify-center w-10 h-10 md:w-14 md:h-14 bg-surface-hover text-white rounded-xl hover:bg-border transition-colors disabled:opacity-50">
                  <RotateCcw size={16} className="md:w-5 md:h-5" />
                </button>
              </div>
            </>
          )}

          {/* AFFICHAGE SAISIE MANUELLE */}
          {(selectedTest.type === "manual_time" || selectedTest.type === "manual_value" || isManualMode) && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm space-y-6 relative z-10">
              
              {selectedTest.type === "manual_time" && (
                <div className="flex justify-center gap-2 md:gap-4">
                  <div className="text-center">
                    <input type="number" placeholder="00" value={manualMinutes} onChange={e => setManualMinutes(e.target.value)} className="w-20 md:w-24 bg-background border border-border rounded-xl px-2 md:px-4 py-3 md:py-4 text-2xl md:text-4xl font-mono text-center text-white focus:outline-none focus:border-strain" />
                    <p className="text-[9px] md:text-xs text-text-muted mt-1 md:mt-2 uppercase tracking-widest">Minutes</p>
                  </div>
                  <div className="text-2xl md:text-4xl text-text-muted mt-3">:</div>
                  <div className="text-center">
                    <input type="number" placeholder="00" value={manualSeconds} onChange={e => setManualSeconds(e.target.value)} className="w-20 md:w-24 bg-background border border-border rounded-xl px-2 md:px-4 py-3 md:py-4 text-2xl md:text-4xl font-mono text-center text-white focus:outline-none focus:border-strain" />
                    <p className="text-[9px] md:text-xs text-text-muted mt-1 md:mt-2 uppercase tracking-widest">Secondes</p>
                  </div>
                </div>
              )}

              {(selectedTest.type === "manual_value" || (isManualMode && selectedTest.type === "stopwatch")) && (
                <div className="text-center">
                  <input 
                    type="number" 
                    step="0.01"
                    placeholder="0.00" 
                    value={manualValue} 
                    onChange={e => setManualValue(e.target.value)} 
                    className="w-40 md:w-48 bg-background border border-border rounded-xl px-4 py-3 md:py-4 text-4xl md:text-5xl font-mono text-center text-white focus:outline-none focus:border-strain" 
                  />
                  <p className="text-xs md:text-sm text-strain font-semibold mt-2 md:mt-3 uppercase tracking-widest">{selectedTest.unit}</p>
                </div>
              )}

            </motion.div>
          )}

          {/* BOUTON SAUVEGARDER */}
          <AnimatePresence>
            {(elapsedTime > 0 || manualValue || manualMinutes || manualSeconds) && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md mt-6 md:mt-8 relative z-10">
                {success && (
                  <div className="mb-2 md:mb-3 p-2 bg-recovery/10 border border-recovery/20 rounded-lg text-recovery text-[10px] md:text-xs text-center flex items-center justify-center gap-2">
                    <CheckCircle2 size={12} className="md:w-3.5 md:h-3.5" /> Mesure enregistrée !
                  </div>
                )}
                <div className="flex flex-col md:flex-row gap-2">
                  <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full md:flex-1 bg-background border border-border rounded-xl px-3 md:px-4 py-2.5 md:py-3 text-xs md:text-sm text-white focus:outline-none focus:border-strain" placeholder="Notes (optionnel)" />
                  <button onClick={handleSave} disabled={loading} className="w-full md:w-auto justify-center flex items-center gap-2 bg-white text-black font-semibold rounded-xl px-4 md:px-6 py-2.5 md:py-3 hover:bg-gray-200 transition-colors disabled:opacity-50 text-xs md:text-sm">
                    <Save size={14} className="md:w-4 md:h-4" /> {loading ? "..." : "Sauver"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ANALYSE & OBJECTIF */}
        <div className="lg:col-span-5 space-y-4 md:space-y-6 flex flex-col">
          
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="bg-surface border border-border rounded-3xl p-4 md:p-6 flex-1">
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <div className="flex items-center gap-2">
                <Target size={16} className="text-strain md:w-[18px] md:h-[18px]" />
                <h3 className="text-[10px] md:text-xs font-semibold tracking-widest text-text-muted uppercase">Objectif ({selectedTest.label})</h3>
              </div>
              <Link href="/goals" className="text-[10px] md:text-xs text-strain hover:underline">Gérer</Link>
            </div>
            
            {sprintGoal ? (
              <div>
                <p className="text-sm md:text-lg font-semibold text-white mb-1">{sprintGoal.title}</p>
                <p className="text-xs md:text-sm text-text-muted mb-4 md:mb-6">Cible : {formatValue(sprintGoal.target_value)} {selectedTest.unit}</p>
                
                <div className="flex items-center gap-2 md:gap-4 mb-2">
                  <div className="flex-1 h-2 md:h-3 bg-background rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${goalProgress}%` }} transition={{ duration: 1 }} className={`h-full rounded-full ${goalProgress >= 100 ? 'bg-recovery' : 'bg-strain'}`} />
                  </div>
                  <span className="text-xs md:text-sm font-bold text-white">{goalProgress}%</span>
                </div>
                <p className="text-[10px] md:text-xs text-text-muted text-right">Record actuel : {formatValue(sprintGoal.current_value)} {selectedTest.unit}</p>
              </div>
            ) : (
              <div className="text-center py-4 md:py-6">
                <p className="text-xs md:text-sm text-text-muted mb-3 md:mb-4">Aucun objectif défini.</p>
                <Link href="/goals" className="bg-surface-hover border border-border text-white text-[10px] md:text-xs font-semibold px-3 md:px-4 py-1.5 md:py-2 rounded-lg hover:bg-border transition-colors">
                  Créer un objectif
                </Link>
              </div>
            )}
          </motion.div>

          {/* ANALYSE APPROFONDIE AVEC HISTORIQUE */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="bg-purple-500/5 border border-purple-500/20 rounded-3xl p-4 md:p-6 flex-1 relative overflow-hidden flex flex-col">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-bl-full blur-2xl pointer-events-none" />
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-3 md:mb-4 relative z-10">
              <div className="flex items-center gap-2">
                <BrainCircuit size={16} className="text-purple-500 md:w-[18px] md:h-[18px]" />
                <h3 className="text-[10px] md:text-xs font-semibold tracking-widest text-purple-400 uppercase">Analyse Approfondie</h3>
                {currentAnalysis && !loadingAnalysis && (
                  <span className="text-[9px] md:text-[10px] text-text-muted flex items-center gap-1 ml-1">
                    <Clock size={10} /> {new Date(currentAnalysis.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                  </span>
                )}
              </div>

              {currentAnalysis && !loadingAnalysis && (
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

            {/* Menu déroulant historique */}
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

            {currentAnalysis ? (
              // ✅ CORRECTION ICI : Ajout de overflow-y-auto, pr-2 et amélioration des marges (mb-2.5, space-y-1)
              <div className="text-xs md:text-sm text-text-main leading-relaxed mb-3 md:mb-4 relative z-10 flex-1 overflow-y-auto custom-scrollbar pr-2">
                <ReactMarkdown components={{
                  strong: ({node, ...props}) => <span className="font-bold text-white" {...props} />,
                  li: ({node, ...props}) => <li className="ml-4 list-disc marker:text-purple-500 mb-1.5" {...props} />,
                  p: ({node, ...props}) => <p className="mb-2.5 last:mb-0" {...props} />,
                  ul: ({node, ...props}) => <ul className="mb-3 space-y-1" {...props} />,
                }}>
                  {currentAnalysis.analysis || ""}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-xs md:text-sm text-text-muted leading-relaxed mb-3 md:mb-4 relative z-10 flex-1">
                Croisez vos performances avec votre sommeil, votre nutrition et vos blessures.
              </p>
            )}

            <button 
              onClick={generateDeepAnalysis} 
              disabled={loadingAnalysis || history.length < 2}
              className="w-full bg-purple-500/20 text-purple-400 font-semibold rounded-lg py-2 md:py-2.5 text-[10px] md:text-xs hover:bg-purple-500/30 transition-colors flex items-center justify-center gap-2 relative z-10 disabled:opacity-50 mt-auto"
            >
              {loadingAnalysis ? <Loader2 size={12} className="animate-spin md:w-3.5 md:h-3.5" /> : <Sparkles size={12} className="md:w-3.5 md:h-3.5" />}
              {loadingAnalysis ? "Analyse..." : analysisHistories.length > 0 ? "Regénérer l'analyse" : "Générer l'analyse"}
            </button>
          </motion.div>
        </div>
      </div>

      {/* BOTTOM ROW: Graphique & Historique */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
        
        <div className="lg:col-span-8 bg-surface border border-border rounded-3xl p-4 md:p-6">
          <div className="flex justify-between items-center mb-4 md:mb-6">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-strain md:w-[18px] md:h-[18px]" />
              <h3 className="text-[10px] md:text-sm font-semibold tracking-widest text-text-muted uppercase">Courbe ({selectedTest.label})</h3>
            </div>
          </div>
          <div className="h-48 md:h-72">
            {fetching ? (
              <div className="h-full flex items-center justify-center text-text-muted text-xs md:text-sm">Chargement...</div>
            ) : history.length > 0 ? (
              <SprintChart data={history.map(h => ({ date: h.measured_at, value: h.value }))} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center border border-dashed border-border rounded-xl">
                <Timer size={24} className="text-text-muted mb-2 opacity-50 md:w-8 md:h-8" />
                <p className="text-[10px] md:text-sm text-text-muted text-center px-4">Faites votre premier test de {selectedTest.label}.</p>
              </div>
            )}
          </div>
        </div>

        {/* DERNIERS TESTS */}
        <div className="lg:col-span-4 bg-surface border border-border rounded-3xl p-4 md:p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-3 md:mb-4">
            <History size={16} className="text-strain md:w-[18px] md:h-[18px]" />
            <h3 className="text-[10px] md:text-sm font-semibold tracking-widest text-text-muted uppercase">Derniers tests</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-2 md:space-y-3 pr-1 md:pr-2 custom-scrollbar">
            {history.length === 0 ? (
              <p className="text-[10px] md:text-xs text-text-muted italic text-center mt-4">Aucun historique.</p>
            ) : (
              <AnimatePresence>
                {history.slice().reverse().slice(0, 5).map((h) => {
                  const isEditing = editingId === h.id;
                  const isDeleting = deletingId === h.id;
                  const isBusy = busyId === h.id;
                  return (
                    <motion.div
                      key={h.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                      className={`p-2 md:p-3 bg-background border rounded-xl transition-colors ${
                        isEditing ? "border-strain/50" : "border-border group hover:border-strain/50"
                      }`}
                    >
                      {isDeleting ? (
                        <div className="space-y-2">
                          <p className="text-[10px] md:text-[11px] text-alert font-medium">Supprimer ?</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setDeletingId(null)}
                              disabled={isBusy}
                              className="flex-1 text-[10px] md:text-[11px] font-semibold text-text-muted hover:bg-surface-hover rounded-md py-1 md:py-1.5 transition-colors disabled:opacity-50"
                            >
                              Annuler
                            </button>
                            <button
                              onClick={() => handleDelete(h.id)}
                              disabled={isBusy}
                              className="flex-1 flex items-center justify-center gap-1 text-[10px] md:text-[11px] font-semibold bg-alert text-white rounded-md py-1 md:py-1.5 hover:bg-alert/80 transition-colors disabled:opacity-50"
                            >
                              {isBusy ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                              Oui
                            </button>
                          </div>
                        </div>
                      ) : isEditing ? (
                        <div className="space-y-2">
                          {selectedTest.type === "manual_time" ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={editMinutes}
                                onChange={(e) => setEditMinutes(e.target.value)}
                                placeholder="0"
                                autoFocus
                                className="flex-1 bg-surface border border-border rounded-md px-2 py-1 md:py-1.5 text-xs md:text-sm text-white text-center focus:outline-none focus:border-strain"
                              />
                              <span className="text-text-muted text-xs">:</span>
                              <input
                                type="number"
                                value={editSeconds}
                                onChange={(e) => setEditSeconds(e.target.value)}
                                placeholder="00"
                                className="flex-1 bg-surface border border-border rounded-md px-2 py-1 md:py-1.5 text-xs md:text-sm text-white text-center focus:outline-none focus:border-strain"
                              />
                            </div>
                          ) : (
                            <input
                              type="number"
                              step="0.01"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              autoFocus
                              className="w-full bg-surface border border-border rounded-md px-2 py-1 md:py-1.5 text-xs md:text-sm text-white focus:outline-none focus:border-strain"
                            />
                          )}
                          <input
                            type="text"
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            placeholder="Notes (optionnel)"
                            className="w-full bg-surface border border-border rounded-md px-2 py-1 text-[10px] md:text-[11px] text-white focus:outline-none focus:border-strain"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={cancelEdit}
                              disabled={isBusy}
                              className="flex-1 flex items-center justify-center gap-1 text-[10px] md:text-[11px] font-semibold text-text-muted hover:bg-surface-hover rounded-md py-1 md:py-1.5 transition-colors disabled:opacity-50"
                            >
                              <X size={10} /> Annuler
                            </button>
                            <button
                              onClick={() => handleUpdate(h.id)}
                              disabled={isBusy}
                              className="flex-1 flex items-center justify-center gap-1 text-[10px] md:text-[11px] font-semibold bg-strain text-white rounded-md py-1 md:py-1.5 hover:bg-strain/80 transition-colors disabled:opacity-50"
                            >
                              {isBusy ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                              Sauver
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs md:text-sm font-bold text-white">
                              {formatValue(h.value)} <span className="text-[9px] md:text-[10px] text-text-muted">{selectedTest.unit}</span>
                            </p>
                            <p className="text-[9px] md:text-[10px] text-text-muted">{new Date(h.measured_at).toLocaleDateString("fr-FR")}</p>
                            {h.notes && <p className="text-[9px] md:text-[10px] text-text-muted max-w-[100px] truncate">{h.notes}</p>}
                          </div>
                          <div className="flex items-center gap-0.5 md:gap-1 opacity-100 md:opacity-70 hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => startEdit(h)}
                              className="p-1 md:p-1.5 rounded-md text-text-muted hover:text-white hover:bg-surface-hover transition-colors"
                            >
                              <Pencil size={12} className="md:w-3.5 md:h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeletingId(h.id)}
                              className="p-1 md:p-1.5 rounded-md text-text-muted hover:text-alert hover:bg-alert/10 transition-colors"
                            >
                              <Trash2 size={12} className="md:w-3.5 md:h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </div>

      </div>

      {/* MODAL AJOUT DE TEST PERSONNALISÉ */}
      <AnimatePresence>
        {showAddTestModal && (
          <div onClick={() => setShowAddTestModal(false)} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div onClick={(e) => e.stopPropagation()} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-surface border border-border rounded-3xl p-5 md:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4 md:mb-6">
                <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                  <Plus size={18} className="text-strain md:w-5 md:h-5" /> Créer un test
                </h2>
                <button onClick={() => setShowAddTestModal(false)} className="text-text-muted hover:text-white bg-background p-1.5 md:p-2 rounded-lg"><X size={18} className="md:w-5 md:h-5" /></button>
              </div>
              
              <form onSubmit={handleCreateTest} className="space-y-3 md:space-y-4">
                <div>
                  <label className="block text-[10px] md:text-xs font-semibold text-text-muted tracking-widest uppercase mb-1 md:mb-2">Nom du test</label>
                  <input type="text" value={newTestName} onChange={e => setNewTestName(e.target.value)} required placeholder="ex: 100m Nage Libre" className="w-full bg-background border border-border rounded-xl px-3 md:px-4 py-2 md:py-3 text-xs md:text-sm text-white focus:outline-none focus:border-strain" />
                </div>
                <div>
                  <label className="block text-[10px] md:text-xs font-semibold text-text-muted tracking-widest uppercase mb-1 md:mb-2">Catégorie</label>
                  <input type="text" value={newTestCategory} onChange={e => setNewTestCategory(e.target.value)} required placeholder="ex: Natation, Combat..." className="w-full bg-background border border-border rounded-xl px-3 md:px-4 py-2 md:py-3 text-xs md:text-sm text-white focus:outline-none focus:border-strain" list="categories-list" />
                  <datalist id="categories-list">
                    <option value="Vitesse & Explosivité" />
                    <option value="Endurance" />
                    <option value="Force & Puissance" />
                    <option value="Combat / Autre" />
                  </datalist>
                </div>
                <div className="grid grid-cols-2 gap-2 md:gap-4">
                  <div>
                    <label className="block text-[10px] md:text-xs font-semibold text-text-muted tracking-widest uppercase mb-1 md:mb-2">Unité</label>
                    <input type="text" value={newTestUnit} onChange={e => setNewTestUnit(e.target.value)} required placeholder="s, kg, cm..." className="w-full bg-background border border-border rounded-xl px-3 md:px-4 py-2 md:py-3 text-xs md:text-sm text-white focus:outline-none focus:border-strain" />
                  </div>
                  <div>
                    <label className="block text-[10px] md:text-xs font-semibold text-text-muted tracking-widest uppercase mb-1 md:mb-2">Type</label>
                    <select value={newTestType} onChange={e => setNewTestType(e.target.value)} className="w-full bg-background border border-border rounded-xl px-2 md:px-4 py-2 md:py-3 text-[10px] md:text-sm text-white focus:outline-none focus:border-strain">
                      <option value="manual_value">Saisie (ex: 50 kg)</option>
                      <option value="manual_time">Chrono manuel</option>
                      <option value="stopwatch">Chrono intégré</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] md:text-xs font-semibold text-text-muted tracking-widest uppercase mb-1 md:mb-2">Sens de progression</label>
                  <div className="flex gap-2 bg-background border border-border rounded-xl p-1">
                    <button type="button" onClick={() => setNewTestLowerBetter(true)} className={`flex-1 py-1.5 md:py-2 text-[10px] md:text-xs font-semibold rounded-lg transition-colors ${newTestLowerBetter ? 'bg-strain text-white' : 'text-text-muted hover:text-white'}`}>
                      Plus bas = Mieux
                    </button>
                    <button type="button" onClick={() => setNewTestLowerBetter(false)} className={`flex-1 py-1.5 md:py-2 text-[10px] md:text-xs font-semibold rounded-lg transition-colors ${!newTestLowerBetter ? 'bg-recovery text-white' : 'text-text-muted hover:text-white'}`}>
                      Plus haut = Mieux
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={savingTest} className="w-full bg-white text-black font-bold rounded-xl py-2.5 md:py-3 text-xs md:text-sm hover:bg-gray-200 transition-colors mt-2 md:mt-4 disabled:opacity-50">
                  {savingTest ? "Création..." : "Créer le test"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}