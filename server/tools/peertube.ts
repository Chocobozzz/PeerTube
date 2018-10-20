#!/usr/bin/env node

import * as program from 'commander'
import {
  version,
  getSettings
} from './cli'

program
  .version(version, '-v, --version')
  .usage('[command] [options]')

/* Subcommands automatically loaded in the directory and beginning by peertube-* */
program
  .command('auth [action]', 'register your accounts on remote instances to use them with other commands')
  .command('upload', 'upload a video').alias('up')
  .command('import-videos', 'import a video from a streaming platform').alias('import')
  .command('get-access-token', 'get a peertube access token', { noHelp: true }).alias('token')
  .command('watch', 'watch a video in the terminal ✩°｡⋆').alias('w')
  .command('repl', 'initiate a REPL to access internals')

/* Not Yet Implemented */
program
  .command('plugins [action]',
           'manage plugins on a local instance',
           { noHelp: true } as program.CommandOptions
          ).alias('p')
  .command('diagnostic [action]',
           'like couple therapy, but for your instance',
           { noHelp: true } as program.CommandOptions
          ).alias('d')
  .command('admin',
           'manage an instance where you have elevated rights',
          { noHelp: true } as program.CommandOptions
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
  /     \_."   " ") | ).-""---''--
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
  --/---"---" "-) )---- by Chocobozzz et al.`)
}

getSettings()
  .then(settings => {
    const state = (settings.default === undefined || settings.default === -1) ?
      'no instance selected, commands will require explicit arguments' :
      ('instance ' + settings.remotes[settings.default] + ' selected')
    program
      .on('--help', function () {
        console.log()
        console.log('  State: ' + state)
        console.log()
        console.log('  Examples:')
        console.log()
        console.log('    $ peertube auth add -u "PEERTUBE_URL" -U "PEERTUBE_USER" --password "PEERTUBE_PASSWORD"')
        console.log('    $ peertube up <videoFile>')
        console.log('    $ peertube watch https://peertube.cpy.re/videos/watch/e8a1af4e-414a-4d58-bfe6-2146eed06d10')
        console.log()
      })
      .parse(process.argv)
  })
