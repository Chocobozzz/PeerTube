# IPFS Storage Backend for PeerTube

This document describes how to configure and use IPFS (InterPlanetary File System) as a decentralized storage backend for PeerTube using Helia.

## Overview

PeerTube now supports IPFS as an alternative storage backend to traditional S3-compatible object storage. When enabled, video files, streaming playlists, captions, and other resources are stored on IPFS instead of local filesystem or S3.

**Key Features:**
- Decentralized content storage using IPFS
- Content-addressable storage (files identified by CID - Content Identifier)
- Built on Helia, the modern IPFS implementation for JavaScript
- Seamless integration with existing PeerTube architecture
- Gateway support for HTTP access to IPFS content

## Architecture

### Components

1. **Helia IPFS Node** - Core IPFS implementation running within PeerTube
2. **UnixFS** - File system abstraction for IPFS
3. **libp2p** - Peer-to-peer networking stack
4. **Storage Adapters** - Interface layer between PeerTube and IPFS

### Storage Flow

```
Video Upload → PeerTube → IPFS Storage Adapter → Helia Node → IPFS Network
                                                      ↓
                                            CID stored in database
```

## Configuration

### Prerequisites

Before enabling IPFS storage, ensure you have:
- Node.js >= 20.x
- Sufficient disk space for IPFS repository (blocks and datastore)
- Network connectivity if using public IPFS bootstrap nodes

### Basic Configuration

Edit your PeerTube configuration file (e.g., `config/production.yaml`):

```yaml
ipfs_storage:
  # Enable IPFS storage backend
  enabled: true

  # IPFS node repository path (where blocks and datastore are stored)
  # Default: storage.tmp/ipfs-repo
  repo_path: '/var/www/peertube/storage/ipfs-repo'

  # IPFS gateway URL for HTTP access to content
  # If not set, URLs will use ipfs:// protocol
  gateway_url: 'https://ipfs.io'  # or your own gateway

  # Multiaddresses for the IPFS node to listen on
  listen_addresses:
    - '/ip4/0.0.0.0/tcp/4001'
    - '/ip4/0.0.0.0/tcp/4002/ws'

  # Bootstrap peers for IPFS network discovery
  # Leave empty for local-only node
  bootstrap_peers:
    - '/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN'
    - '/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa'
    - '/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb'
    - '/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt'

  # IPFS storage for different resource types
  streaming_playlists:
    bucket_name: 'streaming-playlists-ipfs'
    prefix: 'hls/'

  web_videos:
    bucket_name: 'web-videos-ipfs'
    prefix: 'videos/'

  user_exports:
    bucket_name: 'user-exports-ipfs'
    prefix: 'exports/'

  original_video_files:
    bucket_name: 'original-video-files-ipfs'
    prefix: 'originals/'

  captions:
    bucket_name: 'captions-ipfs'
    prefix: 'captions/'
```

### Advanced Configuration

#### Private/Local IPFS Node

For a private IPFS node that doesn't connect to the public network:

```yaml
ipfs_storage:
  enabled: true
  repo_path: '/var/www/peertube/storage/ipfs-repo'
  gateway_url: 'http://localhost:8080'
  listen_addresses:
    - '/ip4/127.0.0.1/tcp/4001'
  bootstrap_peers: []  # Empty array for no public connectivity
```

#### Custom Gateway

To use your own IPFS gateway:

```yaml
ipfs_storage:
  enabled: true
  gateway_url: 'https://your-gateway.example.com'
```

## Installation

### 1. Install Dependencies

```bash
cd /var/www/peertube
pnpm install --frozen-lockfile
```

This will install the required IPFS dependencies:
- `helia` - Core IPFS implementation
- `@helia/unixfs` - File system operations
- `@helia/strings` - String content support
- `@chainsafe/libp2p-noise` - Connection encryption
- `@chainsafe/libp2p-yamux` - Stream multiplexing
- `@libp2p/tcp` - TCP transport
- `@libp2p/bootstrap` - Peer discovery
- `blockstore-fs` - Filesystem blockstore
- `datastore-fs` - Filesystem datastore

### 2. Run Database Migration

The IPFS storage feature requires database schema changes:

```bash
# Stop PeerTube
systemctl stop peertube

# Run migrations
cd /var/www/peertube
npm run build:server

# Start PeerTube
systemctl start peertube
```

The migration adds the following fields:
- `videoFile.ipfsCid` - IPFS Content Identifier for video files
- `videoStreamingPlaylist.ipfsCid` - CID for HLS playlists
- `videoCaption.ipfsCid` - CID for caption files
- `videoSource.ipfsCid` - CID for original video sources

### 3. Configure and Enable

1. Edit your configuration file as described above
2. Ensure the `repo_path` directory exists and has proper permissions:

```bash
mkdir -p /var/www/peertube/storage/ipfs-repo
chown -R peertube:peertube /var/www/peertube/storage/ipfs-repo
chmod 750 /var/www/peertube/storage/ipfs-repo
```

3. Restart PeerTube:

```bash
systemctl restart peertube
```

## Usage

### Uploading Videos

Once IPFS storage is enabled, all new video uploads will automatically:
1. Be added to the IPFS node
2. Generate a Content Identifier (CID)
3. Store the CID in the database
4. Pin the content to ensure persistence

### Accessing Content

Videos stored in IPFS can be accessed via:

1. **IPFS Gateway** (if configured):
   ```
   https://ipfs.io/ipfs/QmXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxX
   ```

2. **IPFS Protocol** (requires IPFS-enabled browser/extension):
   ```
   ipfs://QmXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxX
   ```

3. **PeerTube Proxy** (standard playback):
   PeerTube will fetch content from IPFS and serve it to clients

### Migrating Existing Content

PeerTube includes a migration script to move existing videos from filesystem or S3 storage to IPFS.

#### Migration Script Usage

```bash
# Migrate all content types
npm run migrate-to-ipfs -- --type all

# Migrate only web videos
npm run migrate-to-ipfs -- --type web-videos

# Migrate only streaming playlists (HLS)
npm run migrate-to-ipfs -- --type streaming-playlists

# Migrate only captions
npm run migrate-to-ipfs -- --type captions

# Migrate only original video files
npm run migrate-to-ipfs -- --type original-files

# Dry run (show what would be migrated without actually migrating)
npm run migrate-to-ipfs -- --type all --dry-run

# Limit number of files to migrate
npm run migrate-to-ipfs -- --type web-videos --limit 100

# Set concurrency (number of parallel migrations)
npm run migrate-to-ipfs -- --type all --concurrency 5

# Force re-migration of files that already have IPFS CIDs
npm run migrate-to-ipfs -- --type all --force
```

#### Migration Options

- `--type <type>` - Type of files to migrate:
  - `web-videos` - Standard MP4 video files
  - `streaming-playlists` - HLS streaming playlists and segments
  - `captions` - Video caption files
  - `original-files` - Original uploaded video files
  - `all` - All of the above (default)

- `--limit <number>` - Maximum number of files to migrate (0 = unlimited, default: 0)

- `--concurrency <number>` - Number of concurrent migrations (default: 3)

- `--dry-run` - Preview migration without actually uploading to IPFS

- `--force` - Re-migrate files that already have IPFS CIDs

#### Migration Process

The migration script:

1. **Validates** IPFS is enabled in configuration
2. **Initializes** the Helia IPFS node
3. **Scans** the database for files without IPFS CIDs (or all files if `--force`)
4. **Uploads** each file to IPFS and generates a CID
5. **Updates** the database with the CID and new file URL
6. **Marks** files as stored in object storage
7. **Prints** statistics on completion

#### Example Migration Workflow

```bash
# Step 1: Dry run to see what will be migrated
npm run migrate-to-ipfs -- --type all --dry-run

# Step 2: Migrate in small batches first
npm run migrate-to-ipfs -- --type web-videos --limit 10

# Step 3: Verify the migrated videos work correctly
# Check video playback in PeerTube web interface

# Step 4: Migrate remaining content
npm run migrate-to-ipfs -- --type all --concurrency 5

# Step 5: Check migration statistics
# Review logs for any failed migrations
```

#### Handling Migration Failures

If some files fail to migrate:

1. **Check logs** for specific error messages:
   ```bash
   tail -f /var/www/peertube/storage/logs/peertube.log
   ```

2. **Common issues:**
   - File not found on filesystem
   - Insufficient disk space in IPFS repo
   - Network connectivity issues
   - Permission errors

3. **Retry failed migrations:**
   ```bash
   # The script automatically skips successfully migrated files
   npm run migrate-to-ipfs -- --type all
   ```

4. **Force re-migration** if needed:
   ```bash
   npm run migrate-to-ipfs -- --type web-videos --force
   ```

#### Post-Migration Cleanup

After successful migration, you can optionally:

1. **Keep original files** as backup (recommended initially)
2. **Remove from S3** if migrating from object storage
3. **Delete from filesystem** if migrating from local storage

**Warning:** Only delete original files after verifying IPFS storage works correctly!

```bash
# Verify all files have IPFS CIDs
psql -U peertube -d peertube_production -c "
SELECT 
  (SELECT COUNT(*) FROM \"videoFile\" WHERE \"ipfsCid\" IS NULL) as videos_without_cid,
  (SELECT COUNT(*) FROM \"videoStreamingPlaylist\" WHERE \"ipfsCid\" IS NULL) as playlists_without_cid,
  (SELECT COUNT(*) FROM \"videoCaption\" WHERE \"ipfsCid\" IS NULL) as captions_without_cid,
  (SELECT COUNT(*) FROM \"videoSource\" WHERE \"ipfsCid\" IS NULL) as sources_without_cid;
"
```

## Monitoring

### Check IPFS Node Status

Monitor the IPFS node through PeerTube logs:

```bash
tail -f /var/www/peertube/storage/logs/peertube.log | grep IPFS
```

### View Peer Connections

The Helia node peer ID is logged on startup:

```
[2025-11-29 10:00:00] info: Helia IPFS node initialized successfully
  peerId: '12D3KooWXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
  repoPath: '/var/www/peertube/storage/ipfs-repo'
```

### Storage Usage

Check IPFS repository size:

```bash
du -sh /var/www/peertube/storage/ipfs-repo
```

## Performance Considerations

### Network Bandwidth

IPFS nodes communicate with peers over the network. Consider:
- **Bandwidth limits** - IPFS can consume significant bandwidth if sharing content
- **Firewall rules** - Ensure ports 4001 and 4002 are accessible if using public bootstrap
- **NAT traversal** - May need port forwarding for optimal connectivity

### Storage

- IPFS stores content in blocks (typically 256KB chunks)
- Duplicate blocks are deduplicated automatically
- Repository grows with pinned content
- Regular garbage collection may be needed (currently manual)

### Caching

- Gateway access is slower than direct IPFS retrieval
- Consider using a local gateway for better performance
- Enable HTTP caching headers for gateway responses

## Troubleshooting

### Common Issues

#### 1. IPFS Node Fails to Start

**Symptoms:**
```
Error: Failed to initialize Helia IPFS node
```

**Solutions:**
- Check `repo_path` exists and is writable
- Verify Node.js version >= 20.x
- Check for port conflicts (4001, 4002)
- Review logs for specific error messages

#### 2. Content Not Accessible

**Symptoms:**
- Videos fail to play
- 404 errors on IPFS gateway

**Solutions:**
- Verify IPFS node is running (check logs)
- Confirm content is pinned: check database `ipfsCid` field
- Test gateway URL manually
- Check network connectivity to IPFS network

#### 3. Slow Upload/Download

**Symptoms:**
- Video uploads take longer than expected
- Playback is slow or buffering

**Solutions:**
- Use a local IPFS gateway
- Increase `listen_addresses` for more connections
- Add more bootstrap peers
- Check network bandwidth

#### 4. Database Migration Errors

**Symptoms:**
```
Error running migration 0950-ipfs-storage
```

**Solutions:**
- Ensure database user has ALTER TABLE permissions
- Check PostgreSQL version >= 10.x
- Review migration logs for specific SQL errors

### Debug Logging

Enable verbose IPFS logging:

```yaml
log:
  level: 'debug'  # or 'info'
```

Then restart PeerTube and check logs:

```bash
tail -f /var/www/peertube/storage/logs/peertube.log
```

## Security Considerations

### Content Privacy

**Important:** IPFS is a public network. Content added to IPFS may be:
- Accessible by anyone with the CID
- Replicated across multiple nodes
- Difficult to completely remove

For private content:
1. Use a local-only IPFS node (no bootstrap peers)
2. Run your own private IPFS network
3. Disable public gateway access
4. Consider traditional S3 storage instead

### Access Control

PeerTube's access control is enforced at the application layer:
- Private videos: IPFS CID not exposed publicly
- Authentication required before generating playback URLs
- Gateway requests proxied through PeerTube

### Network Security

- Keep IPFS node behind firewall for production
- Use VPN or private network for node-to-node communication
- Monitor unusual peer connections
- Regularly update Helia and libp2p dependencies

## API Changes

### Video File Object

The video file API response now includes IPFS information:

```json
{
  "id": 123,
  "resolution": 1080,
  "size": 1234567890,
  "fileUrl": "https://ipfs.io/ipfs/QmXxxxxx",
  "storage": 1,
  "ipfsCid": "QmXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxX"
}
```

### Storage Type

A new storage backend type is available:
- `0` - FILE_SYSTEM
- `1` - OBJECT_STORAGE (S3)
- IPFS uses OBJECT_STORAGE flag with `ipfsCid` populated

## Limitations

### Current Limitations

1. **No Live Streaming** - IPFS storage not yet supported for live streams
2. **Manual Garbage Collection** - Unpinned content removal requires manual intervention
3. **Single Node** - No clustering/multiple IPFS nodes support
4. **Limited Analytics** - IPFS access tracking not implemented
5. **Migration Tools** - No built-in tools to migrate existing content

### Planned Improvements

- Automatic garbage collection for unpinned content
- Multi-node IPFS cluster support
- Enhanced monitoring and analytics
- Migration scripts for existing content
- IPFS Cluster integration for redundancy

## References

- [Helia Documentation](https://helia.io/)
- [IPFS Documentation](https://docs.ipfs.tech/)
- [libp2p Documentation](https://libp2p.io/)
- [PeerTube Documentation](https://docs.joinpeertube.org/)

## Support

For issues and questions:
- PeerTube Forum: https://framacolibri.org/c/peertube
- GitHub Issues: https://github.com/Chocobozzz/PeerTube/issues
- IPFS Forum: https://discuss.ipfs.tech/

## License

This IPFS storage implementation is part of PeerTube and licensed under AGPL-3.0.

---

## Quick Reference

### Common Commands

```bash
# Install dependencies
pnpm install --frozen-lockfile

# Build server with IPFS support
npm run build:server

# Preview migration (no changes)
npm run migrate-to-ipfs -- --dry-run

# Migrate web videos (batch of 50)
npm run migrate-to-ipfs -- --type web-videos --limit 50

# Migrate all content (5 concurrent)
npm run migrate-to-ipfs -- --type all --concurrency 5

# Check migration status
psql -U peertube -d peertube_production -c "
SELECT 
  (SELECT COUNT(*) FROM \"videoFile\" WHERE \"ipfsCid\" IS NOT NULL) as videos_migrated,
  (SELECT COUNT(*) FROM \"videoFile\" WHERE \"ipfsCid\" IS NULL) as videos_pending
"

# View IPFS logs
tail -f /var/www/peertube/storage/logs/peertube.log | grep -i ipfs

# Check IPFS repo size
du -sh /var/www/peertube/storage/ipfs-repo
```

### Configuration Template

Minimal IPFS configuration for production:

```yaml
ipfs_storage:
  enabled: true
  repo_path: '/var/www/peertube/storage/ipfs-repo'
  gateway_url: 'https://ipfs.io'
  listen_addresses:
    - '/ip4/0.0.0.0/tcp/4001'
  bootstrap_peers:
    - '/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN'
  web_videos:
    bucket_name: 'web-videos-ipfs'
    prefix: 'videos/'
  streaming_playlists:
    bucket_name: 'streaming-playlists-ipfs'
    prefix: 'hls/'
```

### Troubleshooting Checklist

- [ ] IPFS enabled in configuration (`ipfs_storage.enabled: true`)
- [ ] Dependencies installed (`pnpm install --frozen-lockfile`)
- [ ] Server built (`npm run build:server`)
- [ ] Database migration completed (automatic on restart)
- [ ] IPFS repo directory exists and is writable
- [ ] Ports 4001/4002 accessible (if using public network)
- [ ] Gateway URL accessible (if configured)
- [ ] Sufficient disk space for IPFS repository

### Migration Workflow

1. **Preparation**
   ```bash
   # Backup database
   pg_dump peertube_production > backup.sql
   
   # Enable IPFS in config
   vim config/production.yaml
   
   # Build and restart
   npm run build:server
   systemctl restart peertube
   ```

2. **Test Migration**
   ```bash
   # Dry run
   npm run migrate-to-ipfs -- --dry-run --limit 5
   
   # Migrate 5 videos
   npm run migrate-to-ipfs -- --type web-videos --limit 5
   
   # Verify playback works
   ```

3. **Full Migration**
   ```bash
   # Migrate in batches
   npm run migrate-to-ipfs -- --type web-videos --limit 100
   npm run migrate-to-ipfs -- --type streaming-playlists --limit 100
   npm run migrate-to-ipfs -- --type captions
   npm run migrate-to-ipfs -- --type original-files
   ```

4. **Verification**
   ```bash
   # Check all files migrated
   psql -U peertube -d peertube_production -c "
   SELECT 
     'videoFile' as table_name,
     COUNT(*) as total,
     COUNT(\"ipfsCid\") as with_cid,
     COUNT(*) - COUNT(\"ipfsCid\") as without_cid
   FROM \"videoFile\"
   UNION ALL
   SELECT 
     'videoStreamingPlaylist',
     COUNT(*),
     COUNT(\"ipfsCid\"),
     COUNT(*) - COUNT(\"ipfsCid\")
   FROM \"videoStreamingPlaylist\"
   UNION ALL
   SELECT 
     'videoCaption',
     COUNT(*),
     COUNT(\"ipfsCid\"),
     COUNT(*) - COUNT(\"ipfsCid\")
   FROM \"videoCaption\"
   UNION ALL
   SELECT 
     'videoSource',
     COUNT(*),
     COUNT(\"ipfsCid\"),
     COUNT(*) - COUNT(\"ipfsCid\")
   FROM \"videoSource\"
   "
   ```

### Performance Tuning

For optimal IPFS performance:

```yaml
ipfs_storage:
  # Use local gateway for better performance
  gateway_url: 'http://localhost:8080'
  
  # More listen addresses for better connectivity
  listen_addresses:
    - '/ip4/0.0.0.0/tcp/4001'
    - '/ip4/0.0.0.0/tcp/4002/ws'
    - '/ip6/::/tcp/4001'
    - '/ip6/::/tcp/4002/ws'
  
  # Add more bootstrap peers
  bootstrap_peers:
    - '/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN'
    - '/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa'
    - '/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb'
    - '/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt'
```

Migration settings:

```bash
# Increase concurrency for faster migration (use with caution)
npm run migrate-to-ipfs -- --type all --concurrency 10

# Batch large migrations
npm run migrate-to-ipfs -- --type web-videos --limit 1000 --concurrency 5
```
