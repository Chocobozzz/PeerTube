import { VideoChannel } from '@shared/models'
import { expect } from 'chai'
import 'mocha'

import {
  addVideoChannel,
  cleanupTests,
  createUser,
  doubleFollow,
  execCLI,
  flushAndRunMultipleServers,
  getAccountVideoChannelsList,
  getEnvCli,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideo,
  userLogin,
  waitJobs
} from '../../../shared/extra-utils'

describe('Test transfer channel scripts', function () {
  let servers: ServerInfo[]
  const user1 = { username: 'user_1', password: 'super password' }
  const user2 = { username: 'user_2', password: 'super password' }
  let user1Token

  before(async function () {
    this.timeout(30000)
    servers = await flushAndRunMultipleServers(2)
    await setAccessTokensToServers(servers)

    await doubleFollow(servers[0], servers[1])

    await createUser({ url: servers[0].url, accessToken: servers[0].accessToken, ...user1 })
    await createUser({ url: servers[0].url, accessToken: servers[0].accessToken, ...user2 })
    user1Token = await userLogin(servers[0], user1)

    const videoChannel = {
      name: 'test_channel',
      displayName: 'test video channel for transfer',
      description: 'super video channel description',
      support: 'super video channel support text'
    }
    const res = await addVideoChannel(servers[0].url, user1Token, videoChannel)
    const channelId = res.body.videoChannel.id

    await uploadVideo(servers[0].url, user1Token, { name: 'test video for transfer', channelId })
    await waitJobs(servers)
  })

  it('Should transfer a channel from user 1 to user 2 from CLI', async function () {
    this.timeout(60000)

    const env = getEnvCli(servers[0])
    await execCLI(`${env} npm run transfer-channel -- test_channel --from=user_1 --to=user_2`)

    const res1 = await getAccountVideoChannelsList({
      url: servers[0].url,
      accountName: 'user_2@' + servers[0].host,
      sort: '-updatedAt'
    })
    const channels: VideoChannel[] = res1.body.data
    expect(channels[0].name).to.equal('test_channel')
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
