import * as program from 'commander'
import { access, constants } from 'fs'
import { isAbsolute } from 'path'
import { promisify } from 'util'
import { getClient, login } from '../tests/utils'
import { uploadVideo } from '../tests/utils/index'

const accessPromise = promisify(access)

program
  .option('-u, --url <url>', 'Server url')
  .option('-U, --username <username>', 'Username')
  .option('-p, --password <token>', 'Password')
  .option('-n, --video-name <name>', 'Video name')
  .option('-P, --privacy <privacy number>', 'Privacy')
  .option('-N, --nsfw', 'Video is Not Safe For Work')
  .option('-c, --category <category number>', 'Category number')
  .option('-m, --comments-enabled', 'Enable comments')
  .option('-l, --licence <licence number>', 'Licence number')
  .option('-L, --language <language number>', 'Language number')
  .option('-d, --video-description <description>', 'Video description')
  .option('-t, --tags <tags>', 'Video tags', list)
  .option('-b, --thumbnail <thumbnailPath>', 'Thumbnail path')
  .option('-v, --preview <previewPath>', 'Preview path')
  .option('-f, --file <file>', 'Video absolute file path')
  .parse(process.argv)

if (!program['tags']) program['tags'] = []
if (!program['nsfw']) program['nsfw'] = false
if (!program['commentsEnabled']) program['commentsEnabled'] = false

if (
  !program['url'] ||
  !program['username'] ||
  !program['password'] ||
  !program['videoName'] ||
  !program['file']
) {
  if (!program['url']) console.error('--url field is required.')
  if (!program['username']) console.error('--username field is required.')
  if (!program['password']) console.error('--password field is required.')
  if (!program['videoName']) console.error('--video-name field is required.')
  if (!program['file']) console.error('--file field is required.')
  process.exit(-1)
}

if (isAbsolute(program['file']) === false) {
  console.error('File path should be absolute.')
  process.exit(-1)
}

run().catch(err => console.error(err))

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

  const res2 = await login(program[ 'url' ], client, user)
  const accessToken = res2.body.access_token

  await accessPromise(program[ 'file' ], constants.F_OK)

  console.log('Uploading %s video...', program[ 'videoName' ])

  const videoAttributes = {
    name: program['videoName'],
    category: program['category'],
    licence: program['licence'],
    language: program['language'],
    nsfw: program['nsfw'],
    description: program['videoDescription'],
    tags: program['tags'],
    commentsEnabled: program['commentsEnabled'],
    fixture: program['file'],
    thumbnailfile: program['thumbnailPath'],
    previewfile: program['previewPath'],
    privacy: program['privacy'],
    support: undefined
  }

  await uploadVideo(program['url'], accessToken, videoAttributes)

  console.log(`Video ${program['videoName']} uploaded.`)
  process.exit(0)
}

// ----------------------------------------------------------------------------

function list (val) {
  return val.split(',')
}
