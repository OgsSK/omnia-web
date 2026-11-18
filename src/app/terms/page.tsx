// src/app/terms/page.tsx
"use client";

import Link from "next/link";
import { ArrowLeft, Scale } from "lucide-react";
import { motion } from "framer-motion";

export default function TermsPage() {
  return (
    <div className="min-h-[100dvh] bg-[#020202] text-text-main p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <Link href="/signup" className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-white transition-colors mb-6">
          <ArrowLeft size={16} /> Retour à l'inscription
        </Link>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-strain/10 flex items-center justify-center">
              <Scale className="text-strain" size={24} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">Conditions Générales d'Utilisation</h1>
              {/* ✅ Date mise en dur pour éviter l'erreur Next.js */}
              <p className="text-xs text-text-muted mt-1">Dernière mise à jour : 17 Novembre 2026</p>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-3xl p-6 md:p-8 space-y-6 text-sm leading-relaxed text-text-muted">
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">1. Objet de l'application</h2>
              <p>OMNIA est une intelligence personnelle conçue pour vous aider à suivre vos données de santé, d'entraînement, de nutrition et de bien-être. L'application utilise l'intelligence artificielle pour analyser vos données et générer des recommandations personnalisées.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-3">2. Avertissement Médical</h2>
              <p className="text-alert font-medium">OMNIA n'est pas un dispositif médical et ne remplace en aucun cas l'avis d'un professionnel de santé (médecin, nutritionniste, kinésithérapeute).</p>
              <p className="mt-2">Les analyses et conseils générés par l'IA sont fournis à titre indicatif. En cas de douleur, de blessure ou de doute sur votre état de santé, consultez immédiatement un médecin.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-3">3. Compte Utilisateur</h2>
              <p>Vous êtes responsable de la confidentialité de vos identifiants. Vous vous engagez à fournir des informations exactes lors de l'inscription. Vous pouvez supprimer votre compte et toutes vos données à tout moment depuis la page Paramètres.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-3">4. Limitation de responsabilité (IA)</h2>
              <p>Bien que nous mettions tout en œuvre pour garantir la pertinence de nos analyses, l'intelligence artificielle peut générer des erreurs ou des approximations. Actoos ne saurait être tenu responsable des conséquences liées à l'application de ces recommandations.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-3">5. Modifications</h2>
              <p>Nous nous réservons le droit de modifier ces conditions à tout moment. Les utilisateurs seront informés des changements majeurs via l'application ou par e-mail.</p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
}