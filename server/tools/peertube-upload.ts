import { registerTSPaths } from '../helpers/register-ts-paths'
registerTSPaths()

import * as program from 'commander'
import { access, constants } from 'fs-extra'
import { isAbsolute } from 'path'
import { getAccessToken } from '../../shared/extra-utils'
import { uploadVideo } from '../../shared/extra-utils/'
import { buildCommonVideoOptions, buildVideoAttributesFromCommander, getServerCredentials } from './cli'

let command = program
  .name('upload')

command = buildCommonVideoOptions(command)

command
  .option('-u, --url <url>', 'Server url')
  .option('-U, --username <username>', 'Username')
  .option('-p, --password <token>', 'Password')
  .option('-b, --thumbnail <thumbnailPath>', 'Thumbnail path')
  .option('-v, --preview <previewPath>', 'Preview path')
  .option('-f, --file <file>', 'Video absolute file path')
  .parse(process.argv)

const options = command.opts()

getServerCredentials(command)
  .then(({ url, username, password }) => {
    if (!options.videoName || !options.file) {
      if (!options.videoName) console.error('--video-name is required.')
      if (!options.file) console.error('--file is required.')

      process.exit(-1)
    }

    if (isAbsolute(options.file) === false) {
      console.error('File path should be absolute.')
      process.exit(-1)
    }

    run(url, username, password).catch(err => {
      console.error(err)
      process.exit(-1)
    })
  })
  .catch(err => console.error(err))

async function run (url: string, username: string, password: string) {
  const accessToken = await getAccessToken(url, username, password)

  await access(options.file, constants.F_OK)

  console.log('Uploading %s video...', options.videoName)

  const videoAttributes = await buildVideoAttributesFromCommander(url, program)

  Object.assign(videoAttributes, {
    fixture: options.file,
    thumbnailfile: options.thumbnail,
    previewfile: options.preview
  })

  try {
    await uploadVideo(url, accessToken, videoAttributes)
    console.log(`Video ${options.videoName} uploaded.`)
    process.exit(0)
  } catch (err) {
    console.error(require('util').inspect(err))
    process.exit(-1)
  }
}

// ----------------------------------------------------------------------------
