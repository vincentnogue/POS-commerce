import { FooterPageLayout } from '../components/FooterPageLayout';

export function LegalPage() {
  return (
    <FooterPageLayout title="Mentions légales">
      <section>
        <h2 className="text-xl font-bold text-ink-900 dark:text-ink-50">Éditeur de la plateforme</h2>
        <p><strong>LiAfrik</strong><br />
        Société holding panafricaine spécialisée dans les solutions de gestion commerciale.<br />
        Siège social : Dubaï, Émirats arabes unis.<br />
        Bureau opérationnel : Afrique de l'Ouest.<br />
        Contact : <a href="mailto:cs@liafrik.com" className="text-brand-600 hover:underline">cs@liafrik.com</a></p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-ink-900 dark:text-ink-50">Directeur de publication</h2>
        <p>La direction de la publication est assurée par la direction de LiAfrik.</p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-ink-900 dark:text-ink-50">Hébergement</h2>
        <p>La plateforme est hébergée sur des infrastructures cloud sécurisées opérées par des fournisseurs respectant les standards internationaux en matière de protection des données. Toutes les communications sont chiffrées. Les données sont stockées dans des centres de données certifiés.</p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-ink-900 dark:text-ink-50">Propriété intellectuelle</h2>
        <p>L'ensemble des éléments constituant la plateforme POS Flow (interface, code, design, logos, textes) est protégé par le droit de la propriété intellectuelle. Toute reproduction, représentation ou diffusion, totale ou partielle, sans autorisation écrite préalable de LiAfrik est interdite.</p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-ink-900 dark:text-ink-50">Marque</h2>
        <p>« POS Flow » et le logo associé sont des marques de LiAfrik. « LiAfrik » est une marque déposée de LiAfrik.</p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-ink-900 dark:text-ink-50">Médiation</h2>
        <p>En cas de litige, une solution amiable sera recherchée en priorité. À défaut, les tribunaux compétents du siège de LiAfrik statueront.</p>
      </section>
    </FooterPageLayout>
  );
}
