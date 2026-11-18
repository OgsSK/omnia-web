// src/app/omnia/page.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { isAIEnabled } from "@/lib/ai-guard";
import { 
  Sparkles, ArrowUp, User, BrainCircuit, 
  Activity, BookOpen, Target, Zap, ShieldCheck, ChevronRight,
  RotateCcw, Moon, Utensils, ShieldAlert, Timer, Lock
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Message = { id: string; role: "user" | "omnia"; content: string; };

const DEFAULT_MESSAGE: Message = { id: "1", role: "omnia", content: "Bonjour. Je suis OMNIA, votre intelligence personnelle. J'ai analysé vos dernières données. Que souhaitez-vous savoir aujourd'hui ?" };

export default function OmniaPage() {
  const [messages, setMessages] = useState<Message[]>([DEFAULT_MESSAGE]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [aiEnabled, setAiEnabled] = useState<boolean>(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const suggestedPrompts = ["Analyse mes derniers sprints", "Comment améliorer ma récupération ?", "Résume ma semaine d'entraînement", "Est-ce que je progresse assez vite ?"];

  // ✅ 1. Vérification au chargement + Message de retour si réactivé
  useEffect(() => {
    const initChat = async () => {
      const enabled = await isAIEnabled();
      setAiEnabled(enabled);

      const savedChat = localStorage.getItem("omnia_chat_history");
      if (savedChat) {
        try {
          const parsed = JSON.parse(savedChat);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const lastMsg = parsed[parsed.length - 1];
            
            // Si la dernière chose affichée était l'erreur, mais que l'IA est maintenant active
            if (enabled && lastMsg.content.includes("L'analyse IA est désactivée")) {
              const reactivatedMsg: Message = { 
                id: Date.now().toString(), 
                role: "omnia", 
                content: "L'analyse IA est de nouveau activée. Je suis prêt à répondre à vos questions." 
              };
              const newMessages = [...parsed, reactivatedMsg];
              setMessages(newMessages);
              localStorage.setItem("omnia_chat_history", JSON.stringify(newMessages));
              return;
            }
            
            setMessages(parsed);
          }
        } catch (e) {
          console.error("Erreur lecture historique chat", e);
        }
      }
    };
    initChat();
  }, []);

  // ✅ 2. Détecter si l'utilisateur revient sur l'onglet après avoir changé les paramètres
  useEffect(() => {
    const handleFocus = async () => {
      const enabled = await isAIEnabled();
      
      setAiEnabled((currentState) => {
        // Si c'était désactivé (false) et que ça devient activé (true)
        if (!currentState && enabled) {
          setMessages((msgs) => {
            const lastMsg = msgs[msgs.length - 1];
            // On ajoute le message de retour seulement si la dernière ligne était l'erreur
            if (lastMsg && lastMsg.content.includes("L'analyse IA est désactivée")) {
              return [...msgs, { 
                id: Date.now().toString(), 
                role: "omnia", 
                content: "L'analyse IA est de nouveau activée. Comment puis-je vous aider ?" 
              }];
            }
            return msgs;
          });
        }
        return enabled;
      });
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  useEffect(() => { if (messages.length > 1) localStorage.setItem("omnia_chat_history", JSON.stringify(messages)); }, [messages]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isTyping]);

  const clearChat = () => {
    if (confirm("Voulez-vous effacer l'historique de cette conversation ?")) { 
      setMessages([DEFAULT_MESSAGE]); 
      localStorage.removeItem("omnia_chat_history"); 
    }
  };

  const handleSend = async (e: React.FormEvent | null, forcedInput?: string) => {
    if (e) e.preventDefault();
    const textToSend = forcedInput || input;
    if (!textToSend.trim()) return;

    // 1. On affiche TOUJOURS le message de l'utilisateur d'abord
    const userMessage: Message = { id: Date.now().toString(), role: "user", content: textToSend.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput(""); 
    setIsTyping(true);

    // 2. On vérifie ensuite l'état de l'IA
    const aiAllowed = await isAIEnabled();
    setAiEnabled(aiAllowed); // On synchronise l'UI

    if (!aiAllowed) {
      // On simule une petite réflexion puis on affiche l'erreur
      setTimeout(() => {
        const errorMsg: Message = { id: Date.now().toString(), role: "omnia", content: "L'analyse IA est désactivée dans vos paramètres. Activez-la pour discuter avec moi." };
        setMessages((prev) => [...prev, errorMsg]);
        setIsTyping(false);
      }, 500);
      return;
    }

    // 3. Si l'IA est active, on continue normalement
    const { data: { user } } = await supabase.auth.getUser();
    let userContext = ""; let historicalData = "";

    if (user) {
      const [metricsRes, measurementsRes, injuriesRes, journalRes, nutritionRes] = await Promise.all([
        supabase.from("daily_metrics").select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(14),
        supabase.from("measurements").select("*").eq("user_id", user.id).order("measured_at", { ascending: false }).limit(10),
        supabase.from("injuries").select("*").eq("user_id", user.id).eq("status", "active"),
        supabase.from("journal_entries").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(3),
        supabase.from("meal_logs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5)
      ]);

      const activeInjuries = injuriesRes.data?.map(i => `${i.body_part} (Intensité ${i.severity}/5)`).join("; ");
      userContext = `Blessures actives : ${activeInjuries || "Aucune"}. Derniers tests : ${measurementsRes.data?.map(m => `${m.metric_type}: ${m.value}`).join(", ") || "Aucun"}. Derniers repas : ${nutritionRes.data?.map(n => `${n.meal_type}: ${n.calories}kcal`).join(", ") || "Aucun"}. Notes de journal récentes : ${journalRes.data?.map(j => j.content).join(" | ") || "Aucune"}.`;
      const previousMessages = messages.slice(-4).map(m => `${m.role === 'user' ? 'Moi' : 'OMNIA'}: ${m.content}`).join("\n");
      historicalData = `Historique de la conversation :\n${previousMessages}\n\nDonnées physio (14j) : ${JSON.stringify(metricsRes.data || [])}`;
    }

    try {
      const res = await fetch("/api/deep-analysis", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: userMessage.content, userContext, historicalData }) });
      const data = await res.json();
      const omniaResponse: Message = { id: (Date.now() + 1).toString(), role: "omnia", content: data.analysis || "Je n'ai pas pu analyser votre demande." };
      setMessages((prev) => [...prev, omniaResponse]);
    } catch (error) {
      console.error(error);
      const errorResponse: Message = { id: (Date.now() + 2).toString(), role: "omnia", content: "Une erreur est survenue lors de l'analyse. Réessayez dans un instant." };
      setMessages((prev) => [...prev, errorResponse]);
    } finally { setIsTyping(false); }
  };

  return (
    <div className="flex h-[100dvh] md:h-screen gap-4 md:gap-6 p-3 md:p-6 max-w-[1600px] mx-auto">
      <div className="flex-1 bg-surface border border-border rounded-3xl flex flex-col overflow-hidden relative shadow-2xl">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-strain/5 to-transparent pointer-events-none" />
        
        {/* HEADER DU CHAT */}
        <header className="px-4 md:px-6 py-3 md:py-4 border-b border-border flex items-center justify-between shrink-0 bg-surface/80 backdrop-blur-sm z-10">
          <div className="flex items-center gap-2 md:gap-3">
            <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-colors ${aiEnabled ? 'bg-strain/20 shadow-[0_0_15px_rgba(0,147,231,0.3)]' : 'bg-surface-hover'}`}>
              <BrainCircuit className={aiEnabled ? 'text-strain' : 'text-text-muted'} size={16} />
            </div>
            <div>
              <h1 className={`text-sm md:text-lg font-bold ${aiEnabled ? 'text-white' : 'text-text-muted'}`}>OMNIA</h1>
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${aiEnabled ? 'bg-recovery animate-pulse' : 'bg-alert'}`} />
                <p className={`text-[8px] md:text-[10px] font-semibold tracking-wider uppercase ${aiEnabled ? 'text-recovery' : 'text-alert'}`}>
                  {aiEnabled ? "Mémoire active" : "IA désactivée"}
                </p>
              </div>
            </div>
          </div>
          <button onClick={clearChat} title="Nouvelle conversation" className="flex items-center gap-2 text-[10px] md:text-xs text-text-muted hover:text-alert bg-background border border-border px-2 md:px-3 py-1.5 md:py-2 rounded-lg transition-colors">
            <RotateCcw size={12} className="md:w-[14px] md:h-[14px]" />
            <span className="hidden md:inline">Effacer</span>
          </button>
        </header>

        {/* MESSAGES */}
        <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-4 md:space-y-6 custom-scrollbar z-10">
          <AnimatePresence>
            {messages.map((msg) => (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className={`flex gap-2 md:gap-4 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center shrink-0 border ${msg.role === "omnia" ? "bg-strain/10 border-strain/30 text-strain" : "bg-surface-hover border-border text-white"}`}>{msg.role === "omnia" ? <Sparkles size={12} className="md:w-4 md:h-4" /> : <User size={12} className="md:w-4 md:h-4" />}</div>
                <div className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"} max-w-[90%] md:max-w-[80%]`}>
                  <span className="text-[8px] md:text-[10px] text-text-muted mb-1 font-bold tracking-widest uppercase">{msg.role === "omnia" ? "OMNIA" : "VOUS"}</span>
                  <div className={`px-3 py-2 md:px-5 md:py-3.5 rounded-2xl ${msg.role === "user" ? "bg-strain text-white rounded-tr-sm shadow-[0_4px_15px_rgba(0,147,231,0.2)]" : "bg-background border border-border text-text-main rounded-tl-sm shadow-lg"}`}><p className="text-xs md:text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p></div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {isTyping && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2 md:gap-4">
              <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-strain/10 border border-strain/30 flex items-center justify-center shrink-0"><Sparkles className="text-strain" size={12} /></div>
              <div className="flex flex-col items-start"><span className="text-[8px] md:text-[10px] text-text-muted mb-1 font-bold tracking-widest uppercase">OMNIA RÉFLÉCHIT</span><div className="px-4 py-3 rounded-2xl bg-background border border-border rounded-tl-sm flex gap-1 md:gap-1.5 shadow-lg"><div className="w-1 h-1 md:w-1.5 md:h-1.5 bg-strain rounded-full animate-bounce" /><div className="w-1 h-1 md:w-1.5 md:h-1.5 bg-strain rounded-full animate-bounce [animation-delay:0.2s]" /><div className="w-1 h-1 md:w-1.5 md:h-1.5 bg-strain rounded-full animate-bounce [animation-delay:0.4s]" /></div></div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* INPUT AREA */}
        <div className="p-2 md:p-4 border-t border-border shrink-0 bg-surface/80 backdrop-blur-sm z-10">
          {messages.length < 3 && aiEnabled && (
            <div className="flex gap-2 overflow-x-auto pb-2 md:pb-4 custom-scrollbar hide-scroll">
              {suggestedPrompts.map((prompt, i) => (
                <button key={i} onClick={() => handleSend(null, prompt)} className="whitespace-nowrap text-[10px] md:text-xs bg-background border border-border text-text-muted px-2 md:px-3 py-1.5 md:py-2 rounded-lg hover:border-strain hover:text-white transition-colors">{prompt}</button>
              ))}
            </div>
          )}
          <form onSubmit={(e) => handleSend(e)} className="relative flex items-center">
            <input 
              type="text" 
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              placeholder={aiEnabled ? "Posez une question..." : "L'IA est désactivée dans vos paramètres..."} 
              disabled={!aiEnabled}
              className="w-full bg-background border border-border rounded-xl pl-3 md:pl-5 pr-12 md:pr-14 py-3 md:py-4 text-base md:text-sm text-white focus:outline-none focus:border-strain focus:ring-1 focus:ring-strain transition-all shadow-inner disabled:opacity-50 disabled:cursor-not-allowed" 
            />
            <button type="submit" disabled={!input.trim() || isTyping || !aiEnabled} className="absolute right-1.5 md:right-2 w-8 h-8 md:w-10 md:h-10 bg-white text-black rounded-lg flex items-center justify-center hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              <ArrowUp size={16} className="md:w-5 md:h-5" />
            </button>
          </form>
        </div>
      </div>

      {/* PANNEAU DROIT */}
      <div className="w-80 hidden xl:flex flex-col gap-4">
        <div className="bg-surface border border-border rounded-3xl p-6 relative overflow-hidden">
          <div className={`absolute top-0 right-0 w-32 h-32 blur-2xl pointer-events-none rounded-full ${aiEnabled ? 'bg-strain/10' : 'bg-alert/10'}`} />
          <div className="flex items-center gap-2 mb-4 relative z-10">
            {aiEnabled ? <ShieldCheck size={18} className="text-recovery" /> : <Lock size={18} className="text-alert" />}
            <h3 className="text-xs font-semibold tracking-widest text-text-muted uppercase">Données connectées</h3>
          </div>
          <p className="text-xs text-text-muted leading-relaxed mb-4 relative z-10">
            {aiEnabled 
              ? "OMNIA utilise un accès sécurisé et anonymisé à vos données pour générer ses réponses."
              : "L'accès aux données est suspendu car l'intelligence artificielle est désactivée dans vos paramètres."}
          </p>
          
          <div className="space-y-3 relative z-10">
            <div className="flex items-center justify-between text-xs">
              <span className={`flex items-center gap-2 ${aiEnabled ? 'text-white' : 'text-text-muted'}`}><Moon size={14} className={aiEnabled ? "text-blue-500" : "text-text-muted"}/> Sommeil & Récup.</span>
              <span className={`font-semibold ${aiEnabled ? "text-recovery" : "text-alert"}`}>{aiEnabled ? "Connecté" : "Déconnecté"}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className={`flex items-center gap-2 ${aiEnabled ? 'text-white' : 'text-text-muted'}`}><Activity size={14} className={aiEnabled ? "text-strain" : "text-text-muted"}/> Tests physiques</span>
              <span className={`font-semibold ${aiEnabled ? "text-recovery" : "text-alert"}`}>{aiEnabled ? "Connecté" : "Déconnecté"}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className={`flex items-center gap-2 ${aiEnabled ? 'text-white' : 'text-text-muted'}`}><Utensils size={14} className={aiEnabled ? "text-warning" : "text-text-muted"}/> Nutrition</span>
              <span className={`font-semibold ${aiEnabled ? "text-recovery" : "text-alert"}`}>{aiEnabled ? "Connecté" : "Déconnecté"}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className={`flex items-center gap-2 ${aiEnabled ? 'text-white' : 'text-text-muted'}`}><ShieldAlert size={14} className={aiEnabled ? "text-alert" : "text-text-muted"}/> Blessures</span>
              <span className={`font-semibold ${aiEnabled ? "text-recovery" : "text-alert"}`}>{aiEnabled ? "Connecté" : "Déconnecté"}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className={`flex items-center gap-2 ${aiEnabled ? 'text-white' : 'text-text-muted'}`}><BookOpen size={14} className={aiEnabled ? "text-sleep" : "text-text-muted"}/> Journal</span>
              <span className={`font-semibold ${aiEnabled ? "text-recovery" : "text-alert"}`}>{aiEnabled ? "Connecté" : "Déconnecté"}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className={`flex items-center gap-2 ${aiEnabled ? 'text-white' : 'text-text-muted'}`}><Target size={14} className={aiEnabled ? "text-yellow-500" : "text-text-muted"}/> Objectifs</span>
              <span className={`font-semibold ${aiEnabled ? "text-recovery" : "text-alert"}`}>{aiEnabled ? "Connecté" : "Déconnecté"}</span>
            </div>
          </div>
        </div>

        {/* ACTIONS RAPIDES */}
        <div className={`bg-surface border border-border rounded-3xl p-6 flex-1 transition-opacity ${!aiEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center gap-2 mb-4"><Zap size={18} className="text-purple-500" /><h3 className="text-xs font-semibold tracking-widest text-text-muted uppercase">Actions rapides</h3></div>
          <div className="space-y-2">
            <button onClick={() => handleSend(null, "Génère un bilan de ma progression globale")} className="w-full flex items-center justify-between p-3 bg-background border border-border rounded-xl hover:border-purple-500/50 transition-colors group text-left"><span className="text-xs text-white font-medium">Bilan de progression</span><ChevronRight size={14} className="text-text-muted group-hover:text-purple-500 transition-colors" /></button>
            <button onClick={() => handleSend(null, "Quel est mon point faible actuel ?")} className="w-full flex items-center justify-between p-3 bg-background border border-border rounded-xl hover:border-purple-500/50 transition-colors group text-left"><span className="text-xs text-white font-medium">Analyser mes faiblesses</span><ChevronRight size={14} className="text-text-muted group-hover:text-purple-500 transition-colors" /></button>
            <button onClick={() => handleSend(null, "Donne-moi un conseil pour ma prochaine séance")} className="w-full flex items-center justify-between p-3 bg-background border border-border rounded-xl hover:border-purple-500/50 transition-colors group text-left"><span className="text-xs text-white font-medium">Conseil pour demain</span><ChevronRight size={14} className="text-text-muted group-hover:text-purple-500 transition-colors" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}