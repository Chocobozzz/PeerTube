import { registerTSPaths } from '../server/helpers/register-ts-paths'
registerTSPaths()

import * as program from 'commander'
import * as ffmpeg from 'fluent-ffmpeg'
import { availableEncoders } from '@server/lib/video-transcoding-profiles'
import { buildx264VODCommand, runCommand, TranscodeOptions } from '@server/helpers/ffmpeg-utils'
import { exit } from 'process'

program
  .arguments('<path>')
  .requiredOption('-r, --resolution [resolution]', 'video resolution')
  .action((path, cmd) => {
    if (cmd.resolution !== undefined && Number.isNaN(+cmd.resolution)) {
      console.error('The resolution must be an integer (example: 1080).')
      process.exit(-1)
    }

    run(path, cmd)
      .then(() => process.exit(0))
      .catch(err => {
        console.error(err)
        process.exit(-1)
      })
  })
  .parse(process.argv)

async function run (path: string, cmd: any) {
  const options = {
    type: 'video' as 'video',
    inputPath: path,
    outputPath: '/dev/null',

    availableEncoders,
    profile: 'default',

    resolution: +cmd.resolution,
    isPortraitMode: false
  } as TranscodeOptions

  let command = ffmpeg(options.inputPath)
               .output(options.outputPath)

  command = await buildx264VODCommand(command, options)

  command.on('start', (cmdline) => {
    console.log(cmdline)
    exit()
  })

  await runCommand(command)
}
