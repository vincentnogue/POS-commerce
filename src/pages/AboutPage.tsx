import { motion } from 'framer-motion';
import { Building2, Globe2, Heart, Target } from 'lucide-react';
import { FooterPageLayout } from '../components/FooterPageLayout';

export function AboutPage() {
  return (
    <FooterPageLayout title="À propos de POS Flow">
      <p className="text-lg">POS Flow est la plateforme de gestion commerciale conçue par <strong>LiAfrik</strong>, pensée pour les réalités du commerce africain et prête pour le monde entier.</p>

      <div className="grid gap-6 sm:grid-cols-2 my-8">
        {[
          { icon: Target, title: 'Notre mission', text: "Démocratiser l'accès à des outils de gestion professionnelle pour chaque commerçant africain, de la boutique de quartier à la chaîne de supermarchés." },
          { icon: Globe2, title: 'Notre vision', text: "Devenir la référence panafricaine de la gestion commerciale, en accompagnant 100 000 entreprises vers la digitalisation d'ici 2030." },
          { icon: Heart, title: 'Nos valeurs', text: 'Proximité terrain, excellence technique, inclusion linguistique (FR/EN, bientôt PT/AR), et impact économique mesurable.' },
          { icon: Building2, title: 'LiAfrik', text: 'Société holding panafricaine, basée à Dubaï avec des équipes opérationnelles réparties en Afrique. POS Flow est notre produit flagship.' },
        ].map((v, i) => (
          <motion.div
            key={v.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className="rounded-2xl border border-ink-200 dark:border-ink-700 bg-brand-50/30 dark:bg-brand-900/25 p-6"
          >
            <v.icon className="mb-3 text-brand-600" size={24} />
            <h3 className="text-base font-bold text-ink-900 dark:text-ink-50">{v.title}</h3>
            <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">{v.text}</p>
          </motion.div>
        ))}
      </div>

      <section>
        <h2 className="text-xl font-bold text-ink-900 dark:text-ink-50">Notre histoire</h2>
        <p>Née de l'observation des défis quotidiens des commerçants africains — gestion manuelle du stock, difficulté à suivre les ventes multi-magasins, absence de facturation formalisée — POS Flow a été conçue dès le départ comme une solution <strong>offline-first</strong> et <strong>mobile-first</strong>. Nous savons que la connexion internet n'est pas toujours garantie en boutique, et qu'un vendeur travaille avant tout avec son téléphone.</p>
        <p className="mt-4">Aujourd'hui, POS Flow accompagne des commerces dans plus de 50 pays africains, avec une prise en charge native du Mobile Money, des devises locales et des spécificités régionales.</p>
      </section>
    </FooterPageLayout>
  );
}
