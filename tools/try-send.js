/* global process */

require('dotenv').config();

// You can first add users to the list by GETting urls like
// https://test.com/list/First_test_list/add?email=smidgeo@fastmail.com

(async function go() {
  try {
    var res = await fetch(process.env.SERVER_BASE_URL + '/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SENDER_PASSWORD}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        listId: 'First_test_list',
        subject: 'Hey',
        message: 'Blasting everyone with this important message.',
      }),
    });
    console.log('Receive response:', res.status, await res.text());
  } catch (error) {
    console.error('Error while making request:', error);
  }
})();
