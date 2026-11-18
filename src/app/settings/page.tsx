// src/app/settings/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import JSZip from "jszip";
import Papa from "papaparse";
import { 
  User, Save, Bell, ShieldAlert, 
  Download, Trash2, Brain, CheckCircle2,
  Lock, Target, Scale, Ruler, ArrowRight,
  Mail, Key, ShieldCheck, Loader2, FileText
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Preferences = {
  ai_enabled: boolean;
  notifications_checkin: boolean;
  notifications_recovery: boolean;
};

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false); 
  const [success, setSuccess] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [prefsExist, setPrefsExist] = useState(false);

  // Profil
  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [height, setHeight] = useState("");
  const [sex, setSex] = useState("");
  
  // Objectif de poids
  const [targetWeight, setTargetWeight] = useState("");
  const [weightGoal, setWeightGoal] = useState("maintain");
  const [lastWeight, setLastWeight] = useState<number | null>(null);

  // Préférences
  const [prefs, setPrefs] = useState<Preferences>({
    ai_enabled: true,
    notifications_checkin: true,
    notifications_recovery: true,
  });

  // Sécurité
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Danger Zone
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push("/login");
      
      setUserId(user.id);
      setNewEmail(user.email || "");
      
      const meta = user.user_metadata || {};
      setFullName(meta.full_name || "");
      setBirthDate(meta.birth_date || "");
      setHeight(meta.height || "");
      setSex(meta.sex || "");
      
      setTargetWeight(meta.target_weight || "");
      setWeightGoal(meta.weight_goal || "maintain");

      const { data: lastWeightData } = await supabase
        .from("health_metrics")
        .select("weight")
        .eq("user_id", user.id)
        .not("weight", "is", null)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastWeightData) setLastWeight(lastWeightData.weight);

      const { data: prefsData } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (prefsData) {
        setPrefs({
          ai_enabled: prefsData.ai_enabled,
          notifications_checkin: prefsData.notifications_checkin,
          notifications_recovery: prefsData.notifications_recovery,
        });
        setPrefsExist(true);
      }
      
      setLoading(false);
    }
    loadData();
  }, [router]);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 4000);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: fullName, birth_date: birthDate, height, sex, target_weight: targetWeight, weight_goal: weightGoal }
      });

      if (error) {
        alert("Erreur profil : " + error.message);
      } else {
        if (!targetWeight) {
          await supabase.from("goals").delete().eq("user_id", user.id).eq("metric_type", "weight");
        } else {
          await supabase.from("goals").update({ target_value: parseFloat(targetWeight) }).eq("user_id", user.id).eq("metric_type", "weight");
        }
        showSuccess("Profil mis à jour.");
        setTimeout(() => window.location.reload(), 1000); 
      }
    }
    setSaving(false);
  };

  const handleSavePreferences = async () => {
    if (!userId) return;
    setSaving(true);

    let result;
    if (prefsExist) {
      result = await supabase.from("user_preferences").update({
        ai_enabled: prefs.ai_enabled,
        notifications_checkin: prefs.notifications_checkin,
        notifications_recovery: prefs.notifications_recovery,
      }).eq("user_id", userId);
    } else {
      result = await supabase.from("user_preferences").insert({
        user_id: userId, units: "metric", language: "fr",
        ai_enabled: prefs.ai_enabled,
        notifications_checkin: prefs.notifications_checkin,
        notifications_recovery: prefs.notifications_recovery,
      });
    }

    if (result.error) {
      alert("Erreur de sauvegarde : " + result.error.message);
    } else {
      setPrefsExist(true);
      showSuccess("Préférences enregistrées.");
      window.dispatchEvent(new Event("omnia_ai_status_changed"));
    }
    setSaving(false);
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingEmail(true);

    const { error } = await supabase.auth.updateUser({ email: newEmail });

    if (error) {
      alert("Erreur lors du changement d'e-mail : " + error.message);
    } else {
      showSuccess("Un e-mail de confirmation a été envoyé à votre ancienne et nouvelle adresse.");
    }
    setIsUpdatingEmail(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert("Les deux mots de passe ne correspondent pas.");
      return;
    }
    if (newPassword.length < 6) {
      alert("Le mot de passe doit faire au moins 6 caractères.");
      return;
    }

    setIsUpdatingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      alert("Erreur : " + error.message);
    } else {
      showSuccess("Mot de passe mis à jour avec succès !");
      setNewPassword("");
      setConfirmPassword("");
    }
    setIsUpdatingPassword(false);
  };

  // ✅ NOUVELLE FONCTION D'EXPORT PRO (ZIP + CSV)
  const handleExportData = async () => {
    if (!userId) return;
    setIsExporting(true);

    try {
      const [
        measurements, journal, dailyMetrics, goals, preferences, 
        health, injuries, nutrition, workouts, customTests, aiGenerations
      ] = await Promise.all([
        supabase.from("measurements").select("*").eq("user_id", userId),
        supabase.from("journal_entries").select("*").eq("user_id", userId),
        supabase.from("daily_metrics").select("*").eq("user_id", userId),
        supabase.from("goals").select("*").eq("user_id", userId),
        supabase.from("user_preferences").select("*").eq("user_id", userId),
        supabase.from("health_metrics").select("*").eq("user_id", userId),
        supabase.from("injuries").select("*").eq("user_id", userId),
        supabase.from("meal_logs").select("*").eq("user_id", userId),
        supabase.from("workouts").select("*").eq("user_id", userId),
        supabase.from("custom_tests").select("*").eq("user_id", userId),
        supabase.from("ai_generations").select("*").eq("user_id", userId), 
      ]);

      const zip = new JSZip();
      const folder = zip.folder(`Export_OMNIA_${new Date().toISOString().split("T")[0]}`);

      const createCSV = (data: any[]) => {
        if (!data || data.length === 0) return "Aucune donnée enregistrée.";
        return Papa.unparse(data, { delimiter: ";" });
      };

      folder?.file("1_Sante_Constantes.csv", createCSV(health.data || []));
      folder?.file("2_Sante_Blessures.csv", createCSV(injuries.data || []));
      folder?.file("3_Mesures_Physiques.csv", createCSV(measurements.data || []));
      folder?.file("4_Entrainements.csv", createCSV(workouts.data || []));
      folder?.file("5_Nutrition.csv", createCSV(nutrition.data || []));
      folder?.file("6_Journal.csv", createCSV(journal.data || []));
      folder?.file("7_Metriques_Quotidiennes.csv", createCSV(dailyMetrics.data || []));
      folder?.file("8_Objectifs.csv", createCSV(goals.data || []));
      folder?.file("9_Tests_Customises.csv", createCSV(customTests.data || []));
      folder?.file("10_Preferences.csv", createCSV(preferences.data || []));
      folder?.file("11_Historique_IA.csv", createCSV(aiGenerations.data || []));

      const readmeContent = `
Bienvenue dans votre export de données OMNIA.
Date d'export : ${new Date().toLocaleDateString("fr-FR")}

Ce dossier contient l'intégralité des données que vous avez enregistrées sur OMNIA.
Tous les fichiers sont au format CSV et peuvent être ouverts avec Excel, Numbers, ou Google Sheets.

Détail des fichiers :
- 1_Sante_Constantes.csv : Vos poids, fréquence cardiaque, tension artérielle, etc.
- 2_Sante_Blessures.csv : L'historique de vos blessures.
- 3_Mesures_Physiques.csv : Vos tests physiques (sprints, etc.).
- 4_Entrainements.csv : Les séances générées et sauvegardées.
- 5_Nutrition.csv : Vos repas et calories.
- 6_Journal.csv : Vos notes de journal.
- 7_Metriques_Quotidiennes.csv : Vos check-ins quotidiens.
- 8_Objectifs.csv : Vos objectifs fixés.
- 9_Tests_Customises.csv : Vos tests personnalisés.
- 10_Preferences.csv : Vos réglages dans l'application.
- 11_Historique_IA.csv : Les analyses générées par OMNIA.

Merci d'utiliser OMNIA.
L'équipe Actoos.
      `;
      folder?.file("LISEZ-MOI.txt", readmeContent);

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `OMNIA_Export_${new Date().toISOString().split("T")[0]}.zip`;
      a.click();
      URL.revokeObjectURL(url);

      showSuccess("Vos données ont été exportées avec succès !");
    } catch (error) {
      console.error("[settings] Export error:", error);
      alert("Une erreur est survenue lors de la création de l'archive.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "SUPPRIMER") {
      alert("Tapez exactement SUPPRIMER pour confirmer.");
      return;
    }
    
    setSaving(true);
    
    try {
      const res = await fetch("/api/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
      });

      const text = await res.text();
      let data;
      
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("Réponse non-JSON reçue du serveur :", text);
        throw new Error(`Erreur serveur (${res.status}). Vérifie les logs de ton terminal.`);
      }

      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de la suppression.");
      }

      await supabase.auth.signOut();
      alert("Votre compte et toutes vos données ont été supprimés définitivement.");
      window.location.href = "/login"; 

    } catch (error: any) {
      console.error("[settings] Erreur suppression compte:", error);
      alert("Erreur : " + error.message);
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-white min-h-screen bg-[#020202] flex items-center justify-center">Chargement des réglages...</div>;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto bg-[#020202] min-h-screen space-y-6 md:space-y-8 pb-20">
      
      <header className="mb-4 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-1 md:mb-2">Réglages</h1>
        <p className="text-xs md:text-sm text-text-muted">Gérez votre profil, votre sécurité et vos préférences.</p>
      </header>

      <AnimatePresence>
        {success && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="fixed top-6 right-6 z-50 bg-recovery text-black px-4 md:px-6 py-2 md:py-3 rounded-xl font-semibold shadow-2xl flex items-center gap-2 text-xs md:text-sm">
            <CheckCircle2 size={16} className="md:w-[18px] md:h-[18px]" /> {success}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-6 md:space-y-8">
        
        {/* SECTION 1 : PROFIL */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-surface border border-border rounded-3xl overflow-hidden">
          <div className="p-4 md:p-6 border-b border-border bg-surface-hover/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-strain/10 flex items-center justify-center">
                <User size={16} className="text-strain md:w-5 md:h-5" />
              </div>
              <div>
                <h2 className="text-sm md:text-lg font-semibold text-white">Profil & Objectifs</h2>
                <p className="text-[10px] md:text-xs text-text-muted">Ces informations aident OMNIA.</p>
              </div>
            </div>
          </div>
          
          <div className="p-4 md:p-6 space-y-4 md:space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="md:col-span-2">
                <label className="block text-[10px] md:text-xs font-semibold text-text-muted tracking-widest uppercase mb-1.5 md:mb-2">Nom d'affichage</label>
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className="w-full bg-background border border-border rounded-xl px-3 md:px-4 py-2.5 md:py-3 text-base md:text-sm text-white focus:outline-none focus:border-strain transition-colors" placeholder="Votre prénom" />
              </div>
              
              <div>
                <label className="block text-[10px] md:text-xs font-semibold text-text-muted tracking-widest uppercase mb-1.5 md:mb-2">Date de naissance</label>
                <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} className="w-full bg-background border border-border rounded-xl px-3 md:px-4 py-2.5 md:py-3 text-base md:text-sm text-white focus:outline-none focus:border-strain transition-colors [color-scheme:dark]" />
              </div>
              
              <div>
                <label className="block text-[10px] md:text-xs font-semibold text-text-muted tracking-widest uppercase mb-1.5 md:mb-2">Taille (cm)</label>
                <div className="relative">
                  <Ruler className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-text-muted" size={14} />
                  <input type="number" value={height} onChange={e => setHeight(e.target.value)} className="w-full bg-background border border-border rounded-xl pl-10 md:pl-12 pr-3 md:pr-4 py-2.5 md:py-3 text-base md:text-sm text-white focus:outline-none focus:border-strain transition-colors" placeholder="ex: 178" />
                </div>
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-[10px] md:text-xs font-semibold text-text-muted tracking-widest uppercase mb-1.5 md:mb-2">Sexe</label>
                <select value={sex} onChange={e => setSex(e.target.value)} className="w-full bg-background border border-border rounded-xl px-3 md:px-4 py-2.5 md:py-3 text-base md:text-sm text-white focus:outline-none focus:border-strain transition-colors">
                  <option value="">Non précisé</option>
                  <option value="M">Homme</option>
                  <option value="F">Femme</option>
                </select>
              </div>
            </div>

            <div className="pt-4 md:pt-6 border-t border-border/50">
              <div className="flex items-center gap-2 mb-3 md:mb-4">
                <Target size={16} className="text-strain md:w-[18px] md:h-[18px]" />
                <h3 className="text-[10px] md:text-sm font-semibold text-white uppercase tracking-widest">Objectif Corporel</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div>
                  <label className="block text-[10px] md:text-xs font-semibold text-text-muted tracking-widest uppercase mb-1.5 md:mb-2">But à atteindre</label>
                  <select value={weightGoal} onChange={e => setWeightGoal(e.target.value)} className="w-full bg-background border border-border rounded-xl px-3 md:px-4 py-2.5 md:py-3 text-base md:text-sm text-white focus:outline-none focus:border-strain transition-colors">
                    <option value="maintain">Maintien (Rester stable)</option>
                    <option value="lose">Perte de poids (Sèche)</option>
                    <option value="gain">Prise de masse</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] md:text-xs font-semibold text-text-muted tracking-widest uppercase mb-1.5 md:mb-2">Poids cible (kg)</label>
                  <div className="relative">
                    <Scale className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-text-muted" size={14} />
                    <input type="number" step="0.1" value={targetWeight} onChange={e => setTargetWeight(e.target.value)} placeholder="ex: 72.5" className="w-full bg-background border border-border rounded-xl pl-10 md:pl-12 pr-3 md:pr-4 py-2.5 md:py-3 text-base md:text-sm text-white focus:outline-none focus:border-strain transition-colors" />
                  </div>
                </div>
              </div>

              <div className="mt-4 md:mt-6 flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 md:p-4 bg-background border border-border rounded-xl">
                <div>
                  <p className="text-[10px] md:text-xs text-text-muted">Dernier poids enregistré (via l'onglet Santé)</p>
                  <p className="text-base md:text-lg font-bold text-white">{lastWeight ? `${lastWeight} kg` : "Non renseigné"}</p>
                </div>
                <Link href="/health" className="w-full md:w-auto justify-center flex items-center gap-1.5 text-[10px] md:text-xs font-semibold text-strain bg-strain/10 px-3 md:px-4 py-2 md:py-2.5 rounded-lg hover:bg-strain/20 transition-colors">
                  Mettre à jour <ArrowRight size={12} className="md:w-3.5 md:h-3.5" />
                </Link>
              </div>
            </div>

            <div className="flex justify-end pt-3 md:pt-4 border-t border-border/50">
              <button onClick={handleSaveProfile} disabled={saving} className="w-full md:w-auto flex items-center justify-center gap-2 bg-white text-black font-semibold rounded-xl px-4 md:px-6 py-2.5 md:py-3 text-xs md:text-sm hover:bg-gray-200 transition-all disabled:opacity-50">
                <Save size={14} className="md:w-[18px] md:h-[18px]" /> Enregistrer le profil
              </button>
            </div>
          </div>
        </motion.div>

        {/* SECTION 2 : SÉCURITÉ & CONNEXION */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-surface border border-border rounded-3xl overflow-hidden">
          <div className="p-4 md:p-6 border-b border-border bg-surface-hover/30 flex items-center gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-sleep/10 flex items-center justify-center">
              <ShieldCheck size={16} className="text-sleep md:w-5 md:h-5" />
            </div>
            <div>
              <h2 className="text-sm md:text-lg font-semibold text-white">Sécurité & Connexion</h2>
              <p className="text-[10px] md:text-xs text-text-muted">Gérez votre e-mail et votre mot de passe.</p>
            </div>
          </div>

          <div className="p-4 md:p-6 space-y-6">
            {/* Changement d'E-mail */}
            <form onSubmit={handleUpdateEmail} className="space-y-3">
              <label className="block text-[10px] md:text-xs font-semibold text-text-muted tracking-widest uppercase mb-1 md:mb-2">Changer d'adresse e-mail</label>
              <div className="flex flex-col md:flex-row gap-2">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-text-muted" size={14} />
                  <input 
                    type="email" 
                    value={newEmail} 
                    onChange={e => setNewEmail(e.target.value)} 
                    className="w-full bg-background border border-border rounded-xl pl-10 md:pl-12 pr-3 md:pr-4 py-2.5 md:py-3 text-base md:text-sm text-white focus:outline-none focus:border-sleep transition-colors" 
                    required
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={isUpdatingEmail || !newEmail} 
                  className="w-full md:w-auto flex items-center justify-center gap-2 bg-sleep text-white font-semibold rounded-xl px-4 md:px-6 py-2.5 md:py-3 text-xs md:text-sm hover:bg-sleep/80 transition-all disabled:opacity-50"
                >
                  {isUpdatingEmail ? <Loader2 size={14} className="animate-spin" /> : "Mettre à jour"}
                </button>
              </div>
              <p className="text-[9px] md:text-xs text-text-muted mt-1">Un e-mail de confirmation sera envoyé.</p>
            </form>

            <div className="border-t border-border/50 my-4"></div>

            {/* Changement de Mot de passe */}
            <form onSubmit={handleUpdatePassword} className="space-y-3">
              <label className="block text-[10px] md:text-xs font-semibold text-text-muted tracking-widest uppercase mb-1 md:mb-2">Changer de mot de passe</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="relative">
                  <Key className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-text-muted" size={14} />
                  <input 
                    type="password" 
                    placeholder="Nouveau mot de passe" 
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)} 
                    className="w-full bg-background border border-border rounded-xl pl-10 md:pl-12 pr-3 md:pr-4 py-2.5 md:py-3 text-base md:text-sm text-white focus:outline-none focus:border-sleep transition-colors" 
                    required
                  />
                </div>
                <div className="relative">
                  <Key className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-text-muted" size={14} />
                  <input 
                    type="password" 
                    placeholder="Confirmer le mot de passe" 
                    value={confirmPassword} 
                    onChange={e => setConfirmPassword(e.target.value)} 
                    className="w-full bg-background border border-border rounded-xl pl-10 md:pl-12 pr-3 md:pr-4 py-2.5 md:py-3 text-base md:text-sm text-white focus:outline-none focus:border-sleep transition-colors" 
                    required
                  />
                </div>
              </div>
              <button 
                type="submit" 
                disabled={isUpdatingPassword || !newPassword || !confirmPassword} 
                className="w-full md:w-auto flex items-center justify-center gap-2 bg-sleep text-white font-semibold rounded-xl px-4 md:px-6 py-2.5 md:py-3 text-xs md:text-sm hover:bg-sleep/80 transition-all disabled:opacity-50"
              >
                {isUpdatingPassword ? <Loader2 size={14} className="animate-spin" /> : "Mettre à jour le mot de passe"}
              </button>
            </form>
          </div>
        </motion.div>

        {/* SECTION 3 : INTELLIGENCE ARTIFICIELLE */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-surface border border-purple-500/30 rounded-3xl overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 blur-3xl pointer-events-none rounded-full" />
          
          <div className="p-4 md:p-6 border-b border-border bg-surface-hover/30 flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                <Brain size={16} className="text-purple-500 md:w-5 md:h-5" />
              </div>
              <div>
                <h2 className="text-sm md:text-lg font-semibold text-white">OMNIA Intelligence</h2>
                <p className="text-[10px] md:text-xs text-text-muted">Contrôlez l'accès de l'IA.</p>
              </div>
            </div>
          </div>

          <div className="p-4 md:p-6 space-y-4 md:space-y-6 relative z-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-background border border-border rounded-2xl p-3 md:p-5">
              <div>
                <p className="text-xs md:text-sm font-semibold text-white flex items-center gap-2"><Lock size={12} className="text-purple-500 md:w-3.5 md:h-3.5"/> Activer l'analyse IA</p>
                <p className="text-[10px] md:text-xs text-text-muted mt-1 max-w-md">Permet à OMNIA d'analyser vos données.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input type="checkbox" checked={prefs.ai_enabled} onChange={e => setPrefs(prev => ({...prev, ai_enabled: e.target.checked}))} className="sr-only peer" />
                <div className="w-12 h-6 md:w-14 md:h-7 bg-surface-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 md:after:h-6 md:after:w-6 after:transition-all peer-checked:bg-purple-500"></div>
              </label>
            </div>
            
            <div className="flex gap-2 md:gap-3 bg-purple-500/5 border border-purple-500/10 rounded-xl p-3 md:p-4">
              <ShieldAlert size={16} className="text-purple-400 shrink-0 md:w-5 md:h-5" />
              <p className="text-[9px] md:text-xs text-purple-200/70 leading-relaxed">
                <strong className="text-purple-300">Conformité RGPD :</strong> Vos données sont anonymisées. Vous pouvez désactiver cette fonctionnalité à tout moment.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button onClick={handleSavePreferences} disabled={saving} className="w-full md:w-auto flex items-center justify-center gap-2 bg-white text-black font-semibold rounded-xl px-4 md:px-6 py-2.5 md:py-3 text-xs md:text-sm hover:bg-gray-200 transition-all disabled:opacity-50">
                <Save size={14} className="md:w-[18px] md:h-[18px]" /> Enregistrer
              </button>
            </div>
          </div>
        </motion.div>

        {/* SECTION 4 : NOTIFICATIONS */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-surface border border-border rounded-3xl overflow-hidden">
          <div className="p-4 md:p-6 border-b border-border bg-surface-hover/30 flex items-center gap-3">
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-warning/10 flex items-center justify-center">
              <Bell size={14} className="text-warning md:w-4 md:h-4" />
            </div>
            <h2 className="text-xs md:text-sm font-semibold text-white">Notifications</h2>
          </div>
          <div className="p-4 md:p-6 space-y-4 md:space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-white">Rappels de check-in</p>
                <p className="text-[9px] md:text-[10px] text-text-muted mt-1">Chaque matin.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={prefs.notifications_checkin} onChange={e => setPrefs(prev => ({...prev, notifications_checkin: e.target.checked}))} className="sr-only peer" />
                <div className="w-10 h-5 md:w-11 md:h-6 bg-surface-hover rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 md:after:h-5 md:after:w-5 after:transition-all peer-checked:bg-warning"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-white">Alertes de récupération</p>
                <p className="text-[9px] md:text-[10px] text-text-muted mt-1">Si le score est faible.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={prefs.notifications_recovery} onChange={e => setPrefs(prev => ({...prev, notifications_recovery: e.target.checked}))} className="sr-only peer" />
                <div className="w-10 h-5 md:w-11 md:h-6 bg-surface-hover rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 md:after:h-5 md:after:w-5 after:transition-all peer-checked:bg-warning"></div>
              </label>
            </div>
            <div className="pt-2">
              <button onClick={handleSavePreferences} disabled={saving} className="w-full flex items-center justify-center gap-2 bg-white text-black font-semibold rounded-xl px-4 md:px-6 py-2.5 md:py-3 text-xs md:text-sm hover:bg-gray-200 transition-all disabled:opacity-50">
                <Save size={14} className="md:w-4 md:h-4" /> Enregistrer
              </button>
            </div>
          </div>
        </motion.div>

        {/* SECTION 5 : DONNÉES & CONFIDENTIALITÉ (RGPD) */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-surface border border-border rounded-3xl overflow-hidden">
          <div className="p-4 md:p-6 border-b border-border bg-surface-hover/30 flex items-center gap-3">
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-strain/10 flex items-center justify-center">
              <Download size={14} className="text-strain md:w-4 md:h-4" />
            </div>
            <h2 className="text-xs md:text-sm font-semibold text-white">Données & Confidentialité</h2>
          </div>

          <div className="p-4 md:p-6 space-y-3 md:space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 md:p-4 bg-background border border-border rounded-xl">
              <div>
                <p className="text-xs md:text-sm font-medium text-white">Exporter mes données</p>
                <p className="text-[9px] md:text-xs text-text-muted mt-1">Téléchargez une archive (.zip) avec tous vos fichiers (CSV).</p>
              </div>
              <button onClick={handleExportData} disabled={isExporting} className="w-full md:w-auto justify-center flex items-center gap-2 bg-surface-hover border border-border text-white text-[10px] md:text-sm font-semibold rounded-lg px-3 md:px-4 py-2 hover:bg-border transition-colors disabled:opacity-50 shrink-0">
                {isExporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} className="md:w-3.5 md:h-3.5" />} 
                {isExporting ? "Création..." : "Exporter"}
              </button>
            </div>

            {/* ✅ Liens Légaux */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 md:p-4 bg-background border border-border rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-surface-hover flex items-center justify-center shrink-0">
                  <FileText size={14} className="text-text-muted" />
                </div>
                <div>
                  <p className="text-xs md:text-sm font-medium text-white">Mentions légales</p>
                  <p className="text-[9px] md:text-xs text-text-muted mt-1">Consultez nos conditions et notre politique de données.</p>
                </div>
              </div>
              <div className="flex items-center gap-3 pl-11 md:pl-0">
                <Link href="/terms" target="_blank" className="text-[10px] md:text-xs font-semibold text-strain hover:text-white transition-colors">
                  Conditions
                </Link>
                <span className="text-border">•</span>
                <Link href="/privacy" target="_blank" className="text-[10px] md:text-xs font-semibold text-strain hover:text-white transition-colors">
                  Confidentialité
                </Link>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="p-4 md:p-5 bg-alert/5 border border-alert/20 rounded-xl mt-4 md:mt-6">
              <div className="flex items-center gap-2 mb-1.5 md:mb-2">
                <ShieldAlert size={14} className="text-alert md:w-[18px] md:h-[18px]" />
                <p className="text-[10px] md:text-sm font-bold text-alert uppercase tracking-wider">Zone dangereuse</p>
              </div>
              <p className="text-[9px] md:text-xs text-text-muted mb-3 md:mb-4">La suppression de votre compte effacera définitivement toutes vos données.</p>
              
              {!showDeleteConfirm ? (
                <button onClick={() => setShowDeleteConfirm(true)} className="w-full md:w-auto justify-center flex items-center gap-2 bg-alert text-white text-[10px] md:text-sm font-semibold rounded-lg px-4 md:px-5 py-2 md:py-2.5 hover:bg-alert/80 transition-colors">
                  <Trash2 size={12} className="md:w-4 md:h-4" /> Supprimer mon compte
                </button>
              ) : (
                <div className="space-y-3 bg-background p-3 md:p-4 rounded-xl border border-alert/30">
                  <p className="text-[10px] md:text-xs text-alert font-semibold">Tapez <strong className="text-white">SUPPRIMER</strong> pour confirmer :</p>
                  <input type="text" value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} className="w-full bg-surface border border-alert/50 rounded-lg px-3 md:px-4 py-2 md:py-3 text-base md:text-sm text-white focus:outline-none focus:border-alert font-mono" placeholder="SUPPRIMER" />
                  <div className="flex flex-col md:flex-row gap-2">
                    <button onClick={handleDeleteAccount} disabled={saving || deleteConfirmText !== "SUPPRIMER"} className="w-full md:w-auto bg-alert text-white text-[10px] md:text-sm font-semibold rounded-lg px-3 md:px-4 py-2 hover:bg-alert/80 transition-colors disabled:opacity-50">
                      Confirmer
                    </button>
                    <button onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }} className="w-full md:w-auto text-text-muted text-[10px] md:text-sm px-3 md:px-4 py-2 hover:text-white transition-colors">
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}