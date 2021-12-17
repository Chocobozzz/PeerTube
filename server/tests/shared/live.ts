/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { pathExists, readdir } from 'fs-extra'
import { join } from 'path'
import { PeerTubeServer } from '@shared/server-commands'

async function checkLiveCleanupAfterSave (server: PeerTubeServer, videoUUID: string, resolutions: number[] = []) {
  const basePath = server.servers.buildDirectory('streaming-playlists')
  const hlsPath = join(basePath, 'hls', videoUUID)

  if (resolutions.length === 0) {
    const result = await pathExists(hlsPath)
    expect(result).to.be.false

    return
  }

  const files = await readdir(hlsPath)

  // fragmented file and playlist per resolution + master playlist + segments sha256 json file
  expect(files).to.have.lengthOf(resolutions.length * 2 + 2)

  for (const resolution of resolutions) {
    const fragmentedFile = files.find(f => f.endsWith(`-${resolution}-fragmented.mp4`))
    expect(fragmentedFile).to.exist

    const playlistFile = files.find(f => f.endsWith(`${resolution}.m3u8`))
    expect(playlistFile).to.exist
  }

  const masterPlaylistFile = files.find(f => f.endsWith('-master.m3u8'))
  expect(masterPlaylistFile).to.exist

  const shaFile = files.find(f => f.endsWith('-segments-sha256.json'))
  expect(shaFile).to.exist
}

export {
  checkLiveCleanupAfterSave
}
