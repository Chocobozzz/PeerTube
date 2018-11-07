"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const validator = require("validator");
const initializers_1 = require("../../../initializers");
const misc_1 = require("../misc");
const lodash_1 = require("lodash");
const misc_2 = require("./misc");
const servers_1 = require("../servers");
function isActorEndpointsObjectValid(endpointObject) {
    return misc_2.isActivityPubUrlValid(endpointObject.sharedInbox);
}
exports.isActorEndpointsObjectValid = isActorEndpointsObjectValid;
function isActorPublicKeyObjectValid(publicKeyObject) {
    return misc_2.isActivityPubUrlValid(publicKeyObject.id) &&
        misc_2.isActivityPubUrlValid(publicKeyObject.owner) &&
        isActorPublicKeyValid(publicKeyObject.publicKeyPem);
}
exports.isActorPublicKeyObjectValid = isActorPublicKeyObjectValid;
function isActorTypeValid(type) {
    return type === 'Person' || type === 'Application' || type === 'Group';
}
exports.isActorTypeValid = isActorTypeValid;
function isActorPublicKeyValid(publicKey) {
    return misc_1.exists(publicKey) &&
        typeof publicKey === 'string' &&
        publicKey.startsWith('-----BEGIN PUBLIC KEY-----') &&
        publicKey.indexOf('-----END PUBLIC KEY-----') !== -1 &&
        validator.isLength(publicKey, initializers_1.CONSTRAINTS_FIELDS.ACTORS.PUBLIC_KEY);
}
exports.isActorPublicKeyValid = isActorPublicKeyValid;
const actorNameRegExp = new RegExp('^[ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789\\-_\.]+$');
function isActorPreferredUsernameValid(preferredUsername) {
    return misc_1.exists(preferredUsername) && validator.matches(preferredUsername, actorNameRegExp);
}
exports.isActorPreferredUsernameValid = isActorPreferredUsernameValid;
function isActorPrivateKeyValid(privateKey) {
    return misc_1.exists(privateKey) &&
        typeof privateKey === 'string' &&
        privateKey.startsWith('-----BEGIN RSA PRIVATE KEY-----') &&
        privateKey.indexOf('-----END RSA PRIVATE KEY-----') !== -1 &&
        validator.isLength(privateKey, initializers_1.CONSTRAINTS_FIELDS.ACTORS.PRIVATE_KEY);
}
exports.isActorPrivateKeyValid = isActorPrivateKeyValid;
function isActorObjectValid(actor) {
    return misc_1.exists(actor) &&
        misc_2.isActivityPubUrlValid(actor.id) &&
        isActorTypeValid(actor.type) &&
        misc_2.isActivityPubUrlValid(actor.following) &&
        misc_2.isActivityPubUrlValid(actor.followers) &&
        misc_2.isActivityPubUrlValid(actor.inbox) &&
        misc_2.isActivityPubUrlValid(actor.outbox) &&
        isActorPreferredUsernameValid(actor.preferredUsername) &&
        misc_2.isActivityPubUrlValid(actor.url) &&
        isActorPublicKeyObjectValid(actor.publicKey) &&
        isActorEndpointsObjectValid(actor.endpoints) &&
        misc_2.setValidAttributedTo(actor) &&
        (actor.type === 'Person' || actor.attributedTo.length !== 0);
}
exports.isActorObjectValid = isActorObjectValid;
function isActorFollowingCountValid(value) {
    return misc_1.exists(value) && validator.isInt('' + value, { min: 0 });
}
exports.isActorFollowingCountValid = isActorFollowingCountValid;
function isActorFollowersCountValid(value) {
    return misc_1.exists(value) && validator.isInt('' + value, { min: 0 });
}
exports.isActorFollowersCountValid = isActorFollowersCountValid;
function isActorDeleteActivityValid(activity) {
    return misc_2.isBaseActivityValid(activity, 'Delete');
}
exports.isActorDeleteActivityValid = isActorDeleteActivityValid;
function isActorFollowActivityValid(activity) {
    return misc_2.isBaseActivityValid(activity, 'Follow') &&
        misc_2.isActivityPubUrlValid(activity.object);
}
exports.isActorFollowActivityValid = isActorFollowActivityValid;
function isActorAcceptActivityValid(activity) {
    return misc_2.isBaseActivityValid(activity, 'Accept');
}
exports.isActorAcceptActivityValid = isActorAcceptActivityValid;
function isActorRejectActivityValid(activity) {
    return misc_2.isBaseActivityValid(activity, 'Reject');
}
exports.isActorRejectActivityValid = isActorRejectActivityValid;
function isActorUpdateActivityValid(activity) {
    normalizeActor(activity.object);
    return misc_2.isBaseActivityValid(activity, 'Update') &&
        isActorObjectValid(activity.object);
}
exports.isActorUpdateActivityValid = isActorUpdateActivityValid;
function normalizeActor(actor) {
    if (!actor || !actor.url)
        return;
    if (typeof actor.url !== 'string') {
        actor.url = actor.url.href || actor.url.url;
    }
    if (actor.summary && typeof actor.summary === 'string') {
        actor.summary = lodash_1.truncate(actor.summary, { length: initializers_1.CONSTRAINTS_FIELDS.USERS.DESCRIPTION.max });
        if (actor.summary.length < initializers_1.CONSTRAINTS_FIELDS.USERS.DESCRIPTION.min) {
            actor.summary = null;
        }
    }
    return;
}
exports.normalizeActor = normalizeActor;
function isValidActorHandle(handle) {
    if (!misc_1.exists(handle))
        return false;
    const parts = handle.split('@');
    if (parts.length !== 2)
        return false;
    return servers_1.isHostValid(parts[1]);
}
exports.isValidActorHandle = isValidActorHandle;
function areValidActorHandles(handles) {
    return misc_1.isArray(handles) && handles.every(h => isValidActorHandle(h));
}
exports.areValidActorHandles = areValidActorHandles;
