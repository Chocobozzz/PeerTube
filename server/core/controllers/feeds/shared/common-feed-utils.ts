import { Feed } from '@peertube/feed'
import { CustomTag, CustomXMLNS, Person } from '@peertube/feed/lib/typings/index.js'
import { pick } from '@peertube/peertube-core-utils'
import { ActorImageType } from '@peertube/peertube-models'
import { mdToPlainText } from '@server/helpers/markdown.js'
import { CONFIG } from '@server/initializers/config.js'
import { WEBSERVER } from '@server/initializers/constants.js'
import { regenerateActorImageFiles } from '@server/lib/local-actor.js'
import { ServerConfigManager } from '@server/lib/server-config-manager.js'
import { getServerActor } from '@server/models/application/application.js'
import {
  MAccountDefault,
  MChannelBannerAccountDefault,
  MChannelDefault,
  MVideo,
  MVideoPlaylistFull
} from '@server/types/models/index.js'
import express from 'express'

export async function initFeed (parameters: {
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

    favicon: ServerConfigManager.Instance.getFavicon(await getServerActor()).fileUrl,

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
  videoPlaylist?: MVideoPlaylistFull
  videoChannel?: MChannelBannerAccountDefault
  account?: MAccountDefault
  video?: MVideo
}) {
  const { videoPlaylist, video, videoChannel, account } = options

  let imageUrl = ServerConfigManager.Instance.getLogoUrl(await getServerActor(), 1500)
  let ownerImageUrl: string
  let name: string
  let description: string
  let email: string
  let link: string
  let ownerLink: string

  if (videoPlaylist) {
    name = videoPlaylist.name
    description = videoPlaylist.description
    link = WEBSERVER.URL + videoPlaylist.getWatchStaticPath()

    const thumbnail = videoPlaylist.getBestThumbnail('1:1')
    if (thumbnail) {
      imageUrl = thumbnail?.getLocalFileUrl()
    }

    const channel = videoPlaylist.VideoChannel
    ownerLink = channel.getClientUrl()

    if (channel.Actor.hasImage(ActorImageType.AVATAR)) {
      ownerImageUrl = await getOrGenerateActorImageUrl(channel)
    }
  } else if (videoChannel) {
    name = videoChannel.getDisplayName()
    description = videoChannel.description
    ownerLink = videoChannel.getClientUrl()
    link = ownerLink

    if (videoChannel.Actor.hasImage(ActorImageType.AVATAR)) {
      imageUrl = await getOrGenerateActorImageUrl(videoChannel)
      ownerImageUrl = imageUrl
    }
  } else if (account) {
    name = account.getDisplayName()
    description = account.description
    ownerLink = account.getClientUrl()
    link = ownerLink

    if (account.Actor.hasImage(ActorImageType.AVATAR)) {
      imageUrl = await getOrGenerateActorImageUrl(account)
      ownerImageUrl = imageUrl
    }
  } else if (video) {
    name = video.name
    description = video.description
    link = video.url
  } else {
    name = CONFIG.INSTANCE.NAME
    description = CONFIG.INSTANCE.DESCRIPTION
    link = WEBSERVER.URL
  }

  // If the video channel has a public email set, use it
  // So the owner can prove ownership of their feed
  if (videoChannel?.publicEmail) {
    email = videoChannel.publicEmail
  } else if (videoPlaylist?.VideoChannel?.publicEmail) {
    email = videoPlaylist.VideoChannel.publicEmail
  }

  return { name, description, imageUrl, ownerImageUrl, email, link, ownerLink }
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

async function getOrGenerateActorImageUrl (accountOrChannel: MChannelDefault | MAccountDefault) {
  let image = accountOrChannel.Actor.getMaxQualityImage(ActorImageType.AVATAR)
  if (!image) throw new Error('No avatar image found for the account or channel')

  if (accountOrChannel.Actor.isLocal() && image.width < 1500) {
    await regenerateActorImageFiles({ accountOrChannel, type: ActorImageType.AVATAR })
  }

  image = accountOrChannel.Actor.getMaxQualityImage(ActorImageType.AVATAR)

  return image.getLocalFileUrl()
}
