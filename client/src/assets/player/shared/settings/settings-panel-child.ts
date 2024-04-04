import videojs from 'video.js'

const Component = videojs.getComponent('Component')

class SettingsPanelChild extends Component {

  createEl () {
    return super.createEl('div', {
      className: 'vjs-settings-panel-child',
      tabIndex: -1
    })
  }
}

Component.registerComponent('SettingsPanelChild', SettingsPanelChild)

export { SettingsPanelChild }
