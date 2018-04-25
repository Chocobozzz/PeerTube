/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import { flushTests, getVideosList, killallServers, ServerInfo, setAccessTokensToServers, uploadVideo } from '../../utils/index'
import { userLogin } from '../../utils/users/login'
import { createUser } from '../../utils/users/users'
import { getMyVideos } from '../../utils/videos/videos'
import {
  getAccountVideos,
  getConfig, getCustomConfig,
  getMyUserInformation, getVideoChannelVideos,
  getVideosListWithToken,
  runServer,
  searchVideo,
  searchVideoWithToken, updateCustomConfig,
  updateMyUser
} from '../../utils'
import { ServerConfig } from '../../../../shared/models'
import { CustomConfig } from '../../../../shared/models/server/custom-config.model'
import { User } from '../../../../shared/models/users'

const expect = chai.expect

describe('Test video NSFW policy', function () {
  let server: ServerInfo
  let userAccessToken: string
  let customConfig: CustomConfig

  function getVideosFunctions (token?: string) {
    return getMyUserInformation(server.url, server.accessToken)
      .then(res => {
        const user: User = res.body
        const videoChannelUUID = user.videoChannels[0].uuid
        const accountUUID = user.account.uuid

        if (token) {
          return Promise.all([
            getVideosListWithToken(server.url, token),
            searchVideoWithToken(server.url, 'n', token),
            getAccountVideos(server.url, token, accountUUID, 0, 5),
            getVideoChannelVideos(server.url, token, videoChannelUUID, 0, 5)
          ])
        }

        return Promise.all([
          getVideosList(server.url),
          searchVideo(server.url, 'n'),
          getAccountVideos(server.url, undefined, accountUUID, 0, 5),
          getVideoChannelVideos(server.url, undefined, videoChannelUUID, 0, 5)
        ])
      })
  }

  before(async function () {
    this.timeout(50000)

    await flushTests()
    server = await runServer(1)

    // Get the access tokens
    await setAccessTokensToServers([ server ])

    {
      const attributes = { name: 'nsfw', nsfw: true }
      await uploadVideo(server.url, server.accessToken, attributes)
    }

    {
      const attributes = { name: 'normal', nsfw: false }
      await uploadVideo(server.url, server.accessToken, attributes)
    }

    {
      const res = await getCustomConfig(server.url, server.accessToken)
      customConfig = res.body
    }
  })

  describe('Instance default NSFW policy', function () {
    it('Should display NSFW videos with display default NSFW policy', async function () {
      const resConfig = await getConfig(server.url)
      const serverConfig: ServerConfig = resConfig.body
      expect(serverConfig.instance.defaultNSFWPolicy).to.equal('display')

      for (const res of await getVideosFunctions()) {
        expect(res.body.total).to.equal(2)

        const videos = res.body.data
        expect(videos).to.have.lengthOf(2)
        expect(videos[ 0 ].name).to.equal('normal')
        expect(videos[ 1 ].name).to.equal('nsfw')
      }
    })

    it('Should not display NSFW videos with do_not_list default NSFW policy', async function () {
      customConfig.instance.defaultNSFWPolicy = 'do_not_list'
      await updateCustomConfig(server.url, server.accessToken, customConfig)

      const resConfig = await getConfig(server.url)
      const serverConfig: ServerConfig = resConfig.body
      expect(serverConfig.instance.defaultNSFWPolicy).to.equal('do_not_list')

      for (const res of await getVideosFunctions()) {
        expect(res.body.total).to.equal(1)

        const videos = res.body.data
        expect(videos).to.have.lengthOf(1)
        expect(videos[ 0 ].name).to.equal('normal')
      }
    })

    it('Should display NSFW videos with blur default NSFW policy', async function () {
      customConfig.instance.defaultNSFWPolicy = 'blur'
      await updateCustomConfig(server.url, server.accessToken, customConfig)

      const resConfig = await getConfig(server.url)
      const serverConfig: ServerConfig = resConfig.body
      expect(serverConfig.instance.defaultNSFWPolicy).to.equal('blur')

      for (const res of await getVideosFunctions()) {
        expect(res.body.total).to.equal(2)

        const videos = res.body.data
        expect(videos).to.have.lengthOf(2)
        expect(videos[ 0 ].name).to.equal('normal')
        expect(videos[ 1 ].name).to.equal('nsfw')
      }
    })
  })

  describe('User NSFW policy', function () {

    it('Should create a user having the default nsfw policy', async function () {
      const username = 'user1'
      const password = 'my super password'
      await createUser(server.url, server.accessToken, username, password)

      userAccessToken = await userLogin(server, { username, password })

      const res = await getMyUserInformation(server.url, userAccessToken)
      const user = res.body

      expect(user.nsfwPolicy).to.equal('blur')
    })

    it('Should display NSFW videos with blur user NSFW policy', async function () {
      for (const res of await getVideosFunctions(userAccessToken)) {
        expect(res.body.total).to.equal(2)

        const videos = res.body.data
        expect(videos).to.have.lengthOf(2)
        expect(videos[ 0 ].name).to.equal('normal')
        expect(videos[ 1 ].name).to.equal('nsfw')
      }
    })

    it('Should display NSFW videos with display user NSFW policy', async function () {
      await updateMyUser({
        url: server.url,
        accessToken: server.accessToken,
        nsfwPolicy: 'display'
      })

      for (const res of await getVideosFunctions(server.accessToken)) {
        expect(res.body.total).to.equal(2)

        const videos = res.body.data
        expect(videos).to.have.lengthOf(2)
        expect(videos[ 0 ].name).to.equal('normal')
        expect(videos[ 1 ].name).to.equal('nsfw')
      }
    })

    it('Should not display NSFW videos with do_not_list user NSFW policy', async function () {
      await updateMyUser({
        url: server.url,
        accessToken: server.accessToken,
        nsfwPolicy: 'do_not_list'
      })

      for (const res of await getVideosFunctions(server.accessToken)) {
        expect(res.body.total).to.equal(1)

        const videos = res.body.data
        expect(videos).to.have.lengthOf(1)
        expect(videos[ 0 ].name).to.equal('normal')
      }
    })

    it('Should be able to see my NSFW videos even with do_not_list user NSFW policy', async function () {
      const res = await getMyVideos(server.url, server.accessToken, 0, 5)
      expect(res.body.total).to.equal(2)

      const videos = res.body.data
      expect(videos).to.have.lengthOf(2)
      expect(videos[ 0 ].name).to.equal('normal')
      expect(videos[ 1 ].name).to.equal('nsfw')
    })
  })

  after(async function () {
    killallServers([ server ])

    // Keep the logs if the test failed
    if (this['ok']) {
      await flushTests()
    }
  })
})
