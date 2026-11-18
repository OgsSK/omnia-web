// src/app/journal/page.tsx
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { isAIEnabled } from "@/lib/ai-guard"; // ✅ Import
import { 
  BookOpen, Save, Clock, PenLine, Sparkles, 
  BrainCircuit, Smile, Frown, Meh, Laugh, Angry,
  Pencil, Trash2, X, Check, Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";

type JournalEntry = {
  id: string;
  content: string;
  mood: number | null;
  ai_reflection: string | null;
  created_at: string;
};

const MOODS = [
  { value: 1, icon: Angry, color: "text-alert", bg: "bg-alert/10 border-alert/30", label: "Épuisé" },
  { value: 2, icon: Frown, color: "text-warning", bg: "bg-warning/10 border-warning/30", label: "Fatigué" },
  { value: 3, icon: Meh, color: "text-text-muted", bg: "bg-surface-hover border-border", label: "Neutre" },
  { value: 4, icon: Smile, color: "text-strain", bg: "bg-strain/10 border-strain/30", label: "Motivé" },
  { value: 5, icon: Laugh, color: "text-recovery", bg: "bg-recovery/10 border-recovery/30", label: "En feu" },
];

export default function JournalPage() {
  const [note, setNote] = useState("");
  const [mood, setMood] = useState<number>(3);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState("Qu'avez-vous appris de votre entraînement aujourd'hui ?");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editMood, setEditMood] = useState<number>(3);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const savedDraft = localStorage.getItem("journal_draft_note");
    const savedMood = localStorage.getItem("journal_draft_mood");
    if (savedDraft) setNote(savedDraft);
    if (savedMood) setMood(Number(savedMood));

    fetchEntries();
    generateSuggestion();
  }, []);

  useEffect(() => {
    if (note.trim()) localStorage.setItem("journal_draft_note", note); else localStorage.removeItem("journal_draft_note");
    localStorage.setItem("journal_draft_mood", mood.toString());
  }, [note, mood]);

  const fetchEntries = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data, error } = await supabase.from("journal_entries").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      if (error) console.error("[journal] fetchEntries:", error);
      if (data) setEntries(data);
    }
    setLoading(false);
  };

  const generateSuggestion = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase.from("daily_metrics").select("*").eq("user_id", user.id).eq("date", today).maybeSingle();
      if (error) console.error("[journal] generateSuggestion:", error);
      if (data) {
        if (data.recovery_score < 50) setAiSuggestion("Ta récupération est basse aujourd'hui. Comment ton corps se sent-il vraiment ?");
        else if (data.recovery_score > 80) setAiSuggestion("Tu es en pleine forme ! Qu'est-ce qui a contribué à cette énergie aujourd'hui ?");
        else setAiSuggestion("Quel est ton principal objectif mental pour la journée ?");
      }
    }
  };

  const handleSave = async () => {
    if (!note.trim()) return;
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const today = new Date().toISOString().split("T")[0];
      const { data: metric, error: metricError } = await supabase.from("daily_metrics").select("recovery_score, sleep_hours").eq("user_id", user.id).eq("date", today).maybeSingle();
      if (metricError) console.error("[journal] metric fetch:", metricError);

      let recentContext = "Pas de données de récupération aujourd'hui.";
      if (metric) recentContext = `Récupération : ${metric.recovery_score}%, Sommeil : ${metric.sleep_hours}h.`;

      let reflection = null;
      
      // ✅ VÉRIFICATION IA
      const aiAllowed = await isAIEnabled();
      if (!aiAllowed) {
        console.warn("[journal] IA désactivée dans les paramètres, on saute la réflexion.");
      } else {
        try {
          const aiRes = await fetch("/api/journal-reflection", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: note.trim(), mood, recentContext })
          });
          const aiData = await aiRes.json();
          reflection = aiData.reflection;
        } catch (e) {
          console.error("[journal] Erreur IA:", e);
        }
      }

      const { error } = await supabase.from("journal_entries").insert({
        user_id: user.id, content: note.trim(), mood: mood, ai_reflection: reflection
      });

      if (error) {
        console.error("[journal] insert:", error);
      } else {
        setNote(""); setMood(3);
        localStorage.removeItem("journal_draft_note"); localStorage.removeItem("journal_draft_mood");
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
        fetchEntries();
      }
    }
    setSaving(false);
  };

  const startEdit = (entry: JournalEntry) => { setEditingId(entry.id); setEditContent(entry.content); setEditMood(entry.mood ?? 3); setDeletingId(null); };
  const cancelEdit = () => { setEditingId(null); setEditContent(""); setEditMood(3); };

  const handleUpdate = async (id: string) => {
    if (!editContent.trim()) return;
    setBusyId(id);
    const { error } = await supabase.from("journal_entries").update({ content: editContent.trim(), mood: editMood }).eq("id", id);
    if (error) { console.error("[journal] update:", error); } else {
      setEntries(prev => prev.map(e => e.id === id ? { ...e, content: editContent.trim(), mood: editMood } : e));
      cancelEdit();
    }
    setBusyId(null);
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    const { error } = await supabase.from("journal_entries").delete().eq("id", id);
    if (error) { console.error("[journal] delete:", error); } else { setEntries(prev => prev.filter(e => e.id !== id)); setDeletingId(null); }
    setBusyId(null);
  };

  const totalEntries = entries.length;
  const totalWords = entries.reduce((acc, curr) => acc + curr.content.split(/\s+/).length, 0);

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return { day: d.toLocaleDateString("fr-FR", { day: "2-digit" }), month: d.toLocaleDateString("fr-FR", { month: "short" }).toUpperCase(), full: d.toLocaleDateString("fr-FR", { weekday: 'long', hour: '2-digit', minute: '2-digit' }) };
  };

  const getMoodIcon = (m: number | null, size = 16) => {
    const moodObj = MOODS.find(x => x.value === m) || MOODS[2];
    const Icon = moodObj.icon;
    return <Icon size={size} className={moodObj.color} />;
  };

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto bg-[#020202] min-h-screen space-y-4 md:space-y-6">
      <header className="flex justify-between items-end mb-2 md:mb-6">
        <div><h1 className="text-xl md:text-2xl font-bold text-white mb-1">Journal de bord</h1><p className="text-xs md:text-sm text-text-muted">Prenez un moment pour vous poser et noter vos ressentis.</p></div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-surface border border-border rounded-2xl p-3 md:p-5 relative overflow-hidden group">
          <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-4"><div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-sleep/10 flex items-center justify-center"><BookOpen size={14} className="text-sleep" /></div><span className="text-[10px] md:text-xs font-semibold text-text-muted tracking-widest uppercase">Entrées</span></div>
          <div className="flex items-baseline gap-1 relative z-10"><span className="text-2xl md:text-4xl font-bold text-white">{totalEntries}</span></div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-surface border border-border rounded-2xl p-3 md:p-5 relative overflow-hidden group">
          <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-4"><div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-strain/10 flex items-center justify-center"><PenLine size={14} className="text-strain" /></div><span className="text-[10px] md:text-xs font-semibold text-text-muted tracking-widest uppercase">Mots</span></div>
          <div className="flex items-baseline gap-1 relative z-10"><span className="text-2xl md:text-4xl font-bold text-white">{totalWords}</span></div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="col-span-2 md:col-span-1 bg-purple-500/5 border border-purple-500/20 rounded-2xl p-3 md:p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-3xl pointer-events-none rounded-full" />
          <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-4"><div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-purple-500/20 flex items-center justify-center"><Sparkles size={14} className="text-purple-500" /></div><span className="text-[10px] md:text-xs font-semibold text-purple-400 tracking-widest uppercase">Suggestion OMNIA</span></div>
          <div className="relative z-10"><p className="text-xs md:text-sm text-text-main leading-tight italic line-clamp-2 md:line-clamp-none">"{aiSuggestion}"</p></div>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="bg-surface border border-border rounded-3xl p-4 md:p-8 relative overflow-hidden mb-6 md:mb-12">
        <div className="absolute top-0 right-0 w-64 h-64 bg-sleep/5 blur-3xl pointer-events-none rounded-full" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 md:mb-6 relative z-10">
          <div className="flex items-center gap-3"><div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-sleep/10 flex items-center justify-center"><PenLine className="text-sleep" size={16} /></div><div><h2 className="text-sm md:text-lg font-semibold text-white">Nouvelle entrée</h2><p className="text-[10px] md:text-xs text-text-muted">Comment vous sentez-vous ?</p></div></div>
          <div className="flex gap-1.5 md:gap-2 bg-background border border-border rounded-xl p-1 overflow-x-auto custom-scrollbar hide-scroll">
            {MOODS.map((m) => (
              <button key={m.value} onClick={() => setMood(m.value)} title={m.label} className={`w-10 h-10 md:w-10 md:h-10 shrink-0 rounded-lg flex items-center justify-center transition-all ${mood === m.value ? `${m.bg} ${m.color} scale-110` : "text-text-muted hover:bg-surface-hover"}`}><m.icon size={18} /></button>
            ))}
          </div>
        </div>
        <div className="relative z-10">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} className="w-full bg-background border border-border rounded-2xl p-4 md:p-6 text-white text-sm md:text-lg leading-relaxed focus:outline-none focus:border-sleep transition-colors min-h-[150px] md:min-h-[200px] resize-none" placeholder="Écrivez librement..." />
          <div className="flex flex-col md:flex-row justify-between items-center mt-4 gap-3">
            <div className="flex items-center justify-between w-full md:w-auto gap-4 text-[10px] md:text-xs text-text-muted font-mono">
              <span>{note.length} caractères</span><span>{note.trim() ? note.trim().split(/\s+/).length : 0} mots</span>
              {note.trim() && <span className="text-recovery animate-pulse">Sauvegardé</span>}
            </div>
            <AnimatePresence>{success && (<motion.span initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="text-recovery text-xs md:text-sm font-semibold">Note enregistrée !</motion.span>)}</AnimatePresence>
            <button onClick={handleSave} disabled={!note.trim() || saving} className="w-full md:w-auto flex items-center justify-center gap-2 bg-white text-black font-semibold rounded-xl px-6 md:px-8 py-3 md:py-3 hover:bg-gray-200 transition-all disabled:opacity-50 text-sm"><Save size={16} />{saving ? "Analyse..." : "Enregistrer"}</button>
          </div>
        </div>
      </motion.div>

      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-4 md:mb-8"><Clock size={16} className="text-text-muted" /><h3 className="text-xs md:text-sm font-semibold tracking-widest text-text-muted uppercase">Votre historique</h3></div>
        {loading ? <p className="text-xs md:text-sm text-text-muted">Chargement...</p> : entries.length === 0 ? (
          <div className="bg-surface border border-border border-dashed rounded-3xl p-8 md:p-12 text-center"><BookOpen size={32} className="mx-auto text-text-muted mb-3 md:mb-4 opacity-50 md:w-12 md:h-12" /><p className="text-xs md:text-sm text-text-muted">Votre journal est vide. Commencez à écrire.</p></div>
        ) : (
          <div className="relative border-l border-border/50 ml-3 md:ml-6 space-y-4 md:space-y-8 pb-8">
            <AnimatePresence>
              {entries.map((entry, index) => {
                const dateInfo = formatDate(entry.created_at);
                const isEditing = editingId === entry.id; const isDeleting = deletingId === entry.id; const isBusy = busyId === entry.id;
                return (
                  <motion.div key={entry.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }} transition={{ delay: index * 0.05 }} className="relative pl-4 md:pl-8">
                    <div className="absolute -left-[7px] md:-left-[9px] top-1 w-3 h-3 md:w-4 md:h-4 rounded-full bg-background border-2 border-sleep shadow-[0_0_10px_rgba(175,82,222,0.5)]" />
                    <div className="hidden md:block absolute -left-32 top-0 text-right w-24"><p className="text-lg font-bold text-white leading-none">{dateInfo.day}</p><p className="text-[10px] font-semibold text-text-muted tracking-wider mt-1">{dateInfo.month}</p></div>
                    <div className={`bg-surface border rounded-2xl p-3 md:p-6 transition-colors group ${isEditing ? "border-sleep/50" : "border-border hover:border-sleep/30"}`}>
                      <div className="flex items-center justify-between mb-2 md:mb-3 gap-3">
                        <div className="flex items-center gap-2 text-text-muted md:hidden"><Clock size={10} /><span className="text-[9px] font-medium">{dateInfo.full}</span></div>
                        <div className="ml-auto flex items-center gap-1 md:gap-2">
                          {!isEditing && entry.mood && (<div className="flex items-center gap-1 md:gap-1.5 bg-background px-1.5 md:px-2 py-0.5 md:py-1 rounded-md border border-border">{getMoodIcon(entry.mood, 12)}<span className="text-[9px] md:text-[10px] text-text-muted uppercase font-semibold">{MOODS.find(m => m.value === entry.mood)?.label}</span></div>)}
                          {!isEditing && !isDeleting && (<div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"><button onClick={() => startEdit(entry)} className="p-1.5 rounded-md text-text-muted hover:text-white hover:bg-surface-hover transition-colors"><Pencil size={12} className="md:w-3.5 md:h-3.5" /></button><button onClick={() => setDeletingId(entry.id)} className="p-1.5 rounded-md text-text-muted hover:text-alert hover:bg-alert/10 transition-colors"><Trash2 size={12} className="md:w-3.5 md:h-3.5" /></button></div>)}
                        </div>
                      </div>
                      {isDeleting ? (
                        <div className="flex flex-col md:flex-row items-center justify-between gap-2 md:gap-3 bg-alert/5 border border-alert/30 rounded-xl p-3"><p className="text-[10px] md:text-xs text-alert font-medium text-center md:text-left">Supprimer cette entrée ?</p><div className="flex items-center gap-2 w-full md:w-auto"><button onClick={() => setDeletingId(null)} disabled={isBusy} className="flex-1 md:flex-none px-3 py-1.5 rounded-lg text-[10px] md:text-xs font-semibold text-text-muted hover:bg-surface-hover transition-colors disabled:opacity-50">Annuler</button><button onClick={() => handleDelete(entry.id)} disabled={isBusy} className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] md:text-xs font-semibold bg-alert text-white hover:bg-alert/80 transition-colors disabled:opacity-50">{isBusy ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}Supprimer</button></div></div>
                      ) : isEditing ? (
                        <div className="space-y-2 md:space-y-3">
                          <div className="flex gap-1 md:gap-1.5 overflow-x-auto custom-scrollbar hide-scroll pb-1">{MOODS.map((m) => (<button key={m.value} onClick={() => setEditMood(m.value)} className={`w-8 h-8 md:w-8 md:h-8 shrink-0 rounded-lg flex items-center justify-center transition-all ${editMood === m.value ? `${m.bg} ${m.color} scale-110` : "text-text-muted hover:bg-surface-hover"}`}><m.icon size={14} /></button>))}</div>
                          <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} autoFocus className="w-full bg-background border border-border rounded-xl p-3 md:p-4 text-xs md:text-sm text-white leading-relaxed focus:outline-none focus:border-sleep transition-colors min-h-[100px] md:min-h-[120px] resize-none" />
                          <div className="flex justify-end gap-2"><button onClick={cancelEdit} disabled={isBusy} className="flex items-center gap-1 px-2 py-1.5 md:px-3 rounded-lg text-[10px] md:text-xs font-semibold text-text-muted hover:bg-surface-hover transition-colors disabled:opacity-50"><X size={12} /> Annuler</button><button onClick={() => handleUpdate(entry.id)} disabled={!editContent.trim() || isBusy} className="flex items-center gap-1 px-2 py-1.5 md:px-3 rounded-lg text-[10px] md:text-xs font-semibold bg-sleep text-white hover:bg-sleep/80 transition-colors disabled:opacity-50">{isBusy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}Sauver</button></div>
                        </div>
                      ) : (
                        <>
                          <p className="text-xs md:text-sm text-text-main leading-relaxed whitespace-pre-wrap">{entry.content}</p>
                          {entry.ai_reflection && (
                            <div className="mt-2 md:mt-4 pt-2 md:pt-4 border-t border-border/50"><div className="flex items-start gap-2 md:gap-3"><div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0 mt-0.5"><BrainCircuit size={10} className="text-purple-500 md:w-3 md:h-3" /></div><div className="text-[10px] md:text-xs text-purple-300 italic leading-relaxed"><ReactMarkdown components={{ strong: ({node, ...props}) => <span className="font-bold text-purple-200" {...props} />, p: ({node, ...props}) => <p className="mb-1" {...props} /> }}>{entry.ai_reflection || ""}</ReactMarkdown></div></div></div>
                          )}
                        </>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}