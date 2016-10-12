var restify = require('restify');
var builder = require('botbuilder');
var io = require( 'socket.io-client' );
var socket = io.connect( 'https://stream.wikimedia.org/rc' );
var Promise = require('bluebird');
var request = Promise.promisifyAll(require('request'));
var async = require('asyncawait/async');
var await = require('asyncawait/await');
require('dotenv').config({silent: true});

//=========================================================
// Bot Setup
//=========================================================

// Setup Restify Server
var server = restify.createServer();
var port = process.env.PORT || 3978;
server.listen(port, function () {
   console.log('%s listening to %s', server.name, server.url); 
});
  
// Create chat bot
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});
server.post('/raunbot/api/messages', connector.listen());

var bot = new builder.UniversalBot(connector);
var intents = new builder.IntentDialog();
bot.dialog('/', intents);

var alerts = {};
var oresScoreCache = {};
var oresWikis = [];

var getWikisAvailable = async(function() {
    var res = await(request.getAsync('https://ores.wikimedia.org/v2/scores/'));
    var obj = JSON.parse(res.body);
    for (var wiki in obj.scores) {
        if (!!obj.scores[wiki].reverted && !(wiki in oresWikis)) {
            oresWikis.push(wiki);
        }
    }
    console.log("ORES supported wikis are: %s", oresWikis);
});
getWikisAvailable();

intents.matches(/^unsubscribe/i, [
    function (session, args, next) {
        var wiki = session.userData.wiki.toLowerCase();
        session.send('You have stopped receiving alerts for %s.', unsubscribe(wiki, session.message.address));
        delete session.userData.wiki;
    }
]);

intents.onDefault([
    function (session, args, next) {
        if (!session.userData.wiki) {
            session.beginDialog('/subscribe');
        } else {
            next();
        }
    },
    function (session, results) {
        var wiki = session.userData.wiki.toLowerCase();

        session.send('Hello, you will be receiving alerts for %s!\nReply with "unsubscribe" to stop receiving alerts.', wiki);

        var userHasSubscribed = false;
        for (var key in alerts[wiki]) {
            if (alerts[wiki][key].user.id === session.message.address.user.id
                && alerts[wiki][key].channelId === session.message.address.channelId) {
                userHasSubscribed = true;
                break;
            }
        }

        if (!userHasSubscribed) {
            subscribe(wiki, session.message.address)
        }
    }
]);

bot.dialog('/subscribe', [
    function (session) {
        builder.Prompts.text(session, 'Hi! Which wiki to watch on?');
    },
    function (session, results) {
        var wiki = results.response.toLowerCase();

        if (isWikiValid(wiki)) {
            session.userData.wiki = wiki;
            subscribe(wiki, session.message.address);
            session.endDialog();
        } else {
            session.send("Sorry, that wiki (%s) is not supported by ORES. Please try another one.", wiki);
            session.replaceDialog('/subscribe');
        }
        
    }
]);

function isWikiValid(wiki) {
    return oresWikis.indexOf(wiki) > -1;
}

function subscribe(wiki, address) {
    if (!(wiki in alerts)) {
        alerts[wiki] = [];
    }
    alerts[wiki].push(address);
}
function unsubscribe(wiki, address) {
    if (wiki in alerts) {
        var deleteIndex = null;
        for (var key in alerts[wiki]) {
            if (alerts[wiki][key].user.id === address.user.id
                && alerts[wiki][key].channelId === address.channelId) {
                deleteIndex = key;
                break;
            }
        }
        if (deleteIndex in alerts[wiki]) {
            alerts[wiki].splice(deleteIndex, 1);
            return wiki;
        }
    }
    return null;
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
    var score = -1;
    if (!!obj.scores[wiki].reverted.scores[revisionId].probability) {
        score = obj.scores[wiki].reverted.scores[revisionId].probability.true;
    }
    oresScoreCache[wiki][revisionId] = score;

    return score;
});
