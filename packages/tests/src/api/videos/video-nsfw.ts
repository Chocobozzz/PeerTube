/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import {
  CustomConfig,
  NSFWFlag,
  NSFWPolicyType,
  ResultList,
  Video,
  VideoPrivacy,
  VideosCommonQuery,
  VideosOverview
} from '@peertube/peertube-models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  PeerTubeServer,
  sendRTMPStream,
  setAccessTokensToServers,
  stopFfmpeg,
  waitJobs
} from '@peertube/peertube-server-commands'
import { FIXTURE_URLS } from '@tests/shared/fixture-urls.js'
import { expect } from 'chai'

function createOverviewRes (overview: VideosOverview) {
  const videos = overview.categories[0].videos

  return { data: videos, total: videos.length }
}

describe('Test video NSFW policy', function () {
  let servers: PeerTubeServer[]
  let userAccessToken: string
  let customConfig: CustomConfig

  async function getVideosFunctions (
    token?: string,
    query: Partial<Pick<VideosCommonQuery, 'nsfw' | 'nsfwFlagsExcluded' | 'nsfwFlagsIncluded'>> = {}
  ) {
    const user = await servers[0].users.getMyInfo()

    const channelName = user.videoChannels[0].name
    const accountName = user.account.name + '@' + user.account.host

    const hasQuery = Object.keys(query).length !== 0

    const promises = [
      token
        ? servers[0].videos.listWithToken({ token, ...query })
        : servers[0].videos.list(query),

      servers[0].search.advancedVideoSearch({ token: token || null, search: { sort: '-publishedAt', ...query } }),
      servers[0].videos.listByAccount({ token: token || null, handle: accountName, ...query }),
      servers[0].videos.listByChannel({ token: token || null, handle: channelName, ...query })
    ]

    // Overviews do not support video filters
    if (!hasQuery) {
      const p = servers[0].overviews.getVideos({ page: 1, token })
        .then(res => createOverviewRes(res))

      promises.push(p)
    }

    return Promise.all(promises)
  }

  async function checkHasAll (token?: string) {
    for (const body of await getVideosFunctions(token)) {
      expect(body.total).to.equal(5)

      const videos = body.data
      expect(videos).to.have.lengthOf(5)

      expect(videos.map(v => v.name)).to.have.members([ 'not nsfw', 'nsfw simple', 'nsfw sex', 'import violent', 'live violent' ])
    }
  }

  before(async function () {
    this.timeout(50000)

    servers = await createMultipleServers(2)

    // Get the access tokens
    await setAccessTokensToServers(servers)

    customConfig = await servers[0].config.getCustomConfig()

    await doubleFollow(servers[0], servers[1])
  })

  describe('NSFW federation', function () {
    let videoUUID: string

    it('Should upload a video without NSFW', async function () {
      // Add category to have results in overview
      const { uuid } = await servers[0].videos.upload({ attributes: { name: 'not nsfw', nsfw: false, category: 1 } })

      await waitJobs(servers)

      for (const server of servers) {
        const video = await server.videos.get({ id: uuid })

        expect(video.nsfw).to.be.false
        expect(video.nsfwFlags).to.equal(0)
        expect(video.nsfwSummary).to.be.null
      }
    })

    it('Should upload a video with NSFW but without NSFW flags and summary', async function () {
      const { uuid } = await servers[0].videos.upload({ attributes: { name: 'nsfw simple', nsfw: true, category: 1 } })

      await waitJobs(servers)

      for (const server of servers) {
        const video = await server.videos.get({ id: uuid })

        expect(video.nsfw).to.be.true
        expect(video.nsfwFlags).to.equal(0)
        expect(video.nsfwSummary).to.be.null
      }
    })

    it('Should upload a video with NSFW and flags and summary', async function () {
      const { uuid } = await servers[0].videos.upload({
        attributes: {
          name: 'nsfw sex',
          nsfw: true,
          nsfwFlags: NSFWFlag.VIOLENT | NSFWFlag.EXPLICIT_SEX,
          nsfwSummary: 'This is a shocking and disturbing video',
          category: 1
        }
      })
      videoUUID = uuid

      await waitJobs(servers)

      for (const server of servers) {
        const video = await server.videos.get({ id: uuid })

        expect(video.nsfw).to.be.true
        expect(video.nsfwFlags).to.equal(3)
        expect(video.nsfwSummary).to.equal('This is a shocking and disturbing video')
      }
    })

    it('Should update a NSFW tags of a video', async function () {
      {
        await servers[0].videos.update({ id: videoUUID, attributes: { nsfw: false } })
        await waitJobs(servers)

        for (const server of servers) {
          const video = await server.videos.get({ id: videoUUID })

          expect(video.nsfw).to.be.false
          expect(video.nsfwFlags).to.equal(0)
          expect(video.nsfwSummary).to.be.null
        }
      }

      {
        await servers[0].videos.update({ id: videoUUID, attributes: { nsfw: true, nsfwFlags: NSFWFlag.VIOLENT } })
        await waitJobs(servers)

        for (const server of servers) {
          const video = await server.videos.get({ id: videoUUID })

          expect(video.nsfw).to.be.true
          expect(video.nsfwFlags).to.equal(NSFWFlag.VIOLENT)
          expect(video.nsfwSummary).to.be.null
        }
      }

      {
        await servers[0].videos.update({ id: videoUUID, attributes: { nsfw: true, nsfwFlags: NSFWFlag.EXPLICIT_SEX, nsfwSummary: 'test' } })
        await waitJobs(servers)

        for (const server of servers) {
          const video = await server.videos.get({ id: videoUUID })

          expect(video.nsfw).to.be.true
          expect(video.nsfwFlags).to.equal(NSFWFlag.EXPLICIT_SEX)
          expect(video.nsfwSummary).to.equal('test')
        }
      }
    })

    it('Should import a video with NSFW', async function () {
      const { video: { uuid } } = await servers[0].videoImports.importVideo({
        attributes: {
          targetUrl: FIXTURE_URLS.goodVideo,
          name: 'import violent',
          nsfw: true,
          nsfwFlags: NSFWFlag.VIOLENT,
          nsfwSummary: 'This is a violent video',
          privacy: VideoPrivacy.PUBLIC,
          category: 1
        }
      })

      await waitJobs(servers)

      for (const server of servers) {
        const video = await server.videos.get({ id: uuid })

        expect(video.nsfw).to.be.true
        expect(video.nsfwFlags).to.equal(1)
        expect(video.nsfwSummary).to.equal('This is a violent video')
      }
    })

    it('Should create a live with a replay with NSFW', async function () {
      await servers[0].config.save()
      await servers[0].config.enableMinimumTranscoding()
      await servers[0].config.enableLive({ allowReplay: true, transcoding: true, resolutions: 'min' })

      const checkVideo = (video: Video) => {
        expect(video.nsfw).to.be.true
        expect(video.nsfwFlags).to.equal(1)
        expect(video.nsfwSummary).to.equal('This is a violent live')
      }

      const { uuid } = await servers[0].live.create({
        fields: {
          name: 'live violent',
          saveReplay: true,
          permanentLive: false,
          privacy: VideoPrivacy.PUBLIC,
          nsfw: true,
          nsfwFlags: NSFWFlag.VIOLENT,
          nsfwSummary: 'This is a violent live',
          category: 1
        }
      })
      const live = await servers[0].live.get({ videoId: uuid })

      await waitJobs(servers)

      for (const server of servers) {
        const video = await server.videos.get({ id: uuid })

        checkVideo(video)
      }

      const ffmpegCommand = sendRTMPStream({ rtmpBaseUrl: live.rtmpUrl, streamKey: live.streamKey })
      await servers[0].live.waitUntilPublished({ videoId: uuid })

      await stopFfmpeg(ffmpegCommand)

      await servers[0].live.waitUntilReplacedByReplay({ videoId: uuid })
      await waitJobs(servers)

      for (const server of servers) {
        const video = await server.videos.get({ id: uuid })

        checkVideo(video)
      }

      await servers[0].config.rollback()
    })
  })

  describe('Instance default NSFW policy', function () {
    it('Should display NSFW videos with display default NSFW policy', async function () {
      const serverConfig = await servers[0].config.getConfig()
      expect(serverConfig.instance.defaultNSFWPolicy).to.equal('display')

      await checkHasAll()
    })

    it('Should hide some content with nsfwFlagsExcluded', async function () {
      for (const body of await getVideosFunctions(undefined, { nsfwFlagsExcluded: NSFWFlag.VIOLENT })) {
        expect(body.total).to.equal(3)

        const videos = body.data
        expect(videos).to.have.lengthOf(3)

        expect(videos.map(v => v.name)).to.not.have.members([ 'live violent', 'import violent' ])
      }

      for (
        const body of await getVideosFunctions(undefined, { nsfwFlagsExcluded: NSFWFlag.VIOLENT | NSFWFlag.EXPLICIT_SEX })
      ) {
        expect(body.total).to.equal(2)

        const videos = body.data
        expect(videos).to.have.lengthOf(2)

        expect(videos.map(v => v.name)).to.not.have.members([ 'live violent', 'import violent', 'nsfw sex' ])
      }
    })

    it('Should not display NSFW videos with do_not_list default NSFW policy', async function () {
      customConfig.instance.defaultNSFWPolicy = 'do_not_list'
      await servers[0].config.updateCustomConfig({ newCustomConfig: customConfig })

      const serverConfig = await servers[0].config.getConfig()
      expect(serverConfig.instance.defaultNSFWPolicy).to.equal('do_not_list')

      for (const body of await getVideosFunctions()) {
        expect(body.total).to.equal(1)

        const videos = body.data
        expect(videos).to.have.lengthOf(1)
        expect(videos[0].name).to.equal('not nsfw')
      }
    })

    it('Should display NSFW videos with nsfwFlagsIncluded', async function () {
      for (const body of await getVideosFunctions(undefined, { nsfwFlagsIncluded: NSFWFlag.VIOLENT })) {
        expect(body.total).to.equal(3)

        const videos = body.data
        expect(videos).to.have.lengthOf(3)

        expect(videos.map(v => v.name)).to.have.members([ 'not nsfw', 'live violent', 'import violent' ])
      }

      for (
        const body of await getVideosFunctions(undefined, { nsfwFlagsIncluded: NSFWFlag.VIOLENT | NSFWFlag.EXPLICIT_SEX })
      ) {
        expect(body.total).to.equal(4)

        const videos = body.data
        expect(videos).to.have.lengthOf(4)

        expect(videos.map(v => v.name)).to.have.members([ 'not nsfw', 'live violent', 'import violent', 'nsfw sex' ])
      }
    })

    it('Should display NSFW videos with warn/warn_and_blur default NSFW policy', async function () {
      for (const policy of [ 'warn', 'blur' ] as NSFWPolicyType[]) {
        customConfig.instance.defaultNSFWPolicy = policy
        await servers[0].config.updateCustomConfig({ newCustomConfig: customConfig })

        const serverConfig = await servers[0].config.getConfig()
        expect(serverConfig.instance.defaultNSFWPolicy).to.equal(policy)

        await checkHasAll()
      }
    })

    it('Should hide some content with nsfwFlagsExcluded', async function () {
      for (const body of await getVideosFunctions(undefined, { nsfwFlagsExcluded: NSFWFlag.VIOLENT })) {
        expect(body.total).to.equal(3)

        const videos = body.data
        expect(videos).to.have.lengthOf(3)

        expect(videos.map(v => v.name)).to.not.have.members([ 'live violent', 'import violent' ])
      }
    })
  })

  describe('User NSFW policy', function () {
    async function checkNSFWFlag (options: {
      token: string
      check: (results: ResultList<Video>[]) => Promise<void>
      nsfwFlagsHidden?: number
      nsfwFlagsWarned?: number
      nsfwFlagsBlurred?: number
      nsfwFlagsDisplayed?: number
    }) {
      const { token, check, nsfwFlagsHidden, nsfwFlagsWarned, nsfwFlagsBlurred, nsfwFlagsDisplayed } = options

      await check(
        await getVideosFunctions(token, {
          nsfwFlagsExcluded: nsfwFlagsHidden,
          nsfwFlagsIncluded: (nsfwFlagsDisplayed || NSFWFlag.NONE) | (nsfwFlagsWarned || NSFWFlag.NONE) |
            (nsfwFlagsBlurred || NSFWFlag.NONE)
        })
      )

      await servers[0].users.updateMe({ token, nsfwFlagsHidden, nsfwFlagsWarned, nsfwFlagsBlurred, nsfwFlagsDisplayed })

      const me = await servers[0].users.getMyInfo({ token })
      expect(me.nsfwFlagsHidden).to.equal(nsfwFlagsHidden || NSFWFlag.NONE)
      expect(me.nsfwFlagsWarned).to.equal(nsfwFlagsWarned || NSFWFlag.NONE)
      expect(me.nsfwFlagsBlurred).to.equal(nsfwFlagsBlurred || NSFWFlag.NONE)
      expect(me.nsfwFlagsDisplayed).to.equal(nsfwFlagsDisplayed || NSFWFlag.NONE)

      await check(await getVideosFunctions(token))

      await servers[0].users.updateMe({
        token,
        nsfwFlagsHidden: NSFWFlag.NONE,
        nsfwFlagsWarned: NSFWFlag.NONE,
        nsfwFlagsBlurred: NSFWFlag.NONE,
        nsfwFlagsDisplayed: NSFWFlag.NONE
      })
    }

    it('Should create a user having the default nsfw policy', async function () {
      await servers[0].config.updateExistingConfig({ newConfig: { instance: { defaultNSFWPolicy: 'warn' } } })

      const username = 'user1'
      const password = 'my super password'
      await servers[0].users.create({ username, password })

      userAccessToken = await servers[0].login.getAccessToken({ username, password })

      const user = await servers[0].users.getMyInfo({ token: userAccessToken })
      expect(user.nsfwPolicy).to.equal('warn')
    })

    it('Should display NSFW videos with warn user NSFW policy', async function () {
      customConfig.instance.defaultNSFWPolicy = 'do_not_list'
      await servers[0].config.updateCustomConfig({ newCustomConfig: customConfig })

      await checkHasAll(userAccessToken)
    })

    it('Should exclude some videos using NSFW flags', async function () {
      const check = async (results: ResultList<Video>[]) => {
        for (const body of results) {
          expect(body.total).to.equal(3)

          const videos = body.data
          expect(videos).to.have.lengthOf(3)

          expect(videos.map(v => v.name)).to.not.have.members([ 'live violent', 'import violent' ])
        }
      }

      await checkNSFWFlag({
        token: userAccessToken,
        check,
        nsfwFlagsHidden: NSFWFlag.VIOLENT
      })
    })

    it('Should display NSFW videos with display user NSFW policy', async function () {
      await servers[0].users.updateMe({ nsfwPolicy: 'display' })

      await checkHasAll(servers[0].accessToken)
    })

    it('Should exclude some videos using NSFW flags', async function () {
      const check = async (results: ResultList<Video>[]) => {
        for (const body of results) {
          expect(body.total).to.equal(2)

          const videos = body.data
          expect(videos).to.have.lengthOf(2)

          expect(videos.map(v => v.name)).to.not.have.members([ 'live violent', 'import violent', 'nsfw sex' ])
        }
      }

      await checkNSFWFlag({
        token: userAccessToken,
        check,
        nsfwFlagsHidden: NSFWFlag.VIOLENT | NSFWFlag.EXPLICIT_SEX
      })
    })

    it('Should not display NSFW videos with do_not_list user NSFW policy', async function () {
      await servers[0].users.updateMe({ nsfwPolicy: 'do_not_list' })

      for (const body of await getVideosFunctions(servers[0].accessToken)) {
        expect(body.total).to.equal(1)

        const videos = body.data
        expect(videos).to.have.lengthOf(1)

        expect(videos.map(v => v.name)).to.have.members([ 'not nsfw' ])
      }
    })

    it('Should include some videos using NSFW flags', async function () {
      const check = async (results: ResultList<Video>[]) => {
        for (const body of results) {
          expect(body.total).to.equal(2)

          const videos = body.data
          expect(videos).to.have.lengthOf(2)

          expect(videos.map(v => v.name)).to.have.members([ 'not nsfw', 'nsfw sex' ])
        }
      }

      await checkNSFWFlag({
        token: servers[0].accessToken,
        check,
        nsfwFlagsDisplayed: NSFWFlag.EXPLICIT_SEX
      })
    })

    it('Should include and warn some videos using NSFW flags', async function () {
      const check = async (results: ResultList<Video>[]) => {
        for (const body of results) {
          expect(body.total).to.equal(4)

          const videos = body.data
          expect(videos).to.have.lengthOf(4)

          expect(videos.map(v => v.name)).to.have.members([ 'not nsfw', 'live violent', 'import violent', 'nsfw sex' ])
        }
      }

      await checkNSFWFlag({
        token: servers[0].accessToken,
        check,
        nsfwFlagsDisplayed: NSFWFlag.EXPLICIT_SEX,
        nsfwFlagsWarned: NSFWFlag.VIOLENT
      })

      await checkNSFWFlag({
        token: servers[0].accessToken,
        check,
        nsfwFlagsBlurred: NSFWFlag.EXPLICIT_SEX,
        nsfwFlagsWarned: NSFWFlag.VIOLENT
      })
    })

    it('Should be able to see my NSFW videos even with do_not_list user NSFW policy', async function () {
      const { total, data } = await servers[0].videos.listMyVideos()
      expect(total).to.equal(5)

      expect(data).to.have.lengthOf(5)
      expect(data.map(v => v.name)).to.have.members([ 'not nsfw', 'nsfw simple', 'nsfw sex', 'import violent', 'live violent' ])
    })

    it('Should display NSFW videos when the nsfw param === true', async function () {
      for (const { total, data } of await getVideosFunctions(servers[0].accessToken, { nsfw: 'true' })) {
        expect(total).to.equal(4)

        expect(data).to.have.lengthOf(4)
        expect(data.map(v => v.name)).to.have.members([ 'nsfw simple', 'nsfw sex', 'import violent', 'live violent' ])
      }
    })

    it('Should hide NSFW videos when the nsfw param === true', async function () {
      for (const body of await getVideosFunctions(servers[0].accessToken, { nsfw: 'false' })) {
        expect(body.total).to.equal(1)

        const videos = body.data
        expect(videos).to.have.lengthOf(1)
        expect(videos[0].name).to.equal('not nsfw')
      }
    })

    it('Should display both videos when the nsfw param === both', async function () {
      for (const { total, data } of await getVideosFunctions(servers[0].accessToken, { nsfw: 'both' })) {
        expect(total).to.equal(5)

        expect(data).to.have.lengthOf(5)
        expect(data.map(v => v.name)).to.have.members([ 'not nsfw', 'nsfw simple', 'nsfw sex', 'import violent', 'live violent' ])
      }
    })

    it('Should disable NSFW flags policy', async function () {
      await servers[0].users.updateMe({
        token: userAccessToken,
        nsfwPolicy: 'do_not_list',
        nsfwFlagsHidden: NSFWFlag.EXPLICIT_SEX,
        nsfwFlagsWarned: NSFWFlag.NONE,
        nsfwFlagsBlurred: NSFWFlag.NONE,
        nsfwFlagsDisplayed: NSFWFlag.VIOLENT
      })

      await servers[0].kill()
      await servers[0].run({ nsfw_flags_settings: { enabled: false } })

      const me = await servers[0].users.getMyInfo({ token: userAccessToken })
      expect(me.nsfwPolicy).to.equal('do_not_list')
      expect(me.nsfwFlagsHidden).to.equal(0)
      expect(me.nsfwFlagsWarned).to.equal(0)
      expect(me.nsfwFlagsBlurred).to.equal(0)
      expect(me.nsfwFlagsDisplayed).to.equal(0)

      for (const { total, data } of await getVideosFunctions(userAccessToken)) {
        expect(total).to.equal(1)

        expect(data).to.have.lengthOf(1)
        expect(data.map(v => v.name)).to.have.members([ 'not nsfw' ])
      }
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
