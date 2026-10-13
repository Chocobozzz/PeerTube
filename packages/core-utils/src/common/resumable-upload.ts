// Object storage refuses a multipart upload of more parts than this
const MAX_MULTIPART_UPLOAD_PARTS = 10_000

// When the server streams resumable uploads to object storage (`minChunkSize` > 0), each chunk becomes a multipart upload part
// A non final chunk must be at least `minChunkSize`, and bigger for a big file so the upload doesn't exceed the max number of parts
// Returns 0 if the chunk size is free
export function getResumableUploadChunkSize (options: {
  minChunkSize: number
  fileSize: number
}) {
  const { minChunkSize, fileSize } = options
  if (!minChunkSize) return 0

  return Math.max(minChunkSize, Math.ceil(fileSize / MAX_MULTIPART_UPLOAD_PARTS))
}
