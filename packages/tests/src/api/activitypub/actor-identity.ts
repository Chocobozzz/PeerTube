/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { buildAbsoluteFixturePath } from '@peertube/peertube-node-utils'
import {
  PeerTubeServer,
  cleanupTests,
  createMultipleServers,
  makeActivityPubGetRequest,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'
import {
  activityPubContextify,
  buildGlobalHTTPHeaders,
  getAPPublicValue
} from '@peertube/peertube-server/core/helpers/activity-pub-utils.js'
import { buildDigest } from '@peertube/peertube-server/core/helpers/peertube-crypto.js'
import { ACTIVITY_PUB, HTTP_SIGNATURE } from '@peertube/peertube-server/core/initializers/constants.js'
import { makePOSTAPRequest } from '@tests/shared/requests.js'
import { SQLCommand } from '@tests/shared/sql-command.js'
import { expect } from 'chai'
import { readJsonSync } from 'fs-extra/esm'

function fakeFilter () {
  return (data: any) => Promise.resolve(data)
}

function setKeysOfServer (onServer: SQLCommand, ofServerUrl: string, publicKey: string, privateKey: string) {
  const url = ofServerUrl + '/accounts/peertube'

  return Promise.all([
    onServer.setActorField(url, 'publicKey', publicKey),
    onServer.setActorField(url, 'privateKey', privateKey)
  ])
}

describe('Test ActivityPub actor identity binding', function () {
  let servers: PeerTubeServer[]
  let sqlCommands: SQLCommand[] = []

  let inboxUrl: string
  let remoteActorUrl: string
  let remoteActorObject: any

  const keys = readJsonSync(buildAbsoluteFixturePath('./ap-json/peertube/keys.json'))

  function buildHttpSignature () {
    return {
      keyId: remoteActorUrl,
      key: keys.privateKey,
      headers: HTTP_SIGNATURE.HEADERS_TO_SIGN_WITH_PAYLOAD
    }
  }

  // Send an "Update" of the remote actor, signed by that same remote actor
  async function sendActorUpdate (actorObject: any) {
    const activity = {
      type: 'Update',
      id: remoteActorUrl + '/updates/' + new Date().toISOString(),
      actor: remoteActorUrl,
      to: [ getAPPublicValue() ],
      object: actorObject
    }

    const body = await activityPubContextify(activity, 'Actor', fakeFilter())
    const headers = {
      ...buildGlobalHTTPHeaders(body, buildDigest),

      'content-type': 'application/activity+json',
      'accept': ACTIVITY_PUB.ACCEPT_HEADER
    }

    try {
      const { statusCode } = await makePOSTAPRequest(inboxUrl, body, buildHttpSignature(), headers)

      return { rejected: false, statusCode }
    } catch (err) {
      return { rejected: true, statusCode: err.statusCode as number }
    }
  }

  // Load the cached actor of servers[1] on servers[0] using its server association, so we detect a rebound URL
  async function getCachedRemoteActor () {
    const query = 'SELECT a."url", a."publicKey", a."serverId" FROM "actor" a ' +
      'INNER JOIN "server" s ON s."id" = a."serverId" ' +
      'WHERE s."host" = :host AND a."preferredUsername" = :preferredUsername'

    const [ row ] = await sqlCommands[0].selectQuery<{ url: string, publicKey: string, serverId: number }>(query, {
      host: servers[1].host,
      preferredUsername: 'peertube'
    })

    return row
  }

  before(async function () {
    this.timeout(120000)

    servers = await createMultipleServers(2)
    await setAccessTokensToServers(servers)

    sqlCommands = servers.map(s => new SQLCommand(s))

    inboxUrl = servers[0].url + '/inbox'
    remoteActorUrl = servers[1].url + '/accounts/peertube'

    // Use a known key pair so we can sign activities on behalf of the servers[1] instance actor.
    // It must be done before servers[0] fetches and caches that actor
    await setKeysOfServer(sqlCommands[1], servers[1].url, keys.publicKey, keys.privateKey)

    await servers[0].follows.follow({ hosts: [ servers[1].url ] })
    await waitJobs(servers)

    const { body } = await makeActivityPubGetRequest(servers[1].url, '/accounts/peertube')
    remoteActorObject = body
  })

  it('Should have cached the remote actor', async function () {
    const actor = await getCachedRemoteActor()

    expect(actor).to.exist
    expect(actor.url).to.equal(remoteActorUrl)
    expect(actor.publicKey).to.equal(keys.publicKey)
    expect(actor.serverId).to.not.be.null
  })

  it('Should not rebind the actor URL/public key to our own host', async function () {
    this.timeout(30000)

    const forgedUrl = servers[0].url + '/accounts/hijacked'
    const otherKeys = readJsonSync(buildAbsoluteFixturePath('./ap-json/peertube/invalid-keys.json'))

    await sendActorUpdate({
      ...remoteActorObject,

      id: forgedUrl,
      publicKey: { id: forgedUrl + '#main-key', owner: forgedUrl, publicKeyPem: otherKeys.publicKey }
    })

    await waitJobs(servers)

    const actor = await getCachedRemoteActor()
    expect(actor.url).to.equal(remoteActorUrl)
    expect(actor.publicKey).to.equal(keys.publicKey)
    expect(actor.serverId).to.not.be.null
  })

  it('Should not update another actor of the same host', async function () {
    this.timeout(30000)

    const otherUrl = servers[1].url + '/accounts/root'

    await sendActorUpdate({
      ...remoteActorObject,

      id: otherUrl,
      publicKey: { id: otherUrl + '#main-key', owner: otherUrl, publicKeyPem: keys.publicKey }
    })

    await waitJobs(servers)

    const actor = await getCachedRemoteActor()
    expect(actor.url).to.equal(remoteActorUrl)
  })

  it('Should not accept an actor whose public key is owned by another identity', async function () {
    this.timeout(30000)

    const otherKeys = readJsonSync(buildAbsoluteFixturePath('./ap-json/peertube/invalid-keys.json'))

    await sendActorUpdate({
      ...remoteActorObject,

      publicKey: {
        id: remoteActorUrl + '#main-key',
        owner: servers[0].url + '/accounts/peertube',
        publicKeyPem: otherKeys.publicKey
      }
    })

    await waitJobs(servers)

    const actor = await getCachedRemoteActor()
    expect(actor.url).to.equal(remoteActorUrl)
    expect(actor.publicKey).to.equal(keys.publicKey)
  })

  it('Should still accept a valid actor update', async function () {
    this.timeout(30000)

    await sendActorUpdate({
      ...remoteActorObject,

      name: 'updated display name'
    })

    await waitJobs(servers)

    const account = await servers[0].accounts.get({ accountName: 'peertube@' + servers[1].host })
    expect(account.displayName).to.equal('updated display name')

    const actor = await getCachedRemoteActor()
    expect(actor.url).to.equal(remoteActorUrl)
  })

  after(async function () {
    for (const sqlCommand of sqlCommands) {
      await sqlCommand.cleanup()
    }

    await cleanupTests(servers)
  })
})
