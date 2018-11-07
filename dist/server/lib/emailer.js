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
const nodemailer_1 = require("nodemailer");
const users_1 = require("../../shared/models/users");
const core_utils_1 = require("../helpers/core-utils");
const logger_1 = require("../helpers/logger");
const initializers_1 = require("../initializers");
const user_1 = require("../models/account/user");
const video_1 = require("../models/video/video");
const job_queue_1 = require("./job-queue");
const fs_extra_1 = require("fs-extra");
class Emailer {
    constructor() {
        this.initialized = false;
    }
    init() {
        if (this.initialized === true)
            return;
        this.initialized = true;
        if (initializers_1.CONFIG.SMTP.HOSTNAME && initializers_1.CONFIG.SMTP.PORT) {
            logger_1.logger.info('Using %s:%s as SMTP server.', initializers_1.CONFIG.SMTP.HOSTNAME, initializers_1.CONFIG.SMTP.PORT);
            let tls;
            if (initializers_1.CONFIG.SMTP.CA_FILE) {
                tls = {
                    ca: [fs_extra_1.readFileSync(initializers_1.CONFIG.SMTP.CA_FILE)]
                };
            }
            let auth;
            if (initializers_1.CONFIG.SMTP.USERNAME && initializers_1.CONFIG.SMTP.PASSWORD) {
                auth = {
                    user: initializers_1.CONFIG.SMTP.USERNAME,
                    pass: initializers_1.CONFIG.SMTP.PASSWORD
                };
            }
            this.transporter = nodemailer_1.createTransport({
                host: initializers_1.CONFIG.SMTP.HOSTNAME,
                port: initializers_1.CONFIG.SMTP.PORT,
                secure: initializers_1.CONFIG.SMTP.TLS,
                debug: initializers_1.CONFIG.LOG.LEVEL === 'debug',
                logger: logger_1.bunyanLogger,
                ignoreTLS: initializers_1.CONFIG.SMTP.DISABLE_STARTTLS,
                tls,
                auth
            });
        }
        else {
            if (!core_utils_1.isTestInstance()) {
                logger_1.logger.error('Cannot use SMTP server because of lack of configuration. PeerTube will not be able to send mails!');
            }
        }
    }
    checkConnectionOrDie() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.transporter)
                return;
            logger_1.logger.info('Testing SMTP server...');
            try {
                const success = yield this.transporter.verify();
                if (success !== true)
                    this.dieOnConnectionFailure();
                logger_1.logger.info('Successfully connected to SMTP server.');
            }
            catch (err) {
                this.dieOnConnectionFailure(err);
            }
        });
    }
    addForgetPasswordEmailJob(to, resetPasswordUrl) {
        const text = `Hi dear user,\n\n` +
            `It seems you forgot your password on ${initializers_1.CONFIG.WEBSERVER.HOST}! ` +
            `Please follow this link to reset it: ${resetPasswordUrl}\n\n` +
            `If you are not the person who initiated this request, please ignore this email.\n\n` +
            `Cheers,\n` +
            `PeerTube.`;
        const emailPayload = {
            to: [to],
            subject: 'Reset your PeerTube password',
            text
        };
        return job_queue_1.JobQueue.Instance.createJob({ type: 'email', payload: emailPayload });
    }
    addVerifyEmailJob(to, verifyEmailUrl) {
        const text = `Welcome to PeerTube,\n\n` +
            `To start using PeerTube on ${initializers_1.CONFIG.WEBSERVER.HOST} you must  verify your email! ` +
            `Please follow this link to verify this email belongs to you: ${verifyEmailUrl}\n\n` +
            `If you are not the person who initiated this request, please ignore this email.\n\n` +
            `Cheers,\n` +
            `PeerTube.`;
        const emailPayload = {
            to: [to],
            subject: 'Verify your PeerTube email',
            text
        };
        return job_queue_1.JobQueue.Instance.createJob({ type: 'email', payload: emailPayload });
    }
    addVideoAbuseReportJob(videoId) {
        return __awaiter(this, void 0, void 0, function* () {
            const video = yield video_1.VideoModel.load(videoId);
            if (!video)
                throw new Error('Unknown Video id during Abuse report.');
            const text = `Hi,\n\n` +
                `Your instance received an abuse for the following video ${video.url}\n\n` +
                `Cheers,\n` +
                `PeerTube.`;
            const to = yield user_1.UserModel.listEmailsWithRight(users_1.UserRight.MANAGE_VIDEO_ABUSES);
            const emailPayload = {
                to,
                subject: '[PeerTube] Received a video abuse',
                text
            };
            return job_queue_1.JobQueue.Instance.createJob({ type: 'email', payload: emailPayload });
        });
    }
    addVideoBlacklistReportJob(videoId, reason) {
        return __awaiter(this, void 0, void 0, function* () {
            const video = yield video_1.VideoModel.loadAndPopulateAccountAndServerAndTags(videoId);
            if (!video)
                throw new Error('Unknown Video id during Blacklist report.');
            if (video.remote === true)
                return;
            const user = yield user_1.UserModel.loadById(video.VideoChannel.Account.userId);
            const reasonString = reason ? ` for the following reason: ${reason}` : '';
            const blockedString = `Your video ${video.name} on ${initializers_1.CONFIG.WEBSERVER.HOST} has been blacklisted${reasonString}.`;
            const text = 'Hi,\n\n' +
                blockedString +
                '\n\n' +
                'Cheers,\n' +
                `PeerTube.`;
            const to = user.email;
            const emailPayload = {
                to: [to],
                subject: `[PeerTube] Video ${video.name} blacklisted`,
                text
            };
            return job_queue_1.JobQueue.Instance.createJob({ type: 'email', payload: emailPayload });
        });
    }
    addVideoUnblacklistReportJob(videoId) {
        return __awaiter(this, void 0, void 0, function* () {
            const video = yield video_1.VideoModel.loadAndPopulateAccountAndServerAndTags(videoId);
            if (!video)
                throw new Error('Unknown Video id during Blacklist report.');
            if (video.remote === true)
                return;
            const user = yield user_1.UserModel.loadById(video.VideoChannel.Account.userId);
            const text = 'Hi,\n\n' +
                `Your video ${video.name} on ${initializers_1.CONFIG.WEBSERVER.HOST} has been unblacklisted.` +
                '\n\n' +
                'Cheers,\n' +
                `PeerTube.`;
            const to = user.email;
            const emailPayload = {
                to: [to],
                subject: `[PeerTube] Video ${video.name} unblacklisted`,
                text
            };
            return job_queue_1.JobQueue.Instance.createJob({ type: 'email', payload: emailPayload });
        });
    }
    addUserBlockJob(user, blocked, reason) {
        const reasonString = reason ? ` for the following reason: ${reason}` : '';
        const blockedWord = blocked ? 'blocked' : 'unblocked';
        const blockedString = `Your account ${user.username} on ${initializers_1.CONFIG.WEBSERVER.HOST} has been ${blockedWord}${reasonString}.`;
        const text = 'Hi,\n\n' +
            blockedString +
            '\n\n' +
            'Cheers,\n' +
            `PeerTube.`;
        const to = user.email;
        const emailPayload = {
            to: [to],
            subject: '[PeerTube] Account ' + blockedWord,
            text
        };
        return job_queue_1.JobQueue.Instance.createJob({ type: 'email', payload: emailPayload });
    }
    sendMail(to, subject, text) {
        if (!this.transporter) {
            throw new Error('Cannot send mail because SMTP is not configured.');
        }
        return this.transporter.sendMail({
            from: initializers_1.CONFIG.SMTP.FROM_ADDRESS,
            to: to.join(','),
            subject,
            text
        });
    }
    dieOnConnectionFailure(err) {
        logger_1.logger.error('Failed to connect to SMTP %s:%d.', initializers_1.CONFIG.SMTP.HOSTNAME, initializers_1.CONFIG.SMTP.PORT, { err });
        process.exit(-1);
    }
    static get Instance() {
        return this.instance || (this.instance = new this());
    }
}
exports.Emailer = Emailer;
//# sourceMappingURL=emailer.js.map