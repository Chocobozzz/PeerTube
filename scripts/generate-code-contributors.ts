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

  let contributors = await getGitContributors()
  contributors = contributors.concat(getZanataContributors())
  contributors = contributors.filter(c => blacklist[c.username] !== true)

  console.log('# Code & Translators contributors\n')
  for (const contributor of contributors) {
    console.log(` * ${contributor.username}`)
  }

  {
    console.log('\n\n# Design\n')
    console.log(' * [Olivier Massain](https://dribbble.com/omassain)')

    console.log('\n\n# Icons\n')
    console.log(' * [Feather Icons](feathericons.com/) (MIT)')
    console.log(' * `playlist add`, `history`, `subscriptions`, `miscellaneous-services.svg` by Material UI (Apache 2.0)')
    console.log(' * `support` by Chocobozzz (CC-BY)')
    console.log(' * `language` by Aaron Jin (CC-BY)')
    console.log(' * `video-language` by Rigel Kent (CC-BY)')
    console.log(' * `peertube-x` by Solen DP (CC-BY)')
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
  return [ { username: 'abdhessuk', name: 'Abd Hessuk' }, { username: 'abidin24', name: 'abidin toumi' }, {
    username: 'aditoo',
    name: 'Lorem Ipsum'
  }, { username: 'alice', name: 'Alice' }, { username: 'anastasia', name: 'Anastasia' }, {
    username: 'autom',
    name: 'Filip Bengtsson'
  }, { username: 'balaji', name: 'Balaji' }, { username: 'bristow', name: 'Cédric F.' }, {
    username: 'butterflyoffire',
    name: 'ButterflyOfFire'
  }, { username: 'chocobozzz', name: 'Chocobozzz' }, { username: 'claichou', name: 'Claire Mohin' }, {
    username: 'degrange',
    name: 'Degrange Mathieu'
  }, { username: 'dibek', name: 'Giuseppe Di Bella' }, { username: 'edu', name: 'eduardo' }, {
    username: 'ehsaan',
    name: 'ehsaan'
  }, { username: 'esoforte', name: 'Ondřej Kotas' }, { username: 'fkohrt', name: 'Florian Kohrt' }, {
    username: 'giqtaqisi',
    name: 'Ian Townsend'
  }, { username: 'goofy', name: 'goofy' }, { username: 'gorkaazk', name: 'Gorka Azkarate Zubiaur' }, {
    username: 'gwendald',
    name: 'GwendalD'
  }, { username: 'h3zjp', name: 'h3zjp' }, { username: 'jfblanc', name: 'Joan Francés Blanc' }, {
    username: 'jhertel',
    name: 'Jean Hertel'
  }, { username: 'jmf', name: 'Jan-Michael Franz' }, { username: 'jorropo', name: 'Jorropo' }, {
    username: 'kairozen',
    name: 'Geoffrey Baudelet'
  }, { username: 'kedemferre', name: 'Kédem Ferré' }, { username: 'kousha', name: 'Kousha Zanjani' }, {
    username: 'krkk',
    name: 'Karol Kosek'
  }, { username: 'landrok', name: 'Landrok' }, { username: 'leeroyepold48', name: 'Leeroy Epold' }, {
    username: 'm4sk1n',
    name: 'marcin mikołajczak'
  }, { username: 'matograine', name: 'tom ngr' }, { username: 'medow', name: 'Mahir Ahmed' }, {
    username: 'mhu',
    name: 'Max Hübner'
  }, { username: 'midgard', name: 'Midgard' }, { username: 'nbrucy', name: 'N. B.' }, {
    username: 'nitai',
    name: 'nitai bezerra'
  }, { username: 'noncommutativegeo', name: 'Andrea Panontin' }, { username: 'nopsidy', name: 'McFlat' }, {
    username: 'nvivant',
    name: 'Nicolas Vivant'
  }, { username: 'osoitz', name: 'Osoitz' }, { username: 'outloudvi', name: 'Outvi V' }, {
    username: 'quentin',
    name: 'Quentí'
  }, { username: 'quentind', name: 'Quentin Dupont' }, { username: 'rafaelff', name: 'Rafael Fontenelle' }, {
    username: 'rigelk',
    name: 'Rigel Kent'
  }, { username: 's8321414', name: 'Jeff Huang' }, { username: 'sato_ss', name: 'Satoshi Shirosaka' }, {
    username: 'sercom_kc',
    name: 'SerCom_KC'
  }, { username: 'severo', name: 'Sylvain Lesage' }, { username: 'silkevicious', name: 'Sylke Vicious' }, {
    username: 'sosha',
    name: 'Sosha'
  }, { username: 'spla', name: 'spla' }, { username: 'strubbl', name: 'Sven' }, {
    username: 'swedneck',
    name: 'Tim Stahel'
  }, { username: 'tagomago', name: 'Tagomago' }, { username: 'talone', name: 'TitiAlone' }, {
    username: 'thibaultmartin',
    name: 'Thibault Martin'
  }, { username: 'tirifto', name: 'Tirifto' }, { username: 'tuxayo', name: 'Victor Grousset/tuxayo' }, {
    username: 'unextro',
    name: 'Ondřej Pokorný'
  }, { username: 'unzarida', name: 'unzarida' }, { username: 'vincent', name: 'Vincent Laporte' }, {
    username: 'wanhua',
    name: 'wanhua'
  }, { username: 'xinayder', name: 'Alexandre' }, { username: 'xosem', name: 'Xosé M.' }, {
    username: 'zveryok',
    name: 'Nikitin Stanislav'
  }, { username: '6543', name: '6543' }, { username: 'aasami', name: 'Miroslav Ďurian' }, {
    username: 'alidemirtas',
    name: 'Ali Demirtas'
  }, { username: 'alpha', name: 'Alpha' }, { username: 'ariasuni', name: 'Mélanie Chauvel' }, {
    username: 'bfonton',
    name: 'Baptiste Fonton'
  }, { username: 'c0dr', name: 'c0dr lnx' }, { username: 'canony', name: 'canony' }, {
    username: 'cat',
    name: 'Cat'
  }, { username: 'clerie', name: 'Clemens Riese' }, { username: 'curupira', name: 'Curupira' }, {
    username: 'dhsets',
    name: 'djsets'
  }, { username: 'digitalkiller', name: 'Digital Killer' }, { username: 'dwsage', name: 'd.w. sage' }, {
    username: 'flauta',
    name: 'Andrea Primiani'
  }, { username: 'frankstrater', name: 'Frank Sträter' }, { username: 'gillux', name: 'gillux' }, {
    username: 'gunchleoc',
    name: 'GunChleoc'
  }, { username: 'jaidedtd', name: 'Jenga Phoenix' }, { username: 'joss2lyon', name: 'Josselin' }, {
    username: 'kekkotranslates',
    name: 'Francesco'
  }, { username: 'kingu', name: 'Allan Nordhøy' }, { username: 'kittybecca', name: 'Rivka bat Tsvi' }, {
    username: 'knuxify',
    name: 'knuxify'
  }, { username: 'lapor', name: 'Kristijan Tkalec' }, { username: 'laufor', name: 'Lau For' }, {
    username: 'lstamellos',
    name: 'Loukas Stamellos'
  }, { username: 'lw1', name: 'Lukas Winkler' }, { username: 'mablr', name: 'Mablr' }, {
    username: 'marcinmalecki',
    name: 'Marcin Małecki'
  }, { username: 'mayana', name: 'Mayana' }, { username: 'mikeorlov', name: 'Michael Orlov' }, {
    username: 'nin',
    name: 'nz'
  }, { username: 'norbipeti', name: 'NorbiPeti' }, { username: 'ppnplus', name: 'Phongpanot Phairat' }, {
    username: 'predatorix',
    name: 'Predatorix'
  }, { username: 'robin', name: 'Robin Lahtinen' }, { username: 'rond', name: 'rondnelly nunes' }, {
    username: 'secreet',
    name: 'Secreet'
  }, { username: 'sftblw', name: 'sftblw' }, { username: 'sporiff', name: 'Ciarán Ainsworth' }, {
    username: 'tekuteku',
    name: 'tekuteku'
  }, { username: 'thecatjustmeow', name: 'Nguyen Huynh Hung' }, { username: 'tmota', name: 'Tiago Mota' }, {
    username: 'uranix',
    name: 'Michal Mauser'
  }, { username: 'wakutiteo', name: 'Markel' }, {
    username: 'wonderingdane',
    name: 'Nicolai Ireneo-Larsen'
  }, { username: 'zeynepeliacik', name: 'Zeynep Can' } ]
}

function getContributorsBlacklist () {
  return {
    'Bigard Florian': true,
    'chocobozzz': true,
    'Rigel': true
  }
}
