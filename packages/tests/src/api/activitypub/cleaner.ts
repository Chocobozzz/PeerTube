/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { SQLCommand } from '@tests/shared/sql-command.js'
import { wait } from '@peertube/peertube-core-utils'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'

describe('Test AP cleaner', function () {
  let servers: PeerTubeServer[] = []
  const sqlCommands: SQLCommand[] = []

  let videoUUID1: string
  let videoUUID2: string
  let videoUUID3: string

  let videoUUIDs: string[]

  before(async function () {
    this.timeout(240000)

    const config = {
      federation: {
        videos: { cleanup_remote_interactions: true }
      }
    }
    servers = await createMultipleServers(3, config)

    // Get the access tokens
    await setAccessTokensToServers(servers)

    await Promise.all([
      doubleFollow(servers[0], servers[1]),
      doubleFollow(servers[1], servers[2]),
      doubleFollow(servers[0], servers[2])
    ])

    // Update 1 local share, check 6 shares

    // Create 1 comment per video
    // Update 1 remote URL and 1 local URL on

    videoUUID1 = (await servers[0].videos.quickUpload({ name: 'server 1' })).uuid
    videoUUID2 = (await servers[1].videos.quickUpload({ name: 'server 2' })).uuid
    videoUUID3 = (await servers[2].videos.quickUpload({ name: 'server 3' })).uuid

    videoUUIDs = [ videoUUID1, videoUUID2, videoUUID3 ]

    await waitJobs(servers)

    for (const server of servers) {
      for (const uuid of videoUUIDs) {
        await server.videos.rate({ id: uuid, rating: 'like' })
        await server.comments.createThread({ videoId: uuid, text: 'comment' })
      }

      sqlCommands.push(new SQLCommand(server))
    }

    await waitJobs(servers)
  })

  it('Should have the correct likes', async function () {
    for (const server of servers) {
      for (const uuid of videoUUIDs) {
        const video = await server.videos.get({ id: uuid })

        expect(video.likes).to.equal(3)
        expect(video.dislikes).to.equal(0)
      }
    }
  })

  it('Should destroy server 3 internal likes and correctly clean them', async function () {
    this.timeout(20000)

    await sqlCommands[2].deleteAll('accountVideoRate')
    for (const uuid of videoUUIDs) {
      await sqlCommands[2].setVideoField(uuid, 'likes', '0')
    }

    await wait(5000)
    await waitJobs(servers)

    // Updated rates of my video
    {
      const video = await servers[0].videos.get({ id: videoUUID1 })
      expect(video.likes).to.equal(2)
      expect(video.dislikes).to.equal(0)
    }

    // Did not update rates of a remote video
    {
      const video = await servers[0].videos.get({ id: videoUUID2 })
      expect(video.likes).to.equal(3)
      expect(video.dislikes).to.equal(0)
    }
  })

  it('Should update rates to dislikes', async function () {
    this.timeout(20000)

    for (const server of servers) {
      for (const uuid of videoUUIDs) {
        await server.videos.rate({ id: uuid, rating: 'dislike' })
      }
    }

    await waitJobs(servers)

    for (const server of servers) {
      for (const uuid of videoUUIDs) {
        const video = await server.videos.get({ id: uuid })
        expect(video.likes).to.equal(0)
        expect(video.dislikes).to.equal(3)
      }
    }
  })

  it('Should destroy server 3 internal dislikes and correctly clean them', async function () {
    this.timeout(20000)

    await sqlCommands[2].deleteAll('accountVideoRate')

    for (const uuid of videoUUIDs) {
      await sqlCommands[2].setVideoField(uuid, 'dislikes', '0')
    }

    await wait(5000)
    await waitJobs(servers)

    // Updated rates of my video
    {
      const video = await servers[0].videos.get({ id: videoUUID1 })
      expect(video.likes).to.equal(0)
      expect(video.dislikes).to.equal(2)
    }

    // Did not update rates of a remote video
    {
      const video = await servers[0].videos.get({ id: videoUUID2 })
      expect(video.likes).to.equal(0)
      expect(video.dislikes).to.equal(3)
    }
  })

  it('Should destroy server 3 internal shares and correctly clean them', async function () {
    this.timeout(20000)

    const preCount = await sqlCommands[0].getVideoShareCount()
    expect(preCount).to.equal(6)

    await sqlCommands[2].deleteAll('videoShare')
    await wait(5000)
    await waitJobs(servers)

    // Still 6 because we don't have remote shares on local videos
    const postCount = await sqlCommands[0].getVideoShareCount()
    expect(postCount).to.equal(6)
  })

  it('Should destroy server 3 internal comments and correctly clean them', async function () {
    this.timeout(20000)

    {
      const { total } = await servers[0].comments.listThreads({ videoId: videoUUID1 })
      expect(total).to.equal(3)
    }

    await sqlCommands[2].deleteAll('videoComment')

    await wait(5000)
    await waitJobs(servers)

    {
      const { total } = await servers[0].comments.listThreads({ videoId: videoUUID1 })
      expect(total).to.equal(2)
    }
  })

  it('Should correctly update rate URLs', async function () {
    this.timeout(30000)

    async function check (like: string, ofServerUrl: string, urlSuffix: string, remote: 'true' | 'false') {
      const query = `SELECT "videoId", "accountVideoRate".url FROM "accountVideoRate" ` +
        `INNER JOIN video ON "accountVideoRate"."videoId" = video.id AND remote IS ${remote} WHERE "accountVideoRate"."url" LIKE '${like}'`
      const res = await sqlCommands[0].selectQuery<{ url: string }>(query)

      for (const rate of res) {
        const matcher = new RegExp(`^${ofServerUrl}/accounts/root/dislikes/\\d+${urlSuffix}$`)
        expect(rate.url).to.match(matcher)
      }
    }

    async function checkLocal () {
      const startsWith = 'http://' + servers[0].host + '%'
      // On local videos
      await check(startsWith, servers[0].url, '', 'false')
      // On remote videos
      await check(startsWith, servers[0].url, '', 'true')
    }

    async function checkRemote (suffix: string) {
      const startsWith = 'http://' + servers[1].host + '%'
      // On local videos
      await check(startsWith, servers[1].url, suffix, 'false')
      // On remote videos, we should not update URLs so no suffix
      await check(startsWith, servers[1].url, '', 'true')
    }

    await checkLocal()
    await checkRemote('')

    {
      const query = `UPDATE "accountVideoRate" SET url = url || 'stan'`
      await sqlCommands[1].updateQuery(query)

      await wait(5000)
      await waitJobs(servers)
    }

    await checkLocal()
    await checkRemote('stan')
  })

  it('Should correctly update comment URLs', async function () {
    this.timeout(30000)

    async function check (like: string, ofServerUrl: string, urlSuffix: string, remote: 'true' | 'false') {
      const query = `SELECT "videoId", "videoComment".url, uuid as "videoUUID" FROM "videoComment" ` +
        `INNER JOIN video ON "videoComment"."videoId" = video.id AND remote IS ${remote} WHERE "videoComment"."url" LIKE '${like}'`

      const res = await sqlCommands[0].selectQuery<{ url: string, videoUUID: string }>(query)

      for (const comment of res) {
        const matcher = new RegExp(`${ofServerUrl}/videos/watch/${comment.videoUUID}/comments/\\d+${urlSuffix}`)
        expect(comment.url).to.match(matcher)
      }
    }

    async function checkLocal () {
      const startsWith = 'http://' + servers[0].host + '%'
      // On local videos
      await check(startsWith, servers[0].url, '', 'false')
      // On remote videos
      await check(startsWith, servers[0].url, '', 'true')
    }

    async function checkRemote (suffix: string) {
      const startsWith = 'http://' + servers[1].host + '%'
      // On local videos
      await check(startsWith, servers[1].url, suffix, 'false')
      // On remote videos, we should not update URLs so no suffix
      await check(startsWith, servers[1].url, '', 'true')
    }

    {
      const query = `UPDATE "videoComment" SET url = url || 'kyle'`
      await sqlCommands[1].updateQuery(query)

      await wait(5000)
      await waitJobs(servers)
    }

    await checkLocal()
    await checkRemote('kyle')
  })

  it('Should remove unavailable remote resources', async function () {
    this.timeout(240000)

    async function expectNotDeleted () {
      {
        const video = await servers[0].videos.get({ id: uuid })

        expect(video.likes).to.equal(3)
        expect(video.dislikes).to.equal(0)
      }

      {
        const { total } = await servers[0].comments.listThreads({ videoId: uuid })
        expect(total).to.equal(3)
      }
    }

    async function expectDeleted () {
      {
        const video = await servers[0].videos.get({ id: uuid })

        expect(video.likes).to.equal(2)
        expect(video.dislikes).to.equal(0)
      }

      {
        const { total } = await servers[0].comments.listThreads({ videoId: uuid })
        expect(total).to.equal(2)
      }
    }

    const uuid = (await servers[0].videos.quickUpload({ name: 'server 1 video 2' })).uuid

    await waitJobs(servers)

    for (const server of servers) {
      await server.videos.rate({ id: uuid, rating: 'like' })
      await server.comments.createThread({ videoId: uuid, text: 'comment' })
    }

    await waitJobs(servers)

    await expectNotDeleted()

    await servers[1].kill()

    await wait(5000)
    await expectNotDeleted()

    let continueWhile = true

    do {
      try {
        await expectDeleted()
        continueWhile = false
      } catch {
      }
    } while (continueWhile)
  })

  after(async function () {
    for (const sql of sqlCommands) {
      await sql.cleanup()
    }

    await cleanupTests(servers)
  })
})
