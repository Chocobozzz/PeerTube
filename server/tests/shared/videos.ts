/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/no-floating-promises */

import { expect } from 'chai'
import { pathExists, readdir } from 'fs-extra'
import { basename, join } from 'path'
import { loadLanguages, VIDEO_CATEGORIES, VIDEO_LANGUAGES, VIDEO_LICENCES, VIDEO_PRIVACIES } from '@server/initializers/constants'
import { getLowercaseExtension, uuidRegex } from '@shared/core-utils'
import { HttpStatusCode, VideoCaption, VideoDetails } from '@shared/models'
import { makeRawRequest, PeerTubeServer, VideoEdit, waitJobs, webtorrentAdd } from '@shared/server-commands'
import { dateIsValid, testImage } from './checks'

loadLanguages()

async function completeVideoCheck (
  server: PeerTubeServer,
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
      description: string
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

  const host = new URL(server.url).host
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
  expect(video.url).to.contain(originHost)
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

  const videoDetails = await server.videos.get({ id: video.uuid })

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

    expect(file.id).to.exist
    expect(file.magnetUri).to.have.lengthOf.above(2)

    expect(file.torrentDownloadUrl).to.match(new RegExp(`http://${host}/download/torrents/${uuidRegex}-${file.resolution.id}.torrent`))
    expect(file.torrentUrl).to.match(new RegExp(`http://${host}/lazy-static/torrents/${uuidRegex}-${file.resolution.id}.torrent`))

    expect(file.fileUrl).to.match(new RegExp(`http://${originHost}/static/webseed/${uuidRegex}-${file.resolution.id}${extension}`))
    expect(file.fileDownloadUrl).to.match(new RegExp(`http://${originHost}/download/videos/${uuidRegex}-${file.resolution.id}${extension}`))

    await Promise.all([
      makeRawRequest(file.torrentUrl, 200),
      makeRawRequest(file.torrentDownloadUrl, 200),
      makeRawRequest(file.metadataUrl, 200)
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
  await testImage(server.url, attributes.thumbnailfile || attributes.fixture, videoDetails.thumbnailPath)

  if (attributes.previewfile) {
    expect(videoDetails.previewPath).to.exist
    await testImage(server.url, attributes.previewfile, videoDetails.previewPath)
  }
}

async function checkVideoFilesWereRemoved (options: {
  server: PeerTubeServer
  video: VideoDetails
  captions?: VideoCaption[]
  onlyVideoFiles?: boolean // default false
}) {
  const { video, server, captions = [], onlyVideoFiles = false } = options

  const webtorrentFiles = video.files || []
  const hlsFiles = video.streamingPlaylists[0]?.files || []

  const thumbnailName = basename(video.thumbnailPath)
  const previewName = basename(video.previewPath)

  const torrentNames = webtorrentFiles.concat(hlsFiles).map(f => basename(f.torrentUrl))

  const captionNames = captions.map(c => basename(c.captionPath))

  const webtorrentFilenames = webtorrentFiles.map(f => basename(f.fileUrl))
  const hlsFilenames = hlsFiles.map(f => basename(f.fileUrl))

  let directories: { [ directory: string ]: string[] } = {
    videos: webtorrentFilenames,
    redundancy: webtorrentFilenames,
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

async function saveVideoInServers (servers: PeerTubeServer[], uuid: string) {
  for (const server of servers) {
    server.store.videoDetails = await server.videos.get({ id: uuid })
  }
}

function checkUploadVideoParam (
  server: PeerTubeServer,
  token: string,
  attributes: Partial<VideoEdit>,
  expectedStatus = HttpStatusCode.OK_200,
  mode: 'legacy' | 'resumable' = 'legacy'
) {
  return mode === 'legacy'
    ? server.videos.buildLegacyUpload({ token, attributes, expectedStatus })
    : server.videos.buildResumeUpload({ token, attributes, expectedStatus })
}

// serverNumber starts from 1
async function uploadRandomVideoOnServers (
  servers: PeerTubeServer[],
  serverNumber: number,
  additionalParams?: VideoEdit & { prefixName?: string }
) {
  const server = servers.find(s => s.serverNumber === serverNumber)
  const res = await server.videos.randomUpload({ wait: false, additionalParams })

  await waitJobs(servers)

  return res
}

// ---------------------------------------------------------------------------

export {
  completeVideoCheck,
  checkUploadVideoParam,
  uploadRandomVideoOnServers,
  checkVideoFilesWereRemoved,
  saveVideoInServers
}
