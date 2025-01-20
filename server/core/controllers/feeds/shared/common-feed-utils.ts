import { Feed } from '@peertube/feed'
import { CustomTag, CustomXMLNS, Person } from '@peertube/feed/lib/typings/index.js'
import { maxBy, pick } from '@peertube/peertube-core-utils'
import { ActorImageType } from '@peertube/peertube-models'
import { mdToPlainText } from '@server/helpers/markdown.js'
import { CONFIG } from '@server/initializers/config.js'
import { WEBSERVER } from '@server/initializers/constants.js'
import { UserModel } from '@server/models/user/user.js'
import { MAccountDefault, MChannelBannerAccountDefault, MUser, MVideoFullLight } from '@server/types/models/index.js'
import express from 'express'

export function initFeed (parameters: {
  name: string
  description: string
  imageUrl: string
  isPodcast: boolean
  link?: string
  locked?: { isLocked: boolean, email: string }
  author?: {
    name: string
    link: string
    imageUrl: string
  }
  person?: Person[]
  resourceType?: 'videos' | 'video-comments'
  queryString?: string
  medium?: string
  stunServers?: string[]
  trackers?: string[]
  customXMLNS?: CustomXMLNS[]
  customTags?: CustomTag[]
}) {
  const webserverUrl = WEBSERVER.URL
  const { name, description, link, imageUrl, isPodcast, resourceType, queryString, medium } = parameters

  return new Feed({
    title: name,
    description: mdToPlainText(description),
    // updated: TODO: somehowGetLatestUpdate, // optional, default = today
    id: link || webserverUrl,
    link: link || webserverUrl,
    image: imageUrl,
    favicon: webserverUrl + '/client/assets/images/favicon.png',
    copyright: `All rights reserved, unless otherwise specified in the terms specified at ${webserverUrl}/about` +
    ` and potential licenses granted by each content's rightholder.`,
    generator: `PeerTube - ${webserverUrl}`,
    medium: medium || 'video',
    feedLinks: {
      json: `${webserverUrl}/feeds/${resourceType}.json${queryString}`,
      atom: `${webserverUrl}/feeds/${resourceType}.atom${queryString}`,
      rss: isPodcast
        ? `${webserverUrl}/feeds/podcast/videos.xml${queryString}`
        : `${webserverUrl}/feeds/${resourceType}.xml${queryString}`
    },

    ...pick(parameters, [ 'stunServers', 'trackers', 'customXMLNS', 'customTags', 'author', 'person', 'locked' ])
  })
}

export function sendFeed (feed: Feed, req: express.Request, res: express.Response) {
  const format = req.params.format

  if (format === 'atom' || format === 'atom1') {
    return res.send(feed.atom1()).end()
  }

  if (format === 'json' || format === 'json1') {
    return res.send(feed.json1()).end()
  }

  if (format === 'rss' || format === 'rss2') {
    return res.send(feed.rss2()).end()
  }

  // We're in the ambiguous '.xml' case and we look at the format query parameter
  if (req.query.format === 'atom' || req.query.format === 'atom1') {
    return res.send(feed.atom1()).end()
  }

  return res.send(feed.rss2()).end()
}

export async function buildFeedMetadata (options: {
  videoChannel?: MChannelBannerAccountDefault
  account?: MAccountDefault
  video?: MVideoFullLight
}) {
  const { video, videoChannel, account } = options

  let imageUrl = WEBSERVER.URL + '/client/assets/images/icons/icon-96x96.png'
  let accountImageUrl: string
  let name: string
  let userName: string
  let description: string
  let email: string
  let link: string
  let accountLink: string
  let user: MUser

  if (videoChannel) {
    name = videoChannel.getDisplayName()
    description = videoChannel.description
    link = videoChannel.getClientUrl()
    accountLink = videoChannel.Account.getClientUrl()

    if (videoChannel.Actor.hasImage(ActorImageType.AVATAR)) {
      const videoChannelAvatar = maxBy(videoChannel.Actor.Avatars, 'width')
      imageUrl = WEBSERVER.URL + videoChannelAvatar.getStaticPath()
    }

    if (videoChannel.Account.Actor.hasImage(ActorImageType.AVATAR)) {
      const accountAvatar = maxBy(videoChannel.Account.Actor.Avatars, 'width')
      accountImageUrl = WEBSERVER.URL + accountAvatar.getStaticPath()
    }

    user = await UserModel.loadById(videoChannel.Account.userId)
    userName = videoChannel.Account.getDisplayName()
  } else if (account) {
    name = account.getDisplayName()
    description = account.description
    link = account.getClientUrl()
    accountLink = link

    if (account.Actor.hasImage(ActorImageType.AVATAR)) {
      const accountAvatar = maxBy(account.Actor.Avatars, 'width')
      imageUrl = WEBSERVER.URL + accountAvatar?.getStaticPath()
      accountImageUrl = imageUrl
    }

    user = await UserModel.loadById(account.userId)
  } else if (video) {
    name = video.name
    description = video.description
    link = video.url
  } else {
    name = CONFIG.INSTANCE.NAME
    description = CONFIG.INSTANCE.DESCRIPTION
    link = WEBSERVER.URL
  }

  // If the user is local, has a verified email address, and allows it to be publicly displayed
  // Return it so the owner can prove ownership of their feed
  if (user && !user.pluginAuth && user.emailVerified && user.emailPublic) {
    email = user.email
  }

  return { name, userName, description, imageUrl, accountImageUrl, email, link, accountLink }
}
