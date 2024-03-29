/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { UserNotification, UserNotificationType, VideoCommentPolicy } from '@peertube/peertube-models'
import { PeerTubeServer, cleanupTests, setDefaultAccountAvatar, waitJobs } from '@peertube/peertube-server-commands'
import { MockSmtpServer } from '@tests/shared/mock-servers/mock-email.js'
import { CheckerBaseParams, checkCommentMention, checkNewCommentOnMyVideo, prepareNotificationsTest } from '@tests/shared/notifications.js'
import { expect } from 'chai'

describe('Test comments notifications', function () {
  let servers: PeerTubeServer[] = []
  let userToken: string
  let userToken2: string
  let userNotifications: UserNotification[] = []
  let emails: object[] = []

  const commentText = '**hello** <a href="https://joinpeertube.org">world</a>, <h1>what do you think about peertube?</h1>'
  const expectedHtml = '<strong>hello</strong> <a href="https://joinpeertube.org" target="_blank" rel="noopener noreferrer">world</a>' +
                       ', </p>what do you think about peertube?'

  before(async function () {
    this.timeout(120000)

    const res = await prepareNotificationsTest(2)
    emails = res.emails
    userToken = res.userAccessToken
    servers = res.servers
    userNotifications = res.userNotifications

    userToken2 = await servers[0].users.generateUserAndToken('user2')
    await setDefaultAccountAvatar(servers[0], userToken2)
  })

  describe('Comment on my video notifications', function () {
    let baseParams: CheckerBaseParams

    before(() => {
      baseParams = {
        server: servers[0],
        emails,
        socketNotifications: userNotifications,
        token: userToken
      }
    })

    it('Should not send a new comment notification after a comment on another video', async function () {
      this.timeout(60000)

      const { uuid, shortUUID } = await servers[0].videos.upload({ attributes: { name: 'super video' } })

      const created = await servers[0].comments.createThread({ videoId: uuid, text: 'comment' })
      const commentId = created.id

      await waitJobs(servers)
      await checkNewCommentOnMyVideo({ ...baseParams, shortUUID, threadId: commentId, commentId, checkType: 'absence' })
    })

    it('Should not send a new comment notification if I comment my own video', async function () {
      this.timeout(60000)

      const { uuid, shortUUID } = await servers[0].videos.upload({ token: userToken, attributes: { name: 'super video' } })

      const created = await servers[0].comments.createThread({ token: userToken, videoId: uuid, text: 'comment' })
      const commentId = created.id

      await waitJobs(servers)
      await checkNewCommentOnMyVideo({ ...baseParams, shortUUID, threadId: commentId, commentId, checkType: 'absence' })
    })

    it('Should not send a new comment notification if the account is muted', async function () {
      this.timeout(60000)

      await servers[0].blocklist.addToMyBlocklist({ token: userToken, account: 'root' })

      const { uuid, shortUUID } = await servers[0].videos.upload({ token: userToken, attributes: { name: 'super video' } })

      const created = await servers[0].comments.createThread({ videoId: uuid, text: 'comment' })
      const commentId = created.id

      await waitJobs(servers)
      await checkNewCommentOnMyVideo({ ...baseParams, shortUUID, threadId: commentId, commentId, checkType: 'absence' })

      await servers[0].blocklist.removeFromMyBlocklist({ token: userToken, account: 'root' })
    })

    it('Should send a new comment notification after a local comment on my video', async function () {
      this.timeout(60000)

      const { uuid, shortUUID } = await servers[0].videos.upload({ token: userToken, attributes: { name: 'super video' } })

      const created = await servers[0].comments.createThread({ videoId: uuid, text: 'comment' })
      const commentId = created.id

      await waitJobs(servers)
      await checkNewCommentOnMyVideo({ ...baseParams, shortUUID, threadId: commentId, commentId, checkType: 'presence' })
    })

    it('Should send a new comment notification after a remote comment on my video', async function () {
      this.timeout(60000)

      const { uuid, shortUUID } = await servers[0].videos.upload({ token: userToken, attributes: { name: 'super video' } })
      await waitJobs(servers)

      await servers[1].comments.createThread({ videoId: uuid, text: 'comment' })
      await waitJobs(servers)

      const { data } = await servers[0].comments.listThreads({ videoId: uuid })
      expect(data).to.have.lengthOf(1)

      const commentId = data[0].id
      await checkNewCommentOnMyVideo({ ...baseParams, shortUUID, threadId: commentId, commentId, checkType: 'presence' })
    })

    it('Should send a new comment notification after a local reply on my video', async function () {
      this.timeout(60000)

      const { uuid, shortUUID } = await servers[0].videos.upload({ token: userToken, attributes: { name: 'super video' } })

      const { id: threadId } = await servers[0].comments.createThread({ videoId: uuid, text: 'comment' })

      const { id: commentId } = await servers[0].comments.addReply({ videoId: uuid, toCommentId: threadId, text: 'reply' })

      await waitJobs(servers)
      await checkNewCommentOnMyVideo({ ...baseParams, shortUUID, threadId, commentId, checkType: 'presence' })
    })

    it('Should send a new comment notification after a remote reply on my video', async function () {
      this.timeout(60000)

      const { uuid, shortUUID } = await servers[0].videos.upload({ token: userToken, attributes: { name: 'super video' } })
      await waitJobs(servers)

      {
        const created = await servers[1].comments.createThread({ videoId: uuid, text: 'comment' })
        const threadId = created.id
        await servers[1].comments.addReply({ videoId: uuid, toCommentId: threadId, text: 'reply' })
      }

      await waitJobs(servers)

      const { data } = await servers[0].comments.listThreads({ videoId: uuid })
      expect(data).to.have.lengthOf(1)

      const threadId = data[0].id
      const tree = await servers[0].comments.getThread({ videoId: uuid, threadId })

      expect(tree.children).to.have.lengthOf(1)
      const commentId = tree.children[0].comment.id

      await checkNewCommentOnMyVideo({ ...baseParams, shortUUID, threadId, commentId, checkType: 'presence' })
    })

    it('Should send a new comment notification of a comment that requires approval', async function () {
      this.timeout(60000)

      const { id: videoId, uuid, shortUUID } = await servers[0].videos.upload({
        token: userToken,
        attributes: { name: 'super video', commentsPolicy: VideoCommentPolicy.REQUIRES_APPROVAL }
      })
      await waitJobs(servers)

      let localCommentId: number
      {
        const created = await servers[0].comments.createThread({ videoId: uuid, text: 'local approval', token: userToken2 })
        const commentId = localCommentId = created.id

        await waitJobs(servers)
        await checkNewCommentOnMyVideo({ ...baseParams, shortUUID, threadId: commentId, commentId, checkType: 'presence', approval: true })
      }

      {
        await servers[1].comments.createThread({ videoId: uuid, text: 'remote approval' })
        await waitJobs(servers)

        const commentId = await servers[0].comments.findCommentId({ token: userToken, videoId, text: 'remote approval' })

        await checkNewCommentOnMyVideo({ ...baseParams, shortUUID, threadId: commentId, commentId, checkType: 'presence', approval: true })
      }

      // It should not re-notify on approval
      {
        await servers[0].comments.approve({ token: userToken, commentId: localCommentId, videoId: shortUUID })
        await waitJobs(servers)

        const notifications = baseParams.socketNotifications
          .filter(n => n.type === UserNotificationType.NEW_COMMENT_ON_MY_VIDEO && n.comment?.video?.shortUUID === shortUUID)

        expect(notifications).to.have.lengthOf(2)
      }
    })

    it('Should convert markdown in comment to html', async function () {
      this.timeout(60000)

      const { uuid } = await servers[0].videos.upload({ token: userToken, attributes: { name: 'cool video' } })

      await servers[0].comments.createThread({ videoId: uuid, text: commentText })

      await waitJobs(servers)

      const latestEmail = emails[emails.length - 1]
      expect(latestEmail['html']).to.contain(expectedHtml)
    })
  })

  describe('Mention notifications', function () {
    let baseParams: CheckerBaseParams
    const byAccountDisplayName = 'super root name'

    before(async function () {
      baseParams = {
        server: servers[0],
        emails,
        socketNotifications: userNotifications,
        token: userToken
      }

      await servers[0].users.updateMe({ displayName: 'super root name' })
      await servers[1].users.updateMe({ displayName: 'super root 2 name' })
    })

    it('Should not send a new mention comment notification if I mention the video owner', async function () {
      this.timeout(60000)

      const { uuid, shortUUID } = await servers[0].videos.upload({ token: userToken, attributes: { name: 'super video' } })

      const { id: commentId } = await servers[0].comments.createThread({ videoId: uuid, text: '@user_1 hello' })

      await waitJobs(servers)
      await checkCommentMention({ ...baseParams, shortUUID, threadId: commentId, commentId, byAccountDisplayName, checkType: 'absence' })
    })

    it('Should not send a new mention comment notification if I mention myself', async function () {
      this.timeout(60000)

      const { uuid, shortUUID } = await servers[0].videos.upload({ attributes: { name: 'super video' } })

      const { id: commentId } = await servers[0].comments.createThread({ token: userToken, videoId: uuid, text: '@user_1 hello' })

      await waitJobs(servers)
      await checkCommentMention({ ...baseParams, shortUUID, threadId: commentId, commentId, byAccountDisplayName, checkType: 'absence' })
    })

    it('Should not send a new mention notification if the account is muted', async function () {
      this.timeout(60000)

      await servers[0].blocklist.addToMyBlocklist({ token: userToken, account: 'root' })

      const { uuid, shortUUID } = await servers[0].videos.upload({ attributes: { name: 'super video' } })

      const { id: commentId } = await servers[0].comments.createThread({ videoId: uuid, text: '@user_1 hello' })

      await waitJobs(servers)
      await checkCommentMention({ ...baseParams, shortUUID, threadId: commentId, commentId, byAccountDisplayName, checkType: 'absence' })

      await servers[0].blocklist.removeFromMyBlocklist({ token: userToken, account: 'root' })
    })

    it('Should not send a new mention notification if the remote account mention a local account', async function () {
      this.timeout(60000)

      const { uuid, shortUUID } = await servers[0].videos.upload({ attributes: { name: 'super video' } })

      await waitJobs(servers)
      const { id: threadId } = await servers[1].comments.createThread({ videoId: uuid, text: '@user_1 hello' })

      await waitJobs(servers)

      const byAccountDisplayName = 'super root 2 name'
      await checkCommentMention({ ...baseParams, shortUUID, threadId, commentId: threadId, byAccountDisplayName, checkType: 'absence' })
    })

    it('Should send a new mention notification after local comments', async function () {
      this.timeout(60000)

      const { uuid, shortUUID } = await servers[0].videos.upload({ attributes: { name: 'super video' } })

      const { id: threadId } = await servers[0].comments.createThread({ videoId: uuid, text: '@user_1 hellotext:  1' })

      await waitJobs(servers)
      await checkCommentMention({ ...baseParams, shortUUID, threadId, commentId: threadId, byAccountDisplayName, checkType: 'presence' })

      const { id: commentId } = await servers[0].comments.addReply({ videoId: uuid, toCommentId: threadId, text: 'hello 2 @user_1' })

      await waitJobs(servers)
      await checkCommentMention({ ...baseParams, shortUUID, commentId, threadId, byAccountDisplayName, checkType: 'presence' })
    })

    it('Should send a new mention notification after remote comments', async function () {
      this.timeout(60000)

      const { uuid, shortUUID } = await servers[0].videos.upload({ attributes: { name: 'super video' } })

      await waitJobs(servers)

      const text1 = `hello @user_1@${servers[0].host} 1`
      const { id: server2ThreadId } = await servers[1].comments.createThread({ videoId: uuid, text: text1 })

      await waitJobs(servers)

      const { data } = await servers[0].comments.listThreads({ videoId: uuid })
      expect(data).to.have.lengthOf(1)

      const byAccountDisplayName = 'super root 2 name'
      const threadId = data[0].id
      await checkCommentMention({ ...baseParams, shortUUID, commentId: threadId, threadId, byAccountDisplayName, checkType: 'presence' })

      const text2 = `@user_1@${servers[0].host} hello 2 @root@${servers[0].host}`
      await servers[1].comments.addReply({ videoId: uuid, toCommentId: server2ThreadId, text: text2 })

      await waitJobs(servers)

      const tree = await servers[0].comments.getThread({ videoId: uuid, threadId })

      expect(tree.children).to.have.lengthOf(1)
      const commentId = tree.children[0].comment.id

      await checkCommentMention({ ...baseParams, shortUUID, commentId, threadId, byAccountDisplayName, checkType: 'presence' })
    })

    it('Should not send a new mention notification before approval', async function () {
      this.timeout(60000)

      const { id: videoId, uuid, shortUUID } = await servers[0].videos.upload({
        attributes: { name: 'super video', commentsPolicy: VideoCommentPolicy.REQUIRES_APPROVAL }
      })
      await waitJobs(servers)

      const localText = '@user_1 local approval'
      {
        const { id: threadId } = await servers[0].comments.createThread({ videoId: uuid, text: localText, token: userToken2 })
        await waitJobs(servers)

        await checkCommentMention({
          ...baseParams,
          shortUUID,
          threadId,
          commentId: threadId,
          byAccountDisplayName: 'user2',
          checkType: 'absence'
        })
      }

      const remoteText = `@user_1@${servers[0].host} remote approval`
      {
        await servers[1].comments.createThread({ videoId: uuid, text: remoteText })
        await waitJobs(servers)

        const threadId = await servers[0].comments.findCommentId({ token: userToken, videoId, text: remoteText })
        const byAccountDisplayName = 'super root 2 name'
        await checkCommentMention({ ...baseParams, shortUUID, threadId, commentId: threadId, byAccountDisplayName, checkType: 'absence' })
      }

      // It should notify on approval
      {
        const toTest = [
          { text: localText, byAccountDisplayName: 'user2' },
          { text: remoteText, byAccountDisplayName: 'super root 2 name' }
        ]

        for (const { text, byAccountDisplayName } of toTest) {
          const localCommentId = await servers[0].comments.findCommentId({ token: userToken, videoId, text })

          await servers[0].comments.approve({ commentId: localCommentId, videoId: shortUUID })
          await waitJobs(servers)

          await checkCommentMention({
            ...baseParams,
            shortUUID,
            threadId: localCommentId,
            commentId: localCommentId,
            byAccountDisplayName,
            checkType: 'presence'
          })
        }
      }
    })

    it('Should convert markdown in comment to html', async function () {
      this.timeout(60000)

      const { uuid } = await servers[0].videos.upload({ attributes: { name: 'super video' } })

      const { id: threadId } = await servers[0].comments.createThread({ videoId: uuid, text: '@user_1 hello 1' })

      await servers[0].comments.addReply({ videoId: uuid, toCommentId: threadId, text: '@user_1 ' + commentText })

      await waitJobs(servers)

      const latestEmail = emails[emails.length - 1]
      expect(latestEmail['html']).to.contain(expectedHtml)
    })
  })

  after(async function () {
    MockSmtpServer.Instance.kill()

    await cleanupTests(servers)
  })
})
