import { CONFIG } from '@server/initializers/config.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import Bluebird from 'bluebird'
import { move } from 'fs-extra'
import { readdir } from 'fs/promises'
import { join } from 'path'

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(-1)
  })

async function run () {
  try {
    await movePreviewsToThumbnails()
  } catch (err) {
    console.error('An error occurred while moving preview files to thumbnail directory:', err)
  }

  try {
    await removeInvalidRemoteCaptions()
  } catch (err) {
    console.error('An error occurred while removing invalid remote captions:', err)
  }

  try {
    await deleteInvalidRemoteAvatars()
  } catch (err) {
    console.error('An error occurred while deleting invalid remote avatars:', err)
  }

  try {
    await updateLocalVideoFileUrls()
  } catch (err) {
    console.error('An error occurred while updating local video file URLs:', err)
  }

  try {
    await updateLocalVideoStreamingPlaylistUrls()
  } catch (err) {
    console.error('An error occurred while updating local video streaming playlist URLs:', err)
  }

  try {
    await updateLocalVideoCaptionUrls()
  } catch (err) {
    console.error('An error occurred while updating local video caption URLs:', err)
  }
}

async function movePreviewsToThumbnails () {
  const thumbnailDir = CONFIG.STORAGE.THUMBNAILS_DIR
  const previewDir = CONFIG.STORAGE.PREVIEWS_DIR

  const toMove = await readdir(previewDir)

  console.log(`Moving ${toMove.length} files from ${previewDir} directory to ${thumbnailDir} directory...`)

  await Bluebird.map(toMove, async previewFilename => {
    try {
      await move(join(previewDir, previewFilename), join(thumbnailDir, previewFilename), { overwrite: true })
    } catch (err) {
      console.error(`Failed to move file ${previewFilename} from ${previewDir} to ${thumbnailDir}:`, err)
    }
  }, { concurrency: 10 })

  console.log('File moving completed.\n')
}

async function removeInvalidRemoteCaptions () {
  console.log('Removing invalid remote captions...')

  await sequelizeTypescript.query(
    `DELETE FROM "videoCaption" WHERE id IN (` +
      `SELECT "videoCaption".id FROM "videoCaption" INNER JOIN video ON video.id = "videoCaption"."videoId" ` +
      `WHERE "videoCaption"."fileUrl" IS NULL AND video.remote IS TRUE` +
      `)`
  )

  console.log('Invalid remote captions removed.\n')
}

async function deleteInvalidRemoteAvatars () {
  console.log('Removing invalid remote avatars...')

  await sequelizeTypescript.query(
    `DELETE FROM "actorImage" WHERE id IN (` +
      `SELECT "actorImage".id FROM "actorImage" ` +
      `INNER JOIN actor ON actor.id = "actorImage"."actorId" ` +
      `WHERE actor."serverId" IS NOT NULL AND "actorImage"."fileUrl" IS NULL` +
      `)`
  )

  console.log('Invalid remote avatars removed.\n')
}

async function updateLocalVideoFileUrls () {
  console.log('Updating local video file URLs...')

  await sequelizeTypescript.query(
    `UPDATE "videoFile" SET "fileUrl" = NULL WHERE "id" IN (` +
      `SELECT "videoFile".id FROM "videoFile" ` +
      `INNER JOIN "videoStreamingPlaylist" ON "videoStreamingPlaylist".id = "videoFile"."videoStreamingPlaylistId" ` +
      `INNER JOIN video ON video.id = "videoStreamingPlaylist"."videoId" ` +
      `WHERE "videoFile"."fileUrl" IS NOT NULL AND video.remote IS FALSE` +
      `)`
  )

  await sequelizeTypescript.query(
    `UPDATE "videoFile" SET "fileUrl" = NULL WHERE "id" IN (` +
      `SELECT "videoFile".id FROM "videoFile" ` +
      `INNER JOIN video ON video.id = "videoFile"."videoId" ` +
      `WHERE "videoFile"."fileUrl" IS NOT NULL AND video.remote IS FALSE` +
      `)`
  )

  console.log('Local video file URLs updated.\n')
}

async function updateLocalVideoCaptionUrls () {
  console.log('Updating local video caption URLs...')

  await sequelizeTypescript.query(
    `UPDATE "videoCaption" SET "fileUrl" = NULL WHERE "id" IN (` +
      `SELECT "videoCaption".id FROM "videoCaption" ` +
      `INNER JOIN video ON video.id = "videoCaption"."videoId" ` +
      `WHERE "videoCaption"."fileUrl" IS NOT NULL AND video.remote IS FALSE` +
      `)`
  )

  await sequelizeTypescript.query(
    `UPDATE "videoCaption" SET "m3u8Url" = NULL WHERE "id" IN (` +
      `SELECT "videoCaption".id FROM "videoCaption" ` +
      `INNER JOIN video ON video.id = "videoCaption"."videoId" ` +
      `WHERE "videoCaption"."m3u8Url" IS NOT NULL AND video.remote IS FALSE` +
      `)`
  )

  console.log('Local video caption URLs updated.\n')
}

async function updateLocalVideoStreamingPlaylistUrls () {
  console.log('Updating local video streaming playlist URLs...')

  await sequelizeTypescript.query(
    `UPDATE "videoStreamingPlaylist" SET "playlistUrl" = NULL WHERE "id" IN (` +
      `SELECT "videoStreamingPlaylist".id FROM "videoStreamingPlaylist" ` +
      `INNER JOIN video ON video.id = "videoStreamingPlaylist"."videoId" ` +
      `WHERE "videoStreamingPlaylist"."playlistUrl" IS NOT NULL AND video.remote IS FALSE` +
      `)`
  )

  await sequelizeTypescript.query(
    `UPDATE "videoStreamingPlaylist" SET "segmentsSha256Url" = NULL WHERE "id" IN (` +
      `SELECT "videoStreamingPlaylist".id FROM "videoStreamingPlaylist" ` +
      `INNER JOIN video ON video.id = "videoStreamingPlaylist"."videoId" ` +
      `WHERE "videoStreamingPlaylist"."segmentsSha256Url" IS NOT NULL AND video.remote IS FALSE` +
      `)`
  )

  console.log('Local video streaming playlist URLs updated.\n')
}
