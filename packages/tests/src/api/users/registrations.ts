/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { MockSmtpServer } from '@tests/shared/mock-servers/index.js'
import { UserRegistrationState, UserRole } from '@peertube/peertube-models'
import {
  cleanupTests,
  ConfigCommand,
  createSingleServer,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'

describe('Test registrations', function () {
  let server: PeerTubeServer

  const emails: object[] = []
  let emailPort: number

  before(async function () {
    this.timeout(30000)

    emailPort = await MockSmtpServer.Instance.collectEmails(emails)

    server = await createSingleServer(1, ConfigCommand.getEmailOverrideConfig(emailPort))

    await setAccessTokensToServers([ server ])
    await server.config.enableSignup(false)
  })

  describe('Direct registrations of a new user', function () {
    let user1Token: string

    it('Should register a new user', async function () {
      const user = { displayName: 'super user 1', username: 'user_1', password: 'my super password' }
      const channel = { name: 'my_user_1_channel', displayName: 'my channel rocks' }

      await server.registrations.register({ ...user, channel })
    })

    it('Should be able to login with this registered user', async function () {
      const user1 = { username: 'user_1', password: 'my super password' }

      user1Token = await server.login.getAccessToken(user1)
    })

    it('Should have the correct display name', async function () {
      const user = await server.users.getMyInfo({ token: user1Token })
      expect(user.account.displayName).to.equal('super user 1')
    })

    it('Should have the correct video quota', async function () {
      const user = await server.users.getMyInfo({ token: user1Token })
      expect(user.videoQuota).to.equal(5 * 1024 * 1024)
    })

    it('Should have created the channel', async function () {
      const { displayName } = await server.channels.get({ channelName: 'my_user_1_channel' })

      expect(displayName).to.equal('my channel rocks')
    })

    it('Should remove me', async function () {
      {
        const { data } = await server.users.list()
        expect(data.find(u => u.username === 'user_1')).to.not.be.undefined
      }

      await server.users.deleteMe({ token: user1Token })

      {
        const { data } = await server.users.list()
        expect(data.find(u => u.username === 'user_1')).to.be.undefined
      }
    })
  })

  describe('Registration requests', function () {
    let id2: number
    let id3: number
    let id4: number

    let user2Token: string
    let user3Token: string

    before(async function () {
      this.timeout(60000)

      await server.config.enableSignup(true)

      {
        const { id } = await server.registrations.requestRegistration({
          username: 'user4',
          registrationReason: 'registration reason 4'
        })

        id4 = id
      }
    })

    it('Should request a registration without a channel', async function () {
      {
        const { id } = await server.registrations.requestRegistration({
          username: 'user2',
          displayName: 'my super user 2',
          email: 'user2@example.com',
          password: 'user2password',
          registrationReason: 'registration reason 2'
        })

        id2 = id
      }
    })

    it('Should request a registration with a channel', async function () {
      const { id } = await server.registrations.requestRegistration({
        username: 'user3',
        displayName: 'my super user 3',
        channel: {
          displayName: 'my user 3 channel',
          name: 'super_user3_channel'
        },
        email: 'user3@example.com',
        password: 'user3password',
        registrationReason: 'registration reason 3'
      })

      id3 = id
    })

    it('Should list these registration requests', async function () {
      {
        const { total, data } = await server.registrations.list({ sort: '-createdAt' })
        expect(total).to.equal(3)
        expect(data).to.have.lengthOf(3)

        {
          expect(data[0].id).to.equal(id3)
          expect(data[0].username).to.equal('user3')
          expect(data[0].accountDisplayName).to.equal('my super user 3')

          expect(data[0].channelDisplayName).to.equal('my user 3 channel')
          expect(data[0].channelHandle).to.equal('super_user3_channel')

          expect(data[0].createdAt).to.exist
          expect(data[0].updatedAt).to.exist

          expect(data[0].email).to.equal('user3@example.com')
          expect(data[0].emailVerified).to.be.null

          expect(data[0].moderationResponse).to.be.null
          expect(data[0].registrationReason).to.equal('registration reason 3')
          expect(data[0].state.id).to.equal(UserRegistrationState.PENDING)
          expect(data[0].state.label).to.equal('Pending')
          expect(data[0].user).to.be.null
        }

        {
          expect(data[1].id).to.equal(id2)
          expect(data[1].username).to.equal('user2')
          expect(data[1].accountDisplayName).to.equal('my super user 2')

          expect(data[1].channelDisplayName).to.be.null
          expect(data[1].channelHandle).to.be.null

          expect(data[1].createdAt).to.exist
          expect(data[1].updatedAt).to.exist

          expect(data[1].email).to.equal('user2@example.com')
          expect(data[1].emailVerified).to.be.null

          expect(data[1].moderationResponse).to.be.null
          expect(data[1].registrationReason).to.equal('registration reason 2')
          expect(data[1].state.id).to.equal(UserRegistrationState.PENDING)
          expect(data[1].state.label).to.equal('Pending')
          expect(data[1].user).to.be.null
        }

        {
          expect(data[2].username).to.equal('user4')
        }
      }

      {
        const { total, data } = await server.registrations.list({ count: 1, start: 1, sort: 'createdAt' })

        expect(total).to.equal(3)
        expect(data).to.have.lengthOf(1)
        expect(data[0].id).to.equal(id2)
      }

      {
        const { total, data } = await server.registrations.list({ search: 'user3' })
        expect(total).to.equal(1)
        expect(data).to.have.lengthOf(1)
        expect(data[0].id).to.equal(id3)
      }
    })

    it('Should reject a registration request', async function () {
      await server.registrations.reject({ id: id4, moderationResponse: 'I do not want id 4 on this instance' })
    })

    it('Should have sent an email to the user explaining the registration has been rejected', async function () {
      this.timeout(50000)

      await waitJobs([ server ])

      const email = emails.find(e => e['to'][0]['address'] === 'user4@example.com')
      expect(email).to.exist

      expect(email['subject']).to.contain('been rejected')
      expect(email['text']).to.contain('been rejected')
      expect(email['text']).to.contain('I do not want id 4 on this instance')
    })

    it('Should accept registration requests', async function () {
      await server.registrations.accept({ id: id2, moderationResponse: 'Welcome id 2' })
      await server.registrations.accept({ id: id3, moderationResponse: 'Welcome id 3' })
    })

    it('Should have sent an email to the user explaining the registration has been accepted', async function () {
      this.timeout(50000)

      await waitJobs([ server ])

      {
        const email = emails.find(e => e['to'][0]['address'] === 'user2@example.com')
        expect(email).to.exist

        expect(email['subject']).to.contain('been accepted')
        expect(email['text']).to.contain('been accepted')
        expect(email['text']).to.contain('Welcome id 2')
      }

      {
        const email = emails.find(e => e['to'][0]['address'] === 'user3@example.com')
        expect(email).to.exist

        expect(email['subject']).to.contain('been accepted')
        expect(email['text']).to.contain('been accepted')
        expect(email['text']).to.contain('Welcome id 3')
      }
    })

    it('Should login with these users', async function () {
      user2Token = await server.login.getAccessToken({ username: 'user2', password: 'user2password' })
      user3Token = await server.login.getAccessToken({ username: 'user3', password: 'user3password' })
    })

    it('Should have created the appropriate attributes for user 2', async function () {
      const me = await server.users.getMyInfo({ token: user2Token })

      expect(me.username).to.equal('user2')
      expect(me.account.displayName).to.equal('my super user 2')
      expect(me.videoQuota).to.equal(5 * 1024 * 1024)
      expect(me.videoChannels[0].name).to.equal('user2_channel')
      expect(me.videoChannels[0].displayName).to.equal('Main user2 channel')
      expect(me.role.id).to.equal(UserRole.USER)
      expect(me.email).to.equal('user2@example.com')
    })

    it('Should have created the appropriate attributes for user 3', async function () {
      const me = await server.users.getMyInfo({ token: user3Token })

      expect(me.username).to.equal('user3')
      expect(me.account.displayName).to.equal('my super user 3')
      expect(me.videoQuota).to.equal(5 * 1024 * 1024)
      expect(me.videoChannels[0].name).to.equal('super_user3_channel')
      expect(me.videoChannels[0].displayName).to.equal('my user 3 channel')
      expect(me.role.id).to.equal(UserRole.USER)
      expect(me.email).to.equal('user3@example.com')
    })

    it('Should list these accepted/rejected registration requests', async function () {
      const { data } = await server.registrations.list({ sort: 'createdAt' })
      const { data: users } = await server.users.list()

      {
        expect(data[0].id).to.equal(id4)
        expect(data[0].state.id).to.equal(UserRegistrationState.REJECTED)
        expect(data[0].state.label).to.equal('Rejected')

        expect(data[0].moderationResponse).to.equal('I do not want id 4 on this instance')
        expect(data[0].user).to.be.null

        expect(users.find(u => u.username === 'user4')).to.not.exist
      }

      {
        expect(data[1].id).to.equal(id2)
        expect(data[1].state.id).to.equal(UserRegistrationState.ACCEPTED)
        expect(data[1].state.label).to.equal('Accepted')

        expect(data[1].moderationResponse).to.equal('Welcome id 2')
        expect(data[1].user).to.exist

        const user2 = users.find(u => u.username === 'user2')
        expect(data[1].user.id).to.equal(user2.id)
      }

      {
        expect(data[2].id).to.equal(id3)
        expect(data[2].state.id).to.equal(UserRegistrationState.ACCEPTED)
        expect(data[2].state.label).to.equal('Accepted')

        expect(data[2].moderationResponse).to.equal('Welcome id 3')
        expect(data[2].user).to.exist

        const user3 = users.find(u => u.username === 'user3')
        expect(data[2].user.id).to.equal(user3.id)
      }
    })

    it('Shoulde delete a registration', async function () {
      await server.registrations.delete({ id: id2 })
      await server.registrations.delete({ id: id3 })

      const { total, data } = await server.registrations.list()
      expect(total).to.equal(1)
      expect(data).to.have.lengthOf(1)
      expect(data[0].id).to.equal(id4)

      const { data: users } = await server.users.list()

      for (const username of [ 'user2', 'user3' ]) {
        expect(users.find(u => u.username === username)).to.exist
      }
    })

    it('Should be able to prevent email delivery on accept/reject', async function () {
      this.timeout(50000)

      let id1: number
      let id2: number

      {
        const { id } = await server.registrations.requestRegistration({
          username: 'user7',
          email: 'user7@example.com',
          registrationReason: 'tt'
        })
        id1 = id
      }
      {
        const { id } = await server.registrations.requestRegistration({
          username: 'user8',
          email: 'user8@example.com',
          registrationReason: 'tt'
        })
        id2 = id
      }

      await server.registrations.accept({ id: id1, moderationResponse: 'tt', preventEmailDelivery: true })
      await server.registrations.reject({ id: id2, moderationResponse: 'tt', preventEmailDelivery: true })

      await waitJobs([ server ])

      const filtered = emails.filter(e => {
        const address = e['to'][0]['address']
        return address === 'user7@example.com' || address === 'user8@example.com'
      })

      expect(filtered).to.have.lengthOf(0)
    })

    it('Should request a registration without a channel, that will conflict with an already existing channel', async function () {
      let id1: number
      let id2: number

      {
        const { id } = await server.registrations.requestRegistration({
          registrationReason: 'tt',
          username: 'user5',
          password: 'user5password',
          channel: {
            displayName: 'channel 6',
            name: 'user6_channel'
          }
        })

        id1 = id
      }

      {
        const { id } = await server.registrations.requestRegistration({
          registrationReason: 'tt',
          username: 'user6',
          password: 'user6password'
        })

        id2 = id
      }

      await server.registrations.accept({ id: id1, moderationResponse: 'tt' })
      await server.registrations.accept({ id: id2, moderationResponse: 'tt' })

      const user5Token = await server.login.getAccessToken('user5', 'user5password')
      const user6Token = await server.login.getAccessToken('user6', 'user6password')

      const user5 = await server.users.getMyInfo({ token: user5Token })
      const user6 = await server.users.getMyInfo({ token: user6Token })

      expect(user5.videoChannels[0].name).to.equal('user6_channel')
      expect(user6.videoChannels[0].name).to.equal('user6_channel-1')
    })
  })

  after(async function () {
    MockSmtpServer.Instance.kill()

    await cleanupTests([ server ])
  })
})
