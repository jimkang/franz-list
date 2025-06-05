/* global process, __dirname */
var express = require('express');
var cors = require('cors');
var bodyParser = require('body-parser');
var fs = require('fs');
var fsPromises = require('fs/promises');
var VError = require('verror');
var RandomId = require('@jimkang/randomid');
var seedrandom = require('seedrandom');
var nonBlockingLog = require('./non-blocking-log');

function ListService({ storePath, sendMail, seed, serviceBaseURL }, done) {
  var storeText = fs.readFileSync(storePath, { encoding: 'utf8' });
  if (!storeText) {
    done(
      new Error(
        `Could not load store at ${storePath}. Not starting the service.`,
      ),
    );
    return;
  }

  var store;
  try {
    store = JSON.parse(storeText);
  } catch (error) {
    done(
      VError(
        error,
        `Could not parse store at ${storePath}. Not starting the service.`,
      ),
    );
    return;
  }

  var randomId = RandomId({ random: seed ? seedrandom(seed) : Math.random });

  var app = express();

  app.use(cors());
  app.use(bodyParser.json());

  app.get('/health', respondOK);
  app.get('/list/:listId/add', cors(), addSubscriber);
  app.get('/list/:listId/remove', cors(), removeSubscriber);
  app.head(/.*/, respondHead);

  process.nextTick(done, null, { app, setSendEmail });

  function setSendEmail(newSendMail) {
    sendMail = newSendMail;
  }

  function respondOK(req, res) {
    res.status(204).send();
  }

  async function addSubscriber(req, res) {
    if (!req.params.listId) {
      res.status(400).send('Missing `listId` in path.');
      return;
    }
    if (!req.query.email) {
      res.status(400).sendFile('html/email-form.html', { root: __dirname });
      return;
    }

    var list = store.lists[req.params.listId];
    if (!list) {
      res.status(404).send('List does not exist.');
      return;
    }

    if (list.subscribers.includes(req.query.email)) {
      res
        .status(202)
        .send(`You have already subscribed to ${req.params.listId}.`);
      return;
    }

    var token;
    try {
      token = await addToken({ email: req.query.email });
    } catch (error) {
      res.status(500).send('Error while committing token');
      return;
    }

    // Add to list.
    list.subscribers.push(req.query.email);

    fs.writeFile(
      storePath,
      JSON.stringify(store, null, 2),
      { encoding: 'utf8' },
      writeFileDone,
    );

    function writeFileDone(error) {
      if (error) {
        nonBlockingLog('Error while trying to commit store:', error);
        res.status(500).send('Could not commit to the list. Try again, maybe.');
        return;
      }

      const message = `Thanks for subscribing to ${list.listName}! To unsubscribe, click here: ${serviceBaseURL}/list/${list.listName}/remove?email=${req.query.email}&token=${token}`;
      sendMail(req.query.email, message, sendMailDone);

      function sendMailDone(error) {
        if (error) {
          nonBlockingLog('Error from sending mail:', error.message);
          res
            .status(500)
            .send(
              'You have subscribed, but we were not able to get the confirmation email to you.',
            );
          return;
        }

        res
          .status(201)
          .send(
            `OK! You have successfully subscribed to ${req.params.listId}.`,
          );
      }
    }
  }

  // TODO: DRY stuff that duplicates addSubscriber code.
  function removeSubscriber(req, res) {
    if (!req.params.listId) {
      res.status(400).send('Missing `listId` in path.');
      return;
    }
    if (!req.query.email || !req.query.token) {
      res.status(400).sendFile('html/email-form.html', { root: __dirname });
      return;
    }

    var tokenObj = store.tokensForUsers[req.query.email];

    if (!tokenObj || tokenObj.token !== req.query.token) {
      res.status(401).sendFile('html/email-form.html', { root: __dirname });
      return;
    }

    // Remove from list
    var list = store.lists[req.params.listId];
    if (!list) {
      res.status(404).send('List does not exist.');
      return;
    }

    const subIndex = list.subscribers.findIndex(
      (sub) => sub === req.query.email,
    );
    if (subIndex === -1) {
      res.status(404).send("I can't find that email.");
      return;
    }

    list.subscribers.splice(subIndex, 1);

    fs.writeFile(
      storePath,
      JSON.stringify(store, null, 2),
      { encoding: 'utf8' },
      writeFileDone,
    );

    function writeFileDone(error) {
      if (error) {
        nonBlockingLog('Error while trying to commit store:', error);
        res.status(500).send('Could not commit to the list. Try again, maybe.');
        return;
      }
      res
        .status(201)
        .send(
          `OK! You have successfully unsubscribed from ${req.params.listId}.`,
        );
    }
  }

  // #throws
  async function addToken({ email }) {
    const token = randomId(16);
    // Store token.
    store.tokensForUsers[email] = {
      token,
    };
    await commitStore(store);
    return token;
  }

  function respondHead(req, res) {
    if (req.method !== 'OPTIONS') {
      res.writeHead(200, {
        'content-type': 'application/json',
      });
    } else {
      res.writeHead(200, 'OK');
    }
    res.end();
  }

  // #throws
  async function commitStore(store) {
    const storeText = JSON.stringify(store, null, 2);
    return fsPromises.writeFile(storePath, storeText, { encoding: 'utf8' });
  }
}

module.exports = ListService;
