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
const logger_1 = require("../../helpers/logger");
const initializers_1 = require("../../initializers");
const middlewares_1 = require("../../middlewares");
const oauth_client_1 = require("../../models/oauth/oauth-client");
const oauthClientsRouter = express.Router();
exports.oauthClientsRouter = oauthClientsRouter;
oauthClientsRouter.get('/local', middlewares_1.asyncMiddleware(getLocalClient));
function getLocalClient(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const serverHostname = initializers_1.CONFIG.WEBSERVER.HOSTNAME;
        const serverPort = initializers_1.CONFIG.WEBSERVER.PORT;
        let headerHostShouldBe = serverHostname;
        if (serverPort !== 80 && serverPort !== 443) {
            headerHostShouldBe += ':' + serverPort;
        }
        if (process.env.NODE_ENV !== 'test' && req.get('host') !== headerHostShouldBe) {
            logger_1.logger.info('Getting client tokens for host %s is forbidden (expected %s).', req.get('host'), headerHostShouldBe);
            return res.type('json').status(403).end();
        }
        const client = yield oauth_client_1.OAuthClientModel.loadFirstClient();
        if (!client)
            throw new Error('No client available.');
        const json = {
            client_id: client.clientId,
            client_secret: client.clientSecret
        };
        return res.json(json);
    });
}
//# sourceMappingURL=oauth-clients.js.map