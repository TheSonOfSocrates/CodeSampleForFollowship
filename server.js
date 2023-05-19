const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const users = require('./routes/api/users');
const price = require('./routes/api/price');
const admin = require('./routes/api/admin');
const license = require('./routes/api/license');
const app = express();
const SocketServer = require('./socket.js');
const auth = require('./controllers/AuthController');
global.paypalAccessToken = '';

//Add Cors
app.use(cors());
app.options('*', cors());
app.use(express.static('public'));

// Bodyparser middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// stipe webhook sign verification
app.use(
  express.json({
    // We need the raw body to verify webhook signatures.
    // Let's compute it only when hitting the Stripe webhook endpoint.
    verify: function(req, res, buf) {
      if (req.originalUrl.endsWith('webhook')) {
        req.rawBody = buf.toString();
      }
    }
  })
);


// Frontend Urls
app.use(express.static(path.resolve('./frontend/build')));

// Routes
app.use('/api/user', users);
app.use('/api/price', price);
app.use('/api/admin', auth.isAuthorized, admin);
app.use('/api/license', license);

app.get('*', (req, res) => {
  res.sendFile(path.resolve('./frontend/build', 'index.html'));
});

// DB Config
const mongoURI = require('./config/keys').mongoURI;

// Connect to MongoDB
mongoose.connect(mongoURI,
  {
    useNewUrlParser: true,
    useFindAndModify: false,
    user: process.env.DB_USERNAME,
    pass: process.env.DB_PASSWORD,
    dbName: 'TG',
    retryWrites: true,
    w: 'majority'
  }).then(() => console.log('MongoDB successfully connected'))
  .catch((err) => console.log(err));

const port = process.env.PORT || 5000;
const server = app.listen(port, () => console.log(`Server up and running on port ${port} !`));

SocketServer.getInstance(server);