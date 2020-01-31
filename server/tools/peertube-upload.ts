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

getServerCredentials(command)
  .then(({ url, username, password }) => {
    if (!program['videoName'] || !program['file']) {
      if (!program['videoName']) console.error('--video-name is required.')
      if (!program['file']) console.error('--file is required.')

      process.exit(-1)
    }

    if (isAbsolute(program['file']) === false) {
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

  await access(program['file'], constants.F_OK)

  console.log('Uploading %s video...', program['videoName'])

  const videoAttributes = await buildVideoAttributesFromCommander(url, program)

  Object.assign(videoAttributes, {
    fixture: program['file'],
    thumbnailfile: program['thumbnail'],
    previewfile: program['preview']
  })

  try {
    await uploadVideo(url, accessToken, videoAttributes)
    console.log(`Video ${program['videoName']} uploaded.`)
    process.exit(0)
  } catch (err) {
    console.error(require('util').inspect(err))
    process.exit(-1)
  }
}

// ----------------------------------------------------------------------------
