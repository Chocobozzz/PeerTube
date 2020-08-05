import './test-embed.scss'
import { PeerTubeResolution, PlayerEventType } from '../player/definitions'
import { PeerTubePlayer } from '../player/player'

window.addEventListener('load', async () => {
  const urlParts = window.location.href.split('/')
  const lastPart = urlParts[ urlParts.length - 1 ]

  const isPlaylist = window.location.pathname.startsWith('/video-playlists/')

  const elementId = lastPart.indexOf('?') === -1 ? lastPart : lastPart.split('?')[ 0 ]

  const iframe = document.createElement('iframe')
  iframe.src = isPlaylist
    ? `/videos/embed/${elementId}?api=1`
    : `/video-playlists/embed/${elementId}?api=1`

  const mainElement = document.querySelector('#host')
  mainElement.appendChild(iframe)

  console.log(`Document finished loading.`)
  const player = new PeerTubePlayer(document.querySelector('iframe'))

  window[ 'player' ] = player

  console.log(`Awaiting player ready...`)
  await player.ready
  console.log(`Player is ready.`)

  const monitoredEvents = [
    'pause',
    'play',
    'playbackStatusUpdate',
    'playbackStatusChange'
  ]

  monitoredEvents.forEach(e => {
    player.addEventListener(e as PlayerEventType, (param) => console.log(`PLAYER: event '${e}' received`, param))
    console.log(`PLAYER: now listening for event '${e}'`)

    player.getCurrentPosition()
      .then(position => document.getElementById('playlist-position').innerHTML = position + '')
  })

  let playbackRates: number[] = []
  let currentRate = await player.getPlaybackRate()

  const updateRates = async () => {
    const rateListEl = document.querySelector('#rate-list')
    rateListEl.innerHTML = ''

    playbackRates.forEach(rate => {
      if (currentRate === rate) {
        const itemEl = document.createElement('strong')
        itemEl.innerText = `${rate} (active)`
        itemEl.style.display = 'block'
        rateListEl.appendChild(itemEl)
      } else {
        const itemEl = document.createElement('a')
        itemEl.href = 'javascript:;'
        itemEl.innerText = rate.toString()
        itemEl.addEventListener('click', () => {
          player.setPlaybackRate(rate)
          currentRate = rate
          updateRates()
        })
        itemEl.style.display = 'block'
        rateListEl.appendChild(itemEl)
      }
    })
  }

  player.getPlaybackRates().then(rates => {
    playbackRates = rates
    updateRates()
  })

  const updateCaptions = async () => {
    const captions = await player.getCaptions()

    const captionEl = document.querySelector('#caption-list')
    captionEl.innerHTML = ''

    captions.forEach(c => {
      console.log(c)

      if (c.mode === 'showing') {
        const itemEl = document.createElement('strong')
        itemEl.innerText = `${c.label} (active)`
        itemEl.style.display = 'block'
        captionEl.appendChild(itemEl)
      } else {
        const itemEl = document.createElement('a')
        itemEl.href = 'javascript:;'
        itemEl.innerText = c.label
        itemEl.addEventListener('click', () => {
          player.setCaption(c.id)
          updateCaptions()
        })
        itemEl.style.display = 'block'
        captionEl.appendChild(itemEl)
      }
    })
  }

  updateCaptions()

  const updateResolutions = ((resolutions: PeerTubeResolution[]) => {
    const resolutionListEl = document.querySelector('#resolution-list')
    resolutionListEl.innerHTML = ''

    resolutions.forEach(resolution => {
      if (resolution.active) {
        const itemEl = document.createElement('strong')
        itemEl.innerText = `${resolution.label} (active)`
        itemEl.style.display = 'block'
        resolutionListEl.appendChild(itemEl)
      } else {
        const itemEl = document.createElement('a')
        itemEl.href = 'javascript:;'
        itemEl.innerText = resolution.label
        itemEl.addEventListener('click', () => {
          player.setResolution(resolution.id)
        })
        itemEl.style.display = 'block'
        resolutionListEl.appendChild(itemEl)
      }
    })
  })

  player.getResolutions().then(
    resolutions => updateResolutions(resolutions))
  player.addEventListener('resolutionUpdate',
    resolutions => updateResolutions(resolutions))

  const updateVolume = (volume: number) => {
    const volumeEl = document.getElementById('volume')
    volumeEl.innerText = (volume * 100) + '%'
  }

  player.getVolume().then(volume => updateVolume(volume))
  player.addEventListener('volumeChange', volume => updateVolume(volume))
})
