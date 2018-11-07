"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("express-validator");
const validator = require("validator");
const shared_1 = require("../../../shared");
const initializers_1 = require("../../initializers");
const misc_1 = require("./misc");
const lodash_1 = require("lodash");
const USERS_CONSTRAINTS_FIELDS = initializers_1.CONSTRAINTS_FIELDS.USERS;
function isUserPasswordValid(value) {
    return validator.isLength(value, USERS_CONSTRAINTS_FIELDS.PASSWORD);
}
exports.isUserPasswordValid = isUserPasswordValid;
function isUserVideoQuotaValid(value) {
    return misc_1.exists(value) && validator.isInt(value + '', USERS_CONSTRAINTS_FIELDS.VIDEO_QUOTA);
}
exports.isUserVideoQuotaValid = isUserVideoQuotaValid;
function isUserVideoQuotaDailyValid(value) {
    return misc_1.exists(value) && validator.isInt(value + '', USERS_CONSTRAINTS_FIELDS.VIDEO_QUOTA_DAILY);
}
exports.isUserVideoQuotaDailyValid = isUserVideoQuotaDailyValid;
function isUserUsernameValid(value) {
    const max = USERS_CONSTRAINTS_FIELDS.USERNAME.max;
    const min = USERS_CONSTRAINTS_FIELDS.USERNAME.min;
    return misc_1.exists(value) && validator.matches(value, new RegExp(`^[a-z0-9._]{${min},${max}}$`));
}
exports.isUserUsernameValid = isUserUsernameValid;
function isUserDisplayNameValid(value) {
    return value === null || (misc_1.exists(value) && validator.isLength(value, initializers_1.CONSTRAINTS_FIELDS.USERS.NAME));
}
exports.isUserDisplayNameValid = isUserDisplayNameValid;
function isUserDescriptionValid(value) {
    return value === null || (misc_1.exists(value) && validator.isLength(value, initializers_1.CONSTRAINTS_FIELDS.USERS.DESCRIPTION));
}
exports.isUserDescriptionValid = isUserDescriptionValid;
function isUserEmailVerifiedValid(value) {
    return misc_1.isBooleanValid(value);
}
exports.isUserEmailVerifiedValid = isUserEmailVerifiedValid;
const nsfwPolicies = lodash_1.values(initializers_1.NSFW_POLICY_TYPES);
function isUserNSFWPolicyValid(value) {
    return misc_1.exists(value) && nsfwPolicies.indexOf(value) !== -1;
}
exports.isUserNSFWPolicyValid = isUserNSFWPolicyValid;
function isUserWebTorrentEnabledValid(value) {
    return misc_1.isBooleanValid(value);
}
exports.isUserWebTorrentEnabledValid = isUserWebTorrentEnabledValid;
function isUserAutoPlayVideoValid(value) {
    return misc_1.isBooleanValid(value);
}
exports.isUserAutoPlayVideoValid = isUserAutoPlayVideoValid;
function isUserBlockedValid(value) {
    return misc_1.isBooleanValid(value);
}
exports.isUserBlockedValid = isUserBlockedValid;
function isUserBlockedReasonValid(value) {
    return value === null || (misc_1.exists(value) && validator.isLength(value, initializers_1.CONSTRAINTS_FIELDS.USERS.BLOCKED_REASON));
}
exports.isUserBlockedReasonValid = isUserBlockedReasonValid;
function isUserRoleValid(value) {
    return misc_1.exists(value) && validator.isInt('' + value) && shared_1.UserRole[value] !== undefined;
}
exports.isUserRoleValid = isUserRoleValid;
const avatarMimeTypes = initializers_1.CONSTRAINTS_FIELDS.ACTORS.AVATAR.EXTNAME
    .map(v => v.replace('.', ''))
    .join('|');
const avatarMimeTypesRegex = `image/(${avatarMimeTypes})`;
function isAvatarFile(files) {
    return misc_1.isFileValid(files, avatarMimeTypesRegex, 'avatarfile', initializers_1.CONSTRAINTS_FIELDS.ACTORS.AVATAR.FILE_SIZE.max);
}
exports.isAvatarFile = isAvatarFile;
