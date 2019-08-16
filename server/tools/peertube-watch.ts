import * as program from 'commander'
import { join } from 'path'
import { execSync } from 'child_process'

program
  .name('watch')
  .arguments('<url>')
  .option('-g, --gui <player>', 'player type', /^(airplay|stdout|chromecast|mpv|vlc|mplayer|xbmc)$/i, 'vlc')
  .option('-r, --resolution <res>', 'video resolution', '480')
  .on('--help', function () {
    console.log('  Available Players:')
    console.log()
    console.log('    - mpv')
    console.log('    - mplayer')
    console.log('    - vlc')
    console.log('    - stdout')
    console.log('    - xbmc')
    console.log('    - airplay')
    console.log('    - chromecast')
    console.log()
    console.log()
    console.log('  Examples:')
    console.log()
    console.log('    $ peertube watch -g mpv https://peertube.cpy.re/videos/watch/e8a1af4e-414a-4d58-bfe6-2146eed06d10')
    console.log('    $ peertube watch --gui stdout https://peertube.cpy.re/videos/watch/e8a1af4e-414a-4d58-bfe6-2146eed06d10')
    console.log('    $ peertube watch https://peertube.cpy.re/videos/watch/e8a1af4e-414a-4d58-bfe6-2146eed06d10')
    console.log()
  })
  .action((url, cmd) => {
    run(url, cmd)
      .catch(err => {
        console.error(err)
        process.exit(-1)
      })
  })
  .parse(process.argv)

async function run (url: string, program: any) {
  if (!url) {
    console.error('<url> positional argument is required.')
    process.exit(-1)
  }

  const cmd = 'node ' + join(__dirname, 'node_modules', 'webtorrent-hybrid', 'bin', 'cmd.js')
  const args = ` --${program.gui} ` +
    url.replace('videos/watch', 'download/torrents') +
    `-${program.resolution}.torrent`

  execSync(cmd + args)
}
