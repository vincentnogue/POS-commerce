import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Moon, Sun, BookOpen } from 'lucide-react';
import { Logo } from '../components/Logo';
import { useI18n } from '../lib/i18n';
import { useTheme } from '../lib/theme';
import { useDocumentMeta } from '../lib/useDocumentMeta';

// User-facing "how do I actually use this" manual — distinct from
// DocumentationPage (API reference for developers) and HelpCenterPage
// (short FAQ). This walks through every real module in the app
// (src/App.tsx routes) in the order a new tenant would actually set up
// and use them, written from what those modules genuinely do rather than
// generic SaaS boilerplate. Static French content (matching the
// DocumentationPage precedent already in this codebase) rather than
// i18n keys — a manual this long, translated key-by-key across 7
// locales, would be a much bigger project on its own; this ships the
// French version the footer link was asked for and can be localized
// later without changing the route or structure.

type Section = { id: string; title: string; body: JSX.Element };

const sections: Section[] = [
  {
    id: 'demarrage',
    title: '1. Démarrage',
    body: (
      <>
        <p>À l'inscription, vous créez votre compte et votre <strong>tenant</strong> (l'espace de travail de votre entreprise). Vous bénéficiez automatiquement d'un essai gratuit de 14 jours, sans carte bancaire, avec accès à toutes les fonctionnalités du plan choisi.</p>
        <p>Le parcours d'onboarding vous demande vos informations d'entreprise (nom, pays, devise) puis vous amène directement au tableau de bord. Vous pouvez ensuite inviter votre équipe depuis <Link to="/users" className="text-brand-600 hover:underline">Équipe</Link> et configurer votre premier magasin depuis <Link to="/stores" className="text-brand-600 hover:underline">Magasins</Link>.</p>
        <p>À l'expiration des 14 jours, l'accès aux modules est suspendu tant qu'aucun abonnement payant n'est actif — un bandeau dans l'application vous prévient à l'approche de l'échéance.</p>
      </>
    ),
  },
  {
    id: 'pos',
    title: '2. Point de vente (POS)',
    body: (
      <>
        <p>Le module <Link to="/pos" className="text-brand-600 hover:underline">POS</Link> est l'écran de caisse : recherchez ou scannez un produit, ajustez les quantités, appliquez une remise ou une promotion, puis encaissez.</p>
        <p>Plusieurs moyens d'encaissement sont disponibles selon les intégrations que vous avez connectées dans le <Link to="/marketplace" className="text-brand-600 hover:underline">Marketplace</Link> : espèces, carte via un PSP connecté (Stripe, Flutterwave, Paystack, PayUnit), ou Mobile Money (M-Pesa, Orange Money) avec poussée de paiement directe sur le téléphone du client.</p>
        <p>Chaque vente génère un ticket, met à jour le stock en temps réel, et alimente vos rapports.</p>
      </>
    ),
  },
  {
    id: 'catalogue',
    title: '3. Produits et stock',
    body: (
      <>
        <p><Link to="/products" className="text-brand-600 hover:underline">Produits</Link> gère votre catalogue : nom, prix, catégorie, code-barres, image. <Link to="/stock" className="text-brand-600 hover:underline">Stock</Link> suit les quantités disponibles par magasin, les seuils d'alerte de réapprovisionnement et l'historique des mouvements (entrées, sorties, ajustements, transferts entre magasins).</p>
        <p>Le nombre de produits et de magasins que vous pouvez créer dépend de votre plan (voir la section Abonnement ci-dessous).</p>
      </>
    ),
  },
  {
    id: 'ventes-clients',
    title: '4. Clients, factures et devis',
    body: (
      <>
        <p><Link to="/customers" className="text-brand-600 hover:underline">Clients</Link> centralise votre fichier client (coordonnées, historique d'achats, solde). <Link to="/quotes" className="text-brand-600 hover:underline">Devis</Link> permet de créer un devis puis de le convertir en facture ou en vente en un clic une fois accepté. <Link to="/invoices" className="text-brand-600 hover:underline">Factures</Link> gère la facturation, le suivi des paiements et l'export PDF.</p>
        <p><Link to="/deliveries" className="text-brand-600 hover:underline">Livraisons</Link> suit l'acheminement des commandes jusqu'au client lorsque vous vendez avec livraison.</p>
      </>
    ),
  },
  {
    id: 'achats',
    title: '5. Fournisseurs, achats et dépenses',
    body: (
      <>
        <p><Link to="/suppliers" className="text-brand-600 hover:underline">Fournisseurs</Link> répertorie vos partenaires d'approvisionnement. <Link to="/purchases" className="text-brand-600 hover:underline">Achats</Link> enregistre vos commandes fournisseurs, qui viennent réapprovisionner automatiquement le stock à réception. <Link to="/expenses" className="text-brand-600 hover:underline">Dépenses</Link> suit toutes vos charges (loyer, salaires, logistique...) pour une vision complète de votre rentabilité.</p>
      </>
    ),
  },
  {
    id: 'rapports',
    title: '6. Rapports et comptabilité',
    body: (
      <>
        <p><Link to="/reports" className="text-brand-600 hover:underline">Rapports</Link> et <Link to="/performance" className="text-brand-600 hover:underline">Performance</Link> donnent une vue chiffrée de votre activité : chiffre d'affaires, marge, produits les plus vendus, comparaison entre magasins et entre périodes. <Link to="/accounting" className="text-brand-600 hover:underline">Comptabilité</Link> (plans Premium et Entreprise) structure ces données pour faciliter votre suivi comptable et vos exports vers un expert-comptable.</p>
      </>
    ),
  },
  {
    id: 'equipe',
    title: '7. Équipe, rôles et pointeuse',
    body: (
      <>
        <p><Link to="/users" className="text-brand-600 hover:underline">Équipe</Link> permet d'inviter des collaborateurs et de leur assigner un rôle (administrateur, gestionnaire, caissier...) qui détermine les modules et actions auxquels ils ont accès. Le nombre d'utilisateurs autorisés dépend de votre plan.</p>
        <p><Link to="/timeclock" className="text-brand-600 hover:underline">Pointeuse</Link> enregistre les heures de présence de l'équipe. <Link to="/tasks" className="text-brand-600 hover:underline">Tâches</Link> permet d'assigner et suivre des tâches internes. <Link to="/commissions" className="text-brand-600 hover:underline">Commissions</Link> calcule automatiquement les commissions de vente par employé selon les règles que vous définissez.</p>
      </>
    ),
  },
  {
    id: 'marketing',
    title: '8. Promotions et messages',
    body: (
      <>
        <p><Link to="/promotions" className="text-brand-600 hover:underline">Promotions</Link> crée des remises et codes promo appliqués automatiquement au POS selon les conditions définies (produit, catégorie, montant minimum, période). <Link to="/messages" className="text-brand-600 hover:underline">Messages</Link> centralise vos échanges avec vos clients via les canaux connectés (WhatsApp, SMS, email selon vos intégrations).</p>
      </>
    ),
  },
  {
    id: 'marketplace',
    title: '9. Marketplace et intégrations',
    body: (
      <>
        <p>Le <Link to="/marketplace" className="text-brand-600 hover:underline">Marketplace</Link> liste les applications que vous pouvez connecter à votre plateforme : moyens de paiement (Stripe, Flutterwave, Paystack, PayUnit, Mobile Money), et autres services tiers. Cliquez sur une application pour la connecter — les identifiants sont stockés de façon chiffrée et ne sont jamais visibles de vos clients.</p>
        <p>Une fois un moyen de paiement connecté, il devient automatiquement disponible dans le module POS et dans le générateur de lien de paiement, pour encaisser vos propres clients en ligne.</p>
      </>
    ),
  },
  {
    id: 'parametres',
    title: '10. Paramètres',
    body: (
      <>
        <p><Link to="/settings" className="text-brand-600 hover:underline">Paramètres</Link> regroupe l'identité de votre entreprise (logo, coordonnées de facturation, numéro d'immatriculation fiscale), les préférences d'affichage (langue, thème clair/sombre), et la sécurité de votre compte (changement de mot de passe).</p>
        <p>Pour changer votre mot de passe : Paramètres → Sécurité. Pour le récupérer si vous l'avez oublié : lien « Mot de passe oublié » sur l'écran de connexion — un email de réinitialisation vous est envoyé.</p>
      </>
    ),
  },
  {
    id: 'abonnement',
    title: '11. Abonnement et facturation',
    body: (
      <>
        <p>Depuis <Link to="/subscribe" className="text-brand-600 hover:underline">Abonnement</Link>, choisissez votre plan (Starter, Pro, Premium, Entreprise) et votre cycle de facturation (mensuel ou annuel, 2 mois offerts à l'année). Les moyens de paiement disponibles s'affichent automatiquement selon ce qui est configuré pour votre région.</p>
        <p>Chaque plan a ses propres limites (nombre d'utilisateurs, de magasins, de produits) et ses modules inclus — consultez la page <Link to="/pricing" className="text-brand-600 hover:underline">Tarifs</Link> pour le détail. Vous pouvez changer de plan ou annuler à tout moment ; l'accès reste actif jusqu'à la fin de la période déjà payée. Voir notre <Link to="/refund-policy" className="text-brand-600 hover:underline">politique de remboursement</Link> pour le détail des cas de remboursement.</p>
      </>
    ),
  },
  {
    id: 'securite',
    title: '12. Sécurité et confidentialité de vos données',
    body: (
      <>
        <p>Chaque tenant est strictement isolé au niveau de la base de données : aucune entreprise cliente ne peut accéder aux données d'une autre, quel que soit son plan. Toutes les communications sont chiffrées en transit. Le détail de nos engagements figure dans notre <Link to="/privacy" className="text-brand-600 hover:underline">politique de confidentialité</Link> et notre <Link to="/sla" className="text-brand-600 hover:underline">engagement de disponibilité</Link>.</p>
      </>
    ),
  },
  {
    id: 'aide',
    title: "13. Besoin d'aide ?",
    body: (
      <>
        <p>Pour des questions fréquentes, consultez notre <Link to="/help" className="text-brand-600 hover:underline">Centre d'aide</Link>. Pour une question technique ou un accompagnement, écrivez-nous depuis la page <Link to="/contact" className="text-brand-600 hover:underline">Contact</Link> ou à <a href="mailto:support@liafrik.com" className="text-brand-600 hover:underline">support@liafrik.com</a>.</p>
      </>
    ),
  },
];

export function UserManualPage() {
  useDocumentMeta(
    'Manuel d\u2019utilisation — POS Flow',
    'Guide complet pour prendre en main POS Flow : caisse, stock, facturation, équipe, paiements en ligne, abonnement et sécurité.'
  );
  const { t } = useI18n();
  const { theme, toggle } = useTheme();
  const [active, setActive] = useState(sections[0].id);

  return (
    <div className="min-h-screen bg-white dark:bg-ink-800">
      <header className="sticky top-0 z-30 border-b border-ink-100 dark:border-ink-800 bg-white/85 dark:bg-ink-800/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5">
          <Link to="/"><Logo /></Link>
          <div className="flex items-center gap-3">
            <Link to="/" className="inline-flex items-center gap-1 text-sm font-medium text-ink-600 dark:text-ink-300 hover:text-brand-600">
              <ArrowLeft size={14} /> {t('pricing.backHome')}
            </Link>
            <button
              onClick={toggle}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-300 transition hover:border-brand-200 hover:text-brand-600"
              aria-label={t('header.toggleTheme')}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-12 lg:px-8">
        <div className="flex items-center gap-2 text-brand-600">
          <BookOpen size={20} />
          <span className="text-sm font-semibold uppercase tracking-wide">Manuel d'utilisation</span>
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink-900 dark:text-ink-50 sm:text-4xl">
          Bien démarrer avec POS Flow
        </h1>
        <p className="mt-3 max-w-2xl text-ink-600 dark:text-ink-300">
          Un guide module par module pour prendre en main la plateforme, de l'inscription à la gestion quotidienne de votre commerce.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[240px_1fr]">
          <nav className="lg:sticky lg:top-24 lg:self-start">
            <ul className="space-y-1 border-l border-ink-100 dark:border-ink-800">
              {sections.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    onClick={() => setActive(s.id)}
                    className={`-ml-px block border-l-2 px-4 py-1.5 text-sm transition ${
                      active === s.id
                        ? 'border-brand-500 font-medium text-brand-600'
                        : 'border-transparent text-ink-500 hover:border-ink-300 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-100'
                    }`}
                  >
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="space-y-12">
            {sections.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-24">
                <h2 className="text-xl font-medium text-ink-900 dark:text-ink-50">{s.title}</h2>
                <div className="mt-3 space-y-3 leading-relaxed text-ink-700 dark:text-ink-200">{s.body}</div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
