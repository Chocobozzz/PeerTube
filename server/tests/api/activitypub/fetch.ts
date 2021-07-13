/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import {
  cleanupTests,
  createUser,
  doubleFollow,
  flushAndRunMultipleServers,
  getVideosListSort,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideo,
  waitJobs
} from '../../../../shared/extra-utils'
import { Video } from '../../../../shared/models/videos'

const expect = chai.expect

describe('Test ActivityPub fetcher', function () {
  let servers: ServerInfo[]

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(60000)

    servers = await flushAndRunMultipleServers(3)

    // Get the access tokens
    await setAccessTokensToServers(servers)

    const user = { username: 'user1', password: 'password' }
    for (const server of servers) {
      await createUser({ url: server.url, accessToken: server.accessToken, username: user.username, password: user.password })
    }

    const userAccessToken = await servers[0].loginCommand.getAccessToken(user)

    await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'video root' })
    const res = await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'bad video root' })
    const badVideoUUID = res.body.video.uuid
    await uploadVideo(servers[0].url, userAccessToken, { name: 'video user' })

    {
      const to = 'http://localhost:' + servers[0].port + '/accounts/user1'
      const value = 'http://localhost:' + servers[1].port + '/accounts/user1'
      await servers[0].sqlCommand.setActorField(to, 'url', value)
    }

    {
      const value = 'http://localhost:' + servers[2].port + '/videos/watch/' + badVideoUUID
      await servers[0].sqlCommand.setVideoField(badVideoUUID, 'url', value)
    }
  })

  it('Should add only the video with a valid actor URL', async function () {
    this.timeout(60000)

    await doubleFollow(servers[0], servers[1])
    await waitJobs(servers)

    {
      const res = await getVideosListSort(servers[0].url, 'createdAt')
      expect(res.body.total).to.equal(3)

      const data: Video[] = res.body.data
      expect(data[0].name).to.equal('video root')
      expect(data[1].name).to.equal('bad video root')
      expect(data[2].name).to.equal('video user')
    }

    {
      const res = await getVideosListSort(servers[1].url, 'createdAt')
      expect(res.body.total).to.equal(1)

      const data: Video[] = res.body.data
      expect(data[0].name).to.equal('video root')
    }
  })

  after(async function () {
    this.timeout(20000)

    await cleanupTests(servers)
  })
})
