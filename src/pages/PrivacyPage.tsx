import { FooterPageLayout } from '../components/FooterPageLayout';

export function PrivacyPage() {
  return (
    <FooterPageLayout title="Politique de confidentialité">
      <p className="text-sm text-ink-500 dark:text-ink-400">Dernière mise à jour : juillet 2026</p>

      <section>
        <h2 className="text-xl font-bold text-ink-900 dark:text-ink-50">1. Responsable du traitement</h2>
        <p>LIYHA GROUP, éditeur de la plateforme LiAfrik Flow, est responsable du traitement des données personnelles collectées sur la plateforme. Pour toute question relative à la protection des données, vous pouvez contacter notre DPO à l'adresse : <a href="mailto:dpo@liyha.group" className="text-brand-600 hover:underline">dpo@liyha.group</a>.</p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-ink-900 dark:text-ink-50">2. Données collectées</h2>
        <p>Nous collectons les données suivantes dans le cadre de la fourniture du service :</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Identité de l'entreprise (nom, pays, ville, devise) et informations de facturation.</li>
          <li>Données d'authentification (email, mot de passe chiffré de manière sécurisée).</li>
          <li>Données opérationnelles saisies par l'utilisateur (produits, clients, ventes, factures, stock).</li>
          <li>Données de navigation (cookies analytiques, sous réserve de votre consentement).</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold text-ink-900 dark:text-ink-50">3. Finalités du traitement</h2>
        <p>Les données sont traitées pour : la fourniture et l'amélioration du service, la gestion des abonnements, l'émission de factures, la sécurité et la prévention de la fraude, et le respect des obligations légales.</p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-ink-900 dark:text-ink-50">4. Cookies</h2>
        <p>Nous utilisons trois catégories de cookies : les cookies nécessaires au fonctionnement de la plateforme (authentification, préférences de langue et de thème), les cookies analytiques (mesure d'audience anonyme) et les cookies marketing (sous consentement). Vous pouvez modifier vos préférences à tout moment via le lien « Gérer mes cookies » en bas de page.</p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-ink-900 dark:text-ink-50">5. Vos droits</h2>
        <p>Conformément aux réglementations applicables, vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation, de portabilité et d'opposition concernant vos données personnelles. Pour exercer ces droits, contactez-nous à <a href="mailto:privacy@liyha.group" className="text-brand-600 hover:underline">privacy@liyha.group</a>.</p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-ink-900 dark:text-ink-50">6. Hébergement et sécurité</h2>
        <p>Les données sont hébergées sur des infrastructures cloud sécurisées respectant les standards internationaux. Toutes les communications sont chiffrées en TLS. L'accès aux données est strictement isolé entre les entreprises clientes par des mécanismes de sécurité au niveau base de données.</p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-ink-900 dark:text-ink-50">7. Conservation</h2>
        <p>Les données sont conservées pendant toute la durée d'utilisation du service, puis archivées ou supprimées selon les obligations légales applicables. Les données de facturation sont conservées 10 ans conformément aux obligations comptables.</p>
      </section>
    </FooterPageLayout>
  );
}
