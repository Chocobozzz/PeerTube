import { CONSTRAINTS_FIELDS, VIDEO_LANGUAGES } from '../../initializers'
import { exists, isFileValid } from './misc'
import { Response } from 'express'
import { VideoModel } from '../../models/video/video'
import { VideoCaptionModel } from '../../models/video/video-caption'

function isVideoCaptionLanguageValid (value: any) {
  return exists(value) && VIDEO_LANGUAGES[ value ] !== undefined
}

const videoCaptionTypes = CONSTRAINTS_FIELDS.VIDEO_CAPTIONS.CAPTION_FILE.EXTNAME
                                          .map(v => v.replace('.', ''))
                                          .join('|')
const videoCaptionsTypesRegex = `text/(${videoCaptionTypes})`

function isVideoCaptionFile (files: { [ fieldname: string ]: Express.Multer.File[] } | Express.Multer.File[], field: string) {
  return isFileValid(files, videoCaptionsTypesRegex, field, CONSTRAINTS_FIELDS.VIDEO_CAPTIONS.CAPTION_FILE.FILE_SIZE.max)
}

async function isVideoCaptionExist (video: VideoModel, language: string, res: Response) {
  const videoCaption = await VideoCaptionModel.loadByVideoIdAndLanguage(video.id, language)

  if (!videoCaption) {
    res.status(404)
       .json({ error: 'Video caption not found' })
       .end()

    return false
  }

  res.locals.videoCaption = videoCaption
  return true
}

// ---------------------------------------------------------------------------

export {
  isVideoCaptionFile,
  isVideoCaptionLanguageValid,
  isVideoCaptionExist
}
