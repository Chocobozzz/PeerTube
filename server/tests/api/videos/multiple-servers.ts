/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import * as chai from 'chai'
import 'mocha'
import { join } from 'path'
import * as request from 'supertest'
import { VideoPrivacy } from '../../../../shared/models/videos'
import { VideoComment, VideoCommentThreadTree } from '../../../../shared/models/videos/video-comment.model'
import {
  addVideoChannel,
  checkTmpIsEmpty,
  checkVideoFilesWereRemoved,
  cleanupTests,
  completeVideoCheck,
  createUser,
  dateIsValid,
  doubleFollow,
  flushAndRunMultipleServers,
  getLocalVideos,
  getVideo,
  getVideoChannelsList,
  getVideosList,
  rateVideo,
  removeVideo,
  ServerInfo,
  setAccessTokensToServers,
  testImage,
  updateVideo,
  uploadVideo,
  userLogin,
  viewVideo,
  wait,
  webtorrentAdd
} from '../../../../shared/extra-utils'
import {
  addVideoCommentReply,
  addVideoCommentThread,
  deleteVideoComment,
  getVideoCommentThreads,
  getVideoThreadComments,
  findCommentId
} from '../../../../shared/extra-utils/videos/video-comments'
import { waitJobs } from '../../../../shared/extra-utils/server/jobs'

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

    {
      const videoChannel = {
        name: 'super_channel_name',
        displayName: 'my channel',
        description: 'super channel'
      }
      await addVideoChannel(servers[0].url, servers[0].accessToken, videoChannel)
      const channelRes = await getVideoChannelsList(servers[0].url, 0, 1)
      videoChannelId = channelRes.body.data[0].id
    }

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
        language: 'ja',
        nsfw: true,
        description: 'my super description for server 1',
        support: 'my super support text for server 1',
        originallyPublishedAt: '2019-02-10T13:38:14.449Z',
        tags: [ 'tag1p1', 'tag2p1' ],
        channelId: videoChannelId,
        fixture: 'video_short1.webm'
      }
      await uploadVideo(servers[0].url, servers[0].accessToken, videoAttributes)

      await waitJobs(servers)

      // All servers should have this video
      let publishedAt: string = null
      for (const server of servers) {
        const isLocal = server.port === servers[0].port
        const checkAttributes = {
          name: 'my super name for server 1',
          category: 5,
          licence: 4,
          language: 'ja',
          nsfw: true,
          description: 'my super description for server 1',
          support: 'my super support text for server 1',
          originallyPublishedAt: '2019-02-10T13:38:14.449Z',
          account: {
            name: 'root',
            host: 'localhost:' + servers[0].port
          },
          isLocal,
          publishedAt,
          duration: 10,
          tags: [ 'tag1p1', 'tag2p1' ],
          privacy: VideoPrivacy.PUBLIC,
          commentsEnabled: true,
          downloadEnabled: true,
          channel: {
            displayName: 'my channel',
            name: 'super_channel_name',
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
        publishedAt = video.publishedAt
      }
    })

    it('Should upload the video on server 2 and propagate on each server', async function () {
      this.timeout(50000)

      const user = {
        username: 'user1',
        password: 'super_password'
      }
      await createUser({ url: servers[1].url, accessToken: servers[1].accessToken, username: user.username, password: user.password })
      const userAccessToken = await userLogin(servers[1], user)

      const videoAttributes = {
        name: 'my super name for server 2',
        category: 4,
        licence: 3,
        language: 'de',
        nsfw: true,
        description: 'my super description for server 2',
        support: 'my super support text for server 2',
        tags: [ 'tag1p2', 'tag2p2', 'tag3p2' ],
        fixture: 'video_short2.webm',
        thumbnailfile: 'thumbnail.jpg',
        previewfile: 'preview.jpg'
      }
      await uploadVideo(servers[1].url, userAccessToken, videoAttributes)

      // Transcoding
      await waitJobs(servers)

      // All servers should have this video
      for (const server of servers) {
        const isLocal = server.url === 'http://localhost:' + servers[1].port
        const checkAttributes = {
          name: 'my super name for server 2',
          category: 4,
          licence: 3,
          language: 'de',
          nsfw: true,
          description: 'my super description for server 2',
          support: 'my super support text for server 2',
          account: {
            name: 'user1',
            host: 'localhost:' + servers[1].port
          },
          isLocal,
          commentsEnabled: true,
          downloadEnabled: true,
          duration: 5,
          tags: [ 'tag1p2', 'tag2p2', 'tag3p2' ],
          privacy: VideoPrivacy.PUBLIC,
          channel: {
            displayName: 'Main user1 channel',
            name: 'user1_channel',
            description: 'super channel',
            isLocal
          },
          fixture: 'video_short2.webm',
          files: [
            {
              resolution: 240,
              size: 189000
            },
            {
              resolution: 360,
              size: 278000
            },
            {
              resolution: 480,
              size: 384000
            },
            {
              resolution: 720,
              size: 706000
            }
          ],
          thumbnailfile: 'thumbnail',
          previewfile: 'preview'
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
        language: 'de',
        nsfw: true,
        description: 'my super description for server 3',
        support: 'my super support text for server 3',
        tags: [ 'tag1p3' ],
        fixture: 'video_short3.webm'
      }
      await uploadVideo(servers[2].url, servers[2].accessToken, videoAttributes1)

      const videoAttributes2 = {
        name: 'my super name for server 3-2',
        category: 7,
        licence: 6,
        language: 'ko',
        nsfw: false,
        description: 'my super description for server 3-2',
        support: 'my super support text for server 3-2',
        tags: [ 'tag2p3', 'tag3p3', 'tag4p3' ],
        fixture: 'video_short.webm'
      }
      await uploadVideo(servers[2].url, servers[2].accessToken, videoAttributes2)

      await waitJobs(servers)

      // All servers should have this video
      for (const server of servers) {
        const isLocal = server.url === 'http://localhost:' + servers[2].port
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
          language: 'de',
          nsfw: true,
          description: 'my super description for server 3',
          support: 'my super support text for server 3',
          account: {
            name: 'root',
            host: 'localhost:' + servers[2].port
          },
          isLocal,
          duration: 5,
          commentsEnabled: true,
          downloadEnabled: true,
          tags: [ 'tag1p3' ],
          privacy: VideoPrivacy.PUBLIC,
          channel: {
            displayName: 'Main root channel',
            name: 'root_channel',
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
          language: 'ko',
          nsfw: false,
          description: 'my super description for server 3-2',
          support: 'my super support text for server 3-2',
          account: {
            name: 'root',
            host: 'localhost:' + servers[2].port
          },
          commentsEnabled: true,
          downloadEnabled: true,
          isLocal,
          duration: 5,
          tags: [ 'tag2p3', 'tag3p3', 'tag4p3' ],
          privacy: VideoPrivacy.PUBLIC,
          channel: {
            displayName: 'Main root channel',
            name: 'root_channel',
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

  describe('It should list local videos', function () {
    it('Should list only local videos on server 1', async function () {
      const { body } = await getLocalVideos(servers[0].url)

      expect(body.total).to.equal(1)
      expect(body.data).to.be.an('array')
      expect(body.data.length).to.equal(1)
      expect(body.data[0].name).to.equal('my super name for server 1')
    })

    it('Should list only local videos on server 2', async function () {
      const { body } = await getLocalVideos(servers[1].url)

      expect(body.total).to.equal(1)
      expect(body.data).to.be.an('array')
      expect(body.data.length).to.equal(1)
      expect(body.data[0].name).to.equal('my super name for server 2')
    })

    it('Should list only local videos on server 3', async function () {
      const { body } = await getLocalVideos(servers[2].url)

      expect(body.total).to.equal(2)
      expect(body.data).to.be.an('array')
      expect(body.data.length).to.equal(2)
      expect(body.data[0].name).to.equal('my super name for server 3')
      expect(body.data[1].name).to.equal('my super name for server 3-2')
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

      const file = videoDetails.files.find(f => f.resolution.id === 360)
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
      this.timeout(30000)

      await viewVideo(servers[2].url, localVideosServer3[0])
      await wait(1000)

      await viewVideo(servers[2].url, localVideosServer3[0])
      await viewVideo(servers[2].url, localVideosServer3[1])

      await wait(1000)

      await viewVideo(servers[2].url, localVideosServer3[0])
      await viewVideo(servers[2].url, localVideosServer3[0])

      await waitJobs(servers)

      // Wait the repeatable job
      await wait(6000)

      await waitJobs(servers)

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
      this.timeout(45000)

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

      await waitJobs(servers)

      // Wait the repeatable job
      await wait(16000)

      await waitJobs(servers)

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

      await rateVideo(servers[0].url, servers[0].accessToken, remoteVideosServer1[0], 'like')
      await wait(500)
      await rateVideo(servers[0].url, servers[0].accessToken, remoteVideosServer1[0], 'dislike')
      await wait(500)
      await rateVideo(servers[0].url, servers[0].accessToken, remoteVideosServer1[0], 'like')
      await rateVideo(servers[2].url, servers[2].accessToken, localVideosServer3[1], 'like')
      await wait(500)
      await rateVideo(servers[2].url, servers[2].accessToken, localVideosServer3[1], 'dislike')
      await rateVideo(servers[2].url, servers[2].accessToken, remoteVideosServer3[1], 'dislike')
      await wait(500)
      await rateVideo(servers[2].url, servers[2].accessToken, remoteVideosServer3[0], 'like')

      await waitJobs(servers)

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
        language: 'fr',
        nsfw: true,
        description: 'my super description updated',
        support: 'my super support text updated',
        tags: [ 'tag_up_1', 'tag_up_2' ],
        thumbnailfile: 'thumbnail.jpg',
        originallyPublishedAt: '2019-02-11T13:38:14.449Z',
        previewfile: 'preview.jpg'
      }

      await updateVideo(servers[2].url, servers[2].accessToken, toRemove[0].id, attributes)

      await waitJobs(servers)
    })

    it('Should have the video 3 updated on each server', async function () {
      this.timeout(10000)

      for (const server of servers) {
        const res = await getVideosList(server.url)

        const videos = res.body.data
        const videoUpdated = videos.find(video => video.name === 'my super video updated')
        expect(!!videoUpdated).to.be.true

        const isLocal = server.url === 'http://localhost:' + servers[2].port
        const checkAttributes = {
          name: 'my super video updated',
          category: 10,
          licence: 7,
          language: 'fr',
          nsfw: true,
          description: 'my super description updated',
          support: 'my super support text updated',
          originallyPublishedAt: '2019-02-11T13:38:14.449Z',
          account: {
            name: 'root',
            host: 'localhost:' + servers[2].port
          },
          isLocal,
          duration: 5,
          commentsEnabled: true,
          downloadEnabled: true,
          tags: [ 'tag_up_1', 'tag_up_2' ],
          privacy: VideoPrivacy.PUBLIC,
          channel: {
            displayName: 'Main root channel',
            name: 'root_channel',
            description: '',
            isLocal
          },
          fixture: 'video_short3.webm',
          files: [
            {
              resolution: 720,
              size: 292677
            }
          ],
          thumbnailfile: 'thumbnail',
          previewfile: 'preview'
        }
        await completeVideoCheck(server.url, videoUpdated, checkAttributes)
      }
    })

    it('Should remove the videos 3 and 3-2 by asking server 3', async function () {
      this.timeout(10000)

      await removeVideo(servers[2].url, servers[2].accessToken, toRemove[0].id)
      await removeVideo(servers[2].url, servers[2].accessToken, toRemove[1].id)

      await waitJobs(servers)
    })

    it('Should not have files of videos 3 and 3-2 on each server', async function () {
      for (const server of servers) {
        await checkVideoFilesWereRemoved(toRemove[0].uuid, server.internalServerNumber)
        await checkVideoFilesWereRemoved(toRemove[1].uuid, server.internalServerNumber)
      }
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
        expect(baseVideo.category.id).to.equal(video.category.id)
        expect(baseVideo.language.id).to.equal(video.language.id)
        expect(baseVideo.licence.id).to.equal(video.licence.id)
        expect(baseVideo.nsfw).to.equal(video.nsfw)
        expect(baseVideo.account.name).to.equal(video.account.name)
        expect(baseVideo.account.displayName).to.equal(video.account.displayName)
        expect(baseVideo.account.url).to.equal(video.account.url)
        expect(baseVideo.account.host).to.equal(video.account.host)
        expect(baseVideo.tags).to.deep.equal(video.tags)
      }
    })

    it('Should get the preview from each server', async function () {
      for (const server of servers) {
        const res = await getVideo(server.url, videoUUID)
        const video = res.body

        await testImage(server.url, 'video_short1-preview.webm', video.previewPath)
      }
    })
  })

  describe('Should comment these videos', function () {
    let childOfFirstChild: VideoCommentThreadTree

    it('Should add comment (threads and replies)', async function () {
      this.timeout(25000)

      {
        const text = 'my super first comment'
        await addVideoCommentThread(servers[0].url, servers[0].accessToken, videoUUID, text)
      }

      {
        const text = 'my super second comment'
        await addVideoCommentThread(servers[2].url, servers[2].accessToken, videoUUID, text)
      }

      await waitJobs(servers)

      {
        const threadId = await findCommentId(servers[1].url, videoUUID, 'my super first comment')

        const text = 'my super answer to thread 1'
        await addVideoCommentReply(servers[1].url, servers[1].accessToken, videoUUID, threadId, text)
      }

      await waitJobs(servers)

      {
        const threadId = await findCommentId(servers[2].url, videoUUID, 'my super first comment')

        const res2 = await getVideoThreadComments(servers[2].url, videoUUID, threadId)
        const childCommentId = res2.body.children[0].comment.id

        const text3 = 'my second answer to thread 1'
        await addVideoCommentReply(servers[2].url, servers[2].accessToken, videoUUID, threadId, text3)

        const text2 = 'my super answer to answer of thread 1'
        await addVideoCommentReply(servers[2].url, servers[2].accessToken, videoUUID, childCommentId, text2)
      }

      await waitJobs(servers)
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
          expect(comment.account.host).to.equal('localhost:' + servers[0].port)
          expect(comment.totalReplies).to.equal(3)
          expect(dateIsValid(comment.createdAt as string)).to.be.true
          expect(dateIsValid(comment.updatedAt as string)).to.be.true
        }

        {
          const comment: VideoComment = res.body.data.find(c => c.text === 'my super second comment')
          expect(comment).to.not.be.undefined
          expect(comment.inReplyToCommentId).to.be.null
          expect(comment.account.name).to.equal('root')
          expect(comment.account.host).to.equal('localhost:' + servers[2].port)
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
        expect(tree.comment.account.host).equal('localhost:' + servers[0].port)
        expect(tree.children).to.have.lengthOf(2)

        const firstChild = tree.children[0]
        expect(firstChild.comment.text).to.equal('my super answer to thread 1')
        expect(firstChild.comment.account.name).equal('root')
        expect(firstChild.comment.account.host).equal('localhost:' + servers[1].port)
        expect(firstChild.children).to.have.lengthOf(1)

        childOfFirstChild = firstChild.children[0]
        expect(childOfFirstChild.comment.text).to.equal('my super answer to answer of thread 1')
        expect(childOfFirstChild.comment.account.name).equal('root')
        expect(childOfFirstChild.comment.account.host).equal('localhost:' + servers[2].port)
        expect(childOfFirstChild.children).to.have.lengthOf(0)

        const secondChild = tree.children[1]
        expect(secondChild.comment.text).to.equal('my second answer to thread 1')
        expect(secondChild.comment.account.name).equal('root')
        expect(secondChild.comment.account.host).equal('localhost:' + servers[2].port)
        expect(secondChild.children).to.have.lengthOf(0)
      }
    })

    it('Should delete a reply', async function () {
      this.timeout(10000)

      await deleteVideoComment(servers[2].url, servers[2].accessToken, videoUUID, childOfFirstChild.comment.id)

      await waitJobs(servers)
    })

    it('Should have this comment marked as deleted', async function () {
      for (const server of servers) {
        const res1 = await getVideoCommentThreads(server.url, videoUUID, 0, 5)
        const threadId = res1.body.data.find(c => c.text === 'my super first comment').id

        const res2 = await getVideoThreadComments(server.url, videoUUID, threadId)

        const tree: VideoCommentThreadTree = res2.body
        expect(tree.comment.text).equal('my super first comment')

        const firstChild = tree.children[0]
        expect(firstChild.comment.text).to.equal('my super answer to thread 1')
        expect(firstChild.children).to.have.lengthOf(1)

        const deletedComment = firstChild.children[0].comment
        expect(deletedComment.isDeleted).to.be.true
        expect(deletedComment.deletedAt).to.not.be.null
        expect(deletedComment.account).to.be.null
        expect(deletedComment.text).to.equal('')

        const secondChild = tree.children[1]
        expect(secondChild.comment.text).to.equal('my second answer to thread 1')
      }
    })

    it('Should delete the thread comments', async function () {
      this.timeout(10000)

      const res = await getVideoCommentThreads(servers[0].url, videoUUID, 0, 5)
      const threadId = res.body.data.find(c => c.text === 'my super first comment').id
      await deleteVideoComment(servers[0].url, servers[0].accessToken, videoUUID, threadId)

      await waitJobs(servers)
    })

    it('Should have the threads marked as deleted on other servers too', async function () {
      for (const server of servers) {
        const res = await getVideoCommentThreads(server.url, videoUUID, 0, 5)

        expect(res.body.total).to.equal(2)
        expect(res.body.data).to.be.an('array')
        expect(res.body.data).to.have.lengthOf(2)

        {
          const comment: VideoComment = res.body.data[0]
          expect(comment).to.not.be.undefined
          expect(comment.inReplyToCommentId).to.be.null
          expect(comment.account.name).to.equal('root')
          expect(comment.account.host).to.equal('localhost:' + servers[2].port)
          expect(comment.totalReplies).to.equal(0)
          expect(dateIsValid(comment.createdAt as string)).to.be.true
          expect(dateIsValid(comment.updatedAt as string)).to.be.true
        }

        {
          const deletedComment: VideoComment = res.body.data[1]
          expect(deletedComment).to.not.be.undefined
          expect(deletedComment.isDeleted).to.be.true
          expect(deletedComment.deletedAt).to.not.be.null
          expect(deletedComment.text).to.equal('')
          expect(deletedComment.inReplyToCommentId).to.be.null
          expect(deletedComment.account).to.be.null
          expect(deletedComment.totalReplies).to.equal(3)
          expect(dateIsValid(deletedComment.createdAt as string)).to.be.true
          expect(dateIsValid(deletedComment.updatedAt as string)).to.be.true
          expect(dateIsValid(deletedComment.deletedAt as string)).to.be.true
        }
      }
    })

    it('Should delete a remote thread by the origin server', async function () {
      this.timeout(5000)

      const res = await getVideoCommentThreads(servers[0].url, videoUUID, 0, 5)
      const threadId = res.body.data.find(c => c.text === 'my super second comment').id
      await deleteVideoComment(servers[0].url, servers[0].accessToken, videoUUID, threadId)

      await waitJobs(servers)
    })

    it('Should have the threads marked as deleted on other servers too', async function () {
      for (const server of servers) {
        const res = await getVideoCommentThreads(server.url, videoUUID, 0, 5)

        expect(res.body.total).to.equal(2)
        expect(res.body.data).to.have.lengthOf(2)

        {
          const comment: VideoComment = res.body.data[0]
          expect(comment.text).to.equal('')
          expect(comment.isDeleted).to.be.true
          expect(comment.createdAt).to.not.be.null
          expect(comment.deletedAt).to.not.be.null
          expect(comment.account).to.be.null
          expect(comment.totalReplies).to.equal(0)
        }

        {
          const comment: VideoComment = res.body.data[1]
          expect(comment.text).to.equal('')
          expect(comment.isDeleted).to.be.true
          expect(comment.createdAt).to.not.be.null
          expect(comment.deletedAt).to.not.be.null
          expect(comment.account).to.be.null
          expect(comment.totalReplies).to.equal(3)
        }
      }
    })

    it('Should disable comments and download', async function () {
      this.timeout(20000)

      const attributes = {
        commentsEnabled: false,
        downloadEnabled: false
      }

      await updateVideo(servers[0].url, servers[0].accessToken, videoUUID, attributes)

      await waitJobs(servers)

      for (const server of servers) {
        const res = await getVideo(server.url, videoUUID)
        expect(res.body.commentsEnabled).to.be.false
        expect(res.body.downloadEnabled).to.be.false

        const text = 'my super forbidden comment'
        await addVideoCommentThread(server.url, server.accessToken, videoUUID, text, 409)
      }
    })
  })

  describe('With minimum parameters', function () {
    it('Should upload and propagate the video', async function () {
      this.timeout(60000)

      const path = '/api/v1/videos/upload'

      const req = request(servers[1].url)
        .post(path)
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer ' + servers[1].accessToken)
        .field('name', 'minimum parameters')
        .field('privacy', '1')
        .field('channelId', '1')

      const filePath = join(__dirname, '..', '..', 'fixtures', 'video_short.webm')

      await req.attach('videofile', filePath)
               .expect(200)

      await waitJobs(servers)

      for (const server of servers) {
        const res = await getVideosList(server.url)
        const video = res.body.data.find(v => v.name === 'minimum parameters')

        const isLocal = server.url === 'http://localhost:' + servers[1].port
        const checkAttributes = {
          name: 'minimum parameters',
          category: null,
          licence: null,
          language: null,
          nsfw: false,
          description: null,
          support: null,
          account: {
            name: 'root',
            host: 'localhost:' + servers[1].port
          },
          isLocal,
          duration: 5,
          commentsEnabled: true,
          downloadEnabled: true,
          tags: [],
          privacy: VideoPrivacy.PUBLIC,
          channel: {
            displayName: 'Main root channel',
            name: 'root_channel',
            description: '',
            isLocal
          },
          fixture: 'video_short.webm',
          files: [
            {
              resolution: 720,
              size: 72000
            },
            {
              resolution: 480,
              size: 45000
            },
            {
              resolution: 360,
              size: 34600
            },
            {
              resolution: 240,
              size: 24770
            }
          ]
        }
        await completeVideoCheck(server.url, video, checkAttributes)
      }
    })
  })

  describe('TMP directory', function () {
    it('Should have an empty tmp directory', async function () {
      for (const server of servers) {
        await checkTmpIsEmpty(server)
      }
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
