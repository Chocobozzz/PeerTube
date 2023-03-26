#!/usr/bin/env node

import { CommandOptions, program } from 'commander'
import { getSettings, version } from './shared'

program
  .version(version, '-v, --version')
  .usage('[command] [options]')

/* Subcommands automatically loaded in the directory and beginning by peertube-* */
program
  .command('auth [action]', 'register your accounts on remote instances to use them with other commands')
  .command('upload', 'upload a video').alias('up')
  .command('import-videos', 'import a video from a streaming platform').alias('import')
  .command('get-access-token', 'get a peertube access token', { noHelp: true }).alias('token')
  .command('plugins [action]', 'manage instance plugins/themes').alias('p')
  .command('redundancy [action]', 'manage instance redundancies').alias('r')

/* Not Yet Implemented */
program
  .command(
    'diagnostic [action]',
    'like couple therapy, but for your instance',
    { noHelp: true } as CommandOptions
  ).alias('d')
  .command('admin',
    'manage an instance where you have elevated rights',
    { noHelp: true } as CommandOptions
  ).alias('a')

// help on no command
if (!process.argv.slice(2).length) {
  const logo = '░P░e░e░r░T░u░b░e░'
  console.log(`
  ___/),.._                           ` + logo + `
/'   ,.   ."'._
(     "'   '-.__"-._             ,-
\\'='='),  "\\ -._-"-.          -"/
      / ""/"\\,_\\,__""       _" /,-
     /   /                -" _/"/
    /   |    ._\\\\ |\\  |_.".-"  /
   /    |   __\\)|)|),/|_." _,."
  /     \\_."   " ") | ).-""---''--
 (                  "/.""7__-""''
 |                   " ."._--._
 \\       \\ (_    __   ""   ".,_
  \\.,.    \\  ""   -"".-"
   ".,_,  (",_-,,,-".-
       "'-,\\_   __,-"
             ",)" ")
              /"\\-"
            ,"\\/
      _,.__/"\\/_                     (the CLI for red chocobos)
     / \\) "./,  ".
  --/---"---" "-) )---- by Chocobozzz et al.\n`)
}

getSettings()
  .then(settings => {
    const state = (settings.default === undefined || settings.default === -1)
      ? 'no instance selected, commands will require explicit arguments'
      : 'instance ' + settings.remotes[settings.default] + ' selected'

    program
      .addHelpText('after', '\n\n  State: ' + state + '\n\n' +
        '  Examples:\n\n' +
        '    $ peertube auth add -u "PEERTUBE_URL" -U "PEERTUBE_USER" --password "PEERTUBE_PASSWORD"\n' +
        '    $ peertube up <videoFile>\n'
      )
      .parse(process.argv)
  })
  .catch(err => console.error(err))
