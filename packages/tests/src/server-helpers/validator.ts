/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { isStableOrUnstableVersionValid, isStableVersionValid } from '@peertube/peertube-server/core/helpers/custom-validators/misc.js'
import {} from '@peertube/peertube-server/core/helpers/custom-validators/plugins.js'
import {
  isActorPublicKeyObjectValid,
  sanitizeAndCheckActorObject
} from '@peertube/peertube-server/core/helpers/custom-validators/activitypub/actor.js'
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
  })
  it('Should correctly check stable plugin versions', async function () {
    expect(isStableVersionValid('3.4.0')).to.be.true
    expect(isStableVersionValid('0.4.0')).to.be.true
    expect(isStableVersionValid('0.1.0')).to.be.true

    expect(isStableVersionValid('0.1.0-beta-1')).to.be.false
    expect(isStableVersionValid('hello')).to.be.false
    expect(isStableVersionValid('0.x.a')).to.be.false
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
  })
})
