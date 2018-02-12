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
  .option('-N, --nsfw', 'Video is Not Safe For Work')
  .option('-c, --category <category number>', 'Category number')
  .option('-m, --comments-enabled', 'Enable comments')
  .option('-l, --licence <licence number>', 'Licence number')
  .option('-L, --language <language number>', 'Language number')
  .option('-d, --video-description <description>', 'Video description')
  .option('-t, --tags <tags>', 'Video tags', list)
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
  console.error('Url, username, password, name and input file are required.')
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
    fixture: program['file']
  }

  await uploadVideo(program['url'], accessToken, videoAttributes)

  console.log(`Video ${program['videoName']} uploaded.`)
  process.exit(0)
}

// ----------------------------------------------------------------------------

function list (val) {
  return val.split(',')
}
