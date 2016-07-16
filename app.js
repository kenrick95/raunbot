var restify = require('restify');
var builder = require('botbuilder');
var io = require( 'socket.io-client' );
var socket = io.connect( 'https://stream.wikimedia.org/rc' );
var Promise = require('bluebird');
var request = Promise.promisifyAll(require('request'));
var async = require('asyncawait/async');
var await = require('asyncawait/await');

//=========================================================
// Bot Setup
//=========================================================

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});
  
// Create chat bot
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});
var bot = new builder.UniversalBot(connector);
server.post('/api/messages', connector.listen());

//=========================================================
// Bots Dialogs
//=========================================================
var alerts = {};
var oresScoreCache = {};
// https://ores.wikimedia.org/v2/scores/idwiki/reverted/123456

bot.dialog('/', [
    function (session, args, next) {
        if (!session.userData.wiki) {
            session.beginDialog('/subscribe');
        } else {
            next();
        }
    },
    function (session, results) {
        var wiki = session.userData.wiki;
        session.send('Hello, you will be receiving alerts for %s!', wiki);

        var found = false;
        for (var key in alerts[wiki]) {
            if (alerts[wiki][key].user.id === session.message.address.user.id) {
                found = true;
                break;
            }
        }

        if (!found) {
            subscribe(wiki, session.message.address)
        }
    }
]);

bot.dialog('/subscribe', [
    function (session) {
        builder.Prompts.text(session, 'Hi! Which wiki to watch on?');
    },
    function (session, results) {
        var wiki = results.response;
        session.userData.wiki = wiki;
        subscribe(wiki, session.message.address);
        session.endDialog();
    }
]);

function subscribe(wiki, address) {
    if (!(wiki in alerts)) {
        alerts[wiki] = [];
    }
    alerts[wiki].push(address);
}

socket.on('connect', function () {
     socket.emit('subscribe', '*');
});

socket.on('change', async(function (data) {
    if (data.wiki in alerts && alerts[data.wiki].length > 0) {
        var score = await(getOresScore(data));

        if (score >= 0.5) {
            console.log("Bingo: " + data.wiki + " - " + data.revision.new + " - " + score);
            for (var key in alerts[data.wiki]) {
                var recipient = alerts[data.wiki][key];
                var msg = new builder.Message()
                    .address(recipient)
                    .text("[%s] Alert for \"%s\", ORES is %s sure that it will be reverted.", data.wiki, data.title, percentageString(score));
                bot.send(msg);

            }
        }
    }
}));

function percentageString(number) {
    return Math.round(number * 100) + "%";
}

var getOresScore = async(function (data) {
    if (["new", "edit"].indexOf(data.type) === -1) {
        return -1;
    }
    var wiki = data.wiki;
    if (!(wiki in oresScoreCache)) {
        oresScoreCache[wiki] = {};
    }
    var revisionId = data.revision.new;
    if (revisionId in oresScoreCache[wiki]) {
        return oresScoreCache[wiki][revisionId];
    }

    var res = await(request.getAsync('https://ores.wikimedia.org/v2/scores/' + wiki + '/reverted/' + revisionId));
    var obj = JSON.parse(res.body);
    var score = obj.scores[wiki].reverted.scores[revisionId].probability.true;
    oresScoreCache[wiki][revisionId] = score;

    return score;
});