const client = require('@sendgrid/client');

client.setApiKey(process.env.SENDGRID_API_KEY);
const request = {
  method: 'GET',
  url: '/v3/templates',
  qs: {
    generations: 'dynamic',
  }
};

client.request(request).then(([response, body]) => {
  console.log(response.statusCode);
  console.log(JSON.stringify(body, '\n', '  '));
});
