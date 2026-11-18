// src/app/privacy/page.tsx
"use client";

import Link from "next/link";
import { ArrowLeft, ShieldCheck, Lock, Database, BrainCircuit } from "lucide-react";
import { motion } from "framer-motion";

export default function PrivacyPage() {
  return (
    <div className="min-h-[100dvh] bg-[#020202] text-text-main p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <Link href="/signup" className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-white transition-colors mb-6">
          <ArrowLeft size={16} /> Retour à l'inscription
        </Link>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-recovery/10 flex items-center justify-center">
              <ShieldCheck className="text-recovery" size={24} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">Politique de Confidentialité</h1>
              {/* ✅ Date mise en dur pour éviter l'erreur Next.js */}
              <p className="text-xs text-text-muted mt-1">Dernière mise à jour : 17 Novembre 2026</p>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-3xl p-6 md:p-8 space-y-6 text-sm leading-relaxed text-text-muted">
            <div className="flex items-start gap-3 p-4 bg-recovery/5 border border-recovery/20 rounded-xl mb-6">
              <Lock className="text-recovery shrink-0 mt-0.5" size={18} />
              <p className="text-xs text-recovery font-medium">Vos données de santé sont extrêmement sensibles. Nous les traitons avec le plus haut niveau de sécurité et ne les partageons jamais à des fins commerciales.</p>
            </div>

            <section>
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2"><Database size={18} /> 1. Données collectées</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Données de compte :</strong> Nom, e-mail, mot de passe crypté, âge, taille, sexe.</li>
                <li><strong>Données de santé et de performance :</strong> Poids, fréquence cardiaque, sommeil, blessures, séances d'entraînement, données nutritionnelles.</li>
                <li><strong>Données de journal :</strong> Vos notes personnelles et ressentis.</li>
                <li><strong>Données d'utilisation :</strong> Interactions avec l'IA, préférences de l'application.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2"><BrainCircuit size={18} /> 2. Utilisation de l'Intelligence Artificielle</h2>
              <p>Pour générer vos bilans et plans d'action, certaines de vos données (dépourvues de votre nom et e-mail) sont analysées par des modèles d'IA (via des API sécurisées). <strong>Aucune de vos données brutes n'est utilisée pour entraîner les modèles d'IA publics.</strong></p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-3">3. Hébergement et Sécurité</h2>
              <p>Vos données sont stockées de manière sécurisée via notre prestataire Supabase, hébergé dans l'Union Européenne (UE). Les accès sont strictement contrôlés (RLS). Les mots de passe sont hachés et illisibles, même par nos équipes.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-3">4. Vos Droits (RGPD)</h2>
              <p>Conformément au Règlement Général sur la Protection des Données, vous disposez d'un droit d'accès, de rectification, de portabilité et de suppression de vos données.</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li><strong>Droit à l'export :</strong> Vous pouvez télécharger l'intégralité de vos données (format CSV) depuis les Paramètres.</li>
                <li><strong>Droit à l'oubli :</strong> Vous pouvez supprimer définitivement votre compte et toutes les données associées en un clic.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-3">5. Contact</h2>
              <p>Pour toute question relative à vos données personnelles, vous pouvez contacter notre Délégué à la Protection des Données (DPO) à l'adresse suivante : <a href="mailto:contact@actoos.com" className="text-strain hover:underline">contact@actoos.com</a>.</p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
}