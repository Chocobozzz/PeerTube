async function register ({
  videoCategoryManager,
  videoLicenceManager,
  videoLanguageManager,
  videoPrivacyManager,
  playlistPrivacyManager,
  getRouter
}) {
  videoLanguageManager.addConstant('al_bhed', 'Al Bhed')
  videoLanguageManager.addLanguage('al_bhed2', 'Al Bhed 2')
  videoLanguageManager.addConstant('al_bhed3', 'Al Bhed 3')
  videoLanguageManager.deleteConstant('en')
  videoLanguageManager.deleteLanguage('fr')
  videoLanguageManager.deleteConstant('al_bhed3')

  videoCategoryManager.addCategory(42, 'Best category')
  videoCategoryManager.addConstant(43, 'High best category')
  videoCategoryManager.deleteConstant(1) // Music
  videoCategoryManager.deleteCategory(2) // Films

  videoLicenceManager.addLicence(42, 'Best licence')
  videoLicenceManager.addConstant(43, 'High best licence')
  videoLicenceManager.deleteConstant(1) // Attribution
  videoLicenceManager.deleteConstant(7) // Public domain

  videoPrivacyManager.deleteConstant(2)
  videoPrivacyManager.deletePrivacy(2)
  playlistPrivacyManager.deleteConstant(3)
  playlistPrivacyManager.deletePlaylistPrivacy(3)

  {
    const router = getRouter()
    router.get('/reset-categories', (req, res) => {
      videoCategoryManager.resetConstants()

      res.sendStatus(204)
    })
  }
}

async function unregister () {}

module.exports = {
  register,
  unregister
}
