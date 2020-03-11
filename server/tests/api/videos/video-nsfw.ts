/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import * as chai from 'chai'
import 'mocha'
import { cleanupTests, getVideosList, ServerInfo, setAccessTokensToServers, uploadVideo } from '../../../../shared/extra-utils/index'
import { userLogin } from '../../../../shared/extra-utils/users/login'
import { createUser } from '../../../../shared/extra-utils/users/users'
import { getMyVideos } from '../../../../shared/extra-utils/videos/videos'
import {
  flushAndRunServer,
  getAccountVideos,
  getConfig,
  getCustomConfig,
  getMyUserInformation,
  getVideoChannelVideos,
  getVideosListWithToken,
  searchVideo,
  searchVideoWithToken,
  updateCustomConfig,
  updateMyUser
} from '../../../../shared/extra-utils'
import { ServerConfig, VideosOverview } from '../../../../shared/models'
import { CustomConfig } from '../../../../shared/models/server/custom-config.model'
import { User } from '../../../../shared/models/users'
import { getVideosOverview, getVideosOverviewWithToken } from '@shared/extra-utils/overviews/overviews'

const expect = chai.expect

function createOverviewRes (res: any) {
  const overview = res.body as VideosOverview

  const videos = overview.categories[0].videos
  return { body: { data: videos, total: videos.length } }
}

describe('Test video NSFW policy', function () {
  let server: ServerInfo
  let userAccessToken: string
  let customConfig: CustomConfig

  function getVideosFunctions (token?: string, query = {}) {
    return getMyUserInformation(server.url, server.accessToken)
      .then(res => {
        const user: User = res.body
        const videoChannelName = user.videoChannels[0].name
        const accountName = user.account.name + '@' + user.account.host
        const hasQuery = Object.keys(query).length !== 0
        let promises: Promise<any>[]

        if (token) {
          promises = [
            getVideosListWithToken(server.url, token, query),
            searchVideoWithToken(server.url, 'n', token, query),
            getAccountVideos(server.url, token, accountName, 0, 5, undefined, query),
            getVideoChannelVideos(server.url, token, videoChannelName, 0, 5, undefined, query)
          ]

          // Overviews do not support video filters
          if (!hasQuery) {
            promises.push(getVideosOverviewWithToken(server.url, 1, token).then(res => createOverviewRes(res)))
          }

          return Promise.all(promises)
        }

        promises = [
          getVideosList(server.url),
          searchVideo(server.url, 'n'),
          getAccountVideos(server.url, undefined, accountName, 0, 5),
          getVideoChannelVideos(server.url, undefined, videoChannelName, 0, 5)
        ]

        // Overviews do not support video filters
        if (!hasQuery) {
          promises.push(getVideosOverview(server.url, 1).then(res => createOverviewRes(res)))
        }

        return Promise.all(promises)
      })
  }

  before(async function () {
    this.timeout(50000)
    server = await flushAndRunServer(1)

    // Get the access tokens
    await setAccessTokensToServers([ server ])

    {
      const attributes = { name: 'nsfw', nsfw: true, category: 1 }
      await uploadVideo(server.url, server.accessToken, attributes)
    }

    {
      const attributes = { name: 'normal', nsfw: false, category: 1 }
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
        expect(videos[0].name).to.equal('normal')
        expect(videos[1].name).to.equal('nsfw')
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
        expect(videos[0].name).to.equal('normal')
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
        expect(videos[0].name).to.equal('normal')
        expect(videos[1].name).to.equal('nsfw')
      }
    })
  })

  describe('User NSFW policy', function () {

    it('Should create a user having the default nsfw policy', async function () {
      const username = 'user1'
      const password = 'my super password'
      await createUser({ url: server.url, accessToken: server.accessToken, username: username, password: password })

      userAccessToken = await userLogin(server, { username, password })

      const res = await getMyUserInformation(server.url, userAccessToken)
      const user = res.body

      expect(user.nsfwPolicy).to.equal('blur')
    })

    it('Should display NSFW videos with blur user NSFW policy', async function () {
      customConfig.instance.defaultNSFWPolicy = 'do_not_list'
      await updateCustomConfig(server.url, server.accessToken, customConfig)

      for (const res of await getVideosFunctions(userAccessToken)) {
        expect(res.body.total).to.equal(2)

        const videos = res.body.data
        expect(videos).to.have.lengthOf(2)
        expect(videos[0].name).to.equal('normal')
        expect(videos[1].name).to.equal('nsfw')
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
        expect(videos[0].name).to.equal('normal')
        expect(videos[1].name).to.equal('nsfw')
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
        expect(videos[0].name).to.equal('normal')
      }
    })

    it('Should be able to see my NSFW videos even with do_not_list user NSFW policy', async function () {
      const res = await getMyVideos(server.url, server.accessToken, 0, 5)
      expect(res.body.total).to.equal(2)

      const videos = res.body.data
      expect(videos).to.have.lengthOf(2)
      expect(videos[0].name).to.equal('normal')
      expect(videos[1].name).to.equal('nsfw')
    })

    it('Should display NSFW videos when the nsfw param === true', async function () {
      for (const res of await getVideosFunctions(server.accessToken, { nsfw: true })) {
        expect(res.body.total).to.equal(1)

        const videos = res.body.data
        expect(videos).to.have.lengthOf(1)
        expect(videos[0].name).to.equal('nsfw')
      }
    })

    it('Should hide NSFW videos when the nsfw param === true', async function () {
      for (const res of await getVideosFunctions(server.accessToken, { nsfw: false })) {
        expect(res.body.total).to.equal(1)

        const videos = res.body.data
        expect(videos).to.have.lengthOf(1)
        expect(videos[0].name).to.equal('normal')
      }
    })

    it('Should display both videos when the nsfw param === both', async function () {
      for (const res of await getVideosFunctions(server.accessToken, { nsfw: 'both' })) {
        expect(res.body.total).to.equal(2)

        const videos = res.body.data
        expect(videos).to.have.lengthOf(2)
        expect(videos[0].name).to.equal('normal')
        expect(videos[1].name).to.equal('nsfw')
      }
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
