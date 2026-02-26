const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/stats/dashboard',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN_HERE' 
  }
}, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(data));
});

req.end();
