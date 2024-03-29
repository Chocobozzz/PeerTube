/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/no-floating-promises */

import { uuidRegex } from '@peertube/peertube-core-utils'
import {
  HttpStatusCode,
  HttpStatusCodeType,
  VideoCaption,
  VideoCommentPolicy,
  VideoCommentPolicyType,
  VideoDetails,
  VideoPrivacy,
  VideoResolution
} from '@peertube/peertube-models'
import { buildAbsoluteFixturePath, getFileSize, getFilenameFromUrl, getLowercaseExtension } from '@peertube/peertube-node-utils'
import { PeerTubeServer, VideoEdit, getRedirectionUrl, makeRawRequest, waitJobs } from '@peertube/peertube-server-commands'
import {
  VIDEO_CATEGORIES,
  VIDEO_LANGUAGES,
  VIDEO_LICENCES,
  VIDEO_PRIVACIES,
  loadLanguages
} from '@peertube/peertube-server/core/initializers/constants.js'
import { expect } from 'chai'
import { pathExists } from 'fs-extra/esm'
import { readdir } from 'fs/promises'
import { basename, join } from 'path'
import { dateIsValid, expectStartWith, testImageGeneratedByFFmpeg } from './checks.js'
import { completeCheckHlsPlaylist } from './streaming-playlists.js'
import { checkWebTorrentWorks } from './webtorrent.js'

export async function completeWebVideoFilesCheck (options: {
  server: PeerTubeServer
  originServer: PeerTubeServer
  videoUUID: string
  fixture: string
  files: {
    resolution: number
    width?: number
    height?: number
    size?: number
  }[]
  objectStorageBaseUrl?: string
}) {
  const { originServer, server, videoUUID, files, fixture, objectStorageBaseUrl } = options
  const video = await server.videos.getWithToken({ id: videoUUID })
  const serverConfig = await originServer.config.getConfig()
  const requiresAuth = video.privacy.id === VideoPrivacy.PRIVATE || video.privacy.id === VideoPrivacy.INTERNAL

  const transcodingEnabled = serverConfig.transcoding.web_videos.enabled

  expect(files).to.have.lengthOf(files.length)

  for (const attributeFile of files) {
    const file = video.files.find(f => f.resolution.id === attributeFile.resolution)
    expect(file, `resolution ${attributeFile.resolution} does not exist`).not.to.be.undefined

    let extension = getLowercaseExtension(fixture)
    // Transcoding enabled: extension will always be .mp4
    if (transcodingEnabled) extension = '.mp4'

    expect(file.id).to.exist
    expect(file.magnetUri).to.have.lengthOf.above(2)

    {
      const privatePath = requiresAuth
        ? 'private/'
        : ''
      const nameReg = `${uuidRegex}-${file.resolution.id}`

      expect(file.torrentDownloadUrl).to.match(new RegExp(`${server.url}/download/torrents/${nameReg}.torrent`))
      expect(file.torrentUrl).to.match(new RegExp(`${server.url}/lazy-static/torrents/${nameReg}.torrent`))

      if (objectStorageBaseUrl && requiresAuth) {
        const regexp = new RegExp(`${originServer.url}/object-storage-proxy/web-videos/${privatePath}${nameReg}${extension}`)
        expect(file.fileUrl).to.match(regexp)
      } else if (objectStorageBaseUrl) {
        expectStartWith(file.fileUrl, objectStorageBaseUrl)
      } else {
        expect(file.fileUrl).to.match(new RegExp(`${originServer.url}/static/web-videos/${privatePath}${nameReg}${extension}`))
      }

      expect(file.fileDownloadUrl).to.match(new RegExp(`${originServer.url}/download/videos/${nameReg}${extension}`))
    }

    {
      const token = requiresAuth
        ? server.accessToken
        : undefined

      await Promise.all([
        makeRawRequest({ url: file.torrentUrl, token, expectedStatus: HttpStatusCode.OK_200 }),
        makeRawRequest({ url: file.torrentDownloadUrl, token, expectedStatus: HttpStatusCode.OK_200 }),
        makeRawRequest({ url: file.metadataUrl, token, expectedStatus: HttpStatusCode.OK_200 }),
        makeRawRequest({ url: file.fileUrl, token, expectedStatus: HttpStatusCode.OK_200 }),
        makeRawRequest({
          url: file.fileDownloadUrl,
          token,
          expectedStatus: objectStorageBaseUrl
            ? HttpStatusCode.FOUND_302
            : HttpStatusCode.OK_200
        })
      ])
    }

    expect(file.resolution.id).to.equal(attributeFile.resolution)

    if (file.resolution.id === VideoResolution.H_NOVIDEO) {
      expect(file.resolution.label).to.equal('Audio')
    } else {
      expect(file.resolution.label).to.equal(attributeFile.resolution + 'p')
    }

    if (attributeFile.width !== undefined) expect(file.width).to.equal(attributeFile.width)
    if (attributeFile.height !== undefined) expect(file.height).to.equal(attributeFile.height)

    if (file.resolution.id === VideoResolution.H_NOVIDEO) {
      expect(file.height).to.equal(0)
      expect(file.width).to.equal(0)
    } else {
      expect(Math.min(file.height, file.width)).to.equal(file.resolution.id)
      expect(Math.max(file.height, file.width)).to.be.greaterThan(file.resolution.id)
    }

    if (attributeFile.size) {
      const minSize = attributeFile.size - ((10 * attributeFile.size) / 100)
      const maxSize = attributeFile.size + ((10 * attributeFile.size) / 100)
      expect(
        file.size,
        'File size for resolution ' + file.resolution.label + ' outside confidence interval (' + minSize + '> size <' + maxSize + ')'
      ).to.be.above(minSize).and.below(maxSize)
    }

    await checkWebTorrentWorks(file.magnetUri)
  }
}

export async function completeVideoCheck (options: {
  server: PeerTubeServer
  originServer: PeerTubeServer

  videoUUID: string

  objectStorageBaseUrl?: string

  attributes: {
    name: string
    category: number
    licence: number
    language: string
    nsfw: boolean
    commentsPolicy: VideoCommentPolicyType
    downloadEnabled: boolean
    description: string
    support: string
    duration: number
    tags: string[]
    privacy: number

    publishedAt?: string
    originallyPublishedAt?: string

    account: {
      name: string
      host: string
    }

    likes?: number
    dislikes?: number

    channel: {
      displayName: string
      name: string
      description: string
    }
    fixture: string

    thumbnailfile?: string
    previewfile?: string

    files?: {
      resolution: number
      size: number
      width: number
      height: number
    }[]

    hls?: {
      hlsOnly: boolean
      resolutions: number[]
    }
  }
}) {
  const { attributes, originServer, server, videoUUID, objectStorageBaseUrl } = options

  await loadLanguages()

  const video = await server.videos.get({ id: videoUUID })

  if (!attributes.likes) attributes.likes = 0
  if (!attributes.dislikes) attributes.dislikes = 0

  expect(video.name).to.equal(attributes.name)
  expect(video.category.id).to.equal(attributes.category)
  expect(video.category.label).to.equal(attributes.category !== null ? VIDEO_CATEGORIES[attributes.category] : 'Unknown')

  expect(video.licence.id).to.equal(attributes.licence)
  expect(video.licence.label).to.equal(attributes.licence !== null ? VIDEO_LICENCES[attributes.licence] : 'Unknown')

  expect(video.language.id).to.equal(attributes.language)
  expect(video.language.label).to.equal(attributes.language !== null ? VIDEO_LANGUAGES[attributes.language] : 'Unknown')

  expect(video.privacy.id).to.deep.equal(attributes.privacy)
  expect(video.privacy.label).to.deep.equal(VIDEO_PRIVACIES[attributes.privacy])

  expect(video.nsfw).to.equal(attributes.nsfw)
  expect(video.description).to.equal(attributes.description)

  expect(video.likes).to.equal(attributes.likes)
  expect(video.dislikes).to.equal(attributes.dislikes)

  expect(video.isLocal).to.equal(server.url === originServer.url)
  expect(video.duration).to.equal(attributes.duration)
  expect(video.url).to.contain(originServer.host)
  expect(video.tags).to.deep.equal(attributes.tags)

  expect(video.commentsEnabled).to.equal(attributes.commentsPolicy !== VideoCommentPolicy.DISABLED)
  expect(video.commentsPolicy.id).to.equal(attributes.commentsPolicy)
  expect(video.downloadEnabled).to.equal(attributes.downloadEnabled)

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

  expect(video.account.id).to.be.a('number')
  expect(video.account.name).to.equal(attributes.account.name)
  expect(video.account.host).to.equal(attributes.account.host)

  expect(video.channel.displayName).to.equal(attributes.channel.displayName)
  expect(video.channel.name).to.equal(attributes.channel.name)
  expect(video.channel.host).to.equal(attributes.account.host)
  expect(video.channel.isLocal).to.equal(server.url === originServer.url)
  expect(video.channel.createdAt).to.exist
  expect(dateIsValid(video.channel.updatedAt.toString())).to.be.true

  expect(video.thumbnailPath).to.exist
  await testImageGeneratedByFFmpeg(server.url, attributes.thumbnailfile || attributes.fixture, video.thumbnailPath)

  if (attributes.previewfile) {
    expect(video.previewPath).to.exist
    await testImageGeneratedByFFmpeg(server.url, attributes.previewfile, video.previewPath)
  }

  if (attributes.files) {
    await completeWebVideoFilesCheck({
      server,
      originServer,
      videoUUID: video.uuid,
      objectStorageBaseUrl,

      files: attributes.files,
      fixture: attributes.fixture
    })
  }

  if (attributes.hls) {
    await completeCheckHlsPlaylist({
      objectStorageBaseUrl,
      servers: [ server ],
      videoUUID: video.uuid,
      hlsOnly: attributes.hls.hlsOnly,
      resolutions: attributes.hls.resolutions
    })
  }
}

export async function checkVideoFilesWereRemoved (options: {
  server: PeerTubeServer
  video: VideoDetails
  captions?: VideoCaption[]
  onlyVideoFiles?: boolean // default false
}) {
  const { video, server, captions = [], onlyVideoFiles = false } = options

  const webVideoFiles = video.files || []
  const hlsFiles = video.streamingPlaylists[0]?.files || []

  const thumbnailName = basename(video.thumbnailPath)
  const previewName = basename(video.previewPath)

  const torrentNames = webVideoFiles.concat(hlsFiles).map(f => basename(f.torrentUrl))

  const captionNames = captions.map(c => basename(c.captionPath))

  const webVideoFilenames = webVideoFiles.map(f => basename(f.fileUrl))
  const hlsFilenames = hlsFiles.map(f => basename(f.fileUrl))

  let directories: { [ directory: string ]: string[] } = {
    videos: webVideoFilenames,
    redundancy: webVideoFilenames,
    [join('playlists', 'hls')]: hlsFilenames,
    [join('redundancy', 'hls')]: hlsFilenames
  }

  if (onlyVideoFiles !== true) {
    directories = {
      ...directories,

      thumbnails: [ thumbnailName ],
      previews: [ previewName ],
      torrents: torrentNames,
      captions: captionNames
    }
  }

  for (const directory of Object.keys(directories)) {
    const directoryPath = server.servers.buildDirectory(directory)

    const directoryExists = await pathExists(directoryPath)
    if (directoryExists === false) continue

    const existingFiles = await readdir(directoryPath)
    for (const existingFile of existingFiles) {
      for (const shouldNotExist of directories[directory]) {
        expect(existingFile, `File ${existingFile} should not exist in ${directoryPath}`).to.not.contain(shouldNotExist)
      }
    }
  }
}

export async function saveVideoInServers (servers: PeerTubeServer[], uuid: string) {
  for (const server of servers) {
    server.store.videoDetails = await server.videos.get({ id: uuid })
  }
}

export function checkUploadVideoParam (options: {
  server: PeerTubeServer
  token: string
  attributes: Partial<VideoEdit>
  expectedStatus?: HttpStatusCodeType
  completedExpectedStatus?: HttpStatusCodeType
  mode?: 'legacy' | 'resumable'
}) {
  const { server, token, attributes, completedExpectedStatus, expectedStatus, mode = 'legacy' } = options

  return mode === 'legacy'
    ? server.videos.buildLegacyUpload({ token, attributes, expectedStatus: expectedStatus || completedExpectedStatus })
    : server.videos.buildResumeVideoUpload({
      token,
      fixture: attributes.fixture,
      attaches: server.videos.buildUploadAttaches(attributes, false),
      fields: server.videos.buildUploadFields(attributes),
      expectedStatus,
      completedExpectedStatus,
      path: '/api/v1/videos/upload-resumable'
    })
}

// serverNumber starts from 1
export async function uploadRandomVideoOnServers (
  servers: PeerTubeServer[],
  serverNumber: number,
  additionalParams?: VideoEdit & { prefixName?: string }
) {
  const server = servers.find(s => s.serverNumber === serverNumber)
  const res = await server.videos.randomUpload({ wait: false, additionalParams })

  await waitJobs(servers)

  return res
}

export async function checkSourceFile (options: {
  server: PeerTubeServer
  fsCount: number
  uuid: string
  fixture: string
  objectStorageBaseUrl?: string // default false
}) {
  const { server, fsCount, fixture, uuid, objectStorageBaseUrl } = options

  const source = await server.videos.getSource({ id: uuid })
  const fixtureFileSize = await getFileSize(buildAbsoluteFixturePath(fixture))

  if (fsCount > 0) {
    expect(await server.servers.countFiles('original-video-files')).to.equal(fsCount)

    const keptFilePath = join(server.servers.buildDirectory('original-video-files'), getFilenameFromUrl(source.fileDownloadUrl))
    expect(await getFileSize(keptFilePath)).to.equal(fixtureFileSize)
  }

  expect(source.fileDownloadUrl).to.exist
  if (objectStorageBaseUrl) {
    const token = await server.videoToken.getVideoFileToken({ videoId: uuid })
    expectStartWith(await getRedirectionUrl(source.fileDownloadUrl + '?videoFileToken=' + token), objectStorageBaseUrl)
  }

  const { body } = await makeRawRequest({
    url: source.fileDownloadUrl,
    token: server.accessToken,
    redirects: 1,
    expectedStatus: HttpStatusCode.OK_200
  })

  expect(body).to.have.lengthOf(fixtureFileSize)

  return source
}
