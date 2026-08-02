import { useState } from 'react';
import { FooterPageLayout } from '../components/FooterPageLayout';
import {
  Rocket, ShoppingCart, Boxes, FileText, CreditCard, Users, ShieldCheck,
  ChevronDown, MessageCircle,
} from 'lucide-react';

type Item = { q: string; a: string };
type Category = { icon: any; title: string; items: Item[] };

const CATEGORIES: Category[] = [
  {
    icon: Rocket,
    title: 'Démarrage rapide',
    items: [
      { q: 'Comment créer mon compte et mon premier magasin ?', a: "Inscrivez-vous avec votre email, puis suivez l'assistant de configuration : nom de l'entreprise, pays, devise, et votre premier magasin sont créés automatiquement. Vous bénéficiez de 7 jours d'essai gratuit, sans carte bancaire." },
      { q: 'Comment ajouter mes premiers produits ?', a: "Allez dans Produits, puis Ajouter un produit. Renseignez le nom, le prix de vente, le prix d'achat (optionnel) et la TVA. Vous pouvez aussi importer plusieurs produits d'un coup via l'export/import CSV." },
      { q: "Puis-je essayer sans engagement ?", a: "Oui, l'essai de 7 jours donne accès à toutes les fonctionnalités de votre plan choisi, sans paiement. Vous pouvez annuler à tout moment avant la fin de l'essai." },
    ],
  },
  {
    icon: ShoppingCart,
    title: 'Point de Vente (POS)',
    items: [
      { q: 'Comment encaisser une vente ?', a: "Ouvrez le module POS, recherchez ou scannez le produit, ajustez la quantité, choisissez le mode de paiement (espèces, carte, Mobile Money) et validez. Un reçu peut être imprimé ou envoyé par WhatsApp." },
      { q: "Le stock se met-il à jour automatiquement après une vente ?", a: "Oui, chaque vente complétée décrémente automatiquement le stock du magasin concerné en temps réel, aucune action manuelle nécessaire." },
      { q: "Je gère plusieurs magasins, comment choisir lequel encaisse ?", a: "Un sélecteur de magasin apparaît en haut du POS si votre compte a plusieurs magasins. Chaque vente est ainsi rattachée au bon magasin et déduit le bon stock." },
    ],
  },
  {
    icon: Boxes,
    title: 'Stock & transferts entre magasins',
    items: [
      { q: 'Comment ajuster mon stock manuellement ?', a: "Dans Stock, cliquez Ajuster sur la ligne du produit concerné (ou Mouvement en haut de page), choisissez le magasin, le type (entrée/sortie) et la quantité." },
      { q: 'Comment transférer du stock entre deux de mes magasins ?', a: "Dans Stock, onglet Transferts, choisissez le produit, le magasin source, le magasin destination et la quantité. Le stock est immédiatement retiré du magasin source. Le magasin destinataire doit ensuite cliquer sur Recevoir pour que le stock apparaisse chez lui, cela reflète le transport réel de la marchandise et évite les écarts de comptage." },
      { q: "J'ai initié un transfert par erreur, que faire ?", a: "Tant qu'un transfert n'a pas été reçu par le magasin destinataire, il peut être annulé : le stock retourne alors automatiquement au magasin source." },
    ],
  },
  {
    icon: FileText,
    title: 'Facturation & documents',
    items: [
      { q: 'Comment personnaliser mes factures avec mon logo ?', a: "Allez dans Paramètres, section Entreprise, uploadez votre logo et votre cachet. Ils apparaîtront automatiquement sur toutes vos factures PDF." },
      { q: 'Puis-je envoyer une facture par WhatsApp ?', a: "Oui, depuis une facture, cliquez WhatsApp : le PDF se télécharge et une conversation WhatsApp s'ouvre avec un message prêt à l'emploi, il ne reste qu'à joindre le fichier téléchargé." },
      { q: 'Dans quelle devise mes factures sont-elles émises ?', a: "Toujours dans la devise définie pour votre entreprise (Paramètres, Entreprise), pour rester cohérent sur tous vos documents." },
    ],
  },
  {
    icon: CreditCard,
    title: 'Abonnement & paiement',
    items: [
      { q: 'Quels moyens de paiement acceptez-vous ?', a: "Carte bancaire (via Stripe) et Mobile Money (via Flutterwave), choisissez votre méthode préférée au moment de souscrire." },
      { q: "Que se passe-t-il si mon essai se termine ?", a: "Vous serez invité à choisir un forfait pour continuer. Vos données restent intactes le temps de finaliser votre souscription." },
      { q: 'Puis-je changer de forfait plus tard ?', a: "Oui, à tout moment depuis Paramètres, Abonnement. Le changement est proportionnel à votre cycle de facturation en cours." },
    ],
  },
  {
    icon: Users,
    title: 'Équipe & permissions',
    items: [
      { q: 'Comment inviter un employé ?', a: "Dans Utilisateurs, cliquez Inviter, renseignez son email et son rôle. Il recevra un email pour créer son mot de passe." },
      { q: "Puis-je limiter ce qu'un employé peut voir ou modifier ?", a: "Oui, créez un rôle personnalisé (Utilisateurs, onglet Rôles) avec des permissions précises par module (voir/créer/modifier/supprimer), puis assignez-le à l'employé concerné." },
    ],
  },
  {
    icon: ShieldCheck,
    title: 'Sécurité & données',
    items: [
      { q: 'Mes données sont-elles isolées des autres entreprises ?', a: "Oui, chaque entreprise est strictement isolée au niveau de la base de données elle-même, pas seulement dans l'interface. Personne d'autre ne peut jamais accéder à vos données." },
      { q: "J'ai oublié mon mot de passe, comment le réinitialiser ?", a: "Sur la page de connexion, cliquez Mot de passe oublié, entrez votre email, et suivez le lien reçu pour choisir un nouveau mot de passe." },
    ],
  },
];

function AccordionItem({ item }: { item: Item }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-ink-100 dark:border-ink-800 last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 py-3.5 text-left"
      >
        <span className="text-sm font-medium text-ink-800 dark:text-ink-100">{item.q}</span>
        <ChevronDown size={16} className={`shrink-0 text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <p className="pb-4 text-sm text-ink-600 dark:text-ink-300">{item.a}</p>}
    </div>
  );
}

export function HelpCenterPage() {
  const [query, setQuery] = useState('');

  const filtered = CATEGORIES.map((cat) => ({
    ...cat,
    items: cat.items.filter(
      (i) => !query.trim() || i.q.toLowerCase().includes(query.toLowerCase()) || i.a.toLowerCase().includes(query.toLowerCase())
    ),
  })).filter((cat) => cat.items.length > 0);

  return (
    <FooterPageLayout title="Centre d'aide">
      <div className="not-prose mb-8">
        <p className="text-ink-600 dark:text-ink-300">Trouvez rapidement des réponses pour bien utiliser POS Flow, ou discutez directement avec notre assistant.</p>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher une question…"
          className="input mt-4 w-full max-w-md"
        />
      </div>

      <div className="not-prose space-y-8">
        {filtered.map((cat) => (
          <div key={cat.title} className="card p-5">
            <div className="mb-1 flex items-center gap-2.5">
              <cat.icon size={18} className="text-brand-600" />
              <h2 className="text-base font-medium text-ink-900 dark:text-ink-50">{cat.title}</h2>
            </div>
            <div>
              {cat.items.map((item) => <AccordionItem key={item.q} item={item} />)}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-sm text-ink-400 dark:text-ink-500">Aucun résultat pour "{query}". Essayez notre assistant en bas à droite de l'écran.</p>
        )}
      </div>

      <div className="not-prose mt-10 flex items-center gap-4 rounded-2xl border border-brand-100 dark:border-brand-900/40 bg-brand-50 dark:bg-brand-900/20 p-5">
        <MessageCircle size={28} className="shrink-0 text-brand-600" />
        <div>
          <p className="text-sm font-medium text-ink-900 dark:text-ink-50">Vous ne trouvez pas votre réponse ?</p>
          <p className="text-sm text-ink-600 dark:text-ink-300">Cliquez sur la bulle de discussion en bas à droite, notre assistant répond instantanément, et peut vous mettre en relation avec notre équipe si besoin.</p>
        </div>
      </div>
    </FooterPageLayout>
  );
}
