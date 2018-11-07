"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const validator = require("validator");
const initializers_1 = require("../../../initializers");
const core_utils_1 = require("../../core-utils");
const misc_1 = require("../misc");
function isUrlValid(url) {
    const isURLOptions = {
        require_host: true,
        require_tld: true,
        require_protocol: true,
        require_valid_protocol: true,
        protocols: ['http', 'https']
    };
    if (core_utils_1.isTestInstance()) {
        isURLOptions.require_tld = false;
    }
    return misc_1.exists(url) && validator.isURL('' + url, isURLOptions);
}
exports.isUrlValid = isUrlValid;
function isActivityPubUrlValid(url) {
    return isUrlValid(url) && validator.isLength('' + url, initializers_1.CONSTRAINTS_FIELDS.ACTORS.URL);
}
exports.isActivityPubUrlValid = isActivityPubUrlValid;
function isBaseActivityValid(activity, type) {
    return (activity['@context'] === undefined || Array.isArray(activity['@context'])) &&
        activity.type === type &&
        isActivityPubUrlValid(activity.id) &&
        misc_1.exists(activity.actor) &&
        (isActivityPubUrlValid(activity.actor) || isActivityPubUrlValid(activity.actor.id)) &&
        (activity.to === undefined ||
            (Array.isArray(activity.to) && activity.to.every(t => isActivityPubUrlValid(t)))) &&
        (activity.cc === undefined ||
            (Array.isArray(activity.cc) && activity.cc.every(t => isActivityPubUrlValid(t))));
}
exports.isBaseActivityValid = isBaseActivityValid;
function setValidAttributedTo(obj) {
    if (Array.isArray(obj.attributedTo) === false) {
        obj.attributedTo = [];
        return true;
    }
    obj.attributedTo = obj.attributedTo.filter(a => {
        return (a.type === 'Group' || a.type === 'Person') && isActivityPubUrlValid(a.id);
    });
    return true;
}
exports.setValidAttributedTo = setValidAttributedTo;
//# sourceMappingURL=misc.js.map