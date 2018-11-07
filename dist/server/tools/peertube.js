#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const program = require("commander");
const cli_1 = require("./cli");
program
    .version(cli_1.version, '-v, --version')
    .usage('[command] [options]');
program
    .command('auth [action]', 'register your accounts on remote instances to use them with other commands')
    .command('upload', 'upload a video').alias('up')
    .command('import-videos', 'import a video from a streaming platform').alias('import')
    .command('get-access-token', 'get a peertube access token', { noHelp: true }).alias('token')
    .command('watch', 'watch a video in the terminal ✩°｡⋆').alias('w')
    .command('repl', 'initiate a REPL to access internals');
program
    .command('plugins [action]', 'manage plugins on a local instance', { noHelp: true }).alias('p')
    .command('diagnostic [action]', 'like couple therapy, but for your instance', { noHelp: true }).alias('d')
    .command('admin', 'manage an instance where you have elevated rights', { noHelp: true }).alias('a');
if (!process.argv.slice(2).length) {
    const logo = '░P░e░e░r░T░u░b░e░';
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
  --/---"---" "-) )---- by Chocobozzz et al.`);
}
cli_1.getSettings()
    .then(settings => {
    const state = (settings.default === undefined || settings.default === -1) ?
        'no instance selected, commands will require explicit arguments' :
        ('instance ' + settings.remotes[settings.default] + ' selected');
    program
        .on('--help', function () {
        console.log();
        console.log('  State: ' + state);
        console.log();
        console.log('  Examples:');
        console.log();
        console.log('    $ peertube auth add -u "PEERTUBE_URL" -U "PEERTUBE_USER" --password "PEERTUBE_PASSWORD"');
        console.log('    $ peertube up <videoFile>');
        console.log('    $ peertube watch https://peertube.cpy.re/videos/watch/e8a1af4e-414a-4d58-bfe6-2146eed06d10');
        console.log();
    })
        .parse(process.argv);
});
//# sourceMappingURL=peertube.js.map