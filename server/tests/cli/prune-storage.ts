/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { createFile, readdir } from 'fs-extra'
import { join } from 'path'
import { wait } from '@shared/core-utils'
import { buildUUID } from '@shared/extra-utils'
import { HttpStatusCode, VideoPlaylistPrivacy, VideoPrivacy } from '@shared/models'
import {
  cleanupTests,
  CLICommand,
  createMultipleServers,
  doubleFollow,
  killallServers,
  makeGetRequest,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@shared/server-commands'

async function countFiles (server: PeerTubeServer, directory: string) {
  const files = await readdir(server.servers.buildDirectory(directory))

  return files.length
}

async function assertNotExists (server: PeerTubeServer, directory: string, substring: string) {
  const files = await readdir(server.servers.buildDirectory(directory))

  for (const f of files) {
    expect(f).to.not.contain(substring)
  }
}

async function assertCountAreOkay (servers: PeerTubeServer[]) {
  for (const server of servers) {
    const videosCount = await countFiles(server, 'videos')
    expect(videosCount).to.equal(9) // 2 videos with 4 resolutions + private directory

    const privateVideosCount = await countFiles(server, 'videos/private')
    expect(privateVideosCount).to.equal(4)

    const torrentsCount = await countFiles(server, 'torrents')
    expect(torrentsCount).to.equal(24)

    const previewsCount = await countFiles(server, 'previews')
    expect(previewsCount).to.equal(3)

    const thumbnailsCount = await countFiles(server, 'thumbnails')
    expect(thumbnailsCount).to.equal(5) // 3 local videos, 1 local playlist, 2 remotes videos (lazy downloaded) and 1 remote playlist

    const avatarsCount = await countFiles(server, 'avatars')
    expect(avatarsCount).to.equal(4)

    const hlsRootCount = await countFiles(server, join('streaming-playlists', 'hls'))
    expect(hlsRootCount).to.equal(3) // 2 videos + private directory

    const hlsPrivateRootCount = await countFiles(server, join('streaming-playlists', 'hls', 'private'))
    expect(hlsPrivateRootCount).to.equal(1)
  }
}

describe('Test prune storage scripts', function () {
  let servers: PeerTubeServer[]
  const badNames: { [directory: string]: string[] } = {}

  before(async function () {
    this.timeout(120000)

    servers = await createMultipleServers(2, { transcoding: { enabled: true } })
    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    for (const server of servers) {
      await server.videos.upload({ attributes: { name: 'video 1', privacy: VideoPrivacy.PUBLIC } })
      await server.videos.upload({ attributes: { name: 'video 2', privacy: VideoPrivacy.PUBLIC } })

      await server.videos.upload({ attributes: { name: 'video 3', privacy: VideoPrivacy.PRIVATE } })

      await server.users.updateMyAvatar({ fixture: 'avatar.png' })

      await server.playlists.create({
        attributes: {
          displayName: 'playlist',
          privacy: VideoPlaylistPrivacy.PUBLIC,
          videoChannelId: server.store.channel.id,
          thumbnailfile: 'custom-thumbnail.jpg'
        }
      })
    }

    await doubleFollow(servers[0], servers[1])

    // Lazy load the remote avatars
    {
      const account = await servers[0].accounts.get({ accountName: 'root@' + servers[1].host })

      for (const avatar of account.avatars) {
        await makeGetRequest({
          url: servers[0].url,
          path: avatar.path,
          expectedStatus: HttpStatusCode.OK_200
        })
      }
    }

    {
      const account = await servers[1].accounts.get({ accountName: 'root@' + servers[0].host })
      for (const avatar of account.avatars) {
        await makeGetRequest({
          url: servers[1].url,
          path: avatar.path,
          expectedStatus: HttpStatusCode.OK_200
        })
      }
    }

    await wait(1000)

    await waitJobs(servers)
    await killallServers(servers)

    await wait(1000)
  })

  it('Should have the files on the disk', async function () {
    await assertCountAreOkay(servers)
  })

  it('Should create some dirty files', async function () {
    for (let i = 0; i < 2; i++) {
      {
        const basePublic = servers[0].servers.buildDirectory('videos')
        const basePrivate = servers[0].servers.buildDirectory(join('videos', 'private'))

        const n1 = buildUUID() + '.mp4'
        const n2 = buildUUID() + '.webm'

        await createFile(join(basePublic, n1))
        await createFile(join(basePublic, n2))
        await createFile(join(basePrivate, n1))
        await createFile(join(basePrivate, n2))

        badNames['videos'] = [ n1, n2 ]
      }

      {
        const base = servers[0].servers.buildDirectory('torrents')

        const n1 = buildUUID() + '-240.torrent'
        const n2 = buildUUID() + '-480.torrent'

        await createFile(join(base, n1))
        await createFile(join(base, n2))

        badNames['torrents'] = [ n1, n2 ]
      }

      {
        const base = servers[0].servers.buildDirectory('thumbnails')

        const n1 = buildUUID() + '.jpg'
        const n2 = buildUUID() + '.jpg'

        await createFile(join(base, n1))
        await createFile(join(base, n2))

        badNames['thumbnails'] = [ n1, n2 ]
      }

      {
        const base = servers[0].servers.buildDirectory('previews')

        const n1 = buildUUID() + '.jpg'
        const n2 = buildUUID() + '.jpg'

        await createFile(join(base, n1))
        await createFile(join(base, n2))

        badNames['previews'] = [ n1, n2 ]
      }

      {
        const base = servers[0].servers.buildDirectory('avatars')

        const n1 = buildUUID() + '.png'
        const n2 = buildUUID() + '.jpg'

        await createFile(join(base, n1))
        await createFile(join(base, n2))

        badNames['avatars'] = [ n1, n2 ]
      }

      {
        const directory = join('streaming-playlists', 'hls')
        const basePublic = servers[0].servers.buildDirectory(directory)
        const basePrivate = servers[0].servers.buildDirectory(join(directory, 'private'))

        const n1 = buildUUID()
        await createFile(join(basePublic, n1))
        await createFile(join(basePrivate, n1))
        badNames[directory] = [ n1 ]
      }
    }
  })

  it('Should run prune storage', async function () {
    this.timeout(30000)

    const env = servers[0].cli.getEnv()
    await CLICommand.exec(`echo y | ${env} npm run prune-storage`)
  })

  it('Should have removed files', async function () {
    await assertCountAreOkay(servers)

    for (const directory of Object.keys(badNames)) {
      for (const name of badNames[directory]) {
        await assertNotExists(servers[0], directory, name)
      }
    }
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
