// eslint-disable @typescript-eslint/no-unnecessary-type-assertion

import { registerTSPaths } from '../helpers/register-ts-paths'
registerTSPaths()

import * as program from 'commander'
import { getAdminTokenOrDie, getServerCredentials } from './cli'
import { VideoRedundanciesTarget, VideoRedundancy } from '@shared/models'
import { addVideoRedundancy, listVideoRedundancies, removeVideoRedundancy } from '@shared/extra-utils/server/redundancy'
import validator from 'validator'
import * as CliTable3 from 'cli-table3'
import { URL } from 'url'
import { uniq } from 'lodash'

import bytes = require('bytes')

program
  .name('plugins')
  .usage('[command] [options]')

program
  .command('list-remote-redundancies')
  .description('List remote redundancies on your videos')
  .option('-u, --url <url>', 'Server url')
  .option('-U, --username <username>', 'Username')
  .option('-p, --password <token>', 'Password')
  .action(() => listRedundanciesCLI('my-videos'))

program
  .command('list-my-redundancies')
  .description('List your redundancies of remote videos')
  .option('-u, --url <url>', 'Server url')
  .option('-U, --username <username>', 'Username')
  .option('-p, --password <token>', 'Password')
  .action(() => listRedundanciesCLI('remote-videos'))

program
  .command('add')
  .description('Duplicate a video in your redundancy system')
  .option('-u, --url <url>', 'Server url')
  .option('-U, --username <username>', 'Username')
  .option('-p, --password <token>', 'Password')
  .option('-v, --video <videoId>', 'Video id to duplicate')
  .action((options) => addRedundancyCLI(options))

program
  .command('remove')
  .description('Remove a video from your redundancies')
  .option('-u, --url <url>', 'Server url')
  .option('-U, --username <username>', 'Username')
  .option('-p, --password <token>', 'Password')
  .option('-v, --video <videoId>', 'Video id to remove from redundancies')
  .action((options) => removeRedundancyCLI(options))

if (!process.argv.slice(2).length) {
  program.outputHelp()
}

program.parse(process.argv)

// ----------------------------------------------------------------------------

async function listRedundanciesCLI (target: VideoRedundanciesTarget) {
  const { url, username, password } = await getServerCredentials(program)
  const accessToken = await getAdminTokenOrDie(url, username, password)

  const redundancies = await listVideoRedundanciesData(url, accessToken, target)

  const table = new CliTable3({
    head: [ 'video id', 'video name', 'video url', 'files', 'playlists', 'by instances', 'total size' ]
  }) as any

  for (const redundancy of redundancies) {
    const webtorrentFiles = redundancy.redundancies.files
    const streamingPlaylists = redundancy.redundancies.streamingPlaylists

    let totalSize = ''
    if (target === 'remote-videos') {
      const tmp = webtorrentFiles.concat(streamingPlaylists)
                                 .reduce((a, b) => a + b.size, 0)

      totalSize = bytes(tmp)
    }

    const instances = uniq(
      webtorrentFiles.concat(streamingPlaylists)
                     .map(r => r.fileUrl)
                     .map(u => new URL(u).host)
    )

    table.push([
      redundancy.id.toString(),
      redundancy.name,
      redundancy.url,
      webtorrentFiles.length,
      streamingPlaylists.length,
      instances.join('\n'),
      totalSize
    ])
  }

  console.log(table.toString())
  process.exit(0)
}

async function addRedundancyCLI (options: { videoId: number }) {
  const { url, username, password } = await getServerCredentials(program)
  const accessToken = await getAdminTokenOrDie(url, username, password)

  if (!options['video'] || validator.isInt('' + options['video']) === false) {
    console.error('You need to specify the video id to duplicate and it should be a number.\n')
    program.outputHelp()
    process.exit(-1)
  }

  try {
    await addVideoRedundancy({
      url,
      accessToken,
      videoId: options['video']
    })

    console.log('Video will be duplicated by your instance!')

    process.exit(0)
  } catch (err) {
    if (err.message.includes(409)) {
      console.error('This video is already duplicated by your instance.')
    } else if (err.message.includes(404)) {
      console.error('This video id does not exist.')
    } else {
      console.error(err)
    }

    process.exit(-1)
  }
}

async function removeRedundancyCLI (options: { videoId: number }) {
  const { url, username, password } = await getServerCredentials(program)
  const accessToken = await getAdminTokenOrDie(url, username, password)

  if (!options['video'] || validator.isInt('' + options['video']) === false) {
    console.error('You need to specify the video id to remove from your redundancies.\n')
    program.outputHelp()
    process.exit(-1)
  }

  const videoId = parseInt(options['video'] + '', 10)

  let redundancies = await listVideoRedundanciesData(url, accessToken, 'my-videos')
  let videoRedundancy = redundancies.find(r => videoId === r.id)

  if (!videoRedundancy) {
    redundancies = await listVideoRedundanciesData(url, accessToken, 'remote-videos')
    videoRedundancy = redundancies.find(r => videoId === r.id)
  }

  if (!videoRedundancy) {
    console.error('Video redundancy not found.')
    process.exit(-1)
  }

  try {
    const ids = videoRedundancy.redundancies.files
                               .concat(videoRedundancy.redundancies.streamingPlaylists)
                               .map(r => r.id)

    for (const id of ids) {
      await removeVideoRedundancy({
        url,
        accessToken,
        redundancyId: id
      })
    }

    console.log('Video redundancy removed!')

    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(-1)
  }
}

async function listVideoRedundanciesData (url: string, accessToken: string, target: VideoRedundanciesTarget) {
  const res = await listVideoRedundancies({
    url,
    accessToken,
    start: 0,
    count: 100,
    sort: 'name',
    target
  })

  return res.body.data as VideoRedundancy[]
}
