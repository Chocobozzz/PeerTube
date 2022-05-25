/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { pathExists, readdir } from 'fs-extra'
import { join } from 'path'
import { LiveVideo } from '@shared/models'
import { PeerTubeServer } from '@shared/server-commands'

async function checkLiveCleanup (server: PeerTubeServer, videoUUID: string, savedResolutions: number[] = []) {
  let live: LiveVideo

  try {
    live = await server.live.get({ videoId: videoUUID })
  } catch {}

  const basePath = server.servers.buildDirectory('streaming-playlists')
  const hlsPath = join(basePath, 'hls', videoUUID)

  if (savedResolutions.length === 0) {

    if (live?.permanentLive) {
      expect(await pathExists(hlsPath)).to.be.true

      const hlsFiles = await readdir(hlsPath)
      expect(hlsFiles).to.have.lengthOf(1) // Only replays directory

      const replayDir = join(hlsPath, 'replay')
      expect(await pathExists(replayDir)).to.be.true

      const replayFiles = await readdir(join(hlsPath, 'replay'))
      expect(replayFiles).to.have.lengthOf(0)
    } else {
      expect(await pathExists(hlsPath)).to.be.false
    }

    return
  }

  const files = await readdir(hlsPath)

  // fragmented file and playlist per resolution + master playlist + segments sha256 json file
  expect(files).to.have.lengthOf(savedResolutions.length * 2 + 2)

  for (const resolution of savedResolutions) {
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
  checkLiveCleanup
}
