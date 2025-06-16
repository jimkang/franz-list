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
  app.use('/misc', express.static('html'));

  app.get('/health', respondOK);
  app.get('/list/:listId/add', cors(), addSubscriber);
  app.get('/list/:listId/remove', cors(), removeSubscriber);
  app.post('/send', cors(), checkBearer, sendToList);
  app.head(/.*/, respondHead);

  process.nextTick(done, null, { app, setSendEmail });

  function setSendEmail(newSendMail) {
    sendMail = newSendMail;
  }

  function respondOK(req, res) {
    res.status(200).send('OK!');
  }

  async function addSubscriber(req, res) {
    if (!req.params.listId) {
      res.status(400).send('Missing `listId` in path.');
      return;
    }
    if (!req.query.email) {
      res.redirect(301, '/misc/signup');
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
      sendMail(
        {
          address: req.query.email,
          subject: `${list.listName} subscription`,
          message,
        },
        sendMailDone,
      );

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

      nonBlockingLog('Unsubscribe ' + req.query.email);
      res
        .status(201)
        .send(
          `OK! You have successfully unsubscribed from ${req.params.listId}.`,
        );
    }
  }

  async function sendToList(req, res) {
    if (!req.body.listId) {
      res.status(400).send('Missing listId.');
      return;
    }

    // Get list, send to each email.
    var list = store.lists[req.body.listId];
    if (!list) {
      res.status(404).send('List does not exist.');
      return;
    }

    const subject = req.body.subject || req.body.message.slice(0, 20);
    var sendPromises = list.subscribers.map(sendToSubscriber);

    try {
      var results = await Promise.allSettled(sendPromises);
      var failures = results.filter((result) => result.status === 'rejected');
      if (failures.length < 1) {
        res.status(200).send('Message sent to all subscribers!');
        return;
      }
      const failureMesssage = `Could not send to all subscribers. The following errors were encountered:\n${failures.map((failure) => failure.reason.message).join('\n')}`;
      res.status(500).send(failureMesssage);
    } catch (error) {
      nonBlockingLog('Error while sending messages:', error);
      res.status(500).send('Hit an unexpected error while sending messages.');
    }

    function sendToSubscriber(subscriber) {
      var tokenObj = store.tokensForUsers[subscriber];

      if (!tokenObj) {
        return Promise.reject(
          new Error('Could not get token for ' + subscriber),
        );
      }

      const signUpLink = `/misc/signup?list=${list.listName}`;
      const message =
        req.body.message +
        `<hr><br>
      This has been a message from the ${list.listName} mailing list.<br>
<ul>
<li>To unsubscribe, <a href="${serviceBaseURL}/list/${list.listName}/remove?email=${subscriber}&token=${tokenObj.token}">click here</a></li>
<li>To invite someone to subscribe, send them to <a href="${signUpLink}">${signUpLink}</a></li>
</ul>`;

      return new Promise(sendExecutor);

      function sendExecutor(resolve, reject) {
        sendMail({ address: subscriber, subject, message }, sendMailDone);
        function sendMailDone(error) {
          if (error) {
            nonBlockingLog('Error from sending mail:', error.message);
            reject(error);
            return;
          }
          resolve();
        }
      }
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

function checkBearer(req, res, next) {
  if (req.headers.authorization !== `Bearer ${process.env.SENDER_PASSWORD}`) {
    res.status(401);
    res.send();
    next('route');
    return;
  }
  next();
}

module.exports = ListService;
