"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const misc_1 = require("../misc");
const misc_2 = require("./misc");
function isSignatureTypeValid(signatureType) {
    return misc_1.exists(signatureType) && signatureType === 'RsaSignature2017';
}
exports.isSignatureTypeValid = isSignatureTypeValid;
function isSignatureCreatorValid(signatureCreator) {
    return misc_1.exists(signatureCreator) && misc_2.isActivityPubUrlValid(signatureCreator);
}
exports.isSignatureCreatorValid = isSignatureCreatorValid;
function isSignatureValueValid(signatureValue) {
    return misc_1.exists(signatureValue) && signatureValue.length > 0;
}
exports.isSignatureValueValid = isSignatureValueValid;
