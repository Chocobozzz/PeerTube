/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import {
  cleanupTests,
  createUser,
  flushAndRunServer,
  getAccountVideos,
  getMyUserInformation,
  getMyVideos,
  getVideoChannelVideos,
  getVideosList,
  getVideosListWithToken,
  ServerInfo,
  setAccessTokensToServers,
  updateMyUser,
  uploadVideo,
  userLogin
} from '@shared/extra-utils'
import { BooleanBothQuery, CustomConfig, ResultList, User, Video, VideosOverview } from '@shared/models'

const expect = chai.expect

function createOverviewRes (overview: VideosOverview) {
  const videos = overview.categories[0].videos
  return { data: videos, total: videos.length }
}

describe('Test video NSFW policy', function () {
  let server: ServerInfo
  let userAccessToken: string
  let customConfig: CustomConfig

  async function getVideosFunctions (token?: string, query: { nsfw?: BooleanBothQuery } = {}) {
    const res = await getMyUserInformation(server.url, server.accessToken)
    const user: User = res.body
    const videoChannelName = user.videoChannels[0].name
    const accountName = user.account.name + '@' + user.account.host
    const hasQuery = Object.keys(query).length !== 0
    let promises: Promise<ResultList<Video>>[]

    if (token) {
      promises = [
        getVideosListWithToken(server.url, token, query).then(res => res.body),
        server.searchCommand.advancedVideoSearch({ token, search: { search: 'n', sort: '-publishedAt', ...query } }),
        getAccountVideos(server.url, token, accountName, 0, 5, undefined, query).then(res => res.body),
        getVideoChannelVideos(server.url, token, videoChannelName, 0, 5, undefined, query).then(res => res.body)
      ]

      // Overviews do not support video filters
      if (!hasQuery) {
        const p = server.overviewsCommand.getVideos({ page: 1, token })
                                         .then(res => createOverviewRes(res))
        promises.push(p)
      }

      return Promise.all(promises)
    }

    promises = [
      getVideosList(server.url).then(res => res.body),
      server.searchCommand.searchVideos({ search: 'n', sort: '-publishedAt' }),
      getAccountVideos(server.url, undefined, accountName, 0, 5).then(res => res.body),
      getVideoChannelVideos(server.url, undefined, videoChannelName, 0, 5).then(res => res.body)
    ]

    // Overviews do not support video filters
    if (!hasQuery) {
      const p = server.overviewsCommand.getVideos({ page: 1 })
                                       .then(res => createOverviewRes(res))
      promises.push(p)
    }

    return Promise.all(promises)
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

    customConfig = await server.configCommand.getCustomConfig()
  })

  describe('Instance default NSFW policy', function () {
    it('Should display NSFW videos with display default NSFW policy', async function () {
      const serverConfig = await server.configCommand.getConfig()
      expect(serverConfig.instance.defaultNSFWPolicy).to.equal('display')

      for (const body of await getVideosFunctions()) {
        expect(body.total).to.equal(2)

        const videos = body.data
        expect(videos).to.have.lengthOf(2)
        expect(videos[0].name).to.equal('normal')
        expect(videos[1].name).to.equal('nsfw')
      }
    })

    it('Should not display NSFW videos with do_not_list default NSFW policy', async function () {
      customConfig.instance.defaultNSFWPolicy = 'do_not_list'
      await server.configCommand.updateCustomConfig({ newCustomConfig: customConfig })

      const serverConfig = await server.configCommand.getConfig()
      expect(serverConfig.instance.defaultNSFWPolicy).to.equal('do_not_list')

      for (const body of await getVideosFunctions()) {
        expect(body.total).to.equal(1)

        const videos = body.data
        expect(videos).to.have.lengthOf(1)
        expect(videos[0].name).to.equal('normal')
      }
    })

    it('Should display NSFW videos with blur default NSFW policy', async function () {
      customConfig.instance.defaultNSFWPolicy = 'blur'
      await server.configCommand.updateCustomConfig({ newCustomConfig: customConfig })

      const serverConfig = await server.configCommand.getConfig()
      expect(serverConfig.instance.defaultNSFWPolicy).to.equal('blur')

      for (const body of await getVideosFunctions()) {
        expect(body.total).to.equal(2)

        const videos = body.data
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
      await server.configCommand.updateCustomConfig({ newCustomConfig: customConfig })

      for (const body of await getVideosFunctions(userAccessToken)) {
        expect(body.total).to.equal(2)

        const videos = body.data
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

      for (const body of await getVideosFunctions(server.accessToken)) {
        expect(body.total).to.equal(2)

        const videos = body.data
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

      for (const body of await getVideosFunctions(server.accessToken)) {
        expect(body.total).to.equal(1)

        const videos = body.data
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
      for (const body of await getVideosFunctions(server.accessToken, { nsfw: 'true' })) {
        expect(body.total).to.equal(1)

        const videos = body.data
        expect(videos).to.have.lengthOf(1)
        expect(videos[0].name).to.equal('nsfw')
      }
    })

    it('Should hide NSFW videos when the nsfw param === true', async function () {
      for (const body of await getVideosFunctions(server.accessToken, { nsfw: 'false' })) {
        expect(body.total).to.equal(1)

        const videos = body.data
        expect(videos).to.have.lengthOf(1)
        expect(videos[0].name).to.equal('normal')
      }
    })

    it('Should display both videos when the nsfw param === both', async function () {
      for (const body of await getVideosFunctions(server.accessToken, { nsfw: 'both' })) {
        expect(body.total).to.equal(2)

        const videos = body.data
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
