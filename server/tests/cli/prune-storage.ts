/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { waitJobs } from '../../../shared/extra-utils/server/jobs'
import {
  buildServerDirectory,
  cleanupTests,
  createVideoPlaylist,
  doubleFollow,
  execCLI,
  flushAndRunMultipleServers,
  getAccount,
  getEnvCli,
  makeGetRequest,
  ServerInfo,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  updateMyAvatar,
  uploadVideo,
  wait
} from '../../../shared/extra-utils'
import { Account, VideoPlaylistPrivacy } from '../../../shared/models'
import { createFile, readdir } from 'fs-extra'
import { v4 as uuidv4 } from 'uuid'
import { join } from 'path'

const expect = chai.expect

async function countFiles (internalServerNumber: number, directory: string) {
  const files = await readdir(buildServerDirectory(internalServerNumber, directory))

  return files.length
}

async function assertNotExists (internalServerNumber: number, directory: string, substring: string) {
  const files = await readdir(buildServerDirectory(internalServerNumber, directory))

  for (const f of files) {
    expect(f).to.not.contain(substring)
  }
}

async function assertCountAreOkay (servers: ServerInfo[]) {
  for (const server of servers) {
    const videosCount = await countFiles(server.internalServerNumber, 'videos')
    expect(videosCount).to.equal(8)

    const torrentsCount = await countFiles(server.internalServerNumber, 'torrents')
    expect(torrentsCount).to.equal(16)

    const previewsCount = await countFiles(server.internalServerNumber, 'previews')
    expect(previewsCount).to.equal(2)

    const thumbnailsCount = await countFiles(server.internalServerNumber, 'thumbnails')
    expect(thumbnailsCount).to.equal(6)

    const avatarsCount = await countFiles(server.internalServerNumber, 'avatars')
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

      await createVideoPlaylist({
        url: server.url,
        token: server.accessToken,
        playlistAttrs: {
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
      const res = await getAccount(servers[0].url, 'root@localhost:' + servers[1].port)
      const account: Account = res.body
      await makeGetRequest({
        url: servers[0].url,
        path: account.avatar.path,
        statusCodeExpected: 200
      })
    }

    {
      const res = await getAccount(servers[1].url, 'root@localhost:' + servers[0].port)
      const account: Account = res.body
      await makeGetRequest({
        url: servers[1].url,
        path: account.avatar.path,
        statusCodeExpected: 200
      })
    }

    await wait(1000)

    await waitJobs(servers)
  })

  it('Should have the files on the disk', async function () {
    await assertCountAreOkay(servers)
  })

  it('Should create some dirty files', async function () {
    for (let i = 0; i < 2; i++) {
      {
        const base = buildServerDirectory(servers[0].internalServerNumber, 'videos')

        const n1 = uuidv4() + '.mp4'
        const n2 = uuidv4() + '.webm'

        await createFile(join(base, n1))
        await createFile(join(base, n2))

        badNames['videos'] = [ n1, n2 ]
      }

      {
        const base = buildServerDirectory(servers[0].internalServerNumber, 'torrents')

        const n1 = uuidv4() + '-240.torrent'
        const n2 = uuidv4() + '-480.torrent'

        await createFile(join(base, n1))
        await createFile(join(base, n2))

        badNames['torrents'] = [ n1, n2 ]
      }

      {
        const base = buildServerDirectory(servers[0].internalServerNumber, 'thumbnails')

        const n1 = uuidv4() + '.jpg'
        const n2 = uuidv4() + '.jpg'

        await createFile(join(base, n1))
        await createFile(join(base, n2))

        badNames['thumbnails'] = [ n1, n2 ]
      }

      {
        const base = buildServerDirectory(servers[0].internalServerNumber, 'previews')

        const n1 = uuidv4() + '.jpg'
        const n2 = uuidv4() + '.jpg'

        await createFile(join(base, n1))
        await createFile(join(base, n2))

        badNames['previews'] = [ n1, n2 ]
      }

      {
        const base = buildServerDirectory(servers[0].internalServerNumber, 'avatars')

        const n1 = uuidv4() + '.png'
        const n2 = uuidv4() + '.jpg'

        await createFile(join(base, n1))
        await createFile(join(base, n2))

        badNames['avatars'] = [ n1, n2 ]
      }
    }
  })

  it('Should run prune storage', async function () {
    this.timeout(30000)

    const env = getEnvCli(servers[0])
    await execCLI(`echo y | ${env} npm run prune-storage`)
  })

  it('Should have removed files', async function () {
    await assertCountAreOkay(servers)

    for (const directory of Object.keys(badNames)) {
      for (const name of badNames[directory]) {
        await assertNotExists(servers[0].internalServerNumber, directory, name)
      }
    }
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
