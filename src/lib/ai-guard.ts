// src/lib/ai-guard.ts
import { supabase } from "@/lib/supabase";

export async function isAIEnabled(): Promise<boolean> {
  // ✅ getSession est lu depuis le cache local (instantané)
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.user) return false;

  const { data } = await supabase
    .from("user_preferences")
    .select("ai_enabled")
    .eq("user_id", session.user.id)
    .maybeSingle();

  // Si la ligne n'existe pas, on considère que c'est activé par défaut
  if (!data) return true; 
  
  return data.ai_enabled;
}