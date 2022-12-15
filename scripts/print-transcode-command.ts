import { program } from 'commander'
import ffmpeg from 'fluent-ffmpeg'
import { exit } from 'process'
import { buildVODCommand, runCommand, TranscodeVODOptions } from '@server/helpers/ffmpeg'
import { VideoTranscodingProfilesManager } from '@server/lib/transcoding/default-transcoding-profiles'

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

    availableEncoders: VideoTranscodingProfilesManager.Instance.getAvailableEncoders(),
    profile: 'default',

    resolution: +cmd.resolution
  } as TranscodeVODOptions

  let command = ffmpeg(options.inputPath)
               .output(options.outputPath)

  command = await buildVODCommand(command, options)

  command.on('start', (cmdline) => {
    console.log(cmdline)
    exit()
  })

  await runCommand({ command })
}
