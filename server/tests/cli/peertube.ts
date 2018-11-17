import 'mocha'
import {
  expect
} from 'chai'
import {
  createUser,
  execCLI,
  flushTests,
  getEnvCli,
  killallServers,
  runServer,
  ServerInfo,
  setAccessTokensToServers
} from '../utils'

describe('Test CLI wrapper', function () {
  let server: ServerInfo
  const cmd = 'node ./dist/server/tools/peertube.js'

  before(async function () {
    this.timeout(30000)

    await flushTests()
    server = await runServer(1)
    await setAccessTokensToServers([ server ])

    await createUser(server.url, server.accessToken, 'user_1', 'super password')
  })

  it('Should display no selected instance', async function () {
    this.timeout(60000)

    const env = getEnvCli(server)
    const stdout = await execCLI(`${env} ${cmd} --help`)

    expect(stdout).to.contain('selected')
  })

  it('Should remember the authentifying material of the user', async function () {
    this.timeout(60000)

    const env = getEnvCli(server)
    await execCLI(`${env} ` + cmd + ` auth add --url ${server.url} -U user_1 -p "super password"`)
  })

  after(async function () {
    this.timeout(10000)

    await execCLI(cmd + ` auth del ${server.url}`)

    killallServers([ server ])
  })
})
