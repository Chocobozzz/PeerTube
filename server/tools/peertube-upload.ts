import * as program from 'commander'
import { access, constants } from 'fs-extra'
import { isAbsolute } from 'path'
import { getClient, login } from '../tests/utils'
import { uploadVideo } from '../tests/utils/index'
import { VideoPrivacy } from '../../shared/models/videos'
import { netrc, getSettings } from './cli'

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

if (!program['tags']) program['tags'] = []
if (!program['nsfw']) program['nsfw'] = false
if (!program['privacy']) program['privacy'] = VideoPrivacy.PUBLIC
if (!program['commentsEnabled']) program['commentsEnabled'] = false

getSettings()
  .then(settings => {
    if (
      (!program['url'] ||
      !program['username'] ||
      !program['password']) &&
      (settings.remotes.length === 0)
    ) {
      if (!program['url']) console.error('--url field is required.')
      if (!program['username']) console.error('--username field is required.')
      if (!program['password']) console.error('--password field is required.')
      if (!program['videoName']) console.error('--video-name field is required.')
      if (!program['file']) console.error('--file field is required.')
      process.exit(-1)
    }

    if (
      (!program['url'] ||
      !program['username'] ||
      !program['password']) &&
      (settings.remotes.length > 0)
    ) {
      if (!program['url']) {
        program['url'] = (settings.default !== -1) ?
          settings.remotes[settings.default] :
          settings.remotes[0]
      }
      if (!program['username']) program['username'] = netrc.machines[program['url']].login
      if (!program['password']) program['password'] = netrc.machines[program['url']].password
    }

    if (
      !program['videoName'] ||
      !program['file']
    ) {
      if (!program['videoName']) console.error('--video-name field is required.')
      if (!program['file']) console.error('--file field is required.')
      process.exit(-1)
    }

    if (isAbsolute(program['file']) === false) {
      console.error('File path should be absolute.')
      process.exit(-1)
    }

    run().catch(err => {
      console.error(err)
      process.exit(-1)
    })
  })

async function run () {
  const res = await getClient(program[ 'url' ])
  const client = {
    id: res.body.client_id,
    secret: res.body.client_secret
  }

  const user = {
    username: program[ 'username' ],
    password: program[ 'password' ]
  }

  let accessToken: string
  try {
    const res2 = await login(program[ 'url' ], client, user)
    accessToken = res2.body.access_token
  } catch (err) {
    throw new Error('Cannot authenticate. Please check your username/password.')
  }

  await access(program[ 'file' ], constants.F_OK)

  console.log('Uploading %s video...', program[ 'videoName' ])

  const videoAttributes = {
    name: program['videoName'],
    category: program['category'],
    channelId: program['channelId'],
    licence: program['licence'],
    language: program['language'],
    nsfw: program['nsfw'],
    description: program['videoDescription'],
    tags: program['tags'],
    commentsEnabled: program['commentsEnabled'],
    fixture: program['file'],
    thumbnailfile: program['thumbnail'],
    previewfile: program['preview'],
    waitTranscoding: true,
    privacy: program['privacy'],
    support: undefined
  }

  await uploadVideo(program[ 'url' ], accessToken, videoAttributes)

  console.log(`Video ${program['videoName']} uploaded.`)
  process.exit(0)
}

// ----------------------------------------------------------------------------

function list (val) {
  return val.split(',')
}
