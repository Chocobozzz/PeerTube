/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  PeerTubeServer,
  PluginsCommand,
  setAccessTokensToServers
} from '@peertube/peertube-server-commands'
import { loginExternal } from '@tests/shared/plugins.js'
import { SQLCommand } from '@tests/shared/sql-command.js'
import { expect } from 'chai'

describe('Test external auth plugins with a stable external id', function () {
  let server: PeerTubeServer

  let terraId: number
  let terraToken: string

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])

    await server.plugins.install({ path: PluginsCommand.getPluginTestPath('-external-auth-four') })
  })

  it('Should create a new user using a stable external id', async function () {
    const body = await loginExternal({
      server,
      authName: 'external-auth-id-1',
      npmName: 'test-external-auth-four',
      username: 'terra',
      query: {
        username: 'terra',
        email: 'terra@example.com',
        externalId: 'terra-external-id'
      }
    })

    terraToken = body.access_token

    const me = await server.users.getMyInfo({ token: terraToken })
    terraId = me.id
    expect(me.username).to.equal('terra')
    expect(me.email).to.equal('terra@example.com')
  })

  it('Should reuse the same account and sync the email when it changes at the identity provider', async function () {
    const body = await loginExternal({
      server,
      authName: 'external-auth-id-1',
      npmName: 'test-external-auth-four',
      username: 'terra',
      query: {
        username: 'terra',
        email: 'terra-new@example.com',
        externalId: 'terra-external-id'
      }
    })

    terraToken = body.access_token

    const me = await server.users.getMyInfo({ token: terraToken })
    expect(me.id).to.equal(terraId)
    expect(me.email).to.equal('terra-new@example.com')
  })

  it('Should backfill the external id for an previously created account that did not have an externalId', async function () {
    const sqlCommand = new SQLCommand(server)

    await loginExternal({
      server,
      authName: 'external-auth-id-2',
      npmName: 'test-external-auth-four',
      username: 'luna',
      query: {
        username: 'luna',
        email: 'luna@example.com'
      }
    })

    expect(await sqlCommand.getUserExternalId('luna')).to.not.exist

    await loginExternal({
      server,
      authName: 'external-auth-id-2',
      npmName: 'test-external-auth-four',
      username: 'luna',
      query: {
        username: 'luna',
        email: 'luna@example.com',
        externalId: 'luna-external-id'
      }
    })

    expect(await sqlCommand.getUserExternalId('luna')).to.equal('luna-external-id')

    await sqlCommand.cleanup()
  })

  it('Should reject login when the account is already linked to a different external id for the same auth strategy', async function () {
    await loginExternal({
      server,
      authName: 'external-auth-id-1',
      npmName: 'test-external-auth-four',
      username: 'terra',
      query: {
        username: 'terra',
        email: 'terra-new@example.com',
        externalId: 'a-completely-different-external-id'
      },
      expectedStatusStep2: HttpStatusCode.BAD_REQUEST_400
    })
  })

  it('Should still allow login with the original external id after a rejected collision attempt', async function () {
    const body = await loginExternal({
      server,
      authName: 'external-auth-id-1',
      npmName: 'test-external-auth-four',
      username: 'terra',
      query: {
        username: 'terra',
        email: 'terra-new@example.com',
        externalId: 'terra-external-id'
      }
    })

    const me = await server.users.getMyInfo({ token: body.access_token })
    expect(me.id).to.equal(terraId)
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
