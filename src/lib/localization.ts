// Panafrican localization data — countries, currencies, regions, payment methods.

export type CountryInfo = {
  code: string;
  name: string;
  currency: string;
  dialCode: string;
  regions: string[];
  cities: string[];
  mobileMoney: string[];
  languages: string[];
};

export const COUNTRIES: CountryInfo[] = [
  { code: 'CM', name: 'Cameroun', currency: 'XAF', dialCode: '+237', regions: ['Centre', 'Littoral', 'Ouest', 'Sud-Ouest', 'Nord-Ouest', 'Sud', 'Est', 'Adamaoua', 'Nord', 'Extrême-Nord'], cities: ['Douala', 'Yaoundé', 'Bafoussam', 'Bamenda', 'Garoua', 'Maroua', 'Soa', 'Kribi', 'Limbé', 'Ebolowa'], mobileMoney: ['Orange Money', 'MTN Mobile Money'], languages: ['fr'] },
  { code: 'CI', name: "Côte d'Ivoire", currency: 'XOF', dialCode: '+225', regions: ['Abidjan', 'Lagunes', 'Comoé', 'Sud-Comoé', 'Gôh-Djiboua', 'Bas-Sassandra', 'Haut-Sassandra'], cities: ['Abidjan', 'Bouaké', 'Yamoussoukro', 'San-Pédro', 'Korhogo', 'Daloa'], mobileMoney: ['Orange Money', 'MTN Mobile Money', 'Moov Money', 'Wave'], languages: ['fr'] },
  { code: 'SN', name: 'Sénégal', currency: 'XOF', dialCode: '+221', regions: ['Dakar', 'Thiès', 'Diourbel', 'Saint-Louis', 'Kaolack', 'Ziguinchor'], cities: ['Dakar', 'Thiès', 'Saint-Louis', 'Kaolack', 'Touba', 'Ziguinchor'], mobileMoney: ['Orange Money', 'Wave', 'Free Money'], languages: ['fr'] },
  { code: 'NG', name: 'Nigeria', currency: 'NGN', dialCode: '+234', regions: ['Lagos', 'Abuja FCT', 'Rivers', 'Kano', 'Oyo', 'Kaduna', 'Enugu'], cities: ['Lagos', 'Abuja', 'Kano', 'Ibadan', 'Port Harcourt', 'Benin City', 'Kaduna'], mobileMoney: ['MTN MoMo', 'OPay', 'Paga'], languages: ['en'] },
  { code: 'KE', name: 'Kenya', currency: 'KES', dialCode: '+254', regions: ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret'], cities: ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret', 'Thika'], mobileMoney: ['M-Pesa', 'Airtel Money', 'T-Kash'], languages: ['en', 'sw'] },
  { code: 'GH', name: 'Ghana', currency: 'GHS', dialCode: '+233', regions: ['Greater Accra', 'Ashanti', 'Western', 'Central', 'Eastern', 'Northern'], cities: ['Accra', 'Kumasi', 'Takoradi', 'Cape Coast', 'Tamale', 'Tema'], mobileMoney: ['MTN MoMo', 'Vodafone Cash', 'AirtelTigo Money'], languages: ['en'] },
  { code: 'TZ', name: 'Tanzanie', currency: 'TZS', dialCode: '+255', regions: ['Dar es Salaam', 'Dodoma', 'Arusha', 'Mwanza', 'Zanzibar'], cities: ['Dar es Salaam', 'Dodoma', 'Arusha', 'Mwanza', 'Zanzibar City'], mobileMoney: ['M-Pesa', 'Tigo Pesa', 'Airtel Money', 'Halopesa'], languages: ['en', 'sw'] },
  { code: 'UG', name: 'Ouganda', currency: 'UGX', dialCode: '+256', regions: ['Central', 'Eastern', 'Northern', 'Western'], cities: ['Kampala', 'Entebbe', 'Jinja', 'Gulu', 'Mbarara'], mobileMoney: ['MTN MoMo', 'Airtel Money'], languages: ['en'] },
  { code: 'ET', name: 'Éthiopie', currency: 'ETB', dialCode: '+251', regions: ['Addis Ababa', 'Oromia', 'Amhara', 'Tigray', 'Sidama'], cities: ['Addis Ababa', 'Dire Dawa', 'Adama', 'Gondar', 'Hawassa'], mobileMoney: ['Telebirr', 'CBE Birr'], languages: ['en', 'am'] },
  { code: 'EG', name: 'Égypte', currency: 'EGP', dialCode: '+20', regions: ['Le Caire', 'Alexandrie', 'Gizeh', 'Assouan', 'Louxor'], cities: ['Le Caire', 'Alexandrie', 'Gizeh', 'Assouan', 'Louxor', 'Port-Saïd'], mobileMoney: ['Vodafone Cash', 'Etisalat Cash'], languages: ['ar', 'en'] },
  { code: 'MA', name: 'Maroc', currency: 'MAD', dialCode: '+212', regions: ['Casablanca-Settat', 'Rabat-Salé-Kénitra', 'Marrakech-Safi', 'Fès-Meknès', 'Tanger-Tétouan'], cities: ['Casablanca', 'Rabat', 'Marrakech', 'Fès', 'Tanger', 'Agadir'], mobileMoney: ['Inwi Money', 'Cash Plus'], languages: ['ar', 'fr'] },
  { code: 'DZ', name: 'Algérie', currency: 'DZD', dialCode: '+213', regions: ['Alger', 'Oran', 'Constantine', 'Annaba', 'Sétif'], cities: ['Alger', 'Oran', 'Constantine', 'Annaba', 'Sétif', 'Blida'], mobileMoney: ['Edahabia', 'BaridiMob'], languages: ['ar', 'fr'] },
  { code: 'ZA', name: 'Afrique du Sud', currency: 'ZAR', dialCode: '+27', regions: ['Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape', 'Free State'], cities: ['Johannesburg', 'Le Cap', 'Durban', 'Pretoria', 'Port Elizabeth', 'Bloemfontein'], mobileMoney: ['SnapScan', 'Zapper'], languages: ['en'] },
  { code: 'CD', name: 'RD Congo', currency: 'CDF', dialCode: '+243', regions: ['Kinshasa', 'Kongo Central', 'Haut-Katanga', 'Nord-Kivu', 'Sud-Kivu'], cities: ['Kinshasa', 'Lubumbashi', 'Goma', 'Bukavu', 'Mbuji-Mayi', 'Kisangani'], mobileMoney: ['M-Pesa', 'Orange Money', 'Airtel Money'], languages: ['fr'] },
  { code: 'CG', name: 'Congo', currency: 'XAF', dialCode: '+242', regions: ['Brazzaville', 'Pointe-Noire', 'Cuvette', 'Likouala', 'Sangha'], cities: ['Brazzaville', 'Pointe-Noire', 'Dolisie', 'Owando', 'Impfondo'], mobileMoney: ['Airtel Money', 'MTN Mobile Money'], languages: ['fr'] },
  { code: 'GA', name: 'Gabon', currency: 'XAF', dialCode: '+241', regions: ['Estuaire', 'Haut-Ogooué', 'Moyen-Ogooué', 'Ngounié'], cities: ['Libreville', 'Port-Gentil', 'Franceville', 'Oyem', 'Moanda'], mobileMoney: ['Airtel Money', 'Moov Money'], languages: ['fr'] },
  { code: 'ML', name: 'Mali', currency: 'XOF', dialCode: '+223', regions: ['Bamako', 'Kayes', 'Sikasso', 'Ségou', 'Mopti'], cities: ['Bamako', 'Sikasso', 'Ségou', 'Kayes', 'Mopti', 'Tombouctou'], mobileMoney: ['Orange Money', 'Moov Money', 'Wave'], languages: ['fr'] },
  { code: 'BF', name: 'Burkina Faso', currency: 'XOF', dialCode: '+226', regions: ['Centre', 'Hauts-Bassins', 'Boucle du Mouhoun', 'Nord', 'Est'], cities: ['Ouagadougou', 'Bobo-Dioulasso', 'Koudougou', 'Banfora', 'Ouahigouya'], mobileMoney: ['Orange Money', 'Moov Money', 'Coris Money'], languages: ['fr'] },
  { code: 'BJ', name: 'Bénin', currency: 'XOF', dialCode: '+229', regions: ['Littoral', 'Atlantique', 'Ouémé', 'Zou', 'Mono'], cities: ['Cotonou', 'Porto-Novo', 'Parakou', 'Abomey', 'Natitingou'], mobileMoney: ['MTN MoMo', 'Moov Money', 'Celtiis Cash'], languages: ['fr'] },
  { code: 'TG', name: 'Togo', currency: 'XOF', dialCode: '+228', regions: ['Maritime', 'Plateaux', 'Centrale', 'Kara', 'Savanes'], cities: ['Lomé', 'Sokodé', 'Kara', 'Atakpamé', 'Dapaong'], mobileMoney: ['Moov Money', 'Togo Cel', 'TMoney'], languages: ['fr'] },
  { code: 'NE', name: 'Niger', currency: 'XOF', dialCode: '+227', regions: ['Niamey', 'Maradi', 'Zinder', 'Tillabéri', 'Diffa'], cities: ['Niamey', 'Maradi', 'Zinder', 'Agadez', 'Diffa'], mobileMoney: ['Airtel Money', 'Moov Money'], languages: ['fr'] },
  { code: 'GN', name: 'Guinée', currency: 'GNF', dialCode: '+224', regions: ['Conakry', 'Kindia', 'Boké', 'Kankan', 'Nzérékoré'], cities: ['Conakry', 'Kankan', 'Kindia', 'Boké', 'Nzérékoré'], mobileMoney: ['Orange Money', 'MTN Mobile Money'], languages: ['fr'] },
  { code: 'SL', name: 'Sierra Leone', currency: 'SLL', dialCode: '+232', regions: ['Western Area', 'Northern', 'Southern', 'Eastern'], cities: ['Freetown', 'Bo', 'Kenema', 'Makeni', 'Koidu'], mobileMoney: ['Orange Money', 'Africell Money'], languages: ['en'] },
  { code: 'LR', name: 'Liberia', currency: 'LRD', dialCode: '+231', regions: ['Montserrado', 'Nimba', 'Bong', 'Grand Bassa'], cities: ['Monrovia', 'Gbarnga', 'Buchanan', 'Ganta', 'Kakata'], mobileMoney: ['Lonestar Cell Money', 'Orange Money'], languages: ['en'] },
  { code: 'RW', name: 'Rwanda', currency: 'RWF', dialCode: '+250', regions: ['Kigali', 'Nord', 'Sud', 'Est', 'Ouest'], cities: ['Kigali', 'Butare', 'Gitarama', 'Ruhengeri', 'Gisenyi'], mobileMoney: ['MTN MoMo', 'Airtel Money'], languages: ['en', 'fr', 'rw'] },
  { code: 'BI', name: 'Burundi', currency: 'BIF', dialCode: '+257', regions: ['Bujumbura', 'Bubanza', 'Bururi', 'Gitega'], cities: ['Bujumbura', 'Gitega', 'Ngozi', 'Muyinga', 'Rumonge'], mobileMoney: ['Lumicash', 'Ecobank Mobile'], languages: ['fr', 'en'] },
  { code: 'MW', name: 'Malawi', currency: 'MWK', dialCode: '+265', regions: ['Central', 'Southern', 'Northern'], cities: ['Lilongwe', 'Blantyre', 'Mzuzu', 'Zomba'], mobileMoney: ['Airtel Money', 'TNM Mpamba'], languages: ['en'] },
  { code: 'ZM', name: 'Zambie', currency: 'ZMW', dialCode: '+260', regions: ['Lusaka', 'Copperbelt', 'Southern', 'Northern'], cities: ['Lusaka', 'Ndola', 'Kitwe', 'Kabwe', 'Livingstone'], mobileMoney: ['Airtel Money', 'MTN Mobile Money'], languages: ['en'] },
  { code: 'ZW', name: 'Zimbabwe', currency: 'ZWL', dialCode: '+263', regions: ['Harare', 'Bulawayo', 'Manicaland', 'Mashonaland'], cities: ['Harare', 'Bulawayo', 'Mutare', 'Gweru', 'Masvingo'], mobileMoney: ['EcoCash', 'OneMoney'], languages: ['en'] },
  { code: 'MZ', name: 'Mozambique', currency: 'MZN', dialCode: '+258', regions: ['Maputo', 'Gaza', 'Sofala', 'Nampula'], cities: ['Maputo', 'Matola', 'Beira', 'Nampula', 'Chimoio'], mobileMoney: ['mPesa', 'e-Mola'], languages: ['pt', 'en'] },
  { code: 'AO', name: 'Angola', currency: 'AOA', dialCode: '+244', regions: ['Luanda', 'Benguela', 'Huambo', 'Huíla'], cities: ['Luanda', 'Huambo', 'Benguela', 'Lobito', 'Lubango'], mobileMoney: ['Unitel Money', 'Multicaixa Express'], languages: ['pt'] },
  { code: 'SD', name: 'Soudan', currency: 'SDG', dialCode: '+249', regions: ['Khartoum', 'Gezira', 'Kordofan', 'Darfur'], cities: ['Khartoum', 'Omdurman', 'Port Sudan', 'Kassala', 'El Obeid'], mobileMoney: ['Zain Cash', 'MTN Mobile Money'], languages: ['ar', 'en'] },
  { code: 'TN', name: 'Tunisie', currency: 'TND', dialCode: '+216', regions: ['Tunis', 'Sfax', 'Sousse', 'Nabeul', 'Ariana'], cities: ['Tunis', 'Sfax', 'Sousse', 'Kairouan', 'Bizerte'], mobileMoney: ['D17', 'PayDya'], languages: ['ar', 'fr'] },
  { code: 'LY', name: 'Libye', currency: 'LYD', dialCode: '+218', regions: ['Tripoli', 'Benghazi', 'Misrata', 'Zliten'], cities: ['Tripoli', 'Benghazi', 'Misrata', 'Zawiya', 'Zliten'], mobileMoney: ['Madfouna'], languages: ['ar'] },
  { code: 'MR', name: 'Mauritanie', currency: 'MRU', dialCode: '+222', regions: ['Nouakchott', 'Hodh Ech Chargui', 'Trarza', 'Brakna'], cities: ['Nouakchott', 'Nouadhibou', 'Kaédi', 'Rosso', 'Atar'], mobileMoney: ['Bankily', 'Masrifi'], languages: ['ar', 'fr'] },
  { code: 'GM', name: 'Gambie', currency: 'GMD', dialCode: '+220', regions: ['Banjul', 'Western', 'Lower River', 'Central River'], cities: ['Banjul', 'Serekunda', 'Brikama', 'Farafenni'], mobileMoney: ['Wari', 'Africell Money'], languages: ['en'] },
  { code: 'GW', name: 'Guinée-Bissau', currency: 'XOF', dialCode: '+245', regions: ['Bissau', 'Bolama', 'Cacheu', 'Gabu'], cities: ['Bissau', 'Bafatá', 'Gabú', 'Cacheu'], mobileMoney: ['Orange Money', 'MTN Mobile Money'], languages: ['pt', 'fr'] },
  { code: 'CV', name: 'Cap-Vert', currency: 'CVE', dialCode: '+238', regions: ['Santiago', 'São Vicente', 'Santo Antão', 'Fogo'], cities: ['Praia', 'Mindelo', 'Assomada', 'Espargos'], mobileMoney: ['Unitel T\'+'], languages: ['pt'] },
  { code: 'KM', name: 'Comores', currency: 'KMF', dialCode: '+269', regions: ['Grande Comore', 'Anjouan', 'Mohéli'], cities: ['Moroni', 'Mutsamudu', 'Fomboni', 'Domoni'], mobileMoney: ['Mvola'], languages: ['fr', 'ar'] },
  { code: 'SC', name: 'Seychelles', currency: 'SCR', dialCode: '+248', regions: ['Mahé', 'Praslin', 'La Digue'], cities: ['Victoria', 'Anse Royale', 'Beau Vallon'], mobileMoney: ['SeyPay'], languages: ['en', 'fr'] },
  { code: 'MU', name: 'Maurice', currency: 'MUR', dialCode: '+230', regions: ['Port-Louis', 'Pamplemousses', 'Plaines Wilhems', 'Flacq'], cities: ['Port-Louis', 'Curepipe', 'Vacoas', 'Quatre Bornes'], mobileMoney: ['My.t Money', 'Mauritius Telecom Money'], languages: ['en', 'fr'] },
  { code: 'ST', name: 'Sao Tomé et Príncipe', currency: 'STN', dialCode: '+239', regions: ['Sao Tomé', 'Príncipe'], cities: ['Sao Tomé', 'Santana', 'Trindade', 'Neves'], mobileMoney: ['Unitel Money'], languages: ['pt'] },
  { code: 'DJ', name: 'Djibouti', currency: 'DJF', dialCode: '+253', regions: ['Djibouti', 'Arta', 'Dikhil', 'Ali Sabieh'], cities: ['Djibouti', 'Ali Sabieh', 'Dikhil', 'Tadjourah'], mobileMoney: ['Evci', 'Mobile Cash'], languages: ['fr', 'ar'] },
  { code: 'SO', name: 'Somalie', currency: 'SOS', dialCode: '+252', regions: ['Banadir', 'Bakool', 'Bari', 'Galguduud'], cities: ['Mogadiscio', 'Hargeisa', 'Kismayo', 'Baidoa', 'Bossaso'], mobileMoney: ['EVC Plus', 'Sahal', 'Hormuud'], languages: ['so', 'en'] },
  { code: 'SS', name: 'Soudan du Sud', currency: 'SSP', dialCode: '+211', regions: ['Central Equatoria', 'Jonglei', 'Lakes', 'Unity'], cities: ['Juba', 'Wau', 'Malakal', 'Yei', 'Bor'], mobileMoney: ['mCash', 'Ezee Money'], languages: ['en'] },
  { code: 'ER', name: 'Érythrée', currency: 'ERN', dialCode: '+291', regions: ['Maekel', 'Anseba', 'Gash-Barka', 'Debub'], cities: ['Asmara', 'Keren', 'Assab', 'Massawa', 'Mendefera'], mobileMoney: ['Hiber Mobile Money'], languages: ['ar', 'en'] },
  { code: 'CF', name: 'Centrafrique', currency: 'XAF', dialCode: '+236', regions: ['Bangui', 'Lobaye', 'Ombella-Mpoko', 'Haut-Mbomou'], cities: ['Bangui', 'Bimbo', 'Berbérati', 'Bouar', 'Kaga-Bandoro'], mobileMoney: ['Airtel Money', 'Orange Money'], languages: ['fr'] },
  { code: 'TD', name: 'Tchad', currency: 'XAF', dialCode: '+235', regions: ['N\'Djamena', 'Hadjer-Lamis', 'Logone Occidental', 'Mayo-Kebbi'], cities: ['N\'Djamena', 'Moundou', 'Sarh', 'Abéché', 'Kelo'], mobileMoney: ['Airtel Money', 'Moov Money'], languages: ['fr', 'ar'] },
  { code: 'LS', name: 'Lesotho', currency: 'LSL', dialCode: '+266', regions: ['Maseru', 'Berea', 'Mafeteng', 'Leribe'], cities: ['Maseru', 'Teyateyaneng', 'Mafeteng', 'Hlotse'], mobileMoney: ['Econet EcoCash', 'MPesa'], languages: ['en'] },
  { code: 'SZ', name: 'Eswatini', currency: 'SZL', dialCode: '+268', regions: ['Hhohho', 'Manzini', 'Shiselweni', 'Lubombo'], cities: ['Mbabane', 'Manzini', 'Siteki', 'Nhlangano'], mobileMoney: ['MTN Mobile Money'], languages: ['en'] },
  { code: 'BW', name: 'Botswana', currency: 'BWP', dialCode: '+267', regions: ['Gaborone', 'Central', 'Kgalagadi', 'North-West'], cities: ['Gaborone', 'Francistown', 'Molepolole', 'Maun'], mobileMoney: ['Orange Money', 'Mascom MyZaka'], languages: ['en'] },
  { code: 'NA', name: 'Namibie', currency: 'NAD', dialCode: '+264', regions: ['Khomas', 'Erongo', 'Oshana', 'Otjozondjupa'], cities: ['Windhoek', 'Swakopmund', 'Walvis Bay', 'Oshakati', 'Rundu'], mobileMoney: ['MTC Mobile Money', 'FNB eWallet'], languages: ['en'] },
  { code: 'MG', name: 'Madagascar', currency: 'MGA', dialCode: '+261', regions: ['Analamanga', 'Atsinanana', 'Diana', 'Sava'], cities: ['Antananarivo', 'Toamasina', 'Antsirabe', 'Mahajanga', 'Fianarantsoa'], mobileMoney: ['MVola', 'Airtel Money', 'Orange Money'], languages: ['fr', 'mg'] },
  { code: 'SH', name: 'Sainte-Hélène', currency: 'SHP', dialCode: '+290', regions: ['Saint Helena'], cities: ['Jamestown'], mobileMoney: [], languages: ['en'] },
  { code: 'RE', name: 'La Réunion', currency: 'EUR', dialCode: '+262', regions: ['Saint-Denis', 'Saint-Pierre', 'Saint-Paul'], cities: ['Saint-Denis', 'Saint-Pierre', 'Saint-Paul', 'Le Tampon'], mobileMoney: [], languages: ['fr'] },
  // International expansion markets
  { code: 'AE', name: 'Émirats arabes unis', currency: 'AED', dialCode: '+971', regions: ['Dubaï', 'Abu Dhabi', 'Sharjah', 'Ajman'], cities: ['Dubaï', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Al Ain'], mobileMoney: [], languages: ['ar', 'en'] },
  { code: 'US', name: 'États-Unis', currency: 'USD', dialCode: '+1', regions: ['California', 'New York', 'Texas', 'Florida'], cities: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Miami'], mobileMoney: [], languages: ['en'] },
  { code: 'FR', name: 'France', currency: 'EUR', dialCode: '+33', regions: ['Île-de-France', 'Auvergne-Rhône-Alpes', "Provence-Alpes-Côte d'Azur", 'Occitanie'], cities: ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Bordeaux', 'Lille'], mobileMoney: [], languages: ['fr'] },
  { code: 'GB', name: 'Royaume-Uni', currency: 'GBP', dialCode: '+44', regions: ['England', 'Scotland', 'Wales', 'Northern Ireland'], cities: ['Londres', 'Manchester', 'Birmingham', 'Édimbourg', 'Glasgow'], mobileMoney: [], languages: ['en'] },
];

export const CURRENCIES: Record<string, { symbol: string; decimals: number; label: string }> = {
  XAF: { symbol: 'FCFA', decimals: 0, label: 'Franc CFA (BEAC)' },
  XOF: { symbol: 'FCFA', decimals: 0, label: 'Franc CFA (BCEAO)' },
  NGN: { symbol: '₦', decimals: 2, label: 'Naira' },
  GHS: { symbol: '₵', decimals: 2, label: 'Cedi' },
  KES: { symbol: 'KSh', decimals: 2, label: 'Shilling kényan' },
  ZAR: { symbol: 'R', decimals: 2, label: 'Rand' },
  EGP: { symbol: 'E£', decimals: 2, label: 'Livre égyptienne' },
  MAD: { symbol: 'DH', decimals: 2, label: 'Dirham' },
  DZD: { symbol: 'DA', decimals: 2, label: 'Dinar algérien' },
  ETB: { symbol: 'Br', decimals: 2, label: 'Birr' },
  TZS: { symbol: 'TSh', decimals: 0, label: 'Shilling tanzanien' },
  UGX: { symbol: 'USh', decimals: 0, label: 'Shilling ougandais' },
  USD: { symbol: '$', decimals: 2, label: 'Dollar américain' },
  EUR: { symbol: '€', decimals: 2, label: 'Euro' },
  GBP: { symbol: '£', decimals: 2, label: 'Livre sterling' },
  AED: { symbol: 'AED', decimals: 2, label: 'Dirham des EAU' },
  CDF: { symbol: 'FC', decimals: 2, label: 'Franc congolais' },
  GNF: { symbol: 'GNF', decimals: 0, label: 'Franc guinéen' },
  SLL: { symbol: 'Le', decimals: 2, label: 'Leone' },
  LRD: { symbol: 'L$', decimals: 2, label: 'Dollar libérien' },
  RWF: { symbol: 'RF', decimals: 0, label: 'Franc rwandais' },
  BIF: { symbol: 'FBu', decimals: 0, label: 'Franc burundais' },
  MWK: { symbol: 'MK', decimals: 2, label: 'Kwacha malawite' },
  ZMW: { symbol: 'ZK', decimals: 2, label: 'Kwacha zambien' },
  ZWL: { symbol: 'ZWL', decimals: 2, label: 'Dollar zimbabwéen' },
  MZN: { symbol: 'MT', decimals: 2, label: 'Metical' },
  AOA: { symbol: 'Kz', decimals: 2, label: 'Kwanza' },
  SDG: { symbol: 'SDG', decimals: 2, label: 'Livre soudanaise' },
  TND: { symbol: 'DT', decimals: 3, label: 'Dinar tunisien' },
  LYD: { symbol: 'LD', decimals: 3, label: 'Dinar libyen' },
  MRU: { symbol: 'MRU', decimals: 2, label: 'Ouguiya' },
  GMD: { symbol: 'D', decimals: 2, label: 'Dalasi' },
  CVE: { symbol: '$', decimals: 2, label: 'Escudo capverdien' },
  KMF: { symbol: 'CF', decimals: 0, label: 'Franc comorien' },
  SCR: { symbol: 'SR', decimals: 2, label: 'Roupie seychelloise' },
  MUR: { symbol: 'Rs', decimals: 2, label: 'Roupie mauricienne' },
  STN: { symbol: 'Db', decimals: 2, label: 'Dobra' },
  DJF: { symbol: 'FDJ', decimals: 0, label: 'Franc djiboutien' },
  SOS: { symbol: 'SOS', decimals: 2, label: 'Shilling somalien' },
  SSP: { symbol: 'SSP', decimals: 2, label: 'Livre soudanaise du Sud' },
  ERN: { symbol: 'Nfk', decimals: 2, label: 'Nakfa' },
  LSL: { symbol: 'L', decimals: 2, label: 'Loti' },
  SZL: { symbol: 'L', decimals: 2, label: 'Lilangeni' },
  BWP: { symbol: 'P', decimals: 2, label: 'Pula' },
  NAD: { symbol: 'N$', decimals: 2, label: 'Dollar namibien' },
  MGA: { symbol: 'Ar', decimals: 2, label: 'Ariary' },
  SHP: { symbol: '£', decimals: 2, label: 'Livre de Sainte-Hélène' },
};

// Approximate reference rates to USD (for Super Admin MRR consolidation)
export const USD_REFERENCE_RATES: Record<string, number> = {
  USD: 1, EUR: 1.08, GBP: 1.27, AED: 0.27,
  XAF: 0.00167, XOF: 0.00167, NGN: 0.00065, GHS: 0.078, KES: 0.0078,
  ZAR: 0.054, EGP: 0.021, MAD: 0.1, DZD: 0.0074, ETB: 0.018,
  TZS: 0.00039, UGX: 0.00027, CDF: 0.00037, GNF: 0.00012, SLL: 0.00005,
  LRD: 0.005, RWF: 0.00078, BIF: 0.00035, MWK: 0.00058, ZMW: 0.037,
  ZWL: 0.012, MZN: 0.016, AOA: 0.0011, SDG: 0.0017, TND: 0.32, LYD: 0.21,
  MRU: 0.025, GMD: 0.016, CVE: 0.0098, KMF: 0.0022, SCR: 0.073,
  MUR: 0.022, STN: 0.044, DJF: 0.0056, SOS: 0.0017, SSP: 0.00077,
  ERN: 0.067, LSL: 0.054, SZL: 0.054, BWP: 0.074, NAD: 0.054, MGA: 0.00022, SHP: 1.27,
};

export function formatMoney(amount: number, currency: string): string {
  const info = CURRENCIES[currency] ?? { symbol: currency, decimals: 2 };
  const value = Number(amount || 0).toLocaleString('fr-FR', {
    minimumFractionDigits: info.decimals,
    maximumFractionDigits: info.decimals,
  });
  return `${value} ${info.symbol}`;
}

export function getCountry(code: string): CountryInfo | undefined {
  return COUNTRIES.find((c) => c.code === code);
}

export function convertToUSD(amount: number, currency: string): number {
  const rate = USD_REFERENCE_RATES[currency] ?? 1;
  return amount * rate;
}
