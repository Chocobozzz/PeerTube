import { cleanupTests, CLICommand, createSingleServer, PeerTubeServer, setAccessTokensToServers } from '@peertube/peertube-server-commands'

describe('Test reset password CLI', function () {
  let server: PeerTubeServer

  before(async function () {
    this.timeout(30000)
    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])

    await server.users.create({ username: 'user_1', password: 'super password' })
  })

  it('Should change the user password from CLI', async function () {
    this.timeout(60000)

    const env = server.cli.getEnv()
    await CLICommand.exec(`echo coucou | ${env} npm run reset-password -- -u user_1`)

    await server.login.login({ user: { username: 'user_1', password: 'coucou' } })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
