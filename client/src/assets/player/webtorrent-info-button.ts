import { VideoJSComponentInterface, videojsUntyped } from './peertube-videojs-typings'
import { bytes } from './utils'

const Button: VideoJSComponentInterface = videojsUntyped.getComponent('Button')
class WebtorrentInfoButton extends Button {
  createEl () {
    const div = videojsUntyped.dom.createEl('div', {
      className: 'vjs-peertube'
    })
    const subDivWebtorrent = videojsUntyped.dom.createEl('div', {
      className: 'vjs-peertube-hidden' // Hide the stats before we get the info
    })
    div.appendChild(subDivWebtorrent)

    const downloadIcon = videojsUntyped.dom.createEl('span', {
      className: 'icon icon-download'
    })
    subDivWebtorrent.appendChild(downloadIcon)

    const downloadSpeedText = videojsUntyped.dom.createEl('span', {
      className: 'download-speed-text'
    })
    const downloadSpeedNumber = videojsUntyped.dom.createEl('span', {
      className: 'download-speed-number'
    })
    const downloadSpeedUnit = videojsUntyped.dom.createEl('span')
    downloadSpeedText.appendChild(downloadSpeedNumber)
    downloadSpeedText.appendChild(downloadSpeedUnit)
    subDivWebtorrent.appendChild(downloadSpeedText)

    const uploadIcon = videojsUntyped.dom.createEl('span', {
      className: 'icon icon-upload'
    })
    subDivWebtorrent.appendChild(uploadIcon)

    const uploadSpeedText = videojsUntyped.dom.createEl('span', {
      className: 'upload-speed-text'
    })
    const uploadSpeedNumber = videojsUntyped.dom.createEl('span', {
      className: 'upload-speed-number'
    })
    const uploadSpeedUnit = videojsUntyped.dom.createEl('span')
    uploadSpeedText.appendChild(uploadSpeedNumber)
    uploadSpeedText.appendChild(uploadSpeedUnit)
    subDivWebtorrent.appendChild(uploadSpeedText)

    const peersText = videojsUntyped.dom.createEl('span', {
      className: 'peers-text'
    })
    const peersNumber = videojsUntyped.dom.createEl('span', {
      className: 'peers-number'
    })
    subDivWebtorrent.appendChild(peersNumber)
    subDivWebtorrent.appendChild(peersText)

    const subDivHttp = videojsUntyped.dom.createEl('div', {
      className: 'vjs-peertube-hidden'
    })
    const subDivHttpText = videojsUntyped.dom.createEl('span', {
      className: 'peers-number',
      textContent: 'HTTP'
    })
    const subDivFallbackText = videojsUntyped.dom.createEl('span', {
      className: 'peers-text',
      textContent: ' fallback'
    })

    subDivHttp.appendChild(subDivHttpText)
    subDivHttp.appendChild(subDivFallbackText)
    div.appendChild(subDivHttp)

    this.player_.peertube().on('torrentInfo', (event, data) => {
      // We are in HTTP fallback
      if (!data) {
        subDivHttp.className = 'vjs-peertube-displayed'
        subDivWebtorrent.className = 'vjs-peertube-hidden'

        return
      }

      const downloadSpeed = bytes(data.downloadSpeed)
      const uploadSpeed = bytes(data.uploadSpeed)
      const numPeers = data.numPeers

      downloadSpeedNumber.textContent = downloadSpeed[ 0 ]
      downloadSpeedUnit.textContent = ' ' + downloadSpeed[ 1 ]

      uploadSpeedNumber.textContent = uploadSpeed[ 0 ]
      uploadSpeedUnit.textContent = ' ' + uploadSpeed[ 1 ]

      peersNumber.textContent = numPeers
      peersText.textContent = ' peers'

      subDivHttp.className = 'vjs-peertube-hidden'
      subDivWebtorrent.className = 'vjs-peertube-displayed'
    })

    return div
  }
}
Button.registerComponent('WebTorrentButton', WebtorrentInfoButton)
