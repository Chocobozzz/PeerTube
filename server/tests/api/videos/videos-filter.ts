/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import { expect } from 'chai'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  makeGetRequest,
  PeerTubeServer,
  setAccessTokensToServers
} from '@shared/extra-utils'
import { HttpStatusCode, UserRole, Video, VideoPrivacy } from '@shared/models'

async function getVideosNames (server: PeerTubeServer, token: string, filter: string, expectedStatus = HttpStatusCode.OK_200) {
  const paths = [
    '/api/v1/video-channels/root_channel/videos',
    '/api/v1/accounts/root/videos',
    '/api/v1/videos',
    '/api/v1/search/videos'
  ]

  const videosResults: Video[][] = []

  for (const path of paths) {
    const res = await makeGetRequest({
      url: server.url,
      path,
      token,
      query: {
        sort: 'createdAt',
        filter
      },
      expectedStatus
    })

    videosResults.push(res.body.data.map(v => v.name))
  }

  return videosResults
}

describe('Test videos filter', function () {
  let servers: PeerTubeServer[]

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(160000)

    servers = await createMultipleServers(2)

    await setAccessTokensToServers(servers)

    for (const server of servers) {
      const moderator = { username: 'moderator', password: 'my super password' }
      await server.users.create({ username: moderator.username, password: moderator.password, role: UserRole.MODERATOR })
      server['moderatorAccessToken'] = await server.login.getAccessToken(moderator)

      await server.videos.upload({ attributes: { name: 'public ' + server.serverNumber } })

      {
        const attributes = { name: 'unlisted ' + server.serverNumber, privacy: VideoPrivacy.UNLISTED }
        await server.videos.upload({ attributes })
      }

      {
        const attributes = { name: 'private ' + server.serverNumber, privacy: VideoPrivacy.PRIVATE }
        await server.videos.upload({ attributes })
      }
    }

    await doubleFollow(servers[0], servers[1])
  })

  describe('Check videos filter', function () {

    it('Should display local videos', async function () {
      for (const server of servers) {
        const namesResults = await getVideosNames(server, server.accessToken, 'local')
        for (const names of namesResults) {
          expect(names).to.have.lengthOf(1)
          expect(names[0]).to.equal('public ' + server.serverNumber)
        }
      }
    })

    it('Should display all local videos by the admin or the moderator', async function () {
      for (const server of servers) {
        for (const token of [ server.accessToken, server['moderatorAccessToken'] ]) {

          const namesResults = await getVideosNames(server, token, 'all-local')
          for (const names of namesResults) {
            expect(names).to.have.lengthOf(3)

            expect(names[0]).to.equal('public ' + server.serverNumber)
            expect(names[1]).to.equal('unlisted ' + server.serverNumber)
            expect(names[2]).to.equal('private ' + server.serverNumber)
          }
        }
      }
    })

    it('Should display all videos by the admin or the moderator', async function () {
      for (const server of servers) {
        for (const token of [ server.accessToken, server['moderatorAccessToken'] ]) {

          const [ channelVideos, accountVideos, videos, searchVideos ] = await getVideosNames(server, token, 'all')
          expect(channelVideos).to.have.lengthOf(3)
          expect(accountVideos).to.have.lengthOf(3)

          expect(videos).to.have.lengthOf(5)
          expect(searchVideos).to.have.lengthOf(5)
        }
      }
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
