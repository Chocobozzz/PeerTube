import CliTable3 from 'cli-table3'
import { Command, program } from 'commander'
import { URL } from 'url'
import validator from 'validator'
import { forceNumber, uniqify } from '@shared/core-utils'
import { HttpStatusCode, VideoRedundanciesTarget } from '@shared/models'
import { assignToken, buildServer, getServerCredentials } from './cli'

import bytes = require('bytes')
program
  .name('redundancy')
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
  .action((options, command) => addRedundancyCLI(options, command))

program
  .command('remove')
  .description('Remove a video from your redundancies')
  .option('-u, --url <url>', 'Server url')
  .option('-U, --username <username>', 'Username')
  .option('-p, --password <token>', 'Password')
  .option('-v, --video <videoId>', 'Video id to remove from redundancies')
  .action((options, command) => removeRedundancyCLI(options, command))

if (!process.argv.slice(2).length) {
  program.outputHelp()
}

program.parse(process.argv)

// ----------------------------------------------------------------------------

async function listRedundanciesCLI (target: VideoRedundanciesTarget) {
  const { url, username, password } = await getServerCredentials(program)
  const server = buildServer(url)
  await assignToken(server, username, password)

  const { data } = await server.redundancy.listVideos({ start: 0, count: 100, sort: 'name', target })

  const table = new CliTable3({
    head: [ 'video id', 'video name', 'video url', 'files', 'playlists', 'by instances', 'total size' ]
  }) as any

  for (const redundancy of data) {
    const webtorrentFiles = redundancy.redundancies.files
    const streamingPlaylists = redundancy.redundancies.streamingPlaylists

    let totalSize = ''
    if (target === 'remote-videos') {
      const tmp = webtorrentFiles.concat(streamingPlaylists)
                                 .reduce((a, b) => a + b.size, 0)

      totalSize = bytes(tmp)
    }

    const instances = uniqify(
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

async function addRedundancyCLI (options: { video: number }, command: Command) {
  const { url, username, password } = await getServerCredentials(command)
  const server = buildServer(url)
  await assignToken(server, username, password)

  if (!options.video || validator.isInt('' + options.video) === false) {
    console.error('You need to specify the video id to duplicate and it should be a number.\n')
    command.outputHelp()
    process.exit(-1)
  }

  try {
    await server.redundancy.addVideo({ videoId: options.video })

    console.log('Video will be duplicated by your instance!')

    process.exit(0)
  } catch (err) {
    if (err.message.includes(HttpStatusCode.CONFLICT_409)) {
      console.error('This video is already duplicated by your instance.')
    } else if (err.message.includes(HttpStatusCode.NOT_FOUND_404)) {
      console.error('This video id does not exist.')
    } else {
      console.error(err)
    }

    process.exit(-1)
  }
}

async function removeRedundancyCLI (options: { video: number }, command: Command) {
  const { url, username, password } = await getServerCredentials(command)
  const server = buildServer(url)
  await assignToken(server, username, password)

  if (!options.video || validator.isInt('' + options.video) === false) {
    console.error('You need to specify the video id to remove from your redundancies.\n')
    command.outputHelp()
    process.exit(-1)
  }

  const videoId = forceNumber(options.video)

  const myVideoRedundancies = await server.redundancy.listVideos({ target: 'my-videos' })
  let videoRedundancy = myVideoRedundancies.data.find(r => videoId === r.id)

  if (!videoRedundancy) {
    const remoteVideoRedundancies = await server.redundancy.listVideos({ target: 'remote-videos' })
    videoRedundancy = remoteVideoRedundancies.data.find(r => videoId === r.id)
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
      await server.redundancy.removeVideo({ redundancyId: id })
    }

    console.log('Video redundancy removed!')

    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(-1)
  }
}
