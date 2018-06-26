import 'mocha'

import {
  createUser,
  execCLI,
  flushTests,
  getEnvCli,
  killallServers,
  login,
  runServer,
  ServerInfo,
  setAccessTokensToServers
} from '../utils'

describe('Test reset password scripts', function () {
  let server: ServerInfo

  before(async function () {
    this.timeout(30000)

    await flushTests()
    server = await runServer(1)
    await setAccessTokensToServers([ server ])

    await createUser(server.url, server.accessToken, 'user_1', 'super password')
  })

  it('Should change the user password from CLI', async function () {
    this.timeout(60000)

    const env = getEnvCli(server)
    await execCLI(`echo coucou | ${env} npm run reset-password -- -u user_1`)

    await login(server.url, server.client, { username: 'user_1', password: 'coucou' }, 200)
  })

  after(async function () {
    killallServers([ server ])
  })
})
