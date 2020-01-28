import videojs, { VideoJsPlayer } from 'video.js'

const Component = videojs.getComponent('Component')

class SettingsPanel extends Component {

  constructor (player: VideoJsPlayer, options?: videojs.ComponentOptions) {
    super(player, options)
  }

  createEl () {
    return super.createEl('div', {
      className: 'vjs-settings-panel',
      innerHTML: '',
      tabIndex: -1
    })
  }
}

Component.registerComponent('SettingsPanel', SettingsPanel)

export { SettingsPanel }
