/* global process, __dirname */
var test = require('tape');
var assertNoError = require('assert-no-error');
var ListService = require('../list-service');
var http = require('http');
var path = require('path');
var fs = require('fs');

const port = 5678;
const serverHost = process.env.SERVER || 'localhost';
const serviceBaseURL = `http://${serverHost}:${port}`;

// TODO: Copy initial state of store to working copy.
const initialStateStorePath = path.join(
  __dirname,
  'fixtures/test-store-a-initial-state.json',
);
const storePath = initialStateStorePath.replace(
  'initial-state',
  'working-copy',
);
fs.copyFileSync(initialStateStorePath, storePath);
initialStateStorePath, storePath;

var testCases = [
  {
    name: 'Add to list, starting without a token',
    subcases: [
      {
        name: 'Try to add without a token',
        method: 'GET',
        path: '/list/First test list/add?email=smidgeo@fastmail.com&token=',
        expectedStatusCode: 400,
        async customCheckResponse(t, res) {
          const body = await res.text();
          t.ok(
            body.includes('Enter your email to get a link to this list'),
            'Without token, an email form is presented.',
          );
        },
      },
      {
        name: 'Request token',
        method: 'GET',
        path: '/signup?email=smidgeo@fastmail.com&list=First test list',
        expectedStatusCode: 200,
        expectedMailCmdAddress: 'smidgeo@fastmail.com',
        expectedMailCmdStdIn: `Thanks for subscribing to First test list! Click here to confirm your subscription: http://${serverHost}:${port}/list/First test list/add?email=smidgeo@fastmail.com&token=pUtuZmLloZJUqccS`,
      },
    ],
  },
];

testCases.forEach(runTest);

function runTest(testCase) {
  test(testCase.name, testRequest);

  function testRequest(t) {
    var server;

    function MailSender() {
      var expectedMailCmdAddress;
      var expectedMailCmdStdIn;
      var t;

      return {
        setAddress(address) {
          expectedMailCmdAddress = address;
        },
        setStdIn(stdIn) {
          expectedMailCmdStdIn = stdIn;
        },
        setT(theT) {
          t = theT;
        },
        sendMail(address, stdIn) {
          if (t) {
            t.equal(
              address,
              expectedMailCmdAddress,
              'Sent email address is correct.',
            );
            t.equal(
              stdIn,
              expectedMailCmdStdIn,
              'Sent stdin content is correct.',
            );
          }
        },
      };
    }

    var mailSender = MailSender();
    ListService(
      {
        storePath,
        sendMail: mailSender.sendMail,
        seed: 'test-a',
        serviceBaseURL,
      },
      startServer,
    );
    function startServer(error, { app }) {
      assertNoError(t.ok, error, 'Service created.');
      if (error) {
        console.log('Error creating servce:', error);
        process.exit();
      }
      server = http.createServer(app);
      server.listen(port, runRequest);
    }

    async function runRequest(error) {
      assertNoError(t.ok, error, 'Server started correctly.');
      if (testCase.subcases) {
        for (let subcase of testCase.subcases) {
          console.log('Testing subcase', subcase.name);
          await runCase(subcase);
        }
      } else {
        await runCase(testCase);
      }
      // Sadly, I guess the server takes a while to close.
      server.close(() => setTimeout(t.end, 100));
    }

    async function runCase(theCase) {
      if (theCase.expectedMailCmdAddress) {
        mailSender.setAddress(theCase.expectedMailCmdAddress);
      }
      if (theCase.expectedMailCmdStdIn) {
        mailSender.setStdIn(theCase.expectedMailCmdStdIn);
      }
      if (theCase.expectedMailCmdAddress || theCase.expectedMailCmdStdIn) {
        mailSender.setT(t);
      }
      const url = `http://${serverHost}:${port}${theCase.path}`;
      var reqOpts = {
        method: theCase.method,
      };
      try {
        var res = await fetch(url, reqOpts);
        checkResponse(res);
      } catch (error) {
        onFetchFail(error);
      }

      async function checkResponse(res) {
        t.equal(
          res.status,
          theCase.expectedStatusCode,
          'Correct status code is returned.',
        );

        if (theCase.customCheckResponse) {
          await theCase.customCheckResponse(t, res);
        }
        // if (res.statusCode !== 200) {
        //   console.log('body:', body);
        // }
      }
    }

    function onFetchFail(error) {
      assertNoError(t.ok, error, 'No error while making request.');
    }
  }
}
