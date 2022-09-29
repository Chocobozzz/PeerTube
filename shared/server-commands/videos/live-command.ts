/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { readdir } from 'fs-extra'
import { join } from 'path'
import { omit, wait } from '@shared/core-utils'
import {
  HttpStatusCode,
  LiveVideo,
  LiveVideoCreate,
  LiveVideoSession,
  LiveVideoUpdate,
  ResultList,
  VideoCreateResult,
  VideoDetails,
  VideoState
} from '@shared/models'
import { unwrapBody } from '../requests'
import { AbstractCommand, OverrideCommandOptions } from '../shared'
import { sendRTMPStream, testFfmpegStreamError } from './live'

export class LiveCommand extends AbstractCommand {

  get (options: OverrideCommandOptions & {
    videoId: number | string
  }) {
    const path = '/api/v1/videos/live'

    return this.getRequestBody<LiveVideo>({
      ...options,

      path: path + '/' + options.videoId,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  listSessions (options: OverrideCommandOptions & {
    videoId: number | string
  }) {
    const path = `/api/v1/videos/live/${options.videoId}/sessions`

    return this.getRequestBody<ResultList<LiveVideoSession>>({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  async findLatestSession (options: OverrideCommandOptions & {
    videoId: number | string
  }) {
    const { data: sessions } = await this.listSessions(options)

    return sessions[sessions.length - 1]
  }

  getReplaySession (options: OverrideCommandOptions & {
    videoId: number | string
  }) {
    const path = `/api/v1/videos/${options.videoId}/live-session`

    return this.getRequestBody<LiveVideoSession>({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  update (options: OverrideCommandOptions & {
    videoId: number | string
    fields: LiveVideoUpdate
  }) {
    const { videoId, fields } = options
    const path = '/api/v1/videos/live'

    return this.putBodyRequest({
      ...options,

      path: path + '/' + videoId,
      fields,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  async create (options: OverrideCommandOptions & {
    fields: LiveVideoCreate
  }) {
    const { fields } = options
    const path = '/api/v1/videos/live'

    const attaches: any = {}
    if (fields.thumbnailfile) attaches.thumbnailfile = fields.thumbnailfile
    if (fields.previewfile) attaches.previewfile = fields.previewfile

    const body = await unwrapBody<{ video: VideoCreateResult }>(this.postUploadRequest({
      ...options,

      path,
      attaches,
      fields: omit(fields, [ 'thumbnailfile', 'previewfile' ]),
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    }))

    return body.video
  }

  async sendRTMPStreamInVideo (options: OverrideCommandOptions & {
    videoId: number | string
    fixtureName?: string
    copyCodecs?: boolean
  }) {
    const { videoId, fixtureName, copyCodecs } = options
    const videoLive = await this.get({ videoId })

    return sendRTMPStream({ rtmpBaseUrl: videoLive.rtmpUrl, streamKey: videoLive.streamKey, fixtureName, copyCodecs })
  }

  async runAndTestStreamError (options: OverrideCommandOptions & {
    videoId: number | string
    shouldHaveError: boolean
  }) {
    const command = await this.sendRTMPStreamInVideo(options)

    return testFfmpegStreamError(command, options.shouldHaveError)
  }

  waitUntilPublished (options: OverrideCommandOptions & {
    videoId: number | string
  }) {
    const { videoId } = options
    return this.waitUntilState({ videoId, state: VideoState.PUBLISHED })
  }

  waitUntilWaiting (options: OverrideCommandOptions & {
    videoId: number | string
  }) {
    const { videoId } = options
    return this.waitUntilState({ videoId, state: VideoState.WAITING_FOR_LIVE })
  }

  waitUntilEnded (options: OverrideCommandOptions & {
    videoId: number | string
  }) {
    const { videoId } = options
    return this.waitUntilState({ videoId, state: VideoState.LIVE_ENDED })
  }

  waitUntilSegmentGeneration (options: OverrideCommandOptions & {
    videoUUID: string
    playlistNumber: number
    segment: number
    totalSessions?: number
  }) {
    const { playlistNumber, segment, videoUUID, totalSessions = 1 } = options
    const segmentName = `${playlistNumber}-00000${segment}.ts`

    return this.server.servers.waitUntilLog(`${videoUUID}/${segmentName}`, totalSessions * 2, false)
  }

  getSegment (options: OverrideCommandOptions & {
    videoUUID: string
    playlistNumber: number
    segment: number
  }) {
    const { playlistNumber, segment, videoUUID } = options

    const segmentName = `${playlistNumber}-00000${segment}.ts`
    const url = `${this.server.url}/static/streaming-playlists/hls/${videoUUID}/${segmentName}`

    return this.getRawRequest({
      ...options,

      url,
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  async waitUntilReplacedByReplay (options: OverrideCommandOptions & {
    videoId: number | string
  }) {
    let video: VideoDetails

    do {
      video = await this.server.videos.getWithToken({ token: options.token, id: options.videoId })

      await wait(500)
    } while (video.isLive === true || video.state.id !== VideoState.PUBLISHED)
  }

  async countPlaylists (options: OverrideCommandOptions & {
    videoUUID: string
  }) {
    const basePath = this.server.servers.buildDirectory('streaming-playlists')
    const hlsPath = join(basePath, 'hls', options.videoUUID)

    const files = await readdir(hlsPath)

    return files.filter(f => f.endsWith('.m3u8')).length
  }

  private async waitUntilState (options: OverrideCommandOptions & {
    videoId: number | string
    state: VideoState
  }) {
    let video: VideoDetails

    do {
      video = await this.server.videos.getWithToken({ token: options.token, id: options.videoId })

      await wait(500)
    } while (video.state.id !== options.state)
  }
}
