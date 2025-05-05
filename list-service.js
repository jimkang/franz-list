/* global process, __dirname */
var express = require('express');
var cors = require('cors');
var bodyParser = require('body-parser');
var fs = require('fs');
var VError = require('verror');
var RandomId = require('@jimkang/randomid');
var seedrandom = require('seedrandom');
var nonBlockingLog = require('./non-blocking-log');

function ListService(
  {
    storePath,
    sendMail,
    seed,
    serviceBaseURL,
    tokenLifespanInMS = 1000 * 60 * 60 * 24 * 14,
  },
  done,
) {
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
  app.get('/signup', cors(), signUp);
  app.head(/.*/, respondHead);

  process.nextTick(done, null, { app });

  function respondOK(req, res) {
    res.status(204).send();
  }

  function addSubscriber(req, res) {
    if (!req.params.listId) {
      res.status(400).send('Missing `listId` in path.');
      return;
    }
    if (!req.query.email || !req.query.token) {
      res.status(400).sendFile('html/email-form.html', { root: __dirname });
      return;
    }

    var tokenObj = store.tokensForUsers[req.query.email];
    // TODO: Check expiry
    if (!tokenObj || tokenObj.token !== req.query.token) {
      res.status(401).sendFile('html/email-form.html', { root: __dirname });
      return;
    }

    // Add to list
    var list = store.lists[req.params.listId];
    if (!list) {
      res.status(400).send('List does not exist.');
      return;
    }

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
      res
        .status(201)
        .send(`OK! You have successfully subscribed to ${req.params.listId}.`);
    }
  }

  function signUp(req, res) {
    if (!req.query.email || !req.query.list) {
      res
        .status(400)
        .send('You need to provide an email and choose a list to sign up.');
      return;
    }
    var list = store.lists[req.query.list];
    if (!list) {
      res.status(400).send('That list does not exist.');
      return;
    }

    const token = randomId(16);
    // Store token.
    store.tokensForUsers[req.query.email] = {
      token,
      expiry: new Date(Date.now() + tokenLifespanInMS).toISOString(),
    };
    commitStore(store);

    const message = `Thanks for subscribing to First test list! Click here to confirm your subscription: ${serviceBaseURL}/list/${req.query.list}/add?email=${req.query.email}&token=${token}`;
    sendMail(req.query.email, message);

    res.status(200).send('OK! Check your mail for the confirmation link.');
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

  function commitStore(store) {
    const storeText = JSON.stringify(store, null, 2);
    fs.writeFile(storePath, storeText, { encoding: 'utf8' }, handleError);

    function handleError(error) {
      if (error) {
        nonBlockingLog('Error while committing to', storePath, error);
      }
    }
  }
}

module.exports = ListService;
