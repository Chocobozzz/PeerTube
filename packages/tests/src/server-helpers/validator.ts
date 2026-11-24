/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { isStableOrUnstableVersionValid, isStableVersionValid } from '@peertube/peertube-server/core/helpers/custom-validators/misc.js'
import {} from '@peertube/peertube-server/core/helpers/custom-validators/plugins.js'
import {
  isActorPublicKeyObjectValid,
  sanitizeAndCheckActorObject
} from '@peertube/peertube-server/core/helpers/custom-validators/activitypub/actor.js'
import { isActivityPubUrlValid, setValidRemoteIcon } from '@peertube/peertube-server/core/helpers/custom-validators/activitypub/misc.js'
import { sanitizeAndCheckVideoChaptersObject } from '@peertube/peertube-server/core/helpers/custom-validators/activitypub/video-chapters.js'
import { sanitizeAndCheckVideoCommentObject } from '@peertube/peertube-server/core/helpers/custom-validators/activitypub/video-comments.js'
import { isWatchActionObjectValid } from '@peertube/peertube-server/core/helpers/custom-validators/activitypub/watch-action.js'
import { areAbusePredefinedReasonsValid } from '@peertube/peertube-server/core/helpers/custom-validators/abuses.js'
import { isUrlValid } from '@peertube/peertube-server/core/helpers/custom-validators/urls.js'
import { areVideoEmbedPrivacyDomainsValid } from '@peertube/peertube-server/core/helpers/custom-validators/video-embed-privacy.js'
import { areLiveSchedulesValid } from '@peertube/peertube-server/core/helpers/custom-validators/video-lives.js'
import { areVideoChaptersValid } from '@peertube/peertube-server/core/helpers/custom-validators/video-chapters.js'
import {
  ACTIVITY_PUB,
  CONSTRAINTS_FIELDS,
  MAX_LOCAL_VIEWER_WATCH_SECTIONS,
  WEBSERVER
} from '@peertube/peertube-server/core/initializers/constants.js'
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

  describe('ActivityPub actor image validator', function () {
    function buildActor (field: 'icon' | 'image', images: any): any {
      return {
        type: 'Person',
        id: 'https://example.com/users/user',
        inbox: 'https://example.com/users/user/inbox',
        preferredUsername: 'user',
        publicKey: {
          id: 'https://example.com/users/user#main-key',
          owner: 'https://example.com/users/user',
          publicKeyPem: '-----BEGIN PUBLIC KEY-----\nMIIBIjANB...fake...key\n-----END PUBLIC KEY-----'
        },
        [field]: images
      }
    }

    function buildImage (width?: number) {
      return { type: 'Image', url: `https://example.com/avatars/${width ?? 'none'}.png`, mediaType: 'image/png', width, height: width }
    }

    for (const field of [ 'icon', 'image' ] as const) {
      it(`Should truncate and dedupe ${field} entries`, async function () {
        const actor = buildActor(field, Array.from({ length: 1000 }, (_, i) => buildImage(i + 1)))
        expect(sanitizeAndCheckActorObject(actor)).to.be.true
        expect(actor[field]).to.have.lengthOf(ACTIVITY_PUB.MAX_ACTOR_IMAGES)

        const actor2 = buildActor(field, [ buildImage(), buildImage(), buildImage(120), buildImage(120), buildImage(600) ])
        expect(sanitizeAndCheckActorObject(actor2)).to.be.true
        expect(actor2[field].map(i => i.width)).to.deep.equal([ undefined, 120, 600 ])
      })

      it(`Should ignore invalid ${field} entries`, async function () {
        const actor = buildActor(field, [
          null,
          'https://example.com/avatar.png',
          { ...buildImage(120), type: 'Link' },
          { ...buildImage(120), url: 'not a url' },
          buildImage(ACTIVITY_PUB.MAX_ICON_DIMENSION + 1),
          { ...buildImage(120), width: 'abc' },
          buildImage(600)
        ])

        expect(sanitizeAndCheckActorObject(actor)).to.be.true
        expect(actor[field].map(i => i.width)).to.deep.equal([ 600 ])
      })

      it(`Should accept a single ${field} object without size`, async function () {
        const actor = buildActor(field, buildImage())

        expect(sanitizeAndCheckActorObject(actor)).to.be.true
        expect(actor[field]).to.have.lengthOf(1)
      })
    }
  })

  describe('URL validators', function () {
    it('Should not accept arrays of URLs', async function () {
      const urls = [ 'https://example.com/videos/watch/1', 'https://example.com/videos/watch/2' ]

      expect(isUrlValid(urls[0])).to.be.true
      expect(isActivityPubUrlValid(urls[0])).to.be.true

      for (const value of [ urls, [ urls[0] ], { toString: () => urls[0] } ]) {
        expect(isUrlValid(value as any)).to.be.false
        expect(isActivityPubUrlValid(value as any)).to.be.false
      }
    })
  })

  describe('Video chapters validators', function () {
    function buildChapters (length: number) {
      return Array.from({ length }, (_, i) => ({ name: 'chapter ' + i, title: 'chapter ' + i, startOffset: i, timecode: i }))
    }

    it('Should limit the number of local chapters', async function () {
      const max = CONSTRAINTS_FIELDS.VIDEO_CHAPTERS.CHAPTERS.max

      expect(areVideoChaptersValid(buildChapters(max))).to.be.true
      expect(areVideoChaptersValid(buildChapters(max + 1))).to.be.false
    })

    it('Should truncate remote chapters', async function () {
      const object: any = { id: 'https://example.com/videos/watch/1/chapters', hasPart: buildChapters(5000) }

      expect(sanitizeAndCheckVideoChaptersObject(object)).to.be.true
      expect(object.hasPart).to.have.lengthOf(CONSTRAINTS_FIELDS.VIDEO_CHAPTERS.CHAPTERS.max)
    })
  })

  describe('ActivityPub comment validator', function () {
    it('Should truncate remote comment content', async function () {
      const comment: any = {
        type: 'Note',
        id: 'https://example.com/videos/watch/1/comments/1',
        url: 'https://example.com/videos/watch/1/comments/1',
        inReplyTo: 'https://example.org/videos/watch/1',
        published: new Date().toISOString(),
        to: [ 'https://www.w3.org/ns/activitystreams#Public' ],
        content: 'a'.repeat(ACTIVITY_PUB.MAX_COMMENT_TEXT_LENGTH * 2)
      }

      expect(sanitizeAndCheckVideoCommentObject(comment)).to.be.true
      expect(comment.content).to.have.lengthOf(ACTIVITY_PUB.MAX_COMMENT_TEXT_LENGTH)
    })
  })

  describe('Array length limits', function () {
    it('Should limit the number of local live schedules', async function () {
      const build = (length: number) => Array.from({ length }, (_, i) => ({ startAt: new Date(Date.now() + (i + 1) * 1000).toISOString() }))
      const max = CONSTRAINTS_FIELDS.VIDEO_LIVES.SCHEDULES.max

      expect(areLiveSchedulesValid(build(max))).to.be.true
      expect(areLiveSchedulesValid(build(max + 1))).to.be.false
    })

    it('Should not throw on a non string live schedule date', async function () {
      expect(areLiveSchedulesValid([ { startAt: 123 } ])).to.be.false
      expect(areLiveSchedulesValid([ { startAt: { toString: () => '2030-01-01' } } ])).to.be.false
    })

    it('Should limit the number of embed privacy domains', async function () {
      const build = (length: number) => Array.from({ length }, (_, i) => `example${i}.com`)
      const max = CONSTRAINTS_FIELDS.VIDEOS.EMBED_PRIVACY_DOMAINS.max

      expect(areVideoEmbedPrivacyDomainsValid(build(max))).to.be.true
      expect(areVideoEmbedPrivacyDomainsValid(build(max + 1))).to.be.false
    })

    it('Should limit the number of remote watch sections', async function () {
      const build = (length: number): any => ({
        type: 'WatchAction',
        id: 'https://example.com/views/1',
        duration: 'PT10S',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        uuid: '7a6d3a6e-5b8a-4f0a-9a0e-3c1a1b8d7e4f',
        object: 'https://example.org/videos/watch/1',
        actionStatus: 'CompletedActionStatus',
        watchSections: Array.from({ length }, (_, i) => ({ startTimestamp: i, endTimestamp: i + 1 }))
      })

      expect(isWatchActionObjectValid(build(MAX_LOCAL_VIEWER_WATCH_SECTIONS))).to.be.true
      expect(isWatchActionObjectValid(build(MAX_LOCAL_VIEWER_WATCH_SECTIONS + 1))).to.be.false
    })

    it('Should only accept known abuse predefined reasons', async function () {
      expect(areAbusePredefinedReasonsValid([ 'spamOrMisleading', 'serverRules' ])).to.be.true

      for (const reason of [ 'constructor', 'toString', '__proto__', 'hasOwnProperty' ]) {
        expect(areAbusePredefinedReasonsValid([ reason as any ])).to.be.false
      }
    })
  })
})
