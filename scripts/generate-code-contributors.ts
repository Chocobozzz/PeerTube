import { registerTSPaths } from '../server/helpers/register-ts-paths'
registerTSPaths()

import { execCLI } from '@shared/extra-utils'

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(-1)
  })

async function run () {
  const blacklist = getContributorsBlacklist()

  {
    let contributors = await getGitContributors()
    contributors = contributors.concat(getZanataContributors())
    contributors = contributors.filter(c => blacklist[c.username] !== true)

    console.log('# Code & Translators contributors\n')
    for (const contributor of contributors) {
      console.log(` * ${contributor.username}`)
    }
  }

  {
    console.log('\n\n# Design\n')
    console.log(' * [Olivier Massain](https://dribbble.com/omassain)')
    console.log(' * [Marie-Cécile Godwin Paccard](https://mcgodwin.com/)')

    console.log('\n\n# Icons\n')
    console.log(' * [Feather Icons](feathericons.com/) (MIT)')
    console.log(' * `playlist add`, `history`, `subscriptions`, `miscellaneous-services.svg` by Material UI (Apache 2.0)')
    console.log(' * `support` by Chocobozzz (CC-BY)')
    console.log(' * `language` by Aaron Jin (CC-BY)')
    console.log(' * `video-language` by Rigel Kent (CC-BY)')
    console.log(' * `peertube-x` by Solen DP (CC-BY)')
  }

  {
    console.log('\n\nContributors to our 2018 crowdfunding :heart:')
    console.log('---------------------------------------------\n')
    console.log(`We ran [a crowdfunding campaign](https://www.kisskissbankbank.com/en/projects/peertube-a-free-and-federated-video-platform)
in 2018 to pave the road to the version 1.0.0 of PeerTube, with 1,379 backers. Thanks to everyone who pitched in and shared the news!`)
    console.log(`
Quonfucius, IP Solution, _Laure_, @lex666, 0x010C, 3dsman, 3rw4n-G3D, aallrd, Abel-Berger, Adam-Odell, adechambost, adim, adngdb, Adrien T
hurotte, Adrien-BARAN, Adrien-Hamraoui, Adrien-Horcholle, Adrien-Luxey, Adrien-Polar, Adrien-Touminet, Agathe Begault, Agence-Différente, Ah
med-Al-Ahmed, aiprole, akpoptro, Al-Nimr, Alain-Delgrange, Alain-Fyon, Alain-Girard, Alain-MICHEL, Aleksandar-Aleksandrov, Alex-Chancellé, A
lex-Dufournet, Alex-Gleason, Alexander-Murray-Watters, Alexandre-Alapetite, Alexandre-Badez, Alexandre-Giuliani, Alexandre-Mercier, Alexandr
e-Roux-2, Alexandre-SIMON, Alexandre29, Alexia-Monsavoir, Alexis-Frn, Alexis-Gros, Alexis-Kauffmann, alfajet, Alias, alinemont, Aliocha-Lang
, Alllightlong, aloisdg, Amanda Hinault, André-Rabe, Anne-PROTAS, antoine, Antoine Derouin, Antoine-Beauvillain, Antoine-Deléron, antomoro, 
Antón López, Antonin-DENIS, Antonin-Segault, aokami, Apichat-Apichat, Ar-To, ARIAS-Frédéric-2, ariasuni, Aris-Papathéodorou, Arnaud -Vigoure
ux , Arnaud-Mounier, Arnaud-Risler, Arnaud-Vigouroux, Arnulf, Arthur-Bellier, arthur-bello, Arthur-Charron, Arthur-De Kimpe, Arthur.Ball, Ar
thur.Frin, Arvi-LEFEVRE, athanael.fr, auber38, Auguste Psqr, Aurélien-Tamisier, Avel-Musicavel, axel-guegant, Axel-Plat, Aymeric-Dlv, Ayst, 
Azenilion, Bandino, baptiste-lemoine, Baptiste-Rochez, baruica, Bastien-Dangin, batlab, bcourtine, Bea-Schaack-2, beaufils, beaumme, Belmont
1, Ben-Geeraerts, Ben-Meijering, Benjamin-Baratta, Benjamin-Roussel, Benoît Joffre, Benoîtdd, Bernard-Legrand, Bernard-Vauquelin, Bernhard-H
ayden, bertrand.arlabosse, bigsicret, bjg, bnjbvr, bob_isat, bobstechsite, Bolton-Allan, Boov', Boris-ARGAUD, Brice.Francois, broz42, Bruno
 Lefèvre, Bruno-Douville, Bruno-Fortabat, Bruno-Gadaleta, Bruno-VASTA, Bumblebee, Butchcassidy, Cadiou-Christophe, calendros, Candy-Ming, ca
ppitaine, Carmen-Drocourt, carrigns, case, Cathy-Barbet, CBach, ccazin, Cecile-Obernesser, Cecilia-:), Cédric-Bleschet, Cédric.Bayle, Cestdo
ncvrai, cgay, champ contrechamp, chapa, charlerlin, charles-jacquin, Charlie-Duclut, charlotte-cgondre78, Chris-Doe, chris-louba, Christel-B
erthelot, Christian-FERRARIS, christiannavelot, Christophe-Bastin, christophe-beziers la fosse, Christophe-Pieret, Christophe-Verhaege, chri
stophec, Christopher-Bero, chtfn, chud, Claire-C, clairezed, Claude-POUGHEON, Clément-Hubert, Clément-Morelle, clydeb, Comamanel, Côme Chill
iet, Confederac.io, Consulting-AZAPTEC, Corentin3892, CryoGen, cyp, Cypher-Goat, Cyril, Cyril_M_, Cyril-MONMOUTON, Cyril-Waechter, Damien-
Gabard, Damien-Garaud, Dams3132, Daniel Kuebler, Daniel Waxweiler, Daniel-Bartsch, Daniel-PIPALA, Daniel-Struck, Daniel-Thul, Danny-Joerger,
 DansLeRuSH, DantSu, Dany-Marcoux, Daouzli-Adel, Darfeld, Darth_Judge, Dashcom, David-BADOIL, David-Benoist, David-Dormoy, David-Gil-2, Dav
id-Velasco, David-Wagner, David-writ, davlgd, davyg2, dbudo72300, de Folleville -Matthieu , DeBugs, Denis-Lecourtiller, Denis-Vannier, Desmu
, Didier-Bove, Diego-Crespo, Dimitri-Stouney, dino, Dinosaure, Doc Skellington, Dominique-Brun, dr4Ke, DreamClassier, DRogueRonin, dussydelf
, Dylan-Moonfire, Ealhad, Edouard-SCHWEISGUTH, Elanndelh--, ElodieEtJimmy, Éloi-Rivard, Elric-Noel, Elwan-Héry, Emilie-Wietzke, Emilien-Ghom
i, eparth, Eric-Bouhana, Eric-Hendricks, Eric.Vales, Erwan-Moreau, Erzender, ESS_Clem, Etienne-Baqué, Etienne-Botek, Etienne-Lmn, Ex-Serv, 
fabeveynes, Fabien BERINI ( Rehvaro ) , Fabien Freling, Fabien-Roualdes, Fabien.Abraini, Fabien.Bonneval, fabrice-simon, farlistener, Felix-
ROBICHON, FelixDouet, FHE, Fiamoa-McBenson, flamwenco, Flopômpôm, FloraGC, Florent-Deschamps, Florent-Fayolle, Florent-Mallet, Florent-Vasse
ur, Florent.Duveau, Florestan Fournier, Florian Kohrt, Florian-Bellafont, Florian-Douay, Florian-LE GOFF, Florian-Siegenthaler, Florian.Frey
ss, fobrice, FOKUZA, Fol-De Dol, FP45, Francis.Moraud, François-Dambrine, François-Deguerry, Francois-Goer, François-Lecomte, François-Lemai
re, François-Malterre, François-MORLET, François-Schoubben, François-Xavier-Davanne, François-Zajéga, francois.peyratout, Frathom, Fred-Fred
-2, Frédéric GUÉLEN, Frédéric-Blumstein, Frédéric-Meurou, Frederic-Reynaud, Frédéric-Sagot, Frek, FrenchHope, freyja, FugazziPL, Funky-Whale
, Gabriel-Devillers, Gabriel-Mirété, Galedas, GardoToF, Gaspard-Kemlin, GauthierPLM, Gauvain "GovanifY" Roussel-Tarbouriech, Gavy, gdquest, 
Geek Faëries, Geneviève-Perello, Geoffroy-MANAUD, Geojulien, Georges-Dutreix, Georges-Sempéré, Gerald-Vannier, Gérard-Brasquet, Gérard-Sense
vy, Gerrit-Großkopf, GGBNM, Ghislain-Fabre, Gil-Felot, Gilles-Brossier, Gilles-Moisan, Gilles-SACLIER, Gilles-Trossevin, Gilou, GinGa, ginkg
opr, glazzara, Glen-Lomax, Gof, Gonçalves-Daniel, goofy-goofy, grandlap, GRAP-Groupement Régional Alimentaire de Proximité, greg-chapuis, Gr
égoire-Delbeke, Grégory-Becq, Grégory-Goulaouic, Gregouw, Grizix, GrosCaillou, Grummfy, grumph, guiaug, Guillaume-Allart, Guillaume-Chambert
, Guillaume-Chaslot, Guillaume-David, Guillaume-Duc, Guillaume-Gay, Guillaume-Lecoquierre, Guillaume007, guillaumefavre, Guiraud-Dominique, 
Guy-Torreilles, GwendalL, gwlolos, Hanna-E, Hanno-Wagner, Harald-Eilertsen, Harpocrate, Hebus82, Hellmut, Henri-ROS, hervelc, hguilbert, His
ham-Muhammad, Hoang-Mai-Lesaffre, Homerc, homosapienssapiens, hoper, Hoshin, Hugo-Lagouge, Hugo-SIMANCAS, Hugo-Simon, Hylm, IchbinRob, Ivan-
Ogai, Ivan.D'halluin, Ivar-Troost, J-C-2, Jacques-Roos, James-Moore, James-Valleroy, Jan-Aagaard, Jan-Keromnes, Jancry, Janko-Mihelić, jano3
1coa, Jboot, jcgross, Jean CHARPENTIER, jean claude-skowron, Jean Dos, jean luc-PERROT, Jean-Baptiste-Maneyrol, Jean-charles-Surbayrole, Jea
n-claude-Jouanne, jean-dreyfus, jean-FISCHER, JEAN-FRANCOIS-BOUDEAU, Jean-Francois-Ducrot, Jean-François-PETITBON, Jean-François-Tomasi, Jea
n-Galland, Jean-louis-Bergamo, Jean-Luc-PIPO, Jean-Marie-Graïc, Jean-Martin Laval, Jean-Noel-Bruletout, Jean-Paul-GIBERT, Jean-Paul-Lescat, 
jean-philippe-bénétrix, Jean-Philippe-Eisenbarth, Jean-Philippe-Renaudet, Jean-Philippe-Rennard, Jean-Sébastien-Renaud, Jean-Yves Kiger, Jea
n-Yves-DUPARC, Jeanne-Corvellec, jeansebastien, Jelv, Jérémie -Wach, Jeremie-Lestel, Jérémy-Korwin, Jérôme-Avond, Jerome-Bu, Jerome-Denis, J
érôme-ISNARD, jerome-simonato, JeromeD, Jery, Jezza, Jim-McDoniel, jl-M-2, jlanca, jlcpuzzle, jn-m, jnthnctt, joakim.faiss, Joe-Riche, Joévi
n-SOULENQ, Johann-FONTAINE, John-Devor, John-Doe, Jojo-Boulix, Jonas-Aparicio, Jonathan-Dollé, Jonathan-Kohler, Jonathan-LAURENT, Jos-van de
n Oever, Joseph-Lawson, Jozef-Knaperek, jroger, ju, jubarbu, Julianoe-G, Julie-Bultez, Julien Loudet, Julien Maulny (alcalyn), Julien-AILHAU
D, Julien-Aubin, Julien-Biaudet, Julien-Bréchet, Julien-Cochennec, Julien-Duroure, Julien-Huon, Julien-Lemaire, Julien-Weber, jyb, K-_, Kal
ambakA, Kanor, kari-kimber, Karim-Jouini, karl-bienfait, Kdecherf, Keplerpondorskell, kevin-Beranger, Kevin-Nguyen, King-Of Peons, Kioob, kl
oh, kokoklems, Konstantin-Kovar, Kriĉjo, Kyâne-PICHOU, L'elfe-Sylvain, La Gonz, Lara-Dufour, lareinedeselfes, Laurence-Giroud, laurent-fuent
es, Laurent-HEINTZ, Laurent-PICQUENOT, ldubost, lebidibule, LeChi, LeDivinBueno, Legrave, Les Assortis, Leyokki-Tk, LibreEnFete-en Tregor, L
ilO. Moino, Liloumuloup, Linuxine-T, lionel-lachaud, Lionel-Schinckus, Loïc-L'Anton, Loïc.Guérin, Louis-Gatin, Louis-Marie-BAER, Louis-Rémi.
Babé, Louis-Roche, Louisclement, Lu, ludovic-lainard, Ludovic-Pénet, Lukas-Steiblys, lusoheart, Mad Sugar, maguy-giorgi, mahen, maiido, Malp
has, ManetteBE, Manon-Amalric, Manuel-Vazquez, ManuInzesky, Manumerique, Marc-BESSIERES, Marc-DUFOURNET, Marc-GASSER, Marc-Honnorat, marc-wi
lzius, marc.ribault.1, Marco-Heisig, Marie-PACHECO, Marien-Fressinaud, Marius-Lemonnier, Mark-O'Donovan, marliebo, marmat8951, mart1n, marte
nsite, Mathdatech, Mathias-Bocquet, Mathieu-Amirault, Mathieu-B., Mathieu-Cornic, Mathieu-VIRAMAN, Matías-Pérez, Matilin-Torre, matt.faure, 
Mattéo-Delabre, Matthias-Devlamynck, Matthieu-Bollot, Matthieu-De Beule, Matthieu-DEVILLERS, Matthieu-Dupont de Dinechin, Matthieu-Gaudé, Ma
tthieu-Sauboua-Beneluz, matthieublanco, MatthieuSchneider, Max-PENY, Maxime-de WYROW, Maxime-Desjardin, Maxime-Forest, maxime-haag, Maxime-M
angel, Maximilian Praeger, Mayeul-Cantan, Mayeul-Guiraud, mcg1712, metalvinze, Mewen, mheiber, Michael-Koppmann, Michael-Loew, Michael-Q. Bi
d, Michal-Herda, Michal-Noga, Michel-DUPONT, Michel-Le Lagadec, Michel-POUSSIER, Michel-Roux, Mickaël-Gauvin, Mickael-Liegard, MicMP3Man, Mi
guel-de la Cruz, Mike-Kasprzak, Mimon-Lapompe, Mister-Ocelot, mjhvc, Moutmout, MouTom, MP, mphdp, Mr-Tea, msellebulle, Mushussu, mylainos, n
anouckd, Nasser-Debruyere, Nat-Tuck, Nathan.B, nayya, nazgulz666, Neal-Wilson, neeev, neodarz-neodarz, NepsKi, Nestorvep, NHenry, Nialix, Ni
coD, Nicolas-Auvray, nicolas-k, Nicolas-Pinault, Nicolas-Ruffel, NicolasCARPi, nicolaslegland, niconil, Niles, nitot, Nono1965, Norbert, Nor
de, Numcap, obergix, Obrow, Okki, Olivier-Calzi, Olivier-Ganneval, Olivier-Marouzé, Olivier-Mondoloni, olivier-pierret, Oncela-Petit Chat, Ó
skar-Sturluson, p3n15634n7, Paindesegle, Pas De-Panique, Pascal-BLEUSE, Pascal-Larramendy, Patrice-Jabeneau, patrice-maertens, patrick-bappe
l, PATRICK-GRANDIN, Patrick-MERCIER, Patrickl , Paul-Härle, Paul-Tardy, pbramy, Pedro-CADETE, Perrine-de Coëtlogon, Peter_Fillgod, Petter-J
oelson, Philippe-BATTMANN, Philippe-Cabaud, Philippe-Debar, philippe-giffard, Philippe-Lallemant, Philippe-Le Van, philippe-lhardy, Philippe
-Thébault, Philippe-VINCENT-2, PhilOGM, Pierre 'catwell' Chapuis, Pierre Gros, Pierre-Antoine-Champin, Pierre-Bresson-2, Pierre-d'Alençon, P
ierre-Equoy, Pierre-Girardeau, Pierre-Houmeau, Pierre-Marijon, Pierre-petch, Pierrick-Couturier, Pilou-CaraGk, Piotr-Miszczak, Pla, Plastic 
Yogi, PME2050, pmiossec, Pofilo, Polioman, Polios63, Poutchiny, PRALLET-Claude, PtrckVllnv, Pulov Yuran, queertube, Quentin-Dugne, Quentin-P
AGÈS, ra-mon, Radhwan-Ben Madhkour, Raphaël-Brocq, Raphaël-Grolimund, Raphaël-Piédallu, raphane, Raphip, Raven, Raymond-Lutz, Razael, Rebecc
a-Breu, Remi-Durand, Rémi-Herrmann, Rémi-Verschelde, Remigho, Remix-the commons, Remy-Grauby, Rémy-Pradier, Renaud-Vincent, rgggn, rigelk, r
ip, Rivinbeg, Robert-Riemann, Robin Biechy, Roger-FRATTE, roipoussiere, Rolindes-Arroyo, Romain Théry-Hermain, Romain-Bouyé, Romain-Ortiz, R
omainVENNE, Romuald-EYRAUD, royhome, Rudy-aparicio, Rusty-Dwyer, rverchere, sajous.net, Salah-ZERGUI, Sam-R, Samh, Samuel Tardieu, Samuel-FA
YET, Samuel-Verschelde, Sanpi, Sascha-Brendel, Schwartz, Se7h, Sebastiaan-Glazenborg, Sebastian-Hugentobler, Sébastien Adam, Septie, Ser Eol
e, Severin-Suveren, severine-roger, shlagevuk-shlagevuk, Siegfried-Ehret, Simon-Hemery, Simon-Larcher, Simon-Reiser, Simounet, Siri-Louie, s
issssou, skarab, Skurious, skynebula, Sohga-Sohga, Solène-Rapenne, solinux, Sophie-Imbach , Sosthen, Spiderweak, Stanislas-ANDRE, Stanislas-
Michalak, starmatt, Steef, Stefan-Petrovski, Stéphane-Girardon, Stéphanie-Baltus, Stev-3d, Stoori, SuckyStrike, Sufflope, Sulfurax, SundownD
EV, Swann-Fournial, Syk, Syluban, Sylv1c, Sylvain Bellone, Sylvain P, Sylvain_M, Sylvain-Cazaux, Sylvain-GLAIZE, sylvain.arrachart, Sylvest
re Ledru, sylvie-boutet, Sylvie-TORRES, tael67, tang35, tangi_b, Tarulien, Taunya-Debolt, Tazimut-Khaelyor, terry-maire, Thanaen, Thatoo, T
héophile-Noiré, Thibault-Vlieghe, Thierry-Chancé, Thierry-Fenasse, Thomas-Aurel, Thomas-CALVEZ, thomas-constans, Thomas-Kuntz, thomassin-lou
cas, Thosbk, ticosc, Tim-Albers, Tinapa -Itastri, TkPx, TM, tnntwister, TomR, Tomus, Tonio-Bilos, tony-carnide, Toover, toto-leroidelasaucis
se, ToumToum, TP., trigrou, Tristan-Porteries, Tryph, Tursiops, tzilliox, U-&_\`HbAAe4onnpN9!e+/#42*5>k^E, Ulrich-Norbisrath, Un Sur Quatr
e, Valerio-Paladino, Valerio-Pilo, Valeryan_24, Valou69, Vegattitude, Velome, Vergogne, Vero-Pajot, vianneyb, Victo-Sab, Victor -Hery, Vict
orien-Labalette, Vincent-Corrèze, Vincent-Fromentin, Vincent-Lamy, Vincent-Lasseur, VINCENT-PEYRET, vmorel, Walter-van Holst, Watsdesign, We
sley-Moore, williampolletdev, win100, wyk, Xaloc-Xaloc, Xavier ALT, Xavier-Chantry, Xavier-Godard, XoD, Yaaann, Yann-Delaunoy, Yann-Nave, ya
nnick-grenzinger, yanselmetti, Ykatsot, Yohann-Bacha, yopox, Youen-Toupin, Yves-Caniou, Yves-Gerech, zar-rok, ZeBlackPearl, ZeGreg
    `)
  }
}

async function getGitContributors () {
  const output = await execCLI(`git --no-pager shortlog -sn < /dev/tty | sed 's/^\\s\\+[0-9]\\+\\s\\+//g'`)

  return output.split('\n')
               .filter(l => !!l)
               .map(l => ({ username: l }))
}

// Zanata is dead, don't loose the contributors name
function getZanataContributors () {
  return [
    { username: 'abdhessuk', name: 'Abd Hessuk' },
    { username: 'abidin24', name: 'abidin toumi' },
    { username: 'aditoo', name: 'Lorem Ipsum' },
    { username: 'alice', name: 'Alice' },
    { username: 'anastasia', name: 'Anastasia' },
    { username: 'autom', name: 'Filip Bengtsson' },
    { username: 'balaji', name: 'Balaji' },
    { username: 'bristow', name: 'Cédric F.' },
    { username: 'butterflyoffire', name: 'ButterflyOfFire' },
    { username: 'chocobozzz', name: 'Chocobozzz' },
    { username: 'claichou', name: 'Claire Mohin' },
    { username: 'degrange', name: 'Degrange Mathieu' },
    { username: 'dibek', name: 'Giuseppe Di Bella' },
    { username: 'edu', name: 'eduardo' },
    { username: 'ehsaan', name: 'ehsaan' },
    { username: 'esoforte', name: 'Ondřej Kotas' },
    { username: 'fkohrt', name: 'Florian Kohrt' },
    { username: 'giqtaqisi', name: 'Ian Townsend' },
    { username: 'goofy', name: 'goofy' },
    { username: 'gorkaazk', name: 'Gorka Azkarate Zubiaur' },
    { username: 'gwendald', name: 'GwendalD' },
    { username: 'h3zjp', name: 'h3zjp' },
    { username: 'jfblanc', name: 'Joan Francés Blanc' },
    { username: 'jhertel', name: 'Jean Hertel' },
    { username: 'jmf', name: 'Jan-Michael Franz' },
    { username: 'jorropo', name: 'Jorropo' },
    { username: 'kairozen', name: 'Geoffrey Baudelet' },
    { username: 'kedemferre', name: 'Kédem Ferré' },
    { username: 'kousha', name: 'Kousha Zanjani' },
    { username: 'krkk', name: 'Karol Kosek' },
    { username: 'landrok', name: 'Landrok' },
    { username: 'leeroyepold48', name: 'Leeroy Epold' },
    { username: 'm4sk1n', name: 'marcin mikołajczak' },
    { username: 'matograine', name: 'tom ngr' },
    { username: 'medow', name: 'Mahir Ahmed' },
    { username: 'mhu', name: 'Max Hübner' },
    { username: 'midgard', name: 'Midgard' },
    { username: 'nbrucy', name: 'N. B.' },
    { username: 'nitai', name: 'nitai bezerra' },
    { username: 'noncommutativegeo', name: 'Andrea Panontin' },
    { username: 'nopsidy', name: 'McFlat' },
    { username: 'nvivant', name: 'Nicolas Vivant' },
    { username: 'osoitz', name: 'Osoitz' },
    { username: 'outloudvi', name: 'Outvi V' },
    { username: 'quentin', name: 'Quentí' },
    { username: 'quentind', name: 'Quentin Dupont' },
    { username: 'rafaelff', name: 'Rafael Fontenelle' },
    { username: 'rigelk', name: 'Rigel Kent' },
    { username: 's8321414', name: 'Jeff Huang' },
    { username: 'sato_ss', name: 'Satoshi Shirosaka' },
    { username: 'sercom_kc', name: 'SerCom_KC' },
    { username: 'severo', name: 'Sylvain Lesage' },
    { username: 'silkevicious', name: 'Sylke Vicious' },
    { username: 'sosha', name: 'Sosha' },
    { username: 'spla', name: 'spla' },
    { username: 'strubbl', name: 'Sven' },
    { username: 'swedneck', name: 'Tim Stahel' },
    { username: 'tagomago', name: 'Tagomago' },
    { username: 'talone', name: 'TitiAlone' },
    { username: 'thibaultmartin', name: 'Thibault Martin' },
    { username: 'tirifto', name: 'Tirifto' },
    { username: 'tuxayo', name: 'Victor Grousset/tuxayo' },
    { username: 'unextro', name: 'Ondřej Pokorný' },
    { username: 'unzarida', name: 'unzarida' },
    { username: 'vincent', name: 'Vincent Laporte' },
    { username: 'wanhua', name: 'wanhua' },
    { username: 'xinayder', name: 'Alexandre' },
    { username: 'xosem', name: 'Xosé M.' },
    { username: 'zveryok', name: 'Nikitin Stanislav' },
    { username: '6543', name: '6543' },
    { username: 'aasami', name: 'Miroslav Ďurian' },
    { username: 'alidemirtas', name: 'Ali Demirtas' },
    { username: 'alpha', name: 'Alpha' },
    { username: 'ariasuni', name: 'Mélanie Chauvel' },
    { username: 'bfonton', name: 'Baptiste Fonton' },
    { username: 'c0dr', name: 'c0dr lnx' },
    { username: 'canony', name: 'canony' },
    { username: 'cat', name: 'Cat' },
    { username: 'clerie', name: 'Clemens Riese' },
    { username: 'curupira', name: 'Curupira' },
    { username: 'dhsets', name: 'djsets' },
    { username: 'digitalkiller', name: 'Digital Killer' },
    { username: 'dwsage', name: 'd.w. sage' },
    { username: 'flauta', name: 'Andrea Primiani' },
    { username: 'frankstrater', name: 'Frank Sträter' },
    { username: 'gillux', name: 'gillux' },
    { username: 'gunchleoc', name: 'GunChleoc' },
    { username: 'jaidedtd', name: 'Jenga Phoenix' },
    { username: 'joss2lyon', name: 'Josselin' },
    { username: 'kekkotranslates', name: 'Francesco' },
    { username: 'kingu', name: 'Allan Nordhøy' },
    { username: 'kittybecca', name: 'Rivka bat Tsvi' },
    { username: 'knuxify', name: 'knuxify' },
    { username: 'lapor', name: 'Kristijan Tkalec' },
    { username: 'laufor', name: 'Lau For' },
    { username: 'lstamellos', name: 'Loukas Stamellos' },
    { username: 'lw1', name: 'Lukas Winkler' },
    { username: 'mablr', name: 'Mablr' },
    { username: 'marcinmalecki', name: 'Marcin Małecki' },
    { username: 'mayana', name: 'Mayana' },
    { username: 'mikeorlov', name: 'Michael Orlov' },
    { username: 'nin', name: 'nz' },
    { username: 'norbipeti', name: 'NorbiPeti' },
    { username: 'ppnplus', name: 'Phongpanot Phairat' },
    { username: 'predatorix', name: 'Predatorix' },
    { username: 'robin', name: 'Robin Lahtinen' },
    { username: 'rond', name: 'rondnelly nunes' },
    { username: 'secreet', name: 'Secreet' },
    { username: 'sftblw', name: 'sftblw' },
    { username: 'sporiff', name: 'Ciarán Ainsworth' },
    { username: 'tekuteku', name: 'tekuteku' },
    { username: 'thecatjustmeow', name: 'Nguyen Huynh Hung' },
    { username: 'tmota', name: 'Tiago Mota' },
    { username: 'uranix', name: 'Michal Mauser' },
    { username: 'wakutiteo', name: 'Markel' },
    { username: 'wonderingdane', name: 'Nicolai Ireneo-Larsen' },
    { username: 'zeynepeliacik', name: 'Zeynep Can' }
  ]
}

function getContributorsBlacklist () {
  return {
    'Bigard Florian': true,
    'chocobozzz': true,
    'Rigel': true
  }
}
