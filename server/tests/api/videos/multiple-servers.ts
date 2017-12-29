/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import { join } from 'path'
import * as request from 'supertest'
import { VideoPrivacy } from '../../../../shared/models/videos'
import { VideoComment, VideoCommentThreadTree } from '../../../../shared/models/videos/video-comment.model'

import {
  addVideoChannel, completeVideoCheck, createUser, dateIsValid, doubleFollow, flushAndRunMultipleServers, flushTests, getVideo,
  getVideoChannelsList, getVideosList, killallServers, rateVideo, removeVideo, ServerInfo, setAccessTokensToServers, testVideoImage,
  updateVideo, uploadVideo, userLogin, viewVideo, wait, webtorrentAdd
} from '../../utils'
import {
  addVideoCommentReply, addVideoCommentThread, getVideoCommentThreads,
  getVideoThreadComments
} from '../../utils/videos/video-comments'

const expect = chai.expect

describe('Test multiple servers', function () {
  let servers: ServerInfo[] = []
  const toRemove = []
  let videoUUID = ''
  let videoChannelId: number

  before(async function () {
    this.timeout(120000)

    servers = await flushAndRunMultipleServers(3)

    // Get the access tokens
    await setAccessTokensToServers(servers)

    const videoChannel = {
      name: 'my channel',
      description: 'super channel'
    }
    await addVideoChannel(servers[0].url, servers[0].accessToken, videoChannel)
    const channelRes = await getVideoChannelsList(servers[0].url, 0, 1)
    videoChannelId = channelRes.body.data[0].id

    // Server 1 and server 2 follow each other
    await doubleFollow(servers[0], servers[1])
    // Server 1 and server 3 follow each other
    await doubleFollow(servers[0], servers[2])
    // Server 2 and server 3 follow each other
    await doubleFollow(servers[1], servers[2])
  })

  it('Should not have videos for all servers', async function () {
    for (const server of servers) {
      const res = await getVideosList(server.url)
      const videos = res.body.data
      expect(videos).to.be.an('array')
      expect(videos.length).to.equal(0)
    }
  })

  describe('Should upload the video and propagate on each server', function () {
    it('Should upload the video on server 1 and propagate on each server', async function () {
      this.timeout(25000)

      const videoAttributes = {
        name: 'my super name for server 1',
        category: 5,
        licence: 4,
        language: 9,
        nsfw: true,
        description: 'my super description for server 1',
        tags: [ 'tag1p1', 'tag2p1' ],
        channelId: videoChannelId,
        fixture: 'video_short1.webm'
      }
      await uploadVideo(servers[0].url, servers[0].accessToken, videoAttributes)

      await wait(10000)

      // All servers should have this video
      for (const server of servers) {
        const isLocal = server.url === 'http://localhost:9001'
        const checkAttributes = {
          name: 'my super name for server 1',
          category: 5,
          licence: 4,
          language: 9,
          nsfw: true,
          description: 'my super description for server 1',
          host: 'localhost:9001',
          account: 'root',
          isLocal,
          duration: 10,
          tags: [ 'tag1p1', 'tag2p1' ],
          privacy: VideoPrivacy.PUBLIC,
          channel: {
            name: 'my channel',
            description: 'super channel',
            isLocal
          },
          fixture: 'video_short1.webm',
          files: [
            {
              resolution: 720,
              size: 572456
            }
          ]
        }

        const res = await getVideosList(server.url)
        const videos = res.body.data
        expect(videos).to.be.an('array')
        expect(videos.length).to.equal(1)
        const video = videos[0]

        await completeVideoCheck(server.url, video, checkAttributes)
      }
    })

    it('Should upload the video on server 2 and propagate on each server', async function () {
      this.timeout(50000)

      const user = {
        username: 'user1',
        password: 'super_password'
      }
      await createUser(servers[1].url, servers[1].accessToken, user.username, user.password)
      const userAccessToken = await userLogin(servers[1], user)

      const videoAttributes = {
        name: 'my super name for server 2',
        category: 4,
        licence: 3,
        language: 11,
        nsfw: true,
        description: 'my super description for server 2',
        tags: [ 'tag1p2', 'tag2p2', 'tag3p2' ],
        fixture: 'video_short2.webm'
      }
      await uploadVideo(servers[1].url, userAccessToken, videoAttributes)

      // Transcoding
      await wait(30000)

      // All servers should have this video
      for (const server of servers) {
        const isLocal = server.url === 'http://localhost:9002'
        const checkAttributes = {
          name: 'my super name for server 2',
          category: 4,
          licence: 3,
          language: 11,
          nsfw: true,
          description: 'my super description for server 2',
          host: 'localhost:9002',
          account: 'user1',
          isLocal,
          duration: 5,
          tags: [ 'tag1p2', 'tag2p2', 'tag3p2' ],
          privacy: VideoPrivacy.PUBLIC,
          channel: {
            name: 'Default user1 channel',
            description: 'super channel',
            isLocal
          },
          fixture: 'video_short2.webm',
          files: [
            {
              resolution: 240,
              size: 190000
            },
            {
              resolution: 360,
              size: 280000
            },
            {
              resolution: 480,
              size: 390000
            },
            {
              resolution: 720,
              size: 710000
            }
          ]
        }

        const res = await getVideosList(server.url)
        const videos = res.body.data
        expect(videos).to.be.an('array')
        expect(videos.length).to.equal(2)
        const video = videos[1]

        await completeVideoCheck(server.url, video, checkAttributes)
      }
    })

    it('Should upload two videos on server 3 and propagate on each server', async function () {
      this.timeout(45000)

      const videoAttributes1 = {
        name: 'my super name for server 3',
        category: 6,
        licence: 5,
        language: 11,
        nsfw: true,
        description: 'my super description for server 3',
        tags: [ 'tag1p3' ],
        fixture: 'video_short3.webm'
      }
      await uploadVideo(servers[2].url, servers[2].accessToken, videoAttributes1)

      const videoAttributes2 = {
        name: 'my super name for server 3-2',
        category: 7,
        licence: 6,
        language: 12,
        nsfw: false,
        description: 'my super description for server 3-2',
        tags: [ 'tag2p3', 'tag3p3', 'tag4p3' ],
        fixture: 'video_short.webm'
      }
      await uploadVideo(servers[2].url, servers[2].accessToken, videoAttributes2)

      await wait(10000)

      // All servers should have this video
      for (const server of servers) {
        const isLocal = server.url === 'http://localhost:9003'
        const res = await getVideosList(server.url)

        const videos = res.body.data
        expect(videos).to.be.an('array')
        expect(videos.length).to.equal(4)

        // We not sure about the order of the two last uploads
        let video1 = null
        let video2 = null
        if (videos[2].name === 'my super name for server 3') {
          video1 = videos[2]
          video2 = videos[3]
        } else {
          video1 = videos[3]
          video2 = videos[2]
        }

        const checkAttributesVideo1 = {
          name: 'my super name for server 3',
          category: 6,
          licence: 5,
          language: 11,
          nsfw: true,
          description: 'my super description for server 3',
          host: 'localhost:9003',
          account: 'root',
          isLocal,
          duration: 5,
          tags: [ 'tag1p3' ],
          privacy: VideoPrivacy.PUBLIC,
          channel: {
            name: 'Default root channel',
            description: '',
            isLocal
          },
          fixture: 'video_short3.webm',
          files: [
            {
              resolution: 720,
              size: 292677
            }
          ]
        }
        await completeVideoCheck(server.url, video1, checkAttributesVideo1)

        const checkAttributesVideo2 = {
          name: 'my super name for server 3-2',
          category: 7,
          licence: 6,
          language: 12,
          nsfw: false,
          description: 'my super description for server 3-2',
          host: 'localhost:9003',
          account: 'root',
          isLocal,
          duration: 5,
          tags: [ 'tag2p3', 'tag3p3', 'tag4p3' ],
          privacy: VideoPrivacy.PUBLIC,
          channel: {
            name: 'Default root channel',
            description: '',
            isLocal
          },
          fixture: 'video_short.webm',
          files: [
            {
              resolution: 720,
              size: 218910
            }
          ]
        }
        await completeVideoCheck(server.url, video2, checkAttributesVideo2)
      }
    })
  })

  describe('Should seed the uploaded video', function () {
    it('Should add the file 1 by asking server 3', async function () {
      this.timeout(10000)

      const res = await getVideosList(servers[2].url)

      const video = res.body.data[0]
      toRemove.push(res.body.data[2])
      toRemove.push(res.body.data[3])

      const res2 = await getVideo(servers[2].url, video.id)
      const videoDetails = res2.body

      const torrent = await webtorrentAdd(videoDetails.files[0].magnetUri, true)
      expect(torrent.files).to.be.an('array')
      expect(torrent.files.length).to.equal(1)
      expect(torrent.files[0].path).to.exist.and.to.not.equal('')
    })

    it('Should add the file 2 by asking server 1', async function () {
      this.timeout(10000)

      const res = await getVideosList(servers[0].url)

      const video = res.body.data[1]
      const res2 = await getVideo(servers[0].url, video.id)
      const videoDetails = res2.body

      const torrent = await webtorrentAdd(videoDetails.files[0].magnetUri, true)
      expect(torrent.files).to.be.an('array')
      expect(torrent.files.length).to.equal(1)
      expect(torrent.files[0].path).to.exist.and.to.not.equal('')
    })

    it('Should add the file 3 by asking server 2', async function () {
      this.timeout(10000)

      const res = await getVideosList(servers[1].url)

      const video = res.body.data[2]
      const res2 = await getVideo(servers[1].url, video.id)
      const videoDetails = res2.body

      const torrent = await webtorrentAdd(videoDetails.files[0].magnetUri, true)
      expect(torrent.files).to.be.an('array')
      expect(torrent.files.length).to.equal(1)
      expect(torrent.files[0].path).to.exist.and.to.not.equal('')
    })

    it('Should add the file 3-2 by asking server 1', async function () {
      this.timeout(10000)

      const res = await getVideosList(servers[0].url)

      const video = res.body.data[3]
      const res2 = await getVideo(servers[0].url, video.id)
      const videoDetails = res2.body

      const torrent = await webtorrentAdd(videoDetails.files[0].magnetUri)
      expect(torrent.files).to.be.an('array')
      expect(torrent.files.length).to.equal(1)
      expect(torrent.files[0].path).to.exist.and.to.not.equal('')
    })

    it('Should add the file 2 in 360p by asking server 1', async function () {
      this.timeout(10000)

      const res = await getVideosList(servers[0].url)

      const video = res.body.data.find(v => v.name === 'my super name for server 2')
      const res2 = await getVideo(servers[0].url, video.id)
      const videoDetails = res2.body

      const file = videoDetails.files.find(f => f.resolution === 360)
      expect(file).not.to.be.undefined

      const torrent = await webtorrentAdd(file.magnetUri)
      expect(torrent.files).to.be.an('array')
      expect(torrent.files.length).to.equal(1)
      expect(torrent.files[0].path).to.exist.and.to.not.equal('')
    })
  })

  describe('Should update video views, likes and dislikes', function () {
    let localVideosServer3 = []
    let remoteVideosServer1 = []
    let remoteVideosServer2 = []
    let remoteVideosServer3 = []

    before(async function () {
      const res1 = await getVideosList(servers[0].url)
      remoteVideosServer1 = res1.body.data.filter(video => video.isLocal === false).map(video => video.uuid)

      const res2 = await getVideosList(servers[1].url)
      remoteVideosServer2 = res2.body.data.filter(video => video.isLocal === false).map(video => video.uuid)

      const res3 = await getVideosList(servers[2].url)
      localVideosServer3 = res3.body.data.filter(video => video.isLocal === true).map(video => video.uuid)
      remoteVideosServer3 = res3.body.data.filter(video => video.isLocal === false).map(video => video.uuid)
    })

    it('Should view multiple videos on owned servers', async function () {
      this.timeout(10000)

      const tasks: Promise<any>[] = []
      tasks.push(viewVideo(servers[2].url, localVideosServer3[0]))
      tasks.push(viewVideo(servers[2].url, localVideosServer3[0]))
      tasks.push(viewVideo(servers[2].url, localVideosServer3[0]))
      tasks.push(viewVideo(servers[2].url, localVideosServer3[1]))

      await Promise.all(tasks)

      await wait(5000)

      for (const server of servers) {
        const res = await getVideosList(server.url)

        const videos = res.body.data
        const video0 = videos.find(v => v.uuid === localVideosServer3[0])
        const video1 = videos.find(v => v.uuid === localVideosServer3[1])

        expect(video0.views).to.equal(3)
        expect(video1.views).to.equal(1)
      }
    })

    it('Should view multiple videos on each servers', async function () {
      this.timeout(15000)

      const tasks: Promise<any>[] = []
      tasks.push(viewVideo(servers[0].url, remoteVideosServer1[0]))
      tasks.push(viewVideo(servers[1].url, remoteVideosServer2[0]))
      tasks.push(viewVideo(servers[1].url, remoteVideosServer2[0]))
      tasks.push(viewVideo(servers[2].url, remoteVideosServer3[0]))
      tasks.push(viewVideo(servers[2].url, remoteVideosServer3[1]))
      tasks.push(viewVideo(servers[2].url, remoteVideosServer3[1]))
      tasks.push(viewVideo(servers[2].url, remoteVideosServer3[1]))
      tasks.push(viewVideo(servers[2].url, localVideosServer3[1]))
      tasks.push(viewVideo(servers[2].url, localVideosServer3[1]))
      tasks.push(viewVideo(servers[2].url, localVideosServer3[1]))

      await Promise.all(tasks)

      await wait(10000)

      let baseVideos = null

      for (const server of servers) {
        const res = await getVideosList(server.url)

        const videos = res.body.data

        // Initialize base videos for future comparisons
        if (baseVideos === null) {
          baseVideos = videos
          continue
        }

        for (const baseVideo of baseVideos) {
          const sameVideo = videos.find(video => video.name === baseVideo.name)
          expect(baseVideo.views).to.equal(sameVideo.views)
        }
      }
    })

    it('Should like and dislikes videos on different services', async function () {
      this.timeout(20000)

      const tasks: Promise<any>[] = []
      tasks.push(rateVideo(servers[0].url, servers[0].accessToken, remoteVideosServer1[0], 'like'))
      tasks.push(rateVideo(servers[0].url, servers[0].accessToken, remoteVideosServer1[0], 'dislike'))
      tasks.push(rateVideo(servers[0].url, servers[0].accessToken, remoteVideosServer1[0], 'like'))
      tasks.push(rateVideo(servers[2].url, servers[2].accessToken, localVideosServer3[1], 'like'))
      tasks.push(rateVideo(servers[2].url, servers[2].accessToken, localVideosServer3[1], 'dislike'))
      tasks.push(rateVideo(servers[2].url, servers[2].accessToken, remoteVideosServer3[1], 'dislike'))
      tasks.push(rateVideo(servers[2].url, servers[2].accessToken, remoteVideosServer3[0], 'like'))

      await Promise.all(tasks)

      await wait(10000)

      let baseVideos = null
      for (const server of servers) {
        const res = await getVideosList(server.url)

        const videos = res.body.data

        // Initialize base videos for future comparisons
        if (baseVideos === null) {
          baseVideos = videos
          continue
        }

        for (const baseVideo of baseVideos) {
          const sameVideo = videos.find(video => video.name === baseVideo.name)
          expect(baseVideo.likes).to.equal(sameVideo.likes)
          expect(baseVideo.dislikes).to.equal(sameVideo.dislikes)
        }
      }
    })
  })

  describe('Should manipulate these videos', function () {
    it('Should update the video 3 by asking server 3', async function () {
      this.timeout(10000)

      const attributes = {
        name: 'my super video updated',
        category: 10,
        licence: 7,
        language: 13,
        nsfw: true,
        description: 'my super description updated',
        tags: [ 'tag_up_1', 'tag_up_2' ]
      }

      await updateVideo(servers[2].url, servers[2].accessToken, toRemove[0].id, attributes)

      await wait(5000)
    })

    it('Should have the video 3 updated on each server', async function () {
      this.timeout(10000)

      for (const server of servers) {
        const res = await getVideosList(server.url)

        const videos = res.body.data
        const videoUpdated = videos.find(video => video.name === 'my super video updated')
        expect(!!videoUpdated).to.be.true

        const isLocal = server.url === 'http://localhost:9003'
        const checkAttributes = {
          name: 'my super video updated',
          category: 10,
          licence: 7,
          language: 13,
          nsfw: true,
          description: 'my super description updated',
          host: 'localhost:9003',
          account: 'root',
          isLocal,
          duration: 5,
          tags: [ 'tag_up_1', 'tag_up_2' ],
          privacy: VideoPrivacy.PUBLIC,
          channel: {
            name: 'Default root channel',
            description: '',
            isLocal
          },
          fixture: 'video_short3.webm',
          files: [
            {
              resolution: 720,
              size: 292677
            }
          ]
        }
        await completeVideoCheck(server.url, videoUpdated, checkAttributes)
      }
    })

    it('Should remove the videos 3 and 3-2 by asking server 3', async function () {
      this.timeout(10000)

      await removeVideo(servers[2].url, servers[2].accessToken, toRemove[0].id)
      await removeVideo(servers[2].url, servers[2].accessToken, toRemove[1].id)

      await wait(5000)
    })

    it('Should have videos 1 and 3 on each server', async function () {
      for (const server of servers) {
        const res = await getVideosList(server.url)

        const videos = res.body.data
        expect(videos).to.be.an('array')
        expect(videos.length).to.equal(2)
        expect(videos[0].name).not.to.equal(videos[1].name)
        expect(videos[0].name).not.to.equal(toRemove[0].name)
        expect(videos[1].name).not.to.equal(toRemove[0].name)
        expect(videos[0].name).not.to.equal(toRemove[1].name)
        expect(videos[1].name).not.to.equal(toRemove[1].name)

        videoUUID = videos.find(video => video.name === 'my super name for server 1').uuid
      }
    })

    it('Should get the same video by UUID on each server', async function () {
      let baseVideo = null
      for (const server of servers) {
        const res = await getVideo(server.url, videoUUID)

        const video = res.body

        if (baseVideo === null) {
          baseVideo = video
          continue
        }

        expect(baseVideo.name).to.equal(video.name)
        expect(baseVideo.uuid).to.equal(video.uuid)
        expect(baseVideo.category).to.equal(video.category)
        expect(baseVideo.language).to.equal(video.language)
        expect(baseVideo.licence).to.equal(video.licence)
        expect(baseVideo.category).to.equal(video.category)
        expect(baseVideo.nsfw).to.equal(video.nsfw)
        expect(baseVideo.accountName).to.equal(video.accountName)
        expect(baseVideo.tags).to.deep.equal(video.tags)
      }
    })

    it('Should get the preview from each server', async function () {
      for (const server of servers) {
        const res = await getVideo(server.url, videoUUID)
        const video = res.body

        const test = await testVideoImage(server.url, 'video_short1-preview.webm', video.previewPath)
        expect(test).to.equal(true)
      }
    })
  })

  describe('Should comment these videos', function () {
    it('Should add comment (threads and replies)', async function () {
      this.timeout(25000)

      {
        const text = 'my super first comment'
        await addVideoCommentThread(servers[ 0 ].url, servers[ 0 ].accessToken, videoUUID, text)
      }

      {
        const text = 'my super second comment'
        await addVideoCommentThread(servers[ 2 ].url, servers[ 2 ].accessToken, videoUUID, text)
      }

      await wait(5000)

      {
        const res = await getVideoCommentThreads(servers[1].url, videoUUID, 0, 5)
        const threadId = res.body.data.find(c => c.text === 'my super first comment').id

        const text = 'my super answer to thread 1'
        await addVideoCommentReply(servers[ 1 ].url, servers[ 1 ].accessToken, videoUUID, threadId, text)
      }

      await wait(5000)

      {
        const res1 = await getVideoCommentThreads(servers[2].url, videoUUID, 0, 5)
        const threadId = res1.body.data.find(c => c.text === 'my super first comment').id

        const res2 = await getVideoThreadComments(servers[2].url, videoUUID, threadId)
        const childCommentId = res2.body.children[0].comment.id

        const text3 = 'my second answer to thread 1'
        await addVideoCommentReply(servers[ 2 ].url, servers[ 2 ].accessToken, videoUUID, threadId, text3)

        const text2 = 'my super answer to answer of thread 1'
        await addVideoCommentReply(servers[ 2 ].url, servers[ 2 ].accessToken, videoUUID, childCommentId, text2)
      }

      await wait(5000)
    })

    it('Should have these threads', async function () {
      for (const server of servers) {
        const res = await getVideoCommentThreads(server.url, videoUUID, 0, 5)

        expect(res.body.total).to.equal(2)
        expect(res.body.data).to.be.an('array')
        expect(res.body.data).to.have.lengthOf(2)

        {
          const comment: VideoComment = res.body.data.find(c => c.text === 'my super first comment')
          expect(comment).to.not.be.undefined
          expect(comment.inReplyToCommentId).to.be.null
          expect(comment.account.name).to.equal('root')
          expect(comment.account.host).to.equal('localhost:9001')
          expect(comment.totalReplies).to.equal(3)
          expect(dateIsValid(comment.createdAt as string)).to.be.true
          expect(dateIsValid(comment.updatedAt as string)).to.be.true
        }

        {
          const comment: VideoComment = res.body.data.find(c => c.text === 'my super second comment')
          expect(comment).to.not.be.undefined
          expect(comment.inReplyToCommentId).to.be.null
          expect(comment.account.name).to.equal('root')
          expect(comment.account.host).to.equal('localhost:9003')
          expect(comment.totalReplies).to.equal(0)
          expect(dateIsValid(comment.createdAt as string)).to.be.true
          expect(dateIsValid(comment.updatedAt as string)).to.be.true
        }
      }
    })

    it('Should have these comments', async function () {
      for (const server of servers) {
        const res1 = await getVideoCommentThreads(server.url, videoUUID, 0, 5)
        const threadId = res1.body.data.find(c => c.text === 'my super first comment').id

        const res2 = await getVideoThreadComments(server.url, videoUUID, threadId)

        const tree: VideoCommentThreadTree = res2.body
        expect(tree.comment.text).equal('my super first comment')
        expect(tree.comment.account.name).equal('root')
        expect(tree.comment.account.host).equal('localhost:9001')
        expect(tree.children).to.have.lengthOf(2)

        const firstChild = tree.children[0]
        expect(firstChild.comment.text).to.equal('my super answer to thread 1')
        expect(firstChild.comment.account.name).equal('root')
        expect(firstChild.comment.account.host).equal('localhost:9002')
        expect(firstChild.children).to.have.lengthOf(1)

        const childOfFirstChild = firstChild.children[0]
        expect(childOfFirstChild.comment.text).to.equal('my super answer to answer of thread 1')
        expect(childOfFirstChild.comment.account.name).equal('root')
        expect(childOfFirstChild.comment.account.host).equal('localhost:9003')
        expect(childOfFirstChild.children).to.have.lengthOf(0)

        const secondChild = tree.children[1]
        expect(secondChild.comment.text).to.equal('my second answer to thread 1')
        expect(secondChild.comment.account.name).equal('root')
        expect(secondChild.comment.account.host).equal('localhost:9003')
        expect(secondChild.children).to.have.lengthOf(0)
      }
    })
  })

  describe('With minimum parameters', function () {
    it('Should upload and propagate the video', async function () {
      this.timeout(50000)

      const path = '/api/v1/videos/upload'

      const req = request(servers[1].url)
        .post(path)
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer ' + servers[1].accessToken)
        .field('name', 'minimum parameters')
        .field('privacy', '1')
        .field('nsfw', 'false')
        .field('channelId', '1')

      const filePath = join(__dirname, '..', '..', 'api', 'fixtures', 'video_short.webm')

      await req.attach('videofile', filePath)
        .expect(200)

      await wait(25000)

      for (const server of servers) {
        const res = await getVideosList(server.url)
        const video = res.body.data.find(v => v.name === 'minimum parameters')

        const isLocal = server.url === 'http://localhost:9002'
        const checkAttributes = {
          name: 'minimum parameters',
          category: null,
          licence: null,
          language: null,
          nsfw: false,
          description: null,
          host: 'localhost:9002',
          account: 'root',
          isLocal,
          duration: 5,
          tags: [ ],
          privacy: VideoPrivacy.PUBLIC,
          channel: {
            name: 'Default root channel',
            description: '',
            isLocal
          },
          fixture: 'video_short.webm',
          files: [
            {
              resolution: 720,
              size: 40315
            },
            {
              resolution: 480,
              size: 22808
            },
            {
              resolution: 360,
              size: 18617
            },
            {
              resolution: 240,
              size: 15217
            }
          ]
        }
        await completeVideoCheck(server.url, video, checkAttributes)
      }
    })
  })

  after(async function () {
    killallServers(servers)

    // Keep the logs if the test failed
    if (this['ok']) {
      await flushTests()
    }
  })
})
