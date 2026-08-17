/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { VideoCommentForAdminOrUser, VideoCreateResult } from '@peertube/peertube-models'
import {
  CommentsCommand,
  PeerTubeServer,
  cleanupTests,
  createSingleServer,
  doubleFollow,
  setAccessTokensToServers,
  setDefaultAccountAvatar,
  setDefaultChannelAvatar,
  waitJobs
} from '@peertube/peertube-server-commands'
import { dateIsValid, testImage } from '@tests/shared/checks.js'
import { expect } from 'chai'

describe('Test video comments', function () {
  let server: PeerTubeServer
  let videoId: number
  let videoUUID: string
  let threadId: number
  let replyToDeleteId: number

  let userAccessTokenServer1: string

  let command: CommentsCommand

  before(async function () {
    this.timeout(120000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])

    const { id, uuid } = await server.videos.upload()
    videoUUID = uuid
    videoId = id

    await setDefaultChannelAvatar(server)
    await setDefaultAccountAvatar(server)

    userAccessTokenServer1 = await server.users.generateUserAndToken('user1')
    await setDefaultChannelAvatar(server, 'user1_channel')
    await setDefaultAccountAvatar(server, userAccessTokenServer1)

    command = server.comments
  })

  describe('User comments', function () {
    it('Should not have threads on this video', async function () {
      const body = await command.listThreads({ videoId: videoUUID })

      expect(body.total).to.equal(0)
      expect(body.totalNotDeletedComments).to.equal(0)
      expect(body.data).to.be.an('array')
      expect(body.data).to.have.lengthOf(0)
    })

    it('Should create a thread in this video', async function () {
      const text = 'my super first comment'

      const comment = await command.createThread({ videoId: videoUUID, text })

      expect(comment.inReplyToCommentId).to.be.null
      expect(comment.text).equal('my super first comment')
      expect(comment.videoId).to.equal(videoId)
      expect(comment.id).to.equal(comment.threadId)
      expect(comment.account.name).to.equal('root')
      expect(comment.account.host).to.equal(server.host)
      expect(comment.account.url).to.equal(server.url + '/accounts/root')
      expect(comment.totalReplies).to.equal(0)
      expect(comment.totalRepliesFromVideoAuthor).to.equal(0)
      expect(dateIsValid(comment.createdAt)).to.be.true
      expect(dateIsValid(comment.updatedAt)).to.be.true
    })

    it('Should list threads of this video', async function () {
      const body = await command.listThreads({ videoId: videoUUID })

      expect(body.total).to.equal(1)
      expect(body.totalNotDeletedComments).to.equal(1)
      expect(body.data).to.be.an('array')
      expect(body.data).to.have.lengthOf(1)

      const comment = body.data[0]
      expect(comment.inReplyToCommentId).to.be.null
      expect(comment.text).equal('my super first comment')
      expect(comment.videoId).to.equal(videoId)
      expect(comment.id).to.equal(comment.threadId)
      expect(comment.account.name).to.equal('root')
      expect(comment.account.host).to.equal(server.host)

      for (const avatar of comment.account.avatars) {
        await testImage({ url: avatar.fileUrl, name: `avatar-resized-${avatar.width}x${avatar.width}.png` })
      }

      expect(comment.totalReplies).to.equal(0)
      expect(comment.totalRepliesFromVideoAuthor).to.equal(0)
      expect(dateIsValid(comment.createdAt)).to.be.true
      expect(dateIsValid(comment.updatedAt)).to.be.true

      threadId = comment.threadId
    })

    it('Should get all the thread created', async function () {
      const body = await command.getThread({ videoId: videoUUID, threadId })

      const rootComment = body.comment
      expect(rootComment.inReplyToCommentId).to.be.null
      expect(rootComment.text).equal('my super first comment')
      expect(rootComment.videoId).to.equal(videoId)
      expect(dateIsValid(rootComment.createdAt)).to.be.true
      expect(dateIsValid(rootComment.updatedAt)).to.be.true
    })

    it('Should create multiple replies in this thread', async function () {
      const text1 = 'my super answer to thread 1'
      const created = await command.addReply({ videoId, toCommentId: threadId, text: text1 })
      const childCommentId = created.id

      const text2 = 'my super answer to answer of thread 1'
      await command.addReply({ videoId, toCommentId: childCommentId, text: text2 })

      const text3 = 'my second answer to thread 1'
      await command.addReply({ videoId, toCommentId: threadId, text: text3 })
    })

    it('Should get correctly the replies', async function () {
      const tree = await command.getThread({ videoId: videoUUID, threadId })

      expect(tree.comment.text).equal('my super first comment')
      expect(tree.children).to.have.lengthOf(2)

      const firstChild = tree.children[0]
      expect(firstChild.comment.text).to.equal('my super answer to thread 1')
      expect(firstChild.children).to.have.lengthOf(1)

      const childOfFirstChild = firstChild.children[0]
      expect(childOfFirstChild.comment.text).to.equal('my super answer to answer of thread 1')
      expect(childOfFirstChild.children).to.have.lengthOf(0)

      const secondChild = tree.children[1]
      expect(secondChild.comment.text).to.equal('my second answer to thread 1')
      expect(secondChild.children).to.have.lengthOf(0)

      replyToDeleteId = secondChild.comment.id
    })

    it('Should create other threads', async function () {
      const text1 = 'super thread 2'
      await command.createThread({ videoId: videoUUID, text: text1 })

      const text2 = 'super thread 3'
      await command.createThread({ videoId: videoUUID, text: text2 })
    })

    it('Should list the threads', async function () {
      const body = await command.listThreads({ videoId: videoUUID, sort: 'createdAt' })

      expect(body.total).to.equal(3)
      expect(body.totalNotDeletedComments).to.equal(6)
      expect(body.data).to.be.an('array')
      expect(body.data).to.have.lengthOf(3)

      expect(body.data[0].text).to.equal('my super first comment')
      expect(body.data[0].totalReplies).to.equal(3)
      expect(body.data[1].text).to.equal('super thread 2')
      expect(body.data[1].totalReplies).to.equal(0)
      expect(body.data[2].text).to.equal('super thread 3')
      expect(body.data[2].totalReplies).to.equal(0)
    })

    it('Should list the and sort them by total replies', async function () {
      const body = await command.listThreads({ videoId: videoUUID, sort: 'totalReplies' })

      expect(body.data[2].text).to.equal('my super first comment')
      expect(body.data[2].totalReplies).to.equal(3)
    })

    it('Should delete a reply', async function () {
      await command.delete({ videoId, commentId: replyToDeleteId })

      {
        const body = await command.listThreads({ videoId: videoUUID, sort: 'createdAt' })

        expect(body.total).to.equal(3)
        expect(body.totalNotDeletedComments).to.equal(5)
      }

      {
        const tree = await command.getThread({ videoId: videoUUID, threadId })

        expect(tree.comment.text).equal('my super first comment')
        expect(tree.children).to.have.lengthOf(2)

        const firstChild = tree.children[0]
        expect(firstChild.comment.text).to.equal('my super answer to thread 1')
        expect(firstChild.children).to.have.lengthOf(1)

        const childOfFirstChild = firstChild.children[0]
        expect(childOfFirstChild.comment.text).to.equal('my super answer to answer of thread 1')
        expect(childOfFirstChild.children).to.have.lengthOf(0)

        const deletedChildOfFirstChild = tree.children[1]
        expect(deletedChildOfFirstChild.comment.text).to.equal('')
        expect(deletedChildOfFirstChild.comment.isDeleted).to.be.true
        expect(deletedChildOfFirstChild.comment.deletedAt).to.not.be.null
        expect(deletedChildOfFirstChild.comment.account).to.be.null
        expect(deletedChildOfFirstChild.children).to.have.lengthOf(0)
      }
    })

    it('Should delete a complete thread', async function () {
      await command.delete({ videoId, commentId: threadId })

      const body = await command.listThreads({ videoId: videoUUID, sort: 'createdAt' })
      expect(body.total).to.equal(3)
      expect(body.data).to.be.an('array')
      expect(body.data).to.have.lengthOf(3)

      expect(body.data[0].text).to.equal('')
      expect(body.data[0].isDeleted).to.be.true
      expect(body.data[0].deletedAt).to.not.be.null
      expect(body.data[0].account).to.be.null
      expect(body.data[0].totalReplies).to.equal(2)
      expect(body.data[1].text).to.equal('super thread 2')
      expect(body.data[1].totalReplies).to.equal(0)
      expect(body.data[2].text).to.equal('super thread 3')
      expect(body.data[2].totalReplies).to.equal(0)
    })

    it('Should count replies from the video author correctly', async function () {
      await command.createThread({ videoId: videoUUID, text: 'my super first comment' })

      const { data } = await command.listThreads({ videoId: videoUUID })
      const threadId2 = data[0].threadId

      const text2 = 'a first answer to thread 4 by a third party'
      await command.addReply({ token: userAccessTokenServer1, videoId, toCommentId: threadId2, text: text2 })

      const text3 = 'my second answer to thread 4'
      await command.addReply({ videoId, toCommentId: threadId2, token: userAccessTokenServer1, text: text3 })
      await command.addReplyToLastReply({ text: 'third answer' })

      const tree = await command.getThread({ videoId: videoUUID, threadId: threadId2 })
      expect(tree.comment.totalRepliesFromVideoAuthor).to.equal(1)
      expect(tree.comment.totalReplies).to.equal(3)

      const reply1 = tree.children.find(c => c.comment.text === text2)
      expect(reply1.comment.totalReplies).to.equal(0)
      expect(reply1.comment.totalRepliesFromVideoAuthor).to.equal(0)

      const reply2 = tree.children.find(c => c.comment.text === text3)
      expect(reply2.comment.totalReplies).to.equal(1)
      expect(reply2.comment.totalRepliesFromVideoAuthor).to.equal(1)
    })
  })

  describe('Listing comments on my videos and in admin', function () {
    const listFunctions = () => [
      command.listForAdmin.bind(command),
      command.listCommentsOnMyVideos.bind(command)
    ]

    it('Should list comments', async function () {
      for (const fn of listFunctions()) {
        const { data, total } = await fn({ start: 0, count: 1 })

        expect(total).to.equal(8)
        expect(data).to.have.lengthOf(1)
        expect(data[0].text).to.equal('third answer')
        expect(data[0].account.name).to.equal('root')
        expect(data[0].account.displayName).to.equal('root')
        expect(data[0].account.avatars).to.have.lengthOf(4)
        expect(data[0].video.uuid).to.equal(videoUUID)
        expect(data[0].video.channel.name).to.equal('root_channel')
      }

      for (const fn of listFunctions()) {
        const { data, total } = await fn({ start: 1, count: 2 })

        expect(total).to.equal(8)
        expect(data).to.have.lengthOf(2)

        expect(data[0].account.avatars).to.have.lengthOf(4)
        expect(data[1].account.avatars).to.have.lengthOf(4)
      }

      const { data, total } = await command.listCommentsOnMyVideos({ token: userAccessTokenServer1 })
      expect(data).to.have.lengthOf(0)
      expect(total).to.equal(0)
    })

    it('Should filter instance comments by isLocal', async function () {
      const { total, data } = await command.listForAdmin({ isLocal: false })

      expect(data).to.have.lengthOf(0)
      expect(total).to.equal(0)
    })

    it('Should filter instance comments by onLocalVideo', async function () {
      {
        const { total, data } = await command.listForAdmin({ onLocalVideo: false })

        expect(data).to.have.lengthOf(0)
        expect(total).to.equal(0)
      }

      {
        const { total, data } = await command.listForAdmin({ onLocalVideo: true })

        expect(data).to.not.have.lengthOf(0)
        expect(total).to.not.equal(0)
      }
    })

    it('Should filter instance comments by includeMuted', async function () {
      await server.blocklist.addToServerBlocklist({ account: 'user1@' + server.host })

      const findUserComment = (data: VideoCommentForAdminOrUser[]) => data.find(c => c.account.name === 'user1')

      {
        const { total, data } = await command.listForAdmin({ includeMuted: false })

        expect(total).to.be.greaterThan(0)
        expect(data).to.have.lengthOf(total)

        expect(findUserComment(data)).to.not.exist
      }

      {
        const { total, data } = await command.listForAdmin({ includeMuted: true })

        expect(total).to.be.greaterThan(0)
        expect(data).to.have.lengthOf(total)

        expect(findUserComment(data)).to.exist
      }

      // Default is false

      {
        const { total, data } = await command.listForAdmin()

        expect(total).to.be.greaterThan(0)
        expect(data).to.have.lengthOf(total)

        expect(findUserComment(data)).to.not.exist
      }

      await server.blocklist.removeFromServerBlocklist({ account: 'user1@' + server.host })
    })

    it('Should search comments by account', async function () {
      for (const fn of listFunctions()) {
        const { total, data } = await fn({ searchAccount: 'user' })

        expect(data).to.have.lengthOf(2)
        expect(total).to.equal(2)

        expect(data[0].text).to.equal('my second answer to thread 4')
        expect(data[1].text).to.equal('a first answer to thread 4 by a third party')
      }

      const { data, total } = await command.listCommentsOnMyVideos({ token: userAccessTokenServer1, searchAccount: 'user' })
      expect(data).to.have.lengthOf(0)
      expect(total).to.equal(0)
    })

    it('Should search comments by video', async function () {
      for (const fn of listFunctions()) {
        const { total, data } = await fn({ searchVideo: 'video' })

        expect(data).to.have.lengthOf(8)
        expect(total).to.equal(8)
      }

      for (const fn of listFunctions()) {
        const { total, data } = await fn({ searchVideo: 'hello' })

        expect(data).to.have.lengthOf(0)
        expect(total).to.equal(0)
      }

      const { data, total } = await command.listCommentsOnMyVideos({ token: userAccessTokenServer1, searchVideo: 'video' })
      expect(data).to.have.lengthOf(0)
      expect(total).to.equal(0)
    })

    it('Should search comments', async function () {
      for (const fn of listFunctions()) {
        const { total, data } = await fn({ search: 'super thread 3' })

        expect(total).to.equal(1)

        expect(data).to.have.lengthOf(1)
        expect(data[0].text).to.equal('super thread 3')
      }

      const { data, total } = await command.listCommentsOnMyVideos({ token: userAccessTokenServer1, search: 'super thread 3' })
      expect(data).to.have.lengthOf(0)
      expect(total).to.equal(0)
    })

    it('Should filter by videoId', async function () {
      const { uuid: otherVideo } = await server.videos.upload()

      {
        const { total, data } = await command.listForAdmin({ videoId: videoUUID })
        expect(data).to.have.lengthOf(8)
        expect(total).to.equal(8)
      }

      {
        const { total, data } = await command.listForAdmin({ videoId: otherVideo })
        expect(data).to.have.lengthOf(0)
        expect(total).to.equal(0)
      }
    })

    it('Should filter by channelId', async function () {
      const { id: videoChannelId } = await server.channels.create({ attributes: { name: 'other_channel' } })
      const { videoChannels: rootChannels } = await server.users.getMyInfo()

      await server.videos.upload({ attributes: { channelId: videoChannelId } })

      {
        const { total, data } = await command.listForAdmin({ videoChannelId: rootChannels[0].id })
        expect(data).to.have.lengthOf(8)
        expect(total).to.equal(8)
      }

      {
        const { total, data } = await command.listForAdmin({ videoChannelId })
        expect(data).to.have.lengthOf(0)
        expect(total).to.equal(0)
      }
    })

    // Auto tags filter is checked auto tags test file
  })

  describe('Video comment count', function () {
    let testVideoUUID: string

    before(async function () {
      const { uuid } = await server.videos.upload()
      testVideoUUID = uuid
    })

    it('Should start with 0 comments', async function () {
      const video = await server.videos.get({ id: testVideoUUID })
      expect(video.comments).to.equal(0)
    })

    it('Should increment comment count when adding comment', async function () {
      await command.createThread({ videoId: testVideoUUID, text: 'test comment' })

      const video = await server.videos.get({ id: testVideoUUID })
      expect(video.comments).to.equal(1)
    })

    it('Should decrement count when deleting comment', async function () {
      const { data } = await command.listThreads({ videoId: testVideoUUID })
      const commentToDelete = data[0]

      await command.delete({ videoId: testVideoUUID, commentId: commentToDelete.id })

      const video = await server.videos.get({ id: testVideoUUID })
      expect(video.comments).to.equal(0)
    })
  })

  describe('Comment tree truncation', function () {
    let treeVideoId: number
    let treeVideoUUID: string
    let deepThreadId: number
    let wideThreadId: number

    before(async function () {
      this.timeout(120000)

      const { id, uuid } = await server.videos.upload()
      treeVideoId = id
      treeVideoUUID = uuid
    })

    it('Should truncate the thread tree in depth', async function () {
      const thread = await command.createThread({ videoId: treeVideoUUID, text: 'depth 0' })
      deepThreadId = thread.id

      let parentId = thread.id
      for (let i = 1; i <= 8; i++) {
        const reply = await command.addReply({ videoId: treeVideoId, toCommentId: parentId, text: 'depth ' + i })
        parentId = reply.id
      }

      const tree = await command.getThread({ videoId: treeVideoUUID, threadId: deepThreadId })

      let node = tree
      for (let i = 1; i <= 5; i++) {
        expect(node.children, 'children of depth ' + (i - 1)).to.have.lengthOf(1)
        expect(node.totalChildren).to.equal(1)

        node = node.children[0]
        expect(node.comment.text).to.equal('depth ' + i)
      }

      // Deeper replies have to be re-fetched
      expect(node.children).to.have.lengthOf(0)
      expect(node.totalChildren).to.equal(1)
    })

    it('Should respect the maxDepth parameter', async function () {
      const tree = await command.getThread({ videoId: treeVideoUUID, threadId: deepThreadId, maxDepth: 1 })

      expect(tree.children).to.have.lengthOf(1)
      expect(tree.children[0].comment.text).to.equal('depth 1')
      expect(tree.children[0].children).to.have.lengthOf(0)
      expect(tree.children[0].totalChildren).to.equal(1)
    })

    it('Should fetch the replies of a nested comment', async function () {
      const tree = await command.getThread({ videoId: treeVideoUUID, threadId: deepThreadId, maxDepth: 5 })

      let node = tree
      for (let i = 1; i <= 5; i++) node = node.children[0]

      const { total, data } = await command.listReplies({ videoId: treeVideoUUID, commentId: node.comment.id })
      expect(total).to.equal(1)
      expect(data).to.have.lengthOf(1)

      expect(data[0].comment.text).to.equal('depth 6')
      expect(data[0].children).to.have.lengthOf(1)
      expect(data[0].children[0].comment.text).to.equal('depth 7')
    })

    it('Should truncate the thread tree in width', async function () {
      this.timeout(60000)

      const thread = await command.createThread({ videoId: treeVideoUUID, text: 'wide thread' })

      for (let i = 0; i < 13; i++) {
        await command.addReply({ videoId: treeVideoId, toCommentId: thread.id, text: 'wide reply ' + i })
      }

      const tree = await command.getThread({ videoId: treeVideoUUID, threadId: thread.id })
      expect(tree.children).to.have.lengthOf(10)
      expect(tree.totalChildren).to.equal(13)
      expect(tree.children[0].comment.text).to.equal('wide reply 0')

      const { total, data } = await command.listReplies({
        videoId: treeVideoUUID,
        commentId: thread.id,
        start: 10,
        count: 10,
        sort: 'createdAt'
      })
      expect(total).to.equal(13)
      expect(data).to.have.lengthOf(3)
      expect(data[0].comment.text).to.equal('wide reply 10')
      expect(data[2].comment.text).to.equal('wide reply 12')

      wideThreadId = thread.id
    })

    it('Should respect the repliesPerLevel parameter', async function () {
      {
        const tree = await command.getThread({ videoId: treeVideoUUID, threadId: wideThreadId, repliesPerLevel: 3 })

        expect(tree.children).to.have.lengthOf(3)
        expect(tree.totalChildren).to.equal(13)
        expect(tree.children[0].comment.text).to.equal('wide reply 0')
      }

      {
        const tree = await command.getThread({ videoId: treeVideoUUID, threadId: wideThreadId, repliesPerLevel: 13 })

        expect(tree.children).to.have.lengthOf(13)
        expect(tree.totalChildren).to.equal(13)
      }
    })

    it('Should limit the replies of every parent of a nested level', async function () {
      this.timeout(120000)

      const thread = await command.createThread({ videoId: treeVideoUUID, text: 'nested wide thread' })

      for (const parentText of [ 'parent 0', 'parent 1' ]) {
        const parent = await command.addReply({ videoId: treeVideoId, toCommentId: thread.id, text: parentText })

        for (let i = 0; i < 12; i++) {
          await command.addReply({ videoId: treeVideoId, toCommentId: parent.id, text: `${parentText} reply ${i}` })
        }
      }

      const tree = await command.getThread({ videoId: treeVideoUUID, threadId: thread.id })
      expect(tree.children).to.have.lengthOf(2)

      for (const child of tree.children) {
        expect(child.children).to.have.lengthOf(10)
        expect(child.totalChildren).to.equal(12)
        expect(child.children[0].comment.text).to.equal(`${child.comment.text} reply 0`)
      }
    })
  })

  describe('Comment replies sort', function () {
    let treeVideoId: number
    let treeVideoUUID: string
    let wideThreadId: number
    let nestedWideThreadId: number

    // Text of the replies of the wide thread, in the order they were created
    const wideReplyTexts: string[] = []

    before(async function () {
      this.timeout(240000)

      const { id, uuid } = await server.videos.upload()
      treeVideoId = id
      treeVideoUUID = uuid

      {
        const thread = await command.createThread({ videoId: treeVideoUUID, text: 'wide thread' })
        wideThreadId = thread.id

        for (let i = 0; i < 13; i++) {
          const text = 'wide reply ' + i
          await command.addReply({ videoId: treeVideoId, toCommentId: thread.id, text })
          wideReplyTexts.push(text)
        }
      }

      {
        const thread = await command.createThread({ videoId: treeVideoUUID, text: 'nested wide thread' })
        nestedWideThreadId = thread.id

        for (const parentText of [ 'parent 0', 'parent 1' ]) {
          const parent = await command.addReply({ videoId: treeVideoId, toCommentId: thread.id, text: parentText })

          for (let i = 0; i < 3; i++) {
            await command.addReply({ videoId: treeVideoId, toCommentId: parent.id, text: `${parentText} reply ${i}` })
          }
        }
      }
    })

    it('Should sort the replies chronologically by default, like the thread tree', async function () {
      const { total, data } = await command.listReplies({ videoId: treeVideoUUID, commentId: wideThreadId })

      expect(total).to.equal(13)
      expect(data.map(d => d.comment.text)).to.deep.equal(wideReplyTexts)
    })

    it('Should sort the replies in reverse chronological order', async function () {
      const { total, data } = await command.listReplies({ videoId: treeVideoUUID, commentId: wideThreadId, sort: '-createdAt' })

      expect(total).to.equal(13)
      expect(data.map(d => d.comment.text)).to.deep.equal([ ...wideReplyTexts ].reverse())
    })

    it('Should paginate the replies consistently with the sort', async function () {
      for (const sort of [ 'createdAt', '-createdAt' ]) {
        const expectedTexts = sort === 'createdAt'
          ? wideReplyTexts
          : [ ...wideReplyTexts ].reverse()

        const fetchedTexts: string[] = []

        for (let start = 0; start < 13; start += 5) {
          const { total, data } = await command.listReplies({
            videoId: treeVideoUUID,
            commentId: wideThreadId,
            start,
            count: 5,
            sort
          })

          expect(total, 'total of ' + sort).to.equal(13)
          fetchedTexts.push(...data.map(d => d.comment.text))
        }

        // No reply is duplicated or skipped when unfolding page after page
        expect(fetchedTexts, 'replies of ' + sort).to.deep.equal(expectedTexts)
      }
    })

    it('Should apply the sort to the nested levels too', async function () {
      {
        const { data } = await command.listReplies({ videoId: treeVideoUUID, commentId: nestedWideThreadId, sort: 'createdAt' })

        expect(data.map(d => d.comment.text)).to.deep.equal([ 'parent 0', 'parent 1' ])

        for (const parent of data) {
          expect(parent.children.map(c => c.comment.text))
            .to.deep.equal([ 0, 1, 2 ].map(i => `${parent.comment.text} reply ${i}`))
        }
      }

      {
        const { data } = await command.listReplies({ videoId: treeVideoUUID, commentId: nestedWideThreadId, sort: '-createdAt' })

        expect(data.map(d => d.comment.text)).to.deep.equal([ 'parent 1', 'parent 0' ])

        for (const parent of data) {
          expect(parent.children.map(c => c.comment.text))
            .to.deep.equal([ 2, 1, 0 ].map(i => `${parent.comment.text} reply ${i}`))
        }
      }
    })

    it('Should truncate the widest replies of the sort', async function () {
      {
        const { data } = await command.listReplies({
          videoId: treeVideoUUID,
          commentId: nestedWideThreadId,
          sort: '-createdAt',
          repliesPerLevel: 2
        })

        for (const parent of data) {
          expect(parent.children.map(c => c.comment.text))
            .to.deep.equal([ 2, 1 ].map(i => `${parent.comment.text} reply ${i}`))
          expect(parent.totalChildren).to.equal(3)
        }
      }

      {
        const { data } = await command.listReplies({
          videoId: treeVideoUUID,
          commentId: nestedWideThreadId,
          sort: 'createdAt',
          repliesPerLevel: 2
        })

        for (const parent of data) {
          expect(parent.children.map(c => c.comment.text))
            .to.deep.equal([ 0, 1 ].map(i => `${parent.comment.text} reply ${i}`))
          expect(parent.totalChildren).to.equal(3)
        }
      }
    })
  })

  describe('Disabling remote comments', function () {
    let server2: PeerTubeServer
    let server3: PeerTubeServer

    let video1: VideoCreateResult
    let video2: VideoCreateResult

    before(async function () {
      this.timeout(120000)

      server2 = await createSingleServer(2)
      server3 = await createSingleServer(3)

      await setAccessTokensToServers([ server2, server3 ])
      await doubleFollow(server, server2)
    })

    it('Should federate comments', async function () {
      video1 = await server.videos.quickUpload({ name: 'video on server 1' })
      video2 = await server2.videos.quickUpload({ name: 'video on server 2' })

      await waitJobs([ server, server2 ])

      await server2.comments.createThread({ videoId: video1.uuid, text: 'comment on server 2' })
      await server2.comments.createThread({ videoId: video2.uuid, text: 'comment on server 2' })

      await waitJobs([ server, server2 ])

      for (const s of [ server, server2 ]) {
        const threads = await s.comments.listThreads({ videoId: video1.uuid })
        expect(threads.total).to.equal(1)
        expect(threads.data[0].text).to.equal('comment on server 2')

        const threads2 = await s.comments.listThreads({ videoId: video2.uuid })
        expect(threads2.total).to.equal(1)
        expect(threads2.data[0].text).to.equal('comment on server 2')
      }
    })

    it('Should not accept remote comments anymore', async function () {
      await server.config.updateExistingConfig({
        newConfig: {
          videoComments: {
            acceptRemoteComments: false
          }
        }
      })

      await server2.comments.createThread({ videoId: video1.uuid, text: 'comment on server 2 - 2' })
      await server2.comments.createThread({ videoId: video2.uuid, text: 'comment on server 2 - 2' })

      await waitJobs([ server, server2 ])

      // Server 1
      {
        const threads = await server.comments.listThreads({ videoId: video1.uuid })
        expect(threads.total).to.equal(1)

        const threads2 = await server.comments.listThreads({ videoId: video2.uuid })
        expect(threads2.total).to.equal(1)
      }

      // Server 2
      {
        const threads = await server2.comments.listThreads({ videoId: video1.uuid })
        expect(threads.total).to.equal(2)

        const threads2 = await server2.comments.listThreads({ videoId: video2.uuid })
        expect(threads2.total).to.equal(2)
      }
    })

    it('Should not fetch remote comments on new follow', async function () {
      const video3 = await server3.videos.quickUpload({ name: 'video on server 2' })
      await server3.comments.createThread({ videoId: video3.uuid, text: 'comment on server 3' })

      await waitJobs([ server3 ])
      await doubleFollow(server, server3)

      {
        const threads = await server3.comments.listThreads({ videoId: video3.uuid })
        expect(threads.total).to.equal(1)
      }

      {
        const threads = await server.comments.listThreads({ videoId: video3.uuid })
        expect(threads.total).to.equal(0)
      }
    })

    after(async function () {
      await cleanupTests([ server2, server3 ])
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
