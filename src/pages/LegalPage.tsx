import { FooterPageLayout } from '../components/FooterPageLayout';

export function LegalPage() {
  return (
    <FooterPageLayout title="Mentions légales">
      <section>
        <h2 className="text-xl font-bold text-ink-900">Éditeur de la plateforme</h2>
        <p><strong>LIYHA GROUP</strong><br />
        Société holding panafricaine spécialisée dans les solutions de gestion commerciale.<br />
        Siège social : Dubaï, Émirats arabes unis.<br />
        Bureau opérationnel : Yaoundé-Soa, Cameroun.<br />
        Contact : <a href="mailto:contact@liyha.group" className="text-brand-600 hover:underline">contact@liyha.group</a></p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-ink-900">Directeur de publication</h2>
        <p>La direction de la publication est assurée par la direction de LIYHA GROUP.</p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-ink-900">Hébergement</h2>
        <p>La plateforme est hébergée sur des infrastructures cloud sécurisées opérées par des fournisseurs respectant les standards internationaux en matière de protection des données. Toutes les communications sont chiffrées. Les données sont stockées dans des centres de données certifiés.</p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-ink-900">Propriété intellectuelle</h2>
        <p>L'ensemble des éléments constituant la plateforme LiAfrik Flow (interface, code, design, logos, textes) est protégé par le droit de la propriété intellectuelle. Toute reproduction, représentation ou diffusion, totale ou partielle, sans autorisation écrite préalable de LIYHA GROUP est interdite.</p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-ink-900">Marque</h2>
        <p>« LiAfrik Flow » et le logo associé sont des marques de LIYHA GROUP. « LIYHA » est une marque déposée de LIYHA GROUP.</p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-ink-900">Médiation</h2>
        <p>En cas de litige, une solution amiable sera recherchée en priorité. À défaut, les tribunaux compétents du siège de LIYHA GROUP statueront.</p>
      </section>
    </FooterPageLayout>
  );
}
