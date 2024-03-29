/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/no-floating-promises */

import validator from 'validator'
import { getAllPrivacies, omit, pick, wait } from '@peertube/peertube-core-utils'
import {
  HttpStatusCode,
  HttpStatusCodeType, ResultList,
  UserVideoRateType,
  Video,
  VideoCommentPolicy,
  VideoCreate,
  VideoCreateResult,
  VideoDetails,
  VideoFileMetadata,
  VideoInclude,
  VideoPrivacy,
  VideoPrivacyType,
  VideosCommonQuery,
  VideoSource,
  VideoTranscodingCreate
} from '@peertube/peertube-models'
import { buildAbsoluteFixturePath, buildUUID } from '@peertube/peertube-node-utils'
import { unwrapBody } from '../requests/index.js'
import { waitJobs } from '../server/jobs.js'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

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

    return this.getRequestBody<{ [id in VideoPrivacyType]: string }>({
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

  deleteSource (options: OverrideCommandOptions & {
    id: number | string
  }) {
    const path = '/api/v1/videos/' + options.id + '/source/file'

    return this.deleteRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  async getId (options: OverrideCommandOptions & {
    uuid: number | string
  }) {
    const { uuid } = options

    if (validator.default.isUUID('' + uuid) === false) return uuid as number

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
    autoTagOneOf?: string[]
  } = {}) {
    const path = '/api/v1/users/me/videos'

    return this.getRequestBody<ResultList<Video>>({
      ...options,

      path,
      query: pick(options, [ 'start', 'count', 'sort', 'search', 'isLive', 'channelId', 'autoTagOneOf' ]),
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
    const include = VideoInclude.NOT_PUBLISHED_STATE | VideoInclude.BLACKLISTED | VideoInclude.BLOCKED_OWNER | VideoInclude.AUTOMATIC_TAGS
    const nsfw = 'both'
    const privacyOneOf = getAllPrivacies()

    return this.list({
      include,
      nsfw,
      privacyOneOf,

      ...options,

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
    completedExpectedStatus?: HttpStatusCodeType
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
      commentsPolicy: VideoCommentPolicy.ENABLED,
      downloadEnabled: true,
      fixture: 'video_short.webm',

      ...options.attributes
    }

    const created = mode === 'legacy'
      ? await this.buildLegacyUpload({ ...options, attributes })
      : await this.buildResumeVideoUpload({
        ...options,
        path: '/api/v1/videos/upload-resumable',
        fixture: attributes.fixture,
        attaches: this.buildUploadAttaches(attributes, false),
        fields: this.buildUploadFields(attributes)
      })

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
      attaches: this.buildUploadAttaches(options.attributes, true),
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })).then(body => body.video || body as any)
  }

  quickUpload (options: OverrideCommandOptions & {
    name: string
    nsfw?: boolean
    privacy?: VideoPrivacyType
    fixture?: string
    videoPasswords?: string[]
    channelId?: number
  }) {
    const attributes: VideoEdit = { name: options.name }
    if (options.nsfw) attributes.nsfw = options.nsfw
    if (options.privacy) attributes.privacy = options.privacy
    if (options.fixture) attributes.fixture = options.fixture
    if (options.videoPasswords) attributes.videoPasswords = options.videoPasswords
    if (options.channelId) attributes.channelId = options.channelId

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

  replaceSourceFile (options: OverrideCommandOptions & {
    videoId: number | string
    fixture: string
    completedExpectedStatus?: HttpStatusCodeType
  }) {
    return this.buildResumeUpload({
      ...options,

      path: '/api/v1/videos/' + options.videoId + '/source/replace-resumable',
      fixture: options.fixture
    })
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

  removeAllWebVideoFiles (options: OverrideCommandOptions & {
    videoId: number | string
  }) {
    const path = '/api/v1/videos/' + options.videoId + '/web-videos'

    return this.deleteRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  removeWebVideoFile (options: OverrideCommandOptions & {
    videoId: number | string
    fileId: number
  }) {
    const path = '/api/v1/videos/' + options.videoId + '/web-videos/' + options.fileId

    return this.deleteRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  runTranscoding (options: OverrideCommandOptions & VideoTranscodingCreate & {
    videoId: number | string
  }) {
    const path = '/api/v1/videos/' + options.videoId + '/transcoding'

    return this.postBodyRequest({
      ...options,

      path,
      fields: pick(options, [ 'transcodingType', 'forceTranscoding' ]),
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
      'skipCount',
      'autoTagOneOf'
    ])
  }

  buildUploadFields (attributes: VideoEdit) {
    return omit(attributes, [ 'fixture', 'thumbnailfile', 'previewfile' ])
  }

  buildUploadAttaches (attributes: VideoEdit, includeFixture: boolean) {
    const attaches: { [ name: string ]: string } = {}

    for (const key of [ 'thumbnailfile', 'previewfile' ]) {
      if (attributes[key]) attaches[key] = buildAbsoluteFixturePath(attributes[key])
    }

    if (includeFixture && attributes.fixture) attaches.videofile = buildAbsoluteFixturePath(attributes.fixture)

    return attaches
  }

  // Make these methods public, needed by some offensive tests
  sendResumableVideoChunks (options: Parameters<AbstractCommand['sendResumableChunks']>[0]) {
    return super.sendResumableChunks<{ video: VideoCreateResult }>(options)
  }

  async buildResumeVideoUpload (
    options: Parameters<AbstractCommand['buildResumeUpload']>[0]
  ): Promise<VideoCreateResult> {
    const result = await super.buildResumeUpload<{ video: VideoCreateResult }>(options)

    return result?.video || result as any
  }

  prepareVideoResumableUpload (options: Parameters<AbstractCommand['prepareResumableUpload']>[0]) {
    return super.prepareResumableUpload(options)
  }

  endVideoResumableUpload (options: Parameters<AbstractCommand['endResumableUpload']>[0]) {
    return super.endResumableUpload(options)
  }
}
