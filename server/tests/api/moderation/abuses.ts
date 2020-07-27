/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import {
  AbuseFilter,
  AbuseMessage,
  AbusePredefinedReasonsString,
  AbuseState,
  Account,
  AdminAbuse,
  UserAbuse,
  VideoComment
} from '@shared/models'
import {
  addAbuseMessage,
  addVideoCommentThread,
  cleanupTests,
  createUser,
  deleteAbuse,
  deleteAbuseMessage,
  deleteVideoComment,
  flushAndRunMultipleServers,
  generateUserAccessToken,
  getAccount,
  getAdminAbusesList,
  getUserAbusesList,
  getVideoCommentThreads,
  getVideoIdFromUUID,
  getVideosList,
  immutableAssign,
  listAbuseMessages,
  removeUser,
  removeVideo,
  reportAbuse,
  ServerInfo,
  setAccessTokensToServers,
  updateAbuse,
  uploadVideo,
  uploadVideoAndGetId,
  userLogin
} from '../../../../shared/extra-utils/index'
import { doubleFollow } from '../../../../shared/extra-utils/server/follows'
import { waitJobs } from '../../../../shared/extra-utils/server/jobs'
import {
  addAccountToServerBlocklist,
  addServerToServerBlocklist,
  removeAccountFromServerBlocklist,
  removeServerFromServerBlocklist
} from '../../../../shared/extra-utils/users/blocklist'

const expect = chai.expect

describe('Test abuses', function () {
  let servers: ServerInfo[] = []
  let abuseServer1: AdminAbuse
  let abuseServer2: AdminAbuse

  before(async function () {
    this.timeout(50000)

    // Run servers
    servers = await flushAndRunMultipleServers(2)

    // Get the access tokens
    await setAccessTokensToServers(servers)

    // Server 1 and server 2 follow each other
    await doubleFollow(servers[0], servers[1])
  })

  describe('Video abuses', function () {

    before(async function () {
      this.timeout(50000)

      // Upload some videos on each servers
      const video1Attributes = {
        name: 'my super name for server 1',
        description: 'my super description for server 1'
      }
      await uploadVideo(servers[0].url, servers[0].accessToken, video1Attributes)

      const video2Attributes = {
        name: 'my super name for server 2',
        description: 'my super description for server 2'
      }
      await uploadVideo(servers[1].url, servers[1].accessToken, video2Attributes)

      // Wait videos propagation, server 2 has transcoding enabled
      await waitJobs(servers)

      const res = await getVideosList(servers[0].url)
      const videos = res.body.data

      expect(videos.length).to.equal(2)

      servers[0].video = videos.find(video => video.name === 'my super name for server 1')
      servers[1].video = videos.find(video => video.name === 'my super name for server 2')
    })

    it('Should not have abuses', async function () {
      const res = await getAdminAbusesList({ url: servers[0].url, token: servers[0].accessToken })

      expect(res.body.total).to.equal(0)
      expect(res.body.data).to.be.an('array')
      expect(res.body.data.length).to.equal(0)
    })

    it('Should report abuse on a local video', async function () {
      this.timeout(15000)

      const reason = 'my super bad reason'
      await reportAbuse({ url: servers[0].url, token: servers[0].accessToken, videoId: servers[0].video.id, reason })

      // We wait requests propagation, even if the server 1 is not supposed to make a request to server 2
      await waitJobs(servers)
    })

    it('Should have 1 video abuses on server 1 and 0 on server 2', async function () {
      const res1 = await getAdminAbusesList({ url: servers[0].url, token: servers[0].accessToken })

      expect(res1.body.total).to.equal(1)
      expect(res1.body.data).to.be.an('array')
      expect(res1.body.data.length).to.equal(1)

      const abuse: AdminAbuse = res1.body.data[0]
      expect(abuse.reason).to.equal('my super bad reason')

      expect(abuse.reporterAccount.name).to.equal('root')
      expect(abuse.reporterAccount.host).to.equal(servers[0].host)

      expect(abuse.video.id).to.equal(servers[0].video.id)
      expect(abuse.video.channel).to.exist

      expect(abuse.comment).to.be.null

      expect(abuse.flaggedAccount.name).to.equal('root')
      expect(abuse.flaggedAccount.host).to.equal(servers[0].host)

      expect(abuse.video.countReports).to.equal(1)
      expect(abuse.video.nthReport).to.equal(1)

      expect(abuse.countReportsForReporter).to.equal(1)
      expect(abuse.countReportsForReportee).to.equal(1)

      const res2 = await getAdminAbusesList({ url: servers[1].url, token: servers[1].accessToken })
      expect(res2.body.total).to.equal(0)
      expect(res2.body.data).to.be.an('array')
      expect(res2.body.data.length).to.equal(0)
    })

    it('Should report abuse on a remote video', async function () {
      this.timeout(10000)

      const reason = 'my super bad reason 2'
      const videoId = await getVideoIdFromUUID(servers[0].url, servers[1].video.uuid)
      await reportAbuse({ url: servers[0].url, token: servers[0].accessToken, videoId, reason })

      // We wait requests propagation
      await waitJobs(servers)
    })

    it('Should have 2 video abuses on server 1 and 1 on server 2', async function () {
      const res1 = await getAdminAbusesList({ url: servers[0].url, token: servers[0].accessToken })

      expect(res1.body.total).to.equal(2)
      expect(res1.body.data.length).to.equal(2)

      const abuse1: AdminAbuse = res1.body.data[0]
      expect(abuse1.reason).to.equal('my super bad reason')
      expect(abuse1.reporterAccount.name).to.equal('root')
      expect(abuse1.reporterAccount.host).to.equal(servers[0].host)

      expect(abuse1.video.id).to.equal(servers[0].video.id)
      expect(abuse1.video.countReports).to.equal(1)
      expect(abuse1.video.nthReport).to.equal(1)

      expect(abuse1.comment).to.be.null

      expect(abuse1.flaggedAccount.name).to.equal('root')
      expect(abuse1.flaggedAccount.host).to.equal(servers[0].host)

      expect(abuse1.state.id).to.equal(AbuseState.PENDING)
      expect(abuse1.state.label).to.equal('Pending')
      expect(abuse1.moderationComment).to.be.null

      const abuse2: AdminAbuse = res1.body.data[1]
      expect(abuse2.reason).to.equal('my super bad reason 2')

      expect(abuse2.reporterAccount.name).to.equal('root')
      expect(abuse2.reporterAccount.host).to.equal(servers[0].host)

      expect(abuse2.video.id).to.equal(servers[1].video.id)

      expect(abuse2.comment).to.be.null

      expect(abuse2.flaggedAccount.name).to.equal('root')
      expect(abuse2.flaggedAccount.host).to.equal(servers[1].host)

      expect(abuse2.state.id).to.equal(AbuseState.PENDING)
      expect(abuse2.state.label).to.equal('Pending')
      expect(abuse2.moderationComment).to.be.null

      const res2 = await getAdminAbusesList({ url: servers[1].url, token: servers[1].accessToken })
      expect(res2.body.total).to.equal(1)
      expect(res2.body.data.length).to.equal(1)

      abuseServer2 = res2.body.data[0]
      expect(abuseServer2.reason).to.equal('my super bad reason 2')
      expect(abuseServer2.reporterAccount.name).to.equal('root')
      expect(abuseServer2.reporterAccount.host).to.equal(servers[0].host)

      expect(abuse2.flaggedAccount.name).to.equal('root')
      expect(abuse2.flaggedAccount.host).to.equal(servers[1].host)

      expect(abuseServer2.state.id).to.equal(AbuseState.PENDING)
      expect(abuseServer2.state.label).to.equal('Pending')
      expect(abuseServer2.moderationComment).to.be.null
    })

    it('Should hide video abuses from blocked accounts', async function () {
      this.timeout(10000)

      {
        const videoId = await getVideoIdFromUUID(servers[1].url, servers[0].video.uuid)
        await reportAbuse({ url: servers[1].url, token: servers[1].accessToken, videoId, reason: 'will mute this' })
        await waitJobs(servers)

        const res = await getAdminAbusesList({ url: servers[0].url, token: servers[0].accessToken })
        expect(res.body.total).to.equal(3)
      }

      const accountToBlock = 'root@' + servers[1].host

      {
        await addAccountToServerBlocklist(servers[0].url, servers[0].accessToken, accountToBlock)

        const res = await getAdminAbusesList({ url: servers[0].url, token: servers[0].accessToken })
        expect(res.body.total).to.equal(2)

        const abuse = res.body.data.find(a => a.reason === 'will mute this')
        expect(abuse).to.be.undefined
      }

      {
        await removeAccountFromServerBlocklist(servers[0].url, servers[0].accessToken, accountToBlock)

        const res = await getAdminAbusesList({ url: servers[0].url, token: servers[0].accessToken })
        expect(res.body.total).to.equal(3)
      }
    })

    it('Should hide video abuses from blocked servers', async function () {
      const serverToBlock = servers[1].host

      {
        await addServerToServerBlocklist(servers[0].url, servers[0].accessToken, servers[1].host)

        const res = await getAdminAbusesList({ url: servers[0].url, token: servers[0].accessToken })
        expect(res.body.total).to.equal(2)

        const abuse = res.body.data.find(a => a.reason === 'will mute this')
        expect(abuse).to.be.undefined
      }

      {
        await removeServerFromServerBlocklist(servers[0].url, servers[0].accessToken, serverToBlock)

        const res = await getAdminAbusesList({ url: servers[0].url, token: servers[0].accessToken })
        expect(res.body.total).to.equal(3)
      }
    })

    it('Should keep the video abuse when deleting the video', async function () {
      this.timeout(10000)

      await removeVideo(servers[1].url, servers[1].accessToken, abuseServer2.video.uuid)

      await waitJobs(servers)

      const res = await getAdminAbusesList({ url: servers[1].url, token: servers[1].accessToken })
      expect(res.body.total).to.equal(2, "wrong number of videos returned")
      expect(res.body.data).to.have.lengthOf(2, "wrong number of videos returned")

      const abuse: AdminAbuse = res.body.data[0]
      expect(abuse.id).to.equal(abuseServer2.id, "wrong origin server id for first video")
      expect(abuse.video.id).to.equal(abuseServer2.video.id, "wrong video id")
      expect(abuse.video.channel).to.exist
      expect(abuse.video.deleted).to.be.true
    })

    it('Should include counts of reports from reporter and reportee', async function () {
      this.timeout(10000)

      // register a second user to have two reporters/reportees
      const user = { username: 'user2', password: 'password' }
      await createUser({ url: servers[0].url, accessToken: servers[0].accessToken, ...user })
      const userAccessToken = await userLogin(servers[0], user)

      // upload a third video via this user
      const video3Attributes = {
        name: 'my second super name for server 1',
        description: 'my second super description for server 1'
      }
      await uploadVideo(servers[0].url, userAccessToken, video3Attributes)

      const res1 = await getVideosList(servers[0].url)
      const videos = res1.body.data
      const video3 = videos.find(video => video.name === 'my second super name for server 1')

      // resume with the test
      const reason3 = 'my super bad reason 3'
      await reportAbuse({ url: servers[0].url, token: servers[0].accessToken, videoId: video3.id, reason: reason3 })

      const reason4 = 'my super bad reason 4'
      await reportAbuse({ url: servers[0].url, token: userAccessToken, videoId: servers[0].video.id, reason: reason4 })

      {
        const res2 = await getAdminAbusesList({ url: servers[0].url, token: servers[0].accessToken })
        const abuses = res2.body.data as AdminAbuse[]

        const abuseVideo3 = res2.body.data.find(a => a.video.id === video3.id)
        expect(abuseVideo3).to.not.be.undefined
        expect(abuseVideo3.video.countReports).to.equal(1, "wrong reports count for video 3")
        expect(abuseVideo3.video.nthReport).to.equal(1, "wrong report position in report list for video 3")
        expect(abuseVideo3.countReportsForReportee).to.equal(1, "wrong reports count for reporter on video 3 abuse")
        expect(abuseVideo3.countReportsForReporter).to.equal(3, "wrong reports count for reportee on video 3 abuse")

        const abuseServer1 = abuses.find(a => a.video.id === servers[0].video.id)
        expect(abuseServer1.countReportsForReportee).to.equal(3, "wrong reports count for reporter on video 1 abuse")
      }
    })

    it('Should list predefined reasons as well as timestamps for the reported video', async function () {
      this.timeout(10000)

      const reason5 = 'my super bad reason 5'
      const predefinedReasons5: AbusePredefinedReasonsString[] = [ 'violentOrRepulsive', 'captions' ]
      const createdAbuse = (await reportAbuse({
        url: servers[0].url,
        token: servers[0].accessToken,
        videoId: servers[0].video.id,
        reason: reason5,
        predefinedReasons: predefinedReasons5,
        startAt: 1,
        endAt: 5
      })).body.abuse

      const res = await getAdminAbusesList({ url: servers[0].url, token: servers[0].accessToken })

      {
        const abuse = (res.body.data as AdminAbuse[]).find(a => a.id === createdAbuse.id)
        expect(abuse.reason).to.equals(reason5)
        expect(abuse.predefinedReasons).to.deep.equals(predefinedReasons5, "predefined reasons do not match the one reported")
        expect(abuse.video.startAt).to.equal(1, "starting timestamp doesn't match the one reported")
        expect(abuse.video.endAt).to.equal(5, "ending timestamp doesn't match the one reported")
      }
    })

    it('Should delete the video abuse', async function () {
      this.timeout(10000)

      await deleteAbuse(servers[1].url, servers[1].accessToken, abuseServer2.id)

      await waitJobs(servers)

      {
        const res = await getAdminAbusesList({ url: servers[1].url, token: servers[1].accessToken })
        expect(res.body.total).to.equal(1)
        expect(res.body.data.length).to.equal(1)
        expect(res.body.data[0].id).to.not.equal(abuseServer2.id)
      }

      {
        const res = await getAdminAbusesList({ url: servers[0].url, token: servers[0].accessToken })
        expect(res.body.total).to.equal(6)
      }
    })

    it('Should list and filter video abuses', async function () {
      this.timeout(10000)

      async function list (query: Omit<Parameters<typeof getAdminAbusesList>[0], 'url' | 'token'>) {
        const options = {
          url: servers[0].url,
          token: servers[0].accessToken
        }

        Object.assign(options, query)

        const res = await getAdminAbusesList(options)

        return res.body.data as AdminAbuse[]
      }

      expect(await list({ id: 56 })).to.have.lengthOf(0)
      expect(await list({ id: 1 })).to.have.lengthOf(1)

      expect(await list({ search: 'my super name for server 1' })).to.have.lengthOf(4)
      expect(await list({ search: 'aaaaaaaaaaaaaaaaaaaaaaaaaa' })).to.have.lengthOf(0)

      expect(await list({ searchVideo: 'my second super name for server 1' })).to.have.lengthOf(1)

      expect(await list({ searchVideoChannel: 'root' })).to.have.lengthOf(4)
      expect(await list({ searchVideoChannel: 'aaaa' })).to.have.lengthOf(0)

      expect(await list({ searchReporter: 'user2' })).to.have.lengthOf(1)
      expect(await list({ searchReporter: 'root' })).to.have.lengthOf(5)

      expect(await list({ searchReportee: 'root' })).to.have.lengthOf(5)
      expect(await list({ searchReportee: 'aaaa' })).to.have.lengthOf(0)

      expect(await list({ videoIs: 'deleted' })).to.have.lengthOf(1)
      expect(await list({ videoIs: 'blacklisted' })).to.have.lengthOf(0)

      expect(await list({ state: AbuseState.ACCEPTED })).to.have.lengthOf(0)
      expect(await list({ state: AbuseState.PENDING })).to.have.lengthOf(6)

      expect(await list({ predefinedReason: 'violentOrRepulsive' })).to.have.lengthOf(1)
      expect(await list({ predefinedReason: 'serverRules' })).to.have.lengthOf(0)
    })
  })

  describe('Comment abuses', function () {

    async function getComment (url: string, videoIdArg: number | string) {
      const videoId = typeof videoIdArg === 'string'
        ? await getVideoIdFromUUID(url, videoIdArg)
        : videoIdArg

      const res = await getVideoCommentThreads(url, videoId, 0, 5)

      return res.body.data[0] as VideoComment
    }

    before(async function () {
      this.timeout(50000)

      servers[0].video = await uploadVideoAndGetId({ server: servers[0], videoName: 'server 1' })
      servers[1].video = await uploadVideoAndGetId({ server: servers[1], videoName: 'server 2' })

      await addVideoCommentThread(servers[0].url, servers[0].accessToken, servers[0].video.id, 'comment server 1')
      await addVideoCommentThread(servers[1].url, servers[1].accessToken, servers[1].video.id, 'comment server 2')

      await waitJobs(servers)
    })

    it('Should report abuse on a comment', async function () {
      this.timeout(15000)

      const comment = await getComment(servers[0].url, servers[0].video.id)

      const reason = 'it is a bad comment'
      await reportAbuse({ url: servers[0].url, token: servers[0].accessToken, commentId: comment.id, reason })

      await waitJobs(servers)
    })

    it('Should have 1 comment abuse on server 1 and 0 on server 2', async function () {
      {
        const comment = await getComment(servers[0].url, servers[0].video.id)
        const res = await getAdminAbusesList({ url: servers[0].url, token: servers[0].accessToken, filter: 'comment' })

        expect(res.body.total).to.equal(1)
        expect(res.body.data).to.have.lengthOf(1)

        const abuse: AdminAbuse = res.body.data[0]
        expect(abuse.reason).to.equal('it is a bad comment')

        expect(abuse.reporterAccount.name).to.equal('root')
        expect(abuse.reporterAccount.host).to.equal(servers[0].host)

        expect(abuse.video).to.be.null

        expect(abuse.comment.deleted).to.be.false
        expect(abuse.comment.id).to.equal(comment.id)
        expect(abuse.comment.text).to.equal(comment.text)
        expect(abuse.comment.video.name).to.equal('server 1')
        expect(abuse.comment.video.id).to.equal(servers[0].video.id)
        expect(abuse.comment.video.uuid).to.equal(servers[0].video.uuid)

        expect(abuse.countReportsForReporter).to.equal(5)
        expect(abuse.countReportsForReportee).to.equal(5)
      }

      {
        const res = await getAdminAbusesList({ url: servers[1].url, token: servers[1].accessToken, filter: 'comment' })
        expect(res.body.total).to.equal(0)
        expect(res.body.data.length).to.equal(0)
      }
    })

    it('Should report abuse on a remote comment', async function () {
      this.timeout(10000)

      const comment = await getComment(servers[0].url, servers[1].video.uuid)

      const reason = 'it is a really bad comment'
      await reportAbuse({ url: servers[0].url, token: servers[0].accessToken, commentId: comment.id, reason })

      await waitJobs(servers)
    })

    it('Should have 2 comment abuses on server 1 and 1 on server 2', async function () {
      const commentServer2 = await getComment(servers[0].url, servers[1].video.id)

      const res1 = await getAdminAbusesList({ url: servers[0].url, token: servers[0].accessToken, filter: 'comment' })
      expect(res1.body.total).to.equal(2)
      expect(res1.body.data.length).to.equal(2)

      const abuse: AdminAbuse = res1.body.data[0]
      expect(abuse.reason).to.equal('it is a bad comment')
      expect(abuse.countReportsForReporter).to.equal(6)
      expect(abuse.countReportsForReportee).to.equal(5)

      const abuse2: AdminAbuse = res1.body.data[1]

      expect(abuse2.reason).to.equal('it is a really bad comment')

      expect(abuse2.reporterAccount.name).to.equal('root')
      expect(abuse2.reporterAccount.host).to.equal(servers[0].host)

      expect(abuse2.video).to.be.null

      expect(abuse2.comment.deleted).to.be.false
      expect(abuse2.comment.id).to.equal(commentServer2.id)
      expect(abuse2.comment.text).to.equal(commentServer2.text)
      expect(abuse2.comment.video.name).to.equal('server 2')
      expect(abuse2.comment.video.uuid).to.equal(servers[1].video.uuid)

      expect(abuse2.state.id).to.equal(AbuseState.PENDING)
      expect(abuse2.state.label).to.equal('Pending')

      expect(abuse2.moderationComment).to.be.null

      expect(abuse2.countReportsForReporter).to.equal(6)
      expect(abuse2.countReportsForReportee).to.equal(2)

      const res2 = await getAdminAbusesList({ url: servers[1].url, token: servers[1].accessToken, filter: 'comment' })
      expect(res2.body.total).to.equal(1)
      expect(res2.body.data.length).to.equal(1)

      abuseServer2 = res2.body.data[0]
      expect(abuseServer2.reason).to.equal('it is a really bad comment')
      expect(abuseServer2.reporterAccount.name).to.equal('root')
      expect(abuseServer2.reporterAccount.host).to.equal(servers[0].host)

      expect(abuseServer2.state.id).to.equal(AbuseState.PENDING)
      expect(abuseServer2.state.label).to.equal('Pending')

      expect(abuseServer2.moderationComment).to.be.null

      expect(abuseServer2.countReportsForReporter).to.equal(1)
      expect(abuseServer2.countReportsForReportee).to.equal(1)
    })

    it('Should keep the comment abuse when deleting the comment', async function () {
      this.timeout(10000)

      const commentServer2 = await getComment(servers[0].url, servers[1].video.id)

      await deleteVideoComment(servers[0].url, servers[0].accessToken, servers[1].video.uuid, commentServer2.id)

      await waitJobs(servers)

      const res = await getAdminAbusesList({ url: servers[0].url, token: servers[0].accessToken, filter: 'comment' })
      expect(res.body.total).to.equal(2)
      expect(res.body.data).to.have.lengthOf(2)

      const abuse = (res.body.data as AdminAbuse[]).find(a => a.comment?.id === commentServer2.id)
      expect(abuse).to.not.be.undefined

      expect(abuse.comment.text).to.be.empty
      expect(abuse.comment.video.name).to.equal('server 2')
      expect(abuse.comment.deleted).to.be.true
    })

    it('Should delete the comment abuse', async function () {
      this.timeout(10000)

      await deleteAbuse(servers[1].url, servers[1].accessToken, abuseServer2.id)

      await waitJobs(servers)

      {
        const res = await getAdminAbusesList({ url: servers[1].url, token: servers[1].accessToken, filter: 'comment' })
        expect(res.body.total).to.equal(0)
        expect(res.body.data.length).to.equal(0)
      }

      {
        const res = await getAdminAbusesList({ url: servers[0].url, token: servers[0].accessToken, filter: 'comment' })
        expect(res.body.total).to.equal(2)
      }
    })

    it('Should list and filter video abuses', async function () {
      {
        const res = await getAdminAbusesList({
          url: servers[0].url,
          token: servers[0].accessToken,
          filter: 'comment',
          searchReportee: 'foo'
        })
        expect(res.body.total).to.equal(0)
      }

      {
        const res = await getAdminAbusesList({
          url: servers[0].url,
          token: servers[0].accessToken,
          filter: 'comment',
          searchReportee: 'ot'
        })
        expect(res.body.total).to.equal(2)
      }

      {
        const baseParams = { url: servers[0].url, token: servers[0].accessToken, filter: 'comment' as AbuseFilter, start: 1, count: 1 }

        const res1 = await getAdminAbusesList(immutableAssign(baseParams, { sort: 'createdAt' }))
        expect(res1.body.data).to.have.lengthOf(1)
        expect(res1.body.data[0].comment.text).to.be.empty

        const res2 = await getAdminAbusesList(immutableAssign(baseParams, { sort: '-createdAt' }))
        expect(res2.body.data).to.have.lengthOf(1)
        expect(res2.body.data[0].comment.text).to.equal('comment server 1')
      }
    })
  })

  describe('Account abuses', function () {

    async function getAccountFromServer (url: string, name: string, server: ServerInfo) {
      const res = await getAccount(url, name + '@' + server.host)

      return res.body as Account
    }

    before(async function () {
      this.timeout(50000)

      await createUser({ url: servers[0].url, accessToken: servers[0].accessToken, username: 'user_1', password: 'donald' })

      const token = await generateUserAccessToken(servers[1], 'user_2')
      await uploadVideo(servers[1].url, token, { name: 'super video' })

      await waitJobs(servers)
    })

    it('Should report abuse on an account', async function () {
      this.timeout(15000)

      const account = await getAccountFromServer(servers[0].url, 'user_1', servers[0])

      const reason = 'it is a bad account'
      await reportAbuse({ url: servers[0].url, token: servers[0].accessToken, accountId: account.id, reason })

      await waitJobs(servers)
    })

    it('Should have 1 account abuse on server 1 and 0 on server 2', async function () {
      {
        const res = await getAdminAbusesList({ url: servers[0].url, token: servers[0].accessToken, filter: 'account' })

        expect(res.body.total).to.equal(1)
        expect(res.body.data).to.have.lengthOf(1)

        const abuse: AdminAbuse = res.body.data[0]
        expect(abuse.reason).to.equal('it is a bad account')

        expect(abuse.reporterAccount.name).to.equal('root')
        expect(abuse.reporterAccount.host).to.equal(servers[0].host)

        expect(abuse.video).to.be.null
        expect(abuse.comment).to.be.null

        expect(abuse.flaggedAccount.name).to.equal('user_1')
        expect(abuse.flaggedAccount.host).to.equal(servers[0].host)
      }

      {
        const res = await getAdminAbusesList({ url: servers[1].url, token: servers[1].accessToken, filter: 'comment' })
        expect(res.body.total).to.equal(0)
        expect(res.body.data.length).to.equal(0)
      }
    })

    it('Should report abuse on a remote account', async function () {
      this.timeout(10000)

      const account = await getAccountFromServer(servers[0].url, 'user_2', servers[1])

      const reason = 'it is a really bad account'
      await reportAbuse({ url: servers[0].url, token: servers[0].accessToken, accountId: account.id, reason })

      await waitJobs(servers)
    })

    it('Should have 2 comment abuses on server 1 and 1 on server 2', async function () {
      const res1 = await getAdminAbusesList({ url: servers[0].url, token: servers[0].accessToken, filter: 'account' })
      expect(res1.body.total).to.equal(2)
      expect(res1.body.data.length).to.equal(2)

      const abuse: AdminAbuse = res1.body.data[0]
      expect(abuse.reason).to.equal('it is a bad account')

      const abuse2: AdminAbuse = res1.body.data[1]
      expect(abuse2.reason).to.equal('it is a really bad account')

      expect(abuse2.reporterAccount.name).to.equal('root')
      expect(abuse2.reporterAccount.host).to.equal(servers[0].host)

      expect(abuse2.video).to.be.null
      expect(abuse2.comment).to.be.null

      expect(abuse2.state.id).to.equal(AbuseState.PENDING)
      expect(abuse2.state.label).to.equal('Pending')

      expect(abuse2.moderationComment).to.be.null

      const res2 = await getAdminAbusesList({ url: servers[1].url, token: servers[1].accessToken, filter: 'account' })
      expect(res2.body.total).to.equal(1)
      expect(res2.body.data.length).to.equal(1)

      abuseServer2 = res2.body.data[0]

      expect(abuseServer2.reason).to.equal('it is a really bad account')

      expect(abuseServer2.reporterAccount.name).to.equal('root')
      expect(abuseServer2.reporterAccount.host).to.equal(servers[0].host)

      expect(abuseServer2.state.id).to.equal(AbuseState.PENDING)
      expect(abuseServer2.state.label).to.equal('Pending')

      expect(abuseServer2.moderationComment).to.be.null
    })

    it('Should keep the account abuse when deleting the account', async function () {
      this.timeout(10000)

      const account = await getAccountFromServer(servers[1].url, 'user_2', servers[1])
      await removeUser(servers[1].url, account.userId, servers[1].accessToken)

      await waitJobs(servers)

      const res = await getAdminAbusesList({ url: servers[0].url, token: servers[0].accessToken, filter: 'account' })
      expect(res.body.total).to.equal(2)
      expect(res.body.data).to.have.lengthOf(2)

      const abuse = (res.body.data as AdminAbuse[]).find(a => a.reason === 'it is a really bad account')
      expect(abuse).to.not.be.undefined
    })

    it('Should delete the account abuse', async function () {
      this.timeout(10000)

      await deleteAbuse(servers[1].url, servers[1].accessToken, abuseServer2.id)

      await waitJobs(servers)

      {
        const res = await getAdminAbusesList({ url: servers[1].url, token: servers[1].accessToken, filter: 'account' })
        expect(res.body.total).to.equal(0)
        expect(res.body.data.length).to.equal(0)
      }

      {
        const res = await getAdminAbusesList({ url: servers[0].url, token: servers[0].accessToken, filter: 'account' })
        expect(res.body.total).to.equal(2)

        abuseServer1 = res.body.data[0]
      }
    })
  })

  describe('Common actions on abuses', function () {

    it('Should update the state of an abuse', async function () {
      const body = { state: AbuseState.REJECTED }
      await updateAbuse(servers[0].url, servers[0].accessToken, abuseServer1.id, body)

      const res = await getAdminAbusesList({ url: servers[0].url, token: servers[0].accessToken, id: abuseServer1.id })
      expect(res.body.data[0].state.id).to.equal(AbuseState.REJECTED)
    })

    it('Should add a moderation comment', async function () {
      const body = { state: AbuseState.ACCEPTED, moderationComment: 'It is valid' }
      await updateAbuse(servers[0].url, servers[0].accessToken, abuseServer1.id, body)

      const res = await getAdminAbusesList({ url: servers[0].url, token: servers[0].accessToken, id: abuseServer1.id })
      expect(res.body.data[0].state.id).to.equal(AbuseState.ACCEPTED)
      expect(res.body.data[0].moderationComment).to.equal('It is valid')
    })
  })

  describe('My abuses', async function () {
    let abuseId1: number
    let userAccessToken: string

    before(async function () {
      userAccessToken = await generateUserAccessToken(servers[0], 'user_42')

      await reportAbuse({ url: servers[0].url, token: userAccessToken, videoId: servers[0].video.id, reason: 'user reason 1' })

      const videoId = await getVideoIdFromUUID(servers[0].url, servers[1].video.uuid)
      await reportAbuse({ url: servers[0].url, token: userAccessToken, videoId, reason: 'user reason 2' })
    })

    it('Should correctly list my abuses', async function () {
      {
        const res = await getUserAbusesList({ url: servers[0].url, token: userAccessToken, start: 0, count: 5, sort: 'createdAt' })
        expect(res.body.total).to.equal(2)

        const abuses: UserAbuse[] = res.body.data
        expect(abuses[0].reason).to.equal('user reason 1')
        expect(abuses[1].reason).to.equal('user reason 2')

        abuseId1 = abuses[0].id
      }

      {
        const res = await getUserAbusesList({ url: servers[0].url, token: userAccessToken, start: 1, count: 1, sort: 'createdAt' })
        expect(res.body.total).to.equal(2)

        const abuses: UserAbuse[] = res.body.data
        expect(abuses[0].reason).to.equal('user reason 2')
      }

      {
        const res = await getUserAbusesList({ url: servers[0].url, token: userAccessToken, start: 1, count: 1, sort: '-createdAt' })
        expect(res.body.total).to.equal(2)

        const abuses: UserAbuse[] = res.body.data
        expect(abuses[0].reason).to.equal('user reason 1')
      }
    })

    it('Should correctly filter my abuses by id', async function () {
      const res = await getUserAbusesList({ url: servers[0].url, token: userAccessToken, id: abuseId1 })

      expect(res.body.total).to.equal(1)

      const abuses: UserAbuse[] = res.body.data
      expect(abuses[0].reason).to.equal('user reason 1')
    })

    it('Should correctly filter my abuses by search', async function () {
      const res = await getUserAbusesList({
        url: servers[0].url,
        token: userAccessToken,
        search: 'server 2'
      })

      expect(res.body.total).to.equal(1)

      const abuses: UserAbuse[] = res.body.data
      expect(abuses[0].reason).to.equal('user reason 2')
    })

    it('Should correctly filter my abuses by state', async function () {
      const body = { state: AbuseState.REJECTED }
      await updateAbuse(servers[0].url, servers[0].accessToken, abuseId1, body)

      const res = await getUserAbusesList({
        url: servers[0].url,
        token: userAccessToken,
        state: AbuseState.REJECTED
      })

      expect(res.body.total).to.equal(1)

      const abuses: UserAbuse[] = res.body.data
      expect(abuses[0].reason).to.equal('user reason 1')
    })
  })

  describe('Abuse messages', async function () {
    let abuseId: number
    let userAccessToken: string
    let abuseMessageUserId: number
    let abuseMessageModerationId: number

    before(async function () {
      userAccessToken = await generateUserAccessToken(servers[0], 'user_43')

      const res = await reportAbuse({
        url: servers[0].url,
        token: userAccessToken,
        videoId: servers[0].video.id,
        reason: 'user 43 reason 1'
      })

      abuseId = res.body.abuse.id
    })

    it('Should create some messages on the abuse', async function () {
      await addAbuseMessage(servers[0].url, userAccessToken, abuseId, 'message 1')
      await addAbuseMessage(servers[0].url, servers[0].accessToken, abuseId, 'message 2')
      await addAbuseMessage(servers[0].url, servers[0].accessToken, abuseId, 'message 3')
      await addAbuseMessage(servers[0].url, userAccessToken, abuseId, 'message 4')
    })

    it('Should have the correct messages count when listing abuses', async function () {
      const results = await Promise.all([
        getAdminAbusesList({ url: servers[0].url, token: servers[0].accessToken, start: 0, count: 50 }),
        getUserAbusesList({ url: servers[0].url, token: userAccessToken, start: 0, count: 50 })
      ])

      for (const res of results) {
        const abuses: AdminAbuse[] = res.body.data
        const abuse = abuses.find(a => a.id === abuseId)
        expect(abuse.countMessages).to.equal(4)
      }
    })

    it('Should correctly list messages of this abuse', async function () {
      const results = await Promise.all([
        listAbuseMessages(servers[0].url, servers[0].accessToken, abuseId),
        listAbuseMessages(servers[0].url, userAccessToken, abuseId)
      ])

      for (const res of results) {
        expect(res.body.total).to.equal(4)

        const abuseMessages: AbuseMessage[] = res.body.data

        expect(abuseMessages[0].message).to.equal('message 1')
        expect(abuseMessages[0].byModerator).to.be.false
        expect(abuseMessages[0].account.name).to.equal('user_43')

        abuseMessageUserId = abuseMessages[0].id

        expect(abuseMessages[1].message).to.equal('message 2')
        expect(abuseMessages[1].byModerator).to.be.true
        expect(abuseMessages[1].account.name).to.equal('root')

        expect(abuseMessages[2].message).to.equal('message 3')
        expect(abuseMessages[2].byModerator).to.be.true
        expect(abuseMessages[2].account.name).to.equal('root')
        abuseMessageModerationId = abuseMessages[2].id

        expect(abuseMessages[3].message).to.equal('message 4')
        expect(abuseMessages[3].byModerator).to.be.false
        expect(abuseMessages[3].account.name).to.equal('user_43')
      }
    })

    it('Should delete messages', async function () {
      await deleteAbuseMessage(servers[0].url, servers[0].accessToken, abuseId, abuseMessageModerationId)
      await deleteAbuseMessage(servers[0].url, userAccessToken, abuseId, abuseMessageUserId)

      const results = await Promise.all([
        listAbuseMessages(servers[0].url, servers[0].accessToken, abuseId),
        listAbuseMessages(servers[0].url, userAccessToken, abuseId)
      ])

      for (const res of results) {
        expect(res.body.total).to.equal(2)

        const abuseMessages: AbuseMessage[] = res.body.data

        expect(abuseMessages[0].message).to.equal('message 2')
        expect(abuseMessages[1].message).to.equal('message 4')
      }
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
