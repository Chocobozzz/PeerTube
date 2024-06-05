/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode } from '@peertube/peertube-models'
import {
  PeerTubeServer,
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  makeGetRequest,
  setAccessTokensToServers,
  setDefaultAccountAvatar,
  setDefaultChannelAvatar,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'

describe('House keeping CLI', function () {
  let servers: PeerTubeServer[]

  function runHouseKeeping (option: string) {
    const env = servers[0].cli.getEnv()
    const command = `echo y | ${env} npm run house-keeping -- ${option}`

    return servers[0].cli.execWithEnv(command)
  }

  async function fetchRemoteData () {
    {
      const { data } = await servers[0].videos.list()
      for (const video of data) {
        await makeGetRequest({ url: servers[0].url, path: video.thumbnailPath, expectedStatus: HttpStatusCode.OK_200 })
        await makeGetRequest({ url: servers[0].url, path: video.previewPath, expectedStatus: HttpStatusCode.OK_200 })
      }
    }

    {
      const { data: accounts } = await servers[0].accounts.list()
      const { data: channels } = await servers[0].channels.list()

      for (const { avatars } of [ ...accounts, ...channels ]) {
        for (const avatar of avatars) {
          await makeGetRequest({ url: servers[0].url, path: avatar.path, expectedStatus: HttpStatusCode.OK_200 })
        }
      }
    }
  }

  before(async function () {
    this.timeout(360000)

    servers = await createMultipleServers(2)
    await setAccessTokensToServers(servers)

    await setDefaultAccountAvatar(servers)
    await setDefaultChannelAvatar(servers)

    await servers[1].config.enableMinimumTranscoding()

    for (const server of servers) {
      await server.videos.quickUpload({ name: 'video' })
    }

    await waitJobs(servers)

    await doubleFollow(servers[0], servers[1])
  })

  it('Should have remote files locally', async function () {
    this.timeout(120000)

    await fetchRemoteData()

    expect(await servers[0].servers.countFiles('thumbnails')).to.equal(2)
    expect(await servers[0].servers.countFiles('avatars')).to.equal((2 + 2) * 4) // 2 accounts and 2 channels in 4 versions
  })

  it('Should remove remote files', async function () {
    this.timeout(60000)

    await servers[0].kill()
    await runHouseKeeping('--delete-remote-files')
    await servers[0].run()

    expect(await servers[0].servers.countFiles('thumbnails')).to.equal(1)
    expect(await servers[0].servers.countFiles('avatars')).to.equal((1 + 1) * 4) // 1 account and 1 channel in 4 versions

    await fetchRemoteData()

    expect(await servers[0].servers.countFiles('thumbnails')).to.equal(2)
    expect(await servers[0].servers.countFiles('avatars')).to.equal((2 + 2) * 4) // 2 accounts and 2 channels in 4 versions
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
