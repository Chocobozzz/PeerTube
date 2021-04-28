/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'

import { cleanupTests, flushAndRunServer, ServerInfo } from '../../../../shared/extra-utils'
import { getActor } from '../../../../shared/extra-utils/actors/actors'
import { HttpStatusCode } from '../../../../shared/core-utils/miscs/http-error-codes'

describe('Test actors API validators', function () {
  let server: ServerInfo

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)
  })

  describe('When getting an actor', function () {
    it('Should return 404 with a non existing actorName', async function () {
      await getActor(server.url, 'arfaze', HttpStatusCode.NOT_FOUND_404)
    })

    it('Should return 200 with an existing accountName', async function () {
      await getActor(server.url, 'root', HttpStatusCode.OK_200)
    })

    it('Should return 200 with an existing channelName', async function () {
      await getActor(server.url, 'root_channel', HttpStatusCode.OK_200)
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
