/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { cleanupTests, createSingleServer, PeerTubeServer, setAccessTokensToServers } from '@peertube/peertube-server-commands'
import { BooleanBothQuery, CustomConfig, ResultList, Video, VideosOverview } from '@peertube/peertube-models'

function createOverviewRes (overview: VideosOverview) {
  const videos = overview.categories[0].videos
  return { data: videos, total: videos.length }
}

describe('Test video NSFW policy', function () {
  let server: PeerTubeServer
  let userAccessToken: string
  let customConfig: CustomConfig

  async function getVideosFunctions (token?: string, query: { nsfw?: BooleanBothQuery } = {}) {
    const user = await server.users.getMyInfo()

    const channelName = user.videoChannels[0].name
    const accountName = user.account.name + '@' + user.account.host

    const hasQuery = Object.keys(query).length !== 0
    let promises: Promise<ResultList<Video>>[]

    if (token) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      promises = [
        server.search.advancedVideoSearch({ token, search: { search: 'n', sort: '-publishedAt', ...query } }),
        server.videos.listWithToken({ token, ...query }),
        server.videos.listByAccount({ token, handle: accountName, ...query }),
        server.videos.listByChannel({ token, handle: channelName, ...query })
      ]

      // Overviews do not support video filters
      if (!hasQuery) {
        const p = server.overviews.getVideos({ page: 1, token })
          .then(res => createOverviewRes(res))
        promises.push(p)
      }

      return Promise.all(promises)
    }

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    promises = [
      server.search.searchVideos({ search: 'n', sort: '-publishedAt' }),
      server.videos.list(),
      server.videos.listByAccount({ token: null, handle: accountName }),
      server.videos.listByChannel({ token: null, handle: channelName })
    ]

    // Overviews do not support video filters
    if (!hasQuery) {
      const p = server.overviews.getVideos({ page: 1 })
        .then(res => createOverviewRes(res))

      promises.push(p)
    }

    return Promise.all(promises)
  }

  before(async function () {
    this.timeout(50000)
    server = await createSingleServer(1)

    // Get the access tokens
    await setAccessTokensToServers([ server ])

    {
      const attributes = { name: 'nsfw', nsfw: true, category: 1 }
      await server.videos.upload({ attributes })
    }

    {
      const attributes = { name: 'normal', nsfw: false, category: 1 }
      await server.videos.upload({ attributes })
    }

    customConfig = await server.config.getCustomConfig()
  })

  describe('Instance default NSFW policy', function () {

    it('Should display NSFW videos with display default NSFW policy', async function () {
      const serverConfig = await server.config.getConfig()
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
      await server.config.updateCustomConfig({ newCustomConfig: customConfig })

      const serverConfig = await server.config.getConfig()
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
      await server.config.updateCustomConfig({ newCustomConfig: customConfig })

      const serverConfig = await server.config.getConfig()
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
      await server.users.create({ username, password })

      userAccessToken = await server.login.getAccessToken({ username, password })

      const user = await server.users.getMyInfo({ token: userAccessToken })
      expect(user.nsfwPolicy).to.equal('blur')
    })

    it('Should display NSFW videos with blur user NSFW policy', async function () {
      customConfig.instance.defaultNSFWPolicy = 'do_not_list'
      await server.config.updateCustomConfig({ newCustomConfig: customConfig })

      for (const body of await getVideosFunctions(userAccessToken)) {
        expect(body.total).to.equal(2)

        const videos = body.data
        expect(videos).to.have.lengthOf(2)
        expect(videos[0].name).to.equal('normal')
        expect(videos[1].name).to.equal('nsfw')
      }
    })

    it('Should display NSFW videos with display user NSFW policy', async function () {
      await server.users.updateMe({ nsfwPolicy: 'display' })

      for (const body of await getVideosFunctions(server.accessToken)) {
        expect(body.total).to.equal(2)

        const videos = body.data
        expect(videos).to.have.lengthOf(2)
        expect(videos[0].name).to.equal('normal')
        expect(videos[1].name).to.equal('nsfw')
      }
    })

    it('Should not display NSFW videos with do_not_list user NSFW policy', async function () {
      await server.users.updateMe({ nsfwPolicy: 'do_not_list' })

      for (const body of await getVideosFunctions(server.accessToken)) {
        expect(body.total).to.equal(1)

        const videos = body.data
        expect(videos).to.have.lengthOf(1)
        expect(videos[0].name).to.equal('normal')
      }
    })

    it('Should be able to see my NSFW videos even with do_not_list user NSFW policy', async function () {
      const { total, data } = await server.videos.listMyVideos()
      expect(total).to.equal(2)

      expect(data).to.have.lengthOf(2)
      expect(data[0].name).to.equal('normal')
      expect(data[1].name).to.equal('nsfw')
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
