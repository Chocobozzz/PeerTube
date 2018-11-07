"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const activity_1 = require("../../../helpers/custom-validators/activitypub/activity");
const logger_1 = require("../../../helpers/logger");
const utils_1 = require("../../../helpers/utils");
function activityPubValidator(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking activity pub parameters');
        if (!activity_1.isRootActivityValid(req.body)) {
            logger_1.logger.warn('Incorrect activity parameters.', { activity: req.body });
            return res.status(400).json({ error: 'Incorrect activity.' });
        }
        const serverActor = yield utils_1.getServerActor();
        const remoteActor = res.locals.signature.actor;
        if (serverActor.id === remoteActor.id) {
            logger_1.logger.error('Receiving request in INBOX by ourselves!', req.body);
            return res.status(409).end();
        }
        return next();
    });
}
exports.activityPubValidator = activityPubValidator;
