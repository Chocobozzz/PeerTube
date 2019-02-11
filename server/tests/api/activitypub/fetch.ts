/* tslint:disable:no-unused-expression */

import 'mocha'

import {
  createUser,
  doubleFollow,
  flushAndRunMultipleServers,
  flushTests,
  getVideosListSort,
  killallServers,
  ServerInfo,
  setAccessTokensToServers,
  setActorField,
  setVideoField,
  uploadVideo,
  userLogin,
  waitJobs
} from '../../../../shared/utils'
import * as chai from 'chai'
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
      await createUser(server.url, server.accessToken, user.username, user.password)
    }

    const userAccessToken = await userLogin(servers[0], user)

    await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'video root' })
    const res = await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'bad video root' })
    const badVideoUUID = res.body.video.uuid
    await uploadVideo(servers[0].url, userAccessToken, { name: 'video user' })

    await setActorField(1, 'http://localhost:9001/accounts/user1', 'url', 'http://localhost:9002/accounts/user1')
    await setVideoField(1, badVideoUUID, 'url', 'http://localhost:9003/videos/watch/' + badVideoUUID)
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
    killallServers(servers)

    // Keep the logs if the test failed
    if (this['ok']) {
      await flushTests()
    }
  })
})
