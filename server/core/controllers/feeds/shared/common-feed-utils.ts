import { Feed } from '@peertube/feed'
import { CustomTag, CustomXMLNS, Person } from '@peertube/feed/lib/typings/index.js'
import { pick } from '@peertube/peertube-core-utils'
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
  nsfw?: boolean
  guid?: string
  link?: string
  locked?: { isLocked: boolean, email: string }
  author?: {
    name: string
    link: string
  }
  category?: string
  language?: string
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
  const { name, description, link, imageUrl, category, isPodcast, resourceType, queryString, medium, nsfw } = parameters

  const feed = new Feed({
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

    nsfw: nsfw ?? false,

    feedLinks: {
      json: `${webserverUrl}/feeds/${resourceType}.json${queryString}`,
      atom: `${webserverUrl}/feeds/${resourceType}.atom${queryString}`,
      rss: isPodcast
        ? `${webserverUrl}/feeds/podcast/videos.xml${queryString}`
        : `${webserverUrl}/feeds/${resourceType}.xml${queryString}`
    },

    ...pick(parameters, [
      'guid',
      'language',
      'stunServers',
      'trackers',
      'customXMLNS',
      'customTags',
      'author',
      'person',
      'locked'
    ])
  })

  if (category) {
    feed.addCategory(category)
  }

  return feed
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
  let ownerImageUrl: string
  let name: string
  let description: string
  let email: string
  let link: string
  let ownerLink: string
  let user: MUser

  if (videoChannel) {
    name = videoChannel.getDisplayName()
    description = videoChannel.description
    ownerLink = link = videoChannel.getClientUrl()

    if (videoChannel.Actor.hasImage(ActorImageType.AVATAR)) {
      imageUrl = WEBSERVER.URL + videoChannel.Actor.getMaxQualityImage(ActorImageType.AVATAR).getStaticPath()
      ownerImageUrl = imageUrl
    }

    user = await UserModel.loadById(videoChannel.Account.userId)
  } else if (account) {
    name = account.getDisplayName()
    description = account.description
    ownerLink = link = account.getClientUrl()

    if (account.Actor.hasImage(ActorImageType.AVATAR)) {
      imageUrl = WEBSERVER.URL + account.Actor.getMaxQualityImage(ActorImageType.AVATAR).getStaticPath()
      ownerImageUrl = imageUrl
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

  return { name, description, imageUrl, ownerImageUrl, email, link, ownerLink }
}
