const Groq = require('groq-sdk');

let client = null;

function getClient() {
  if (!client) {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is not set. Add it to your .env file.');
    }
    client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return client;
}

module.exports = { getClient };