import { VideoChapterModel } from '@server/models/video/video-chapter.js'

export type MVideoChapter = Omit<VideoChapterModel, 'Video'>
