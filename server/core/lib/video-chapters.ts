import { parseChapters, sortBy } from '@peertube/peertube-core-utils'
import { VideoChapter } from '@peertube/peertube-models'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { VideoChapterModel } from '@server/models/video/video-chapter.js'
import { MVideoImmutable } from '@server/types/models/index.js'
import { Transaction } from 'sequelize'
import { InternalEventEmitter } from './internal-event-emitter.js'
import { CONSTRAINTS_FIELDS } from '@server/initializers/constants.js'

const lTags = loggerTagsFactory('video', 'chapters')

export async function replaceChapters (options: {
  video: MVideoImmutable
  chapters: VideoChapter[]
  transaction: Transaction
}) {
  const { chapters, transaction, video } = options

  await VideoChapterModel.deleteChapters(video.id, transaction)

  await createChapters({ videoId: video.id, chapters, transaction })

  InternalEventEmitter.Instance.emit('chapters-updated', { video })
}

export async function replaceChaptersIfNotExist (options: {
  video: MVideoImmutable
  chapters: VideoChapter[]
  transaction: Transaction
}) {
  const { chapters, transaction, video } = options

  if (await VideoChapterModel.hasVideoChapters(video.id, transaction)) return

  await createChapters({ videoId: video.id, chapters, transaction })

  InternalEventEmitter.Instance.emit('chapters-updated', { video })
}

export async function replaceChaptersFromDescriptionIfNeeded (options: {
  oldDescription?: string
  newDescription: string
  video: MVideoImmutable
  transaction: Transaction
}) {
  const { transaction, video, newDescription, oldDescription = '' } = options

  const chaptersFromOldDescription = sortBy(parseChapters(oldDescription, CONSTRAINTS_FIELDS.VIDEO_CHAPTERS.TITLE.max), 'timecode')
  const existingChapters = await VideoChapterModel.listChaptersOfVideo(video.id, transaction)

  logger.debug(
    'Check if we replace chapters from description',
    { oldDescription, chaptersFromOldDescription, newDescription, existingChapters, ...lTags(video.uuid) }
  )

  // Then we can update chapters from the new description
  if (areSameChapters(chaptersFromOldDescription, existingChapters)) {
    const chaptersFromNewDescription = sortBy(parseChapters(newDescription, CONSTRAINTS_FIELDS.VIDEO_CHAPTERS.TITLE.max), 'timecode')
    if (chaptersFromOldDescription.length === 0 && chaptersFromNewDescription.length === 0) return false

    await replaceChapters({ video, chapters: chaptersFromNewDescription, transaction })

    logger.info('Replaced chapters of video ' + video.uuid, { chaptersFromNewDescription, ...lTags(video.uuid) })

    return true
  }

  return false
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

async function createChapters (options: {
  videoId: number
  chapters: VideoChapter[]
  transaction: Transaction
}) {
  const { chapters, transaction, videoId } = options

  const existingTimecodes = new Set<number>()

  for (const chapter of chapters) {
    if (existingTimecodes.has(chapter.timecode)) continue

    await VideoChapterModel.create({
      title: chapter.title,
      timecode: chapter.timecode,
      videoId
    }, { transaction })

    existingTimecodes.add(chapter.timecode)
  }
}

function areSameChapters (chapters1: VideoChapter[], chapters2: VideoChapter[]) {
  if (chapters1.length !== chapters2.length) return false

  for (let i = 0; i < chapters1.length; i++) {
    if (chapters1[i].timecode !== chapters2[i].timecode) return false
    if (chapters1[i].title !== chapters2[i].title) return false
  }

  return true
}
