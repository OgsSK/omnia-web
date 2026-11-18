// src/app/page.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getUnifiedData } from "@/lib/data-hub"; // ✅ Import du Hub de données
import { 
  Zap, Moon, Timer, CheckCircle2, Sparkles, ArrowRight, 
  Activity, Bell, Settings, User, ChevronDown, 
  Check, BookOpen, BrainCircuit, ShieldAlert, RefreshCw,
  Edit2, Plus, X
} from "lucide-react";
import { SprintChart } from "@/components/SprintChart";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";

type Measurement = { id: string; value: number; measured_at: string; metric_type: string; unit?: string };
type DailyMetric = { date: string; sleep_hours: number; nap_hours?: number; fatigue_level: number; recovery_score: number };
type Goal = { id: string; title: string; target_value: number; current_value: number; unit: string; direction: string };
type JournalEntry = { id: string; content: string; created_at: string };
type Injury = { body_part: string; severity: number; status: string };

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("Utilisateur");
  const [userId, setUserId] = useState<string | null>(null);
  
  const [nowDate, setNowDate] = useState<Date | null>(null);
  const [today, setToday] = useState<string>("");
  const [todayDate, setTodayDate] = useState("");

  const [timeRange, setTimeRange] = useState<"today" | "7d" | "30d" | "all">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("omnia_timeRange");
      if (saved === "today" || saved === "7d" || saved === "30d" || saved === "all") return saved;
    }
    return "7d";
  });

  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  
  const [selectedChartTest, setSelectedChartTest] = useState("sprint_20m");
  const [showChartTestDropdown, setShowChartTestDropdown] = useState(false);

  // Données brutes
  const [allMeasurements, setAllMeasurements] = useState<Measurement[]>([]);
  const [metrics, setMetrics] = useState<DailyMetric[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [weight, setWeight] = useState<number | null>(null);
  const [injuries, setInjuries] = useState<Injury[]>([]);
  
  // Bilan Global OMNIA
  const [globalBrief, setGlobalBrief] = useState<string | null>(null);
  const [loadingBrief, setLoadingBrief] = useState(false);
  
  // OMNIA Status
  const [omniaData, setOmniaData] = useState<any>(null);
  const [loadingOmnia, setLoadingOmnia] = useState(false);

  // ✅ Check-in & Modale
  const [sleep, setSleep] = useState("7");
  const [nap, setNap] = useState("0");
  const [fatigue, setFatigue] = useState("2");
  const [savingCheckin, setSavingCheckin] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const now = new Date();
    setNowDate(now);
    setToday(now.toISOString().split("T")[0]);
    setTodayDate(now.toLocaleDateString("fr-FR", { weekday: 'long', day: 'numeric', month: 'long' }));
    fetchData();
  }, []);

  useEffect(() => {
    localStorage.setItem("omnia_timeRange", timeRange);
  }, [timeRange]);

  // ✅ MOTEUR TEMPS RÉEL
  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'health_metrics', filter: `user_id=eq.${userId}` }, (payload) => {
        if (payload.new && (payload.new as any).weight) setWeight((payload.new as any).weight);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'injuries', filter: `user_id=eq.${userId}` }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_metrics', filter: `user_id=eq.${userId}` }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'measurements', filter: `user_id=eq.${userId}` }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'omnia_sources', filter: `user_id=eq.${userId}` }, () => fetchData()) // ✅ Écoute aussi les nouveaux appareils
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      setUserName(user.user_metadata?.full_name || "Utilisateur");

      const todayStr = new Date().toISOString().split("T")[0];

      // ✅ APPEL AU HUB DE DONNÉES UNIFIÉES
      // Il va chercher en priorité les données "measured" (montres/balances) par rapport aux données manuelles
      const unifiedData = await getUnifiedData(user.id, todayStr);

      const [
        { data: measurementsData }, { data: metricData }, { data: goalData },
        { data: journalData }, { data: healthData }, { data: nutritionData }, { data: injuriesData }
      ] = await Promise.all([
        supabase.from("measurements").select("*").eq("user_id", user.id).order("measured_at", { ascending: false }),
        supabase.from("daily_metrics").select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(30),
        supabase.from("goals").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1),
        supabase.from("journal_entries").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(3),
        supabase.from("health_metrics").select("weight").eq("user_id", user.id).order("date", { ascending: false }).limit(1),
        supabase.from("meal_logs").select("date, calories").eq("user_id", user.id).order("date", { ascending: false }).limit(20),
        supabase.from("injuries").select("body_part, severity, status").eq("user_id", user.id).eq("status", "active")
      ]);

      if (measurementsData) {
        setAllMeasurements(measurementsData);
        if (measurementsData.length > 0) setSelectedChartTest(measurementsData[0].metric_type);
      }
      if (metricData) setMetrics(metricData);
      if (goalData) setGoals(goalData);
      if (journalData) setJournal(journalData);
      
      // ✅ Priorité au Hub de données pour le poids
      if (unifiedData.weight !== null) {
        setWeight(unifiedData.weight);
      } else if (healthData && healthData.length > 0 && healthData[0].weight) {
        setWeight(healthData[0].weight);
      }

      if (injuriesData) setInjuries(injuriesData);

      // Pré-remplir les valeurs du check-in avec celles d'aujourd'hui (ou unifiées)
      const todayData = metricData?.find(m => m.date === todayStr);
      if (todayData) {
        setSleep((unifiedData.sleep !== null ? unifiedData.sleep : todayData.sleep_hours).toString());
        setNap((todayData.nap_hours || 0).toString());
        setFatigue(todayData.fatigue_level.toString());
      }

      const measurementsSignature = measurementsData?.map(m => `${m.metric_type}:${m.value}`).join("|") || "none";
      const dataHash = `${timeRange}-${metricData?.[0]?.recovery_score || 0}-${weight || 0}-${measurementsSignature}-${injuriesData?.length || 0}-${journalData?.length || 0}`;
      
      const cachedHash = localStorage.getItem("omnia_data_hash");
      const cachedBrief = localStorage.getItem("omnia_global_brief");

      if (dataHash === cachedHash && cachedBrief) {
        setGlobalBrief(cachedBrief);
      } else if (metricData && measurementsData && nutritionData && injuriesData) {
        localStorage.setItem("omnia_data_hash", dataHash);
        generateGlobalBrief(metricData, measurementsData, nutritionData, injuriesData, journalData || []);
      }

      // On passe la vraie valeur unifiée à l'IA
      const finalRecovery = unifiedData.recovery !== null ? unifiedData.recovery : (metricData?.[0]?.recovery_score || 0);
      const finalSleep = unifiedData.sleep !== null ? unifiedData.sleep : (metricData?.[0]?.sleep_hours || 0);

      if (metricData && metricData.length > 0) {
        fetchOmniaIntelligence({ ...metricData[0], recovery_score: finalRecovery, sleep_hours: finalSleep }, journalData?.length || 0, measurementsData?.length || 0, injuriesData?.length || 0);
      } else {
        fetchOmniaIntelligence({ recovery_score: finalRecovery, sleep_hours: finalSleep, fatigue_level: metricData?.[0]?.fatigue_level || 0 }, journalData?.length || 0, measurementsData?.length || 0, injuriesData?.length || 0);
      }
    }
    setLoading(false);
  };

  const fetchOmniaIntelligence = async (todayMetric: any, journalCount: number, testsCount: number, injuriesCount: number) => {
    setLoadingOmnia(true);
    try {
      const res = await fetch("/api/omnia-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recovery: todayMetric.recovery_score || 0,
          sleep: todayMetric.sleep_hours || 0,
          fatigue: todayMetric.fatigue_level || 0,
          injuries: injuriesCount,
          journalCount,
          testsCount
        })
      });
      const data = await res.json();
      setOmniaData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingOmnia(false);
    }
  };

  const generateGlobalBrief = async (metricsData: DailyMetric[], measurements: Measurement[], nutrition: any[], injuriesData: any[], journalData: JournalEntry[]) => {
    setLoadingBrief(true);
    try {
      const res = await fetch("/api/global-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          metrics: metricsData.slice(0, 7), 
          measurements: measurements.slice(0, 5), 
          nutrition: nutrition.slice(0, 10), 
          injuries: injuriesData, 
          journal: journalData 
        })
      });
      const data = await res.json();
      setGlobalBrief(data.brief);
      localStorage.setItem("omnia_global_brief", data.brief);
    } catch (e) { console.error(e); } finally { setLoadingBrief(false); }
  };

  const forceRefreshBrief = () => {
    localStorage.removeItem("omnia_data_hash");
    localStorage.removeItem("omnia_global_brief");
    window.location.reload();
  };

  const handleCheckin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingCheckin(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const sleepHours = parseFloat(sleep) || 0;
      const napHours = parseFloat(nap) || 0;
      const fatigueLvl = parseInt(fatigue);
      
      const totalSleep = sleepHours + napHours;
      let score = 50 + (totalSleep * 5) - (fatigueLvl * 10);
      score = Math.max(0, Math.min(100, Math.round(score)));

      await supabase.from("daily_metrics").upsert({
        user_id: user.id, 
        date: new Date().toISOString().split("T")[0],
        sleep_hours: sleepHours, 
        nap_hours: napHours,
        fatigue_level: fatigueLvl, 
        recovery_score: score,
      }, { onConflict: "user_id,date" });
      
      setIsModalOpen(false);
      fetchData();
    }
    setSavingCheckin(false);
  };

  const addQuickNap = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const todayData = metrics.find(m => m.date === today);
      const currentNap = todayData?.nap_hours || 0;
      const currentSleep = todayData?.sleep_hours || 0;
      const currentFatigue = todayData?.fatigue_level || 2;
      
      const newNap = currentNap + 1;
      const totalSleep = currentSleep + newNap;
      let score = 50 + (totalSleep * 5) - (currentFatigue * 10);
      score = Math.max(0, Math.min(100, Math.round(score)));

      await supabase.from("daily_metrics").upsert({
        user_id: user.id, date: today,
        sleep_hours: currentSleep, nap_hours: newNap,
        fatigue_level: currentFatigue, recovery_score: score,
      }, { onConflict: "user_id,date" });
      
      fetchData();
    }
  };

  const getFilteredData = <T extends { [key: string]: any }>(data: T[], dateField: keyof T) => {
    if (!nowDate) return [];
    let cutoff = new Date();
    if (timeRange === 'today') cutoff.setHours(0, 0, 0, 0);
    else if (timeRange === '7d') cutoff.setDate(nowDate.getDate() - 7);
    else if (timeRange === '30d') cutoff.setDate(nowDate.getDate() - 30);
    else return data;
    return data.filter(item => new Date(item[dateField]) >= cutoff);
  };

  const filteredMeasurements = getFilteredData(allMeasurements, 'measured_at');
  const filteredMetrics = getFilteredData(metrics, 'date');
  const todayMetric = metrics.find(m => m.date === today);
  
  const lastTest = allMeasurements.length > 0 ? allMeasurements[0] : null;
  const testName = lastTest ? lastTest.metric_type.replace(/_/g, ' ').replace('sprint ', 'Sprint ') : "--";
  const testValue = lastTest ? lastTest.value : null;

  const chartData = filteredMeasurements.filter(m => m.metric_type === selectedChartTest).sort((a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime());
  const availableChartTests = useMemo(() => Array.from(new Set(allMeasurements.map(m => m.metric_type))), [allMeasurements]);

  const avgSleep = filteredMetrics.length > 0 ? (filteredMetrics.reduce((acc, curr) => acc + (curr.sleep_hours || 0), 0) / filteredMetrics.length).toFixed(1) : null;
  const activeGoal = goals.length > 0 ? goals[0] : null;
  const goalProgress = activeGoal ? Math.min(100, Math.round((activeGoal.current_value / activeGoal.target_value) * 100)) : 0;
  
  const mockCharge = filteredMeasurements.length * 120 + journal.length * 50;

  const dateLabels: Record<string, string> = { today: todayDate, "7d": "7 derniers jours", "30d": "30 derniers jours", "all": "Tout l'historique" };

  const recoveryScore = todayMetric ? todayMetric.recovery_score : 50;
  const weightFactor = weight ? weight / 75 : 1; 
  const shoulderWidth = Math.max(60, Math.min(100, 80 * (1 + (weightFactor - 1) * 0.3))); 
  const waistWidth = Math.max(50, Math.min(90, 70 * (1 + (weightFactor - 1) * 0.5)));

  const veinColor = recoveryScore >= 70 ? "#0093E7" : recoveryScore >= 40 ? "#FFD60A" : "#FF3B30";
  const brainColor = journal.length > 0 ? "#AF52DE" : "#636366";
  
  const getInjuryCoords = (part: string) => {
    const p = part.toLowerCase();
    if (p.includes("épaule") || p.includes("clavicule")) return { x: 110, y: 150, side: "right" };
    if (p.includes("bras") || p.includes("biceps")) return { x: 50, y: 180, side: "left" };
    if (p.includes("coude")) return { x: 40, y: 220, side: "left" };
    if (p.includes("poignet")) return { x: 30, y: 270, side: "left" };
    if (p.includes("dos") || p.includes("lombaire")) return { x: 100, y: 200, side: "right" };
    if (p.includes("pectoral") || p.includes("torse")) return { x: 115, y: 170, side: "right" };
    if (p.includes("abdo")) return { x: 100, y: 220, side: "left" };
    if (p.includes("hanche") || p.includes("bassin")) return { x: 100, y: 270, side: "right" };
    if (p.includes("cuisse") || p.includes("quadriceps") || p.includes("ischio")) return { x: 80, y: 330, side: "left" };
    if (p.includes("genou")) return { x: 80, y: 400, side: "left" };
    if (p.includes("mollet") || p.includes("tibia")) return { x: 75, y: 450, side: "right" };
    if (p.includes("cheville") || p.includes("pied")) return { x: 70, y: 500, side: "right" };
    return { x: 100, y: 200, side: "right" };
  };

  const getOmniaStatusColor = (status: string) => {
    switch (status) {
      case 'optimal': return 'text-green-400';
      case 'rest': return 'text-red-400';
      case 'warning': return 'text-orange-400';
      default: return 'text-blue-400';
    }
  };

  if (loading || !nowDate) return <div className="p-8 text-white min-h-screen bg-[#020202]">Initialisation du Bio-Scan...</div>;

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto bg-[#020202] min-h-screen">
      
      {/* HEADER */}
      <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">Bonjour {userName.split(' ')[0]} 👋</h1>
          <p className="text-xs md:text-sm text-text-muted mt-1">Voici ton bilan de forme global.</p>
        </div>
        
        <div className="flex items-center justify-between md:justify-end gap-2 md:gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:flex-none">
            <button onClick={() => setShowDateDropdown(!showDateDropdown)} className={`w-full flex items-center justify-between md:justify-start gap-2 border rounded-lg px-3 py-2 text-xs md:text-sm transition-colors ${showDateDropdown ? 'bg-surface-hover border-strain/50 text-white' : 'bg-surface border-border text-white hover:bg-surface-hover'}`}>
              {dateLabels[timeRange]} <ChevronDown size={14} className={`text-text-muted transition-transform ${showDateDropdown ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {showDateDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowDateDropdown(false)} />
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute right-0 top-12 w-48 bg-surface border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
                    {(["today", "7d", "30d", "all"] as const).map((range) => (
                      <button key={range} onClick={() => { setTimeRange(range); setShowDateDropdown(false); }} className={`w-full text-left px-4 py-3 text-sm transition-colors flex items-center justify-between ${timeRange === range ? 'bg-strain/10 text-strain font-medium' : 'text-text-muted hover:bg-surface-hover hover:text-white'}`}>
                        {dateLabels[range]} {timeRange === range && <Check size={14} />}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
          
          <div className="flex gap-2 shrink-0">
            <div className="relative">
              <button onClick={() => setShowNotifications(!showNotifications)} className={`w-9 h-9 md:w-10 md:h-10 rounded-lg border flex items-center justify-center relative transition-colors ${showNotifications ? 'bg-surface-hover border-strain/50' : 'bg-surface border-border hover:bg-surface-hover'}`}>
                <Bell size={16} className={showNotifications ? "text-strain" : "text-white"} />
                {!todayMetric && <span className="absolute top-2 right-2 w-2 h-2 md:w-2.5 md:h-2.5 bg-alert rounded-full border-2 border-surface animate-pulse"></span>}
              </button>
              <AnimatePresence>
                {showNotifications && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }} 
                      animate={{ opacity: 1, y: 0, scale: 1 }} 
                      exit={{ opacity: 0, y: 10, scale: 0.95 }} 
                      className="absolute right-0 top-12 w-[calc(100vw-2rem)] max-w-[320px] md:w-80 bg-surface border border-border rounded-2xl shadow-2xl z-50 overflow-hidden origin-top-right"
                    >
                      <div className="p-4 border-b border-border flex justify-between items-center bg-surface-hover/30">
                        <h3 className="text-sm font-semibold text-white">Notifications</h3>
                        <span className="text-[10px] bg-strain/20 text-strain px-2 py-0.5 rounded-full font-bold">{!todayMetric ? 1 : 0}</span>
                      </div>
                      <div className="max-h-80 overflow-y-auto custom-scrollbar">
                        {!todayMetric ? (
                          <button onClick={() => { setIsModalOpen(true); setShowNotifications(false); }} className="w-full text-left p-4 border-b border-border/50 hover:bg-surface-hover transition-colors flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-warning/10 text-warning"><Activity size={14} /></div>
                            <div><p className="text-xs font-semibold text-white mb-0.5">Check-in en attente</p><p className="text-[10px] text-text-muted leading-relaxed">Cliquez ici pour le faire.</p></div>
                          </button>
                        ) : (
                          <div className="p-8 text-center"><Bell size={24} className="mx-auto text-text-muted mb-2 opacity-50" /><p className="text-sm text-text-muted">Vous êtes à jour !</p></div>
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            <Link href="/settings" className="w-9 h-9 md:w-10 md:h-10 rounded-lg bg-surface border border-border flex items-center justify-center hover:bg-surface-hover">
              <Settings size={16} className="text-white" />
            </Link>
          </div>
        </div>
      </header>

      {/* TOP METRICS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4 mb-6">
        <div className="bg-surface border border-border rounded-2xl p-3 md:p-4 flex flex-col justify-between relative overflow-hidden group col-span-1">
          <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-4 relative z-10">
            <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-recovery/10 flex items-center justify-center"><Activity size={14} className="text-recovery" /></div>
            <span className="text-[10px] md:text-xs font-semibold text-text-muted tracking-widest uppercase truncate">Forme</span>
          </div>
          <div className="relative z-10 flex items-baseline gap-1">
            <span className="text-2xl md:text-3xl font-bold text-white">{todayMetric ? todayMetric.recovery_score : "--"}</span>
            <span className="text-xs md:text-sm text-text-muted">/100</span>
          </div>
          <div className="hidden md:block text-xs font-medium mt-2 relative z-10 text-text-muted">{todayMetric ? "Check-in validé" : "Check-in requis"}</div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-3 md:p-4 flex flex-col justify-between relative overflow-hidden group col-span-1">
          <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-4 relative z-10">
            <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-strain/10 flex items-center justify-center"><Timer size={14} className="text-strain" /></div>
            <span className="text-[10px] md:text-xs font-semibold text-text-muted tracking-widest uppercase truncate" title={testName}>Dernier : {testName}</span>
          </div>
          <div className="relative z-10 flex items-baseline gap-1">
            <span className="text-2xl md:text-3xl font-bold text-white">{lastTest ? testValue?.toFixed(2) : "--"}</span>
            <span className="text-xs md:text-sm text-text-muted">{lastTest?.unit || ""}</span>
          </div>
          <Link href="/football" className="hidden md:block text-xs font-medium mt-2 relative z-10 text-strain hover:underline">Voir tests</Link>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-3 md:p-4 flex flex-col justify-between relative overflow-hidden group col-span-1">
          <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-4 relative z-10">
            <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-purple-500/10 flex items-center justify-center"><Zap size={14} className="text-purple-500" /></div>
            <span className="text-[10px] md:text-xs font-semibold text-text-muted tracking-widest uppercase truncate">Charge</span>
          </div>
          <div className="relative z-10 flex items-baseline gap-1">
            <span className="text-2xl md:text-3xl font-bold text-white">{mockCharge}</span>
            <span className="text-xs md:text-sm text-text-muted">U.A.</span>
          </div>
          <div className="hidden md:block text-xs font-medium mt-2 relative z-10 text-strain">Sur la période</div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-3 md:p-4 flex flex-col justify-between relative overflow-hidden group col-span-1">
          <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-4 relative z-10">
            <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-blue-500/10 flex items-center justify-center"><Moon size={14} className="text-blue-500" /></div>
            <span className="text-[10px] md:text-xs font-semibold text-text-muted tracking-widest uppercase truncate">Sommeil</span>
          </div>
          <div className="relative z-10 flex items-baseline gap-1">
            <span className="text-2xl md:text-3xl font-bold text-white">{avgSleep || "--"}</span>
            <span className="text-xs md:text-sm text-text-muted">h</span>
          </div>
          <div className="hidden md:block text-xs font-medium mt-2 relative z-10 text-text-muted">{timeRange === 'today' ? "Cette nuit" : `Sur ${dateLabels[timeRange]}`}</div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-3 md:p-4 flex flex-col justify-between relative overflow-hidden group col-span-2 md:col-span-1">
          <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-4 relative z-10">
            <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-yellow-500/10 flex items-center justify-center"><User size={14} className="text-yellow-500" /></div>
            <span className="text-[10px] md:text-xs font-semibold text-text-muted tracking-widest uppercase truncate">Poids</span>
          </div>
          <div className="relative z-10 flex items-baseline gap-1">
            <span className="text-2xl md:text-3xl font-bold text-white">{weight || "--"}</span>
            <span className="text-xs md:text-sm text-text-muted">kg</span>
          </div>
          <Link href="/health" className="hidden md:block text-xs font-medium mt-2 relative z-10 text-strain hover:underline">Mettre à jour</Link>
        </div>
      </div>

      {/* SECTION BIO-SCAN */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 mb-6">
        
        <div className="lg:col-span-8 bg-[#050505] border border-border rounded-3xl relative overflow-hidden flex flex-col min-h-[350px] md:min-h-[500px]">
          
          <div className="absolute top-4 left-4 md:top-6 md:left-6 z-20">
            <h2 className="text-sm md:text-xl font-bold text-white flex items-center gap-2">
              <User className="text-strain" size={16} /> Bio-Scan
            </h2>
          </div>

          <div className="absolute top-4 right-4 md:top-6 md:right-6 z-20 flex flex-col gap-2">
            {injuries.length > 0 ? (
              injuries.map((inj, i) => (
                <div key={i} className="bg-alert/10 border border-alert/30 px-2 py-1 md:px-3 md:py-1.5 rounded-lg flex items-center gap-1 md:gap-2 animate-pulse">
                  <ShieldAlert size={12} className="text-alert" />
                  <span className="text-[10px] md:text-xs font-semibold text-alert">{inj.body_part}</span>
                </div>
              ))
            ) : (
              <div className="bg-recovery/10 border border-recovery/30 px-2 py-1 md:px-3 md:py-1.5 rounded-lg flex items-center gap-1 md:gap-2">
                <CheckCircle2 size={12} className="text-recovery" />
                <span className="text-[10px] md:text-xs font-semibold text-recovery">OK</span>
              </div>
            )}
          </div>

          <div className="absolute inset-0 bg-[linear-gradient(to_right,#0093E7_1px,transparent_1px),linear-gradient(to_bottom,#0093E7_1px,transparent_1px)] bg-[size:20px_20px] md:bg-[size:40px_40px] opacity-[0.03] pointer-events-none"></div>
          
          <motion.div animate={{ y: ["-100%", "100%"] }} transition={{ repeat: Infinity, duration: 4, ease: "linear" }} className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-strain to-transparent opacity-50 shadow-[0_0_20px_#0093E7] z-10 pointer-events-none" />

          <div className="flex-1 flex items-center justify-center relative z-10 p-4 md:p-10 mt-10 md:mt-0">
            <svg viewBox="0 0 400 600" className="w-full max-w-[260px] md:max-w-none h-auto max-h-[350px] md:max-h-[550px] drop-shadow-[0_0_30px_rgba(0,147,231,0.1)]">
              
              <defs>
                <linearGradient id="bodyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={veinColor} stopOpacity="0.15" />
                  <stop offset="100%" stopColor={veinColor} stopOpacity="0" />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>

              <g opacity="0.4">
                <path 
                  d={`M200 80 
                     Q${200 + shoulderWidth} 90 ${200 + shoulderWidth + 10} 150 
                     Q${200 + waistWidth} 250 ${200 + waistWidth - 10} 320
                     L240 520 Q240 560 220 580 L180 580 Q160 560 160 520 L${200 - waistWidth + 10} 320
                     Q${200 - waistWidth} 250 ${200 - shoulderWidth - 10} 150
                     Q${200 - shoulderWidth} 90 200 80 Z`} 
                  fill="url(#bodyGradient)" 
                  stroke={veinColor} 
                  strokeWidth="1.5"
                  strokeDasharray="6 6"
                />
              </g>

              <g stroke={brainColor} strokeWidth="1" opacity="0.6">
                <circle cx="200" cy="70" r="25" fill="none" strokeWidth="2" />
                <path d="M200 45 Q220 60 200 85" fill="none" />
                <path d="M200 45 Q180 60 200 85" fill="none" />
                <circle cx="200" cy="70" r="4" fill={brainColor} filter="url(#glow)"/>
                <line x1="200" y1="70" x2="185" y2="55" />
                <line x1="200" y1="70" x2="215" y2="55" />
                <line x1="200" y1="70" x2="185" y2="85" />
                <line x1="200" y1="70" x2="215" y2="85" />
              </g>

              <path d="M200 95 L200 300" stroke="#A1A1A6" strokeWidth="3" strokeDasharray="4 4" opacity="0.5"/>

              <g stroke="#0093E7" strokeWidth="1.5" fill="none" opacity="0.6">
                <path d="M200 110 Q240 120 240 160" />
                <path d="M200 130 Q245 140 245 180" />
                <path d="M200 150 Q240 160 240 200" />
                <path d="M200 110 Q160 120 160 160" />
                <path d="M200 130 Q155 140 155 180" />
                <path d="M200 150 Q160 160 160 200" />
              </g>

              <g stroke={veinColor} strokeWidth="2" fill="none" filter="url(#glow)">
                <motion.path d="M200 120 L200 280" strokeDasharray="10 10" animate={{ strokeDashoffset: [0, -40] }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }} />
                <motion.path d="M200 140 Q140 150 110 250" strokeDasharray="8 8" animate={{ strokeDashoffset: [0, -40] }} transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }} />
                <motion.path d="M200 140 Q260 150 290 250" strokeDasharray="8 8" animate={{ strokeDashoffset: [0, -40] }} transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }} />
                <motion.path d="M190 280 L180 450 L170 550" strokeDasharray="8 8" animate={{ strokeDashoffset: [0, -40] }} transition={{ repeat: Infinity, duration: 3, ease: "linear" }} />
                <motion.path d="M210 280 L220 450 L230 550" strokeDasharray="8 8" animate={{ strokeDashoffset: [0, -40] }} transition={{ repeat: Infinity, duration: 3, ease: "linear" }} />
              </g>

              <g transform="translate(200, 180)">
                <motion.path d="M0 5 A5 5 0 0 1 10 5 A5 5 0 0 1 20 5 Q20 15 10 25 Q0 15 0 5 Z" fill={veinColor} animate={{ scale: [1, 1.2, 1], opacity: [0.6, 1, 0.6] }} transition={{ repeat: Infinity, duration: recoveryScore >= 70 ? 1 : 2 }} filter="url(#glow)" />
              </g>

              <g className="block" transform="translate(80, 60)">
                <line x1="0" y1="10" x2="90" y2="10" stroke={brainColor} strokeWidth="1" strokeDasharray="3 3" opacity="0.5"/>
                <circle cx="95" cy="10" r="3" fill={brainColor} />
                <rect x="0" y="-2" width="75" height="22" rx="4" fill="#111" stroke={brainColor} strokeWidth="1"/>
                <text x="37.5" y="12" fill="#FFF" fontSize="10" textAnchor="middle" fontWeight="bold">MENTAL: {journal.length > 0 ? '85%' : '30%'}</text>
              </g>

              <g className="block" transform="translate(230, 170)">
                <line x1="0" y1="10" x2="-30" y2="10" stroke={veinColor} strokeWidth="1" strokeDasharray="3 3" opacity="0.5"/>
                <circle cx="-35" cy="10" r="3" fill={veinColor} />
                <rect x="0" y="-2" width="85" height="22" rx="4" fill="#111" stroke={veinColor} strokeWidth="1"/>
                <text x="42.5" y="12" fill="#FFF" fontSize="10" textAnchor="middle" fontWeight="bold">RÉCUP: {recoveryScore}%</text>
              </g>

              <g className="block" transform="translate(80, 250)">
                <line x1="0" y1="10" x2="30" y2="10" stroke="#0093E7" strokeWidth="1" strokeDasharray="3 3" opacity="0.5"/>
                <circle cx="35" cy="10" r="3" fill="#0093E7" />
                <rect x="0" y="-2" width="85" height="22" rx="4" fill="#111" stroke="#0093E7" strokeWidth="1"/>
                <text x="42.5" y="12" fill="#FFF" fontSize="10" textAnchor="middle" fontWeight="bold">PERF: {allMeasurements.length > 0 ? '90%' : '0%'}</text>
              </g>

              <g className="block" transform="translate(230, 280)">
                <line x1="0" y1="10" x2="-40" y2="10" stroke="#FFD60A" strokeWidth="1" strokeDasharray="3 3" opacity="0.5"/>
                <circle cx="-45" cy="10" r="3" fill="#FFD60A" />
                <rect x="0" y="-2" width="85" height="22" rx="4" fill="#111" stroke="#FFD60A" strokeWidth="1"/>
                <text x="42.5" y="12" fill="#FFF" fontSize="10" textAnchor="middle" fontWeight="bold">MASSE: {weight || '--'} kg</text>
              </g>

              {injuries.map((inj, idx) => {
                const coords = getInjuryCoords(inj.body_part);
                const isRight = coords.side === "right";
                const lineEndX = isRight ? coords.x + 50 : coords.x - 50;
                
                return (
                  <g key={idx}>
                    <motion.circle cx={coords.x} cy={coords.y} r="10" fill="none" stroke="#FF3B30" strokeWidth="2" animate={{ scale: [1, 1.5], opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 1.5 }} />
                    <circle cx={coords.x} cy={coords.y} r="4" fill="#FF3B30" filter="url(#glow)"/>
                    
                    <line x1={coords.x} y1={coords.y} x2={lineEndX} y2={coords.y - 20} stroke="#FF3B30" strokeWidth="1" strokeDasharray="2 2" />
                    
                    <rect x={isRight ? lineEndX : lineEndX - 60} y={coords.y - 35} width="60" height="16" rx="3" fill="#FF3B30" stroke="#FFF" strokeWidth="1"/>
                    <text x={isRight ? lineEndX + 30 : lineEndX - 30} y={coords.y - 23} fill="#FFF" fontSize="7" textAnchor="middle" fontWeight="bold">
                      {inj.body_part.toUpperCase()}: {inj.severity}/5
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="hidden md:flex absolute bottom-6 w-full justify-center gap-6 z-20">
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-strain"></div><span className="text-[10px] text-text-muted uppercase">Système Nerveux</span></div>
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: veinColor }}></div><span className="text-[10px] text-text-muted uppercase">Circulation</span></div>
            {injuries.length > 0 && <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-alert animate-pulse"></div><span className="text-[10px] text-text-muted uppercase">Traumatisme</span></div>}
          </div>
        </div>

        <div className="lg:col-span-4 bg-purple-500/5 border border-purple-500/20 rounded-3xl p-4 md:p-6 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 blur-3xl pointer-events-none rounded-full" />
          
          <div>
            <div className="flex items-center justify-between mb-3 md:mb-4 relative z-10">
              <div className="flex items-center gap-2">
                <BrainCircuit className="text-purple-500" size={18} />
                <h3 className="text-[10px] md:text-xs font-semibold tracking-widest text-purple-400 uppercase">Diagnostic OMNIA</h3>
              </div>
              <button onClick={forceRefreshBrief} className="text-text-muted hover:text-white p-1 rounded transition-colors" title="Forcer l'analyse">
                <RefreshCw size={14} />
              </button>
            </div>
            
            <div className="relative z-10 space-y-3 md:space-y-4">
              <div className="bg-background/50 border border-purple-500/20 rounded-xl p-3 md:p-4">
                <p className="text-[10px] md:text-xs text-purple-300 font-semibold mb-1 uppercase tracking-widest">État du jour</p>
                <div className="text-xs md:text-sm text-text-main leading-relaxed">
                  {loadingBrief ? (
                    <span className="animate-pulse">Analyse en cours...</span>
                  ) : globalBrief ? (
                    <ReactMarkdown components={{
                      strong: ({node, ...props}) => <span className="font-bold text-white" {...props} />,
                      li: ({node, ...props}) => <li className="ml-4 list-disc marker:text-purple-500 mb-1" {...props} />,
                      p: ({node, ...props}) => <p className="mb-2" {...props} />,
                    }}>
                      {globalBrief}
                    </ReactMarkdown>
                  ) : (
                    "Aucun diagnostic disponible."
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5 md:gap-3">
                <div className="bg-background/50 border border-purple-500/20 rounded-xl p-2 md:p-3 text-center">
                  <p className="text-[9px] md:text-[10px] text-text-muted uppercase mb-1">Récup</p>
                  <p className={`text-lg md:text-2xl font-bold ${recoveryScore >= 70 ? 'text-recovery' : recoveryScore >= 40 ? 'text-warning' : 'text-alert'}`}>{recoveryScore}%</p>
                </div>
                <div className="bg-background/50 border border-purple-500/20 rounded-xl p-2 md:p-3 text-center">
                  <p className="text-[9px] md:text-[10px] text-text-muted uppercase mb-1">Tests</p>
                  <p className="text-lg md:text-2xl font-bold text-white">{filteredMeasurements.length}</p>
                </div>
                <div className="bg-background/50 border border-purple-500/20 rounded-xl p-2 md:p-3 text-center">
                  <p className="text-[9px] md:text-[10px] text-text-muted uppercase mb-1">Période</p>
                  <p className="text-[10px] md:text-xs font-bold text-purple-400 capitalize mt-1">{timeRange === "today" ? "Auj." : timeRange === "7d" ? "7j" : timeRange === "30d" ? "30j" : "Tout"}</p>
                </div>
              </div>
            </div>
          </div>

          <Link href="/twin" className="w-full mt-4 md:mt-6 bg-purple-500/20 text-purple-400 font-semibold rounded-xl py-2 md:py-3 text-xs md:text-sm hover:bg-purple-500/30 transition-colors flex items-center justify-center gap-2 relative z-10">
            Voir le Jumeau <ArrowRight size={14} className="md:w-4 md:h-4" />
          </Link>
        </div>
      </div>

      {/* BOTTOM ROW (Graphique + Check-in + Recommandation) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 mb-6">
        <div className="lg:col-span-6 bg-surface border border-border rounded-2xl p-4 md:p-6 relative">
          <div className="flex justify-between items-center mb-4 md:mb-6">
            <h2 className="text-sm md:text-lg font-semibold text-white">Progression</h2>
            
            <div className="relative">
              <button onClick={() => setShowChartTestDropdown(!showChartTestDropdown)} className="flex items-center gap-2 bg-background border border-border rounded-lg px-2 py-1 md:px-3 md:py-1.5 text-[10px] md:text-xs text-white hover:bg-surface-hover transition-colors">
                {selectedChartTest.replace(/_/g, ' ')} <ChevronDown size={12} className="md:w-3.5 md:h-3.5" />
              </button>
              
              <AnimatePresence>
                {showChartTestDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowChartTestDropdown(false)} />
                    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }} className="absolute right-0 top-10 w-40 bg-surface border border-border rounded-xl shadow-2xl z-50 overflow-hidden max-h-60 overflow-y-auto custom-scrollbar">
                      {availableChartTests.length === 0 ? (
                        <p className="p-3 text-[10px] md:text-xs text-text-muted">Aucun test</p>
                      ) : (
                        availableChartTests.map(test => (
                          <button key={test} onClick={() => { setSelectedChartTest(test); setShowChartTestDropdown(false); }} className={`w-full text-left px-3 py-2 text-[10px] md:text-xs capitalize transition-colors ${selectedChartTest === test ? 'bg-strain/10 text-strain font-medium' : 'text-text-muted hover:bg-surface-hover hover:text-white'}`}>
                            {test.replace(/_/g, ' ')}
                          </button>
                        ))
                      )}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
          
          <div className="h-48 md:h-64 w-full">
            {chartData.length > 0 ? (
              <SprintChart data={chartData.map(s => ({ date: s.measured_at, value: s.value }))} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center border border-dashed border-border rounded-xl">
                <Activity size={24} className="text-text-muted mb-2 opacity-50 md:w-8 md:h-8 md:mb-4" />
                <p className="text-xs md:text-sm text-text-muted mb-4">Aucun test enregistré pour cette période.</p>
                <Link href="/football" className="bg-white text-black font-semibold text-[10px] md:text-sm rounded-lg md:rounded-xl px-4 py-1.5 md:px-6 md:py-2">Aller au Labo</Link>
              </div>
            )}
          </div>
        </div>

        {/* ✅ CARTE CHECK-IN */}
        <div id="checkin-card" className="lg:col-span-3 bg-surface border border-border rounded-2xl p-4 md:p-5 relative group">
          <div className="flex justify-between items-center mb-3 md:mb-4">
            <h3 className="text-xs md:text-sm font-semibold text-white">Récupération</h3>
            {todayMetric && (
              <button onClick={() => setIsModalOpen(true)} className="text-text-muted hover:text-strain transition-colors p-1">
                <Edit2 size={14} />
              </button>
            )}
          </div>
          
          {todayMetric ? (
            <div className="space-y-3 md:space-y-4">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="relative w-12 h-12 md:w-16 md:h-16 flex items-center justify-center shrink-0">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="50%" cy="50%" r="40%" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-background" />
                    <circle cx="50%" cy="50%" r="40%" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray="175" strokeDashoffset={175 - (175 * todayMetric.recovery_score) / 100} className={todayMetric.recovery_score >= 70 ? "text-recovery" : todayMetric.recovery_score >= 40 ? "text-warning" : "text-alert"} />
                  </svg>
                  <span className="absolute text-xs md:text-sm font-bold text-white">{todayMetric.recovery_score}%</span>
                </div>
                <div className="flex-1 space-y-1 md:space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-text-muted">Sommeil</span> <span className="text-white">{todayMetric.sleep_hours}h</span></div>
                  <div className="flex justify-between"><span className="text-text-muted">Sieste</span> <span className="text-white">{todayMetric.nap_hours || 0}h</span></div>
                  <div className="flex justify-between"><span className="text-text-muted">Fatigue</span> <span className="text-white">{todayMetric.fatigue_level}/5</span></div>
                </div>
              </div>
              
              <button 
                onClick={addQuickNap}
                className="w-full bg-surface-hover border border-border text-white font-semibold rounded-lg py-1.5 text-xs hover:bg-border transition-colors flex items-center justify-center gap-1"
              >
                <Plus size={12} /> Ajouter une sieste (+1h)
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="w-full bg-white text-black font-semibold rounded-lg py-3 text-xs hover:bg-gray-200 transition-colors"
            >
              Faire mon Check-in
            </button>
          )}
        </div>

        <div className="lg:col-span-3 bg-surface border border-border rounded-2xl p-4 md:p-5">
          <h3 className="text-xs md:text-sm font-semibold text-white mb-2 flex items-center gap-2">
            <Sparkles size={14} className={omniaData ? getOmniaStatusColor(omniaData.status) : "text-purple-500"}/> Recommandation
          </h3>
          <p className="text-[10px] md:text-xs text-text-muted leading-relaxed mb-3 md:mb-4 line-clamp-3 md:line-clamp-none">
            {loadingOmnia ? (
              <span className="animate-pulse">Analyse croisée en cours...</span>
            ) : omniaData ? (
              omniaData.recommendation
            ) : (
              "Maintiens ta charge actuelle et privilégie ton sommeil."
            )}
          </p>
          <div className="text-right mt-auto">
            <Link href="/omnia" className="text-[10px] md:text-xs text-purple-400 font-semibold hover:underline">Demander à OMNIA →</Link>
          </div>
        </div>
      </div>

      {/* BOTTOM ROW 2 (Notes + Objectif) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-surface border border-border rounded-2xl p-4 md:p-5">
          <div className="flex justify-between items-center mb-3 md:mb-4">
            <h3 className="text-xs md:text-sm font-semibold text-white">Notes</h3>
            <Link href="/journal" className="text-[10px] md:text-xs text-strain hover:underline">Voir tout →</Link>
          </div>
          <div className="space-y-2 md:space-y-3">
            {journal.length === 0 ? (
              <p className="text-[10px] md:text-xs text-text-muted italic">Aucune note.</p>
            ) : (
              journal.map((j) => (
                <div key={j.id} className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <BookOpen size={12} className="text-text-muted mt-0.5 shrink-0 md:w-3.5 md:h-3.5" />
                    <div>
                      <p className="text-[10px] md:text-xs font-medium text-white line-clamp-1">{j.content}</p>
                      <p className="text-[9px] md:text-[10px] text-text-muted">{new Date(j.created_at).toLocaleDateString("fr-FR")}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-4 md:p-5">
          <div className="flex justify-between items-center mb-3 md:mb-4">
            <h3 className="text-xs md:text-sm font-semibold text-white">Objectif</h3>
            <Link href="/goals" className="text-[10px] md:text-xs text-strain hover:underline">Gérer →</Link>
          </div>
          {activeGoal ? (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Timer size={12} className="text-text-muted" />
                <p className="text-[10px] md:text-xs text-white">{activeGoal.title}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-background rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${goalProgress >= 100 ? 'bg-recovery' : 'bg-strain'}`} style={{ width: `${goalProgress}%` }}></div>
                </div>
                <span className="text-[9px] md:text-[10px] text-white font-bold">{goalProgress}%</span>
              </div>
              <p className="text-[9px] md:text-[10px] text-text-muted mt-2 text-right">Cible : {activeGoal.target_value} {activeGoal.unit}</p>
            </div>
          ) : (
            <div className="text-center py-1">
              <p className="text-[10px] md:text-xs text-text-muted mb-1">Aucun objectif.</p>
              <Link href="/goals" className="text-[10px] md:text-xs text-strain hover:underline">Créer</Link>
            </div>
          )}
        </div>
      </div>

      {/* ✅ MODALE DE CHECK-IN */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="bg-surface border border-border rounded-3xl p-6 w-full max-w-md relative"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Activity className="text-strain" size={20} /> 
                  {todayMetric ? "Modifier le Check-in" : "Check-in du jour"}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="text-text-muted hover:text-white bg-background p-2 rounded-lg">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCheckin} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase mb-2">Sommeil nuit (h)</label>
                    <input type="number" step="0.5" min="0" value={sleep} onChange={e => setSleep(e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-strain" placeholder="7.5" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase mb-2">Sieste (h)</label>
                    <input type="number" step="0.5" min="0" value={nap} onChange={e => setNap(e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-strain" placeholder="0" />
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-semibold text-text-muted uppercase">Niveau de fatigue (1-5)</label>
                    <span className="text-xs font-bold text-strain">{fatigue}/5</span>
                  </div>
                  <input type="range" min="1" max="5" value={fatigue} onChange={e => setFatigue(e.target.value)} className="w-full accent-strain" />
                </div>

                <div className="bg-background/50 p-4 rounded-xl border border-border/50 mt-4">
                  <p className="text-xs text-text-muted mb-1">Score de récupération estimé</p>
                  <p className={`text-2xl font-bold ${
                    (50 + ((parseFloat(sleep) + parseFloat(nap)) * 5) - (parseInt(fatigue) * 10)) >= 70 ? 'text-recovery' : 
                    (50 + ((parseFloat(sleep) + parseFloat(nap)) * 5) - (parseInt(fatigue) * 10)) >= 40 ? 'text-warning' : 'text-alert'
                  }`}>
                    {Math.max(0, Math.min(100, Math.round(50 + ((parseFloat(sleep) || 0) + (parseFloat(nap) || 0)) * 5 - (parseInt(fatigue) || 0) * 10)))}%
                  </p>
                </div>

                <div className="pt-4 flex gap-2">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-surface-hover border border-border rounded-xl text-sm font-semibold text-white hover:bg-border transition-colors">
                    Annuler
                  </button>
                  <button type="submit" disabled={savingCheckin} className="flex-1 py-3 bg-white text-black rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors disabled:opacity-50">
                    {savingCheckin ? "Enregistrement..." : "Enregistrer"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}