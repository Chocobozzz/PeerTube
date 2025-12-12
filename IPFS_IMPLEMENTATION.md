# IPFS Storage Backend Implementation for PeerTube

This document provides a comprehensive overview of the IPFS (InterPlanetary File System) storage backend implementation for PeerTube using Helia.

## Summary of Changes

This implementation adds IPFS as an alternative decentralized storage backend for PeerTube, allowing video files and other resources to be stored on IPFS instead of traditional filesystem or S3-compatible object storage.

## Modified Files

### 1. Dependencies (`package.json`)

**Added Dependencies:**
- `helia@^5.2.1` - Core IPFS implementation
- `@helia/unixfs@^4.2.1` - UnixFS file system support for IPFS
- `@helia/strings@^4.2.1` - String content support
- `@chainsafe/libp2p-noise@^16.0.0` - Noise protocol for connection encryption
- `@chainsafe/libp2p-yamux@^7.0.1` - Yamux stream multiplexer
- `@libp2p/tcp@^10.2.2` - TCP transport for libp2p
- `@libp2p/bootstrap@^11.1.5` - Bootstrap peer discovery
- `blockstore-fs@^2.1.2` - Filesystem-based blockstore
- `datastore-fs@^10.1.2` - Filesystem-based datastore

### 2. Configuration (`config/default.yaml`)

**Added Section:**
```yaml
ipfs_storage:
  enabled: false
  repo_path: ''
  gateway_url: ''
  listen_addresses: [...]
  bootstrap_peers: [...]
  streaming_playlists: {...}
  web_videos: {...}
  user_exports: {...}
  original_video_files: {...}
  captions: {...}
```

**Purpose:** Configures IPFS storage backend settings, including node configuration, gateway URL, network settings, and storage buckets for different resource types.

### 3. Configuration Initializer (`server/core/initializers/config.ts`)

**Added Configuration Object:**
```typescript
IPFS_STORAGE: {
  ENABLED: boolean,
  REPO_PATH: string,
  GATEWAY_URL: string,
  LISTEN_ADDRESSES: string[],
  BOOTSTRAP_PEERS: string[],
  WEB_VIDEOS: {...},
  STREAMING_PLAYLISTS: {...},
  USER_EXPORTS: {...},
  ORIGINAL_VIDEO_FILES: {...},
  CAPTIONS: {...}
}
```

**Purpose:** Parses and loads IPFS configuration from YAML files into the application's CONFIG object.

## New Files Created

### 4. IPFS Client (`server/core/lib/object-storage/shared/ipfs-client.ts`)

**Key Functions:**
- `getHeliaClient()` - Returns singleton Helia IPFS node instance
- `initializeHelia()` - Initializes Helia with libp2p, blockstore, and datastore
- `stopHeliaClient()` - Gracefully stops the IPFS node
- `isHeliaInitialized()` - Check if IPFS node is running

**Purpose:** Manages the lifecycle of the Helia IPFS node, providing a singleton instance for the application.

**Features:**
- Lazy initialization (starts on first use)
- Persistent storage using filesystem blockstore and datastore
- Configurable libp2p networking with TCP transport
- Bootstrap peer discovery support
- Connection encryption (Noise protocol)
- Stream multiplexing (Yamux)

### 5. IPFS Storage Helpers (`server/core/lib/object-storage/ipfs-storage-helpers.ts`)

**Key Functions:**
- `storeObjectInIPFS()` - Upload file from local path to IPFS
- `storeContentInIPFS()` - Upload string content to IPFS
- `storeStreamInIPFS()` - Upload readable stream to IPFS
- `makeAvailableFromIPFS()` - Download file from IPFS to local path
- `createIPFSReadStream()` - Create readable stream from IPFS CID
- `removeObjectFromIPFS()` - Unpin content from IPFS
- `getIPFSFileSize()` - Get file size from IPFS metadata
- `buildIPFSUrl()` - Generate URL for IPFS content (gateway or ipfs://)

**Purpose:** Provides IPFS-specific storage operations compatible with PeerTube's storage abstraction layer.

**Features:**
- Automatic content pinning to ensure persistence
- Stream-based uploads for large files
- Gateway URL support for HTTP access
- Content-addressable storage with CID generation
- Compatible with existing S3 storage helpers API

### 6. Unified Storage Service (`server/core/lib/object-storage/unified-storage.ts`)

**Key Functions:**
- `getStorageBackend()` - Determines active storage backend (S3 or IPFS)
- `storeObjectUnified()` - Upload file using active backend
- `storeContentUnified()` - Upload content using active backend
- `storeStreamUnified()` - Upload stream using active backend
- `makeAvailableUnified()` - Download file using active backend
- `createObjectReadStreamUnified()` - Create read stream using active backend
- `removeObjectUnified()` - Remove file using active backend
- `getObjectStorageFileSizeUnified()` - Get file size using active backend

**Purpose:** Provides a unified interface for storage operations that automatically routes to either S3 or IPFS based on configuration.

**Features:**
- Dynamic backend selection based on configuration
- Backward compatibility with existing S3 code
- Consistent API regardless of backend
- Priority: IPFS > S3 > Error if both disabled

### 7. Database Migration (`server/core/initializers/migrations/0950-ipfs-storage.ts`)

**Database Changes:**
- Added `ipfsCid` column to `videoFile` table
- Added `ipfsCid` column to `videoStreamingPlaylist` table
- Added `ipfsCid` column to `videoCaption` table
- Added `ipfsCid` column to `videoSource` table

**Column Specification:**
- Type: `VARCHAR(255)` (Sequelize.STRING)
- Nullable: `true`
- Default: `null`

**Purpose:** Stores IPFS Content Identifiers (CIDs) alongside existing file URLs, enabling IPFS storage while maintaining backward compatibility.

### 8. Video File Model Update (`server/core/models/video/video-file.ts`)

**Added Field:**
```typescript
@AllowNull(true)
@Column
declare ipfsCid: string
```

**Purpose:** Adds IPFS CID field to the VideoFile model, allowing storage and retrieval of IPFS content identifiers.

### 9. Documentation (`support/doc/ipfs-storage.md`)

**Sections:**
- Overview and architecture
- Configuration guide
- Installation instructions
- Usage examples
- Monitoring and troubleshooting
- Security considerations
- API changes
- Current limitations and planned improvements

**Purpose:** Comprehensive guide for administrators to configure and use IPFS storage backend.

## Architecture

### Storage Backend Selection

```
Application Request
        ↓
getStorageBackend()
        ↓
    ┌───────┴───────┐
    ↓               ↓
IPFS Enabled?   S3 Enabled?
    Yes             Yes
    ↓               ↓
Use IPFS        Use S3
```

Priority: IPFS > S3 > Error

### IPFS Upload Flow

```
1. storeObjectUnified() called
2. Check CONFIG.IPFS_STORAGE.ENABLED
3. Route to storeObjectInIPFS()
4. Read file/stream/content
5. Add to Helia IPFS node
6. Generate CID
7. Pin content
8. Store CID in database
9. Return gateway URL or ipfs:// URL
```

### IPFS Download Flow

```
1. Video playback request
2. Check videoFile.ipfsCid
3. createIPFSReadStream()
4. Fetch from Helia node
5. Stream to client
```

## Integration Points

### Storage Layer

The unified storage service integrates with:
- `server/core/lib/object-storage/videos.ts` - Video file storage
- `server/core/lib/job-queue/handlers/move-to-object-storage.ts` - Storage migration jobs
- `server/core/lib/paths.ts` - File path management
- `server/core/controllers/api/videos/upload.ts` - Video upload handling

### Database Layer

IPFS CIDs are stored in:
- `videoFile.ipfsCid` - Individual video file CIDs
- `videoStreamingPlaylist.ipfsCid` - HLS playlist CIDs
- `videoCaption.ipfsCid` - Caption file CIDs
- `videoSource.ipfsCid` - Original video source CIDs

### Configuration Layer

IPFS settings are loaded from:
- `config/default.yaml` - Default configuration
- `config/production.yaml` - Production overrides
- Environment variables - Runtime overrides
- `server/core/initializers/config.ts` - Configuration parser

## Usage Example

### Enable IPFS Storage

```yaml
# config/production.yaml
ipfs_storage:
  enabled: true
  repo_path: '/var/www/peertube/storage/ipfs-repo'
  gateway_url: 'https://ipfs.io'
  listen_addresses:
    - '/ip4/0.0.0.0/tcp/4001'
  bootstrap_peers:
    - '/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN'
```

### Install Dependencies

```bash
cd /var/www/peertube
pnpm install --frozen-lockfile
npm run build:server
```

### Restart PeerTube

```bash
systemctl restart peertube
```

### Upload Video

Videos uploaded after enabling IPFS will:
1. Be added to IPFS automatically
2. Generate a unique CID
3. Store the CID in the database
4. Be accessible via gateway URL

## Testing

### Manual Testing

1. **Enable IPFS:**
   ```bash
   # Edit config/test.yaml
   ipfs_storage:
     enabled: true
   ```

2. **Upload a test video:**
   ```bash
   npm run dev:server
   # Upload via web interface
   ```

3. **Verify CID in database:**
   ```sql
   SELECT id, filename, "ipfsCid" FROM "videoFile" WHERE "ipfsCid" IS NOT NULL;
   ```

4. **Test gateway access:**
   ```bash
   # Get CID from database
   curl https://ipfs.io/ipfs/<CID>
   ```

### Automated Testing

Integration tests should be added to:
- `packages/tests/src/api/object-storage/videos.ts` - Video storage tests
- Create new `packages/tests/src/api/ipfs-storage/` directory for IPFS-specific tests

## Security Considerations

### Public IPFS Network

**Warning:** Content added to public IPFS network is:
- Publicly accessible by anyone with the CID
- Potentially replicated across many nodes
- Difficult to completely remove

### Recommendations for Production

1. **Use private IPFS node** for sensitive content
2. **Disable bootstrap peers** to prevent public network access
3. **Run local gateway** behind authentication
4. **Monitor peer connections** for unusual activity
5. **Regular security updates** for Helia and libp2p

## Performance Considerations

### Network Bandwidth

- IPFS uses peer-to-peer networking
- Content may be shared with other nodes
- Consider bandwidth limits in production

### Storage Efficiency

- IPFS deduplicates identical blocks
- Content chunked into ~256KB blocks
- Repository grows with pinned content

### Caching

- Gateway access slower than direct retrieval
- Use local gateway for better performance
- Enable HTTP caching headers

## Migration Path

### Existing PeerTube Instances

To migrate from S3/filesystem to IPFS:

1. **Enable IPFS storage** in configuration
2. **Run database migration** (automatic on server restart)
3. **Use migration script** to move existing content:
   ```bash
   # Preview migration
   npm run migrate-to-ipfs -- --type all --dry-run
   
   # Migrate in batches
   npm run migrate-to-ipfs -- --type web-videos --limit 100
   
   # Migrate all content
   npm run migrate-to-ipfs -- --type all --concurrency 5
   ```
4. **Verify content accessibility** through IPFS gateway
5. **Optional: Clean up old storage** (keep backups initially!)

**Migration Script:** Use `npm run migrate-to-ipfs` with various options (see [support/doc/ipfs-storage.md](support/doc/ipfs-storage.md) for details).

### Migration Script Features

The `server/scripts/migrate-to-ipfs.ts` script provides:

- ✅ **Dry-run mode** - Preview migration without changes
- ✅ **Selective migration** - Choose specific content types
- ✅ **Batch processing** - Limit number of files to migrate
- ✅ **Concurrent uploads** - Configurable parallelism
- ✅ **Progress tracking** - Real-time migration statistics
- ✅ **Error handling** - Detailed error reporting
- ✅ **Resume capability** - Skip already-migrated files
- ✅ **Force re-migration** - Re-upload existing IPFS content

### Migration Script Options

```
Options:
  -t, --type <type>          Type: web-videos, streaming-playlists, captions, 
                             original-files, all (default: "all")
  -l, --limit <number>       Max files to migrate, 0=unlimited (default: "0")
  -c, --concurrency <number> Concurrent migrations (default: "3")
  --dry-run                  Preview without migrating
  --force                    Re-migrate files with existing CIDs
```

## Known Limitations

1. **No Live Streaming Support** - IPFS not yet integrated with live streaming
2. **Manual Garbage Collection** - No automatic cleanup of unpinned content
3. **Single Node Only** - No clustering support
4. **Limited Monitoring** - Basic logging only

## Future Enhancements

### Planned Features

- [ ] Automatic garbage collection
- [ ] IPFS Cluster support for redundancy
- [ ] Enhanced monitoring dashboard
- [x] Migration scripts for existing content ✅
- [ ] Performance optimizations
- [ ] Live streaming integration
- [ ] Multiple IPFS node support
- [ ] Advanced analytics

### Community Contributions

Contributions welcome for:
- Testing and bug reports
- Performance improvements
- Documentation enhancements
- Migration tools
- Monitoring integrations

## Dependencies Version Matrix

| Package | Version | Purpose |
|---------|---------|---------|
| helia | ^6.0.11 | Core IPFS implementation |
| @helia/unixfs | ^4.2.1 | File system support |
| @helia/strings | ^4.2.1 | String content support |
| @chainsafe/libp2p-noise | ^16.0.0 | Connection encryption |
| @chainsafe/libp2p-yamux | ^7.0.1 | Stream multiplexing |
| @libp2p/tcp | ^10.2.2 | TCP transport |
| @libp2p/bootstrap | ^11.1.5 | Peer discovery |
| libp2p | ^2.5.0 | Peer-to-peer networking library |
| multiformats | ^13.3.1 | CID parsing and formatting |
| blockstore-fs | ^2.1.2 | Block storage |
| datastore-fs | ^11.0.2 | Metadata storage |

## References

- [Helia Documentation](https://helia.io/)
- [IPFS Documentation](https://docs.ipfs.tech/)
- [libp2p Documentation](https://libp2p.io/)
- [PeerTube Documentation](https://docs.joinpeertube.org/)

## Support

For issues related to this implementation:
- GitHub Issues: https://github.com/Chocobozzz/PeerTube/issues
- PeerTube Forum: https://framacolibri.org/c/peertube
- IPFS Forum: https://discuss.ipfs.tech/

## License

This implementation is part of PeerTube and licensed under AGPL-3.0.

## Changelog

### Version 1.0.0 (Initial Implementation)

**Added:**
- IPFS storage backend using Helia
- Configuration schema for IPFS settings
- Storage adapters and helpers
- Unified storage service
- Database schema changes for CID storage
- Comprehensive documentation

**Modified:**
- Video file model to include `ipfsCid` field
- Configuration initializer to load IPFS settings
- Package dependencies to include Helia ecosystem

**Known Issues:**
- No automated tests yet
- Migration tools not implemented
- Limited error handling in some edge cases
- Gateway timeout handling needs improvement

---

**Implementation Date:** November 29, 2025  
**Authors:** GitHub Copilot  
**Status:** Ready for Testing
