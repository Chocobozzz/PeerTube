/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { createFile, readdir } from 'fs-extra'
import { join } from 'path'
import { buildUUID } from '@server/helpers/uuid'
import { HttpStatusCode } from '@shared/core-utils'
import {
  cleanupTests,
  CLICommand,
  doubleFollow,
  flushAndRunMultipleServers,
  killallServers,
  makeGetRequest,
  ServerInfo,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  updateMyAvatar,
  uploadVideo,
  wait,
  waitJobs
} from '@shared/extra-utils'
import { VideoPlaylistPrivacy } from '@shared/models'

const expect = chai.expect

async function countFiles (server: ServerInfo, directory: string) {
  const files = await readdir(server.serversCommand.buildDirectory(directory))

  return files.length
}

async function assertNotExists (server: ServerInfo, directory: string, substring: string) {
  const files = await readdir(server.serversCommand.buildDirectory(directory))

  for (const f of files) {
    expect(f).to.not.contain(substring)
  }
}

async function assertCountAreOkay (servers: ServerInfo[]) {
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
    expect(avatarsCount).to.equal(2)
  }
}

describe('Test prune storage scripts', function () {
  let servers: ServerInfo[]
  const badNames: { [directory: string]: string[] } = {}

  before(async function () {
    this.timeout(120000)

    servers = await flushAndRunMultipleServers(2, { transcoding: { enabled: true } })
    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    for (const server of servers) {
      await uploadVideo(server.url, server.accessToken, { name: 'video 1' })
      await uploadVideo(server.url, server.accessToken, { name: 'video 2' })

      await updateMyAvatar({ url: server.url, accessToken: server.accessToken, fixture: 'avatar.png' })

      await server.playlistsCommand.create({
        attributes: {
          displayName: 'playlist',
          privacy: VideoPlaylistPrivacy.PUBLIC,
          videoChannelId: server.videoChannel.id,
          thumbnailfile: 'thumbnail.jpg'
        }
      })
    }

    await doubleFollow(servers[0], servers[1])

    // Lazy load the remote avatar
    {
      const account = await servers[0].accountsCommand.get({ accountName: 'root@localhost:' + servers[1].port })
      await makeGetRequest({
        url: servers[0].url,
        path: account.avatar.path,
        statusCodeExpected: HttpStatusCode.OK_200
      })
    }

    {
      const account = await servers[1].accountsCommand.get({ accountName: 'root@localhost:' + servers[0].port })
      await makeGetRequest({
        url: servers[1].url,
        path: account.avatar.path,
        statusCodeExpected: HttpStatusCode.OK_200
      })
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
        const base = servers[0].serversCommand.buildDirectory('videos')

        const n1 = buildUUID() + '.mp4'
        const n2 = buildUUID() + '.webm'

        await createFile(join(base, n1))
        await createFile(join(base, n2))

        badNames['videos'] = [ n1, n2 ]
      }

      {
        const base = servers[0].serversCommand.buildDirectory('torrents')

        const n1 = buildUUID() + '-240.torrent'
        const n2 = buildUUID() + '-480.torrent'

        await createFile(join(base, n1))
        await createFile(join(base, n2))

        badNames['torrents'] = [ n1, n2 ]
      }

      {
        const base = servers[0].serversCommand.buildDirectory('thumbnails')

        const n1 = buildUUID() + '.jpg'
        const n2 = buildUUID() + '.jpg'

        await createFile(join(base, n1))
        await createFile(join(base, n2))

        badNames['thumbnails'] = [ n1, n2 ]
      }

      {
        const base = servers[0].serversCommand.buildDirectory('previews')

        const n1 = buildUUID() + '.jpg'
        const n2 = buildUUID() + '.jpg'

        await createFile(join(base, n1))
        await createFile(join(base, n2))

        badNames['previews'] = [ n1, n2 ]
      }

      {
        const base = servers[0].serversCommand.buildDirectory('avatars')

        const n1 = buildUUID() + '.png'
        const n2 = buildUUID() + '.jpg'

        await createFile(join(base, n1))
        await createFile(join(base, n2))

        badNames['avatars'] = [ n1, n2 ]
      }
    }
  })

  it('Should run prune storage', async function () {
    this.timeout(30000)

    const env = servers[0].cliCommand.getEnv()
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
