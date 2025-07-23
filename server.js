require('dotenv').config();
const app = require('./src/app');
const { connectToMongo } = require('./src/config/db');

const PORT = process.env.PORT || 3000;

