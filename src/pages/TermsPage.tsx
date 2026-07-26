import { FooterPageLayout } from '../components/FooterPageLayout';

export function TermsPage() {
  return (
    <FooterPageLayout title="Conditions générales d'utilisation">
      <p className="text-sm text-ink-500 dark:text-ink-400">Dernière mise à jour : juillet 2026</p>

      <section>
        <h2 className="text-xl font-bold text-ink-900 dark:text-ink-50">1. Objet</h2>
        <p>Les présentes conditions générales d'utilisation (CGU) régissent l'accès et l'utilisation de la plateforme POS Flow, éditée par LiAfrik. En utilisant la plateforme, vous acceptez sans réserve les présentes CGU.</p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-ink-900 dark:text-ink-50">2. Définitions</h2>
        <p><strong>Plateforme</strong> : l'application POS Flow accessible via le web et en PWA. <strong>Tenant</strong> : l'espace de travail d'une entreprise cliente. <strong>Utilisateur</strong> : toute personne ayant un compte sur la plateforme.</p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-ink-900 dark:text-ink-50">3. Accès au service</h2>
        <p>L'inscription est ouverte à toute entreprise ou commerçant. La création d'un compte nécessite une adresse email valide. Chaque tenant dispose d'un administrateur responsable de la gestion des utilisateurs et des rôles au sein de son organisation.</p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-ink-900 dark:text-ink-50">4. Abonnements et essai gratuit</h2>
        <p>Tous les plans (Starter, Pro, Premium, Entreprise) incluent un essai gratuit de 7 jours, sans obligation de carte bancaire durant cette période. À l'issue de l'essai, un abonnement mensuel ou annuel est requis pour continuer à utiliser le service. L'abonnement annuel bénéficie d'une réduction équivalente à 2 mois offerts. Vous pouvez annuler à tout moment ; l'accès reste actif jusqu'à la fin de la période payée.</p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-ink-900 dark:text-ink-50">5. Responsabilités</h2>
        <p>LiAfrik s'engage à fournir un service disponible et sécurisé. L'utilisateur est responsable de l'exactitude des données saisies et de la confidentialité de ses identifiants. La plateforme est fournie « telle quelle » ; LiAfrik ne saurait être tenu responsable des pertes de données résultant d'une faute de l'utilisateur ou d'un cas de force majeure.</p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-ink-900 dark:text-ink-50">6. Propriété intellectuelle</h2>
        <p>La plateforme, son code, son design et la marque POS Flow sont la propriété exclusive de LiAfrik. Les données saisies par l'utilisateur restent sa propriété. L'utilisateur conserve le droit d'exporter ses données à tout moment.</p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-ink-900 dark:text-ink-50">7. Résiliation</h2>
        <p>LiAfrik se réserve le droit de suspendre ou résilier un compte en cas de non-respect des CGU, de fraude ou d'usage illicite. L'utilisateur peut résilier son abonnement à tout moment depuis son espace Paramètres.</p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-ink-900 dark:text-ink-50">8. Contact</h2>
        <p>Pour toute question relative aux CGU : <a href="mailto:legal@liafrik.com" className="text-brand-600 hover:underline">legal@liafrik.com</a>.</p>
      </section>
    </FooterPageLayout>
  );
}
