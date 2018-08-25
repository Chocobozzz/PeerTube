<h1 align="center">
  PeerTube
</h1>

<p align="center">
Federated (ActivityPub) video streaming platform using P2P (BitTorrent)
directly in the web browser with <a href="https://github.com/feross/webtorrent">WebTorrent</a>.
</p>

<p align="center">
<strong>We have run <a href="https://www.kisskissbankbank.com/en/projects/peertube-a-free-and-federated-video-platform">a crowdfunding campaign</a> to pave the road to version 1.0 of PeerTube. Thanks to everyone who pitched in and shared the news around. You can now check out <a href="https://github.com/Chocobozzz/PeerTube/milestone/1">the corresponding milestone</a> and help its development!</strong>
</p>

<p align="center">
  <strong>Client</strong>

  <br />

  <a href="https://david-dm.org/Chocobozzz/PeerTube?path=client">
    <img src="https://david-dm.org/Chocobozzz/PeerTube.svg?path=client" alt="Dependency Status" />
  </a>

  <a href="https://david-dm.org/Chocobozzz/PeerTube?path=client&type=dev">
    <img src="https://david-dm.org/Chocobozzz/PeerTube/dev-status.svg?path=client" alt="devDependency Status" />
  </a>
  
  <a href="https://www.browserstack.com/automate/public-build/VXBPc0szNjUvRUNsREJQRFF6RkEvSjJBclZ4VUJBUm1hcS9RZGpUbitRST0tLWFWbjNEdVN6eEZpYTk4dGVpMkVlQWc9PQ==--644e755052bf7fe2346eb6e868be8e706718a17c%">
    <img src='https://www.browserstack.com/automate/badge.svg?badge_key=VXBPc0szNjUvRUNsREJQRFF6RkEvSjJBclZ4VUJBUm1hcS9RZGpUbitRST0tLWFWbjNEdVN6eEZpYTk4dGVpMkVlQWc9PQ==--644e755052bf7fe2346eb6e868be8e706718a17c%'/>
  </a>
</p>

<p align="center">
  <strong>Server</strong>

  <br />

  <a href="https://travis-ci.org/Chocobozzz/PeerTube">
    <img src="https://travis-ci.org/Chocobozzz/PeerTube.svg?branch=develop" alt="Build Status" />
  </a>

  <a href="https://david-dm.org/Chocobozzz/PeerTube">
    <img src="https://david-dm.org/Chocobozzz/PeerTube.svg" alt="Dependencies Status" />
  </a>

  <a href="https://david-dm.org/Chocobozzz/PeerTube?type=dev">
    <img src="https://david-dm.org/Chocobozzz/PeerTube/dev-status.svg" alt="devDependency Status" />
  </a>

  <a href="http://standardjs.com/">
    <img src="https://img.shields.io/badge/code%20style-standard-brightgreen.svg" alt="JavaScript Style Guide" />
  </a>
</p>

<br />

<p align="center">
  <a href="https://peertube.cpy.re">
    <img src="https://lutim.cpy.re/mRdBAdeD.png" alt="screenshot" />
  </a>
</p>

## Getting Started

  * **[Website](https://joinpeertube.org)**
  * **[Instances list](https://instances.joinpeertube.org)**
  * Chat:
    * IRC : **[#peertube on chat.freenode.net:6697](https://kiwiirc.com/client/irc.freenode.net/#peertube)**
    * Matrix (bridged on the IRC channel) : **[#peertube:matrix.org](https://matrix.to/#/#peertube:matrix.org)**

## Demonstration

Want to see it in action?

   * Demonstration servers:
     * [peertube.cpy.re](https://peertube.cpy.re)
     * [peertube2.cpy.re](https://peertube2.cpy.re)
     * [peertube3.cpy.re](https://peertube3.cpy.re)
   * [Video](https://framatube.org/videos/watch/217eefeb-883d-45be-b7fc-a788ad8507d3) What is PeerTube?
   * [Video](https://peertube.cpy.re/videos/watch/f78a97f8-a142-4ce1-a5bd-154bf9386504)
     to see what the "decentralization feature" looks like
   * [Video](https://peertube.cpy.re/videos/watch/da2b08d4-a242-4170-b32a-4ec8cbdca701) to see
   the communication between PeerTube and [Mastodon](https://github.com/tootsuite/mastodon)

## Why

We can't build a FOSS video streaming alternative to YouTube, Dailymotion,
Vimeo... with centralized software. One organization alone may not have
enough money to pay for bandwidth and video storage of its servers.

So we need to have a decentralized network of servers seeding videos (as
[Diaspora](https://github.com/diaspora/diaspora) for example).  But it's not
enough because one video could become famous and overload the server.  That is 
why we need to use a P2P protocol to limit the server load.  Thanks to
[WebTorrent](https://github.com/feross/webtorrent), we can make P2P (thus
BitTorrent) inside the web browser, as of today.

## Dependencies

  * nginx
  * PostgreSQL
  * **Redis >= 2.8.18**
  * **NodeJS >= 8.x**
  * yarn
  * OpenSSL (cli)
  * **FFmpeg >= 3.x**

## Run in production

See the [production guide](/support/doc/production.md).

## Run on YunoHost
[![Install Peertube with YunoHost](https://install-app.yunohost.org/install-with-yunohost.png)](https://install-app.yunohost.org/?app=peertube)

Peertube app for [YunoHost](https://yunohost.org). See [here](https://github.com/YunoHost-Apps/peertube_ynh).

## Run using Docker

See the [docker guide](/support/doc/docker.md).

## Contribute/Translate/Test

See the [contributing
guide](/.github/CONTRIBUTING.md)
to see how to test or contribute to PeerTube (write documentation, translate, develop...). Spoiler alert: you don't need to be a
coder to help!

## API REST documentation

Quick Start: [/support/doc/api/quickstart.md](/support/doc/api/quickstart.md)

Endpoints documentation:

 * HTML version: [/support/doc/api/html/index.html](https://htmlpreview.github.io/?https://github.com/Chocobozzz/PeerTube/blob/develop/support/doc/api/html/index.html)
 * Swagger/OpenAPI schema: [/support/doc/api/openapi.yaml](/support/doc/api/openapi.yaml)

## Tools

 * [Import videos (YouTube, Dailymotion, Vimeo...)](/support/doc/tools.md)
 * [Upload videos from the CLI](/support/doc/tools.md)
 * [Admin server tools (create transcoding jobs, prune storage...)](https://github.com/Chocobozzz/PeerTube/blob/develop/support/doc/tools.md#server-tools)

## FAQ

If you have a question, please try to find the answer in the [FAQ](/FAQ.md) first.

## Architecture

See [ARCHITECTURE.md](/ARCHITECTURE.md) for a more detailed explanation.

### Backend

  * The backend is a REST API.
  * Servers communicate with each other with [Activity
    Pub](https://www.w3.org/TR/activitypub/).
  * Each server has its own users who query it (search videos, query where the
    torrent URI of this specific video is...).
  * If a user uploads a video, the server seeds it and sends its followers some
    metadata (name, short description, torrent URI...).
  * A server is a tracker responsible for all the videos uploaded on it.
  * Even if nobody watches a video, it is seeded by the server (through
    [WebSeed protocol](http://www.bittorrent.org/beps/bep_0019.html)) where the
    video was uploaded.

Here are some simple schemes:

<p align="center">

<img src="https://lutim.cpy.re/6Qut3ure.png" alt="Decentralized" />

<img src="https://lutim.cpy.re/NvRAcv6U.png" alt="Watch a video" />

<img src="https://lutim.cpy.re/pqKm3Q5S.png" alt="Watch a P2P video" />

</p>

## Supports of our crowdfunding

Quonfucius, IP Solution, \_Laure\_, @lex666, 0x010C, 3dsman, 3rw4n-G3D, aallrd, Abel-Berger, Adam-Odell, adechambost, adim, adngdb, Adrien Thurotte, Adrien-BARAN, Adrien-Hamraoui, Adrien-Horcholle, Adrien-Luxey, Adrien-Polar, Adrien-Touminet, Agathe Begault, Agence-Différente, Ahmed-Al-Ahmed, aiprole, akpoptro, Al-Nimr, Alain-Delgrange, Alain-Fyon, Alain-Girard, Alain-MICHEL, Aleksandar-Aleksandrov, Alex-Chancellé, Alex-Dufournet, Alex-Gleason, Alexander-Murray-Watters, Alexandre-Alapetite, Alexandre-Badez, Alexandre-Giuliani, Alexandre-Mercier, Alexandre-Roux-2, Alexandre-SIMON, Alexandre29, Alexia-Monsavoir, Alexis-Frn, Alexis-Gros, Alexis-Kauffmann, alfajet, Alias, alinemont, Aliocha-Lang, Alllightlong, aloisdg, Amanda Hinault, André-Rabe, Anne-PROTAS, antoine, Antoine Derouin, Antoine-Beauvillain, Antoine-Deléron, antomoro, Antón López, Antonin-DENIS, Antonin-Segault, aokami, Apichat-Apichat, Ar-To, ARIAS-Frédéric-2, ariasuni, Aris-Papathéodorou, Arnaud -Vigoureux , Arnaud-Mounier, Arnaud-Risler, Arnaud-Vigouroux, Arnulf, Arthur-Bellier, arthur-bello, Arthur-Charron, Arthur-De Kimpe, Arthur.Ball, Arthur.Frin, Arvi-LEFEVRE, athanael.fr, auber38, Auguste Psqr, Aurélien-Tamisier, Avel-Musicavel, axel-guegant, Axel-Plat, Aymeric-Dlv, Ayst, Azenilion, Bandino, baptiste-lemoine, Baptiste-Rochez, baruica, Bastien-Dangin, batlab, bcourtine, Bea-Schaack-2, beaufils, beaumme, Belmont1, Ben-Geeraerts, Ben-Meijering, Benjamin-Baratta, Benjamin-Roussel, Benoît Joffre, Benoîtdd, Bernard-Legrand, Bernard-Vauquelin, Bernhard-Hayden, bertrand.arlabosse, bigsicret, bjg, bnjbvr, bob\_isat, bobstechsite, Bolton-Allan, Boov', Boris-ARGAUD, Brice.Francois, broz42, Bruno Lefèvre, Bruno-Douville, Bruno-Fortabat, Bruno-Gadaleta, Bruno-VASTA, Bumblebee, Butchcassidy, Cadiou-Christophe, calendros, Candy-Ming, cappitaine, Carmen-Drocourt, carrigns, case, Cathy-Barbet, CBach, ccazin, Cecile-Obernesser, Cecilia-:), Cédric-Bleschet, Cédric.Bayle, Cestdoncvrai, cgay, champ contrechamp, chapa, charlerlin, charles-jacquin, Charlie-Duclut, charlotte-cgondre78, Chris-Doe, chris-louba, Christel-Berthelot, Christian-FERRARIS, christiannavelot, Christophe-Bastin, christophe-beziers la fosse, Christophe-Pieret, Christophe-Verhaege, christophec, Christopher-Bero, chtfn, chud, Claire-C, clairezed, Claude-POUGHEON, Clément-Hubert, Clément-Morelle, clydeb, Comamanel, Côme Chilliet, Confederac.io, Consulting-AZAPTEC, Corentin3892, CryoGen, cyp, Cypher-Goat, Cyril, Cyril\_M\_, Cyril-MONMOUTON, Cyril-Waechter, Damien-Gabard, Damien-Garaud, Dams3132, Daniel Kuebler, Daniel Waxweiler, Daniel-Bartsch, Daniel-PIPALA, Daniel-Struck, Daniel-Thul, Danny-Joerger, DansLeRuSH, DantSu, Dany-Marcoux, Daouzli-Adel, Darfeld, Darth\_Judge, Dashcom, David-BADOIL, David-Benoist, David-Dormoy, David-Gil-2, David-Velasco, David-Wagner, David-writ, davlgd, davyg2, dbudo72300, de Folleville -Matthieu , DeBugs, Denis-Lecourtiller, Denis-Vannier, Desmu, Didier-Bove, Diego-Crespo, Dimitri-Stouney, dino, Dinosaure, Doc Skellington, Dominique-Brun, dr4Ke, DreamClassier, DRogueRonin, dussydelf, Dylan-Moonfire, Ealhad, Edouard-SCHWEISGUTH, Elanndelh--, ElodieEtJimmy, Éloi-Rivard, Elric-Noel, Elwan-Héry, Emilie-Wietzke, Emilien-Ghomi, eparth, Eric-Bouhana, Eric-Hendricks, Eric.Vales, Erwan-Moreau, Erzender, ESS\_Clem, Etienne-Baqué, Etienne-Botek, Etienne-Lmn, Ex-Serv, fabeveynes, Fabien BERINI ( Rehvaro ) , Fabien Freling, Fabien-Roualdes, Fabien.Abraini, Fabien.Bonneval, fabrice-simon, farlistener, Felix-ROBICHON, FelixDouet, FHE, Fiamoa-McBenson, flamwenco, Flopômpôm, FloraGC, Florent-Deschamps, Florent-Fayolle, Florent-Mallet, Florent-Vasseur, Florent.Duveau, Florestan Fournier, Florian Kohrt, Florian-Bellafont, Florian-Douay, Florian-LE GOFF, Florian-Siegenthaler, Florian.Freyss, fobrice, FOKUZA, Fol-De Dol, FP45, Francis.Moraud, François-Dambrine, François-Deguerry, Francois-Goer, François-Lecomte, François-Lemaire, François-Malterre, François-MORLET, François-Schoubben, François-Xavier-Davanne, François-Zajéga, francois.peyratout, Frathom, Fred-Fred-2, Frédéric GUÉLEN, Frédéric-Blumstein, Frédéric-Meurou, Frederic-Reynaud, Frédéric-Sagot, Frek, FrenchHope, freyja, FugazziPL, Funky-Whale, Gabriel-Devillers, Gabriel-Mirété, Galedas, GardoToF, Gaspard-Kemlin, GauthierPLM, Gauvain "GovanifY" Roussel-Tarbouriech, Gavy, gdquest, Geek Faëries, Geneviève-Perello, Geoffroy-MANAUD, Geojulien, Georges-Dutreix, Georges-Sempéré, Gerald-Vannier, Gérard-Brasquet, Gérard-Sensevy, Gerrit-Großkopf, GGBNM, Ghislain-Fabre, Gil-Felot, Gilles-Brossier, Gilles-Moisan, Gilles-SACLIER, Gilles-Trossevin, Gilou, GinGa, ginkgopr, glazzara, Glen-Lomax, Gof, Gonçalves-Daniel, goofy-goofy, grandlap, GRAP-Groupement Régional Alimentaire de Proximité, greg-chapuis, Grégoire-Delbeke, Grégory-Becq, Grégory-Goulaouic, Gregouw, Grizix, GrosCaillou, Grummfy, grumph, guiaug, Guillaume-Allart, Guillaume-Chambert, Guillaume-Chaslot, Guillaume-David, Guillaume-Duc, Guillaume-Gay, Guillaume-Lecoquierre, Guillaume007, guillaumefavre, Guiraud-Dominique, Guy-Torreilles, GwendalL, gwlolos, Hanna-E, Hanno-Wagner, Harald-Eilertsen, Harpocrate, Hebus82, Hellmut, Henri-ROS, hervelc, hguilbert, Hisham-Muhammad, Hoang-Mai-Lesaffre, Homerc, homosapienssapiens, hoper, Hoshin, Hugo-Lagouge, Hugo-SIMANCAS, Hugo-Simon, Hylm, IchbinRob, Ivan-Ogai, Ivan.D'halluin, Ivar-Troost, J-C-2, Jacques-Roos, James-Moore, James-Valleroy, Jan-Aagaard, Jan-Keromnes, Jancry, Janko-Mihelić, jano31coa, Jboot, jcgross, Jean CHARPENTIER, jean claude-skowron, Jean Dos, jean luc-PERROT, Jean-Baptiste-Maneyrol, Jean-charles-Surbayrole, Jean-claude-Jouanne, jean-dreyfus, jean-FISCHER, JEAN-FRANCOIS-BOUDEAU, Jean-Francois-Ducrot, Jean-François-PETITBON, Jean-François-Tomasi, Jean-Galland, Jean-louis-Bergamo, Jean-Luc-PIPO, Jean-Marie-Graïc, Jean-Martin Laval, Jean-Noel-Bruletout, Jean-Paul-GIBERT, Jean-Paul-Lescat, jean-philippe-bénétrix, Jean-Philippe-Eisenbarth, Jean-Philippe-Renaudet, Jean-Philippe-Rennard, Jean-Sébastien-Renaud, Jean-Yves Kiger, Jean-Yves-DUPARC, Jeanne-Corvellec, jeansebastien, Jelv, Jérémie -Wach, Jeremie-Lestel, Jérémy-Korwin, Jérôme-Avond, Jerome-Bu, Jerome-Denis, Jérôme-ISNARD, jerome-simonato, JeromeD, Jery, Jezza, Jim-McDoniel, jl-M-2, jlanca, jlcpuzzle, jn-m, jnthnctt, joakim.faiss, Joe-Riche, Joévin-SOULENQ, Johann-FONTAINE, John-Devor, John-Doe, Jojo-Boulix, Jonas-Aparicio, Jonathan-Dollé, Jonathan-Kohler, Jonathan-LAURENT, Jos-van den Oever, Joseph-Lawson, Jozef-Knaperek, jroger, ju, jubarbu, Julianoe-G, Julie-Bultez, Julien Loudet, Julien Maulny (alcalyn), Julien-AILHAUD, Julien-Aubin, Julien-Biaudet, Julien-Bréchet, Julien-Cochennec, Julien-Duroure, Julien-Huon, Julien-Lemaire, Julien-Weber, jyb, K-\_, KalambakA, Kanor, kari-kimber, Karim-Jouini, karl-bienfait, Kdecherf, Keplerpondorskell, kevin-Beranger, Kevin-Nguyen, King-Of Peons, Kioob, kloh, kokoklems, Konstantin-Kovar, Kriĉjo, Kyâne-PICHOU, L'elfe-Sylvain, La Gonz, Lara-Dufour, lareinedeselfes, Laurence-Giroud, laurent-fuentes, Laurent-HEINTZ, Laurent-PICQUENOT, ldubost, lebidibule, LeChi, LeDivinBueno, Legrave, Les Assortis, Leyokki-Tk, LibreEnFete-en Tregor, LilO. Moino, Liloumuloup, Linuxine-T, lionel-lachaud, Lionel-Schinckus, Loïc-L'Anton, Loïc.Guérin, Louis-Gatin, Louis-Marie-BAER, Louis-Rémi.Babé, Louis-Roche, Louisclement, Lu, ludovic-lainard, Ludovic-Pénet, Lukas-Steiblys, lusoheart, Mad Sugar, maguy-giorgi, mahen, maiido, Malphas, ManetteBE, Manon-Amalric, Manuel-Vazquez, ManuInzesky, Manumerique, Marc-BESSIERES, Marc-DUFOURNET, Marc-GASSER, Marc-Honnorat, marc-wilzius, marc.ribault.1, Marco-Heisig, Marie-PACHECO, Marien-Fressinaud, Marius-Lemonnier, Mark-O'Donovan, marliebo, marmat8951, mart1n, martensite, Mathdatech, Mathias-Bocquet, Mathieu-Amirault, Mathieu-B., Mathieu-Cornic, Mathieu-VIRAMAN, Matías-Pérez, Matilin-Torre, matt.faure, Mattéo-Delabre, Matthias-Devlamynck, Matthieu-Bollot, Matthieu-De Beule, Matthieu-DEVILLERS, Matthieu-Dupont de Dinechin, Matthieu-Gaudé, Matthieu-Sauboua-Beneluz, matthieublanco, MatthieuSchneider, Max-PENY, Maxime-de WYROW, Maxime-Desjardin, Maxime-Forest, maxime-haag, Maxime-Mangel, Maximilian Praeger, Mayeul-Cantan, Mayeul-Guiraud, mcg1712, metalvinze, Mewen, mheiber, Michael-Koppmann, Michael-Loew, Michael-Q. Bid, Michal-Herda, Michal-Noga, Michel-DUPONT, Michel-Le Lagadec, Michel-POUSSIER, Michel-Roux, Mickaël-Gauvin, Mickael-Liegard, MicMP3Man, Miguel-de la Cruz, Mike-Kasprzak, Mimon-Lapompe, Mister-Ocelot, mjhvc, Moutmout, MouTom, MP, mphdp, Mr-Tea, msellebulle, Mushussu, mylainos, nanouckd, Nasser-Debruyere, Nat-Tuck, Nathan.B, nayya, nazgulz666, Neal-Wilson, neeev, neodarz-neodarz, NepsKi, Nestorvep, NHenry, Nialix, NicoD, Nicolas-Auvray, nicolas-k, Nicolas-Pinault, Nicolas-Ruffel, NicolasCARPi, nicolaslegland, niconil, Niles, nitot, Nono1965, Norbert, Norde, Numcap, obergix, Obrow, Okki, Olivier-Calzi, Olivier-Ganneval, Olivier-Marouzé, Olivier-Mondoloni, olivier-pierret, Oncela-Petit Chat, Óskar-Sturluson, p3n15634n7, Paindesegle, Pas De-Panique, Pascal-BLEUSE, Pascal-Larramendy, Patrice-Jabeneau, patrice-maertens, patrick-bappel, PATRICK-GRANDIN, Patrick-MERCIER, Patrickl , Paul-Härle, Paul-Tardy, pbramy, Pedro-CADETE, Perrine-de Coëtlogon, Peter\_Fillgod, Petter-Joelson, Philippe-BATTMANN, Philippe-Cabaud, Philippe-Debar, philippe-giffard, Philippe-Lallemant, Philippe-Le Van, philippe-lhardy, Philippe-Thébault, Philippe-VINCENT-2, PhilOGM, Pierre 'catwell' Chapuis, Pierre Gros, Pierre-Antoine-Champin, Pierre-Bresson-2, Pierre-d'Alençon, Pierre-Equoy, Pierre-Girardeau, Pierre-Houmeau, Pierre-Marijon, Pierre-petch, Pierrick-Couturier, Pilou-CaraGk, Piotr-Miszczak, Pla, Plastic Yogi, PME2050, pmiossec, Pofilo, Polioman, Polios63, Poutchiny, PRALLET-Claude, PtrckVllnv, Pulov Yuran, queertube, Quentin-Dugne, Quentin-PAGÈS, ra-mon, Radhwan-Ben Madhkour, Raphaël-Brocq, Raphaël-Grolimund, Raphaël-Piédallu, raphane, Raphip, Raven, Raymond-Lutz, Razael, Rebecca-Breu, Remi-Durand, Rémi-Herrmann, Rémi-Verschelde, Remigho, Remix-the commons, Remy-Grauby, Rémy-Pradier, Renaud-Vincent, rgggn, rigelk, rip, Rivinbeg, Robert-Riemann, Robin Biechy, Roger-FRATTE, roipoussiere, Rolindes-Arroyo, Romain Théry-Hermain, Romain-Bouyé, Romain-Ortiz, RomainVENNE, Romuald-EYRAUD, royhome, Rudy-aparicio, Rusty-Dwyer, rverchere, sajous.net, Salah-ZERGUI, Sam-R, Samh, Samuel Tardieu, Samuel-FAYET, Samuel-Verschelde, Sanpi, Sascha-Brendel, Schwartz, Se7h, Sebastiaan-Glazenborg, Sebastian-Hugentobler, Sébastien Adam, Septie, Ser Eole, Severin-Suveren, severine-roger, shlagevuk-shlagevuk, Siegfried-Ehret, Simon-Hemery, Simon-Larcher, Simon-Reiser, Simounet, Siri-Louie, sissssou, skarab, Skurious, skynebula, Sohga-Sohga, Solène-Rapenne, solinux, Sophie-Imbach , Sosthen, Spiderweak, Stanislas-ANDRE, Stanislas-Michalak, starmatt, Steef, Stefan-Petrovski, Stéphane-Girardon, Stéphanie-Baltus, Stev-3d, Stoori, SuckyStrike, Sufflope, Sulfurax, SundownDEV, Swann-Fournial, Syk, Syluban, Sylv1c, Sylvain Bellone, Sylvain P, Sylvain\_M, Sylvain-Cazaux, Sylvain-GLAIZE, sylvain.arrachart, Sylvestre Ledru, sylvie-boutet, Sylvie-TORRES, tael67, tang35, tangi\_b, Tarulien, Taunya-Debolt, Tazimut-Khaelyor, terry-maire, Thanaen, Thatoo, Théophile-Noiré, Thibault-Vlieghe, Thierry-Chancé, Thierry-Fenasse, Thomas-Aurel, Thomas-CALVEZ, thomas-constans, Thomas-Kuntz, thomassin-loucas, Thosbk, ticosc, Tim-Albers, Tinapa -Itastri, TkPx, TM, tnntwister, TomR, Tomus, Tonio-Bilos, tony-carnide, Toover, toto-leroidelasaucisse, ToumToum, TP., trigrou, Tristan-Porteries, Tryph, Tursiops, tzilliox, U-&\_\`HbAAe4onnpN9!e+/#42\*5>k^E, Ulrich-Norbisrath, Un Sur Quatre, Valerio-Paladino, Valerio-Pilo, Valeryan\_24, Valou69, Vegattitude, Velome, Vergogne, Vero-Pajot, vianneyb, Victo-Sab, Victor -Hery, Victorien-Labalette, Vincent-Corrèze, Vincent-Fromentin, Vincent-Lamy, Vincent-Lasseur, VINCENT-PEYRET, vmorel, Walter-van Holst, Watsdesign, Wesley-Moore, williampolletdev, win100, wyk, Xaloc-Xaloc, Xavier ALT, Xavier-Chantry, Xavier-Godard, XoD, Yaaann, Yann-Delaunoy, Yann-Nave, yannick-grenzinger, yanselmetti, Ykatsot, Yohann-Bacha, yopox, Youen-Toupin, Yves-Caniou, Yves-Gerech, zar-rok, ZeBlackPearl, ZeGreg


## License

Copyright (C) 2018 PeerTube Contributors

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or 
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
