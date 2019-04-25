import * as program from 'commander'
import { access, constants } from 'fs-extra'
import { isAbsolute } from 'path'
import { getClient, login } from '../../shared/extra-utils'
import { uploadVideo } from '../../shared/extra-utils/'
import { VideoPrivacy } from '../../shared/models/videos'
import { getRemoteObjectOrDie, getSettings } from './cli'

program
  .name('upload')
  .option('-u, --url <url>', 'Server url')
  .option('-U, --username <username>', 'Username')
  .option('-p, --password <token>', 'Password')
  .option('-n, --video-name <name>', 'Video name')
  .option('-P, --privacy <privacy_number>', 'Privacy')
  .option('-N, --nsfw', 'Video is Not Safe For Work')
  .option('-c, --category <category_number>', 'Category number')
  .option('-C, --channel-id <channel_id>', 'Channel ID')
  .option('-m, --comments-enabled', 'Enable comments')
  .option('-l, --licence <licence_number>', 'Licence number')
  .option('-L, --language <language_code>', 'Language ISO 639 code (fr or en...)')
  .option('-d, --video-description <description>', 'Video description')
  .option('-t, --tags <tags>', 'Video tags', list)
  .option('-b, --thumbnail <thumbnailPath>', 'Thumbnail path')
  .option('-v, --preview <previewPath>', 'Preview path')
  .option('-f, --file <file>', 'Video absolute file path')
  .parse(process.argv)

getSettings()
  .then(settings => {
    const { url, username, password } = getRemoteObjectOrDie(program, settings)

    if (!program['videoName'] || !program['file'] || !program['channelId']) {
      if (!program['videoName']) console.error('--video-name is required.')
      if (!program['file']) console.error('--file is required.')
      if (!program['channelId']) console.error('--channel-id is required.')

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

async function run (url: string, username: string, password: string) {
  const resClient = await getClient(program[ 'url' ])
  const client = {
    id: resClient.body.client_id,
    secret: resClient.body.client_secret
  }

  const user = { username, password }

  let accessToken: string
  try {
    const res = await login(url, client, user)
    accessToken = res.body.access_token
  } catch (err) {
    throw new Error('Cannot authenticate. Please check your username/password.')
  }

  await access(program[ 'file' ], constants.F_OK)

  console.log('Uploading %s video...', program[ 'videoName' ])

  const videoAttributes = {
    name: program['videoName'],
    category: program['category'] || undefined,
    channelId: program['channelId'],
    licence: program['licence'] || undefined,
    language: program['language'] || undefined,
    nsfw: program['nsfw'] !== undefined ? program['nsfw'] : false,
    description: program['videoDescription'] || '',
    tags: program['tags'] || [],
    commentsEnabled: program['commentsEnabled'] !== undefined ? program['commentsEnabled'] : true,
    downloadEnabled: program['downloadEnabled'] !== undefined ? program['downloadEnabled'] : true,
    fixture: program['file'],
    thumbnailfile: program['thumbnail'],
    previewfile: program['preview'],
    waitTranscoding: true,
    privacy: program['privacy'] || VideoPrivacy.PUBLIC,
    support: undefined
  }

  try {
    await uploadVideo(url, accessToken, videoAttributes)
    console.log(`Video ${program['videoName']} uploaded.`)
    process.exit(0)
  } catch (err) {
    console.log('coucou')
    console.error(require('util').inspect(err))
    process.exit(-1)
  }
}

// ----------------------------------------------------------------------------

function list (val) {
  return val.split(',')
}
