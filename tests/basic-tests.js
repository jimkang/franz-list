/* global process */
var test = require('tape');
var assertNoError = require('assert-no-error');
var ListService = require('../list-service');
var http = require('http');

const port = 5678;
const serverHost = process.env.SERVER || 'localhost';

var testCases = [
  {
    name: 'Show list without token',
    method: 'GET',
    path: '/list/1/show',
    expectedStatusCode: 200,
    async customCheckResponse(t, res) {
      const body = await res.text();
      t.ok(
        body.includes('Enter your email to get a link to this list'),
        'Without token, an email form is presented.',
      );
    },
  },
  {
    name: 'Resource request and use',
    subcases: [
      {
        name: 'Show list with bad token',
        method: 'GET',
        path: '/token/whatever/list/1/show',
        expectedStatusCode: 401,
      },
      {
        name: 'Post email to token request',
        method: 'POST',
        path: '/request',
        body: {
          resource: 'list/1/show',
          email: 'smidgeo@fastmail.com',
        },
        expectedStatusCode: 200,
      },
    ],
  },
];

testCases.forEach(runTest);

function runTest(testCase) {
  test(testCase.name, testRequest);

  function testRequest(t) {
    var server;

    ListService(startServer);

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
