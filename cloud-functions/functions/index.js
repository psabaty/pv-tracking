const admin = require("firebase-admin");
admin.initializeApp();

exports.pvTracking = require("./pvTracking");
