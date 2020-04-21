import videojs from 'video.js'

const Component = videojs.getComponent('Component')

class SettingsPanelChild extends Component {

  constructor (player: videojs.Player, options?: videojs.ComponentOptions) {
    super(player, options)
  }

  createEl () {
    return super.createEl('div', {
      className: 'vjs-settings-panel-child',
      innerHTML: '',
      tabIndex: -1
    })
  }
}

Component.registerComponent('SettingsPanelChild', SettingsPanelChild)

export { SettingsPanelChild }
