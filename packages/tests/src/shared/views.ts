import type { FfmpegCommand } from 'fluent-ffmpeg'
import { wait } from '@peertube/peertube-core-utils'
import { VideoCreateResult, VideoPrivacy } from '@peertube/peertube-models'
import {
  createMultipleServers,
  doubleFollow,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs,
  waitUntilLivePublishedOnAllServers
} from '@peertube/peertube-server-commands'

async function processViewersStats (servers: PeerTubeServer[]) {
  await wait(6000)

  for (const server of servers) {
    await server.debug.sendCommand({ body: { command: 'process-video-views-buffer' } })
    await server.debug.sendCommand({ body: { command: 'process-video-viewers' } })
  }

  await waitJobs(servers)
}

async function processViewsBuffer (servers: PeerTubeServer[]) {
  for (const server of servers) {
    await server.debug.sendCommand({ body: { command: 'process-video-views-buffer' } })
  }

  await waitJobs(servers)
}

async function prepareViewsServers (options: {
  viewExpiration?: string // default 1 second
  trustViewerSessionId?: boolean // default true
} = {}) {
  const { viewExpiration = '1 second', trustViewerSessionId = true } = options

  const config = {
    views: {
      videos: {
        view_expiration: viewExpiration,
        trust_viewer_session_id: trustViewerSessionId,
        count_view_after: '10 seconds'
      }
    }
  }

  const servers = await createMultipleServers(2, config)
  await setAccessTokensToServers(servers)
  await setDefaultVideoChannel(servers)

  await servers[0].config.enableMinimumTranscoding()
  await servers[0].config.enableLive({ allowReplay: true, transcoding: false })

  await doubleFollow(servers[0], servers[1])

  return servers
}

async function prepareViewsVideos (options: {
  servers: PeerTubeServer[]
  live: boolean
  vod: boolean
}) {
  const { servers } = options

  const liveAttributes = {
    name: 'live video',
    channelId: servers[0].store.channel.id,
    privacy: VideoPrivacy.PUBLIC
  }

  let ffmpegCommand: FfmpegCommand
  let live: VideoCreateResult
  let vod: VideoCreateResult

  if (options.live) {
    live = await servers[0].live.create({ fields: liveAttributes })

    ffmpegCommand = await servers[0].live.sendRTMPStreamInVideo({ videoId: live.uuid })
    await waitUntilLivePublishedOnAllServers(servers, live.uuid)
  }

  if (options.vod) {
    vod = await servers[0].videos.quickUpload({ name: 'video' })
  }

  await waitJobs(servers)

  return { liveVideoId: live?.uuid, vodVideoId: vod?.uuid, ffmpegCommand }
}

export {
  processViewersStats,
  prepareViewsServers,
  processViewsBuffer,
  prepareViewsVideos
}
