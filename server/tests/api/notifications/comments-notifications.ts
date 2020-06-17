/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { cleanupTests, getVideoCommentThreads, getVideoThreadComments, updateMyUser } from '../../../../shared/extra-utils'
import { ServerInfo, uploadVideo } from '../../../../shared/extra-utils/index'
import { MockSmtpServer } from '../../../../shared/extra-utils/miscs/email'
import { waitJobs } from '../../../../shared/extra-utils/server/jobs'
import { addAccountToAccountBlocklist, removeAccountFromAccountBlocklist } from '../../../../shared/extra-utils/users/blocklist'
import {
  checkCommentMention,
  CheckerBaseParams,
  checkNewCommentOnMyVideo,
  prepareNotificationsTest
} from '../../../../shared/extra-utils/users/user-notifications'
import { addVideoCommentReply, addVideoCommentThread } from '../../../../shared/extra-utils/videos/video-comments'
import { UserNotification } from '../../../../shared/models/users'
import { VideoCommentThreadTree } from '../../../../shared/models/videos/video-comment.model'

const expect = chai.expect

describe('Test comments notifications', function () {
  let servers: ServerInfo[] = []
  let userAccessToken: string
  let userNotifications: UserNotification[] = []
  let emails: object[] = []

  before(async function () {
    this.timeout(120000)

    const res = await prepareNotificationsTest(2)
    emails = res.emails
    userAccessToken = res.userAccessToken
    servers = res.servers
    userNotifications = res.userNotifications
  })

  describe('Comment on my video notifications', function () {
    let baseParams: CheckerBaseParams

    before(() => {
      baseParams = {
        server: servers[0],
        emails,
        socketNotifications: userNotifications,
        token: userAccessToken
      }
    })

    it('Should not send a new comment notification after a comment on another video', async function () {
      this.timeout(10000)

      const resVideo = await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'super video' })
      const uuid = resVideo.body.video.uuid

      const resComment = await addVideoCommentThread(servers[0].url, servers[0].accessToken, uuid, 'comment')
      const commentId = resComment.body.comment.id

      await waitJobs(servers)
      await checkNewCommentOnMyVideo(baseParams, uuid, commentId, commentId, 'absence')
    })

    it('Should not send a new comment notification if I comment my own video', async function () {
      this.timeout(10000)

      const resVideo = await uploadVideo(servers[0].url, userAccessToken, { name: 'super video' })
      const uuid = resVideo.body.video.uuid

      const resComment = await addVideoCommentThread(servers[0].url, userAccessToken, uuid, 'comment')
      const commentId = resComment.body.comment.id

      await waitJobs(servers)
      await checkNewCommentOnMyVideo(baseParams, uuid, commentId, commentId, 'absence')
    })

    it('Should not send a new comment notification if the account is muted', async function () {
      this.timeout(10000)

      await addAccountToAccountBlocklist(servers[0].url, userAccessToken, 'root')

      const resVideo = await uploadVideo(servers[0].url, userAccessToken, { name: 'super video' })
      const uuid = resVideo.body.video.uuid

      const resComment = await addVideoCommentThread(servers[0].url, servers[0].accessToken, uuid, 'comment')
      const commentId = resComment.body.comment.id

      await waitJobs(servers)
      await checkNewCommentOnMyVideo(baseParams, uuid, commentId, commentId, 'absence')

      await removeAccountFromAccountBlocklist(servers[0].url, userAccessToken, 'root')
    })

    it('Should send a new comment notification after a local comment on my video', async function () {
      this.timeout(10000)

      const resVideo = await uploadVideo(servers[0].url, userAccessToken, { name: 'super video' })
      const uuid = resVideo.body.video.uuid

      const resComment = await addVideoCommentThread(servers[0].url, servers[0].accessToken, uuid, 'comment')
      const commentId = resComment.body.comment.id

      await waitJobs(servers)
      await checkNewCommentOnMyVideo(baseParams, uuid, commentId, commentId, 'presence')
    })

    it('Should send a new comment notification after a remote comment on my video', async function () {
      this.timeout(10000)

      const resVideo = await uploadVideo(servers[0].url, userAccessToken, { name: 'super video' })
      const uuid = resVideo.body.video.uuid

      await waitJobs(servers)

      await addVideoCommentThread(servers[1].url, servers[1].accessToken, uuid, 'comment')

      await waitJobs(servers)

      const resComment = await getVideoCommentThreads(servers[0].url, uuid, 0, 5)
      expect(resComment.body.data).to.have.lengthOf(1)
      const commentId = resComment.body.data[0].id

      await checkNewCommentOnMyVideo(baseParams, uuid, commentId, commentId, 'presence')
    })

    it('Should send a new comment notification after a local reply on my video', async function () {
      this.timeout(10000)

      const resVideo = await uploadVideo(servers[0].url, userAccessToken, { name: 'super video' })
      const uuid = resVideo.body.video.uuid

      const resThread = await addVideoCommentThread(servers[0].url, servers[0].accessToken, uuid, 'comment')
      const threadId = resThread.body.comment.id

      const resComment = await addVideoCommentReply(servers[0].url, servers[0].accessToken, uuid, threadId, 'reply')
      const commentId = resComment.body.comment.id

      await waitJobs(servers)
      await checkNewCommentOnMyVideo(baseParams, uuid, commentId, threadId, 'presence')
    })

    it('Should send a new comment notification after a remote reply on my video', async function () {
      this.timeout(10000)

      const resVideo = await uploadVideo(servers[0].url, userAccessToken, { name: 'super video' })
      const uuid = resVideo.body.video.uuid
      await waitJobs(servers)

      {
        const resThread = await addVideoCommentThread(servers[1].url, servers[1].accessToken, uuid, 'comment')
        const threadId = resThread.body.comment.id
        await addVideoCommentReply(servers[1].url, servers[1].accessToken, uuid, threadId, 'reply')
      }

      await waitJobs(servers)

      const resThread = await getVideoCommentThreads(servers[0].url, uuid, 0, 5)
      expect(resThread.body.data).to.have.lengthOf(1)
      const threadId = resThread.body.data[0].id

      const resComments = await getVideoThreadComments(servers[0].url, uuid, threadId)
      const tree = resComments.body as VideoCommentThreadTree

      expect(tree.children).to.have.lengthOf(1)
      const commentId = tree.children[0].comment.id

      await checkNewCommentOnMyVideo(baseParams, uuid, commentId, threadId, 'presence')
    })
  })

  describe('Mention notifications', function () {
    let baseParams: CheckerBaseParams

    before(async () => {
      baseParams = {
        server: servers[0],
        emails,
        socketNotifications: userNotifications,
        token: userAccessToken
      }

      await updateMyUser({
        url: servers[0].url,
        accessToken: servers[0].accessToken,
        displayName: 'super root name'
      })

      await updateMyUser({
        url: servers[1].url,
        accessToken: servers[1].accessToken,
        displayName: 'super root 2 name'
      })
    })

    it('Should not send a new mention comment notification if I mention the video owner', async function () {
      this.timeout(10000)

      const resVideo = await uploadVideo(servers[0].url, userAccessToken, { name: 'super video' })
      const uuid = resVideo.body.video.uuid

      const resComment = await addVideoCommentThread(servers[0].url, servers[0].accessToken, uuid, '@user_1 hello')
      const commentId = resComment.body.comment.id

      await waitJobs(servers)
      await checkCommentMention(baseParams, uuid, commentId, commentId, 'super root name', 'absence')
    })

    it('Should not send a new mention comment notification if I mention myself', async function () {
      this.timeout(10000)

      const resVideo = await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'super video' })
      const uuid = resVideo.body.video.uuid

      const resComment = await addVideoCommentThread(servers[0].url, userAccessToken, uuid, '@user_1 hello')
      const commentId = resComment.body.comment.id

      await waitJobs(servers)
      await checkCommentMention(baseParams, uuid, commentId, commentId, 'super root name', 'absence')
    })

    it('Should not send a new mention notification if the account is muted', async function () {
      this.timeout(10000)

      await addAccountToAccountBlocklist(servers[0].url, userAccessToken, 'root')

      const resVideo = await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'super video' })
      const uuid = resVideo.body.video.uuid

      const resComment = await addVideoCommentThread(servers[0].url, servers[0].accessToken, uuid, '@user_1 hello')
      const commentId = resComment.body.comment.id

      await waitJobs(servers)
      await checkCommentMention(baseParams, uuid, commentId, commentId, 'super root name', 'absence')

      await removeAccountFromAccountBlocklist(servers[0].url, userAccessToken, 'root')
    })

    it('Should not send a new mention notification if the remote account mention a local account', async function () {
      this.timeout(20000)

      const resVideo = await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'super video' })
      const uuid = resVideo.body.video.uuid

      await waitJobs(servers)
      const resThread = await addVideoCommentThread(servers[1].url, servers[1].accessToken, uuid, '@user_1 hello')
      const threadId = resThread.body.comment.id

      await waitJobs(servers)
      await checkCommentMention(baseParams, uuid, threadId, threadId, 'super root 2 name', 'absence')
    })

    it('Should send a new mention notification after local comments', async function () {
      this.timeout(10000)

      const resVideo = await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'super video' })
      const uuid = resVideo.body.video.uuid

      const resThread = await addVideoCommentThread(servers[0].url, servers[0].accessToken, uuid, '@user_1 hello 1')
      const threadId = resThread.body.comment.id

      await waitJobs(servers)
      await checkCommentMention(baseParams, uuid, threadId, threadId, 'super root name', 'presence')

      const resComment = await addVideoCommentReply(servers[0].url, servers[0].accessToken, uuid, threadId, 'hello 2 @user_1')
      const commentId = resComment.body.comment.id

      await waitJobs(servers)
      await checkCommentMention(baseParams, uuid, commentId, threadId, 'super root name', 'presence')
    })

    it('Should send a new mention notification after remote comments', async function () {
      this.timeout(20000)

      const resVideo = await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'super video' })
      const uuid = resVideo.body.video.uuid

      await waitJobs(servers)

      const text1 = `hello @user_1@localhost:${servers[0].port} 1`
      const resThread = await addVideoCommentThread(servers[1].url, servers[1].accessToken, uuid, text1)
      const server2ThreadId = resThread.body.comment.id

      await waitJobs(servers)

      const resThread2 = await getVideoCommentThreads(servers[0].url, uuid, 0, 5)
      expect(resThread2.body.data).to.have.lengthOf(1)
      const server1ThreadId = resThread2.body.data[0].id
      await checkCommentMention(baseParams, uuid, server1ThreadId, server1ThreadId, 'super root 2 name', 'presence')

      const text2 = `@user_1@localhost:${servers[0].port} hello 2 @root@localhost:${servers[0].port}`
      await addVideoCommentReply(servers[1].url, servers[1].accessToken, uuid, server2ThreadId, text2)

      await waitJobs(servers)

      const resComments = await getVideoThreadComments(servers[0].url, uuid, server1ThreadId)
      const tree = resComments.body as VideoCommentThreadTree

      expect(tree.children).to.have.lengthOf(1)
      const commentId = tree.children[0].comment.id

      await checkCommentMention(baseParams, uuid, commentId, server1ThreadId, 'super root 2 name', 'presence')
    })
  })

  after(async function () {
    MockSmtpServer.Instance.kill()

    await cleanupTests(servers)
  })
})
