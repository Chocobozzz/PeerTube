"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const activity_1 = require("../../helpers/custom-validators/activitypub/activity");
const logger_1 = require("../../helpers/logger");
const process_1 = require("../../lib/activitypub/process/process");
const middlewares_1 = require("../../middlewares");
const activity_2 = require("../../middlewares/validators/activitypub/activity");
const async_1 = require("async");
const inboxRouter = express.Router();
exports.inboxRouter = inboxRouter;
inboxRouter.post('/inbox', middlewares_1.signatureValidator, middlewares_1.asyncMiddleware(middlewares_1.checkSignature), middlewares_1.asyncMiddleware(activity_2.activityPubValidator), inboxController);
inboxRouter.post('/accounts/:name/inbox', middlewares_1.signatureValidator, middlewares_1.asyncMiddleware(middlewares_1.checkSignature), middlewares_1.asyncMiddleware(middlewares_1.localAccountValidator), middlewares_1.asyncMiddleware(activity_2.activityPubValidator), inboxController);
inboxRouter.post('/video-channels/:name/inbox', middlewares_1.signatureValidator, middlewares_1.asyncMiddleware(middlewares_1.checkSignature), middlewares_1.asyncMiddleware(middlewares_1.localVideoChannelValidator), middlewares_1.asyncMiddleware(activity_2.activityPubValidator), inboxController);
const inboxQueue = async_1.queue((task, cb) => {
    process_1.processActivities(task.activities, task.signatureActor, task.inboxActor)
        .then(() => cb());
});
function inboxController(req, res, next) {
    const rootActivity = req.body;
    let activities = [];
    if (['Collection', 'CollectionPage'].indexOf(rootActivity.type) !== -1) {
        activities = rootActivity.items;
    }
    else if (['OrderedCollection', 'OrderedCollectionPage'].indexOf(rootActivity.type) !== -1) {
        activities = rootActivity.orderedItems;
    }
    else {
        activities = [rootActivity];
    }
    logger_1.logger.debug('Filtering %d activities...', activities.length);
    activities = activities.filter(a => activity_1.isActivityValid(a));
    logger_1.logger.debug('We keep %d activities.', activities.length, { activities });
    let accountOrChannel;
    if (res.locals.account) {
        accountOrChannel = res.locals.account;
    }
    else if (res.locals.videoChannel) {
        accountOrChannel = res.locals.videoChannel;
    }
    logger_1.logger.info('Receiving inbox requests for %d activities by %s.', activities.length, res.locals.signature.actor.url);
    inboxQueue.push({
        activities,
        signatureActor: res.locals.signature.actor,
        inboxActor: accountOrChannel ? accountOrChannel.Actor : undefined
    });
    return res.status(204).end();
}
