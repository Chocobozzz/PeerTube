/* tslint:disable:no-unused-expression */

import 'mocha'
import {
  doubleFollow,
  flushAndRunMultipleServers,
  getVideo,
  killallServers,
  reRunServer,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideo,
  wait,
  setVideoField,
  waitJobs
} from '../../../../shared/utils'

describe('Test AP refresher', function () {
  let servers: ServerInfo[] = []
  let videoUUID1: string
  let videoUUID2: string
  let videoUUID3: string

  before(async function () {
    this.timeout(60000)

    servers = await flushAndRunMultipleServers(2)

    // Get the access tokens
    await setAccessTokensToServers(servers)

    {
      const res = await uploadVideo(servers[1].url, servers[1].accessToken, { name: 'video1' })
      videoUUID1 = res.body.video.uuid
    }

    {
      const res = await uploadVideo(servers[1].url, servers[1].accessToken, { name: 'video2' })
      videoUUID2 = res.body.video.uuid
    }

    {
      const res = await uploadVideo(servers[1].url, servers[1].accessToken, { name: 'video3' })
      videoUUID3 = res.body.video.uuid
    }

    await doubleFollow(servers[0], servers[1])
  })

  it('Should remove a deleted remote video', async function () {
    this.timeout(60000)

    await wait(10000)

    // Change UUID so the remote server returns a 404
    await setVideoField(2, videoUUID1, 'uuid', '304afe4f-39f9-4d49-8ed7-ac57b86b174f')

    await getVideo(servers[0].url, videoUUID1)
    await getVideo(servers[0].url, videoUUID2)

    await waitJobs(servers)

    await getVideo(servers[0].url, videoUUID1, 404)
    await getVideo(servers[0].url, videoUUID2, 200)
  })

  it('Should not update a remote video if the remote instance is down', async function () {
    this.timeout(60000)

    killallServers([ servers[1] ])

    await setVideoField(2, videoUUID3, 'uuid', '304afe4f-39f9-4d49-8ed7-ac57b86b174e')

    // Video will need a refresh
    await wait(10000)

    await getVideo(servers[0].url, videoUUID3)
    // The refresh should fail
    await waitJobs([ servers[0] ])

    await reRunServer(servers[1])

    // Should not refresh the video, even if the last refresh failed (to avoir a loop on dead instances)
    await getVideo(servers[0].url, videoUUID3)
    await waitJobs(servers)

    await getVideo(servers[0].url, videoUUID3, 200)
  })

  after(async function () {
    killallServers(servers)
  })
})
