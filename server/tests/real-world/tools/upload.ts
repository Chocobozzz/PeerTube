import * as program from 'commander'
import { access, constants } from 'fs'
import { isAbsolute } from 'path'
import { promisify } from 'util'

const accessPromise = promisify(access)

import { uploadVideo } from '../../utils'

program
  .option('-u, --url <url>', 'Server url')
  .option('-a, --access-token <token>', 'Access token')
  .option('-n, --name <name>', 'Video name')
  .option('-N, --nsfw', 'Video is Not Safe For Work')
  .option('-c, --category <category number>', 'Category number')
  .option('-l, --licence <licence number>', 'Licence number')
  .option('-L, --language <language number>', 'Language number')
  .option('-d, --description <description>', 'Video description')
  .option('-t, --tags <tags>', 'Video tags', list)
  .option('-f, --file <file>', 'Video absolute file path')
  .parse(process.argv)

if (!program['tags']) program['tags'] = []
if (!program['nsfw']) program['nsfw'] = false

if (
  !program['url'] ||
  !program['accessToken'] ||
  !program['name'] ||
  !program['category'] ||
  !program['licence'] ||
  !program['description'] ||
  !program['file']
) {
  throw new Error('All arguments but tags, language and nsfw are required.')
}

if (isAbsolute(program['file']) === false) {
  throw new Error('File path should be absolute.')
}

accessPromise(program['file'], constants.F_OK)
  .then(() => {
    return upload(
      program['url'],
      program['accessToken'],
      program['name'],
      program['category'],
      program['licence'],
      program['language'],
      program['nsfw'],
      program['description'],
      program['tags'],
      program['file']
    )
  })
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(-1)
  })

// ----------------------------------------------------------------------------

function list (val) {
  return val.split(',')
}

function upload (url, accessToken, name, category, licence, language, nsfw, description, tags, fixture) {
  console.log('Uploading %s video...', program['name'])

  const videoAttributes = {
    name,
    category,
    licence,
    language,
    nsfw,
    description,
    tags,
    fixture
  }
  return uploadVideo(url, accessToken, videoAttributes).then(() => {
    console.log(`Video ${name} uploaded.`)
  })
}
