/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { buildAbsoluteFixturePath } from '@peertube/peertube-node-utils'
import { HttpStatusCode } from '@peertube/peertube-models'
import { PeerTubeServer, cleanupTests, createSingleServer, setAccessTokensToServers, waitJobs } from '@peertube/peertube-server-commands'
import { getAPPublicValue } from '@peertube/peertube-server/core/helpers/activity-pub-utils.js'
import { getPort, randomListen, terminateServer } from '@tests/shared/mock-servers/shared.js'
import { makeSignedPOSTAPRequest } from '@tests/shared/requests.js'
import { SQLCommand } from '@tests/shared/sql-command.js'
import { expect } from 'chai'
import express from 'express'
import { readJsonSync } from 'fs-extra/esm'
import { Server } from 'http'

describe('Test ActivityPub fetch redirections', function () {
  let server: PeerTubeServer
  let sqlCommand: SQLCommand

  let originServer: Server
  let attackerServer: Server
  let originUrl: string
  let attackerUrl: string

  const keys = readJsonSync(buildAbsoluteFixturePath('./ap-json/peertube/keys.json'))

  function buildActor (id: string) {
    return {
      type: 'Person',
      id,
      preferredUsername: 'redirected',
      inbox: id + '/inbox',
      publicKey: {
        id: id + '#main-key',
        owner: id,
        publicKeyPem: keys.publicKey
      }
    }
  }

  async function sendActorUpdate (options: {
    keyId: string
    actorUrl: string
  }) {
    const { keyId, actorUrl } = options

    const activity = {
      type: 'Update',
      id: actorUrl + '/updates/' + new Date().toISOString(),
      actor: actorUrl,
      to: [ getAPPublicValue() ],
      object: buildActor(actorUrl)
    }

    try {
      const { statusCode } = await makeSignedPOSTAPRequest({
        url: server.url + '/inbox',
        activity,
        contextType: 'Actor',
        keyId,
        privateKey: keys.privateKey
      })

      return statusCode
    } catch (err) {
      return err.statusCode as number
    }
  }

  before(async function () {
    this.timeout(120000)

    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])

    sqlCommand = new SQLCommand(server)

    const app = express()

    app.get('/actors/spoofed', (req, res) => {
      if (req.socket.localPort === getPort(originServer)) {
        return res.redirect(attackerUrl + '/actors/spoofed')
      }

      return res.type('application/activity+json').send(buildActor(originUrl + '/actors/spoofed'))
    })

    app.get('/actors/alias', (req, res) => res.redirect(originUrl + '/actors/real'))
    app.get('/actors/real', (req, res) => res.type('application/activity+json').send(buildActor(originUrl + '/actors/real')))

    originServer = await randomListen(app)
    attackerServer = await randomListen(app)

    originUrl = 'http://127.0.0.1:' + getPort(originServer)
    attackerUrl = 'http://127.0.0.1:' + getPort(attackerServer)
  })

  it('Should not accept an actor served by another host after a redirection', async function () {
    this.timeout(30000)

    const actorUrl = originUrl + '/actors/spoofed'

    const statusCode = await sendActorUpdate({ keyId: actorUrl, actorUrl })
    expect(statusCode).to.equal(HttpStatusCode.FORBIDDEN_403)

    await waitJobs([ server ])

    expect(await sqlCommand.countActorsByUrl(actorUrl)).to.equal(0)
  })

  it('Should still follow a redirection on the same host', async function () {
    this.timeout(30000)

    const actorUrl = originUrl + '/actors/real'

    const statusCode = await sendActorUpdate({ keyId: originUrl + '/actors/alias', actorUrl })
    expect(statusCode).to.equal(HttpStatusCode.NO_CONTENT_204)

    await waitJobs([ server ])

    expect(await sqlCommand.countActorsByUrl(actorUrl)).to.equal(1)
  })

  after(async function () {
    await sqlCommand.cleanup()

    await terminateServer(originServer)
    await terminateServer(attackerServer)

    await cleanupTests([ server ])
  })
})
