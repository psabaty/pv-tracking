const functions = require("firebase-functions");
const admin = require("firebase-admin");

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
  const query_d = req.query.d;
  const query_m = req.query.m;
  const query_y = req.query.y;
  const userId = 'bFhvGN7eP6afwhsHHencm5rbHmu2';
  if(!query_d || !query_m || !query_y){
    res.json({error: 'Expected y,m,d get parameters' });
  }else{
    var val = await aggregateDay(userId, query_y, query_m, query_d); 
    res.json({result: `Aggregating day ${query_y}-${query_m}-${query_d} : val=${val}`});
  }
});

async function aggregateDay(userId, y,m,d) {
  const baseCollectionPath = '/UsersData/'+userId;
  const recordsCollection = admin.firestore().collection(baseCollectionPath+'/pvRecords');
  const destCollection = admin.firestore().collection(baseCollectionPath+'/aggregatedRecords');
  const minutesIncrement = 5;

  let writeBatch = admin.firestore().batch();
  let batchCount = 0;
  
  var rangeMinDate = new Date(y, m-1, d, 0, 0, 0);
  var rangeMaxDate = new Date(y, m-1, d, 0, minutesIncrement, 0);
  
  do{
    console.log("Querying from "+rangeMinDate+" within "+minutesIncrement+" minutes");
    
    const query = recordsCollection.orderBy("timestamp", "asc")
        //.where('year', '==', y).where('month', '==', m).where('day', '==', d)
        .startAt(Math.round(rangeMinDate.getTime()/1000))
        .endBefore(Math.round(rangeMaxDate.getTime()/1000));
    
    var duration = 0;
    var cumulatedDuration = 0;
    var cumulatedEi = 0;
    var cumulatedEac = 0;
    var avgPi = 0;
    var avgPac = 0;
    var avgK = 0;
    var maxPi = 0;
    var maxPac = 0;
    var nextDoc = null;

    const documents = await query.get();
    console.log('found '+documents.size+' records');

    if(documents.size > 0) {
      for (var i in documents.docs) {
        try{
          const docData = documents.docs[i].data();
          // find duration
          if(docData.duration != undefined){
            duration = docData.duration;
          }else if(i < documents.size - 1){
            nextDoc = documents.docs[Number(i)+1];
            duration = nextDoc.data().timestamp - docData.timestamp; 
          }else if(documents.size == 1){
            // only 1 record : using sampling period as duration
            duration = 60 * minutesIncrement; 
          }else{
            // only on last doc : no way to determine duration -> previous duration will be used
          }
          // cumulated values            
          cumulatedDuration += duration;
          cumulatedEi += docData.Ei;
          cumulatedEac += docData.Eac;
          maxPi = Math.max(maxPi, docData.Pi),
          maxPac = Math.max(maxPac, docData.Pac),
          // averages will be later divided by cumulatedDuration
          avgPi += (docData.Pi * duration);
          avgPac += (docData.Pac * duration);
          avgK += (docData.k * duration);
        }catch(e){
          console.log("Failed reading record#"+i+" -> Skipped");
          console.log(e.toString());
        }
      }
      if (cumulatedDuration > 0){
        avgPi = Math.round(avgPi / cumulatedDuration);
        avgPac = Math.round(avgPac / cumulatedDuration);
        avgK = Math.round(avgK / cumulatedDuration);
      }
      
      // using last docData for init, because it has the right time fields (timestamp, hour, ...) 
      console.log('Base document : '+documents.docs[documents.size-1].id);
      var aggregatedData = documents.docs[documents.size-1].data();
      Object.assign(aggregatedData, {
          aggregated: true,
          duration: cumulatedDuration,
          Pi: avgPi,
          Pac: avgPac,
          k: avgK,
          Ei: Number(cumulatedEi.toFixed(2)),
          Eac: Number(cumulatedEac.toFixed(2)),
          maxPi: maxPi,
          maxPac: maxPac,
      });
      
      // Add to batch
      writeBatch.set(destCollection.doc(String(aggregatedData.timestamp)), aggregatedData);
      batchCount++;
      if (batchCount > 400) {  // write batch only allows maximum 500 writes per batch
          batchCount = 0;
          console.log('Intermediate committing of batch operation');
          await writeBatch.commit();
          writeBatch = firebaseAdmin.firestore().batch();
      } 
    }
    // increment date range
    rangeMinDate.setMinutes(rangeMinDate.getMinutes() + minutesIncrement);
    rangeMaxDate.setMinutes(rangeMaxDate.getMinutes() + minutesIncrement);

  }while(rangeMinDate.getDate() == d)
  //}while(false)

  if (batchCount > 0) {
    console.log('Firebase batch operation completed. Doing final committing of batch operation.');
    await writeBatch.commit();
  } else {
    console.log('Firebase batch operation completed.');
  }
  return 0;
}


exports.buildDailyReport = functions.region("europe-central2").https.onRequest(async (req, res) => {
  const query_d = req.query.d;
  const query_m = req.query.m;
  const query_y = req.query.y;
  const userId = 'bFhvGN7eP6afwhsHHencm5rbHmu2';
  if(!query_d || !query_m || !query_y){
    throw new Error('Expected y,m,d get parameters');
  }
  //return buildDailyReport(userId, query_y, query_m, query_d); 
  await buildDailyReport(userId, query_y, query_m, query_d); 
  res.json({result: `Built daily report ${query_y}-${query_m}-${query_d} `});
});

async function buildDailyReport(userId, y,m,d) {
  const baseCollectionPath = '/UsersData/'+userId;
  const aggregatedRecordsCollection = admin.firestore().collection(baseCollectionPath+'/aggregatedRecords');
  
  var dayMetrics = {
    duration: 0,
    avgPi: 0,
    avgPac: 0,
    avgK: 0,
    Ei: 0,
    Eac: 0,
    Ep: 0,
    Es: 0,
    maxPi: 0,
    maxPac: 0,
    firstRecordTs: 0,
    lastRecordTs: 0,
  };

  let writeBatch = admin.firestore().batch();
  
  var rangeMinDate = new Date(y, m-1, d, 0, 0, 0);
  var rangeMaxDate = new Date(y, m-1, d, 24, 0, 0);
  
  console.log("Querying from "+rangeMinDate+" within 24 hours");
  
  const query = aggregatedRecordsCollection.orderBy("timestamp", "asc")
    //.where('year', '==', y).where('month', '==', m).where('day', '==', d)
    .startAt(Math.round(rangeMinDate.getTime()/1000))
    .endBefore(Math.round(rangeMaxDate.getTime()/1000));

  const documents = await query.get();
  console.log('found '+documents.size+' records');

  for (var i in documents.docs) {
    const aggregatedData = documents.docs[i].data();
    const durationInHours = aggregatedData.duration / 3600;

    dayMetrics.duration += aggregatedData.duration;
    dayMetrics.Ei += aggregatedData.Ei;
    dayMetrics.Eac += aggregatedData.Eac;
    dayMetrics.Ep += Math.max(0, aggregatedData.Ei + aggregatedData.Eac);
    dayMetrics.Es += (aggregatedData.Pi<0) ? (-1 * aggregatedData.Pi * durationInHours) : 0;
    dayMetrics.maxPi = Math.max(dayMetrics.maxPi, aggregatedData.maxPi);
    dayMetrics.maxPac = Math.max(dayMetrics.maxPac, aggregatedData.maxPac);
    // averages will be later divided by total duration
    dayMetrics.avgPi += (aggregatedData.Pi * aggregatedData.duration);
    dayMetrics.avgPac += (aggregatedData.Pac * aggregatedData.duration);
    dayMetrics.avgK += (aggregatedData.k * aggregatedData.duration);
    dayMetrics.lastRecordTs = aggregatedData.timestamp;
    if(dayMetrics.firstRecordTs == 0){
      dayMetrics.firstRecordTs = aggregatedData.timestamp;
    }
  }
  
  // averages day metrics final division
  if (dayMetrics.duration > 0){
    dayMetrics.avgPi = Math.round(dayMetrics.avgPi / dayMetrics.duration);
    dayMetrics.avgPac = Math.round(dayMetrics.avgPac / dayMetrics.duration);
    dayMetrics.avgK = Math.round(dayMetrics.avgK / dayMetrics.duration);
  }
  
  var dayDocName = `${y}-${m}-${d}`;
  const newDocRef = admin.firestore().doc(baseCollectionPath+'/dailyReports/'+dayDocName);
  return newDocRef.set(dayMetrics);
}
