/* global process */

var fs = require('fs');
require('dotenv').config();

if (process.argv.length < 5) {
  console.error(
    'Usage: node tools/send-to-list.js <list name> <subject> <content file path>',
  );
  process.exit();
}

const listId = process.argv[2];
const subject = process.argv[3];
const contentFilePath = process.argv[4];

var message = fs.readFileSync(contentFilePath, { encoding: 'utf8' });

(async function go() {
  try {
    var res = await fetch(process.env.SERVER_BASE_URL + '/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SENDER_PASSWORD}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ listId, subject, message }),
    });
    console.log('Received response:', res.status, await res.text());
  } catch (error) {
    console.error('Error while making request:', error);
  }
})();
