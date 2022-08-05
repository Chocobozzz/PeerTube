import { exists } from '../misc'
import { isActivityPubUrlValid } from './misc'

function isSignatureTypeValid (signatureType: string) {
  return exists(signatureType) && signatureType === 'RsaSignature2017'
}

function isSignatureCreatorValid (signatureCreator: string) {
  return exists(signatureCreator) && isActivityPubUrlValid(signatureCreator)
}

function isSignatureValueValid (signatureValue: string) {
  return exists(signatureValue) && signatureValue.length > 0
}

// ---------------------------------------------------------------------------

export {
  isSignatureTypeValid,
  isSignatureCreatorValid,
  isSignatureValueValid
}
