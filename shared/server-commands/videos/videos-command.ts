/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/no-floating-promises */

import { expect } from 'chai'
import { createReadStream, stat } from 'fs-extra'
import got, { Response as GotResponse } from 'got'
import validator from 'validator'
import { buildAbsoluteFixturePath, getAllPrivacies, omit, pick, wait } from '@shared/core-utils'
import { buildUUID } from '@shared/extra-utils'
import {
  HttpStatusCode,
  ResultList,
  UserVideoRateType,
  Video,
  VideoCreate,
  VideoCreateResult,
  VideoDetails,
  VideoFileMetadata,
  VideoInclude,
  VideoPrivacy,
  VideosCommonQuery,
  VideoTranscodingCreate
} from '@shared/models'
import { VideoSource } from '@shared/models/videos/video-source'
import { unwrapBody } from '../requests'
import { waitJobs } from '../server'
import { AbstractCommand, OverrideCommandOptions } from '../shared'

export type VideoEdit = Partial<Omit<VideoCreate, 'thumbnailfile' | 'previewfile'>> & {
  fixture?: string
  thumbnailfile?: string
  previewfile?: string
}

export class VideosCommand extends AbstractCommand {
  getCategories (options: OverrideCommandOptions = {}) {
    const path = '/api/v1/videos/categories'

    return this.getRequestBody<{ [id: number]: string }>({
      ...options,
      path,

      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  getLicences (options: OverrideCommandOptions = {}) {
    const path = '/api/v1/videos/licences'

    return this.getRequestBody<{ [id: number]: string }>({
      ...options,
      path,

      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  getLanguages (options: OverrideCommandOptions = {}) {
    const path = '/api/v1/videos/languages'

    return this.getRequestBody<{ [id: string]: string }>({
      ...options,
      path,

      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  getPrivacies (options: OverrideCommandOptions = {}) {
    const path = '/api/v1/videos/privacies'

    return this.getRequestBody<{ [id in VideoPrivacy]: string }>({
      ...options,
      path,

      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  // ---------------------------------------------------------------------------

  getDescription (options: OverrideCommandOptions & {
    descriptionPath: string
  }) {
    return this.getRequestBody<{ description: string }>({
      ...options,
      path: options.descriptionPath,

      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  getFileMetadata (options: OverrideCommandOptions & {
    url: string
  }) {
    return unwrapBody<VideoFileMetadata>(this.getRawRequest({
      ...options,

      url: options.url,
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    }))
  }

  // ---------------------------------------------------------------------------

  rate (options: OverrideCommandOptions & {
    id: number | string
    rating: UserVideoRateType
    videoPassword?: string
  }) {
    const { id, rating, videoPassword } = options
    const path = '/api/v1/videos/' + id + '/rate'

    return this.putBodyRequest({
      ...options,

      path,
      fields: { rating },
      headers: this.buildVideoPasswordHeader(videoPassword),
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  // ---------------------------------------------------------------------------

  get (options: OverrideCommandOptions & {
    id: number | string
  }) {
    const path = '/api/v1/videos/' + options.id

    return this.getRequestBody<VideoDetails>({
      ...options,

      path,
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  getWithToken (options: OverrideCommandOptions & {
    id: number | string
  }) {
    return this.get({
      ...options,

      token: this.buildCommonRequestToken({ ...options, implicitToken: true })
    })
  }

  getWithPassword (options: OverrideCommandOptions & {
    id: number | string
    password?: string
  }) {
    const path = '/api/v1/videos/' + options.id

    return this.getRequestBody<VideoDetails>({
      ...options,
      headers:{
        'x-peertube-video-password': options.password
      },
      path,
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  getSource (options: OverrideCommandOptions & {
    id: number | string
  }) {
    const path = '/api/v1/videos/' + options.id + '/source'

    return this.getRequestBody<VideoSource>({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  async getId (options: OverrideCommandOptions & {
    uuid: number | string
  }) {
    const { uuid } = options

    if (validator.isUUID('' + uuid) === false) return uuid as number

    const { id } = await this.get({ ...options, id: uuid })

    return id
  }

  async listFiles (options: OverrideCommandOptions & {
    id: number | string
  }) {
    const video = await this.get(options)

    const files = video.files || []
    const hlsFiles = video.streamingPlaylists[0]?.files || []

    return files.concat(hlsFiles)
  }

  // ---------------------------------------------------------------------------

  listMyVideos (options: OverrideCommandOptions & {
    start?: number
    count?: number
    sort?: string
    search?: string
    isLive?: boolean
    channelId?: number
  } = {}) {
    const path = '/api/v1/users/me/videos'

    return this.getRequestBody<ResultList<Video>>({
      ...options,

      path,
      query: pick(options, [ 'start', 'count', 'sort', 'search', 'isLive', 'channelId' ]),
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  listMySubscriptionVideos (options: OverrideCommandOptions & VideosCommonQuery = {}) {
    const { sort = '-createdAt' } = options
    const path = '/api/v1/users/me/subscriptions/videos'

    return this.getRequestBody<ResultList<Video>>({
      ...options,

      path,
      query: { sort, ...this.buildListQuery(options) },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  // ---------------------------------------------------------------------------

  list (options: OverrideCommandOptions & VideosCommonQuery = {}) {
    const path = '/api/v1/videos'

    const query = this.buildListQuery(options)

    return this.getRequestBody<ResultList<Video>>({
      ...options,

      path,
      query: { sort: 'name', ...query },
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  listWithToken (options: OverrideCommandOptions & VideosCommonQuery = {}) {
    return this.list({
      ...options,

      token: this.buildCommonRequestToken({ ...options, implicitToken: true })
    })
  }

  listAllForAdmin (options: OverrideCommandOptions & VideosCommonQuery = {}) {
    const include = VideoInclude.NOT_PUBLISHED_STATE | VideoInclude.BLACKLISTED | VideoInclude.BLOCKED_OWNER
    const nsfw = 'both'
    const privacyOneOf = getAllPrivacies()

    return this.list({
      ...options,

      include,
      nsfw,
      privacyOneOf,

      token: this.buildCommonRequestToken({ ...options, implicitToken: true })
    })
  }

  listByAccount (options: OverrideCommandOptions & VideosCommonQuery & {
    handle: string
  }) {
    const { handle, search } = options
    const path = '/api/v1/accounts/' + handle + '/videos'

    return this.getRequestBody<ResultList<Video>>({
      ...options,

      path,
      query: { search, ...this.buildListQuery(options) },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  listByChannel (options: OverrideCommandOptions & VideosCommonQuery & {
    handle: string
  }) {
    const { handle } = options
    const path = '/api/v1/video-channels/' + handle + '/videos'

    return this.getRequestBody<ResultList<Video>>({
      ...options,

      path,
      query: this.buildListQuery(options),
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  // ---------------------------------------------------------------------------

  async find (options: OverrideCommandOptions & {
    name: string
  }) {
    const { data } = await this.list(options)

    return data.find(v => v.name === options.name)
  }

  // ---------------------------------------------------------------------------

  update (options: OverrideCommandOptions & {
    id: number | string
    attributes?: VideoEdit
  }) {
    const { id, attributes = {} } = options
    const path = '/api/v1/videos/' + id

    // Upload request
    if (attributes.thumbnailfile || attributes.previewfile) {
      const attaches: any = {}
      if (attributes.thumbnailfile) attaches.thumbnailfile = attributes.thumbnailfile
      if (attributes.previewfile) attaches.previewfile = attributes.previewfile

      return this.putUploadRequest({
        ...options,

        path,
        fields: options.attributes,
        attaches: {
          thumbnailfile: attributes.thumbnailfile,
          previewfile: attributes.previewfile
        },
        implicitToken: true,
        defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
      })
    }

    return this.putBodyRequest({
      ...options,

      path,
      fields: options.attributes,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  remove (options: OverrideCommandOptions & {
    id: number | string
  }) {
    const path = '/api/v1/videos/' + options.id

    return unwrapBody(this.deleteRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    }))
  }

  async removeAll () {
    const { data } = await this.list()

    for (const v of data) {
      await this.remove({ id: v.id })
    }
  }

  // ---------------------------------------------------------------------------

  async upload (options: OverrideCommandOptions & {
    attributes?: VideoEdit
    mode?: 'legacy' | 'resumable' // default legacy
    waitTorrentGeneration?: boolean // default true
  } = {}) {
    const { mode = 'legacy', waitTorrentGeneration = true } = options
    let defaultChannelId = 1

    try {
      const { videoChannels } = await this.server.users.getMyInfo({ token: options.token })
      defaultChannelId = videoChannels[0].id
    } catch (e) { /* empty */ }

    // Override default attributes
    const attributes = {
      name: 'my super video',
      category: 5,
      licence: 4,
      language: 'zh',
      channelId: defaultChannelId,
      nsfw: true,
      waitTranscoding: false,
      description: 'my super description',
      support: 'my super support text',
      tags: [ 'tag' ],
      privacy: VideoPrivacy.PUBLIC,
      commentsEnabled: true,
      downloadEnabled: true,
      fixture: 'video_short.webm',

      ...options.attributes
    }

    const created = mode === 'legacy'
      ? await this.buildLegacyUpload({ ...options, attributes })
      : await this.buildResumeUpload({ ...options, attributes })

    // Wait torrent generation
    const expectedStatus = this.buildExpectedStatus({ ...options, defaultExpectedStatus: HttpStatusCode.OK_200 })
    if (expectedStatus === HttpStatusCode.OK_200 && waitTorrentGeneration) {
      let video: VideoDetails

      do {
        video = await this.getWithToken({ ...options, id: created.uuid })

        await wait(50)
      } while (!video.files[0].torrentUrl)
    }

    return created
  }

  async buildLegacyUpload (options: OverrideCommandOptions & {
    attributes: VideoEdit
  }): Promise<VideoCreateResult> {
    const path = '/api/v1/videos/upload'

    return unwrapBody<{ video: VideoCreateResult }>(this.postUploadRequest({
      ...options,

      path,
      fields: this.buildUploadFields(options.attributes),
      attaches: this.buildUploadAttaches(options.attributes),
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })).then(body => body.video || body as any)
  }

  async buildResumeUpload (options: OverrideCommandOptions & {
    attributes: VideoEdit
  }): Promise<VideoCreateResult> {
    const { attributes, expectedStatus } = options

    let size = 0
    let videoFilePath: string
    let mimetype = 'video/mp4'

    if (attributes.fixture) {
      videoFilePath = buildAbsoluteFixturePath(attributes.fixture)
      size = (await stat(videoFilePath)).size

      if (videoFilePath.endsWith('.mkv')) {
        mimetype = 'video/x-matroska'
      } else if (videoFilePath.endsWith('.webm')) {
        mimetype = 'video/webm'
      }
    }

    // Do not check status automatically, we'll check it manually
    const initializeSessionRes = await this.prepareResumableUpload({ ...options, expectedStatus: null, attributes, size, mimetype })
    const initStatus = initializeSessionRes.status

    if (videoFilePath && initStatus === HttpStatusCode.CREATED_201) {
      const locationHeader = initializeSessionRes.header['location']
      expect(locationHeader).to.not.be.undefined

      const pathUploadId = locationHeader.split('?')[1]

      const result = await this.sendResumableChunks({ ...options, pathUploadId, videoFilePath, size })

      if (result.statusCode === HttpStatusCode.OK_200) {
        await this.endResumableUpload({ ...options, expectedStatus: HttpStatusCode.NO_CONTENT_204, pathUploadId })
      }

      return result.body?.video || result.body as any
    }

    const expectedInitStatus = expectedStatus === HttpStatusCode.OK_200
      ? HttpStatusCode.CREATED_201
      : expectedStatus

    expect(initStatus).to.equal(expectedInitStatus)

    return initializeSessionRes.body.video || initializeSessionRes.body
  }

  async prepareResumableUpload (options: OverrideCommandOptions & {
    attributes: VideoEdit
    size: number
    mimetype: string

    originalName?: string
    lastModified?: number
  }) {
    const { attributes, originalName, lastModified, size, mimetype } = options

    const path = '/api/v1/videos/upload-resumable'

    return this.postUploadRequest({
      ...options,

      path,
      headers: {
        'X-Upload-Content-Type': mimetype,
        'X-Upload-Content-Length': size.toString()
      },
      fields: {
        filename: attributes.fixture,
        originalName,
        lastModified,

        ...this.buildUploadFields(options.attributes)
      },

      // Fixture will be sent later
      attaches: this.buildUploadAttaches(omit(options.attributes, [ 'fixture' ])),
      implicitToken: true,

      defaultExpectedStatus: null
    })
  }

  sendResumableChunks (options: OverrideCommandOptions & {
    pathUploadId: string
    videoFilePath: string
    size: number
    contentLength?: number
    contentRangeBuilder?: (start: number, chunk: any) => string
    digestBuilder?: (chunk: any) => string
  }) {
    const {
      pathUploadId,
      videoFilePath,
      size,
      contentLength,
      contentRangeBuilder,
      digestBuilder,
      expectedStatus = HttpStatusCode.OK_200
    } = options

    const path = '/api/v1/videos/upload-resumable'
    let start = 0

    const token = this.buildCommonRequestToken({ ...options, implicitToken: true })
    const url = this.server.url

    const readable = createReadStream(videoFilePath, { highWaterMark: 8 * 1024 })
    return new Promise<GotResponse<{ video: VideoCreateResult }>>((resolve, reject) => {
      readable.on('data', async function onData (chunk) {
        readable.pause()

        const headers = {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/octet-stream',
          'Content-Range': contentRangeBuilder
            ? contentRangeBuilder(start, chunk)
            : `bytes ${start}-${start + chunk.length - 1}/${size}`,
          'Content-Length': contentLength ? contentLength + '' : chunk.length + ''
        }

        if (digestBuilder) {
          Object.assign(headers, { digest: digestBuilder(chunk) })
        }

        const res = await got<{ video: VideoCreateResult }>({
          url,
          method: 'put',
          headers,
          path: path + '?' + pathUploadId,
          body: chunk,
          responseType: 'json',
          throwHttpErrors: false
        })

        start += chunk.length

        if (res.statusCode === expectedStatus) {
          return resolve(res)
        }

        if (res.statusCode !== HttpStatusCode.PERMANENT_REDIRECT_308) {
          readable.off('data', onData)
          return reject(new Error('Incorrect transient behaviour sending intermediary chunks'))
        }

        readable.resume()
      })
    })
  }

  endResumableUpload (options: OverrideCommandOptions & {
    pathUploadId: string
  }) {
    return this.deleteRequest({
      ...options,

      path: '/api/v1/videos/upload-resumable',
      rawQuery: options.pathUploadId,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  quickUpload (options: OverrideCommandOptions & {
    name: string
    nsfw?: boolean
    privacy?: VideoPrivacy
    fixture?: string
    videoPasswords?: string[]
  }) {
    const attributes: VideoEdit = { name: options.name }
    if (options.nsfw) attributes.nsfw = options.nsfw
    if (options.privacy) attributes.privacy = options.privacy
    if (options.fixture) attributes.fixture = options.fixture
    if (options.videoPasswords) attributes.videoPasswords = options.videoPasswords

    return this.upload({ ...options, attributes })
  }

  async randomUpload (options: OverrideCommandOptions & {
    wait?: boolean // default true
    additionalParams?: VideoEdit & { prefixName?: string }
  } = {}) {
    const { wait = true, additionalParams } = options
    const prefixName = additionalParams?.prefixName || ''
    const name = prefixName + buildUUID()

    const attributes = { name, ...additionalParams }

    const result = await this.upload({ ...options, attributes })

    if (wait) await waitJobs([ this.server ])

    return { ...result, name }
  }

  // ---------------------------------------------------------------------------

  removeHLSPlaylist (options: OverrideCommandOptions & {
    videoId: number | string
  }) {
    const path = '/api/v1/videos/' + options.videoId + '/hls'

    return this.deleteRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  removeHLSFile (options: OverrideCommandOptions & {
    videoId: number | string
    fileId: number
  }) {
    const path = '/api/v1/videos/' + options.videoId + '/hls/' + options.fileId

    return this.deleteRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  removeAllWebTorrentFiles (options: OverrideCommandOptions & {
    videoId: number | string
  }) {
    const path = '/api/v1/videos/' + options.videoId + '/webtorrent'

    return this.deleteRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  removeWebTorrentFile (options: OverrideCommandOptions & {
    videoId: number | string
    fileId: number
  }) {
    const path = '/api/v1/videos/' + options.videoId + '/webtorrent/' + options.fileId

    return this.deleteRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  runTranscoding (options: OverrideCommandOptions & {
    videoId: number | string
    transcodingType: 'hls' | 'webtorrent'
  }) {
    const path = '/api/v1/videos/' + options.videoId + '/transcoding'

    const fields: VideoTranscodingCreate = pick(options, [ 'transcodingType' ])

    return this.postBodyRequest({
      ...options,

      path,
      fields,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  // ---------------------------------------------------------------------------

  private buildListQuery (options: VideosCommonQuery) {
    return pick(options, [
      'start',
      'count',
      'sort',
      'nsfw',
      'isLive',
      'categoryOneOf',
      'licenceOneOf',
      'languageOneOf',
      'privacyOneOf',
      'tagsOneOf',
      'tagsAllOf',
      'isLocal',
      'include',
      'skipCount'
    ])
  }

  private buildUploadFields (attributes: VideoEdit) {
    return omit(attributes, [ 'fixture', 'thumbnailfile', 'previewfile' ])
  }

  private buildUploadAttaches (attributes: VideoEdit) {
    const attaches: { [ name: string ]: string } = {}

    for (const key of [ 'thumbnailfile', 'previewfile' ]) {
      if (attributes[key]) attaches[key] = buildAbsoluteFixturePath(attributes[key])
    }

    if (attributes.fixture) attaches.videofile = buildAbsoluteFixturePath(attributes.fixture)

    return attaches
  }
}
