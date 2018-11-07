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
require('tls').DEFAULT_ECDH_CURVE = 'auto';
const core_utils_1 = require("./server/helpers/core-utils");
if (core_utils_1.isTestInstance()) {
    require('source-map-support').install();
}
const bodyParser = require("body-parser");
const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const useragent = require("useragent");
const anonymize = require("ip-anonymize");
process.title = 'peertube';
const app = express();
const checker_before_init_1 = require("./server/initializers/checker-before-init");
const logger_1 = require("./server/helpers/logger");
const constants_1 = require("./server/initializers/constants");
const missed = checker_before_init_1.checkMissedConfig();
if (missed.length !== 0) {
    logger_1.logger.error('Your configuration files miss keys: ' + missed);
    process.exit(-1);
}
checker_before_init_1.checkFFmpeg(constants_1.CONFIG)
    .catch(err => {
    logger_1.logger.error('Error in ffmpeg check.', { err });
    process.exit(-1);
});
const checker_after_init_1 = require("./server/initializers/checker-after-init");
const errorMessage = checker_after_init_1.checkConfig();
if (errorMessage !== null) {
    throw new Error(errorMessage);
}
app.set('trust proxy', constants_1.CONFIG.TRUST_PROXY);
app.use(helmet({
    frameguard: {
        action: 'deny'
    },
    hsts: false
}));
const database_1 = require("./server/initializers/database");
const migrator_1 = require("./server/initializers/migrator");
migrator_1.migrate()
    .then(() => database_1.initDatabaseModels(false))
    .then(() => startApplication())
    .catch(err => {
    logger_1.logger.error('Cannot start application.', { err });
    process.exit(-1);
});
const initializers_1 = require("./server/initializers");
const emailer_1 = require("./server/lib/emailer");
const job_queue_1 = require("./server/lib/job-queue");
const cache_1 = require("./server/lib/cache");
const controllers_1 = require("./server/controllers");
const dnt_1 = require("./server/middlewares/dnt");
const redis_1 = require("./server/lib/redis");
const bad_actor_follow_scheduler_1 = require("./server/lib/schedulers/bad-actor-follow-scheduler");
const remove_old_jobs_scheduler_1 = require("./server/lib/schedulers/remove-old-jobs-scheduler");
const update_videos_scheduler_1 = require("./server/lib/schedulers/update-videos-scheduler");
const youtube_dl_update_scheduler_1 = require("./server/lib/schedulers/youtube-dl-update-scheduler");
const videos_redundancy_scheduler_1 = require("./server/lib/schedulers/videos-redundancy-scheduler");
if (core_utils_1.isTestInstance()) {
    app.use(cors({
        origin: '*',
        exposedHeaders: 'Retry-After',
        credentials: true
    }));
}
morgan.token('remote-addr', req => {
    return (req.get('DNT') === '1') ?
        anonymize(req.ip || (req.connection && req.connection.remoteAddress) || undefined, 16, 16) :
        req.ip;
});
morgan.token('user-agent', req => (req.get('DNT') === '1') ?
    useragent.parse(req.get('user-agent')).family : req.get('user-agent'));
app.use(morgan('combined', {
    stream: { write: logger_1.logger.info.bind(logger_1.logger) }
}));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json({
    type: ['application/json', 'application/*+json'],
    limit: '500kb'
}));
app.use(cookieParser());
app.use(dnt_1.advertiseDoNotTrack);
const apiRoute = '/api/' + constants_1.API_VERSION;
app.use(apiRoute, controllers_1.apiRouter);
app.use('/services', controllers_1.servicesRouter);
app.use('/', controllers_1.activityPubRouter);
app.use('/', controllers_1.feedsRouter);
app.use('/', controllers_1.webfingerRouter);
app.use('/', controllers_1.trackerRouter);
app.use('/', controllers_1.staticRouter);
app.use('/', controllers_1.clientsRouter);
app.use(function (req, res, next) {
    const err = new Error('Not Found');
    err['status'] = 404;
    next(err);
});
app.use(function (err, req, res, next) {
    let error = 'Unknown error.';
    if (err) {
        error = err.stack || err.message || err;
    }
    const sql = err.parent ? err.parent.sql : undefined;
    logger_1.logger.error('Error in controller.', { err: error, sql });
    return res.status(err.status || 500).end();
});
const server = controllers_1.createWebsocketServer(app);
function startApplication() {
    return __awaiter(this, void 0, void 0, function* () {
        const port = constants_1.CONFIG.LISTEN.PORT;
        const hostname = constants_1.CONFIG.LISTEN.HOSTNAME;
        yield initializers_1.installApplication();
        checker_after_init_1.checkActivityPubUrls()
            .catch(err => {
            logger_1.logger.error('Error in ActivityPub URLs checker.', { err });
            process.exit(-1);
        });
        emailer_1.Emailer.Instance.init();
        yield emailer_1.Emailer.Instance.checkConnectionOrDie();
        yield job_queue_1.JobQueue.Instance.init();
        cache_1.VideosPreviewCache.Instance.init(constants_1.CONFIG.CACHE.PREVIEWS.SIZE, constants_1.CACHE.PREVIEWS.MAX_AGE);
        cache_1.VideosCaptionCache.Instance.init(constants_1.CONFIG.CACHE.VIDEO_CAPTIONS.SIZE, constants_1.CACHE.VIDEO_CAPTIONS.MAX_AGE);
        bad_actor_follow_scheduler_1.BadActorFollowScheduler.Instance.enable();
        remove_old_jobs_scheduler_1.RemoveOldJobsScheduler.Instance.enable();
        update_videos_scheduler_1.UpdateVideosScheduler.Instance.enable();
        youtube_dl_update_scheduler_1.YoutubeDlUpdateScheduler.Instance.enable();
        videos_redundancy_scheduler_1.VideosRedundancyScheduler.Instance.enable();
        redis_1.Redis.Instance.init();
        server.listen(port, hostname, () => {
            logger_1.logger.info('Server listening on %s:%d', hostname, port);
            logger_1.logger.info('Web server: %s', constants_1.CONFIG.WEBSERVER.URL);
        });
        process.on('exit', () => {
            job_queue_1.JobQueue.Instance.terminate();
        });
        process.on('SIGINT', () => process.exit(0));
    });
}
