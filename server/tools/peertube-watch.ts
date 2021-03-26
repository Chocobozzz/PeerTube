import { registerTSPaths } from '../helpers/register-ts-paths'
registerTSPaths()

import * as program from 'commander'
import { join } from 'path'
import { execSync } from 'child_process'

program
  .name('watch')
  .arguments('<url>')
  .addOption(
    new program.Option('-g, --gui <player>', 'player type')
      .default('vlc')
      .choices([ 'airplay', 'stdout', 'chromecast', 'mpv', 'vlc', 'mplayer', 'xbmc' ])
  )
  .option('-r, --resolution <res>', 'video resolution', '480')
  .addHelpText('after', '\n\n  Examples:\n\n' +
    '    $ peertube watch -g mpv https://peertube.cpy.re/videos/watch/e8a1af4e-414a-4d58-bfe6-2146eed06d10\n' +
    '    $ peertube watch --gui stdout https://peertube.cpy.re/videos/watch/e8a1af4e-414a-4d58-bfe6-2146eed06d10\n' +
    '    $ peertube watch https://peertube.cpy.re/videos/watch/e8a1af4e-414a-4d58-bfe6-2146eed06d10\n'
  )
  .action((url, options) => run(url, options))
  .parse(process.argv)

function run (url: string, options: program.OptionValues) {
  if (!url) {
    console.error('<url> positional argument is required.')
    process.exit(-1)
  }

  const cmd = 'node ' + join(__dirname, 'node_modules', 'webtorrent-hybrid', 'bin', 'cmd.js')
  const args = ` --${options.gui} ` +
    url.replace('videos/watch', 'download/torrents') +
    `-${options.resolution}.torrent`

  try {
    execSync(cmd + args)
  } catch (err) {
    console.error('Cannto exec command.', err)
    process.exit(-1)
  }
}
