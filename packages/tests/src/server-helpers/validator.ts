/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { isStableOrUnstableVersionValid, isStableVersionValid } from '@peertube/peertube-server/core/helpers/custom-validators/misc.js'
import {} from '@peertube/peertube-server/core/helpers/custom-validators/plugins.js'
import {
  isActorPublicKeyObjectValid,
  sanitizeAndCheckActorObject
} from '@peertube/peertube-server/core/helpers/custom-validators/activitypub/actor.js'
import { setValidRemoteIcon } from '@peertube/peertube-server/core/helpers/custom-validators/activitypub/misc.js'
import { ACTIVITY_PUB, WEBSERVER } from '@peertube/peertube-server/core/initializers/constants.js'
import { expect } from 'chai'

describe('Validators', function () {
  describe('ActivityPub actor validators', function () {
    it('Should return false for null/undefined publicKey without crashing', async function () {
      expect(isActorPublicKeyObjectValid(null)).to.be.false
      expect(isActorPublicKeyObjectValid(undefined)).to.be.false
      expect(isActorPublicKeyObjectValid(0)).to.be.false
      expect(isActorPublicKeyObjectValid('')).to.be.false
    })

    it('Should return false for a publicKey object with missing fields', async function () {
      expect(isActorPublicKeyObjectValid({})).to.be.false
      expect(isActorPublicKeyObjectValid({ id: 'not-a-url' })).to.be.false
      expect(isActorPublicKeyObjectValid({ id: 'https://example.com/key', owner: 'not-a-url' })).to.be.false
    })

    it('Should return true for a valid publicKey object', async function () {
      const validKey = {
        id: 'https://example.com/accounts/user#main-key',
        owner: 'https://example.com/accounts/user',
        publicKeyPem: '-----BEGIN PUBLIC KEY-----\nMIIBIjANB...fake...key\n-----END PUBLIC KEY-----'
      }
      expect(isActorPublicKeyObjectValid(validKey)).to.be.true
    })

    it('Should return false for sanitizeAndCheckActorObject with missing publicKey', async function () {
      const actorWithoutPublicKey: any = {
        type: 'Person',
        id: 'https://example.com/accounts/user',
        inbox: 'https://example.com/accounts/user/inbox',
        preferredUsername: 'user',
        publicKey: null
      }
      expect(sanitizeAndCheckActorObject(actorWithoutPublicKey)).to.be.false
    })

    describe('Actor URL hosts', function () {
      function buildActor (overrides: Record<string, any> = {}): any {
        return {
          type: 'Person',
          id: 'https://example.com/users/user',
          inbox: 'https://example.com/users/user/inbox',
          outbox: 'https://example.com/users/user/outbox',
          followers: 'https://example.com/users/user/followers',
          following: 'https://example.com/users/user/following',
          endpoints: { sharedInbox: 'https://example.com/inbox' },
          preferredUsername: 'user',
          publicKey: {
            id: 'https://example.com/users/user#main-key',
            owner: 'https://example.com/users/user',
            publicKeyPem: '-----BEGIN PUBLIC KEY-----\nMIIBIjANB...fake...key\n-----END PUBLIC KEY-----'
          },
          ...overrides
        }
      }

      it('Should accept an actor whose URLs are on its host', async function () {
        expect(sanitizeAndCheckActorObject(buildActor())).to.be.true
      })

      it('Should accept inboxes on another host', async function () {
        const actor = buildActor({
          inbox: 'https://fed.example.org/example.com/inbox',
          endpoints: { sharedInbox: 'https://fed.example.org/inbox' }
        })

        expect(sanitizeAndCheckActorObject(actor)).to.be.true
      })

      it('Should refuse inboxes on this instance', async function () {
        const localInbox = WEBSERVER.URL + '/inbox'

        expect(sanitizeAndCheckActorObject(buildActor({ inbox: localInbox }))).to.be.false
        expect(sanitizeAndCheckActorObject(buildActor({ endpoints: { sharedInbox: localInbox } }))).to.be.false
      })

      it('Should refuse collections on another host', async function () {
        expect(sanitizeAndCheckActorObject(buildActor({ followers: 'https://other.example.org/followers' }))).to.be.false
        expect(sanitizeAndCheckActorObject(buildActor({ following: 'https://other.example.org/following' }))).to.be.false
        expect(sanitizeAndCheckActorObject(buildActor({ outbox: 'https://other.example.org/outbox' }))).to.be.false
      })
    })
  })
  it('Should correctly check stable plugin versions', async function () {
    expect(isStableVersionValid('3.4.0')).to.be.true
    expect(isStableVersionValid('0.4.0')).to.be.true
    expect(isStableVersionValid('0.1.0')).to.be.true

    expect(isStableVersionValid('0.1.0-beta-1')).to.be.false
    expect(isStableVersionValid('hello')).to.be.false
    expect(isStableVersionValid('0.x.a')).to.be.false
    expect(isStableVersionValid('+1.2.3')).to.be.false
    expect(isStableVersionValid('1.2.3 ')).to.be.false
  })

  it('Should correctly check unstable plugin versions', async function () {
    expect(isStableOrUnstableVersionValid('3.4.0')).to.be.true
    expect(isStableOrUnstableVersionValid('0.4.0')).to.be.true
    expect(isStableOrUnstableVersionValid('0.1.0')).to.be.true

    expect(isStableOrUnstableVersionValid('0.1.0-beta.1')).to.be.true
    expect(isStableOrUnstableVersionValid('0.1.0-alpha.45')).to.be.true
    expect(isStableOrUnstableVersionValid('0.1.0-rc.45')).to.be.true

    expect(isStableOrUnstableVersionValid('hello')).to.be.false
    expect(isStableOrUnstableVersionValid('0.x.a')).to.be.false
    expect(isStableOrUnstableVersionValid('0.1.0-rc-45')).to.be.false
    expect(isStableOrUnstableVersionValid('0.1.0-rc.45d')).to.be.false
    expect(isStableOrUnstableVersionValid('0.1.0-rc.45-foo')).to.be.false
    expect(isStableOrUnstableVersionValid('0.1.0-beta.1-../../x')).to.be.false
    expect(isStableOrUnstableVersionValid('+0.1.0')).to.be.false
  })

  describe('ActivityPub icon validator', function () {
    function buildIcon (width: number, height = width) {
      return { type: 'Image', url: `https://example.com/thumbnails/${width}x${height}.jpg`, mediaType: 'image/jpeg', width, height }
    }

    it('Should keep valid icons with distinct sizes', async function () {
      const entity = { icon: [ buildIcon(280, 157), buildIcon(850, 480), buildIcon(280, 157) ] }

      expect(setValidRemoteIcon(entity)).to.be.true
      expect(entity.icon.map(i => i.width)).to.deep.equal([ 280, 850 ])
    })

    it('Should truncate the icon array', async function () {
      const entity = { icon: Array.from({ length: 1000 }, (_, i) => buildIcon(i + 1)) }

      expect(setValidRemoteIcon(entity)).to.be.true
      expect(entity.icon).to.have.lengthOf(ACTIVITY_PUB.MAX_ICONS)
    })

    it('Should ignore icons with invalid entries or out of range dimensions', async function () {
      const entity: any = {
        icon: [
          null,
          'https://example.com/thumbnail.jpg',
          buildIcon(ACTIVITY_PUB.MAX_ICON_DIMENSION + 1, 100),
          buildIcon(100, 2 ** 40),
          buildIcon(-1, 100),
          buildIcon(ACTIVITY_PUB.MAX_ICON_DIMENSION)
        ]
      }

      expect(setValidRemoteIcon(entity)).to.be.true
      expect(entity.icon).to.have.lengthOf(1)
      expect(entity.icon[0].width).to.equal(ACTIVITY_PUB.MAX_ICON_DIMENSION)
    })
  })
})
