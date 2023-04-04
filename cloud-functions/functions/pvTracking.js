const functions = require("firebase-functions");
const admin = require("firebase-admin");
/*
exports.updateBeforeLast = functions.region("europe-central2")
  .firestore.document("/UsersData/{userId}/pvRecords/{documentId}")
  .onCreate(async (snap, context) => {

    // first patch potentially buggy ESP82666 timestamp
    const docDataTimestamp = snap.data().timestamp;

    const userId = context.params.userId;
    const beforeLastDocRef = admin.firestore().doc(`/UsersData/${userId}/pvRecords/beforeLast`);
    return beforeLastDocRef.set(snap.data());
});
*/
exports.persistLatest = functions.region("europe-central2")
  .firestore.document("/UsersData/{userId}/pvRecords/latest")
  .onUpdate(async (change, context) => {
    const currentDate = new Date();
    const currentTS = Math.round(currentDate.getTime()/1000);
    // add time keys for later processing
    const recordData = change.after.data();
    recordData.timestamp = currentTS;
    recordData.minute = currentDate.getMinutes();
    recordData.hour = currentDate.getHours();
    recordData.day = currentDate.getDate();
    recordData.month = currentDate.getMonth()+1;
    recordData.year = currentDate.getFullYear();
    recordData.aggregated = false;

    const userId = context.params.userId;
    const newDocRef = admin.firestore().doc(`/UsersData/${userId}/pvRecords/${currentTS}`);
    return newDocRef.set(recordData);
});
