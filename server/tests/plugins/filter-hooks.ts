/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import {
  cleanupTests,
  flushAndRunMultipleServers,
  flushAndRunServer, killallServers, reRunServer,
  ServerInfo,
  waitUntilLog
} from '../../../shared/extra-utils/server/servers'
import {
  addVideoCommentReply,
  addVideoCommentThread, deleteVideoComment,
  getPluginTestPath, getVideosList,
  installPlugin, removeVideo,
  setAccessTokensToServers,
  updateVideo,
  uploadVideo,
  viewVideo,
  getVideosListPagination, getVideo
} from '../../../shared/extra-utils'

const expect = chai.expect

describe('Test plugin filter hooks', function () {
  let servers: ServerInfo[]
  let videoUUID: string
  let threadId: number

  before(async function () {
    this.timeout(30000)

    servers = await flushAndRunMultipleServers(2)
    await setAccessTokensToServers(servers)

    await installPlugin({
      url: servers[0].url,
      accessToken: servers[0].accessToken,
      path: getPluginTestPath()
    })

    await installPlugin({
      url: servers[0].url,
      accessToken: servers[0].accessToken,
      path: getPluginTestPath('-two')
    })

    for (let i = 0; i < 10; i++) {
      await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'default video ' + i })
    }

    const res = await getVideosList(servers[0].url)
    videoUUID = res.body.data[0].uuid
  })

  it('Should run filter:api.videos.list.params hook', async function () {
    const res = await getVideosListPagination(servers[0].url, 0, 2)

    // 2 plugins do +1 to the count parameter
    expect(res.body.data).to.have.lengthOf(4)
  })

  it('Should run filter:api.videos.list.result', async function () {
    const res = await getVideosListPagination(servers[0].url, 0, 0)

    // Plugin do +1 to the total result
    expect(res.body.total).to.equal(11)
  })

  it('Should run filter:api.video.get.result', async function () {
    const res = await getVideo(servers[0].url, videoUUID)

    expect(res.body.name).to.contain('<3')
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
