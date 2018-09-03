/* tslint:disable:no-unused-expression */

import { expect } from 'chai'
import { existsSync, readdir, readFile } from 'fs-extra'
import * as parseTorrent from 'parse-torrent'
import { extname, join } from 'path'
import * as request from 'supertest'
import {
  buildAbsoluteFixturePath,
  getMyUserInformation,
  immutableAssign,
  makeGetRequest,
  makePutBodyRequest,
  makeUploadRequest,
  root,
  ServerInfo,
  testImage
} from '../'
import { VideoDetails, VideoPrivacy } from '../../../../shared/models/videos'
import { VIDEO_CATEGORIES, VIDEO_LANGUAGES, VIDEO_LICENCES, VIDEO_PRIVACIES } from '../../../initializers'
import { dateIsValid, webtorrentAdd } from '../index'

type VideoAttributes = {
  name?: string
  category?: number
  licence?: number
  language?: string
  nsfw?: boolean
  commentsEnabled?: boolean
  waitTranscoding?: boolean
  description?: string
  tags?: string[]
  channelId?: number
  privacy?: VideoPrivacy
  fixture?: string
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
    statusCodeExpected: 200
  })
}

function getVideoLicences (url: string) {
  const path = '/api/v1/videos/licences'

  return makeGetRequest({
    url,
    path,
    statusCodeExpected: 200
  })
}

function getVideoLanguages (url: string) {
  const path = '/api/v1/videos/languages'

  return makeGetRequest({
    url,
    path,
    statusCodeExpected: 200
  })
}

function getVideoPrivacies (url: string) {
  const path = '/api/v1/videos/privacies'

  return makeGetRequest({
    url,
    path,
    statusCodeExpected: 200
  })
}

function getVideo (url: string, id: number | string, expectedStatus = 200) {
  const path = '/api/v1/videos/' + id

  return request(url)
          .get(path)
          .set('Accept', 'application/json')
          .expect(expectedStatus)
}

function viewVideo (url: string, id: number | string, expectedStatus = 204, xForwardedFor?: string) {
  const path = '/api/v1/videos/' + id + '/views'

  const req = request(url)
    .post(path)
    .set('Accept', 'application/json')

  if (xForwardedFor) {
    req.set('X-Forwarded-For', xForwardedFor)
  }

  return req.expect(expectedStatus)
}

function getVideoWithToken (url: string, token: string, id: number | string, expectedStatus = 200) {
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
    .expect(200)
    .expect('Content-Type', /json/)
}

function getVideosList (url: string) {
  const path = '/api/v1/videos'

  return request(url)
          .get(path)
          .query({ sort: 'name' })
          .set('Accept', 'application/json')
          .expect(200)
          .expect('Content-Type', /json/)
}

function getVideosListWithToken (url: string, token: string, query: { nsfw?: boolean } = {}) {
  const path = '/api/v1/videos'

  return request(url)
    .get(path)
    .set('Authorization', 'Bearer ' + token)
    .query(immutableAssign(query, { sort: 'name' }))
    .set('Accept', 'application/json')
    .expect(200)
    .expect('Content-Type', /json/)
}

function getLocalVideos (url: string) {
  const path = '/api/v1/videos'

  return request(url)
    .get(path)
    .query({ sort: 'name', filter: 'local' })
    .set('Accept', 'application/json')
    .expect(200)
    .expect('Content-Type', /json/)
}

function getMyVideos (url: string, accessToken: string, start: number, count: number, sort?: string) {
  const path = '/api/v1/users/me/videos'

  const req = request(url)
    .get(path)
    .query({ start: start })
    .query({ count: count })

  if (sort) req.query({ sort })

  return req.set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + accessToken)
    .expect(200)
    .expect('Content-Type', /json/)
}

function getAccountVideos (
  url: string,
  accessToken: string,
  accountName: string,
  start: number,
  count: number,
  sort?: string,
  query: { nsfw?: boolean } = {}
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
    statusCodeExpected: 200
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
    statusCodeExpected: 200
  })
}

function getVideosListPagination (url: string, start: number, count: number, sort?: string) {
  const path = '/api/v1/videos'

  const req = request(url)
              .get(path)
              .query({ start: start })
              .query({ count: count })

  if (sort) req.query({ sort })

  return req.set('Accept', 'application/json')
           .expect(200)
           .expect('Content-Type', /json/)
}

function getVideosListSort (url: string, sort: string) {
  const path = '/api/v1/videos'

  return request(url)
          .get(path)
          .query({ sort: sort })
          .set('Accept', 'application/json')
          .expect(200)
          .expect('Content-Type', /json/)
}

function getVideosWithFilters (url: string, query: { tagsAllOf: string[], categoryOneOf: number[] | number }) {
  const path = '/api/v1/videos'

  return request(url)
    .get(path)
    .query(query)
    .set('Accept', 'application/json')
    .expect(200)
    .expect('Content-Type', /json/)
}

function removeVideo (url: string, token: string, id: number | string, expectedStatus = 204) {
  const path = '/api/v1/videos'

  return request(url)
          .delete(path + '/' + id)
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer ' + token)
          .expect(expectedStatus)
}

async function checkVideoFilesWereRemoved (videoUUID: string, serverNumber: number) {
  const testDirectory = 'test' + serverNumber

  for (const directory of [ 'videos', 'thumbnails', 'torrents', 'previews', 'captions' ]) {
    const directoryPath = join(root(), testDirectory, directory)

    const directoryExists = existsSync(directoryPath)
    expect(directoryExists).to.be.true

    const files = await readdir(directoryPath)
    for (const file of files) {
      expect(file).to.not.contain(videoUUID)
    }
  }
}

async function uploadVideo (url: string, accessToken: string, videoAttributesArg: VideoAttributes, specialStatus = 200) {
  const path = '/api/v1/videos/upload'
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
    fixture: 'video_short.webm'
  }, videoAttributesArg)

  const req = request(url)
              .post(path)
              .set('Accept', 'application/json')
              .set('Authorization', 'Bearer ' + accessToken)
              .field('name', attributes.name)
              .field('nsfw', JSON.stringify(attributes.nsfw))
              .field('commentsEnabled', JSON.stringify(attributes.commentsEnabled))
              .field('waitTranscoding', JSON.stringify(attributes.waitTranscoding))
              .field('privacy', attributes.privacy.toString())
              .field('channelId', attributes.channelId)

  if (attributes.description !== undefined) {
    req.field('description', attributes.description)
  }
  if (attributes.language !== undefined) {
    req.field('language', attributes.language.toString())
  }
  if (attributes.category !== undefined) {
    req.field('category', attributes.category.toString())
  }
  if (attributes.licence !== undefined) {
    req.field('licence', attributes.licence.toString())
  }

  for (let i = 0; i < attributes.tags.length; i++) {
    req.field('tags[' + i + ']', attributes.tags[i])
  }

  if (attributes.thumbnailfile !== undefined) {
    req.attach('thumbnailfile', buildAbsoluteFixturePath(attributes.thumbnailfile))
  }
  if (attributes.previewfile !== undefined) {
    req.attach('previewfile', buildAbsoluteFixturePath(attributes.previewfile))
  }

  if (attributes.scheduleUpdate) {
    req.field('scheduleUpdate[updateAt]', attributes.scheduleUpdate.updateAt)

    if (attributes.scheduleUpdate.privacy) {
      req.field('scheduleUpdate[privacy]', attributes.scheduleUpdate.privacy)
    }
  }

  return req.attach('videofile', buildAbsoluteFixturePath(attributes.fixture))
            .expect(specialStatus)
}

function updateVideo (url: string, accessToken: string, id: number | string, attributes: VideoAttributes, statusCodeExpected = 204) {
  const path = '/api/v1/videos/' + id
  const body = {}

  if (attributes.name) body['name'] = attributes.name
  if (attributes.category) body['category'] = attributes.category
  if (attributes.licence) body['licence'] = attributes.licence
  if (attributes.language) body['language'] = attributes.language
  if (attributes.nsfw !== undefined) body['nsfw'] = JSON.stringify(attributes.nsfw)
  if (attributes.commentsEnabled !== undefined) body['commentsEnabled'] = JSON.stringify(attributes.commentsEnabled)
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

function rateVideo (url: string, accessToken: string, id: number, rating: string, specialStatus = 204) {
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
    const torrentPath = join(__dirname, '..', '..', '..', '..', 'test' + server.serverNumber, 'torrents', torrentName)
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
    description: string
    publishedAt?: string
    support: string
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
    }[],
    thumbnailfile?: string
    previewfile?: string
  }
) {
  if (!attributes.likes) attributes.likes = 0
  if (!attributes.dislikes) attributes.dislikes = 0

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
  expect(video.account.uuid).to.be.a('string')
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

  for (const attributeFile of attributes.files) {
    const file = videoDetails.files.find(f => f.resolution.id === attributeFile.resolution)
    expect(file).not.to.be.undefined

    let extension = extname(attributes.fixture)
    // Transcoding enabled on server 2, extension will always be .mp4
    if (attributes.account.host === 'localhost:9002') extension = '.mp4'

    const magnetUri = file.magnetUri
    expect(file.magnetUri).to.have.lengthOf.above(2)
    expect(file.torrentUrl).to.equal(`http://${attributes.account.host}/static/torrents/${videoDetails.uuid}-${file.resolution.id}.torrent`)
    expect(file.fileUrl).to.equal(`http://${attributes.account.host}/static/webseed/${videoDetails.uuid}-${file.resolution.id}${extension}`)
    expect(file.resolution.id).to.equal(attributeFile.resolution)
    expect(file.resolution.label).to.equal(attributeFile.resolution + 'p')

    const minSize = attributeFile.size - ((10 * attributeFile.size) / 100)
    const maxSize = attributeFile.size + ((10 * attributeFile.size) / 100)
    expect(file.size,
           'File size for resolution ' + file.resolution.label + ' outside confidence interval (' + minSize + '> size <' + maxSize + ')')
      .to.be.above(minSize).and.below(maxSize)

    {
      await testImage(url, attributes.thumbnailfile || attributes.fixture, videoDetails.thumbnailPath)
    }

    if (attributes.previewfile) {
      await testImage(url, attributes.previewfile, videoDetails.previewPath)
    }

    const torrent = await webtorrentAdd(magnetUri, true)
    expect(torrent.files).to.be.an('array')
    expect(torrent.files.length).to.equal(1)
    expect(torrent.files[0].path).to.exist.and.to.not.equal('')
  }
}

// ---------------------------------------------------------------------------

export {
  getVideoDescription,
  getVideoCategories,
  getVideoLicences,
  getVideoPrivacies,
  getVideoLanguages,
  getMyVideos,
  getAccountVideos,
  getVideoChannelVideos,
  getVideo,
  getVideoWithToken,
  getVideosList,
  getVideosListPagination,
  getVideosListSort,
  removeVideo,
  getVideosListWithToken,
  uploadVideo,
  getVideosWithFilters,
  updateVideo,
  rateVideo,
  viewVideo,
  parseTorrentVideo,
  getLocalVideos,
  completeVideoCheck,
  checkVideoFilesWereRemoved
}
