window.PRADO = {
  intro: 'Štiri tekme, štiri slike. Za vsako najdeno podrobnost in vsak pravilen odgovor daš gol. Prado ne more zadeti nič, ker slike ne igrajo nogometa.',
  parents: [
    'Računajte 45 minut. Vrstni red: najprej 1. nadstropje (Velázquez), nato pritličje (Bosch, Goya).',
    'Fotografiranje v dvoranah ni dovoljeno, zato igra deluje brez fotoaparata. Telefon lahko ostane v načinu za letalo: igra dela brez povezave.',
    'Številke sob se lahko spremenijo. Če slike ni, naj otrok pokaže čuvaju stavek v španščini ali ga predvaja z gumbom.',
    'Pri Goyevem psu visijo v isti sobi "črne slike", med njimi zelo grozljiv Saturn. Otroka pripeljite naravnost do psa.'
  ],
  matches: [
    { id: 'meninas', title: 'Las Meninas', by: 'Diego Velázquez, 1656', where: 'Sala 012 · 1. nadstropje', es: '¿Dónde están Las Meninas?', esSl: 'Kje so Las Meninas?',
      find: { img: 'img/p-ogledalo.jpg', text: 'Poišči to majhno ogledalo na zadnji steni sobe na sliki. Kdo se skriva v njem?' },
      quiz: { q: 'Preštej ljudi na sliki, brez tistih v ogledalu. Koliko jih je?', options: ['7', '9', '12'], a: 1, ok: 'Devet! Z dvema v ogledalu jih je enajst.', no: 'Preštej še enkrat, ne pozabi moža v vratih zadaj.' },
      bonus: { img: 'img/p-pes-meninas.jpg', text: 'Bonus: najdi velikega psa, ki dremlje. Deček ga z nogo drega, da bi se zbudil.' },
      fact: 'V ogledalu sta kralj Filip IV. in kraljica Mariana. Slika je visoka 3,18 metra, skoraj dvakrat višja od očeta. Slikar Velázquez je naslikal tudi sebe, s čopičem v roki. Rdeči križ na njegovih prsih je dobil šele tri leta pozneje; pravijo, da ga je dorisal kar kralj sam.',
      full: 'img/f-meninas.jpg' },
    { id: 'princ', title: 'Princ na konju', by: 'Diego Velázquez, okoli 1635', where: 'Velázquezove sobe ob Las Meninas · 1. nadstropje', es: '¿Dónde está el príncipe Baltasar Carlos a caballo?', esSl: 'Kje je princ Baltazar Karel na konju?',
      find: { img: 'img/p-konj.jpg', text: 'Poišči tega konja z zlato uzdo. Na njem sedi princ s črnim klobukom.' },
      quiz: { q: 'Zakaj ima konj tako okrogel trebuh?', options: ['Slika je visela visoko nad vrati', 'Konj je pojedel preveč ovsa', 'Slikar ni znal risati konjev'], a: 0, ok: 'Tako je! Od spodaj je bil trebuh videti čisto pravi.', no: 'Namig: slike ni bilo na tej steni, ampak čisto drugje.' },
      fact: 'Princ Baltazar Karel je imel 5 ali 6 let, skoraj kot ti. Slika je visela visoko nad vrati, med portretoma njegovega očeta in mame na konjih. Zadaj so gore Guadarrama, ki se vidijo tudi s strehe Bernabéua.',
      full: 'img/f-baltasar.jpg' },
    { id: 'vrt', title: 'Vrt zemeljskih naslad', by: 'Hieronymus Bosch, okoli 1500', where: 'Sala 056A · pritličje', es: '¿Dónde está El jardín de las delicias?', esSl: 'Kje je Vrt zemeljskih naslad?',
      find: { img: 'img/p-zirafa.jpg', text: 'Poišči to belo žirafo na levem delu slike. Zraven je ježevec z bodicami.' },
      quiz: { q: 'Katere živali NI na levem delu slike?', options: ['Žirafe', 'Slona', 'Pingvina'], a: 2, ok: 'Pingvina ni! Bosch pingvina sploh ni poznal.', no: 'To žival pa najdeš, poglej še enkrat.' },
      bonus: { img: 'img/p-slon.jpg', text: 'Bonus: najdi slona. Kdo mu sedi na hrbtu?' },
      fact: 'Slika je stara več kot 500 let in ima tri dele. Na sredini so orjaške jagode, ptice, večje od ljudi, in ribe na kopnem. Ko oba krila zapreš, se na zunanji strani pokaže svet kot steklena krogla v sivih barvah.',
      full: 'img/f-vrt.jpg', extra: 'img/f-vrt-zaprt.jpg' },
    { id: 'pes', title: 'Pes', by: 'Francisco de Goya, okoli 1820', where: 'Sala 067 · pritličje (črne slike)', es: '¿Dónde está el perro de Goya?', esSl: 'Kje je Goyev pes?',
      find: { img: 'img/p-glava-psa.jpg', text: 'Poišči to pasjo glavo. Je čisto majhna na veliki rjavi sliki.' },
      quiz: { q: 'Koliko psa vidiš na sliki?', options: ['Samo glavo', 'Celega psa, ki teče', 'Tri pse'], a: 0, ok: 'Samo glavo! Ostalo skriva rjav hrib.', no: 'Poglej natančno, kaj vidiš od psa.' },
      fact: 'Goya je bil star več kot 70 let, ko je to naslikal kar na steno svoje hiše, samo zase. Okoli 50 let pozneje, leta 1874, so slike s sten prenesli na platno. Nihče ne ve zagotovo, kaj pomeni: pes gleda navzgor, kot da nekoga čaka.',
      full: 'img/f-pes.jpg' }
  ],
  penalty: { es: '¿Dónde está la salida?', esSl: 'Kje je izhod?', text: 'Enajstmetrovka! Ko greste ven, vprašaj čuvaja po špansko, kje je izhod. Potem izberi najljubšo sliko.' }
};
