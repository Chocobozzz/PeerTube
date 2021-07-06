/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import {
  AbusesCommand,
  addAccountToServerBlocklist,
  addServerToServerBlocklist,
  addVideoCommentThread,
  cleanupTests,
  createUser,
  deleteVideoComment,
  doubleFollow,
  flushAndRunMultipleServers,
  generateUserAccessToken,
  getAccount,
  getVideoCommentThreads,
  getVideoIdFromUUID,
  getVideosList,
  removeAccountFromServerBlocklist,
  removeServerFromServerBlocklist,
  removeUser,
  removeVideo,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideo,
  uploadVideoAndGetId,
  userLogin,
  waitJobs
} from '@shared/extra-utils'
import { AbuseMessage, AbusePredefinedReasonsString, AbuseState, Account, AdminAbuse, UserAbuse, VideoComment } from '@shared/models'

const expect = chai.expect

describe('Test abuses', function () {
  let servers: ServerInfo[] = []
  let abuseServer1: AdminAbuse
  let abuseServer2: AdminAbuse
  let commands: AbusesCommand[]

  before(async function () {
    this.timeout(50000)

    // Run servers
    servers = await flushAndRunMultipleServers(2)

    // Get the access tokens
    await setAccessTokensToServers(servers)

    // Server 1 and server 2 follow each other
    await doubleFollow(servers[0], servers[1])

    commands = servers.map(s => s.abusesCommand)
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
      const body = await commands[0].getAdminList()

      expect(body.total).to.equal(0)
      expect(body.data).to.be.an('array')
      expect(body.data.length).to.equal(0)
    })

    it('Should report abuse on a local video', async function () {
      this.timeout(15000)

      const reason = 'my super bad reason'
      await commands[0].report({ videoId: servers[0].video.id, reason })

      // We wait requests propagation, even if the server 1 is not supposed to make a request to server 2
      await waitJobs(servers)
    })

    it('Should have 1 video abuses on server 1 and 0 on server 2', async function () {
      {
        const body = await commands[0].getAdminList()

        expect(body.total).to.equal(1)
        expect(body.data).to.be.an('array')
        expect(body.data.length).to.equal(1)

        const abuse = body.data[0]
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
      }

      {
        const body = await commands[1].getAdminList()
        expect(body.total).to.equal(0)
        expect(body.data).to.be.an('array')
        expect(body.data.length).to.equal(0)
      }
    })

    it('Should report abuse on a remote video', async function () {
      this.timeout(10000)

      const reason = 'my super bad reason 2'
      const videoId = await getVideoIdFromUUID(servers[0].url, servers[1].video.uuid)
      await commands[0].report({ videoId, reason })

      // We wait requests propagation
      await waitJobs(servers)
    })

    it('Should have 2 video abuses on server 1 and 1 on server 2', async function () {
      {
        const body = await commands[0].getAdminList()

        expect(body.total).to.equal(2)
        expect(body.data.length).to.equal(2)

        const abuse1 = body.data[0]
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

        const abuse2 = body.data[1]
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
      }

      {
        const body = await commands[1].getAdminList()
        expect(body.total).to.equal(1)
        expect(body.data.length).to.equal(1)

        abuseServer2 = body.data[0]
        expect(abuseServer2.reason).to.equal('my super bad reason 2')
        expect(abuseServer2.reporterAccount.name).to.equal('root')
        expect(abuseServer2.reporterAccount.host).to.equal(servers[0].host)

        expect(abuseServer2.flaggedAccount.name).to.equal('root')
        expect(abuseServer2.flaggedAccount.host).to.equal(servers[1].host)

        expect(abuseServer2.state.id).to.equal(AbuseState.PENDING)
        expect(abuseServer2.state.label).to.equal('Pending')
        expect(abuseServer2.moderationComment).to.be.null
      }
    })

    it('Should hide video abuses from blocked accounts', async function () {
      this.timeout(10000)

      {
        const videoId = await getVideoIdFromUUID(servers[1].url, servers[0].video.uuid)
        await commands[1].report({ videoId, reason: 'will mute this' })
        await waitJobs(servers)

        const body = await commands[0].getAdminList()
        expect(body.total).to.equal(3)
      }

      const accountToBlock = 'root@' + servers[1].host

      {
        await addAccountToServerBlocklist(servers[0].url, servers[0].accessToken, accountToBlock)

        const body = await commands[0].getAdminList()
        expect(body.total).to.equal(2)

        const abuse = body.data.find(a => a.reason === 'will mute this')
        expect(abuse).to.be.undefined
      }

      {
        await removeAccountFromServerBlocklist(servers[0].url, servers[0].accessToken, accountToBlock)

        const body = await commands[0].getAdminList()
        expect(body.total).to.equal(3)
      }
    })

    it('Should hide video abuses from blocked servers', async function () {
      const serverToBlock = servers[1].host

      {
        await addServerToServerBlocklist(servers[0].url, servers[0].accessToken, servers[1].host)

        const body = await commands[0].getAdminList()
        expect(body.total).to.equal(2)

        const abuse = body.data.find(a => a.reason === 'will mute this')
        expect(abuse).to.be.undefined
      }

      {
        await removeServerFromServerBlocklist(servers[0].url, servers[0].accessToken, serverToBlock)

        const body = await commands[0].getAdminList()
        expect(body.total).to.equal(3)
      }
    })

    it('Should keep the video abuse when deleting the video', async function () {
      this.timeout(10000)

      await removeVideo(servers[1].url, servers[1].accessToken, abuseServer2.video.uuid)

      await waitJobs(servers)

      const body = await commands[1].getAdminList()
      expect(body.total).to.equal(2, "wrong number of videos returned")
      expect(body.data).to.have.lengthOf(2, "wrong number of videos returned")

      const abuse = body.data[0]
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
      const resUpload = await uploadVideo(servers[0].url, userAccessToken, video3Attributes)
      const video3Id = resUpload.body.video.id

      // resume with the test
      const reason3 = 'my super bad reason 3'
      await commands[0].report({ videoId: video3Id, reason: reason3 })

      const reason4 = 'my super bad reason 4'
      await commands[0].report({ token: userAccessToken, videoId: servers[0].video.id, reason: reason4 })

      {
        const body = await commands[0].getAdminList()
        const abuses = body.data

        const abuseVideo3 = body.data.find(a => a.video.id === video3Id)
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
      const createRes = await commands[0].report({
        videoId: servers[0].video.id,
        reason: reason5,
        predefinedReasons: predefinedReasons5,
        startAt: 1,
        endAt: 5
      })

      const body = await commands[0].getAdminList()

      {
        const abuse = body.data.find(a => a.id === createRes.abuse.id)
        expect(abuse.reason).to.equals(reason5)
        expect(abuse.predefinedReasons).to.deep.equals(predefinedReasons5, "predefined reasons do not match the one reported")
        expect(abuse.video.startAt).to.equal(1, "starting timestamp doesn't match the one reported")
        expect(abuse.video.endAt).to.equal(5, "ending timestamp doesn't match the one reported")
      }
    })

    it('Should delete the video abuse', async function () {
      this.timeout(10000)

      await commands[1].delete({ abuseId: abuseServer2.id })

      await waitJobs(servers)

      {
        const body = await commands[1].getAdminList()
        expect(body.total).to.equal(1)
        expect(body.data.length).to.equal(1)
        expect(body.data[0].id).to.not.equal(abuseServer2.id)
      }

      {
        const body = await commands[0].getAdminList()
        expect(body.total).to.equal(6)
      }
    })

    it('Should list and filter video abuses', async function () {
      this.timeout(10000)

      async function list (query: Parameters<AbusesCommand['getAdminList']>[0]) {
        const body = await commands[0].getAdminList(query)

        return body.data
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
      await commands[0].report({ commentId: comment.id, reason })

      await waitJobs(servers)
    })

    it('Should have 1 comment abuse on server 1 and 0 on server 2', async function () {
      {
        const comment = await getComment(servers[0].url, servers[0].video.id)
        const body = await commands[0].getAdminList({ filter: 'comment' })

        expect(body.total).to.equal(1)
        expect(body.data).to.have.lengthOf(1)

        const abuse = body.data[0]
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
        const body = await commands[1].getAdminList({ filter: 'comment' })
        expect(body.total).to.equal(0)
        expect(body.data.length).to.equal(0)
      }
    })

    it('Should report abuse on a remote comment', async function () {
      this.timeout(10000)

      const comment = await getComment(servers[0].url, servers[1].video.uuid)

      const reason = 'it is a really bad comment'
      await commands[0].report({ commentId: comment.id, reason })

      await waitJobs(servers)
    })

    it('Should have 2 comment abuses on server 1 and 1 on server 2', async function () {
      const commentServer2 = await getComment(servers[0].url, servers[1].video.id)

      {
        const body = await commands[0].getAdminList({ filter: 'comment' })
        expect(body.total).to.equal(2)
        expect(body.data.length).to.equal(2)

        const abuse = body.data[0]
        expect(abuse.reason).to.equal('it is a bad comment')
        expect(abuse.countReportsForReporter).to.equal(6)
        expect(abuse.countReportsForReportee).to.equal(5)

        const abuse2 = body.data[1]

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
      }

      {
        const body = await commands[1].getAdminList({ filter: 'comment' })
        expect(body.total).to.equal(1)
        expect(body.data.length).to.equal(1)

        abuseServer2 = body.data[0]
        expect(abuseServer2.reason).to.equal('it is a really bad comment')
        expect(abuseServer2.reporterAccount.name).to.equal('root')
        expect(abuseServer2.reporterAccount.host).to.equal(servers[0].host)

        expect(abuseServer2.state.id).to.equal(AbuseState.PENDING)
        expect(abuseServer2.state.label).to.equal('Pending')

        expect(abuseServer2.moderationComment).to.be.null

        expect(abuseServer2.countReportsForReporter).to.equal(1)
        expect(abuseServer2.countReportsForReportee).to.equal(1)
      }
    })

    it('Should keep the comment abuse when deleting the comment', async function () {
      this.timeout(10000)

      const commentServer2 = await getComment(servers[0].url, servers[1].video.id)

      await deleteVideoComment(servers[0].url, servers[0].accessToken, servers[1].video.uuid, commentServer2.id)

      await waitJobs(servers)

      const body = await commands[0].getAdminList({ filter: 'comment' })
      expect(body.total).to.equal(2)
      expect(body.data).to.have.lengthOf(2)

      const abuse = body.data.find(a => a.comment?.id === commentServer2.id)
      expect(abuse).to.not.be.undefined

      expect(abuse.comment.text).to.be.empty
      expect(abuse.comment.video.name).to.equal('server 2')
      expect(abuse.comment.deleted).to.be.true
    })

    it('Should delete the comment abuse', async function () {
      this.timeout(10000)

      await commands[1].delete({ abuseId: abuseServer2.id })

      await waitJobs(servers)

      {
        const body = await commands[1].getAdminList({ filter: 'comment' })
        expect(body.total).to.equal(0)
        expect(body.data.length).to.equal(0)
      }

      {
        const body = await commands[0].getAdminList({ filter: 'comment' })
        expect(body.total).to.equal(2)
      }
    })

    it('Should list and filter video abuses', async function () {
      {
        const body = await commands[0].getAdminList({ filter: 'comment', searchReportee: 'foo' })
        expect(body.total).to.equal(0)
      }

      {
        const body = await commands[0].getAdminList({ filter: 'comment', searchReportee: 'ot' })
        expect(body.total).to.equal(2)
      }

      {
        const body = await commands[0].getAdminList({ filter: 'comment', start: 1, count: 1, sort: 'createdAt' })
        expect(body.data).to.have.lengthOf(1)
        expect(body.data[0].comment.text).to.be.empty
      }

      {
        const body = await commands[0].getAdminList({ filter: 'comment', start: 1, count: 1, sort: '-createdAt' })
        expect(body.data).to.have.lengthOf(1)
        expect(body.data[0].comment.text).to.equal('comment server 1')
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
      await commands[0].report({ accountId: account.id, reason })

      await waitJobs(servers)
    })

    it('Should have 1 account abuse on server 1 and 0 on server 2', async function () {
      {
        const body = await commands[0].getAdminList({ filter: 'account' })

        expect(body.total).to.equal(1)
        expect(body.data).to.have.lengthOf(1)

        const abuse = body.data[0]
        expect(abuse.reason).to.equal('it is a bad account')

        expect(abuse.reporterAccount.name).to.equal('root')
        expect(abuse.reporterAccount.host).to.equal(servers[0].host)

        expect(abuse.video).to.be.null
        expect(abuse.comment).to.be.null

        expect(abuse.flaggedAccount.name).to.equal('user_1')
        expect(abuse.flaggedAccount.host).to.equal(servers[0].host)
      }

      {
        const body = await commands[1].getAdminList({ filter: 'comment' })
        expect(body.total).to.equal(0)
        expect(body.data.length).to.equal(0)
      }
    })

    it('Should report abuse on a remote account', async function () {
      this.timeout(10000)

      const account = await getAccountFromServer(servers[0].url, 'user_2', servers[1])

      const reason = 'it is a really bad account'
      await commands[0].report({ accountId: account.id, reason })

      await waitJobs(servers)
    })

    it('Should have 2 comment abuses on server 1 and 1 on server 2', async function () {
      {
        const body = await commands[0].getAdminList({ filter: 'account' })
        expect(body.total).to.equal(2)
        expect(body.data.length).to.equal(2)

        const abuse: AdminAbuse = body.data[0]
        expect(abuse.reason).to.equal('it is a bad account')

        const abuse2: AdminAbuse = body.data[1]
        expect(abuse2.reason).to.equal('it is a really bad account')

        expect(abuse2.reporterAccount.name).to.equal('root')
        expect(abuse2.reporterAccount.host).to.equal(servers[0].host)

        expect(abuse2.video).to.be.null
        expect(abuse2.comment).to.be.null

        expect(abuse2.state.id).to.equal(AbuseState.PENDING)
        expect(abuse2.state.label).to.equal('Pending')

        expect(abuse2.moderationComment).to.be.null
      }

      {
        const body = await commands[1].getAdminList({ filter: 'account' })
        expect(body.total).to.equal(1)
        expect(body.data.length).to.equal(1)

        abuseServer2 = body.data[0]

        expect(abuseServer2.reason).to.equal('it is a really bad account')

        expect(abuseServer2.reporterAccount.name).to.equal('root')
        expect(abuseServer2.reporterAccount.host).to.equal(servers[0].host)

        expect(abuseServer2.state.id).to.equal(AbuseState.PENDING)
        expect(abuseServer2.state.label).to.equal('Pending')

        expect(abuseServer2.moderationComment).to.be.null
      }
    })

    it('Should keep the account abuse when deleting the account', async function () {
      this.timeout(10000)

      const account = await getAccountFromServer(servers[1].url, 'user_2', servers[1])
      await removeUser(servers[1].url, account.userId, servers[1].accessToken)

      await waitJobs(servers)

      const body = await commands[0].getAdminList({ filter: 'account' })
      expect(body.total).to.equal(2)
      expect(body.data).to.have.lengthOf(2)

      const abuse = body.data.find(a => a.reason === 'it is a really bad account')
      expect(abuse).to.not.be.undefined
    })

    it('Should delete the account abuse', async function () {
      this.timeout(10000)

      await commands[1].delete({ abuseId: abuseServer2.id })

      await waitJobs(servers)

      {
        const body = await commands[1].getAdminList({ filter: 'account' })
        expect(body.total).to.equal(0)
        expect(body.data.length).to.equal(0)
      }

      {
        const body = await commands[0].getAdminList({ filter: 'account' })
        expect(body.total).to.equal(2)

        abuseServer1 = body.data[0]
      }
    })
  })

  describe('Common actions on abuses', function () {

    it('Should update the state of an abuse', async function () {
      await commands[0].update({ abuseId: abuseServer1.id, body: { state: AbuseState.REJECTED } })

      const body = await commands[0].getAdminList({ id: abuseServer1.id })
      expect(body.data[0].state.id).to.equal(AbuseState.REJECTED)
    })

    it('Should add a moderation comment', async function () {
      await commands[0].update({ abuseId: abuseServer1.id, body: { state: AbuseState.ACCEPTED, moderationComment: 'Valid' } })

      const body = await commands[0].getAdminList({ id: abuseServer1.id })
      expect(body.data[0].state.id).to.equal(AbuseState.ACCEPTED)
      expect(body.data[0].moderationComment).to.equal('Valid')
    })
  })

  describe('My abuses', async function () {
    let abuseId1: number
    let userAccessToken: string

    before(async function () {
      userAccessToken = await generateUserAccessToken(servers[0], 'user_42')

      await commands[0].report({ token: userAccessToken, videoId: servers[0].video.id, reason: 'user reason 1' })

      const videoId = await getVideoIdFromUUID(servers[0].url, servers[1].video.uuid)
      await commands[0].report({ token: userAccessToken, videoId, reason: 'user reason 2' })
    })

    it('Should correctly list my abuses', async function () {
      {
        const body = await commands[0].getUserList({ token: userAccessToken, start: 0, count: 5, sort: 'createdAt' })
        expect(body.total).to.equal(2)

        const abuses = body.data
        expect(abuses[0].reason).to.equal('user reason 1')
        expect(abuses[1].reason).to.equal('user reason 2')

        abuseId1 = abuses[0].id
      }

      {
        const body = await commands[0].getUserList({ token: userAccessToken, start: 1, count: 1, sort: 'createdAt' })
        expect(body.total).to.equal(2)

        const abuses: UserAbuse[] = body.data
        expect(abuses[0].reason).to.equal('user reason 2')
      }

      {
        const body = await commands[0].getUserList({ token: userAccessToken, start: 1, count: 1, sort: '-createdAt' })
        expect(body.total).to.equal(2)

        const abuses: UserAbuse[] = body.data
        expect(abuses[0].reason).to.equal('user reason 1')
      }
    })

    it('Should correctly filter my abuses by id', async function () {
      const body = await commands[0].getUserList({ token: userAccessToken, id: abuseId1 })
      expect(body.total).to.equal(1)

      const abuses: UserAbuse[] = body.data
      expect(abuses[0].reason).to.equal('user reason 1')
    })

    it('Should correctly filter my abuses by search', async function () {
      const body = await commands[0].getUserList({ token: userAccessToken, search: 'server 2' })
      expect(body.total).to.equal(1)

      const abuses: UserAbuse[] = body.data
      expect(abuses[0].reason).to.equal('user reason 2')
    })

    it('Should correctly filter my abuses by state', async function () {
      await commands[0].update({ abuseId: abuseId1, body: { state: AbuseState.REJECTED } })

      const body = await commands[0].getUserList({ token: userAccessToken, state: AbuseState.REJECTED })
      expect(body.total).to.equal(1)

      const abuses: UserAbuse[] = body.data
      expect(abuses[0].reason).to.equal('user reason 1')
    })
  })

  describe('Abuse messages', async function () {
    let abuseId: number
    let userToken: string
    let abuseMessageUserId: number
    let abuseMessageModerationId: number

    before(async function () {
      userToken = await generateUserAccessToken(servers[0], 'user_43')

      const body = await commands[0].report({ token: userToken, videoId: servers[0].video.id, reason: 'user 43 reason 1' })
      abuseId = body.abuse.id
    })

    it('Should create some messages on the abuse', async function () {
      await commands[0].addMessage({ token: userToken, abuseId, message: 'message 1' })
      await commands[0].addMessage({ abuseId, message: 'message 2' })
      await commands[0].addMessage({ abuseId, message: 'message 3' })
      await commands[0].addMessage({ token: userToken, abuseId, message: 'message 4' })
    })

    it('Should have the correct messages count when listing abuses', async function () {
      const results = await Promise.all([
        commands[0].getAdminList({ start: 0, count: 50 }),
        commands[0].getUserList({ token: userToken, start: 0, count: 50 })
      ])

      for (const body of results) {
        const abuses = body.data
        const abuse = abuses.find(a => a.id === abuseId)
        expect(abuse.countMessages).to.equal(4)
      }
    })

    it('Should correctly list messages of this abuse', async function () {
      const results = await Promise.all([
        commands[0].listMessages({ abuseId }),
        commands[0].listMessages({ token: userToken, abuseId })
      ])

      for (const body of results) {
        expect(body.total).to.equal(4)

        const abuseMessages: AbuseMessage[] = body.data

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
      await commands[0].deleteMessage({ abuseId, messageId: abuseMessageModerationId })
      await commands[0].deleteMessage({ token: userToken, abuseId, messageId: abuseMessageUserId })

      const results = await Promise.all([
        commands[0].listMessages({ abuseId }),
        commands[0].listMessages({ token: userToken, abuseId })
      ])

      for (const body of results) {
        expect(body.total).to.equal(2)

        const abuseMessages: AbuseMessage[] = body.data
        expect(abuseMessages[0].message).to.equal('message 2')
        expect(abuseMessages[1].message).to.equal('message 4')
      }
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
