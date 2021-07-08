/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { readdir } from 'fs-extra'
import { omit } from 'lodash'
import { join } from 'path'
import { LiveVideo, LiveVideoCreate, LiveVideoUpdate, VideoCreateResult, VideoDetails, VideoState } from '@shared/models'
import { HttpStatusCode } from '../../core-utils/miscs/http-error-codes'
import { buildServerDirectory, wait } from '../miscs/miscs'
import { unwrapBody } from '../requests'
import { waitUntilLog } from '../server/servers'
import { AbstractCommand, OverrideCommandOptions } from '../shared'
import { sendRTMPStream, testFfmpegStreamError } from './live'
import { getVideoWithToken } from './videos'

export class LiveCommand extends AbstractCommand {

  get (options: OverrideCommandOptions & {
    videoId: number | string
  }) {
    const path = '/api/v1/videos/live'

    return this.getRequestBody<LiveVideo>({
      ...options,

      path: path + '/' + options.videoId,
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
      fields: omit(fields, 'thumbnailfile', 'previewfile'),
      defaultExpectedStatus: HttpStatusCode.OK_200
    }))

    return body.video
  }

  async sendRTMPStreamInVideo (options: OverrideCommandOptions & {
    videoId: number | string
    fixtureName?: string
  }) {
    const { videoId, fixtureName } = options
    const videoLive = await this.get({ videoId })

    return sendRTMPStream(videoLive.rtmpUrl, videoLive.streamKey, fixtureName)
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
    resolution: number
    segment: number
  }) {
    const { resolution, segment, videoUUID } = options
    const segmentName = `${resolution}-00000${segment}.ts`

    return waitUntilLog(this.server, `${videoUUID}/${segmentName}`, 2, false)
  }

  async waitUntilSaved (options: OverrideCommandOptions & {
    videoId: number | string
  }) {
    let video: VideoDetails

    do {
      const res = await getVideoWithToken(this.server.url, options.token ?? this.server.accessToken, options.videoId)
      video = res.body

      await wait(500)
    } while (video.isLive === true && video.state.id !== VideoState.PUBLISHED)
  }

  async countPlaylists (options: OverrideCommandOptions & {
    videoUUID: string
  }) {
    const basePath = buildServerDirectory(this.server, 'streaming-playlists')
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
      const res = await getVideoWithToken(this.server.url, options.token ?? this.server.accessToken, options.videoId)
      video = res.body

      await wait(500)
    } while (video.state.id !== options.state)
  }
}
