import { omit, pick } from '@peertube/peertube-core-utils'
import {
  VideoPrivacy,
  VideoPlaylistPrivacy,
  VideoPlaylistCreateResult,
  Account,
  HTMLServerConfig,
  ServerConfig,
  ActorImageType
} from '@peertube/peertube-models'
import {
  createMultipleServers,
  setAccessTokensToServers,
  doubleFollow,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'

export function getWatchVideoBasePaths () {
  return [ '/videos/watch/', '/w/' ]
}

export function getWatchPlaylistBasePaths () {
  return [ '/videos/watch/playlist/', '/w/p/' ]
}

export function checkIndexTags (html: string, title: string, description: string, css: string, config: ServerConfig) {
  expect(html).to.contain('<title>' + title + '</title>')
  expect(html).to.contain('<meta name="description" content="' + description + '" />')

  if (css) {
    expect(html).to.contain('<style class="custom-css-style">' + css + '</style>')
  }

  const htmlConfig: HTMLServerConfig = omit(config, [ 'signup' ])
  const configObjectString = JSON.stringify(htmlConfig)
  const configEscapedString = JSON.stringify(configObjectString)

  expect(html).to.contain(`<script type="application/javascript">window.PeerTubeServerConfig = ${configEscapedString}</script>`)
}

export async function prepareClientTests () {
  const servers = await createMultipleServers(2)

  await setAccessTokensToServers(servers)
  await doubleFollow(servers[0], servers[1])
  await setDefaultVideoChannel(servers)

  const instanceConfig = {
    name: 'super instance title',
    shortDescription: 'super instance description',
    avatar: 'avatar.png'
  }

  await servers[0].config.updateExistingConfig({
    newConfig: {
      instance: { ...pick(instanceConfig, [ 'name', 'shortDescription' ]) }
    }
  })
  await servers[0].config.updateInstanceImage({ type: ActorImageType.AVATAR, fixture: instanceConfig.avatar })

  let account: Account

  let videoIds: (string | number)[] = []
  let privateVideoId: string
  let internalVideoId: string
  let unlistedVideoId: string
  let passwordProtectedVideoId: string

  let playlistIds: (string | number)[] = []
  let privatePlaylistId: string
  let unlistedPlaylistId: string

  const videoName = 'my super name for server 1'
  const videoDescription = 'my<br> super __description__ for *server* 1<p></p>'
  const videoDescriptionPlainText = 'my super description for server 1'

  const playlistName = 'super playlist name'
  const playlistDescription = 'super playlist description'
  let playlist: VideoPlaylistCreateResult

  const channelDescription = 'my super channel description'

  await servers[0].channels.update({
    channelName: servers[0].store.channel.name,
    attributes: { description: channelDescription }
  })

  await servers[0].channels.updateImage({ channelName: servers[0].store.channel.name, fixture: 'avatar.png', type: 'avatar' })

  // Public video

  {
    const attributes = { name: videoName, description: videoDescription }
    await servers[0].videos.upload({ attributes })

    const { data } = await servers[0].videos.list()
    expect(data.length).to.equal(1)

    const video = data[0]
    servers[0].store.video = video
    videoIds = [ video.id, video.uuid, video.shortUUID ]
  }

  {
    ({ uuid: privateVideoId } = await servers[0].videos.quickUpload({ name: 'private', privacy: VideoPrivacy.PRIVATE }));
    ({ uuid: unlistedVideoId } = await servers[0].videos.quickUpload({ name: 'unlisted', privacy: VideoPrivacy.UNLISTED }));
    ({ uuid: internalVideoId } = await servers[0].videos.quickUpload({ name: 'internal', privacy: VideoPrivacy.INTERNAL }));
    ({ uuid: passwordProtectedVideoId } = await servers[0].videos.quickUpload({
      name: 'password protected',
      privacy: VideoPrivacy.PASSWORD_PROTECTED,
      videoPasswords: [ 'password' ]
    }))
  }

  // Playlists
  {
    // Public playlist
    {
      const attributes = {
        displayName: playlistName,
        description: playlistDescription,
        privacy: VideoPlaylistPrivacy.PUBLIC,
        videoChannelId: servers[0].store.channel.id
      }

      playlist = await servers[0].playlists.create({ attributes })
      playlistIds = [ playlist.id, playlist.shortUUID, playlist.uuid ]

      await servers[0].playlists.addElement({ playlistId: playlist.shortUUID, attributes: { videoId: servers[0].store.video.id } })
    }

    // Unlisted playlist
    {
      const attributes = {
        displayName: 'unlisted',
        privacy: VideoPlaylistPrivacy.UNLISTED,
        videoChannelId: servers[0].store.channel.id
      }

      const { uuid } = await servers[0].playlists.create({ attributes })
      unlistedPlaylistId = uuid
    }

    {
      const attributes = {
        displayName: 'private',
        privacy: VideoPlaylistPrivacy.PRIVATE
      }

      const { uuid } = await servers[0].playlists.create({ attributes })
      privatePlaylistId = uuid
    }
  }

  // Account
  {
    await servers[0].users.updateMe({ description: 'my account description' })

    account = await servers[0].accounts.get({ accountName: `${servers[0].store.user.username}@${servers[0].host}` })
  }

  await waitJobs(servers)

  return {
    servers,

    instanceConfig,

    account,

    channelDescription,

    playlist,
    playlistName,
    playlistIds,
    playlistDescription,

    privatePlaylistId,
    unlistedPlaylistId,

    privateVideoId,
    unlistedVideoId,
    internalVideoId,
    passwordProtectedVideoId,

    videoName,
    videoDescription,
    videoDescriptionPlainText,
    videoIds
  }
}
