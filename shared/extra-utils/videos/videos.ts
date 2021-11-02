/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/no-floating-promises */

import { expect } from 'chai'
import { pathExists, readdir } from 'fs-extra'
import { basename, join } from 'path'
import { HttpStatusCode, VideoCaption, VideoDetails } from '@shared/models'
import { waitJobs } from '../server'
import { PeerTubeServer } from '../server/server'
import { VideoEdit } from './videos-command'

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
  checkUploadVideoParam,
  uploadRandomVideoOnServers,
  checkVideoFilesWereRemoved,
  saveVideoInServers
}
