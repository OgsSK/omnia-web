// src/app/matches/page.tsx
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Calendar, Plus, Trophy, CheckCircle2, MapPin, 
  X, Activity, Target 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Match = {
  id: string;
  opponent: string;
  match_date: string;
  location: string;
  is_home: boolean;
  result_score: string | null;
  result_notes: string | null;
};

export default function MatchesPage() {
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<Match[]>([]);
  
  // ✅ CORRECTION : On stocke la date "now" dans un état initialisé à null
  const [now, setNow] = useState<Date | null>(null);

  // Modales
  const [showAddForm, setShowAddForm] = useState(false);
  const [showResultForm, setShowResultForm] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);

  // Formulaire Ajout
  const [opponent, setOpponent] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [isHome, setIsHome] = useState(true);

  // Formulaire Résultat
  const [score, setScore] = useState("");
  const [resultNotes, setResultNotes] = useState("");

  useEffect(() => {
    // ✅ CORRECTION : On calcule la date uniquement côté client (après montage)
    setNow(new Date());
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from("matches").select("*").eq("user_id", user.id).order("match_date", { ascending: true });
      if (data) setMatches(data);
    }
    setLoading(false);
  };

  const handleAddMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      await supabase.from("matches").insert({
        user_id: user.id,
        opponent,
        match_date: new Date(date).toISOString(),
        location,
        is_home: isHome,
      });
      setOpponent(""); setDate(""); setLocation(""); setShowAddForm(false);
      fetchMatches();
    }
    setSaving(false);
  };

  const openResultModal = (id: string) => {
    setSelectedMatchId(id);
    setScore("");
    setResultNotes("");
    setShowResultForm(true);
  };

  const handleSaveResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMatchId) return;
    setSaving(true);
    
    await supabase.from("matches").update({ 
      result_score: score, 
      result_notes: resultNotes 
    }).eq("id", selectedMatchId);
    
    setShowResultForm(false);
    fetchMatches();
    setSaving(false);
  };

  // --- CALCULS STATISTIQUES SÉCURISÉS ---
  // On vérifie que `now` existe avant de filtrer (évite le crash SSR)
  const upcomingMatches = now ? matches.filter(m => new Date(m.match_date) >= now) : [];
  const pastMatches = now ? matches.filter(m => new Date(m.match_date) < now).reverse() : [];
  
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let playedCount = 0;

  pastMatches.forEach(m => {
    if (m.result_score) {
      playedCount++;
      const parts = m.result_score.split("-");
      if (parts.length === 2) {
        const scoreHome = parseInt(parts[0]);
        const scoreAway = parseInt(parts[1]);
        const myScore = m.is_home ? scoreHome : scoreAway;
        const oppScore = m.is_home ? scoreAway : scoreHome;
        
        if (myScore > oppScore) wins++;
        else if (myScore < oppScore) losses++;
        else draws++;
      }
    }
  });

  const winRate = playedCount > 0 ? Math.round((wins / playedCount) * 100) : 0;

  // On affiche un écran de chargement tant que la date n'est pas calculée
  if (loading || !now) return <div className="p-8 text-white min-h-screen bg-[#020202]">Chargement...</div>;

  return (
    <div className="p-6 max-w-[1600px] mx-auto bg-[#020202] min-h-screen space-y-6">
      
      <header className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Matchs & Compétitions</h1>
          <p className="text-sm text-text-muted">Gérez votre calendrier, vos résultats et vos statistiques.</p>
        </div>
        <button onClick={() => setShowAddForm(true)} className="flex items-center gap-2 bg-white text-black font-semibold rounded-xl px-5 py-2.5 hover:bg-gray-200 transition-all text-sm shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:scale-105 active:scale-95">
          <Plus size={18} /> Nouveau match
        </button>
      </header>

      {/* TOP METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-surface border border-border rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-strain/10 flex items-center justify-center"><Calendar size={16} className="text-strain" /></div>
            <span className="text-xs font-semibold text-text-muted tracking-widest uppercase">À venir</span>
          </div>
          <div className="flex items-baseline gap-1 relative z-10">
            <span className="text-4xl font-bold text-white">{upcomingMatches.length}</span>
            <span className="text-sm text-text-muted ml-2">matchs</span>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-surface border border-border rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-recovery/10 flex items-center justify-center"><Trophy size={16} className="text-recovery" /></div>
            <span className="text-xs font-semibold text-text-muted tracking-widest uppercase">Victoires</span>
          </div>
          <div className="flex items-baseline gap-1 relative z-10">
            <span className="text-4xl font-bold text-recovery">{wins}</span>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-surface border border-border rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-text-muted/10 flex items-center justify-center"><Activity size={16} className="text-text-muted" /></div>
            <span className="text-xs font-semibold text-text-muted tracking-widest uppercase">Nuls / Défaites</span>
          </div>
          <div className="flex items-baseline gap-1 relative z-10">
            <span className="text-4xl font-bold text-white">{draws}</span>
            <span className="text-2xl text-text-muted mx-1">/</span>
            <span className="text-4xl font-bold text-alert">{losses}</span>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-surface border border-border rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center"><Target size={16} className="text-purple-500" /></div>
            <span className="text-xs font-semibold text-text-muted tracking-widest uppercase">% Victoires</span>
          </div>
          <div className="flex items-baseline gap-1 relative z-10">
            <span className="text-4xl font-bold text-white">{winRate}</span>
            <span className="text-sm text-text-muted">%</span>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* MATCHS À VENIR (Prend 7 colonnes) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={18} className="text-strain" />
            <h2 className="text-sm font-semibold text-white uppercase tracking-widest">Calendrier</h2>
          </div>
          
          {upcomingMatches.length === 0 ? (
            <div className="bg-surface border border-border border-dashed rounded-3xl p-12 text-center">
              <Trophy size={48} className="mx-auto text-text-muted mb-4 opacity-30" />
              <p className="text-text-muted">Aucun match à venir. Préparez le prochain !</p>
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingMatches.map(m => (
                <motion.div key={m.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="bg-surface border border-border rounded-3xl p-6 relative overflow-hidden group hover:border-strain/30 transition-colors">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-strain/5 blur-3xl pointer-events-none rounded-full" />
                  
                  <div className="flex justify-between items-center relative z-10">
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 rounded-2xl bg-background border border-border flex items-center justify-center">
                        <span className="text-xl font-bold text-white">{m.opponent.substring(0, 2).toUpperCase()}</span>
                      </div>
                      
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-xs font-bold text-strain bg-strain/10 px-2 py-0.5 rounded uppercase tracking-wider">{m.is_home ? "Domicile" : "Extérieur"}</span>
                          <p className="text-lg font-bold text-white">{m.is_home ? "vs" : "@"} {m.opponent}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-text-muted flex items-center gap-1.5"><Calendar size={14}/> {new Date(m.match_date).toLocaleDateString("fr-FR", { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute:'2-digit' })}</p>
                          {m.location && <p className="text-sm text-text-muted flex items-center gap-1.5"><MapPin size={14}/> {m.location}</p>}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <button className="text-xs font-semibold text-text-muted hover:text-white transition-colors bg-background border border-border px-4 py-2 rounded-xl">
                        Détails
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* RÉSULTATS (Prend 5 colonnes) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 size={18} className="text-recovery" />
            <h2 className="text-sm font-semibold text-white uppercase tracking-widest">Historique</h2>
          </div>
          
          {pastMatches.length === 0 ? (
            <div className="bg-surface border border-border border-dashed rounded-3xl p-12 text-center">
              <CheckCircle2 size={48} className="mx-auto text-text-muted mb-4 opacity-30" />
              <p className="text-text-muted">Aucun match joué pour le moment.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pastMatches.map(m => {
                let statusColor = "text-text-muted";
                let statusBg = "bg-background";
                let statusLabel = "À renseigner";
                
                if (m.result_score) {
                  const parts = m.result_score.split("-");
                  if (parts.length === 2) {
                    const myScore = m.is_home ? parseInt(parts[0]) : parseInt(parts[1]);
                    const oppScore = m.is_home ? parseInt(parts[1]) : parseInt(parts[0]);
                    if (myScore > oppScore) { statusColor = "text-recovery"; statusBg = "bg-recovery/10"; statusLabel = "Victoire"; }
                    else if (myScore < oppScore) { statusColor = "text-alert"; statusBg = "bg-alert/10"; statusLabel = "Défaite"; }
                    else { statusColor = "text-warning"; statusBg = "bg-warning/10"; statusLabel = "Match Nul"; }
                  }
                }

                return (
                  <motion.div key={m.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-surface border border-border rounded-2xl p-5 flex flex-col justify-between hover:bg-surface-hover transition-colors">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-semibold text-white">{m.is_home ? "vs" : "@"} {m.opponent}</p>
                        <p className="text-xs text-text-muted">{new Date(m.match_date).toLocaleDateString("fr-FR")}</p>
                      </div>
                      <div className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${statusBg} ${statusColor}`}>
                        {statusLabel}
                      </div>
                    </div>

                    <div className="flex items-end justify-between mt-2 pt-3 border-t border-border/50">
                      <div className="flex-1">
                        {m.result_notes ? (
                          <p className="text-xs text-text-muted italic line-clamp-2">"{m.result_notes}"</p>
                        ) : (
                          <p className="text-xs text-text-muted/50 italic">Aucune note</p>
                        )}
                      </div>
                      
                      <div className="text-right ml-4">
                        {m.result_score ? (
                          <p className={`text-2xl font-bold ${statusColor}`}>{m.result_score}</p>
                        ) : (
                          <button onClick={() => openResultModal(m.id)} className="text-xs bg-white text-black font-semibold px-4 py-1.5 rounded-lg hover:bg-gray-200 transition-colors">
                            Saisir score
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* MODAL AJOUT MATCH */}
      <AnimatePresence>
        {showAddForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="bg-surface border border-border rounded-3xl p-8 w-full max-w-lg relative overflow-hidden">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-strain/10 flex items-center justify-center"><Calendar size={20} className="text-strain" /></div>
                  <h2 className="text-xl font-bold text-white">Programmer un match</h2>
                </div>
                <button onClick={() => setShowAddForm(false)} className="text-text-muted hover:text-white bg-background p-2 rounded-lg transition-colors"><X size={20} /></button>
              </div>

              <form onSubmit={handleAddMatch} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-text-muted tracking-widest uppercase mb-2">Adversaire</label>
                  <input type="text" value={opponent} onChange={e => setOpponent(e.target.value)} required placeholder="Nom de l'équipe" className="w-full bg-background border border-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-strain" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-text-muted tracking-widest uppercase mb-2">Date & Heure</label>
                    <input type="datetime-local" value={date} onChange={e => setDate(e.target.value)} required className="w-full bg-background border border-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-strain" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-muted tracking-widest uppercase mb-2">Lieu</label>
                    <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="Stade, Ville..." className="w-full bg-background border border-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-strain" />
                  </div>
                </div>
                <div className="flex gap-2 bg-background border border-border rounded-xl p-1">
                  <button type="button" onClick={() => setIsHome(true)} className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${isHome ? 'bg-strain text-white' : 'text-text-muted hover:text-white'}`}>Domicile</button>
                  <button type="button" onClick={() => setIsHome(false)} className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${!isHome ? 'bg-strain text-white' : 'text-text-muted hover:text-white'}`}>Extérieur</button>
                </div>
                <div className="pt-4 flex justify-end gap-3">
                  <button type="button" onClick={() => setShowAddForm(false)} className="px-5 py-3 text-sm font-semibold text-text-muted hover:text-white">Annuler</button>
                  <button type="submit" disabled={saving} className="bg-white text-black font-semibold rounded-xl px-6 py-3 hover:bg-gray-200 transition-colors disabled:opacity-50">
                    {saving ? "Création..." : "Ajouter au calendrier"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL SAISIE SCORE */}
      <AnimatePresence>
        {showResultForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="bg-surface border border-border rounded-3xl p-8 w-full max-w-md relative overflow-hidden">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-recovery/10 flex items-center justify-center"><CheckCircle2 size={20} className="text-recovery" /></div>
                  <h2 className="text-xl font-bold text-white">Saisir le score</h2>
                </div>
                <button onClick={() => setShowResultForm(false)} className="text-text-muted hover:text-white bg-background p-2 rounded-lg transition-colors"><X size={20} /></button>
              </div>

              <form onSubmit={handleSaveResult} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-text-muted tracking-widest uppercase mb-2">Score (ex: 2-1)</label>
                  <input type="text" value={score} onChange={e => setScore(e.target.value)} required placeholder="2-1" className="w-full bg-background border border-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-recovery text-center text-2xl font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-muted tracking-widest uppercase mb-2">Notes du match (optionnel)</label>
                  <textarea value={resultNotes} onChange={e => setResultNotes(e.target.value)} placeholder="Ressenti, buts marqués..." className="w-full bg-background border border-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-recovery resize-none h-24" />
                </div>
                <div className="pt-4 flex justify-end gap-3">
                  <button type="button" onClick={() => setShowResultForm(false)} className="px-5 py-3 text-sm font-semibold text-text-muted hover:text-white">Annuler</button>
                  <button type="submit" disabled={saving} className="bg-white text-black font-semibold rounded-xl px-6 py-3 hover:bg-gray-200 transition-colors disabled:opacity-50">
                    {saving ? "Enregistrement..." : "Enregistrer le score"}
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