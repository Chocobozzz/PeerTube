// TODO: deprecated, remove in v10
// The script was renamed to create-move-file-storage-job because it also moves files that don't belong to a video
console.warn('create-move-video-storage-job is deprecated, use create-move-file-storage-job instead.')

await import('./create-move-file-storage-job.js')

export {}
