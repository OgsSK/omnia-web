// src/app/nutrition/page.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { isAIEnabled } from "@/lib/ai-guard";
import {
  Utensils, Plus, Sparkles, Check, X,
  Carrot, Flame, Beef, Wheat, Scale,
  ArrowLeft, PlusCircle, AlertTriangle, RefreshCw,
  TrendingUp, Target, BrainCircuit,
  Calculator, Info, Clock, Pizza, UtensilsCrossed,
  ArrowRight, ArrowRightLeft, Package, ListOrdered,
  History, Trash2, Pencil
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import ReactMarkdown from "react-markdown";

type FoodItem = { id: string; name: string; quantity: number; unit: string };
type MealLog = { id: string; meal_type: string; name: string; calories: number; protein: number; carbs: number; fat: number; ingredients?: any[] };
type Ingredient = { name: string; amount: number; unit: string };
type AIMeal = {
  name: string; description: string;
  ingredients: Ingredient[];
  calories: number; protein: number; carbs: number; fat: number
};
type OptimizedMeal = {
  name: string;
  variant: "classique" | "allegee" | "proteinee";
  description: string;
  ingredients: Ingredient[];
  instructions: string[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  healthScore: number;
};
type SubstituteOption = {
  name: string;
  amount: number;
  unit: string;
  reason: string;
  newTotals: { calories: number; protein: number; carbs: number; fat: number };
  caloriesDelta: number;
  fromPantry: boolean;
};
type SubstitutionTarget = {
  source: "ai" | "optimized";
  mealIndex: number;
  ingredientIndex: number;
  mealName: string;
  ingredient: Ingredient;
};
type AnalysisHistory = {
  id: string;
  analysis: string;
  created_at: string;
};

type EnrichedIngredient = Ingredient & {
  pantry_item_id?: string;
  deducted_amount?: number;
  deducted_unit?: string;
  status?: "deducted" | "not_in_stock" | "conversion_failed";
};

const normalizeName = (n: string) =>
  (n || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/s$/, "");

const computePantryDeduction = (
  ingAmount: number,
  ingUnit: string,
  pantryQty: number,
  pantryUnit: string
): number | null => {
  const iu = (ingUnit || "").toLowerCase().trim();
  const pu = (pantryUnit || "").toLowerCase().trim();

  if ((iu === "g" || iu === "kg") && (pu === "g" || pu === "kg")) {
    const ingInG = iu === "kg" ? ingAmount * 1000 : ingAmount;
    return pu === "g" ? ingInG : ingInG / 1000;
  }

  if ((iu === "ml" || iu === "l") && (pu === "ml" || pu === "l")) {
    const ingInMl = iu === "l" ? ingAmount * 1000 : ingAmount;
    return pu === "ml" ? ingInMl : ingInMl / 1000;
  }

  const countUnits = ["unit", "unité", "pièce", "pièces", "tranche", "tranches"];
  if (countUnits.includes(iu) && countUnits.includes(pu)) {
    return ingAmount;
  }

  if (["c.à.s", "c.à.c", "cas", "cac", "pincée", "pincee"].includes(iu)) {
    return null;
  }

  if (iu === pu) return ingAmount;

  return null;
};

const formatIngredient = (amount: number, unit: string, name: string): string => {
  const u = (unit || "").toLowerCase().trim();
  if (["unit", "unité", "pièce", "pièces"].includes(u)) {
    return `${amount} × ${name}`;
  }
  if (["tranche", "tranches"].includes(u)) {
    return `${amount} tranche${amount > 1 ? "s" : ""} · ${name}`;
  }
  return `${amount} ${u} · ${name}`;
};

export default function NutritionPage() {
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState<Date | null>(null);
  const [weight, setWeight] = useState<number | null>(null);
  const [weightDate, setWeightDate] = useState<Date | null>(null);
  const [isDataStale, setIsDataStale] = useState(false);
  const [targetWeight, setTargetWeight] = useState<number | null>(null);
  const [weightGoal, setWeightGoal] = useState("maintain");
  const [targetCals, setTargetCals] = useState(2300);
  const [bmr, setBmr] = useState(0);
  const [tdee, setTdee] = useState(0);
  const [userAge, setUserAge] = useState<number | null>(null);
  const [userHeight, setUserHeight] = useState<number | null>(null);
  const [pantry, setPantry] = useState<FoodItem[]>([]);
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [newFood, setNewFood] = useState("");
  const [newQty, setNewQty] = useState("");
  const [newUnit, setNewUnit] = useState("g");
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [mealType, setMealType] = useState("");
  const [context, setContext] = useState("");
  const [sportType, setSportType] = useState("");
  const [prepTime, setPrepTime] = useState("");
  const [craving, setCraving] = useState("");
  const [customNote, setCustomNote] = useState("");
  const [generating, setGenerating] = useState(false);
  const [aiOptions, setAiOptions] = useState<AIMeal[]>([]);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualMeal, setManualMeal] = useState({ type: "lunch", name: "", cals: "", prot: "", carbs: "", fat: "" });

  const [currentMealsGenId, setCurrentMealsGenId] = useState<string | null>(null);

  const [analysisHistories, setAnalysisHistories] = useState<AnalysisHistory[]>([]);
  const [selectedAnalysisIndex, setSelectedAnalysisIndex] = useState(0);
  const [showAnalysisHistory, setShowAnalysisHistory] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);

  const [editingFoodId, setEditingFoodId] = useState<string | null>(null);
  const [editFoodName, setEditFoodName] = useState("");
  const [editFoodQty, setEditFoodQty] = useState("");
  const [editFoodUnit, setEditFoodUnit] = useState("g");

  const [modalTab, setModalTab] = useState<"manual" | "optimize">("manual");
  const [dishInput, setDishInput] = useState("");
  const [optimizing, setOptimizing] = useState(false);
  const [optimizedOptions, setOptimizedOptions] = useState<OptimizedMeal[]>([]);
  const [optimizedDishName, setOptimizedDishName] = useState<string | null>(null);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);

  const [substitutionTarget, setSubstitutionTarget] = useState<SubstitutionTarget | null>(null);
  const [substitutionPreference, setSubstitutionPreference] = useState("");
  const [substituting, setSubstituting] = useState(false);
  const [substituteOptions, setSubstituteOptions] = useState<SubstituteOption[]>([]);
  const [substituteError, setSubstituteError] = useState<string | null>(null);

  useEffect(() => {
    setNow(new Date());
    fetchData();
  }, []);

  const fetchData = async () => {
    const currentDate = new Date().toISOString().split("T")[0];
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const meta = user.user_metadata || {};
      const userGoal = meta.weight_goal || "maintain";
      const userTarget = meta.target_weight ? parseFloat(meta.target_weight) : null;
      const height = meta.height ? parseFloat(meta.height) : 175;
      const isMale = meta.sex !== "F";

      let calculatedAge = 25;
      if (meta.birth_date) {
        const birthDate = new Date(meta.birth_date);
        const today = new Date();
        calculatedAge = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) calculatedAge--;
      }

      setUserAge(calculatedAge);
      setUserHeight(height);
      setWeightGoal(userGoal);
      setTargetWeight(userTarget);

      const { data: health } = await supabase.from("health_metrics").select("weight, date").eq("user_id", user.id).order("date", { ascending: false }).limit(1);

      let latestWeight = 75;
      if (health && health.length > 0 && health[0].weight) {
        latestWeight = health[0].weight;
        const latestDate = new Date(health[0].date);
        const daysSinceUpdate = Math.ceil((new Date().getTime() - latestDate.getTime()) / (1000 * 60 * 60 * 24));
        setWeight(latestWeight);
        setWeightDate(latestDate);
        if (daysSinceUpdate > 7) setIsDataStale(true);
      } else {
        setIsDataStale(true);
      }

      const baseBmr = (10 * latestWeight) + (6.25 * height) - (5 * calculatedAge) + (isMale ? 5 : -161);
      setBmr(Math.round(baseBmr));

      const activityMultiplier = 1.4;
      const calculatedTdee = baseBmr * activityMultiplier;
      setTdee(Math.round(calculatedTdee));

      let dailyCals = calculatedTdee;
      if (userGoal === "lose") dailyCals -= 500;
      if (userGoal === "gain") dailyCals += 500;
      setTargetCals(Math.round(dailyCals));

      const [pantryRes, mealsRes, analysesRes, lastMealsGenRes] = await Promise.all([
        supabase.from("food_items").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("meal_logs").select("*").eq("user_id", user.id).eq("date", currentDate),
        supabase.from("ai_generations")
          .select("id, content, created_at")
          .eq("user_id", user.id)
          .eq("type", "nutrition_analysis")
          .order("created_at", { ascending: false }),
        supabase.from("ai_generations").select("id, content").eq("user_id", user.id).eq("type", "nutrition_meals").gte("created_at", todayStart.toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle()
      ]);

      if (pantryRes.data) setPantry(pantryRes.data);
      if (mealsRes.data) setMeals(mealsRes.data);

      if (analysesRes.data) {
        const formatted = analysesRes.data
          .filter((h: any) => h.content?.analysis)
          .map((h: any) => ({
            id: h.id,
            analysis: h.content.analysis,
            created_at: h.created_at
          }));
        setAnalysisHistories(formatted);
      }

      if (lastMealsGenRes.data?.content) {
        const { mealType: savedMealType, options, wizardState } = lastMealsGenRes.data.content;
        const isLogged = mealsRes.data?.some(m => m.meal_type === savedMealType);

        if (!isLogged && options && options.length > 0) {
          setCurrentMealsGenId(lastMealsGenRes.data.id);
          setMealType(savedMealType);
          setAiOptions(options);
          setContext(wizardState.context || "");
          setSportType(wizardState.sportType || "");
          setPrepTime(wizardState.prepTime || "");
          setCraving(wizardState.craving || "");
          setCustomNote(wizardState.customNote || "");
          setWizardStep(3);
          setShowWizard(true);
        }
      }
    }
    setLoading(false);
  };

  const openManualModal = (tab: "manual" | "optimize" = "manual") => {
    setModalTab(tab);
    setShowManualAdd(true);
    setDishInput("");
    setOptimizedOptions([]);
    setOptimizedDishName(null);
    setOptimizeError(null);
  };

  const addFood = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFood || !newQty) return;
    let finalQty = parseFloat(newQty);
    let finalUnit = newUnit;
    if (newUnit === "kg") { finalQty *= 1000; finalUnit = "g"; }
    if (newUnit === "L") { finalQty *= 1000; finalUnit = "ml"; }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("food_items").insert({ user_id: user.id, name: newFood, quantity: finalQty, unit: finalUnit });
      setNewFood(""); setNewQty("");
      fetchData();
    }
  };

  const startEditingFood = (item: FoodItem) => {
    setEditingFoodId(item.id);
    setEditFoodName(item.name);
    setEditFoodQty(item.quantity.toString());
    setEditFoodUnit(item.unit);
  };

  const saveEditedFood = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFoodId || !editFoodName || !editFoodQty) return;

    let finalQty = parseFloat(editFoodQty);
    let finalUnit = editFoodUnit;
    if (editFoodUnit === "kg") { finalQty *= 1000; finalUnit = "g"; }
    if (editFoodUnit === "L") { finalQty *= 1000; finalUnit = "ml"; }

    const { error } = await supabase.from("food_items").update({
      name: editFoodName,
      quantity: finalQty,
      unit: finalUnit
    }).eq("id", editingFoodId);

    if (!error) {
      setEditingFoodId(null);
      fetchData();
    } else {
      alert("Erreur lors de la modification.");
    }
  };

  const formatStock = (qty: number, unit: string) => {
    if (unit === "g" && qty >= 1000) return `${(qty / 1000).toFixed(1)} kg`;
    if (unit === "ml" && qty >= 1000) return `${(qty / 1000).toFixed(1)} L`;
    if (unit === "unit") return `${qty} u.`;
    return `${qty} ${unit}`;
  };

  const startWizard = (type: string) => {
    setMealType(type); setWizardStep(1); setContext(""); setSportType(""); setPrepTime(""); setCraving(""); setCustomNote(""); setAiOptions([]); setShowWizard(true);
  };

  const closeWizard = async () => {
    if (wizardStep === 3 && currentMealsGenId) {
      await supabase.from("ai_generations").delete().eq("id", currentMealsGenId);
      setCurrentMealsGenId(null);
    }
    setShowWizard(false);
  };

  const handleContextSelect = (ctx: string) => {
    setContext(ctx);
    if (ctx === "repos") setWizardStep(2); else setWizardStep(1.5);
  };

  const handleSportSelect = (sport: string) => { setSportType(sport); setWizardStep(2); };
  const handlePreferencesSubmit = () => { setWizardStep(3); generateMeals(); };

  const generateMeals = async () => {
    const aiAllowed = await isAIEnabled();
    if (!aiAllowed) {
      alert("L'analyse IA est désactivée dans vos paramètres. Activez-la pour générer des recettes.");
      setWizardStep(2);
      setGenerating(false);
      return;
    }

    setGenerating(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const today = new Date().toISOString().split("T")[0];
    const [metricRes, healthRes] = await Promise.all([
      supabase.from("daily_metrics").select("*").eq("user_id", user.id).eq("date", today).maybeSingle(),
      supabase.from("health_metrics").select("stress_level, energy_level").eq("user_id", user.id).order("date", { ascending: false }).limit(1)
    ]);

    const currentMetric = metricRes.data;
    const currentStress = healthRes.data?.[0]?.stress_level || 3;
    const currentTotalCals = meals.reduce((acc, curr) => acc + (curr.calories || 0), 0);
    const caloriesRemaining = targetCals - currentTotalCals;

    let promptContext = `
    CONTEXTE DU REPAS :
    - Repas : ${mealType}. Objectif de poids : ${weightGoal === 'lose' ? 'Perte de poids' : weightGoal === 'gain' ? 'Prise de masse' : 'Maintien'}.
    - Calories restantes : ${caloriesRemaining} kcal (sur un objectif de ${targetCals}).

    PRÉFÉRENCES UTILISATEUR :
    - Temps de préparation : ${prepTime || "Peu importe"}.
    - Envie : ${craving || "Peu importe"}.
    - Instructions spéciales : ${customNote || "Aucune"}.
    `;

    if (context === "avant" && sportType) promptContext += `\n- Ce repas est AVANT une séance de ${sportType}. Privilégie les glucides rapides.`;
    if (context === "apres" && sportType) promptContext += `\n- Ce repas est APRÈS une séance de ${sportType}. Privilégie les protéines.`;
    if (currentMetric) {
      promptContext += `\n- Récupération du jour : ${currentMetric.recovery_score}%. Sommeil : ${currentMetric.sleep_hours}h.`;
      if (currentMetric.recovery_score < 50) promptContext += `\n⚠️ Le corps est fatigué. Propose des aliments faciles à digérer.`;
    }
    if (currentStress >= 4) promptContext += `\n- L'athlète est stressé. Propose des aliments riches en magnésium.`;

    try {
      const res = await fetch("/api/nutrition", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mealType, pantry, userContext: promptContext })
      });
      const data = await res.json();
      setAiOptions(data.meals || []);

      if (data.meals && data.meals.length > 0) {
        const { data: insertedGen } = await supabase.from("ai_generations").insert({
          user_id: user.id, type: "nutrition_meals",
          content: { mealType, options: data.meals, wizardState: { context, sportType, prepTime, craving, customNote } }
        }).select("id").single();
        
        if (insertedGen) setCurrentMealsGenId(insertedGen.id);
      }
    } catch (e) { console.error(e); } finally { setGenerating(false); }
  };

  const generateAnalysis = async () => {
    const aiAllowed = await isAIEnabled();
    if (!aiAllowed) {
      alert("L'analyse IA est désactivée dans vos paramètres. Activez-la pour générer un bilan nutritionnel.");
      setLoadingAnalysis(false);
      return;
    }

    if (meals.length === 0) return;
    setLoadingAnalysis(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoadingAnalysis(false); return; }

    const today = new Date().toISOString().split("T")[0];
    const { data: metric } = await supabase.from("daily_metrics").select("*").eq("user_id", user.id).eq("date", today).maybeSingle();
    let userContext = "Journée normale.";
    if (metric) userContext = `Récupération: ${metric.recovery_score}%, Sommeil: ${metric.sleep_hours}h.`;

    try {
      const res = await fetch("/api/nutrition-analysis", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meals, targetCals, targetProtein: Math.round((targetCals * 0.3) / 4), weightGoal, userContext })
      });
      const data = await res.json();

      if (user && data.analysis) {
        const { data: newGen, error } = await supabase.from("ai_generations").insert({
          user_id: user.id,
          type: "nutrition_analysis",
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
    } catch (e) { console.error(e); } finally { setLoadingAnalysis(false); }
  };

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

  const deductPantryStock = async (ingredients: Ingredient[]): Promise<EnrichedIngredient[]> => {
    if (!ingredients || !Array.isArray(ingredients)) return [];

    const enriched: EnrichedIngredient[] = [];

    for (const ing of ingredients) {
      if (!ing?.name || !ing?.amount || !ing?.unit) continue;

      const pantryItem = pantry.find(p => normalizeName(p.name) === normalizeName(ing.name));
      if (!pantryItem) {
        enriched.push({ ...ing, status: "not_in_stock" });
        continue;
      }

      const deduction = computePantryDeduction(Number(ing.amount), ing.unit, Number(pantryItem.quantity), pantryItem.unit);

      if (deduction === null || deduction <= 0) {
        enriched.push({ ...ing, pantry_item_id: pantryItem.id, status: "conversion_failed" });
        continue;
      }

      const newQty = Math.max(0, Number(pantryItem.quantity) - deduction);
      await supabase.from("food_items").update({ quantity: newQty }).eq("id", pantryItem.id);

      enriched.push({
        ...ing,
        pantry_item_id: pantryItem.id,
        deducted_amount: deduction,
        deducted_unit: pantryItem.unit,
        status: "deducted"
      });
    }

    return enriched;
  };

  const logMeal = async (meal: any, type: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    const currentDate = new Date().toISOString().split("T")[0];

    if (user) {
      const enrichedIngredients = await deductPantryStock(meal.ingredients || []);

      const payload: any = {
        user_id: user.id,
        date: currentDate,
        meal_type: type,
        name: meal.name,
        calories: meal.calories,
        protein: meal.protein,
        carbs: meal.carbs,
        fat: meal.fat
      };

      if (enrichedIngredients.length > 0) {
        payload.ingredients = enrichedIngredients;
      }

      let { error } = await supabase.from("meal_logs").insert(payload);

      if (error && (error.code === 'PGRST204' || error.message.includes("ingredients"))) {
        console.warn("La colonne 'ingredients' n'existe pas dans meal_logs.");
        alert("⚠️ Attention : La colonne 'ingredients' n'existe pas dans Supabase. Le repas est bien enregistré, mais le stock ne pourra pas être restauré si tu supprimes ce repas.\n\nPour corriger cela, exécute cette commande dans l'éditeur SQL de Supabase :\nALTER TABLE meal_logs ADD COLUMN ingredients jsonb;");
        
        delete payload.ingredients;
        const { error: fallbackError } = await supabase.from("meal_logs").insert(payload);
        if (fallbackError) {
          console.error(fallbackError);
          alert("Erreur lors de l'enregistrement du repas.");
          return;
        }
      } else if (error) {
        console.error(error);
        alert("Erreur lors de l'enregistrement du repas.");
        return;
      }

      if (currentMealsGenId) {
        await supabase.from("ai_generations").delete().eq("id", currentMealsGenId);
        setCurrentMealsGenId(null);
      }

      setShowWizard(false); setShowManualAdd(false); fetchData();
    }
  };

  const deleteMeal = async (meal: MealLog) => {
    if (!confirm(`Supprimer "${meal.name}" ?\n\nLes ingrédients seront remis dans ton stock si possible.`)) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let restoredCount = 0;
    const failed: string[] = [];

    if (meal.ingredients && Array.isArray(meal.ingredients) && meal.ingredients.length > 0) {
      for (const ing of meal.ingredients as EnrichedIngredient[]) {
        if (ing.status === "not_in_stock" || ing.status === "conversion_failed") continue;
        if (!ing.pantry_item_id || !ing.deducted_amount) {
          failed.push(ing.name);
          continue;
        }

        const { data: currentItem } = await supabase
          .from("food_items")
          .select("quantity")
          .eq("id", ing.pantry_item_id)
          .maybeSingle();

        if (!currentItem) {
          failed.push(`${ing.name} (n'est plus dans le stock)`);
          continue;
        }

        const newQty = Number(currentItem.quantity) + Number(ing.deducted_amount);
        const { error } = await supabase
          .from("food_items")
          .update({ quantity: newQty })
          .eq("id", ing.pantry_item_id);

        if (error) {
          failed.push(`${ing.name} (erreur BDD)`);
        } else {
          restoredCount++;
        }
      }
    }

    const { error } = await supabase.from("meal_logs").delete().eq("id", meal.id);
    if (error) {
      alert("Erreur lors de la suppression du repas.");
      return;
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    await supabase.from("ai_generations")
      .delete()
      .eq("user_id", user.id)
      .eq("type", "nutrition_analysis")
      .gte("created_at", todayStart.toISOString());

    if (failed.length > 0) {
      alert(`✅ Repas supprimé.\n📦 ${restoredCount} ingrédient(s) remis dans le stock.\n\n⚠️ Non restaurés :\n- ${failed.join("\n- ")}`);
    } else if (restoredCount > 0) {
      alert(`✅ Repas supprimé.\n📦 ${restoredCount} ingrédient(s) remis dans le stock.`);
    }

    fetchData();
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await logMeal({ name: manualMeal.name, calories: parseInt(manualMeal.cals) || 0, protein: parseInt(manualMeal.prot) || 0, carbs: parseInt(manualMeal.carbs) || 0, fat: parseInt(manualMeal.fat) || 0 }, manualMeal.type);
  };

  const optimizeDish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dishInput.trim() || dishInput.trim().length < 2) return;

    setOptimizing(true);
    setOptimizeError(null);
    setOptimizedOptions([]);
    setOptimizedDishName(null);

    try {
      const aiAllowed = await isAIEnabled();
      if (!aiAllowed) {
        setOptimizeError("L'IA est désactivée dans vos paramètres.");
        setOptimizing(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      let userContext: string | undefined;
      if (user) {
        const today = new Date().toISOString().split("T")[0];
        const { data: metric } = await supabase.from("daily_metrics").select("recovery_score, sleep_hours").eq("user_id", user.id).eq("date", today).maybeSingle();
        if (metric) {
          userContext = `Récupération ${metric.recovery_score}%, sommeil ${metric.sleep_hours}h, objectif ${weightGoal === "lose" ? "perte" : weightGoal === "gain" ? "prise" : "maintien"}`;
        }
      }

      const res = await fetch("/api/optimize-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dishName: dishInput.trim(), userContext }),
      });

      const data = await res.json();

      if (!res.ok) {
        setOptimizeError(data.error || "Impossible d'optimiser ce plat.");
        setOptimizing(false);
        return;
      }

      setOptimizedDishName(data.originalDish);
      setOptimizedOptions(data.options);

      if (data.correctionNote && data.originalDish) {
        setDishInput(data.originalDish);
      }
    } catch (err) {
      console.error(err);
      setOptimizeError("Erreur réseau. Réessaie.");
    } finally {
      setOptimizing(false);
    }
  };

  const logOptimizedMeal = async (meal: OptimizedMeal, type: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    const currentDate = new Date().toISOString().split("T")[0];

    if (user) {
      const enrichedIngredients = await deductPantryStock(meal.ingredients || []);

      const payload: any = {
        user_id: user.id,
        date: currentDate,
        meal_type: type,
        name: meal.name,
        calories: meal.calories,
        protein: meal.protein,
        carbs: meal.carbs,
        fat: meal.fat,
      };

      if (enrichedIngredients.length > 0) {
        payload.ingredients = enrichedIngredients;
      }

      let { error } = await supabase.from("meal_logs").insert(payload);

      if (error && (error.code === 'PGRST204' || error.message.includes("ingredients"))) {
        console.warn("La colonne 'ingredients' n'existe pas dans meal_logs.");
        alert("⚠️ Attention : La colonne 'ingredients' n'existe pas dans Supabase. Le repas est bien enregistré, mais le stock ne pourra pas être restauré si tu supprimes ce repas.\n\nPour corriger cela, exécute cette commande dans l'éditeur SQL de Supabase :\nALTER TABLE meal_logs ADD COLUMN ingredients jsonb;");
        
        delete payload.ingredients;
        const { error: fallbackError } = await supabase.from("meal_logs").insert(payload);
        if (fallbackError) {
          console.error(fallbackError);
          alert("Erreur lors de l'enregistrement du repas.");
          return;
        }
      } else if (error) {
        console.error(error);
        alert("Erreur lors de l'enregistrement du repas.");
        return;
      }

      setShowManualAdd(false);
      setDishInput("");
      setOptimizedOptions([]);
      setOptimizedDishName(null);
      fetchData();
    }
  };

  const openSubstitution = (target: SubstitutionTarget) => {
    setSubstitutionTarget(target);
    setSubstitutionPreference("");
    setSubstituteOptions([]);
    setSubstituteError(null);
  };

  const closeSubstitution = () => {
    setSubstitutionTarget(null);
    setSubstitutionPreference("");
    setSubstituteOptions([]);
    setSubstituteError(null);
    setSubstituting(false);
  };

  const requestSubstitutes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!substitutionTarget) return;

    setSubstituting(true);
    setSubstituteError(null);
    setSubstituteOptions([]);

    try {
      const aiAllowed = await isAIEnabled();
      if (!aiAllowed) {
        setSubstituteError("L'IA est désactivée dans vos paramètres.");
        setSubstituting(false);
        return;
      }

      const meal = substitutionTarget.source === "ai"
        ? aiOptions[substitutionTarget.mealIndex]
        : optimizedOptions[substitutionTarget.mealIndex];

      if (!meal) {
        setSubstituteError("Repas introuvable.");
        setSubstituting(false);
        return;
      }

      const res = await fetch("/api/substitute-ingredient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meal: {
            name: meal.name,
            ingredients: meal.ingredients,
            calories: meal.calories,
            protein: meal.protein,
            carbs: meal.carbs,
            fat: meal.fat,
          },
          ingredient: substitutionTarget.ingredient,
          pantry,
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
    } catch (err) {
      console.error(err);
      setSubstituteError("Erreur réseau. Réessaie.");
    } finally {
      setSubstituting(false);
    }
  };

  const applySubstitution = (option: SubstituteOption) => {
    if (!substitutionTarget) return;

    const { source, mealIndex, ingredientIndex } = substitutionTarget;

    const updateMeal = (meal: any) => {
      const newIngredients = [...meal.ingredients];
      newIngredients[ingredientIndex] = {
        name: option.name,
        amount: option.amount,
        unit: option.unit,
      };
      return {
        ...meal,
        ingredients: newIngredients,
        calories: option.newTotals?.calories ?? meal.calories,
        protein: option.newTotals?.protein ?? meal.protein,
        carbs: option.newTotals?.carbs ?? meal.carbs,
        fat: option.newTotals?.fat ?? meal.fat,
      };
    };

    if (source === "ai") {
      setAiOptions(prev => prev.map((m, i) => i === mealIndex ? updateMeal(m) : m));
    } else {
      setOptimizedOptions(prev => prev.map((m, i) => i === mealIndex ? updateMeal(m) : m));
    }

    closeSubstitution();
  };

  const totalCals = meals.reduce((acc, curr) => acc + (curr.calories || 0), 0);
  const totalProtein = meals.reduce((acc, curr) => acc + (curr.protein || 0), 0);
  const totalCarbs = meals.reduce((acc, curr) => acc + (curr.carbs || 0), 0);
  const totalFat = meals.reduce((acc, curr) => acc + (curr.fat || 0), 0);
  const remainingCals = targetCals - totalCals;
  const macroData = [{ name: "Protéines", value: totalProtein * 4, color: "#00E676" }, { name: "Glucides", value: totalCarbs * 4, color: "#0093E7" }, { name: "Lipides", value: totalFat * 9, color: "#FFD60A" }].filter(d => d.value > 0);

  let goalProgress = 0;
  if (weight && targetWeight) {
    if (weightGoal === "lose") goalProgress = (targetWeight / weight) * 100;
    else if (weightGoal === "gain") goalProgress = (weight / targetWeight) * 100;
    else goalProgress = 100;
  }

  if (loading || !now) return <div className="p-8 text-white min-h-screen bg-[#020202]">Chargement...</div>;

  const currentAnalysis = analysisHistories[selectedAnalysisIndex];

  const renderIngredientList = (meal: any, mealIndex: number, source: "ai" | "optimized") => (
    <ul className="text-[10px] md:text-xs text-strain space-y-1">
      {meal.ingredients.map((ing: Ingredient, j: number) => (
        <li key={j} className="flex justify-between items-center gap-2 group/ing bg-surface/30 px-2 py-1 rounded">
          <span className="truncate">• {formatIngredient(ing.amount, ing.unit, ing.name)}</span>
          <button
            type="button"
            onClick={() => openSubstitution({
              source,
              mealIndex,
              ingredientIndex: j,
              mealName: meal.name,
              ingredient: ing,
            })}
            className="shrink-0 text-text-muted hover:text-strain p-1 bg-background rounded-md border border-border hover:border-strain transition-all"
            title="Remplacer cet ingrédient"
          >
            <ArrowRightLeft size={11} />
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto bg-[#020202] min-h-screen space-y-4 md:space-y-6">
      <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-4 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white mb-1 flex items-center gap-2">Nutrition <span className="text-[10px] md:text-xs bg-recovery/20 text-recovery px-2 py-1 rounded-md uppercase tracking-wider font-semibold">IA Coach</span></h1>
          <p className="text-xs md:text-sm text-text-muted">Suivi métabolique et génération adaptative.</p>
        </div>
        <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
          <button onClick={generateAnalysis} disabled={loadingAnalysis || meals.length === 0} className="w-full md:w-auto justify-center flex items-center gap-2 bg-purple-500/10 border border-purple-500/30 text-purple-400 font-semibold rounded-xl px-4 py-2.5 hover:bg-purple-500/20 transition-all text-xs md:text-sm disabled:opacity-50"><BrainCircuit size={16} className="md:w-[18px] md:h-[18px]" /> {loadingAnalysis ? "Analyse..." : analysisHistories.length > 0 ? "Regénérer" : "Bilan du jour"}</button>
          <button onClick={() => openManualModal("manual")} className="w-full md:w-auto justify-center flex items-center gap-2 bg-surface border border-border text-white px-4 py-2.5 rounded-xl hover:bg-surface-hover transition-colors text-xs md:text-sm"><PlusCircle size={16} className="md:w-[18px] md:h-[18px]" /> Repas manuel</button>
        </div>
      </header>

      <AnimatePresence>
        {isDataStale && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="bg-warning/10 border border-warning/30 rounded-2xl p-3 md:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3"><AlertTriangle className="text-warning" size={18} /><div><p className="text-xs md:text-sm font-semibold text-warning">Données corporelles à mettre à jour</p><p className="text-[10px] md:text-xs text-warning/80">{weight ? `Dernier poids > 7 jours.` : "Aucun poids enregistré."}</p></div></div>
            <Link href="/health" className="w-full md:w-auto justify-center flex items-center gap-2 bg-warning text-black text-[10px] md:text-xs font-bold px-4 py-2 rounded-lg hover:bg-warning/90 transition-colors"><RefreshCw size={12} className="md:w-3.5 md:h-3.5" /> Mettre à jour</Link>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
        <div className="lg:col-span-8 space-y-4 md:space-y-6">
          <AnimatePresence>
            {(currentAnalysis || loadingAnalysis) && (
              <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="bg-purple-500/5 border border-purple-500/20 rounded-3xl p-4 md:p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 blur-3xl pointer-events-none rounded-full" />

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-3 relative z-10">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0"><BrainCircuit className="text-purple-500" size={16} /></div>
                    <h3 className="text-[10px] md:text-xs font-semibold tracking-widest text-purple-400 uppercase">Bilan Nutritionnel</h3>
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
                  {loadingAnalysis ? (
                    <p className="text-xs md:text-sm text-text-main animate-pulse">Analyse de vos repas en cours...</p>
                  ) : (
                    <div className="text-xs md:text-sm text-text-main leading-relaxed">
                      <ReactMarkdown components={{ strong: ({node, ...props}) => <span className="font-bold text-white" {...props} />, li: ({node, ...props}) => <li className="ml-4 list-disc marker:text-strain mb-1" {...props} />, p: ({node, ...props}) => <p className="mb-2" {...props} /> }}>{currentAnalysis?.analysis || ""}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="bg-surface border border-border rounded-3xl p-4 md:p-6 relative overflow-hidden">
            {targetWeight ? (
              <>
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-2 md:gap-0">
                  <div className="flex items-center gap-2"><Target size={16} className={weightGoal === 'lose' ? 'text-strain' : weightGoal === 'gain' ? 'text-strain' : 'text-recovery'} /><h3 className="text-xs md:text-sm font-semibold text-white uppercase tracking-widest">Objectif : {weightGoal === 'lose' ? 'Perte de poids' : weightGoal === 'gain' ? 'Prise de masse' : 'Maintien'}</h3></div>
                  {weight && <div className="text-[10px] md:text-xs font-mono text-text-muted">{weight} kg → <span className="text-white font-bold">{targetWeight} kg</span></div>}
                </div>
                {weight && <div className="w-full h-1.5 md:h-2 bg-background rounded-full overflow-hidden mb-4 md:mb-2"><div className={`h-full rounded-full ${weightGoal === 'lose' || weightGoal === 'gain' ? 'bg-strain' : 'bg-recovery'}`} style={{ width: `${Math.min(100, Math.max(0, goalProgress))}%` }} /></div>}
                <div className="mt-2 md:mt-4 pt-3 md:pt-4 border-t border-border/50 grid grid-cols-3 gap-1.5 md:gap-2">
                  <div className="bg-background rounded-xl p-2 md:p-3 text-center"><p className="text-[8px] md:text-[10px] text-text-muted uppercase tracking-widest mb-1 flex items-center justify-center gap-1"><Calculator size={10}/> Métab. Basal</p><p className="text-xs md:text-sm font-bold text-white">{bmr} <span className="text-[8px] md:text-[10px] text-text-muted font-normal">kcal</span></p></div>
                  <div className="bg-background rounded-xl p-2 md:p-3 text-center"><p className="text-[8px] md:text-[10px] text-text-muted uppercase tracking-widest mb-1 flex items-center justify-center gap-1"><TrendingUp size={10}/> TDEE</p><p className="text-xs md:text-sm font-bold text-white">{tdee} <span className="text-[8px] md:text-[10px] text-text-muted font-normal">kcal</span></p></div>
                  <div className="bg-background rounded-xl p-2 md:p-3 text-center border border-strain/20"><p className="text-[8px] md:text-[10px] text-strain uppercase tracking-widest mb-1 flex items-center justify-center gap-1"><Info size={10}/> Cible</p><p className="text-xs md:text-sm font-bold text-strain">{targetCals} <span className="text-[8px] md:text-[10px] text-strain/50 font-normal">kcal</span></p></div>
                </div>
                <p className="text-[8px] md:text-[10px] text-text-muted mt-2">Basé sur {weight || '--'} kg, {userHeight || '--'} cm, {userAge || '--'} ans.{weightGoal === 'lose' ? ' (Déficit de 500 kcal)' : weightGoal === 'gain' ? ' (Surplus de 500 kcal)' : ''}</p>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-4 md:py-6 text-center">
                <Target size={32} className="text-text-muted mb-3 opacity-50 md:w-10 md:h-10" />
                <p className="text-sm md:text-base font-semibold text-white mb-1">Aucun objectif de poids</p>
                <p className="text-[10px] md:text-xs text-text-muted mb-4 max-w-xs">Définissez un objectif pour qu'OMNIA calcule vos besoins caloriques exacts.</p>
                <Link href="/goals" className="flex items-center justify-center gap-2 bg-surface-hover border border-border text-white text-[10px] md:text-xs font-semibold px-4 md:px-5 py-2 md:py-2.5 rounded-lg hover:bg-border transition-colors">Définir un objectif <ArrowRight size={12} className="md:w-3.5 md:h-3.5" /></Link>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            <div className="md:col-span-2 bg-surface border border-border rounded-3xl p-4 md:p-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-strain/10 to-transparent pointer-events-none" />
              <div className="flex justify-between items-end mb-3 md:mb-4 relative z-10">
                <div><p className="text-[10px] md:text-xs font-semibold text-text-muted uppercase tracking-widest mb-1">Calories consommées</p><div className="flex items-baseline gap-1 md:gap-2"><span className="text-2xl md:text-4xl font-bold text-white">{totalCals}</span><span className="text-[10px] md:text-sm text-text-muted">/ {targetCals} kcal</span></div></div>
                <div className="text-right"><p className={`text-xs md:text-lg font-bold ${remainingCals >= 0 ? 'text-recovery' : 'text-alert'}`}>{remainingCals >= 0 ? `${remainingCals} restantes` : `${Math.abs(remainingCals)} de trop`}</p></div>
              </div>
              <div className="w-full h-2 md:h-3 bg-background rounded-full overflow-hidden relative z-10"><div className={`h-full rounded-full transition-all duration-1000 ${remainingCals >= 0 ? 'bg-strain' : 'bg-alert'}`} style={{ width: `${Math.min(100, (totalCals / targetCals) * 100)}%` }} /></div>
            </div>
            <div className="bg-surface border border-border rounded-3xl p-3 md:p-4 flex items-center justify-center relative overflow-hidden">
              {macroData.length > 0 ? (
                <div className="w-full h-20 md:h-24">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart><Pie data={macroData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={15} outerRadius={30} paddingAngle={2}>{macroData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}</Pie><Tooltip contentStyle={{ backgroundColor: '#111111', borderColor: '#222222', borderRadius: '8px', color: '#FFF', fontSize: '10px' }} formatter={(value: number) => `${Math.round(value)} kcal`} /></PieChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="text-[10px] md:text-xs text-text-muted">Aucun macro</p>}
              <div className="absolute bottom-1.5 md:bottom-2 flex gap-2 text-[8px] md:text-[9px]"><span className="text-recovery flex items-center gap-1"><div className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-recovery"/>Prot</span><span className="text-strain flex items-center gap-1"><div className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-strain"/>Gluc</span><span className="text-warning flex items-center gap-1"><div className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-warning"/>Lip</span></div>
            </div>
          </div>

          {["breakfast", "lunch", "dinner"].map((type) => {
            const mealLabels: Record<string, string> = { breakfast: "Petit-déjeuner", lunch: "Déjeuner", dinner: "Dîner" };
            const loggedMeal = meals.find(m => m.meal_type === type);
            return (
              <div key={type} className="bg-surface border border-border rounded-3xl p-4 md:p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-3 md:mb-4 gap-2 md:gap-0">
                  <h3 className="text-sm md:text-lg font-semibold text-white capitalize">{mealLabels[type]}</h3>
                  {!loggedMeal && <button onClick={() => startWizard(type)} className="w-full md:w-auto flex items-center justify-center gap-2 text-[10px] md:text-xs bg-strain text-white font-semibold px-3 md:px-4 py-2 rounded-lg hover:bg-strain/80 transition-colors"><Sparkles size={12} className="md:w-3.5 md:h-3.5" /> Générer avec l'IA</button>}
                </div>
                {loggedMeal ? (
                  <div className="bg-background border border-border rounded-2xl p-3 md:p-4 flex justify-between items-center group">
                    <div><p className="text-xs md:text-sm font-semibold text-white">{loggedMeal.name}</p><p className="text-[10px] md:text-xs text-text-muted mt-1">{loggedMeal.calories} kcal • {loggedMeal.protein}g P • {loggedMeal.carbs}g G • {loggedMeal.fat}g L</p></div>
                    <div className="flex items-center gap-2 md:gap-3">
                      <Check size={16} className="text-recovery md:w-5 md:h-5" />
                      <button 
                        onClick={() => deleteMeal(loggedMeal)} 
                        className="text-text-muted hover:text-alert transition-colors p-1.5 rounded-lg hover:bg-alert/10"
                        title="Supprimer ce repas (et restaurer le stock)"
                      >
                        <Trash2 size={16} className="md:w-5 md:h-5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-background border border-border border-dashed rounded-2xl p-4 md:p-6 text-center"><Utensils size={20} className="mx-auto text-text-muted mb-2 opacity-50 md:w-6 md:h-6" /><p className="text-[10px] md:text-xs text-text-muted">Aucun repas enregistré.</p></div>
                )}
              </div>
            );
          })}
        </div>

        <div className="lg:col-span-4 space-y-4 md:space-y-6">
          <div className="bg-surface border border-border rounded-3xl p-4 md:p-6">
            <h3 className="text-xs md:text-sm font-semibold text-white uppercase tracking-widest mb-3 md:mb-4 flex items-center gap-2"><Carrot size={16} className="text-warning md:w-[18px] md:h-[18px]" /> Mon Stock</h3>
            <form onSubmit={addFood} className="space-y-2 mb-4 md:mb-6">
              <input type="text" value={newFood} onChange={e => setNewFood(e.target.value)} placeholder="Ingrédient" className="w-full bg-background border border-border rounded-xl px-3 md:px-4 py-2 text-xs md:text-sm text-white focus:outline-none focus:border-warning" />
              <div className="flex gap-2">
                <input type="number" step="0.1" value={newQty} onChange={e => setNewQty(e.target.value)} placeholder="Qté" className="flex-1 bg-background border border-border rounded-xl px-3 md:px-4 py-2 text-xs md:text-sm text-white focus:outline-none focus:border-warning" />
                <select value={newUnit} onChange={e => setNewUnit(e.target.value)} className="bg-background border border-border rounded-xl px-2 md:px-3 text-xs md:text-sm text-white focus:outline-none">
                  <option value="g">g</option>
                  <option value="kg">kg</option>
                  <option value="ml">ml</option>
                  <option value="L">L</option>
                  <option value="unit">unité</option>
                </select>
                <button type="submit" className="bg-white text-black px-3 md:px-4 rounded-xl hover:bg-gray-200 transition-colors"><Plus size={16} className="md:w-[18px] md:h-[18px]" /></button>
              </div>
            </form>
            <div className="space-y-2">
              {pantry.length === 0 ? <p className="text-[10px] md:text-xs text-text-muted italic">Stock vide.</p> : (
                pantry.map(item => (
                  <div key={item.id} className="bg-surface-hover border border-border rounded-lg p-2">
                    {editingFoodId === item.id ? (
                      <form onSubmit={saveEditedFood} className="flex flex-col gap-2 w-full">
                        <input type="text" value={editFoodName} onChange={e => setEditFoodName(e.target.value)} className="w-full bg-background border border-border rounded-md px-2 py-1 text-xs text-white" required />
                        <div className="flex gap-2 items-center">
                          <input type="number" step="0.1" value={editFoodQty} onChange={e => setEditFoodQty(e.target.value)} className="w-20 bg-background border border-border rounded-md px-2 py-1 text-xs text-white" required />
                          <select value={editFoodUnit} onChange={e => setEditFoodUnit(e.target.value)} className="bg-background border border-border rounded-md px-2 py-1 text-xs text-white">
                            <option value="g">g</option>
                            <option value="kg">kg</option>
                            <option value="ml">ml</option>
                            <option value="L">L</option>
                            <option value="unit">unité</option>
                          </select>
                          <button type="submit" className="text-recovery hover:bg-recovery/10 p-1 rounded"><Check size={14} /></button>
                          <button type="button" onClick={() => setEditingFoodId(null)} className="text-text-muted hover:text-white p-1 rounded"><X size={14} /></button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] md:text-sm text-white font-medium truncate pr-2">{item.name}</span>
                        <div className="flex items-center gap-1 md:gap-2 shrink-0">
                          <span className="text-[9px] md:text-xs font-mono text-strain bg-strain/10 px-1.5 md:px-2 py-0.5 rounded">{formatStock(item.quantity, item.unit)}</span>
                          <button onClick={() => startEditingFood(item)} className="text-text-muted hover:text-warning transition-colors p-1 rounded"><Pencil size={12} className="md:w-3.5 md:h-3.5"/></button>
                          <button onClick={async () => { await supabase.from("food_items").delete().eq("id", item.id); fetchData(); }} className="text-text-muted hover:text-alert transition-colors p-1 rounded"><X size={12} className="md:w-3.5 md:h-3.5"/></button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===== MODAL WIZARD (Génération IA) ===== */}
      <AnimatePresence>
        {showWizard && (
          <div onClick={closeWizard} className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-black/80 backdrop-blur-sm">
            <motion.div onClick={(e) => e.stopPropagation()} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-surface border border-border rounded-3xl p-4 md:p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-center mb-4 md:mb-6"><div className="flex items-center gap-2"><Sparkles size={16} className="text-strain md:w-5 md:h-5" /><h2 className="text-sm md:text-xl font-bold text-white">Assistant OMNIA</h2></div><button onClick={closeWizard} className="text-text-muted hover:text-white bg-background p-1.5 md:p-2 rounded-lg"><X size={16} className="md:w-5 md:h-5" /></button></div>
              {wizardStep === 1 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                  <p className="text-xs md:text-sm text-text-muted mb-3 md:mb-4">1. Ce repas est-il prévu avant ou après un entraînement ?</p>
                  <div className="space-y-2"><button onClick={() => handleContextSelect("avant")} className="w-full text-left p-3 md:p-4 bg-background border border-border rounded-xl hover:border-strain text-xs md:text-sm text-white font-medium transition-colors">Avant un entraînement</button><button onClick={() => handleContextSelect("apres")} className="w-full text-left p-3 md:p-4 bg-background border border-border rounded-xl hover:border-strain text-xs md:text-sm text-white font-medium transition-colors">Après un entraînement</button><button onClick={() => handleContextSelect("repos")} className="w-full text-left p-3 md:p-4 bg-background border border-border rounded-xl hover:border-strain text-xs md:text-sm text-white font-medium transition-colors">Journée de repos / Normal</button></div>
                </motion.div>
              )}
              {wizardStep === 1.5 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                  <div className="flex items-center gap-2 mb-3 md:mb-4"><button onClick={() => setWizardStep(1)} className="text-text-muted hover:text-white"><ArrowLeft size={14} className="md:w-4 md:h-4"/></button><p className="text-xs md:text-sm text-text-muted">1.5. Quel type de séance ?</p></div>
                  <div className="space-y-2"><button onClick={() => handleSportSelect("musculation")} className="w-full text-left p-3 md:p-4 bg-background border border-border rounded-xl hover:border-strain text-xs md:text-sm text-white font-medium transition-colors">Musculation / Force</button><button onClick={() => handleSportSelect("football")} className="w-full text-left p-3 md:p-4 bg-background border border-border rounded-xl hover:border-strain text-xs md:text-sm text-white font-medium transition-colors">Football / Sprint</button><button onClick={() => handleSportSelect("cardio")} className="w-full text-left p-3 md:p-4 bg-background border border-border rounded-xl hover:border-strain text-xs md:text-sm text-white font-medium transition-colors">Cardio / Endurance</button></div>
                </motion.div>
              )}
              {wizardStep === 2 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 md:space-y-6">
                  <div className="flex items-center gap-2"><button onClick={() => setWizardStep(context === "repos" ? 1 : 1.5)} className="text-text-muted hover:text-white"><ArrowLeft size={14} className="md:w-4 md:h-4"/></button><p className="text-xs md:text-sm text-text-muted">2. Tes préférences culinaires</p></div>
                  <div><label className="block text-[10px] md:text-xs font-semibold text-text-muted tracking-widest uppercase mb-2 md:mb-3 flex items-center gap-2"><Clock size={12} className="md:w-3.5 md:h-3.5"/> Temps de préparation</label><div className="grid grid-cols-3 gap-1.5 md:gap-2"><button onClick={() => setPrepTime("rapide")} className={`p-2 md:p-3 rounded-xl border text-[10px] md:text-sm font-medium transition-colors ${prepTime === "rapide" ? "bg-strain/20 border-strain text-strain" : "bg-background border-border text-white hover:border-strain"}`}>Rapide (&lt;15m)</button><button onClick={() => setPrepTime("normal")} className={`p-2 md:p-3 rounded-xl border text-[10px] md:text-sm font-medium transition-colors ${prepTime === "normal" ? "bg-strain/20 border-strain text-strain" : "bg-background border-border text-white hover:border-strain"}`}>Normal (30m)</button><button onClick={() => setPrepTime("long")} className={`p-2 md:p-3 rounded-xl border text-[10px] md:text-sm font-medium transition-colors ${prepTime === "long" ? "bg-strain/20 border-strain text-strain" : "bg-background border-border text-white hover:border-strain"}`}>Long (+45m)</button></div></div>
                  <div><label className="block text-[10px] md:text-xs font-semibold text-text-muted tracking-widest uppercase mb-2 md:mb-3 flex items-center gap-2"><Pizza size={12} className="md:w-3.5 md:h-3.5"/> Envie dominante</label><div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 md:gap-2"><button onClick={() => setCraving("sale")} className={`p-2 md:p-3 rounded-xl border text-[10px] md:text-sm font-medium transition-colors ${craving === "sale" ? "bg-warning/20 border-warning text-warning" : "bg-background border-border text-white hover:border-warning"}`}>Salé</button><button onClick={() => setCraving("sucre")} className={`p-2 md:p-3 rounded-xl border text-[10px] md:text-sm font-medium transition-colors ${craving === "sucre" ? "bg-warning/20 border-warning text-warning" : "bg-background border-border text-white hover:border-warning"}`}>Sucré</button><button onClick={() => setCraving("leger")} className={`p-2 md:p-3 rounded-xl border text-[10px] md:text-sm font-medium transition-colors ${craving === "leger" ? "bg-warning/20 border-warning text-warning" : "bg-background border-border text-white hover:border-warning"}`}>Léger</button><button onClick={() => setCraving("reconfortant")} className={`p-2 md:p-3 rounded-xl border text-[10px] md:text-sm font-medium transition-colors ${craving === "reconfortant" ? "bg-warning/20 border-warning text-warning" : "bg-background border-border text-white hover:border-warning"}`}>Réconfort</button></div></div>
                  <div><label className="block text-[10px] md:text-xs font-semibold text-text-muted tracking-widest uppercase mb-2 md:mb-3 flex items-center gap-2"><UtensilsCrossed size={12} className="md:w-3.5 md:h-3.5"/> Instructions spéciales</label><input type="text" value={customNote} onChange={e => setCustomNote(e.target.value)} placeholder="Ex: Pas de four, utilise le poulet..." className="w-full bg-background border border-border rounded-xl px-3 md:px-4 py-2.5 md:py-3 text-xs md:text-sm text-white focus:outline-none focus:border-strain" /></div>
                  <button onClick={handlePreferencesSubmit} className="w-full bg-white text-black font-bold rounded-xl py-2.5 md:py-3 text-xs md:text-sm hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 mt-2 md:mt-4"><Sparkles size={14} className="md:w-4 md:h-4" /> Générer les recettes</button>
                </motion.div>
              )}
              {wizardStep === 3 && (
                <div>
                  {generating ? (
                    <div className="py-8 md:py-12 text-center"><Sparkles size={32} className="mx-auto text-strain animate-bounce mb-3 md:mb-4 md:w-10 md:h-10" /><p className="text-xs md:text-sm text-white font-medium">Création de recettes adaptées...</p><p className="text-[10px] md:text-xs text-text-muted mt-2">Prise en compte de tes envies et de ton stock.</p></div>
                  ) : (
                    <div className="space-y-3 md:space-y-4">
                      {aiOptions.map((opt, i) => (
                        <div key={i} className="bg-background border border-border rounded-2xl p-3 md:p-5 hover:border-strain/50 transition-colors">
                          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-2 gap-2 md:gap-0"><h3 className="font-bold text-white text-sm md:text-lg">{opt.name}</h3><button onClick={() => logMeal(opt, mealType)} className="w-full md:w-auto bg-white text-black text-[10px] md:text-xs font-semibold px-3 md:px-4 py-1.5 md:py-2 rounded-lg hover:bg-gray-200">Choisir</button></div>
                          <p className="text-[10px] md:text-xs text-text-muted mb-2 md:mb-3">{opt.description}</p>
                          <div className="bg-surface/50 rounded-lg p-2 md:p-3 mb-3 md:mb-4"><p className="text-[9px] md:text-[10px] text-text-muted uppercase tracking-widest mb-1 flex items-center gap-1"><Scale size={10} className="md:w-3 md:h-3"/> Ingrédients</p>{renderIngredientList(opt, i, "ai")}</div>
                          <div className="flex flex-wrap gap-2 md:gap-4 border-t border-border/50 pt-2 md:pt-3"><span className="text-[9px] md:text-[10px] text-text-muted flex items-center gap-1"><Flame size={10} className="text-warning md:w-3 md:h-3"/> {opt.calories} kcal</span><span className="text-[9px] md:text-[10px] text-text-muted flex items-center gap-1"><Beef size={10} className="text-recovery md:w-3 md:h-3"/> {opt.protein}g Prot</span><span className="text-[9px] md:text-[10px] text-text-muted flex items-center gap-1"><Wheat size={10} className="text-strain md:w-3 md:h-3"/> {opt.carbs}g Gluc</span></div>
                        </div>
                      ))}
                      <button onClick={() => setWizardStep(2)} className="w-full py-2 text-[10px] md:text-xs font-semibold text-text-muted hover:text-white transition-colors">Modifier mes préférences</button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ===== MODAL MANUEL / OPTIMISER ===== */}
      <AnimatePresence>
        {showManualAdd && (
          <div onClick={() => setShowManualAdd(false)} className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface border border-border rounded-3xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-4 md:p-6 pb-0">
                <div className="flex justify-between items-center mb-3 md:mb-4">
                  <h2 className="text-sm md:text-xl font-bold text-white">Ajouter un repas</h2>
                  <button onClick={() => setShowManualAdd(false)} className="text-text-muted hover:text-white bg-background p-1.5 md:p-2 rounded-lg">
                    <X size={16} className="md:w-5 md:h-5" />
                  </button>
                </div>
                <div className="flex gap-1 bg-background rounded-xl p-1 mb-4">
                  <button
                    onClick={() => setModalTab("manual")}
                    className={`flex-1 py-2 text-[10px] md:text-xs font-semibold rounded-lg transition-colors ${modalTab === "manual" ? "bg-surface-hover text-white" : "text-text-muted hover:text-white"}`}
                  >
                    Saisie manuelle
                  </button>
                  <button
                    onClick={() => setModalTab("optimize")}
                    className={`flex-1 py-2 text-[10px] md:text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${modalTab === "optimize" ? "bg-strain/20 text-strain" : "text-text-muted hover:text-white"}`}
                  >
                    <Sparkles size={12} /> Optimiser un plat
                  </button>
                </div>
              </div>

              <div className="px-4 md:px-6 pb-4 md:pb-6 overflow-y-auto custom-scrollbar flex-1">
                {modalTab === "manual" && (
                  <form onSubmit={handleManualAdd} className="space-y-3 md:space-y-4">
                    <select value={manualMeal.type} onChange={(e) => setManualMeal({ ...manualMeal, type: e.target.value })} className="w-full bg-background border border-border rounded-xl px-3 md:px-4 py-2.5 md:py-3 text-xs md:text-sm text-white focus:outline-none focus:border-strain">
                      <option value="breakfast">Petit-déjeuner</option>
                      <option value="lunch">Déjeuner</option>
                      <option value="dinner">Dîner</option>
                      <option value="snack">Collation</option>
                    </select>
                    <input type="text" placeholder="Nom du plat" required value={manualMeal.name} onChange={(e) => setManualMeal({ ...manualMeal, name: e.target.value })} className="w-full bg-background border border-border rounded-xl px-3 md:px-4 py-2.5 md:py-3 text-xs md:text-sm text-white focus:outline-none focus:border-strain" />
                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" placeholder="Calories" required value={manualMeal.cals} onChange={(e) => setManualMeal({ ...manualMeal, cals: e.target.value })} className="w-full bg-background border border-border rounded-xl px-3 md:px-4 py-2.5 md:py-3 text-xs md:text-sm text-white focus:outline-none focus:border-strain" />
                      <input type="number" placeholder="Protéines (g)" value={manualMeal.prot} onChange={(e) => setManualMeal({ ...manualMeal, prot: e.target.value })} className="w-full bg-background border border-border rounded-xl px-3 md:px-4 py-2.5 md:py-3 text-xs md:text-sm text-white focus:outline-none focus:border-strain" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" placeholder="Glucides (g)" value={manualMeal.carbs} onChange={(e) => setManualMeal({ ...manualMeal, carbs: e.target.value })} className="w-full bg-background border border-border rounded-xl px-3 md:px-4 py-2.5 md:py-3 text-xs md:text-sm text-white focus:outline-none focus:border-strain" />
                      <input type="number" placeholder="Lipides (g)" value={manualMeal.fat} onChange={(e) => setManualMeal({ ...manualMeal, fat: e.target.value })} className="w-full bg-background border border-border rounded-xl px-3 md:px-4 py-2.5 md:py-3 text-xs md:text-sm text-white focus:outline-none focus:border-strain" />
                    </div>
                    <button type="submit" className="w-full bg-white text-black font-bold rounded-xl py-2.5 md:py-3 text-xs md:text-sm hover:bg-gray-200 transition-colors mt-2">Enregistrer le repas</button>
                  </form>
                )}

                {modalTab === "optimize" && (
                  <div className="space-y-4">
                    <form onSubmit={optimizeDish} className="space-y-2">
                      <label className="block text-[10px] md:text-xs font-semibold text-text-muted tracking-widest uppercase flex items-center gap-2">
                        <BrainCircuit size={12} className="text-strain" /> Quel plat veux-tu optimiser ?
                      </label>
                      <div className="flex gap-2">
                        <input type="text" placeholder="Ex: tiramisu, burger, pizza..." value={dishInput} onChange={(e) => setDishInput(e.target.value)} className="flex-1 bg-background border border-border rounded-xl px-3 md:px-4 py-2.5 md:py-3 text-xs md:text-sm text-white focus:outline-none focus:border-strain" />
                        <button type="submit" disabled={optimizing || dishInput.trim().length < 2} className="bg-strain text-white font-semibold px-4 rounded-xl hover:bg-strain/80 transition-colors disabled:opacity-50 flex items-center gap-1.5 text-xs">
                          {optimizing ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                          {optimizing ? "..." : "Optimiser"}
                        </button>
                      </div>
                      <p className="text-[9px] md:text-[10px] text-text-muted">Peu importe les fautes de frappe, OMNIA reconnaîtra le plat.</p>
                    </form>

                    {optimizeError && (
                      <div className="bg-alert/10 border border-alert/30 rounded-xl p-3 flex items-start gap-2">
                        <AlertTriangle size={14} className="text-alert mt-0.5 shrink-0" />
                        <p className="text-[10px] md:text-xs text-alert">{optimizeError}</p>
                      </div>
                    )}

                    {optimizing && (
                      <div className="py-6 text-center">
                        <Sparkles size={28} className="mx-auto text-strain animate-bounce mb-2" />
                        <p className="text-xs text-white font-medium">OMNIA optimise ton plat...</p>
                        <p className="text-[10px] text-text-muted mt-1">Recherche des meilleures alternatives nutritionnelles.</p>
                      </div>
                    )}

                    {!optimizing && optimizedOptions.length > 0 && (
                      <div className="space-y-3">
                        {optimizedDishName && (
                          <div className="flex items-center gap-2 text-[10px] md:text-xs text-text-muted">
                            <Check size={12} className="text-recovery" />
                            Plat reconnu : <span className="text-white font-semibold">{optimizedDishName}</span>
                          </div>
                        )}

                        {optimizedOptions.map((opt, i) => {
                          const variantStyles = {
                            classique: { border: "border-border", badge: "bg-surface-hover text-text-muted", label: "Classique" },
                            allegee: { border: "border-recovery/40", badge: "bg-recovery/20 text-recovery", label: "Allégée" },
                            proteinee: { border: "border-purple-500/40", badge: "bg-purple-500/20 text-purple-400", label: "Protéinée" },
                          }[opt.variant] || { border: "border-border", badge: "bg-surface-hover text-text-muted", label: "Variante" };

                          return (
                            <div key={i} className={`bg-background border ${variantStyles.border} rounded-2xl p-3 md:p-4`}>
                              <div className="flex justify-between items-start gap-2 mb-2">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${variantStyles.badge}`}>{variantStyles.label}</span>
                                    <span className="text-[9px] text-text-muted">·</span>
                                    <span className="text-[9px] text-warning font-bold">{"★".repeat(Math.round(opt.healthScore / 2))}</span>
                                  </div>
                                  <h3 className="font-bold text-white text-xs md:text-sm">{opt.name}</h3>
                                </div>
                                <button onClick={() => logOptimizedMeal(opt, manualMeal.type)} className="shrink-0 bg-white text-black text-[10px] md:text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors">Choisir</button>
                              </div>

                              <p className="text-[10px] md:text-xs text-text-muted mb-2 leading-relaxed">{opt.description}</p>

                              <div className="bg-surface/50 rounded-lg p-2 md:p-3 mb-2 md:mb-3">
                                <p className="text-[9px] text-text-muted uppercase tracking-widest mb-1 flex items-center gap-1"><Scale size={10} /> Ingrédients (modifiables)</p>
                                {renderIngredientList(opt, i, "optimized")}
                              </div>

                              {opt.instructions && opt.instructions.length > 0 && (
                                <div className="bg-surface/50 rounded-lg p-2 md:p-3 mb-2 md:mb-3">
                                  <p className="text-[9px] text-text-muted uppercase tracking-widest mb-1 flex items-center gap-1"><ListOrdered size={10} /> Préparation</p>
                                  <ol className="text-[10px] md:text-xs text-text-main space-y-1 ml-4 list-decimal">
                                    {opt.instructions.map((step, j) => (
                                      <li key={j} className="pl-1">{step}</li>
                                    ))}
                                  </ol>
                                </div>
                              )}

                              <div className="flex flex-wrap gap-2 md:gap-3 border-t border-border/50 pt-2">
                                <span className="text-[9px] text-text-muted flex items-center gap-1"><Flame size={10} className="text-warning" /> {opt.calories} kcal</span>
                                <span className="text-[9px] text-text-muted flex items-center gap-1"><Beef size={10} className="text-recovery" /> {opt.protein}g P</span>
                                <span className="text-[9px] text-text-muted flex items-center gap-1"><Wheat size={10} className="text-strain" /> {opt.carbs}g G</span>
                                <span className="text-[9px] text-text-muted flex items-center gap-1"><Scale size={10} className="text-warning" /> {opt.fat}g L</span>
                              </div>
                            </div>
                          );
                        })}

                        <p className="text-[9px] text-text-muted italic text-center pt-1">Choisis une version pour l'ajouter au repas du jour.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ===== MODAL SUBSTITUTION D'INGRÉDIENT ===== */}
      <AnimatePresence>
        {substitutionTarget && (
          <div onClick={closeSubstitution} className="fixed inset-0 z-[60] flex items-center justify-center p-3 md:p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface border border-border rounded-3xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-4 md:p-6 pb-3">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    <ArrowRightLeft size={16} className="text-strain" />
                    <h2 className="text-sm md:text-lg font-bold text-white">Remplacer un ingrédient</h2>
                  </div>
                  <button onClick={closeSubstitution} className="text-text-muted hover:text-white bg-background p-1.5 rounded-lg">
                    <X size={16} />
                  </button>
                </div>
                <div className="bg-background border border-border rounded-xl p-3">
                  <p className="text-[10px] text-text-muted uppercase tracking-widest mb-1">À remplacer</p>
                  <p className="text-xs md:text-sm font-semibold text-white">
                    {formatIngredient(substitutionTarget.ingredient.amount, substitutionTarget.ingredient.unit, substitutionTarget.ingredient.name)}
                  </p>
                  <p className="text-[10px] text-text-muted mt-1">dans <span className="text-white">{substitutionTarget.mealName}</span></p>
                </div>
              </div>

              <div className="px-4 md:px-6 pb-4 md:pb-6 overflow-y-auto custom-scrollbar flex-1">
                <form onSubmit={requestSubstitutes} className="space-y-3">
                  <input
                    type="text"
                    placeholder="Tu veux remplacer par quoi ? (optionnel)"
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

                {substituting && (
                  <div className="py-6 text-center">
                    <Sparkles size={28} className="mx-auto text-strain animate-bounce mb-2" />
                    <p className="text-xs text-white font-medium">OMNIA cherche des alternatives...</p>
                  </div>
                )}

                {!substituting && substituteOptions.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {substituteOptions.map((opt, i) => {
                      const deltaColor = opt.caloriesDelta > 0 ? "text-alert" : opt.caloriesDelta < 0 ? "text-recovery" : "text-text-muted";
                      const deltaSign = opt.caloriesDelta > 0 ? "+" : "";
                      return (
                        <div key={i} className="bg-background border border-border rounded-2xl p-3">
                          <div className="flex justify-between items-start gap-2 mb-1">
                            <div className="flex-1">
                              <div className="flex items-center gap-1.5 mb-1">
                                <h3 className="font-bold text-white text-xs md:text-sm">{opt.name}</h3>
                                {opt.fromPantry && (
                                  <span className="text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-recovery/20 text-recovery flex items-center gap-0.5">
                                    <Package size={8} /> Stock
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-text-muted">{formatIngredient(opt.amount, opt.unit, "")}</p>
                            </div>
                            <button
                              onClick={() => applySubstitution(opt)}
                              className="shrink-0 bg-white text-black text-[10px] font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                            >
                              Choisir
                            </button>
                          </div>
                          <p className="text-[10px] text-text-muted mb-2 leading-relaxed">{opt.reason}</p>
                          <div className="flex flex-wrap gap-2 text-[9px] pt-2 border-t border-border/50">
                            <span className="text-text-muted flex items-center gap-1"><Flame size={9} className="text-warning" /> {opt.newTotals.calories} kcal</span>
                            <span className={`flex items-center gap-1 font-semibold ${deltaColor}`}>({deltaSign}{opt.caloriesDelta} kcal)</span>
                            <span className="text-text-muted flex items-center gap-1"><Beef size={9} className="text-recovery" /> {opt.newTotals.protein}g P</span>
                            <span className="text-text-muted flex items-center gap-1"><Wheat size={9} className="text-strain" /> {opt.newTotals.carbs}g G</span>
                          </div>
                        </div>
                      );
                    })}
                    <p className="text-[9px] text-text-muted italic text-center pt-1">
                      La substitution mettra à jour les macros du plat.
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