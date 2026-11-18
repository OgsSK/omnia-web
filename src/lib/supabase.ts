// src/lib/supabase.ts
import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Les variables d'environnement Supabase sont manquantes. Vérifiez votre fichier .env.local");
}

// ✅ Utilisation de createBrowserClient pour Next.js
export const supabase = createBrowserClient(supabaseUrl, supabaseKey);