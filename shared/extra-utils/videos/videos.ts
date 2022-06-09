/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/no-floating-promises */

import { expect } from 'chai'
import { createReadStream, pathExists, readdir, readFile, stat } from 'fs-extra'
import got, { Response as GotResponse } from 'got/dist/source'
import * as parseTorrent from 'parse-torrent'
import { join } from 'path'
import * as request from 'supertest'
import validator from 'validator'
import { getLowercaseExtension } from '@server/helpers/core-utils'
import { buildUUID } from '@server/helpers/uuid'
import { HttpStatusCode } from '@shared/core-utils'
import { VideosCommonQuery } from '@shared/models'
import { loadLanguages, VIDEO_CATEGORIES, VIDEO_LANGUAGES, VIDEO_LICENCES, VIDEO_PRIVACIES } from '../../../server/initializers/constants'
import { VideoDetails, VideoPrivacy } from '../../models/videos'
import {
  buildAbsoluteFixturePath,
  buildServerDirectory,
  dateIsValid,
  immutableAssign,
  testImage,
  wait,
  webtorrentAdd
} from '../miscs/miscs'
import { makeGetRequest, makePutBodyRequest, makeRawRequest, makeUploadRequest } from '../requests/requests'
import { waitJobs } from '../server/jobs'
import { ServerInfo } from '../server/servers'
import { getMyUserInformation } from '../users/users'

loadLanguages()

type VideoAttributes = {
  name?: string
  category?: number
  licence?: number
  language?: string
  nsfw?: boolean
  commentsEnabled?: boolean
  downloadEnabled?: boolean
  waitTranscoding?: boolean
  description?: string
  originallyPublishedAt?: string
  tags?: string[]
  channelId?: number
  privacy?: VideoPrivacy
  fixture?: string
  support?: string
  thumbnailfile?: string
  previewfile?: string
  scheduleUpdate?: {
    updateAt: string
    privacy?: VideoPrivacy
  }
}

function getVideoCategories (url: string) {
  const path = '/api/v1/videos/categories'

  return makeGetRequest({
    url,
    path,
    statusCodeExpected: HttpStatusCode.OK_200
  })
}

function getVideoLicences (url: string) {
  const path = '/api/v1/videos/licences'

  return makeGetRequest({
    url,
    path,
    statusCodeExpected: HttpStatusCode.OK_200
  })
}

function getVideoLanguages (url: string) {
  const path = '/api/v1/videos/languages'

  return makeGetRequest({
    url,
    path,
    statusCodeExpected: HttpStatusCode.OK_200
  })
}

function getVideoPrivacies (url: string) {
  const path = '/api/v1/videos/privacies'

  return makeGetRequest({
    url,
    path,
    statusCodeExpected: HttpStatusCode.OK_200
  })
}

function getVideo (url: string, id: number | string, expectedStatus = HttpStatusCode.OK_200) {
  const path = '/api/v1/videos/' + id

  return request(url)
          .get(path)
          .set('Accept', 'application/json')
          .expect(expectedStatus)
}

async function getVideoIdFromUUID (url: string, uuid: string) {
  const res = await getVideo(url, uuid)

  return res.body.id
}

function getVideoFileMetadataUrl (url: string) {
  return request(url)
    .get('/')
    .set('Accept', 'application/json')
    .expect(HttpStatusCode.OK_200)
    .expect('Content-Type', /json/)
}

function viewVideo (url: string, id: number | string, expectedStatus = HttpStatusCode.NO_CONTENT_204, xForwardedFor?: string) {
  const path = '/api/v1/videos/' + id + '/views'

  const req = request(url)
    .post(path)
    .set('Accept', 'application/json')

  if (xForwardedFor) {
    req.set('X-Forwarded-For', xForwardedFor)
  }

  return req.expect(expectedStatus)
}

function getVideoWithToken (url: string, token: string, id: number | string, expectedStatus = HttpStatusCode.OK_200) {
  const path = '/api/v1/videos/' + id

  return request(url)
    .get(path)
    .set('Authorization', 'Bearer ' + token)
    .set('Accept', 'application/json')
    .expect(expectedStatus)
}

function getVideoDescription (url: string, descriptionPath: string) {
  return request(url)
    .get(descriptionPath)
    .set('Accept', 'application/json')
    .expect(HttpStatusCode.OK_200)
    .expect('Content-Type', /json/)
}

function getVideosList (url: string) {
  const path = '/api/v1/videos'

  return request(url)
          .get(path)
          .query({ sort: 'name' })
          .set('Accept', 'application/json')
          .expect(HttpStatusCode.OK_200)
          .expect('Content-Type', /json/)
}

function getVideosListWithToken (url: string, token: string, query: { nsfw?: boolean } = {}) {
  const path = '/api/v1/videos'

  return request(url)
    .get(path)
    .set('Authorization', 'Bearer ' + token)
    .query(immutableAssign(query, { sort: 'name' }))
    .set('Accept', 'application/json')
    .expect(HttpStatusCode.OK_200)
    .expect('Content-Type', /json/)
}

function getLocalVideos (url: string) {
  const path = '/api/v1/videos'

  return request(url)
    .get(path)
    .query({ sort: 'name', filter: 'local' })
    .set('Accept', 'application/json')
    .expect(HttpStatusCode.OK_200)
    .expect('Content-Type', /json/)
}

function getMyVideos (url: string, accessToken: string, start: number, count: number, sort?: string, search?: string) {
  const path = '/api/v1/users/me/videos'

  const req = request(url)
    .get(path)
    .query({ start: start })
    .query({ count: count })
    .query({ search: search })

  if (sort) req.query({ sort })

  return req.set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + accessToken)
    .expect(HttpStatusCode.OK_200)
    .expect('Content-Type', /json/)
}

function getMyVideosWithFilter (url: string, accessToken: string, query: { isLive?: boolean }) {
  const path = '/api/v1/users/me/videos'

  return makeGetRequest({
    url,
    path,
    token: accessToken,
    query,
    statusCodeExpected: HttpStatusCode.OK_200
  })
}

function getAccountVideos (
  url: string,
  accessToken: string,
  accountName: string,
  start: number,
  count: number,
  sort?: string,
  query: {
    nsfw?: boolean
    search?: string
  } = {}
) {
  const path = '/api/v1/accounts/' + accountName + '/videos'

  return makeGetRequest({
    url,
    path,
    query: immutableAssign(query, {
      start,
      count,
      sort
    }),
    token: accessToken,
    statusCodeExpected: HttpStatusCode.OK_200
  })
}

function getVideoChannelVideos (
  url: string,
  accessToken: string,
  videoChannelName: string,
  start: number,
  count: number,
  sort?: string,
  query: { nsfw?: boolean } = {}
) {
  const path = '/api/v1/video-channels/' + videoChannelName + '/videos'

  return makeGetRequest({
    url,
    path,
    query: immutableAssign(query, {
      start,
      count,
      sort
    }),
    token: accessToken,
    statusCodeExpected: HttpStatusCode.OK_200
  })
}

function getPlaylistVideos (
  url: string,
  accessToken: string,
  playlistId: number | string,
  start: number,
  count: number,
  query: { nsfw?: boolean } = {}
) {
  const path = '/api/v1/video-playlists/' + playlistId + '/videos'

  return makeGetRequest({
    url,
    path,
    query: immutableAssign(query, {
      start,
      count
    }),
    token: accessToken,
    statusCodeExpected: HttpStatusCode.OK_200
  })
}

function getVideosListPagination (url: string, start: number, count: number, sort?: string, skipCount?: boolean) {
  const path = '/api/v1/videos'

  const req = request(url)
              .get(path)
              .query({ start: start })
              .query({ count: count })

  if (sort) req.query({ sort })
  if (skipCount) req.query({ skipCount })

  return req.set('Accept', 'application/json')
           .expect(HttpStatusCode.OK_200)
           .expect('Content-Type', /json/)
}

function getVideosListSort (url: string, sort: string) {
  const path = '/api/v1/videos'

  return request(url)
          .get(path)
          .query({ sort: sort })
          .set('Accept', 'application/json')
          .expect(HttpStatusCode.OK_200)
          .expect('Content-Type', /json/)
}

function getVideosWithFilters (url: string, query: VideosCommonQuery) {
  const path = '/api/v1/videos'

  return request(url)
    .get(path)
    .query(query)
    .set('Accept', 'application/json')
    .expect(HttpStatusCode.OK_200)
    .expect('Content-Type', /json/)
}

function removeVideo (url: string, token: string, id: number | string, expectedStatus = HttpStatusCode.NO_CONTENT_204) {
  const path = '/api/v1/videos'

  return request(url)
          .delete(path + '/' + id)
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer ' + token)
          .expect(expectedStatus)
}

async function removeAllVideos (server: ServerInfo) {
  const resVideos = await getVideosList(server.url)

  for (const v of resVideos.body.data) {
    await removeVideo(server.url, server.accessToken, v.id)
  }
}

async function checkVideoFilesWereRemoved (
  videoUUID: string,
  serverNumber: number,
  directories = [
    'redundancy',
    'videos',
    'thumbnails',
    'torrents',
    'previews',
    'captions',
    join('playlists', 'hls'),
    join('redundancy', 'hls')
  ]
) {
  for (const directory of directories) {
    const directoryPath = buildServerDirectory({ internalServerNumber: serverNumber }, directory)

    const directoryExists = await pathExists(directoryPath)
    if (directoryExists === false) continue

    const files = await readdir(directoryPath)
    for (const file of files) {
      expect(file, `File ${file} should not exist in ${directoryPath}`).to.not.contain(videoUUID)
    }
  }
}

async function uploadVideo (
  url: string,
  accessToken: string,
  videoAttributesArg: VideoAttributes,
  specialStatus = HttpStatusCode.OK_200,
  mode: 'legacy' | 'resumable' = 'legacy'
) {
  let defaultChannelId = '1'

  try {
    const res = await getMyUserInformation(url, accessToken)
    defaultChannelId = res.body.videoChannels[0].id
  } catch (e) { /* empty */ }

  // Override default attributes
  const attributes = Object.assign({
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
    fixture: 'video_short.webm'
  }, videoAttributesArg)

  const res = mode === 'legacy'
    ? await buildLegacyUpload(url, accessToken, attributes, specialStatus)
    : await buildResumeUpload(url, accessToken, attributes, specialStatus)

  // Wait torrent generation
  if (specialStatus === HttpStatusCode.OK_200) {
    let video: VideoDetails
    do {
      const resVideo = await getVideoWithToken(url, accessToken, res.body.video.uuid)
      video = resVideo.body

      await wait(50)
    } while (!video.files[0].torrentUrl)
  }

  return res
}

function checkUploadVideoParam (
  url: string,
  token: string,
  attributes: Partial<VideoAttributes>,
  specialStatus = HttpStatusCode.OK_200,
  mode: 'legacy' | 'resumable' = 'legacy'
) {
  return mode === 'legacy'
    ? buildLegacyUpload(url, token, attributes, specialStatus)
    : buildResumeUpload(url, token, attributes, specialStatus)
}

async function buildLegacyUpload (url: string, token: string, attributes: VideoAttributes, specialStatus = HttpStatusCode.OK_200) {
  const path = '/api/v1/videos/upload'
  const req = request(url)
              .post(path)
              .set('Accept', 'application/json')
              .set('Authorization', 'Bearer ' + token)

  buildUploadReq(req, attributes)

  if (attributes.fixture !== undefined) {
    req.attach('videofile', buildAbsoluteFixturePath(attributes.fixture))
  }

  return req.expect(specialStatus)
}

async function buildResumeUpload (url: string, token: string, attributes: VideoAttributes, specialStatus = HttpStatusCode.OK_200) {
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

  const initializeSessionRes = await prepareResumableUpload({ url, token, attributes, size, mimetype })
  const initStatus = initializeSessionRes.status

  if (videoFilePath && initStatus === HttpStatusCode.CREATED_201) {
    const locationHeader = initializeSessionRes.header['location']
    expect(locationHeader).to.not.be.undefined

    const pathUploadId = locationHeader.split('?')[1]

    return sendResumableChunks({ url, token, pathUploadId, videoFilePath, size, specialStatus })
  }

  const expectedInitStatus = specialStatus === HttpStatusCode.OK_200
    ? HttpStatusCode.CREATED_201
    : specialStatus

  expect(initStatus).to.equal(expectedInitStatus)

  return initializeSessionRes
}

async function prepareResumableUpload (options: {
  url: string
  token: string
  attributes: VideoAttributes
  size: number
  mimetype: string
}) {
  const { url, token, attributes, size, mimetype } = options

  const path = '/api/v1/videos/upload-resumable'

  const req = request(url)
              .post(path)
              .set('Authorization', 'Bearer ' + token)
              .set('X-Upload-Content-Type', mimetype)
              .set('X-Upload-Content-Length', size.toString())

  buildUploadReq(req, attributes)

  if (attributes.fixture) {
    req.field('filename', attributes.fixture)
  }

  return req
}

function sendResumableChunks (options: {
  url: string
  token: string
  pathUploadId: string
  videoFilePath: string
  size: number
  specialStatus?: HttpStatusCode
  contentLength?: number
  contentRangeBuilder?: (start: number, chunk: any) => string
}) {
  const { url, token, pathUploadId, videoFilePath, size, specialStatus, contentLength, contentRangeBuilder } = options

  const expectedStatus = specialStatus || HttpStatusCode.OK_200

  const path = '/api/v1/videos/upload-resumable'
  let start = 0

  const readable = createReadStream(videoFilePath, { highWaterMark: 8 * 1024 })
  return new Promise<GotResponse>((resolve, reject) => {
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

      const res = await got({
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

function updateVideo (
  url: string,
  accessToken: string,
  id: number | string,
  attributes: VideoAttributes,
  statusCodeExpected = HttpStatusCode.NO_CONTENT_204
) {
  const path = '/api/v1/videos/' + id
  const body = {}

  if (attributes.name) body['name'] = attributes.name
  if (attributes.category) body['category'] = attributes.category
  if (attributes.licence) body['licence'] = attributes.licence
  if (attributes.language) body['language'] = attributes.language
  if (attributes.nsfw !== undefined) body['nsfw'] = JSON.stringify(attributes.nsfw)
  if (attributes.commentsEnabled !== undefined) body['commentsEnabled'] = JSON.stringify(attributes.commentsEnabled)
  if (attributes.downloadEnabled !== undefined) body['downloadEnabled'] = JSON.stringify(attributes.downloadEnabled)
  if (attributes.originallyPublishedAt !== undefined) body['originallyPublishedAt'] = attributes.originallyPublishedAt
  if (attributes.description) body['description'] = attributes.description
  if (attributes.tags) body['tags'] = attributes.tags
  if (attributes.privacy) body['privacy'] = attributes.privacy
  if (attributes.channelId) body['channelId'] = attributes.channelId
  if (attributes.scheduleUpdate) body['scheduleUpdate'] = attributes.scheduleUpdate

  // Upload request
  if (attributes.thumbnailfile || attributes.previewfile) {
    const attaches: any = {}
    if (attributes.thumbnailfile) attaches.thumbnailfile = attributes.thumbnailfile
    if (attributes.previewfile) attaches.previewfile = attributes.previewfile

    return makeUploadRequest({
      url,
      method: 'PUT',
      path,
      token: accessToken,
      fields: body,
      attaches,
      statusCodeExpected
    })
  }

  return makePutBodyRequest({
    url,
    path,
    fields: body,
    token: accessToken,
    statusCodeExpected
  })
}

function rateVideo (url: string, accessToken: string, id: number | string, rating: string, specialStatus = HttpStatusCode.NO_CONTENT_204) {
  const path = '/api/v1/videos/' + id + '/rate'

  return request(url)
          .put(path)
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer ' + accessToken)
          .send({ rating })
          .expect(specialStatus)
}

function parseTorrentVideo (server: ServerInfo, videoUUID: string, resolution: number) {
  return new Promise<any>((res, rej) => {
    const torrentName = videoUUID + '-' + resolution + '.torrent'
    const torrentPath = buildServerDirectory(server, join('torrents', torrentName))

    readFile(torrentPath, (err, data) => {
      if (err) return rej(err)

      return res(parseTorrent(data))
    })
  })
}

async function completeVideoCheck (
  url: string,
  video: any,
  attributes: {
    name: string
    category: number
    licence: number
    language: string
    nsfw: boolean
    commentsEnabled: boolean
    downloadEnabled: boolean
    description: string
    publishedAt?: string
    support: string
    originallyPublishedAt?: string
    account: {
      name: string
      host: string
    }
    isLocal: boolean
    tags: string[]
    privacy: number
    likes?: number
    dislikes?: number
    duration: number
    channel: {
      displayName: string
      name: string
      description
      isLocal: boolean
    }
    fixture: string
    files: {
      resolution: number
      size: number
    }[]
    thumbnailfile?: string
    previewfile?: string
  }
) {
  if (!attributes.likes) attributes.likes = 0
  if (!attributes.dislikes) attributes.dislikes = 0

  const host = new URL(url).host
  const originHost = attributes.account.host

  expect(video.name).to.equal(attributes.name)
  expect(video.category.id).to.equal(attributes.category)
  expect(video.category.label).to.equal(attributes.category !== null ? VIDEO_CATEGORIES[attributes.category] : 'Misc')
  expect(video.licence.id).to.equal(attributes.licence)
  expect(video.licence.label).to.equal(attributes.licence !== null ? VIDEO_LICENCES[attributes.licence] : 'Unknown')
  expect(video.language.id).to.equal(attributes.language)
  expect(video.language.label).to.equal(attributes.language !== null ? VIDEO_LANGUAGES[attributes.language] : 'Unknown')
  expect(video.privacy.id).to.deep.equal(attributes.privacy)
  expect(video.privacy.label).to.deep.equal(VIDEO_PRIVACIES[attributes.privacy])
  expect(video.nsfw).to.equal(attributes.nsfw)
  expect(video.description).to.equal(attributes.description)
  expect(video.account.id).to.be.a('number')
  expect(video.account.host).to.equal(attributes.account.host)
  expect(video.account.name).to.equal(attributes.account.name)
  expect(video.channel.displayName).to.equal(attributes.channel.displayName)
  expect(video.channel.name).to.equal(attributes.channel.name)
  expect(video.likes).to.equal(attributes.likes)
  expect(video.dislikes).to.equal(attributes.dislikes)
  expect(video.isLocal).to.equal(attributes.isLocal)
  expect(video.duration).to.equal(attributes.duration)
  expect(dateIsValid(video.createdAt)).to.be.true
  expect(dateIsValid(video.publishedAt)).to.be.true
  expect(dateIsValid(video.updatedAt)).to.be.true

  if (attributes.publishedAt) {
    expect(video.publishedAt).to.equal(attributes.publishedAt)
  }

  if (attributes.originallyPublishedAt) {
    expect(video.originallyPublishedAt).to.equal(attributes.originallyPublishedAt)
  } else {
    expect(video.originallyPublishedAt).to.be.null
  }

  const res = await getVideo(url, video.uuid)
  const videoDetails: VideoDetails = res.body

  expect(videoDetails.files).to.have.lengthOf(attributes.files.length)
  expect(videoDetails.tags).to.deep.equal(attributes.tags)
  expect(videoDetails.account.name).to.equal(attributes.account.name)
  expect(videoDetails.account.host).to.equal(attributes.account.host)
  expect(video.channel.displayName).to.equal(attributes.channel.displayName)
  expect(video.channel.name).to.equal(attributes.channel.name)
  expect(videoDetails.channel.host).to.equal(attributes.account.host)
  expect(videoDetails.channel.isLocal).to.equal(attributes.channel.isLocal)
  expect(dateIsValid(videoDetails.channel.createdAt.toString())).to.be.true
  expect(dateIsValid(videoDetails.channel.updatedAt.toString())).to.be.true
  expect(videoDetails.commentsEnabled).to.equal(attributes.commentsEnabled)
  expect(videoDetails.downloadEnabled).to.equal(attributes.downloadEnabled)

  for (const attributeFile of attributes.files) {
    const file = videoDetails.files.find(f => f.resolution.id === attributeFile.resolution)
    expect(file).not.to.be.undefined

    let extension = getLowercaseExtension(attributes.fixture)
    // Transcoding enabled: extension will always be .mp4
    if (attributes.files.length > 1) extension = '.mp4'

    expect(file.magnetUri).to.have.lengthOf.above(2)

    expect(file.torrentDownloadUrl).to.equal(`http://${host}/download/torrents/${videoDetails.uuid}-${file.resolution.id}.torrent`)
    expect(file.torrentUrl).to.equal(`http://${host}/lazy-static/torrents/${videoDetails.uuid}-${file.resolution.id}.torrent`)

    expect(file.fileUrl).to.equal(`http://${originHost}/static/webseed/${videoDetails.uuid}-${file.resolution.id}${extension}`)
    expect(file.fileDownloadUrl).to.equal(`http://${originHost}/download/videos/${videoDetails.uuid}-${file.resolution.id}${extension}`)

    await Promise.all([
      makeRawRequest(file.torrentUrl, 200),
      makeRawRequest(file.torrentDownloadUrl, 200),
      makeRawRequest(file.metadataUrl, 200),
      // Backward compatibility
      makeRawRequest(`http://${originHost}/static/torrents/${videoDetails.uuid}-${file.resolution.id}.torrent`, 200)
    ])

    expect(file.resolution.id).to.equal(attributeFile.resolution)
    expect(file.resolution.label).to.equal(attributeFile.resolution + 'p')

    const minSize = attributeFile.size - ((10 * attributeFile.size) / 100)
    const maxSize = attributeFile.size + ((10 * attributeFile.size) / 100)
    expect(
      file.size,
      'File size for resolution ' + file.resolution.label + ' outside confidence interval (' + minSize + '> size <' + maxSize + ')'
    ).to.be.above(minSize).and.below(maxSize)

    const torrent = await webtorrentAdd(file.magnetUri, true)
    expect(torrent.files).to.be.an('array')
    expect(torrent.files.length).to.equal(1)
    expect(torrent.files[0].path).to.exist.and.to.not.equal('')
  }

  expect(videoDetails.thumbnailPath).to.exist
  await testImage(url, attributes.thumbnailfile || attributes.fixture, videoDetails.thumbnailPath)

  if (attributes.previewfile) {
    expect(videoDetails.previewPath).to.exist
    await testImage(url, attributes.previewfile, videoDetails.previewPath)
  }
}

async function videoUUIDToId (url: string, id: number | string) {
  if (validator.isUUID('' + id) === false) return id

  const res = await getVideo(url, id)
  return res.body.id
}

async function uploadVideoAndGetId (options: {
  server: ServerInfo
  videoName: string
  nsfw?: boolean
  privacy?: VideoPrivacy
  token?: string
  fixture?: string
}) {
  const videoAttrs: any = { name: options.videoName }
  if (options.nsfw) videoAttrs.nsfw = options.nsfw
  if (options.privacy) videoAttrs.privacy = options.privacy
  if (options.fixture) videoAttrs.fixture = options.fixture

  const res = await uploadVideo(options.server.url, options.token || options.server.accessToken, videoAttrs)

  return res.body.video as { id: number, uuid: string, shortUUID: string }
}

async function getLocalIdByUUID (url: string, uuid: string) {
  const res = await getVideo(url, uuid)

  return res.body.id
}

// serverNumber starts from 1
async function uploadRandomVideoOnServers (servers: ServerInfo[], serverNumber: number, additionalParams: any = {}) {
  const server = servers.find(s => s.serverNumber === serverNumber)
  const res = await uploadRandomVideo(server, false, additionalParams)

  await waitJobs(servers)

  return res
}

async function uploadRandomVideo (server: ServerInfo, wait = true, additionalParams: any = {}) {
  const prefixName = additionalParams.prefixName || ''
  const name = prefixName + buildUUID()

  const data = Object.assign({ name }, additionalParams)
  const res = await uploadVideo(server.url, server.accessToken, data)

  if (wait) await waitJobs([ server ])

  return { uuid: res.body.video.uuid, name }
}

// ---------------------------------------------------------------------------

export {
  getVideoDescription,
  getVideoCategories,
  uploadRandomVideo,
  getVideoLicences,
  videoUUIDToId,
  getVideoPrivacies,
  getVideoLanguages,
  getMyVideos,
  getAccountVideos,
  getVideoChannelVideos,
  getVideo,
  getVideoFileMetadataUrl,
  getVideoWithToken,
  getVideosList,
  removeAllVideos,
  checkUploadVideoParam,
  getVideosListPagination,
  getVideosListSort,
  removeVideo,
  getVideosListWithToken,
  uploadVideo,
  sendResumableChunks,
  getVideosWithFilters,
  uploadRandomVideoOnServers,
  updateVideo,
  rateVideo,
  viewVideo,
  parseTorrentVideo,
  getLocalVideos,
  completeVideoCheck,
  checkVideoFilesWereRemoved,
  getPlaylistVideos,
  getMyVideosWithFilter,
  uploadVideoAndGetId,
  getLocalIdByUUID,
  getVideoIdFromUUID,
  prepareResumableUpload
}

// ---------------------------------------------------------------------------

function buildUploadReq (req: request.Test, attributes: VideoAttributes) {

  for (const key of [ 'name', 'support', 'channelId', 'description', 'originallyPublishedAt' ]) {
    if (attributes[key] !== undefined) {
      req.field(key, attributes[key])
    }
  }

  for (const key of [ 'nsfw', 'commentsEnabled', 'downloadEnabled', 'waitTranscoding' ]) {
    if (attributes[key] !== undefined) {
      req.field(key, JSON.stringify(attributes[key]))
    }
  }

  for (const key of [ 'language', 'privacy', 'category', 'licence' ]) {
    if (attributes[key] !== undefined) {
      req.field(key, attributes[key].toString())
    }
  }

  const tags = attributes.tags || []
  for (let i = 0; i < tags.length; i++) {
    req.field('tags[' + i + ']', attributes.tags[i])
  }

  for (const key of [ 'thumbnailfile', 'previewfile' ]) {
    if (attributes[key] !== undefined) {
      req.attach(key, buildAbsoluteFixturePath(attributes[key]))
    }
  }

  if (attributes.scheduleUpdate) {
    if (attributes.scheduleUpdate.updateAt) {
      req.field('scheduleUpdate[updateAt]', attributes.scheduleUpdate.updateAt)
    }

    if (attributes.scheduleUpdate.privacy) {
      req.field('scheduleUpdate[privacy]', attributes.scheduleUpdate.privacy)
    }
  }
}
