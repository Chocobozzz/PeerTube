import { Command } from '@commander-js/extra-typings'
import { forceNumber, uniqify } from '@peertube/peertube-core-utils'
import { HttpStatusCode, VideoRedundanciesTarget } from '@peertube/peertube-models'
import bytes from 'bytes'
import CliTable3 from 'cli-table3'
import { URL } from 'url'
import { assignToken, buildServer, CommonProgramOptions, getServerCredentials } from './shared/index.js'

export function defineRedundancyProgram () {
  const program = new Command()
    .name('redundancy')
    .description('Manage instance redundancies')
    .alias('r')

  program
    .command('list-remote-redundancies')
    .description('List remote redundancies on your videos')
    .option('-u, --url <url>', 'Server url')
    .option('-U, --username <username>', 'Username')
    .option('-p, --password <token>', 'Password')
    .action(async options => {
      try {
        await listRedundanciesCLI({ target: 'my-videos', ...options })
      } catch (err) {
        console.error('Cannot list remote redundancies: ' + err.message)
        process.exit(-1)
      }
    })

  program
    .command('list-my-redundancies')
    .description('List your redundancies of remote videos')
    .option('-u, --url <url>', 'Server url')
    .option('-U, --username <username>', 'Username')
    .option('-p, --password <token>', 'Password')
    .action(async options => {
      try {
        await listRedundanciesCLI({ target: 'remote-videos', ...options })
      } catch (err) {
        console.error('Cannot list redundancies: ' + err.message)
        process.exit(-1)
      }
    })

  program
    .command('add')
    .description('Duplicate a video in your redundancy system')
    .option('-u, --url <url>', 'Server url')
    .option('-U, --username <username>', 'Username')
    .option('-p, --password <token>', 'Password')
    .requiredOption('-v, --video <videoId>', 'Video id to duplicate', parseInt)
    .action(async options => {
      try {
        await addRedundancyCLI(options)
      } catch (err) {
        console.error('Cannot duplicate video: ' + err.message)
        process.exit(-1)
      }
    })

  program
    .command('remove')
    .description('Remove a video from your redundancies')
    .option('-u, --url <url>', 'Server url')
    .option('-U, --username <username>', 'Username')
    .option('-p, --password <token>', 'Password')
    .requiredOption('-v, --video <videoId>', 'Video id to remove from redundancies', parseInt)
    .action(async options => {
      try {
        await removeRedundancyCLI(options)
      } catch (err) {
        console.error('Cannot remove redundancy: ' + err)
        process.exit(-1)
      }
    })

  return program
}

// ----------------------------------------------------------------------------

async function listRedundanciesCLI (options: CommonProgramOptions & { target: VideoRedundanciesTarget }) {
  const { target } = options

  const { url, username, password } = await getServerCredentials(options)
  const server = buildServer(url)
  await assignToken(server, username, password)

  const { data } = await server.redundancy.listVideos({ start: 0, count: 100, sort: 'name', target })

  const table = new CliTable3({
    head: [ 'video id', 'video name', 'video url', 'playlists', 'by instances', 'total size' ]
  }) as any

  for (const redundancy of data) {
    const streamingPlaylists = redundancy.redundancies.streamingPlaylists

    let totalSize = ''
    if (target === 'remote-videos') {
      const tmp = streamingPlaylists.reduce((a, b) => a + b.size, 0)

      // FIXME: don't use external dependency to stringify bytes: we already have the functions in the client
      totalSize = bytes(tmp)
    }

    const instances = uniqify(
      streamingPlaylists
        .map(r => r.fileUrl)
        .map(u => new URL(u).host)
    )

    table.push([
      redundancy.id.toString(),
      redundancy.name,
      redundancy.url,
      streamingPlaylists.length,
      instances.join('\n'),
      totalSize
    ])
  }

  console.log(table.toString())
}

async function addRedundancyCLI (options: { video: number } & CommonProgramOptions) {
  const { url, username, password } = await getServerCredentials(options)
  const server = buildServer(url)
  await assignToken(server, username, password)

  if (!options.video || isNaN(options.video)) {
    throw new Error('You need to specify the video id to duplicate and it should be a number.')
  }

  try {
    await server.redundancy.addVideo({ videoId: options.video })

    console.log('Video will be duplicated by your instance!')
  } catch (err) {
    if (err.message.includes(HttpStatusCode.CONFLICT_409)) {
      throw new Error('This video is already duplicated by your instance.')
    }

    if (err.message.includes(HttpStatusCode.NOT_FOUND_404)) {
      throw new Error('This video id does not exist.')
    }

    throw err
  }
}

async function removeRedundancyCLI (options: CommonProgramOptions & { video: number }) {
  const { url, username, password } = await getServerCredentials(options)
  const server = buildServer(url)
  await assignToken(server, username, password)

  if (!options.video || isNaN(options.video)) {
    throw new Error('You need to specify the video id to remove from your redundancies')
  }

  const videoId = forceNumber(options.video)

  const myVideoRedundancies = await server.redundancy.listVideos({ target: 'my-videos' })
  let videoRedundancy = myVideoRedundancies.data.find(r => videoId === r.id)

  if (!videoRedundancy) {
    const remoteVideoRedundancies = await server.redundancy.listVideos({ target: 'remote-videos' })
    videoRedundancy = remoteVideoRedundancies.data.find(r => videoId === r.id)
  }

  if (!videoRedundancy) {
    throw new Error('Video redundancy not found.')
  }

  const ids = videoRedundancy.redundancies.streamingPlaylists
    .map(r => r.id)

  for (const id of ids) {
    await server.redundancy.removeVideo({ redundancyId: id })
  }

  console.log('Video redundancy removed!')
}
