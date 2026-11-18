// src/lib/data-hub.ts
import { supabase } from "@/lib/supabase";

export type DeviceSource = {
  id: string;
  name: string;
  display_name: string;
  auth_status: 'connected' | 'disconnected' | 'error';
  last_sync_at?: string;
};

// Liste des appareils supportés
export const SUPPORTED_DEVICES = [
  { id: 'whoop', name: 'WHOOP', desc: 'Récupération, Sommeil, Strain', icon: 'Watch', color: 'text-recovery' },
  { id: 'apple_health', name: 'Apple Santé', desc: 'Pas, Sommeil, FC, Poids', icon: 'Heart', color: 'text-alert' },
  { id: 'garmin', name: 'Garmin Connect', desc: 'Course, Vélo, FC', icon: 'Navigation', color: 'text-strain' },
  { id: 'oura', name: 'Oura Ring', desc: 'Sommeil, Température', icon: 'Circle', color: 'text-purple-500' },
  { id: 'withings', name: 'Balance Withings', desc: 'Poids, Masse Grasse', icon: 'Scale', color: 'text-warning' },
  { id: 'health_connect', name: 'Health Connect', desc: 'Android (Google Fit)', icon: 'Smartphone', color: 'text-blue-500' },
];

export async function getUnifiedData(userId: string, date: string) {
  // 1. Récupérer toutes les métriques du jour
  const { data: metrics } = await supabase
    .from("daily_metrics")
    .select("*")
    .eq("user_id", userId)
    .eq("date", date)
    .order("created_at", { ascending: false }); // La plus récente en premier

  const { data: health } = await supabase
    .from("health_metrics")
    .select("*")
    .eq("user_id", userId)
    .eq("date", date)
    .order("created_at", { ascending: false });

  // 2. Appliquer la logique de priorité
  // On cherche d'abord une donnée "measured" (appareil), sinon on prend la plus récente (declared)
  const getBestMetric = (arr: any[] | null, key: string) => {
    if (!arr || arr.length === 0) return null;
    const measured = arr.find(m => m.confidence_level === 'measured');
    return measured ? measured[key] : arr[0][key];
  };

  return {
    weight: getBestMetric(health, 'weight'),
    sleep: getBestMetric(metrics, 'sleep_hours'),
    recovery: getBestMetric(metrics, 'recovery_score'),
  };
}