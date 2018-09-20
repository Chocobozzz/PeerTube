import * as program from 'commander'
import * as summon from 'summon-install'
import { join } from 'path'
import { execSync } from 'child_process'
import { root } from '../helpers/core-utils'

let videoURL

program
  .name('watch')
  .arguments('<url>')
  .option('-g, --gui <player>', 'player type', /^(airplay|stdout|chromecast|mpv|vlc|mplayer|ascii|xbmc)$/i, 'ascii')
  .option('-i, --invert', 'invert colors (ascii player only)', true)
  .option('-r, --resolution <res>', 'video resolution', /^(240|360|720|1080)$/i, '720')
  .on('--help', function () {
    console.log('  Available Players:')
    console.log()
    console.log('    - ascii')
    console.log('    - mpv')
    console.log('    - mplayer')
    console.log('    - vlc')
    console.log('    - stdout')
    console.log('    - xbmc')
    console.log('    - airplay')
    console.log('    - chromecast')
    console.log()
    console.log('  Note: \'ascii\' is the only option not using WebTorrent and not seeding back the video.')
    console.log()
    console.log('  Examples:')
    console.log()
    console.log('    $ peertube watch -g mpv https://peertube.cpy.re/videos/watch/e8a1af4e-414a-4d58-bfe6-2146eed06d10')
    console.log('    $ peertube watch --gui stdout https://peertube.cpy.re/videos/watch/e8a1af4e-414a-4d58-bfe6-2146eed06d10')
    console.log('    $ peertube watch https://peertube.cpy.re/videos/watch/e8a1af4e-414a-4d58-bfe6-2146eed06d10')
    console.log()
  })
  .action((url) => {
    videoURL = url
  })
  .parse(process.argv)

if (!videoURL) {
  console.error('<url> positional argument is required.')
  process.exit(-1)
} else { program['url'] = videoURL }

handler(program)

function handler (argv) {
  if (argv['gui'] === 'ascii') {
    summon('peerterminal')
    const peerterminal = summon('peerterminal')
    peerterminal([ '--link', videoURL, '--invert', argv['invert'] ])
  } else {
    summon('webtorrent-hybrid')
    const CMD = 'node ' + join(root(), 'node_modules', 'webtorrent-hybrid', 'bin', 'cmd.js')
    const CMDargs = ` --${argv.gui} ` +
                    argv['url'].replace('videos/watch', 'download/torrents') +
                    `-${argv.resolution}.torrent`
    execSync(CMD + CMDargs)
  }
}
