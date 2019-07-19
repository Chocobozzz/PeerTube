async function register ({ registerHook, registerSetting, settingsManager, storageManager }) {
  const defaultAdmin = 'PeerTube admin'

  registerHook({
    target: 'action:application.listening',
    handler: () => displayHelloWorld(settingsManager, defaultAdmin)
  })

  registerSetting({
    name: 'admin-name',
    label: 'Admin name',
    type: 'input',
    default: defaultAdmin
  })

  const value = await storageManager.getData('toto')
  console.log(value)
  console.log(value.coucou)

  await storageManager.storeData('toto', { coucou: 'hello' + new Date() })
}

async function unregister () {
  return
}

module.exports = {
  register,
  unregister
}

// ############################################################################

async function displayHelloWorld (settingsManager, defaultAdmin) {
  let value = await settingsManager.getSetting('admin-name')
  if (!value) value = defaultAdmin

  console.log('hello world ' + value)
}
