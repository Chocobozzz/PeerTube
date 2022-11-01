import ffmpeg, { FfmpegCommand } from 'fluent-ffmpeg'
import { buildAbsoluteFixturePath, wait } from '@shared/core-utils'
import { VideoDetails, VideoInclude, VideoPrivacy } from '@shared/models'
import { PeerTubeServer } from '../server/server'

function sendRTMPStream (options: {
  rtmpBaseUrl: string
  streamKey: string
  fixtureName?: string // default video_short.mp4
  copyCodecs?: boolean // default false
}) {
  const { rtmpBaseUrl, streamKey, fixtureName = 'video_short.mp4', copyCodecs = false } = options

  const fixture = buildAbsoluteFixturePath(fixtureName)

  const command = ffmpeg(fixture)
  command.inputOption('-stream_loop -1')
  command.inputOption('-re')

  if (copyCodecs) {
    command.outputOption('-c copy')
  } else {
    command.outputOption('-c:v libx264')
    command.outputOption('-g 50')
    command.outputOption('-keyint_min 2')
    command.outputOption('-r 60')
  }

  command.outputOption('-f flv')

  const rtmpUrl = rtmpBaseUrl + '/' + streamKey
  command.output(rtmpUrl)

  command.on('error', err => {
    if (err?.message?.includes('Exiting normally')) return

    if (process.env.DEBUG) console.error(err)
  })

  if (process.env.DEBUG) {
    command.on('stderr', data => console.log(data))
  }

  command.run()

  return command
}

function waitFfmpegUntilError (command: FfmpegCommand, successAfterMS = 10000) {
  return new Promise<void>((res, rej) => {
    command.on('error', err => {
      return rej(err)
    })

    setTimeout(() => {
      res()
    }, successAfterMS)
  })
}

async function testFfmpegStreamError (command: FfmpegCommand, shouldHaveError: boolean) {
  let error: Error

  try {
    await waitFfmpegUntilError(command, 35000)
  } catch (err) {
    error = err
  }

  await stopFfmpeg(command)

  if (shouldHaveError && !error) throw new Error('Ffmpeg did not have an error')
  if (!shouldHaveError && error) throw error
}

async function stopFfmpeg (command: FfmpegCommand) {
  command.kill('SIGINT')

  await wait(500)
}

async function waitUntilLivePublishedOnAllServers (servers: PeerTubeServer[], videoId: string) {
  for (const server of servers) {
    await server.live.waitUntilPublished({ videoId })
  }
}

async function waitUntilLiveWaitingOnAllServers (servers: PeerTubeServer[], videoId: string) {
  for (const server of servers) {
    await server.live.waitUntilWaiting({ videoId })
  }
}

async function waitUntilLiveReplacedByReplayOnAllServers (servers: PeerTubeServer[], videoId: string) {
  for (const server of servers) {
    await server.live.waitUntilReplacedByReplay({ videoId })
  }
}

async function findExternalSavedVideo (server: PeerTubeServer, liveDetails: VideoDetails) {
  const include = VideoInclude.BLACKLISTED
  const privacyOneOf = [ VideoPrivacy.INTERNAL, VideoPrivacy.PRIVATE, VideoPrivacy.PUBLIC, VideoPrivacy.UNLISTED ]

  const { data } = await server.videos.list({ token: server.accessToken, sort: '-publishedAt', include, privacyOneOf })

  return data.find(v => v.name === liveDetails.name + ' - ' + new Date(liveDetails.publishedAt).toLocaleString())
}

export {
  sendRTMPStream,
  waitFfmpegUntilError,
  testFfmpegStreamError,
  stopFfmpeg,

  waitUntilLivePublishedOnAllServers,
  waitUntilLiveReplacedByReplayOnAllServers,
  waitUntilLiveWaitingOnAllServers,

  findExternalSavedVideo
}
