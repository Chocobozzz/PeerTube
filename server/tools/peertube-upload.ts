import * as program from 'commander'
import { access, constants } from 'fs-extra'
import { isAbsolute } from 'path'
import { getClient, login } from '../../shared/extra-utils'
import { uploadVideo } from '../../shared/extra-utils/'
import { buildCommonVideoOptions, buildVideoAttributesFromCommander, getNetrc, getRemoteObjectOrDie, getSettings } from './cli'

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

Promise.all([ getSettings(), getNetrc() ])
       .then(([ settings, netrc ]) => {
         const { url, username, password } = getRemoteObjectOrDie(program, settings, netrc)

         if (!program[ 'videoName' ] || !program[ 'file' ]) {
           if (!program[ 'videoName' ]) console.error('--video-name is required.')
           if (!program[ 'file' ]) console.error('--file is required.')

           process.exit(-1)
         }

         if (isAbsolute(program[ 'file' ]) === false) {
           console.error('File path should be absolute.')
           process.exit(-1)
         }

         run(url, username, password).catch(err => {
           console.error(err)
           process.exit(-1)
         })
       })

async function run (url: string, username: string, password: string) {
  const resClient = await getClient(url)
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

  const defaultAttributes = {
    tags: command[ 'tags' ],
    description: command[ 'videoDescription' ]
  }
  const videoAttributes = await buildVideoAttributesFromCommander(url, program, defaultAttributes)

  Object.assign(videoAttributes, {
    fixture: program[ 'file' ],
    thumbnailfile: program[ 'thumbnail' ],
    previewfile: program[ 'preview' ]
  })

  try {
    await uploadVideo(url, accessToken, videoAttributes)
    console.log(`Video ${program[ 'videoName' ]} uploaded.`)
    process.exit(0)
  } catch (err) {
    console.error(require('util').inspect(err))
    process.exit(-1)
  }
}

// ----------------------------------------------------------------------------
