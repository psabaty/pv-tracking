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
  const daysCollection = admin.firestore().collection(baseCollectionPath+'/dailyReports');
  const minutesIncrement = 5;

  var dayMetrics = {
    duration: 0,
    avgPi: 0,
    avgPac: 0,
    avgK: 0,
    Ei: 0,
    Eac: 0,
    Ep: 0,
    Ec: 0,
    maxPi: 0,
    maxPac: 0,
  };

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
    var cumulatedEp = 0;
    var cumulatedEc = 0;
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
          cumulatedEp += (docData.Ei>0) ? (docData.Ei + docData.Eac) : 0;
          cumulatedEc += (docData.Ei<0) ? (-1 * docData.Ei) : 0;
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
          Ep: Number(cumulatedEp.toFixed(2)),
          Ec: Number(cumulatedEc.toFixed(2)),
          maxPi: maxPi,
          maxPac: maxPac,
      });
      
      // building progressively day metrics
      dayMetrics.duration += cumulatedDuration;
      dayMetrics.Ei += aggregatedData.Ei;
      dayMetrics.Eac += aggregatedData.Eac;
      dayMetrics.Ep += aggregatedData.Ep;
      dayMetrics.Ec += aggregatedData.Ec;
      dayMetrics.maxPi = Math.max(dayMetrics.maxPi, aggregatedData.maxPi);
      dayMetrics.maxPac = Math.max(dayMetrics.maxPac, aggregatedData.maxPac);
      // averages will be later divided by total duration
      dayMetrics.avgPi += (avgPi * cumulatedDuration);
      dayMetrics.avgPac += (avgPac * cumulatedDuration);
      dayMetrics.avgK += (avgK * cumulatedDuration);

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

  // record day metrics
  if (dayMetrics.duration > 0){
    dayMetrics.avgPi = Math.round(dayMetrics.avgPi / dayMetrics.duration);
    dayMetrics.avgPac = Math.round(dayMetrics.avgPac / dayMetrics.duration);
    dayMetrics.avgK = Math.round(dayMetrics.avgK / dayMetrics.duration);
  }
  var dayDocName = `${y}-${m}-${d}`;
  writeBatch.set(daysCollection.doc(dayDocName), dayMetrics);
  batchCount += 1;

  if (batchCount > 0) {
    console.log('Firebase batch operation completed. Doing final committing of batch operation.');
    await writeBatch.commit();
  } else {
    console.log('Firebase batch operation completed.');
  }
  return 0;
}
