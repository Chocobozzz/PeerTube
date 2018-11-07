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
const express = require("express");
const users_1 = require("../../../../shared/models/users");
const middlewares_1 = require("../../../middlewares");
const redundancy_1 = require("../../../middlewares/validators/redundancy");
const redundancy_2 = require("../../../lib/redundancy");
const logger_1 = require("../../../helpers/logger");
const serverRedundancyRouter = express.Router();
exports.serverRedundancyRouter = serverRedundancyRouter;
serverRedundancyRouter.put('/redundancy/:host', middlewares_1.authenticate, middlewares_1.ensureUserHasRight(users_1.UserRight.MANAGE_SERVER_FOLLOW), middlewares_1.asyncMiddleware(redundancy_1.updateServerRedundancyValidator), middlewares_1.asyncMiddleware(updateRedundancy));
function updateRedundancy(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const server = res.locals.server;
        server.redundancyAllowed = req.body.redundancyAllowed;
        yield server.save();
        redundancy_2.removeRedundancyOf(server.id)
            .catch(err => logger_1.logger.error('Cannot remove redundancy of %s.', server.host, err));
        return res.sendStatus(204);
    });
}
