/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { Video, VideoAIUsage, VideoAIUsageType } from '@peertube/peertube-models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'

describe('Test video AI usage', function () {
  let servers: PeerTubeServer[]
  let userToken: string

  const uuids: { [id in VideoAIUsageType]?: string } = {}

  function getNames (videos: Video[]) {
    return videos.map(v => v.name).sort()
  }

  before(async function () {
    this.timeout(120000)

    servers = await createMultipleServers(2)
    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    await doubleFollow(servers[0], servers[1])

    userToken = await servers[1].users.generateUserAndToken('user1')
  })

  describe('AI usage of a video', function () {
    it('Should default a new video to not specified', async function () {
      const { uuid } = await servers[0].videos.quickUpload({ name: 'not specified' })
      uuids[VideoAIUsage.NOT_SPECIFIED] = uuid

      await waitJobs(servers)

      for (const server of servers) {
        const video = await server.videos.get({ id: uuid })

        expect(video.aiUsage.id).to.equal(VideoAIUsage.NOT_SPECIFIED)
        expect(video.aiUsage.label).to.equal('Not specified')
      }
    })

    it('Should upload videos with a specific AI usage and federate it', async function () {
      this.timeout(60000)

      const toUpload = [
        { name: 'no ai', aiUsage: VideoAIUsage.NO_AI },
        { name: 'contains ai', aiUsage: VideoAIUsage.CONTAINS_AI },
        { name: 'ai generated', aiUsage: VideoAIUsage.AI_GENERATED }
      ]

      for (const attributes of toUpload) {
        const mode = attributes.aiUsage === VideoAIUsage.CONTAINS_AI
          ? 'legacy'
          : 'resumable'

        const { uuid } = await servers[0].videos.upload({ attributes, mode })
        uuids[attributes.aiUsage] = uuid
      }

      await waitJobs(servers)

      for (const server of servers) {
        for (const { aiUsage } of toUpload) {
          const video = await server.videos.get({ id: uuids[aiUsage] })
          expect(video.aiUsage.id).to.equal(aiUsage)
        }

        const { data } = await server.videos.list()
        const aiGenerated = data.find(v => v.uuid === uuids[VideoAIUsage.AI_GENERATED])

        expect(aiGenerated.aiUsage.id).to.equal(VideoAIUsage.AI_GENERATED)
        expect(aiGenerated.aiUsage.label).to.equal('AI-generated')
      }
    })

    it('Should update the AI usage and federate it', async function () {
      const { uuid } = await servers[0].videos.quickUpload({ name: 'to update' })

      await servers[0].videos.update({ id: uuid, attributes: { aiUsage: VideoAIUsage.CONTAINS_AI } })
      await waitJobs(servers)

      for (const server of servers) {
        const video = await server.videos.get({ id: uuid })
        expect(video.aiUsage.id).to.equal(VideoAIUsage.CONTAINS_AI)
      }

      // Updating another attribute doesn't reset the AI usage
      await servers[0].videos.update({ id: uuid, attributes: { name: 'to update 2' } })
      await waitJobs(servers)

      for (const server of servers) {
        const video = await server.videos.get({ id: uuid })
        expect(video.aiUsage.id).to.equal(VideoAIUsage.CONTAINS_AI)
      }

      await servers[0].videos.remove({ id: uuid })
      await waitJobs(servers)
    })
  })

  describe('Filter videos on AI usage', function () {
    it('Should filter videos with the aiUsageOneOf query param', async function () {
      for (const server of servers) {
        {
          const { data } = await server.videos.list({ aiUsageOneOf: [ VideoAIUsage.NO_AI ] })
          expect(getNames(data)).to.deep.equal([ 'no ai' ])
        }

        {
          const { data } = await server.videos.list({ aiUsageOneOf: [ VideoAIUsage.CONTAINS_AI, VideoAIUsage.AI_GENERATED ] })
          expect(getNames(data)).to.deep.equal([ 'ai generated', 'contains ai' ])
        }

        {
          const { data } = await server.videos.list()
          expect(data).to.have.lengthOf(4)
        }
      }
    })

    it('Should filter channel, account and search videos', async function () {
      const aiUsageOneOf = [ VideoAIUsage.NOT_SPECIFIED, VideoAIUsage.NO_AI ]

      {
        const { data } = await servers[0].videos.listByChannel({ handle: 'root_channel', aiUsageOneOf })
        expect(getNames(data)).to.deep.equal([ 'no ai', 'not specified' ])
      }

      {
        const { data } = await servers[0].videos.listByAccount({ handle: 'root', aiUsageOneOf })
        expect(getNames(data)).to.deep.equal([ 'no ai', 'not specified' ])
      }

      {
        const { data } = await servers[0].search.advancedVideoSearch({ search: { search: 'ai', aiUsageOneOf } })
        expect(getNames(data)).to.deep.equal([ 'no ai' ])
      }
    })

    it('Should not hide videos for a user without preference', async function () {
      const { data } = await servers[1].videos.list({ token: userToken })
      expect(data).to.have.lengthOf(4)
    })

    it('Should hide videos depending on the user preference', async function () {
      await servers[1].users.updateMe({ token: userToken, aiUsagesHidden: [ VideoAIUsage.AI_GENERATED, VideoAIUsage.CONTAINS_AI ] })

      const me = await servers[1].users.getMyInfo({ token: userToken })
      expect(me.aiUsagesHidden).to.have.members([ VideoAIUsage.AI_GENERATED, VideoAIUsage.CONTAINS_AI ])

      {
        const { data } = await servers[1].videos.list({ token: userToken })
        expect(getNames(data)).to.deep.equal([ 'no ai', 'not specified' ])
      }

      {
        const { data } = await servers[1].videos.listByChannel({ token: userToken, handle: 'root_channel@' + servers[0].host })
        expect(getNames(data)).to.deep.equal([ 'no ai', 'not specified' ])
      }

      {
        const { data } = await servers[1].search.searchVideos({ token: userToken, search: 'ai' })
        expect(getNames(data)).to.deep.equal([ 'no ai' ])
      }

      {
        const { data } = await servers[1].videos.listRecommendations({ token: userToken, count: 10 })
        expect(getNames(data)).to.deep.equal([ 'no ai', 'not specified' ])
      }

      // Anonymous users are not impacted
      {
        const { data } = await servers[1].videos.list()
        expect(data).to.have.lengthOf(4)
      }
    })

    it('Should override the user preference with the aiUsageOneOf query param', async function () {
      const { data } = await servers[1].videos.list({ token: userToken, aiUsageOneOf: [ VideoAIUsage.AI_GENERATED ] })
      expect(getNames(data)).to.deep.equal([ 'ai generated' ])
    })

    it('Should display all videos again after resetting the user preference', async function () {
      await servers[1].users.updateMe({ token: userToken, aiUsagesHidden: [] })

      const { data } = await servers[1].videos.list({ token: userToken })
      expect(data).to.have.lengthOf(4)
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
