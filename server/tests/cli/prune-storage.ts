/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { createFile, readdir } from 'fs-extra'
import { join } from 'path'
import { wait } from '@shared/core-utils'
import { buildUUID } from '@shared/extra-utils'
import { HttpStatusCode, VideoPlaylistPrivacy } from '@shared/models'
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
    expect(videosCount).to.equal(8)

    const torrentsCount = await countFiles(server, 'torrents')
    expect(torrentsCount).to.equal(16)

    const previewsCount = await countFiles(server, 'previews')
    expect(previewsCount).to.equal(2)

    const thumbnailsCount = await countFiles(server, 'thumbnails')
    expect(thumbnailsCount).to.equal(6)

    const avatarsCount = await countFiles(server, 'avatars')
    expect(avatarsCount).to.equal(4)

    const hlsRootCount = await countFiles(server, 'streaming-playlists/hls')
    expect(hlsRootCount).to.equal(2)
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
      await server.videos.upload({ attributes: { name: 'video 1' } })
      await server.videos.upload({ attributes: { name: 'video 2' } })

      await server.users.updateMyAvatar({ fixture: 'avatar.png' })

      await server.playlists.create({
        attributes: {
          displayName: 'playlist',
          privacy: VideoPlaylistPrivacy.PUBLIC,
          videoChannelId: server.store.channel.id,
          thumbnailfile: 'thumbnail.jpg'
        }
      })
    }

    await doubleFollow(servers[0], servers[1])

    // Lazy load the remote avatars
    {
      const account = await servers[0].accounts.get({ accountName: 'root@localhost:' + servers[1].port })

      for (const avatar of account.avatars) {
        await makeGetRequest({
          url: servers[0].url,
          path: avatar.path,
          expectedStatus: HttpStatusCode.OK_200
        })
      }
    }

    {
      const account = await servers[1].accounts.get({ accountName: 'root@localhost:' + servers[0].port })
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
        const base = servers[0].servers.buildDirectory('videos')

        const n1 = buildUUID() + '.mp4'
        const n2 = buildUUID() + '.webm'

        await createFile(join(base, n1))
        await createFile(join(base, n2))

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
        const base = servers[0].servers.buildDirectory(directory)

        const n1 = buildUUID()
        await createFile(join(base, n1))
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
