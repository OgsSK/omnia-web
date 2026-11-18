// src/app/analyses/page.tsx
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { BarChart2, Sparkles, Clock, ArrowRight } from "lucide-react";

type Analysis = { id: string; title: string; content: string; created_at: string };

export default function AnalysesPage() {
  const [loading, setLoading] = useState(true);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchAnalyses();
  }, []);

  const fetchAnalyses = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from("analyses").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      if (data) setAnalyses(data);
    }
    setLoading(false);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      // 1. Récupérer TOUTES les données pour une analyse croisée
      const [sprints, metrics, journal, goals] = await Promise.all([
        supabase.from("measurements").select("*").eq("user_id", user.id).order("measured_at", { ascending: false }).limit(10),
        supabase.from("daily_metrics").select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(10),
        supabase.from("journal_entries").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(3),
        supabase.from("goals").select("*").eq("user_id", user.id)
      ]);

      const context = `
      Sprints récents : ${JSON.stringify(sprints.data)}
      Check-ins récents : ${JSON.stringify(metrics.data)}
      Journal : ${JSON.stringify(journal.data)}
      Objectifs : ${JSON.stringify(goals.data)}
      `;

      // 2. Appel à l'API
      try {
        const res = await fetch("/api/analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ context })
        });
        const data = await res.json();

        // 3. Sauvegarde en BDD
        await supabase.from("analyses").insert({
          user_id: user.id,
          title: "Bilan de performance complet",
          content: data.analysis
        });
        
        fetchAnalyses();
      } catch (e) {
        alert("Erreur lors de la génération de l'analyse.");
      }
    }
    setGenerating(false);
  };

  if (loading) return <div className="p-8 text-white min-h-screen bg-[#020202]">Chargement...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto bg-[#020202] min-h-screen space-y-8">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Analyses & Recommandations</h1>
          <p className="text-sm text-text-muted">L'historique de vos bilans de performance générés par l'IA.</p>
        </div>
        <button 
          onClick={handleGenerate} 
          disabled={generating}
          className="flex items-center gap-2 bg-white text-black font-semibold rounded-xl px-4 py-2 hover:bg-gray-200 transition-colors text-sm disabled:opacity-50"
        >
          <Sparkles size={16} /> {generating ? "Analyse en cours..." : "Nouvelle analyse"}
        </button>
      </header>

      <div className="space-y-6">
        {analyses.length === 0 ? (
          <div className="bg-surface border border-border border-dashed rounded-3xl p-12 text-center">
            <BarChart2 size={48} className="mx-auto text-text-muted mb-4 opacity-50" />
            <p className="text-text-muted">Aucune analyse pour le moment. Cliquez sur "Nouvelle analyse" pour que l'IA étudie vos données.</p>
          </div>
        ) : (
          analyses.map((analysis) => (
            <div key={analysis.id} className="bg-surface border border-border rounded-3xl p-8">
              <div className="flex justify-between items-start mb-6 pb-6 border-b border-border/50">
                <div>
                  <h2 className="text-lg font-semibold text-white">{analysis.title}</h2>
                  <div className="flex items-center gap-2 text-text-muted mt-2">
                    <Clock size={14} />
                    <span className="text-xs">{new Date(analysis.created_at).toLocaleDateString("fr-FR", { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-full bg-strain/10 flex items-center justify-center">
                  <Sparkles size={18} className="text-strain" />
                </div>
              </div>
              <div className="text-sm text-text-main leading-relaxed whitespace-pre-wrap">
                {analysis.content}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}