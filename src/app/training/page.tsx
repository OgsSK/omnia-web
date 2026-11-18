// src/app/training/page.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { isAIEnabled } from "@/lib/ai-guard";
import {
  Dumbbell, Sparkles, Activity, Zap,
  ChevronRight, ArrowLeft, X, CheckCircle2, AlertTriangle,
  ShieldAlert, Brain, Flame, Save, Clock, Award,
  Home, MapPin, Timer, UtensilsCrossed, Target, History,
  ArrowRightLeft, RefreshCw, ListOrdered, Play
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Exercise = {
  name: string;
  details: string;
  rest: string;
  rpe: number;
  note: string;
};

type SubstituteExercise = Exercise & {
  reason: string;
};

type SubstitutionTarget = {
  exerciseIndex: number;
  exercise: Exercise;
};

export default function TrainingPage() {
  const [loading, setLoading] = useState(true);
  const [todayMetric, setTodayMetric] = useState<any>(null);

  const [contextData, setContextData] = useState({
    injuries: [] as any[],
    stress: 3,
    energy: 3,
    calories: 0,
    lastTests: [] as any[],
    weightGoal: "maintain"
  });

  const [showWizard, setShowWizard] = useState(false);
  const [step, setStep] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [workout, setWorkout] = useState<any>(null);
  const [activeWorkoutId, setActiveWorkoutId] = useState<string | null>(null);
  const [savingWorkout, setSavingWorkout] = useState(false);
  const [workoutHistory, setWorkoutHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const [sport, setSport] = useState("");
  const [location, setLocation] = useState("");
  const [equipment, setEquipment] = useState("");
  const [duration, setDuration] = useState("");
  const [focus, setFocus] = useState("");
  const [customNote, setCustomNote] = useState("");

  // ✅ Substitution d'exercice
  const [substitutionTarget, setSubstitutionTarget] = useState<SubstitutionTarget | null>(null);
  const [substitutionPreference, setSubstitutionPreference] = useState("");
  const [substituting, setSubstituting] = useState(false);
  const [substituteOptions, setSubstituteOptions] = useState<SubstituteExercise[]>([]);
  const [substituteWarning, setSubstituteWarning] = useState<string | null>(null);
  const [substituteError, setSubstituteError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchContext() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const today = new Date().toISOString().split("T")[0];
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const [metricRes, injuriesRes, healthRes, nutritionRes, testsRes, lastWorkoutRes, historyRes] = await Promise.all([
          supabase.from("daily_metrics").select("*").eq("user_id", user.id).eq("date", today).maybeSingle(),
          supabase.from("injuries").select("*").eq("user_id", user.id).eq("status", "active"),
          supabase.from("health_metrics").select("stress_level, energy_level").eq("user_id", user.id).order("date", { ascending: false }).limit(1),
          supabase.from("meal_logs").select("calories").eq("user_id", user.id).eq("date", today),
          supabase.from("measurements").select("metric_type, value").eq("user_id", user.id).order("measured_at", { ascending: false }).limit(3),
          supabase.from("ai_generations").select("content").eq("user_id", user.id).eq("type", "workout").gte("created_at", sevenDaysAgo.toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle(),
          supabase.from("workouts").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
        ]);

        if (metricRes.data) setTodayMetric(metricRes.data);

        const meta = user.user_metadata || {};

        setContextData({
          injuries: injuriesRes.data || [],
          stress: healthRes.data?.[0]?.stress_level || 3,
          energy: healthRes.data?.[0]?.energy_level || 3,
          calories: nutritionRes.data?.reduce((acc, curr) => acc + (curr.calories || 0), 0) || 0,
          lastTests: testsRes.data || [],
          weightGoal: meta.weight_goal || "maintain"
        });

        if (historyRes.data) setWorkoutHistory(historyRes.data);

        // 1. On charge le brouillon (priorité)
        if (lastWorkoutRes.data?.content?.workout) {
          const cached = lastWorkoutRes.data.content;
          setWorkout(cached.workout);
          setSport(cached.sport || "");
          setLocation(cached.location || "");
          setEquipment(cached.equipment || "");
          setDuration(cached.duration || "");
          setFocus(cached.focus || "");
          setActiveWorkoutId(null);
        } 
        // 2. Sinon on charge la dernière séance sauvegardée
        else if (historyRes.data && historyRes.data.length > 0) {
          const lastSaved = historyRes.data[0];
          setWorkout({
            title: lastSaved.title,
            description: lastSaved.description,
            exercises: lastSaved.exercises
          });
          setActiveWorkoutId(lastSaved.id);
        }
      }
      setLoading(false);
    }
    fetchContext();
  }, []);

  const generateWorkout = async () => {
    const aiAllowed = await isAIEnabled();
    if (!aiAllowed) {
      alert("L'analyse IA est désactivée dans vos paramètres. Activez-la pour générer une séance.");
      setStep(1);
      setGenerating(false);
      return;
    }

    setStep(6);
    setGenerating(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const activeInjuries = contextData.injuries.map(i => `${i.body_part} (intensité ${i.severity}/5)`).join(", ");
    const lastTests = contextData.lastTests.map(t => `${t.metric_type}: ${t.value}`).join(", ");

    let context = `
    CONTEXTE DE L'ATHLÈTE :
    - Séance souhaitée : ${sport} (Lieu : ${location}, Matériel : ${equipment}, Durée : ${duration}).
    - Focus spécifique : ${focus}.
    - Instructions de l'utilisateur : ${customNote || "Aucune"}.
    - Objectif de poids : ${contextData.weightGoal === 'lose' ? 'Perte de poids (Sèche)' : contextData.weightGoal === 'gain' ? 'Prise de masse' : 'Maintien'}.
    - Récupération du jour : ${todayMetric?.recovery_score || 100}% (Sommeil : ${todayMetric?.sleep_hours || 8}h, Fatigue : ${todayMetric?.fatigue_level || 0}/5).
    - Niveau de stress : ${contextData.stress}/5. Niveau d'énergie : ${contextData.energy}/5.
    - Calories consommées aujourd'hui : ${contextData.calories} kcal.
    - Derniers tests physiques : ${lastTests || "Aucun test récent"}.
    - ⚠️ BLESSURES ACTIVES : ${activeInjuries || "Aucune blessure déclarée"}.
    `;

    if (activeInjuries) context += `\n⚠️ RÈGLE ABSOLUE : L'athlète a des blessures actives. Tu DOIS ABSOLUMENT éviter de solliciter ces zones.`;
    if (todayMetric?.recovery_score < 50) context += `\n⚠️ RÈGLE : Récupération faible. Réduis le volume et l'intensité de la séance.`;
    if (equipment) context += `\n⚠️ RÈGLE MATÉRIEL : Utilise UNIQUEMENT le matériel suivant : ${equipment}.`;
    if (contextData.weightGoal === "lose") context += `\n⚠️ RÈGLE OBJECTIF (SÈCHE) : L'athlète est en déficit calorique. Privilégie les circuits training, peu de repos, cardio.`;
    else if (contextData.weightGoal === "gain") context += `\n⚠️ RÈGLE OBJECTIF (PRISE DE MASSE) : L'athlète est en surplus calorique. Privilégie la force, l'hypertrophie, repos longs.`;

    try {
      const res = await fetch("/api/training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context })
      });
      const data = await res.json();

      if (user && data.workout) {
        await supabase.from("ai_generations").insert({
          user_id: user.id,
          type: "workout",
          content: { workout: data.workout, sport, location, equipment, duration, focus }
        });
      }

      setWorkout(data.workout);
      setActiveWorkoutId(null);
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(false);
    }
  };

  const saveWorkout = async () => {
    if (!workout) return;
    setSavingWorkout(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data, error } = await supabase.from("workouts").insert({
        user_id: user.id,
        title: workout.title,
        description: workout.description,
        exercises: workout.exercises
      }).select().single();

      if (error) {
        console.error("❌ [saveWorkout] Erreur Supabase:", error);
        alert(`Erreur de sauvegarde : ${error.message}\nVérifiez que la table "workouts" existe et que la sécurité (RLS) est bien configurée.`);
      } else if (data) {
        setWorkoutHistory(prev => [data, ...prev]);
        setActiveWorkoutId(data.id);
        
        // On supprime le brouillon pour éviter les conflits au rafraîchissement
        await supabase.from("ai_generations").delete().eq("user_id", user.id).eq("type", "workout");
        
        alert("Séance sauvegardée dans votre historique !");
      }
    }
    setSavingWorkout(false);
  };

  const handleNewWorkout = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await supabase.from("ai_generations").delete().eq("user_id", user.id).eq("type", "workout");
    setWorkout(null); 
    setActiveWorkoutId(null);
    setSport(""); setLocation(""); setEquipment(""); setDuration(""); setFocus(""); setCustomNote(""); setStep(1); setShowWizard(true);
  };

  // ✅ Charge une séance depuis l'historique
  const handleLoadHistory = (historyItem: any) => {
    setWorkout({
      title: historyItem.title,
      description: historyItem.description,
      exercises: historyItem.exercises
    });
    setActiveWorkoutId(historyItem.id);
    
    // Remonte en haut de la page pour que l'utilisateur voie la séance chargée
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteHistoryWorkout = async (id: string) => {
    if (confirm("Supprimer cette séance de l'historique ?")) {
      await supabase.from("workouts").delete().eq("id", id);
      setWorkoutHistory(prev => prev.filter(w => w.id !== id));
      
      if (activeWorkoutId === id) {
        setWorkout(null);
        setActiveWorkoutId(null);
      }
    }
  };

  const openSubstitution = (exerciseIndex: number, exercise: Exercise) => {
    setSubstitutionTarget({ exerciseIndex, exercise });
    setSubstitutionPreference("");
    setSubstituteOptions([]);
    setSubstituteWarning(null);
    setSubstituteError(null);
  };

  const closeSubstitution = () => {
    setSubstitutionTarget(null);
    setSubstitutionPreference("");
    setSubstituteOptions([]);
    setSubstituteWarning(null);
    setSubstituteError(null);
    setSubstituting(false);
  };

  const requestSubstitutes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!substitutionTarget || !workout) return;

    setSubstituting(true);
    setSubstituteError(null);
    setSubstituteOptions([]);
    setSubstituteWarning(null);

    try {
      const aiAllowed = await isAIEnabled();
      if (!aiAllowed) {
        setSubstituteError("L'IA est désactivée dans vos paramètres.");
        setSubstituting(false);
        return;
      }

      const res = await fetch("/api/substitute-exercise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workout,
          exercise: substitutionTarget.exercise,
          constraints: {
            injuries: contextData.injuries,
            recoveryScore: todayMetric?.recovery_score ?? 100,
            stress: contextData.stress,
            equipment,
            location,
            duration,
            focus,
            weightGoal: contextData.weightGoal,
          },
          userPreference: substitutionPreference.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSubstituteError(data.error || "Impossible de trouver une alternative.");
        setSubstituting(false);
        return;
      }

      setSubstituteOptions(data.substitutes || []);
      setSubstituteWarning(data.warning || null);
    } catch (err) {
      console.error(err);
      setSubstituteError("Erreur réseau. Réessaie.");
    } finally {
      setSubstituting(false);
    }
  };

  const applySubstitution = (option: SubstituteExercise) => {
    if (!substitutionTarget || !workout) return;

    const newExercises = workout.exercises.map((ex: Exercise, i: number) => {
      if (i !== substitutionTarget.exerciseIndex) return ex;
      return {
        name: option.name,
        details: option.details,
        rest: option.rest,
        rpe: option.rpe,
        note: option.note || option.reason,
      };
    });

    setWorkout({ ...workout, exercises: newExercises });
    closeSubstitution();
  };

  const activeConstraintsCount =
    (contextData.injuries.length > 0 ? 1 : 0) +
    (todayMetric?.recovery_score < 50 ? 1 : 0) +
    (contextData.stress >= 4 ? 1 : 0) +
    (equipment ? 1 : 0) +
    (focus ? 1 : 0);

  if (loading) return <div className="p-8 text-white min-h-screen bg-[#020202]">Chargement...</div>;

  if (!todayMetric) {
    return (
      <div className="p-4 md:p-6 max-w-[1200px] mx-auto bg-[#020202] min-h-screen flex items-center justify-center">
        <div className="bg-surface border border-alert/30 rounded-3xl p-6 md:p-12 text-center max-w-md relative overflow-hidden">
          <div className="absolute inset-0 bg-alert/5 pointer-events-none" />
          <AlertTriangle size={36} className="text-alert mx-auto mb-4 md:mb-6 relative z-10 md:w-12 md:h-12" />
          <h2 className="text-xl md:text-2xl font-bold text-white mb-2 relative z-10">Données manquantes</h2>
          <p className="text-xs md:text-sm text-text-muted mb-6 md:mb-8 relative z-10">Pour générer une séance, OMNIA a besoin de votre check-in.</p>
          <Link href="/" className="bg-white text-black font-bold rounded-xl px-4 md:px-6 py-2.5 md:py-3 text-sm md:text-base hover:bg-gray-200 transition-colors relative z-10 inline-block w-full md:w-auto">Faire mon check-in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-[1200px] mx-auto bg-[#020202] min-h-screen space-y-4 md:space-y-6">
      <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-3 md:gap-0 mb-4 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white mb-1 flex items-center gap-2">Entraînement <span className="text-[10px] md:text-xs bg-strain/20 text-strain px-2 py-1 rounded-md uppercase tracking-wider font-semibold">IA Coach</span></h1>
          <p className="text-xs md:text-sm text-text-muted">Séance basée sur votre état global.</p>
        </div>
      </header>

      {!workout ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          <div className="lg:col-span-2 space-y-4 md:space-y-6">
            <div className="bg-surface border border-border rounded-3xl p-5 md:p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-strain/10 via-transparent to-transparent pointer-events-none" />
              <div className="flex flex-col items-center text-center relative z-10">
                <Dumbbell size={40} className="text-strain mb-4 md:mb-6 md:w-16 md:h-16" />
                <h2 className="text-lg md:text-2xl font-bold text-white mb-2">Prêt à vous entraîner ?</h2>
                <p className="text-xs md:text-sm text-text-muted mb-6 md:mb-8 max-w-md">OMNIA va croiser toutes vos données pour créer la séance parfaite.</p>
                <button onClick={handleNewWorkout} className="w-full md:w-auto bg-white text-black font-bold text-sm md:text-lg rounded-xl px-6 md:px-8 py-3 md:py-4 hover:bg-gray-200 transition-all hover:scale-105 shadow-[0_0_30px_rgba(255,255,255,0.2)]">Générer ma séance</button>
              </div>
            </div>
            <div className="bg-surface border border-border rounded-3xl p-4 md:p-6">
              <h3 className="text-[10px] md:text-sm font-semibold text-white uppercase tracking-widest mb-3 md:mb-4">Données prises en compte</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-4">
                <div className="bg-background border border-border rounded-xl p-3 md:p-4"><Activity size={14} className="text-recovery mb-1.5 md:mb-2 md:w-4 md:h-4" /><p className="text-[9px] md:text-xs text-text-muted">Récupération</p><p className="text-sm md:text-lg font-bold text-white">{todayMetric.recovery_score}%</p></div>
                <div className="bg-background border border-border rounded-xl p-3 md:p-4"><ShieldAlert size={14} className={`mb-1.5 md:mb-2 md:w-4 md:h-4 ${contextData.injuries.length > 0 ? "text-alert" : "text-recovery"}`} /><p className="text-[9px] md:text-xs text-text-muted">Blessures</p><p className={`text-sm md:text-lg font-bold ${contextData.injuries.length > 0 ? 'text-alert' : 'text-white'}`}>{contextData.injuries.length}</p></div>
                <div className="bg-background border border-border rounded-xl p-3 md:p-4"><Brain size={14} className="text-purple-500 mb-1.5 md:mb-2 md:w-4 md:h-4" /><p className="text-[9px] md:text-xs text-text-muted">Stress</p><p className="text-sm md:text-lg font-bold text-white">{contextData.stress}/5</p></div>
                <div className="bg-background border border-border rounded-xl p-3 md:p-4"><Flame size={14} className="text-warning mb-1.5 md:mb-2 md:w-4 md:h-4" /><p className="text-[9px] md:text-xs text-text-muted">Calories</p><p className="text-sm md:text-lg font-bold text-white truncate">{contextData.calories} kcal</p></div>
                <div className="bg-background border border-border rounded-xl p-3 md:p-4"><Target size={14} className={`mb-1.5 md:mb-2 md:w-4 md:h-4 ${contextData.weightGoal === 'lose' ? 'text-alert' : contextData.weightGoal === 'gain' ? 'text-strain' : 'text-recovery'}`} /><p className="text-[9px] md:text-xs text-text-muted">Objectif</p><p className="text-[10px] md:text-sm font-bold text-white truncate capitalize">{contextData.weightGoal === 'lose' ? 'Sèche' : contextData.weightGoal === 'gain' ? 'Masse' : 'Maintien'}</p></div>
              </div>
            </div>
          </div>
          <div className="bg-purple-500/5 border border-purple-500/20 rounded-3xl p-4 md:p-6 relative overflow-hidden h-fit">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-3xl pointer-events-none rounded-full" />
            <div className="flex items-center gap-2 mb-3 md:mb-4 relative z-10"><Sparkles size={16} className="text-purple-500 md:w-[18px] md:h-[18px]" /><h3 className="text-[10px] md:text-xs font-semibold text-purple-400 uppercase tracking-widest">Conseil OMNIA</h3></div>
            <p className="text-xs md:text-sm text-text-main leading-relaxed relative z-10 mb-4 md:mb-6">{todayMetric.recovery_score < 50 ? "Votre récupération est faible. OMNIA va vous proposer une séance légère." : contextData.injuries.length > 0 ? "Blessures actives. OMNIA adaptera la séance." : "Vous êtes en forme ! OMNIA va vous proposer une séance adaptée."}</p>
            <Link href="/omnia" className="w-full md:w-auto justify-center inline-flex items-center gap-2 text-[10px] md:text-xs font-semibold text-purple-400 hover:text-white transition-colors bg-purple-500/10 px-3 md:px-4 py-2 rounded-lg border border-purple-500/20">En parler à OMNIA <ChevronRight size={12} className="md:w-3.5 md:h-3.5" /></Link>
          </div>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-surface border border-border rounded-3xl p-4 md:p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-strain/5 blur-3xl pointer-events-none rounded-full" />
          <div className="flex flex-col md:flex-row justify-between items-start mb-6 md:mb-8 relative z-10 gap-4 md:gap-0">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-[9px] md:text-xs font-bold bg-strain/20 text-strain px-1.5 md:px-2 py-0.5 md:py-1 rounded uppercase tracking-wider">
                  {activeWorkoutId ? "Séance sauvegardée" : "Séance actuelle"}
                </span>
                {duration && <span className="text-[9px] md:text-xs font-medium text-text-muted flex items-center gap-1"><Clock size={10} className="md:w-3 md:h-3"/> {duration} {location && `• ${location}`} {equipment && `• ${equipment}`}</span>}
              </div>
              <h2 className="text-xl md:text-3xl font-bold text-white">{workout.title}</h2>
              <p className="text-[10px] md:text-sm text-text-muted mt-2 max-w-2xl">{workout.description}</p>
            </div>
            <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
              <button onClick={saveWorkout} disabled={savingWorkout} className="w-full md:w-auto justify-center flex items-center gap-2 bg-white text-black font-semibold rounded-xl px-4 py-2 text-xs md:text-sm hover:bg-gray-200 transition-colors">
                <Save size={14} className="md:w-[18px] md:h-[18px]" /> 
                {savingWorkout ? "..." : activeWorkoutId ? "Sauvegarder une copie" : "Sauvegarder"}
              </button>
              <button onClick={handleNewWorkout} className="w-full md:w-auto justify-center flex items-center gap-2 text-text-muted hover:text-white bg-background px-4 py-2 rounded-lg border border-border text-xs md:text-sm">Nouvelle séance</button>
            </div>
          </div>
          <div className="space-y-3 md:space-y-4 relative z-10">
            {workout.exercises.map((ex: Exercise, i: number) => (
              <div key={i} className="bg-background border border-border rounded-2xl p-3 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 hover:border-strain/30 transition-colors group/ex">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-1"><h3 className="font-bold text-sm md:text-lg text-white">{ex.name}</h3><span className="text-[9px] md:text-[10px] bg-surface-hover border border-border px-1.5 md:px-2 py-0.5 rounded text-text-muted font-mono">RPE {ex.rpe || "-"}</span></div>
                  <p className="text-xs md:text-sm text-strain font-medium">{ex.details}</p>
                  {ex.note && <p className="text-[10px] md:text-xs text-text-muted mt-1.5 md:mt-2 italic flex items-start gap-1"><Brain size={10} className="shrink-0 mt-0.5 md:w-3 md:h-3"/> {ex.note}</p>}
                </div>
                <div className="flex items-center justify-between md:justify-end gap-3 md:gap-4 shrink-0 mt-2 md:mt-0 pt-2 md:pt-0 border-t md:border-t-0 border-border/50">
                  <div className="text-center"><Clock size={12} className="text-text-muted mx-auto mb-0.5 md:mb-1 md:w-4 md:h-4" /><p className="text-[10px] md:text-xs text-white font-mono">{ex.rest || "60s"}</p></div>
                  <button
                    onClick={() => openSubstitution(i, ex)}
                    className="flex items-center gap-1 text-[10px] md:text-xs bg-surface border border-border hover:border-strain hover:text-strain text-text-muted px-2 md:px-3 py-1.5 rounded-lg transition-colors"
                    title="Remplacer cet exercice"
                  >
                    <ArrowRightLeft size={12} className="md:w-3.5 md:h-3.5" />
                    <span className="hidden md:inline">Remplacer</span>
                  </button>
                  <CheckCircle2 size={16} className="text-text-muted opacity-50 md:w-6 md:h-6" />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {workoutHistory.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-surface border border-border rounded-3xl p-4 md:p-6 mt-6">
          <div className="flex items-center gap-2 mb-4 cursor-pointer" onClick={() => setShowHistory(!showHistory)}>
            <History size={18} className="text-strain" />
            <h3 className="text-sm font-semibold text-white uppercase tracking-widest flex-1">Historique des séances ({workoutHistory.length})</h3>
            <ChevronRight size={18} className={`text-text-muted transition-transform ${showHistory ? 'rotate-90' : ''}`} />
          </div>
          <AnimatePresence>
            {showHistory && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-3">
                {workoutHistory.map((h) => (
                  <div key={h.id} className={`bg-background border ${activeWorkoutId === h.id ? 'border-strain/50' : 'border-border'} rounded-xl p-3 md:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-0`}>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-white flex items-center gap-2">
                        {h.title} 
                        {activeWorkoutId === h.id && <span className="text-[8px] bg-strain/20 text-strain px-1.5 py-0.5 rounded uppercase">En cours</span>}
                      </p>
                      <p className="text-[10px] text-text-muted">{new Date(h.created_at).toLocaleDateString("fr-FR")}</p>
                      <p className="text-xs text-text-muted mt-1 line-clamp-2">{h.description}</p>
                    </div>
                    
                    {/* ✅ BOUTONS D'ACTION DANS L'HISTORIQUE */}
                    <div className="flex items-center gap-3 shrink-0 md:ml-4 mt-2 md:mt-0">
                      <button 
                        onClick={() => handleLoadHistory(h)} 
                        className="flex items-center justify-center gap-1 bg-surface-hover border border-border text-white text-[10px] md:text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-border hover:text-strain transition-colors w-full md:w-auto"
                      >
                        <Play size={10} className="md:w-3 md:h-3" /> Charger
                      </button>
                      <button 
                        onClick={() => deleteHistoryWorkout(h.id)} 
                        className="text-alert text-[10px] md:text-xs hover:underline"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ===== WIZARD ===== */}
      <AnimatePresence>
        {showWizard && (
          <div onClick={() => setShowWizard(false)} className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-black/80 backdrop-blur-sm">
            <motion.div onClick={(e) => e.stopPropagation()} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-surface border border-border rounded-3xl p-4 md:p-8 w-full max-w-lg relative overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="absolute top-0 right-0 w-48 h-48 bg-strain/5 blur-3xl pointer-events-none rounded-full" />
              <div className="flex justify-between items-center mb-4 md:mb-6 relative z-10"><h2 className="text-lg md:text-xl font-bold text-white">Assistant OMNIA</h2><button onClick={() => setShowWizard(false)} className="text-text-muted hover:text-white bg-background p-1.5 md:p-2 rounded-lg"><X size={16} className="md:w-5 md:h-5"/></button></div>
              <div className="relative z-10">
                {step === 1 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-2">
                    <p className="text-xs md:text-sm text-text-muted mb-3 md:mb-4">1. Quel type de séance ?</p>
                    <button onClick={() => { setSport("Musculation"); setStep(2); }} className="w-full p-3 md:p-4 bg-background border border-border rounded-xl text-xs md:text-sm text-white hover:border-strain text-left font-medium">Musculation</button>
                    <button onClick={() => { setSport("Cardio"); setStep(2); }} className="w-full p-3 md:p-4 bg-background border border-border rounded-xl text-xs md:text-sm text-white hover:border-strain text-left font-medium">Cardio / Endurance</button>
                    <button onClick={() => { setSport("Football"); setStep(2); }} className="w-full p-3 md:p-4 bg-background border border-border rounded-xl text-xs md:text-sm text-white hover:border-strain text-left font-medium">Football / Sprint</button>
                    <button onClick={() => { setSport("Mobilité"); setStep(2); }} className="w-full p-3 md:p-4 bg-background border border-border rounded-xl text-xs md:text-sm text-white hover:border-strain text-left font-medium">Mobilité / Récupération</button>
                  </motion.div>
                )}
                {step === 2 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-2">
                    <div className="flex items-center gap-2 mb-3 md:mb-4"><button onClick={() => setStep(1)} className="text-text-muted hover:text-white"><ArrowLeft size={14} className="md:w-4 md:h-4"/></button><p className="text-xs md:text-sm text-text-muted">2. Où se déroule la séance ?</p></div>
                    <button onClick={() => { setLocation("Salle de sport"); setStep(3); }} className="w-full p-3 md:p-4 bg-background border border-border rounded-xl text-xs md:text-sm text-white hover:border-strain text-left font-medium flex items-center gap-2 md:gap-3"><Dumbbell size={14} className="md:w-[18px] md:h-[18px]"/> Salle de sport</button>
                    <button onClick={() => { setLocation("Maison"); setStep(3); }} className="w-full p-3 md:p-4 bg-background border border-border rounded-xl text-xs md:text-sm text-white hover:border-strain text-left font-medium flex items-center gap-2 md:gap-3"><Home size={14} className="md:w-[18px] md:h-[18px]"/> Maison</button>
                    <button onClick={() => { setLocation("Extérieur"); setStep(3); }} className="w-full p-3 md:p-4 bg-background border border-border rounded-xl text-xs md:text-sm text-white hover:border-strain text-left font-medium flex items-center gap-2 md:gap-3"><MapPin size={14} className="md:w-[18px] md:h-[18px]"/> Extérieur / Stade</button>
                  </motion.div>
                )}
                {step === 3 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-2">
                    <div className="flex items-center gap-2 mb-3 md:mb-4"><button onClick={() => setStep(2)} className="text-text-muted hover:text-white"><ArrowLeft size={14} className="md:w-4 md:h-4"/></button><p className="text-xs md:text-sm text-text-muted">3. Quel matériel as-tu ?</p></div>
                    <button onClick={() => { setEquipment("Poids du corps"); setStep(4); }} className="w-full p-3 md:p-4 bg-background border border-border rounded-xl text-xs md:text-sm text-white hover:border-strain text-left font-medium">Poids du corps uniquement</button>
                    <button onClick={() => { setEquipment("Haltères / Elastiques"); setStep(4); }} className="w-full p-3 md:p-4 bg-background border border-border rounded-xl text-xs md:text-sm text-white hover:border-strain text-left font-medium">Haltères / Elastiques</button>
                    <button onClick={() => { setEquipment("Salle complète"); setStep(4); }} className="w-full p-3 md:p-4 bg-background border border-border rounded-xl text-xs md:text-sm text-white hover:border-strain text-left font-medium">Accès aux machines</button>
                  </motion.div>
                )}
                {step === 4 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-2">
                    <div className="flex items-center gap-2 mb-3 md:mb-4"><button onClick={() => setStep(3)} className="text-text-muted hover:text-white"><ArrowLeft size={14} className="md:w-4 md:h-4"/></button><p className="text-xs md:text-sm text-text-muted">4. Combien de temps as-tu ?</p></div>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => { setDuration("30 minutes"); setStep(5); }} className="p-3 md:p-4 bg-background border border-border rounded-xl text-xs md:text-sm text-white hover:border-strain text-center font-medium flex flex-col items-center gap-1.5 md:gap-2"><Timer size={16} className="md:w-[18px] md:h-[18px]"/> Rapide (30m)</button>
                      <button onClick={() => { setDuration("45 minutes"); setStep(5); }} className="p-3 md:p-4 bg-background border border-border rounded-xl text-xs md:text-sm text-white hover:border-strain text-center font-medium flex flex-col items-center gap-1.5 md:gap-2"><Timer size={16} className="md:w-[18px] md:h-[18px]"/> Normal (45m)</button>
                      <button onClick={() => { setDuration("1 heure"); setStep(5); }} className="p-3 md:p-4 bg-background border border-border rounded-xl text-xs md:text-sm text-white hover:border-strain text-center font-medium flex flex-col items-center gap-1.5 md:gap-2"><Timer size={16} className="md:w-[18px] md:h-[18px]"/> Complet (1h)</button>
                      <button onClick={() => { setDuration("1h30"); setStep(5); }} className="p-3 md:p-4 bg-background border border-border rounded-xl text-xs md:text-sm text-white hover:border-strain text-center font-medium flex flex-col items-center gap-1.5 md:gap-2"><Timer size={16} className="md:w-[18px] md:h-[18px]"/> Long (+1h30)</button>
                    </div>
                  </motion.div>
                )}
                {step === 5 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 md:space-y-6">
                    <div className="flex items-center gap-2 mb-2"><button onClick={() => setStep(4)} className="text-text-muted hover:text-white"><ArrowLeft size={14} className="md:w-4 md:h-4"/></button><p className="text-xs md:text-sm text-text-muted">5. Détails finaux</p></div>
                    <div>
                      <label className="block text-[10px] md:text-xs font-semibold text-text-muted tracking-widest uppercase mb-2 md:mb-3">Focus principal</label>
                      <div className="grid grid-cols-2 gap-1.5 md:gap-2">
                        <button onClick={() => setFocus("Haut du corps")} className={`p-2 md:p-3 rounded-xl border text-[10px] md:text-sm font-medium transition-colors ${focus === "Haut du corps" ? "bg-strain/20 border-strain text-strain" : "bg-background border-border text-white hover:border-strain"}`}>Haut du corps</button>
                        <button onClick={() => setFocus("Bas du corps")} className={`p-2 md:p-3 rounded-xl border text-[10px] md:text-sm font-medium transition-colors ${focus === "Bas du corps" ? "bg-strain/20 border-strain text-strain" : "bg-background border-border text-white hover:border-strain"}`}>Bas du corps</button>
                        <button onClick={() => setFocus("Full Body")} className={`p-2 md:p-3 rounded-xl border text-[10px] md:text-sm font-medium transition-colors ${focus === "Full Body" ? "bg-strain/20 border-strain text-strain" : "bg-background border-border text-white hover:border-strain"}`}>Full Body</button>
                        <button onClick={() => setFocus("Cardio / Vitesse")} className={`p-2 md:p-3 rounded-xl border text-[10px] md:text-sm font-medium transition-colors ${focus === "Cardio / Vitesse" ? "bg-strain/20 border-strain text-strain" : "bg-background border-border text-white hover:border-strain"}`}>Cardio</button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] md:text-xs font-semibold text-text-muted tracking-widest uppercase mb-2 md:mb-3 flex items-center gap-1.5 md:gap-2"><UtensilsCrossed size={12} className="md:w-3.5 md:h-3.5"/> Instructions (optionnel)</label>
                      <input type="text" value={customNote} onChange={e => setCustomNote(e.target.value)} placeholder="Ex: Éviter les sauts, mal au dos..." className="w-full bg-background border border-border rounded-xl px-3 md:px-4 py-2.5 md:py-3 text-base md:text-sm text-white focus:outline-none focus:border-strain" />
                    </div>
                    <button onClick={generateWorkout} disabled={!focus} className="w-full bg-white text-black font-bold rounded-xl py-2.5 md:py-3 text-xs md:text-sm hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 mt-2 md:mt-4"><Sparkles size={14} className="md:w-[18px] md:h-[18px]" /> Générer ma séance</button>
                  </motion.div>
                )}
                {step === 6 && (
                  <div className="py-8 md:py-12 text-center">
                    {generating ? (
                      <>
                        <Sparkles size={32} className="mx-auto text-strain animate-bounce mb-3 md:mb-4 md:w-10 md:h-10" />
                        <p className="text-sm md:text-lg text-white font-medium">Analyse croisée...</p>
                        <div className="space-y-1 mt-3 md:mt-4 text-[10px] md:text-xs text-text-muted">
                          <p>✓ Récupération : {todayMetric?.recovery_score || 100}%</p>
                          <p>✓ Blessures : {contextData.injuries.length} active(s)</p>
                          <p>✓ Matériel : {equipment}</p>
                          <p>✓ Objectif : {contextData.weightGoal}</p>
                          <p>✓ Durée : {duration}</p>
                        </div>
                      </>
                    ) : <p className="text-recovery font-medium text-sm md:text-base">Séance générée !</p>}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ===== MODAL SUBSTITUTION D'EXERCICE ===== */}
      <AnimatePresence>
        {substitutionTarget && (
          <div onClick={closeSubstitution} className="fixed inset-0 z-[60] flex items-center justify-center p-3 md:p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface border border-border rounded-3xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-4 md:p-6 pb-3">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    <ArrowRightLeft size={16} className="text-strain" />
                    <h2 className="text-sm md:text-lg font-bold text-white">Remplacer un exercice</h2>
                  </div>
                  <button onClick={closeSubstitution} className="text-text-muted hover:text-white bg-background p-1.5 rounded-lg">
                    <X size={16} />
                  </button>
                </div>

                <div className="bg-background border border-border rounded-xl p-3 mb-3">
                  <p className="text-[10px] text-text-muted uppercase tracking-widest mb-1">À remplacer</p>
                  <p className="text-xs md:text-sm font-semibold text-white">{substitutionTarget.exercise.name}</p>
                  <p className="text-[10px] text-strain mt-0.5">{substitutionTarget.exercise.details}</p>
                </div>

                <div className="bg-warning/10 border border-warning/30 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldAlert size={14} className="text-warning shrink-0" />
                    <p className="text-[10px] font-bold text-warning uppercase tracking-widest">
                      Contraintes appliquées ({activeConstraintsCount})
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[9px] md:text-[10px]">
                    {contextData.injuries.length > 0 && (
                      <span className="bg-alert/20 text-alert px-2 py-0.5 rounded font-medium">
                        🩹 {contextData.injuries.map((i) => i.body_part).join(", ")}
                      </span>
                    )}
                    {todayMetric?.recovery_score < 50 && (
                      <span className="bg-warning/20 text-warning px-2 py-0.5 rounded font-medium">
                        😴 Récup {todayMetric.recovery_score}%
                      </span>
                    )}
                    {contextData.stress >= 4 && (
                      <span className="bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded font-medium">
                        🧠 Stress {contextData.stress}/5
                      </span>
                    )}
                    {equipment && (
                      <span className="bg-strain/20 text-strain px-2 py-0.5 rounded font-medium">
                        🏋️ {equipment}
                      </span>
                    )}
                    {focus && (
                      <span className="bg-recovery/20 text-recovery px-2 py-0.5 rounded font-medium">
                        🎯 {focus}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="px-4 md:px-6 pb-4 md:pb-6 overflow-y-auto custom-scrollbar flex-1">
                <form onSubmit={requestSubstitutes} className="space-y-3">
                  <input
                    type="text"
                    placeholder="Préférence (ex: plus de gainage) — optionnel"
                    value={substitutionPreference}
                    onChange={(e) => setSubstitutionPreference(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-3 md:px-4 py-2.5 text-xs md:text-sm text-white focus:outline-none focus:border-strain"
                  />
                  <button
                    type="submit"
                    disabled={substituting}
                    className="w-full bg-strain text-white font-semibold rounded-xl py-2.5 text-xs md:text-sm hover:bg-strain/80 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {substituting ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    {substituting ? "Recherche d'alternatives..." : substituteOptions.length > 0 ? "Regénérer" : "Trouver des alternatives"}
                  </button>
                </form>

                {substituteError && (
                  <div className="mt-3 bg-alert/10 border border-alert/30 rounded-xl p-3 flex items-start gap-2">
                    <AlertTriangle size={14} className="text-alert mt-0.5 shrink-0" />
                    <p className="text-[10px] md:text-xs text-alert">{substituteError}</p>
                  </div>
                )}

                {substituteWarning && (
                  <div className="mt-3 bg-warning/10 border border-warning/30 rounded-xl p-3 flex items-start gap-2">
                    <AlertTriangle size={14} className="text-warning mt-0.5 shrink-0" />
                    <p className="text-[10px] md:text-xs text-warning">{substituteWarning}</p>
                  </div>
                )}

                {substituting && (
                  <div className="py-6 text-center">
                    <Sparkles size={28} className="mx-auto text-strain animate-bounce mb-2" />
                    <p className="text-xs text-white font-medium">OMNIA cherche des alternatives sûres...</p>
                    <p className="text-[10px] text-text-muted mt-1">Vérification des blessures et du matériel.</p>
                  </div>
                )}

                {!substituting && substituteOptions.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {substituteOptions.map((opt, i) => (
                      <div key={i} className="bg-background border border-border rounded-2xl p-3">
                        <div className="flex justify-between items-start gap-2 mb-1">
                          <div className="flex-1">
                            <h3 className="font-bold text-white text-xs md:text-sm">{opt.name}</h3>
                            <p className="text-[10px] text-strain mt-0.5">{opt.details}</p>
                          </div>
                          <button
                            onClick={() => applySubstitution(opt)}
                            className="shrink-0 bg-white text-black text-[10px] font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                          >
                            Choisir
                          </button>
                        </div>
                        {opt.note && (
                          <p className="text-[10px] text-text-muted italic mt-1 flex items-start gap-1">
                            <Brain size={10} className="shrink-0 mt-0.5" /> {opt.note}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 text-[9px] mt-2 pt-2 border-t border-border/50">
                          <span className="text-text-muted flex items-center gap-1"><Clock size={9} /> {opt.rest}</span>
                          <span className="text-text-muted flex items-center gap-1"><Zap size={9} /> RPE {opt.rpe}</span>
                          <span className="text-recovery flex items-center gap-1 font-medium col-span-2 mt-1">
                            ✓ {opt.reason}
                          </span>
                        </div>
                      </div>
                    ))}
                    <p className="text-[9px] text-text-muted italic text-center pt-1">
                      L'exercice sera remplacé dans ta séance actuelle.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}