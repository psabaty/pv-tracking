const functions = require("firebase-functions");
const admin = require("firebase-admin");
const utils = require("./utils");

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


exports.resampleDay = functions.region("europe-central2").https.onRequest(async (req, res) => {
  const d = req.query.d;
  const m = req.query.m;
  const y = req.query.y;
  const userId = 'bFhvGN7eP6afwhsHHencm5rbHmu2';
  if (!d || !m || !y) {
    res.json({error: 'Expected y,m,d get parameters'});
  } else {
const utils = require("./utils");
    const val = await utils.aggregateDay(userId, y, m, d); 
    res.json({result: `Aggregating day ${y}-${m}-${d} : val=${val}`});
  }
});

exports.resampleYesterday = functions.region("europe-central2").pubsub.schedule('0 3 * * *')
  .timeZone('Europe/Paris').onRun((context) => {

  let yesterday = new Date();
  yesterday.setDate(yesterday.getDate()-1);

  const userId = 'bFhvGN7eP6afwhsHHencm5rbHmu2';
  console.log(`Aggregating yesterday ` + yesterday.toDateString());
  return utils.aggregateDay(userId, yesterday.getFullYear(), yesterday.getMonth()+1, yesterday.getDate()); 
});

exports.buildYesterdaysDailyReport = functions.region("europe-central2").pubsub.schedule('2 3 * * *')
  .timeZone('Europe/Paris').onRun((context) => {

  let yesterday = new Date();
  yesterday.setDate(yesterday.getDate()-1);

  const userId = 'bFhvGN7eP6afwhsHHencm5rbHmu2';
  console.log(`Building yesterdays report ` + yesterday.toDateString());
  return utils.buildDailyReport(userId, yesterday.getFullYear(), yesterday.getMonth()+1, yesterday.getDate()); 
});

exports.buildDailyReport = functions.region("europe-central2").https.onRequest(async (req, res) => {
  const d = req.query.d;
  const m = req.query.m;
  const y = req.query.y;
  const userId = 'bFhvGN7eP6afwhsHHencm5rbHmu2';
  if (!d || !m || !y) {
    throw new Error('Expected y,m,d get parameters');
  }
  await utils.buildDailyReport(userId, y, m, d); 
  res.json({result: `Built daily report ${y}-${m}-${d}`});
});
