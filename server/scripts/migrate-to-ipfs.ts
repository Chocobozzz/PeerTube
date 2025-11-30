import { program } from 'commander'
import { CONFIG } from '../core/initializers/config.js'
import { initDatabaseModels } from '../core/initializers/database.js'
import { VideoFileModel } from '../core/models/video/video-file.js'
import { VideoStreamingPlaylistModel } from '../core/models/video/video-streaming-playlist.js'
import { VideoCaptionModel } from '../core/models/video/video-caption.js'
import { VideoSourceModel } from '../core/models/video/video-source.js'
import { logger } from '../core/helpers/logger.js'
import { getHeliaClient } from '../core/lib/object-storage/shared/ipfs-client.js'
import { storeObjectInIPFS } from '../core/lib/object-storage/ipfs-storage-helpers.js'
import { VideoPathManager } from '../core/lib/video-path-manager.js'
import { FileStorage } from '@peertube/peertube-models'
import Bluebird from 'bluebird'
import { existsSync } from 'fs'
import { Op } from 'sequelize'

program
  .description('Migrate video files from filesystem or S3 to IPFS storage')
  .option('-t, --type <type>', 'Type of files to migrate: web-videos, streaming-playlists, captions, original-files, all', 'all')
  .option('-l, --limit <number>', 'Maximum number of files to migrate (0 = no limit)', '0')
  .option('-c, --concurrency <number>', 'Number of concurrent migrations', '3')
  .option('--dry-run', 'Show what would be migrated without actually migrating')
  .option('--force', 'Re-migrate files that already have an IPFS CID')
  .parse(process.argv)

const options = program.opts()

type MigrationType = 'web-videos' | 'streaming-playlists' | 'captions' | 'original-files' | 'all'

interface MigrationStats {
  total: number
  migrated: number
  skipped: number
  failed: number
  errors: Array<{ id: number, type: string, error: string }>
}

const stats: MigrationStats = {
  total: 0,
  migrated: 0,
  skipped: 0,
  failed: 0,
  errors: []
}

run()
  .then(() => process.exit(0))
  .catch(err => {
    logger.error('Error in migration script', { err })
    process.exit(1)
  })

async function run () {
  logger.info('Starting IPFS migration script...')

  // Validate IPFS is enabled
  if (!CONFIG.IPFS_STORAGE.ENABLED) {
    throw new Error('IPFS storage is not enabled in configuration. Please enable it before running migration.')
  }

  const migrationType = options.type as MigrationType
  const limit = parseInt(options.limit, 10)
  const concurrency = parseInt(options.concurrency, 10)
  const dryRun = options.dryRun === true
  const force = options.force === true

  if (dryRun) {
    logger.info('Running in DRY-RUN mode - no actual migration will occur')
  }

  logger.info('Migration configuration:', {
    type: migrationType,
    limit: limit === 0 ? 'unlimited' : limit,
    concurrency,
    dryRun,
    force
  })

  await initDatabaseModels(true)

  // Initialize Helia IPFS node
  logger.info('Initializing IPFS node...')
  await getHeliaClient()
  logger.info('IPFS node initialized successfully')

  // Run migrations based on type
  if (migrationType === 'all' || migrationType === 'web-videos') {
    await migrateWebVideoFiles({ limit, concurrency, dryRun, force })
  }

  if (migrationType === 'all' || migrationType === 'streaming-playlists') {
    await migrateStreamingPlaylists({ limit, concurrency, dryRun, force })
  }

  if (migrationType === 'all' || migrationType === 'captions') {
    await migrateCaptions({ limit, concurrency, dryRun, force })
  }

  if (migrationType === 'all' || migrationType === 'original-files') {
    await migrateOriginalFiles({ limit, concurrency, dryRun, force })
  }

  // Print final statistics
  printStatistics()
}

async function migrateWebVideoFiles (options: {
  limit: number
  concurrency: number
  dryRun: boolean
  force: boolean
}) {
  logger.info('Migrating web video files...')

  const whereConditions: any = {
    videoId: { [Op.ne]: null }
  }

  if (!options.force) {
    whereConditions.ipfsCid = null
  }

  // Count total first
  const totalCount = await VideoFileModel.count({ where: whereConditions })
  const limitToProcess = options.limit > 0 ? Math.min(options.limit, totalCount) : totalCount
  logger.info(`Found ${totalCount} web video files to migrate (processing ${limitToProcess})`)
  stats.total += limitToProcess

  // Process in batches to avoid memory overflow
  const batchSize = 100
  let processed = 0

  while (processed < limitToProcess) {
    const batch = await VideoFileModel.scope('WITH_VIDEO').findAll({
      where: whereConditions,
      limit: Math.min(batchSize, limitToProcess - processed),
      offset: processed,
      order: [['id', 'ASC']]
    })

    if (batch.length === 0) break

    await Bluebird.map(batch, async (videoFile) => {
      try {
        if (options.dryRun) {
          logger.info(`[DRY-RUN] Would migrate video file ${videoFile.id} (${videoFile.filename})`)
          stats.skipped++
          return
        }

        await migrateVideoFile(videoFile, options.force)
        stats.migrated++
        logger.info(`Migrated video file ${videoFile.id} - Progress: ${stats.migrated}/${limitToProcess}`)
      } catch (err) {
        stats.failed++
        stats.errors.push({
          id: videoFile.id,
          type: 'video-file',
          error: err.message
        })
        logger.error(`Failed to migrate video file ${videoFile.id}`, { err })
      }
    }, { concurrency: options.concurrency })

    processed += batch.length
    logger.info(`Batch complete: ${processed}/${limitToProcess} files processed`)
  }
}

async function migrateStreamingPlaylists (options: {
  limit: number
  concurrency: number
  dryRun: boolean
  force: boolean
}) {
  logger.info('Migrating streaming playlists...')

  const whereConditions: any = {}

  if (!options.force) {
    whereConditions.ipfsCid = null
  }

  // Count total first
  const totalCount = await VideoStreamingPlaylistModel.count({ where: whereConditions })
  const limitToProcess = options.limit > 0 ? Math.min(options.limit, totalCount) : totalCount
  logger.info(`Found ${totalCount} streaming playlists to migrate (processing ${limitToProcess})`)
  stats.total += limitToProcess

  // Process in batches to avoid memory overflow
  const batchSize = 50
  let processed = 0

  while (processed < limitToProcess) {
    const batch = await VideoStreamingPlaylistModel.scope('WITH_VIDEO').findAll({
      where: whereConditions,
      limit: Math.min(batchSize, limitToProcess - processed),
      offset: processed,
      order: [['id', 'ASC']]
    })

    if (batch.length === 0) break

    await Bluebird.map(batch, async (playlist) => {
      try {
        if (options.dryRun) {
          logger.info(`[DRY-RUN] Would migrate streaming playlist ${playlist.id}`)
          stats.skipped++
          return
        }

        await migrateStreamingPlaylist(playlist, options.force)
        stats.migrated++
        logger.info(`Migrated streaming playlist ${playlist.id} - Progress: ${stats.migrated}/${limitToProcess}`)
      } catch (err) {
        stats.failed++
        stats.errors.push({
          id: playlist.id,
          type: 'streaming-playlist',
          error: err.message
        })
        logger.error(`Failed to migrate streaming playlist ${playlist.id}`, { err })
      }
    }, { concurrency: options.concurrency })

    processed += batch.length
    logger.info(`Batch complete: ${processed}/${limitToProcess} playlists processed`)
  }
}

async function migrateCaptions (options: {
  limit: number
  concurrency: number
  dryRun: boolean
  force: boolean
}) {
  logger.info('Migrating video captions...')

  const whereConditions: any = {}

  if (!options.force) {
    whereConditions.ipfsCid = null
  }

  // Count total first
  const totalCount = await VideoCaptionModel.count({ where: whereConditions })
  const limitToProcess = options.limit > 0 ? Math.min(options.limit, totalCount) : totalCount
  logger.info(`Found ${totalCount} captions to migrate (processing ${limitToProcess})`)
  stats.total += limitToProcess

  // Process in batches to avoid memory overflow
  const batchSize = 100
  let processed = 0

  while (processed < limitToProcess) {
    const batch = await VideoCaptionModel.findAll({
      where: whereConditions,
      limit: Math.min(batchSize, limitToProcess - processed),
      offset: processed,
      order: [['videoId', 'ASC'], ['language', 'ASC']]
    })

    if (batch.length === 0) break

    await Bluebird.map(batch, async (caption) => {
      try {
        if (options.dryRun) {
          logger.info(`[DRY-RUN] Would migrate caption ${caption.id}`)
          stats.skipped++
          return
        }

        await migrateCaption(caption, options.force)
        stats.migrated++
        logger.info(`Migrated caption ${caption.id} - Progress: ${stats.migrated}/${limitToProcess}`)
      } catch (err) {
        stats.failed++
        stats.errors.push({
          id: caption.id,
          type: 'caption',
          error: err.message
        })
        logger.error(`Failed to migrate caption ${caption.id}`, { err })
      }
    }, { concurrency: options.concurrency })

    processed += batch.length
    logger.info(`Batch complete: ${processed}/${limitToProcess} captions processed`)
  }
}

async function migrateOriginalFiles (options: {
  limit: number
  concurrency: number
  dryRun: boolean
  force: boolean
}) {
  logger.info('Migrating original video files...')

  const whereConditions: any = {}

  if (!options.force) {
    whereConditions.ipfsCid = null
  }

  // Count total first
  const totalCount = await VideoSourceModel.count({ where: whereConditions })
  const limitToProcess = options.limit > 0 ? Math.min(options.limit, totalCount) : totalCount
  logger.info(`Found ${totalCount} original files to migrate (processing ${limitToProcess})`)
  stats.total += limitToProcess

  // Process in batches to avoid memory overflow
  const batchSize = 50
  let processed = 0

  while (processed < limitToProcess) {
    const batch = await VideoSourceModel.findAll({
      where: whereConditions,
      limit: Math.min(batchSize, limitToProcess - processed),
      offset: processed,
      order: [['id', 'ASC']]
    })

    if (batch.length === 0) break

    await Bluebird.map(batch, async (source) => {
      try {
        if (options.dryRun) {
          logger.info(`[DRY-RUN] Would migrate original file ${source.id}`)
          stats.skipped++
          return
        }

        await migrateOriginalFile(source, options.force)
        stats.migrated++
        logger.info(`Migrated original file ${source.id} - Progress: ${stats.migrated}/${limitToProcess}`)
      } catch (err) {
        stats.failed++
        stats.errors.push({
          id: source.id,
          type: 'original-file',
          error: err.message
        })
        logger.error(`Failed to migrate original file ${source.id}`, { err })
      }
    }, { concurrency: options.concurrency })

    processed += batch.length
    logger.info(`Batch complete: ${processed}/${limitToProcess} original files processed`)
  }
}

async function migrateVideoFile (videoFile: VideoFileModel, force: boolean) {
  // Skip if already has IPFS CID and not forcing
  if (videoFile.ipfsCid && !force) {
    logger.debug(`Video file ${videoFile.id} already has IPFS CID, skipping`)
    stats.skipped++
    return
  }

  const video = videoFile.Video

  // Get file path based on storage type
  let filePath: string

  if (videoFile.storage === FileStorage.FILE_SYSTEM) {
    filePath = VideoPathManager.Instance.getFSVideoFileOutputPath(video, videoFile)
  } else if (videoFile.storage === FileStorage.OBJECT_STORAGE) {
    // Download from S3 first
    const { makeAvailable } = await import('../core/lib/object-storage/object-storage-helpers.js')
    const tmpPath = VideoPathManager.Instance.buildTMPDestination(videoFile.filename)
    
    await makeAvailable({
      key: videoFile.filename,
      destination: tmpPath,
      bucketInfo: CONFIG.OBJECT_STORAGE.WEB_VIDEOS
    })
    
    filePath = tmpPath
  } else {
    throw new Error(`Unknown storage type: ${videoFile.storage}`)
  }

  // Check if file exists
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`)
  }

  // Upload to IPFS
  const bucketInfo = CONFIG.IPFS_STORAGE.WEB_VIDEOS
  const ipfsUrl = await storeObjectInIPFS({
    inputPath: filePath,
    bucketInfo
  })

  // Extract CID from URL
  const cid = ipfsUrl.replace(/^https?:\/\/[^/]+\/ipfs\//, '').replace(/^ipfs:\/\//, '')

  // Update database
  videoFile.ipfsCid = cid
  videoFile.fileUrl = ipfsUrl
  videoFile.storage = FileStorage.OBJECT_STORAGE // Mark as remote storage
  await videoFile.save()

  logger.debug(`Video file ${videoFile.id} migrated to IPFS with CID: ${cid}`)
}

async function migrateStreamingPlaylist (playlist: VideoStreamingPlaylistModel, force: boolean) {
  // Skip if already has IPFS CID and not forcing
  const currentCid = (playlist as any).ipfsCid
  if (currentCid && !force) {
    logger.debug(`Streaming playlist ${playlist.id} already has IPFS CID, skipping`)
    stats.skipped++
    return
  }

  // For HLS playlists, we need to migrate the master playlist file
  const video = playlist.Video
  const playlistPath = VideoPathManager.Instance.getFSHLSOutputPath(video, playlist.playlistFilename)

  if (!existsSync(playlistPath)) {
    throw new Error(`Playlist file not found: ${playlistPath}`)
  }

  // Upload to IPFS
  const bucketInfo = CONFIG.IPFS_STORAGE.STREAMING_PLAYLISTS
  const ipfsUrl = await storeObjectInIPFS({
    inputPath: playlistPath,
    bucketInfo
  })

  // Extract CID from URL
  const cid = ipfsUrl.replace(/^https?:\/\/[^/]+\/ipfs\//, '').replace(/^ipfs:\/\//, '')

  // Update database
  ;(playlist as any).ipfsCid = cid
  playlist.playlistUrl = ipfsUrl
  playlist.storage = FileStorage.OBJECT_STORAGE
  await playlist.save()

  logger.debug(`Streaming playlist ${playlist.id} migrated to IPFS with CID: ${cid}`)

  // Also migrate associated video files in the playlist
  const playlistVideoFiles = await VideoFileModel.findAll({
    where: { videoStreamingPlaylistId: playlist.id }
  })

  for (const videoFile of playlistVideoFiles) {
    if (!videoFile.ipfsCid || force) {
      await migratePlaylistVideoFile(playlist, videoFile, force)
    }
  }
}

async function migratePlaylistVideoFile (playlist: VideoStreamingPlaylistModel, videoFile: VideoFileModel, force: boolean) {
  const video = playlist.Video
  const filePath = VideoPathManager.Instance.getFSHLSOutputPath(video, videoFile.filename)

  if (!existsSync(filePath)) {
    throw new Error(`Playlist video file not found: ${filePath}`)
  }

  // Upload to IPFS
  const bucketInfo = CONFIG.IPFS_STORAGE.STREAMING_PLAYLISTS
  const ipfsUrl = await storeObjectInIPFS({
    inputPath: filePath,
    bucketInfo
  })

  // Extract CID from URL
  const cid = ipfsUrl.replace(/^https?:\/\/[^/]+\/ipfs\//, '').replace(/^ipfs:\/\//, '')

  // Update database
  videoFile.ipfsCid = cid
  videoFile.fileUrl = ipfsUrl
  videoFile.storage = FileStorage.OBJECT_STORAGE
  await videoFile.save()

  logger.debug(`Playlist video file ${videoFile.id} migrated to IPFS with CID: ${cid}`)
}

async function migrateCaption (caption: VideoCaptionModel, force: boolean) {
  // Skip if already has IPFS CID and not forcing
  const currentCid = (caption as any).ipfsCid
  if (currentCid && !force) {
    logger.debug(`Caption ${caption.id} already has IPFS CID, skipping`)
    stats.skipped++
    return
  }
  
  // Use the caption model's getFSFilePath method
  const captionPath = caption.getFSFilePath()

  if (!existsSync(captionPath)) {
    throw new Error(`Caption file not found: ${captionPath}`)
  }

  // Upload to IPFS
  const bucketInfo = CONFIG.IPFS_STORAGE.CAPTIONS
  const ipfsUrl = await storeObjectInIPFS({
    inputPath: captionPath,
    bucketInfo
  })

  // Extract CID from URL
  const cid = ipfsUrl.replace(/^https?:\/\/[^/]+\/ipfs\//, '').replace(/^ipfs:\/\//, '')

  // Update database
  ;(caption as any).ipfsCid = cid
  ;(caption as any).fileUrl = ipfsUrl
  ;(caption as any).storage = FileStorage.OBJECT_STORAGE
  await caption.save()

  logger.debug(`Caption ${caption.id} migrated to IPFS with CID: ${cid}`)
}

async function migrateOriginalFile (source: VideoSourceModel, force: boolean) {
  // Skip if already has IPFS CID and not forcing
  const currentCid = (source as any).ipfsCid
  if (currentCid && !force) {
    logger.debug(`Original file ${source.id} already has IPFS CID, skipping`)
    stats.skipped++
    return
  }

  const filePath = VideoPathManager.Instance.getFSOriginalVideoFilePath(source.keptOriginalFilename)

  if (!existsSync(filePath)) {
    throw new Error(`Original file not found: ${filePath}`)
  }

  // Upload to IPFS
  const bucketInfo = CONFIG.IPFS_STORAGE.ORIGINAL_VIDEO_FILES
  const ipfsUrl = await storeObjectInIPFS({
    inputPath: filePath,
    bucketInfo
  })

  // Extract CID from URL
  const cid = ipfsUrl.replace(/^https?:\/\/[^/]+\/ipfs\//, '').replace(/^ipfs:\/\//, '')

  // Update database
  ;(source as any).ipfsCid = cid
  source.fileUrl = ipfsUrl
  source.storage = FileStorage.OBJECT_STORAGE
  await source.save()

  logger.debug(`Original file ${source.id} migrated to IPFS with CID: ${cid}`)
}

function printStatistics () {
  logger.info('='.repeat(80))
  logger.info('IPFS MIGRATION SUMMARY')
  logger.info('='.repeat(80))
  logger.info(`Total files found:     ${stats.total}`)
  logger.info(`Successfully migrated: ${stats.migrated}`)
  logger.info(`Skipped:              ${stats.skipped}`)
  logger.info(`Failed:               ${stats.failed}`)
  logger.info('='.repeat(80))

  if (stats.errors.length > 0) {
    logger.error('ERRORS:')
    stats.errors.forEach(error => {
      logger.error(`  - ${error.type} #${error.id}: ${error.error}`)
    })
  }

  const successRate = stats.total > 0 ? ((stats.migrated / stats.total) * 100).toFixed(2) : '0'
  logger.info(`Success rate: ${successRate}%`)
  logger.info('='.repeat(80))
}
