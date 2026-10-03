import { createLogger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { VideoCaptionSegmentModel } from '@server/models/video/video-caption-segment.js'
import { MVideoCaption } from '@server/types/models/index.js'
import { readFile } from 'fs/promises'

const logger = createLogger('caption')

// Number of cues inserted in a single SQL statement
const INSERT_CHUNK_SIZE = 500

export interface VideoCaptionCue {
  startMs: number
  endMs: number
  text: string
}

/**
 * Extract the cues of a WebVTT file: one cue is a text block with its start and end timestamps.
 * Unknown blocks (WEBVTT header, NOTE, STYLE, REGION) and cue settings are ignored.
 */
export function parseVideoCaptionCues (content: string): VideoCaptionCue[] {
  const cues: VideoCaptionCue[] = []

  const blocks = content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n\n')

  for (const block of blocks) {
    const lines = block.split('\n').filter(line => line.trim() !== '')
    if (lines.length < 2) continue

    // A cue can be preceded by an identifier, so the timecode line is not always the first one
    const timecodeLineIndex = lines.findIndex(line => line.includes('-->'))
    if (timecodeLineIndex === -1) continue

    const [ rawStart, rawEnd ] = lines[timecodeLineIndex].split('-->')

    const startMs = parseVideoCaptionTimecode(rawStart)
    const endMs = parseVideoCaptionTimecode(rawEnd)
    if (startMs === null || endMs === null) continue

    const text = lines
      .slice(timecodeLineIndex + 1)
      .map(line => stripVideoCaptionCueMarkup(line))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (text === '') continue

    cues.push({ startMs, endMs, text })
  }

  return cues
}

/**
 * Index the cues of a caption file, so that its text can be searched.
 *
 * This must never throw: a caption that cannot be indexed is still a valid caption.
 */
export async function indexVideoCaptionSegments (caption: MVideoCaption): Promise<void> {
  if (CONFIG.SEARCH.CAPTION_SEARCH.ENABLED !== true) return

  try {
    const content = await readFile(caption.getFSFilePath(), 'utf8')
    const cues = parseVideoCaptionCues(content)

    await sequelizeTypescript.transaction(async transaction => {
      // A caption can be replaced, so we always start from a clean state
      await VideoCaptionSegmentModel.destroy({
        where: { captionId: caption.id },
        transaction
      })

      for (let i = 0; i < cues.length; i += INSERT_CHUNK_SIZE) {
        const rows = cues.slice(i, i + INSERT_CHUNK_SIZE)
          .map(cue => {
            const escapedText = sequelizeTypescript.escape(cue.text)

            return '(' + [
              caption.videoId,
              caption.id,
              sequelizeTypescript.escape(caption.language),
              caption.automaticallyGenerated ? 'TRUE' : 'FALSE',
              cue.startMs,
              cue.endMs,
              escapedText,
              // The vector is built by postgres, so it stays consistent with the search query
              `to_tsvector('simple', immutable_unaccent(${escapedText}))`
            ].join(', ') + ')'
          })
          .join(', ')

        await sequelizeTypescript.query(
          'INSERT INTO "videoCaptionSegment" ' +
          '("videoId", "captionId", "language", "automaticallyGenerated", "startMs", "endMs", "text", "searchVector") ' +
          `VALUES ${rows}`,
          { transaction }
        )
      }
    })

    logger.debug(`Indexed ${cues.length} caption segments of ${caption.filename}`)
  } catch (err) {
    logger.warn(`Cannot index caption segments of ${caption.filename}.`, { err })
  }
}

// ---------------------------------------------------------------------------

function stripVideoCaptionCueMarkup (line: string) {
  return line
    // WebVTT markup: <v Speaker>, <c.yellow>, <00:00:01.000>
    .replace(/<[^>]*>/g, '')
    // Speaker dash
    .replace(/^\s*-\s*/, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function parseVideoCaptionTimecode (raw: string): number | null {
  // Timestamps can be followed by cue settings ("00:00:05.000 align:start position:10%")
  const timecode = raw.trim().split(/\s+/)[0]

  const match = /^(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})$/.exec(timecode)
  if (!match) return null

  const hours = match[1]
    ? parseInt(match[1], 10) * 3600 * 1000
    : 0

  return hours +
    parseInt(match[2], 10) * 60 * 1000 +
    parseInt(match[3], 10) * 1000 +
    parseInt(match[4].padEnd(3, '0'), 10)
}
