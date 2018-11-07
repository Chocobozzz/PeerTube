"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const actor_1 = require("../models/activitypub/actor");
function fetchActorByUrl(url, fetchType) {
    if (fetchType === 'all')
        return actor_1.ActorModel.loadByUrlAndPopulateAccountAndChannel(url);
    if (fetchType === 'actor-and-association-ids')
        return actor_1.ActorModel.loadByUrl(url);
}
exports.fetchActorByUrl = fetchActorByUrl;
