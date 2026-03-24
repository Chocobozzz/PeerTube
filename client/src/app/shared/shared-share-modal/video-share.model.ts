export type Customizations = {
  startAtCheckbox: boolean
  startAt: number

  stopAtCheckbox: boolean
  stopAt: number

  subtitleCheckbox: boolean
  subtitle: string

  loop: boolean
  originUrl: boolean
  autoplay: boolean
  muted: boolean

  embedP2P: boolean
  onlyEmbedUrl: boolean
  title: boolean
  warningTitle: boolean
  controlBar: boolean
  peertubeLink: boolean
  responsive: boolean

  includeVideoInPlaylist: boolean
}

export type TabId = 'url' | 'qrcode' | 'embed'
