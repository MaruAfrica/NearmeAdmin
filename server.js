if (process.env.NEW_RELIC_LICENSE_KEY) require('newrelic')
if (process.env.NODE_ENV !== 'production') require('dotenv').config()

const express = require('express')
const ParseServer = require('parse-server').ParseServer
const ParseDashboard = require('parse-dashboard')
const S3Adapter = require('parse-server').S3Adapter
const FSFilesAdapter = require('@parse/fs-files-adapter')
const bodyParser = require('body-parser')
const expressLayouts = require('express-ejs-layouts')
const cookieParser = require('cookie-parser')
const methodOverride = require('method-override')
const cookieSession = require('cookie-session')

// AWS S3 configuration
const accessKeyId = process.env.AWS_ACCESS_KEY_ID
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
const bucketName = process.env.BUCKET_NAME

let filesAdapter = new FSFilesAdapter()

if (accessKeyId && secretAccessKey && bucketName) {
  filesAdapter = new S3Adapter(
    accessKeyId, secretAccessKey, bucketName, { directAccess: true })
}

const app = express()

app.set('view engine', 'ejs')
app.set('views', 'views')

app.use(bodyParser.urlencoded({
  limit: process.env.MAX_REQUEST_SIZE,
  extended: false
}))

app.use(bodyParser.json({
  limit: process.env.MAX_REQUEST_SIZE,
}))

app.use(express.static(__dirname + '/public'))
app.use(expressLayouts)
app.use(cookieParser())
app.use(methodOverride())

app.use(cookieSession({
  name: process.env.APP_ID + '.sess',
  secret: process.env.MASTER_KEY,
  maxAge: 365 * 24 * 60 * 60 * 1000 // 1 year
}))

app.use((req, res, next) => {
  res.locals.user = req.session.user
  res.locals.page = req.url.split('/').pop()
  res.locals.appId = process.env.APP_ID
  res.locals.appName = process.env.APP_NAME
  res.locals.serverUrl = process.env.PUBLIC_SERVER_URL
  res.locals.googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY
  next()
})

// Parse Server Configuration
// https://github.com/parse-community/parse-server#configuration

const api = new ParseServer({
  databaseURI: process.env.MONGO_URL,
  cloud: __dirname + '/cloud/main.js',
  appId: process.env.APP_ID,
  masterKey: process.env.MASTER_KEY,
  serverURL: `http://localhost:${process.env.PORT}/parse`,
  filesAdapter: filesAdapter,
  verifyUserEmails: false,
  allowClientClassCreation: false,
  publicServerURL: process.env.PUBLIC_SERVER_URL,
  logLevel: process.env.LOG_LEVEL,
  appName: process.env.APP_NAME,
  maxUploadSize: process.env.MAX_REQUEST_SIZE,
  emailAdapter: {
    module: '@parse/simple-mailgun-adapter',
    options: {
      fromAddress: process.env.MAILGUN_FROM_ADDRESS,
      domain: process.env.MAILGUN_DOMAIN,
      apiKey: process.env.MAILGUN_API_KEY,
    }
  },
  push: {
    android: {
      senderId: process.env.PUSH_ANDROID_SENDER_ID,
      apiKey: process.env.PUSH_ANDROID_API_KEY
    },
    ios: [{
        pfx: __dirname + '/push/dev.p12',
        topic: process.env.PUSH_IOS_BUNDLE_ID,
        production: false
      },
      {
        pfx: __dirname + '/push/prod.p12',
        topic: process.env.PUSH_IOS_BUNDLE_ID,
        production: true
      }
    ]
  },
})

// Parse Dashboard
// https://github.com/parse-community/parse-dashboard

const dashboard = new ParseDashboard({
  apps: [
    {
      serverURL: process.env.PUBLIC_SERVER_URL,
      appId: process.env.APP_ID,
      masterKey: process.env.MASTER_KEY,
      appName: process.env.APP_NAME,
      production: true,
    }
  ],
  users: [
    {
      user: process.env.PARSE_DASHBOARD_USER,
      pass: process.env.PARSE_DASHBOARD_PASS
    },
  ],
  useEncryptedPasswords: true,
  trustProxy: 1
}, { allowInsecureHTTP: true, cookieSessionSecret: process.env.MASTER_KEY });

// Serve the Parse API on the /parse URL prefix
app.use('/parse', api)

// Serve the Parse Dashboard on the /dashboard URL prefix
app.use('/dashboard', dashboard);

app.use(require('./controllers'))

// Cron job to expire places every minute.
require('./jobs/expire-places');

const httpServer = require('http').createServer(app)
httpServer.listen(process.env.PORT, () => {
  console.log(process.env.APP_NAME + ' running on port ' + process.env.PORT + '.')
})