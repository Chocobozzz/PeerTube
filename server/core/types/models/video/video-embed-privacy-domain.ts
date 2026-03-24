import { VideoEmbedPrivacyDomainModel } from '@server/models/video/video-embed-privacy-domain.js'

export type MEmbedPrivacyDomain = Omit<VideoEmbedPrivacyDomainModel, 'Video'>
