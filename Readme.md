# Raunbot

A chat bot that listens to Wikimedia projects' recent changes and alerts you when there are edits that are likely to be reverted.

Built using Microsoft Bot Framework

## TODO

- Specify alert treshold
- Link to diff id
- Lists down valid wiki names

## Depends on

- [RCStream](https://wikitech.wikimedia.org/wiki/RCStream)
- [ORES](https://ores.wikimedia.org/)

## Demo
I intend to put the bot on Wikimedia Foundation's Tool Labs, but it is not working yet due to the server denying access from the clients as the clients do not send them User-Agent in the HTTP request header. ([more details](https://github.com/Microsoft/BotBuilder/issues/719)) In the meantime, bot is deployed on Microsoft Azure.

When being asked "Which wiki to watch on?", answer using its database name (e.g. "idwiki", "enwiki", "wikidatawiki", "commonswiki", "enwiktionary"); see [Wikimedia site matrix](https://id.wikipedia.org/w/api.php?action=sitematrix).

Currently, only those wikis listed at ORES are supported by this chat bot, [see here](https://ores.wikimedia.org/v2/scores/).

- [Web Chat](https://webchat.botframework.com/embed/raunbot?s=7TDrveeGfNI.cwA.PQo.X77vW1OlsbjQPC1niOldz7ZAAYEfzgrpxwjaGmxkCPA)
- [Facebook Messenger](https://m.me/raunbot)
- [Skype](https://join.skype.com/bot/047f069f-206b-4311-b61a-84c4a5a0f92a)
- [Telegram](https://telegram.me/raunbot)