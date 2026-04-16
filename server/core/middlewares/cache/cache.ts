import express from 'express'
import { HttpStatusCode } from '@peertube/peertube-models'
import { ApiCache, APICacheOptions } from './shared/index.js'

const defaultOptions: APICacheOptions = {
  excludeStatus: [
    HttpStatusCode.FORBIDDEN_403,
    HttpStatusCode.NOT_FOUND_404
  ]
}

export function cacheRoute (duration: string) {
  const instance = new ApiCache(defaultOptions)

  return instance.buildMiddleware(duration)
}

export function cacheRouteFactory (options: APICacheOptions = {}) {
  const instance = new ApiCache({ ...defaultOptions, ...options })

  return { instance, middleware: instance.buildMiddleware.bind(instance) }
}

// ---------------------------------------------------------------------------

export function buildPodcastChannelGroupsCache (options: {
  channelId: number
}) {
  return 'podcast-feed-channel-' + options.channelId
}

export function buildPodcastPlaylistGroupsCache (options: {
  playlistId: number
}) {
  return 'podcast-feed-playlist-' + options.playlistId
}

export function buildAPVideoChaptersGroupsCache (options: {
  videoId: number | string
}) {
  return 'ap-video-chapters-' + options.videoId
}

// ---------------------------------------------------------------------------

export const videoFeedsPodcastSetCacheKey = [
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.query.videoChannelId) {
      res.locals.apicacheGroups = [ buildPodcastChannelGroupsCache({ channelId: req.query.videoChannelId }) ]
    } else if (req.query.playlistId) {
      res.locals.apicacheGroups = [ buildPodcastPlaylistGroupsCache({ playlistId: req.query.playlistId }) ]
    }

    return next()
  }
]

export const apVideoChaptersSetCacheKey = [
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.params.id) {
      res.locals.apicacheGroups = [ buildAPVideoChaptersGroupsCache({ videoId: req.params.id }) ]
    }

    return next()
  }
]
