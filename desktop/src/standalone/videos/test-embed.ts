import './test-embed.scss'
import { PeerTubePlayer } from '../player/player'
import { PlayerEventType } from '../player/definitions'

window.addEventListener('load', async () => {
  const urlParts = window.location.href.split('/')
  const lastPart = urlParts[ urlParts.length - 1 ]
  const videoId = lastPart.indexOf('?') === -1 ? lastPart : lastPart.split('?')[ 0 ]

  let iframe = document.createElement('iframe')
  iframe.src = `/videos/embed/${videoId}?autoplay=1&controls=0&api=1`
  let mainElement = document.querySelector('#host')
  mainElement.appendChild(iframe)

  console.log(`Document finished loading.`)
  let player = new PeerTubePlayer(document.querySelector('iframe'))

  window[ 'player' ] = player

  console.log(`Awaiting player ready...`)
  await player.ready
  console.log(`Player is ready.`)

  let monitoredEvents = [
    'pause',
    'play',
    'playbackStatusUpdate',
    'playbackStatusChange'
  ]

  monitoredEvents.forEach(e => {
    player.addEventListener(e as PlayerEventType, () => console.log(`PLAYER: event '${e}' received`))
    console.log(`PLAYER: now listening for event '${e}'`)
  })

  let playbackRates: number[] = []
  let currentRate = await player.getPlaybackRate()

  let updateRates = async () => {
    let rateListEl = document.querySelector('#rate-list')
    rateListEl.innerHTML = ''

    playbackRates.forEach(rate => {
      if (currentRate === rate) {
        let itemEl = document.createElement('strong')
        itemEl.innerText = `${rate} (active)`
        itemEl.style.display = 'block'
        rateListEl.appendChild(itemEl)
      } else {
        let itemEl = document.createElement('a')
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

  let updateResolutions = resolutions => {
    let resolutionListEl = document.querySelector('#resolution-list')
    resolutionListEl.innerHTML = ''

    resolutions.forEach(resolution => {
      if (resolution.active) {
        let itemEl = document.createElement('strong')
        itemEl.innerText = `${resolution.label} (active)`
        itemEl.style.display = 'block'
        resolutionListEl.appendChild(itemEl)
      } else {
        let itemEl = document.createElement('a')
        itemEl.href = 'javascript:;'
        itemEl.innerText = resolution.label
        itemEl.addEventListener('click', () => {
          player.setResolution(resolution.id)
        })
        itemEl.style.display = 'block'
        resolutionListEl.appendChild(itemEl)
      }
    })
  }

  player.getResolutions().then(
    resolutions => updateResolutions(resolutions))
  player.addEventListener('resolutionUpdate',
    resolutions => updateResolutions(resolutions))
})
