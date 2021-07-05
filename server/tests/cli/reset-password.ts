import 'mocha'
import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'
import {
  cleanupTests,
  CLICommand,
  createUser,
  flushAndRunServer,
  login,
  ServerInfo,
  setAccessTokensToServers
} from '../../../shared/extra-utils'

describe('Test reset password scripts', function () {
  let server: ServerInfo

  before(async function () {
    this.timeout(30000)
    server = await flushAndRunServer(1)
    await setAccessTokensToServers([ server ])

    await createUser({ url: server.url, accessToken: server.accessToken, username: 'user_1', password: 'super password' })
  })

  it('Should change the user password from CLI', async function () {
    this.timeout(60000)

    const env = server.cliCommand.getEnv()
    await CLICommand.exec(`echo coucou | ${env} npm run reset-password -- -u user_1`)

    await login(server.url, server.client, { username: 'user_1', password: 'coucou' }, HttpStatusCode.OK_200)
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
