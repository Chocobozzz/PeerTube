/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import {
  cleanupTests,
  CommentsCommand,
  createSingleServer,
  dateIsValid,
  PeerTubeServer,
  setAccessTokensToServers,
  testImage
} from '@shared/extra-utils'

const expect = chai.expect

describe('Test video comments', function () {
  let server: PeerTubeServer
  let videoId: number
  let videoUUID: string
  let threadId: number
  let replyToDeleteId: number

  let userAccessTokenServer1: string

  let command: CommentsCommand

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])

    const { id, uuid } = await server.videos.upload()
    videoUUID = uuid
    videoId = id

    await server.users.updateMyAvatar({ fixture: 'avatar.png' })

    userAccessTokenServer1 = await server.users.generateUserAndToken('user1')

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
      expect(comment.account.host).to.equal('localhost:' + server.port)
      expect(comment.account.url).to.equal('http://localhost:' + server.port + '/accounts/root')
      expect(comment.totalReplies).to.equal(0)
      expect(comment.totalRepliesFromVideoAuthor).to.equal(0)
      expect(dateIsValid(comment.createdAt as string)).to.be.true
      expect(dateIsValid(comment.updatedAt as string)).to.be.true
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
      expect(comment.account.host).to.equal('localhost:' + server.port)

      await testImage(server.url, 'avatar-resized', comment.account.avatar.path, '.png')

      expect(comment.totalReplies).to.equal(0)
      expect(comment.totalRepliesFromVideoAuthor).to.equal(0)
      expect(dateIsValid(comment.createdAt as string)).to.be.true
      expect(dateIsValid(comment.updatedAt as string)).to.be.true

      threadId = comment.threadId
    })

    it('Should get all the thread created', async function () {
      const body = await command.getThread({ videoId: videoUUID, threadId })

      const rootComment = body.comment
      expect(rootComment.inReplyToCommentId).to.be.null
      expect(rootComment.text).equal('my super first comment')
      expect(rootComment.videoId).to.equal(videoId)
      expect(dateIsValid(rootComment.createdAt as string)).to.be.true
      expect(dateIsValid(rootComment.updatedAt as string)).to.be.true
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
      await command.addReply({ videoId, toCommentId: threadId2, text: text3 })

      const tree = await command.getThread({ videoId: videoUUID, threadId: threadId2 })
      expect(tree.comment.totalReplies).to.equal(tree.comment.totalRepliesFromVideoAuthor + 1)
    })
  })

  describe('All instance comments', function () {

    it('Should list instance comments as admin', async function () {
      const { data } = await command.listForAdmin({ start: 0, count: 1 })

      expect(data[0].text).to.equal('my second answer to thread 4')
    })

    it('Should filter instance comments by isLocal', async function () {
      const { total, data } = await command.listForAdmin({ isLocal: false })

      expect(data).to.have.lengthOf(0)
      expect(total).to.equal(0)
    })

    it('Should search instance comments by account', async function () {
      const { total, data } = await command.listForAdmin({ searchAccount: 'user' })

      expect(data).to.have.lengthOf(1)
      expect(total).to.equal(1)

      expect(data[0].text).to.equal('a first answer to thread 4 by a third party')
    })

    it('Should search instance comments by video', async function () {
      {
        const { total, data } = await command.listForAdmin({ searchVideo: 'video' })

        expect(data).to.have.lengthOf(7)
        expect(total).to.equal(7)
      }

      {
        const { total, data } = await command.listForAdmin({ searchVideo: 'hello' })

        expect(data).to.have.lengthOf(0)
        expect(total).to.equal(0)
      }
    })

    it('Should search instance comments', async function () {
      const { total, data } = await command.listForAdmin({ search: 'super thread 3' })

      expect(total).to.equal(1)

      expect(data).to.have.lengthOf(1)
      expect(data[0].text).to.equal('super thread 3')
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
