// Globals
var activeDayDate = new Date();
var isTodayTheActiveDay = true;
var lastTimestamp = 0;
var timezoneOffsetInSeconds = (new Date().getTimezoneOffset())*60;


// convert time to human-readable format YYYY/MM/DD HH:MM:SS
function epochToDateTime(epochTime){
  var epochDate = (epochTime!=null) ? new Date(epochTime*1000) : new Date();
  var dateTime = epochDate.getFullYear() + "/" +
    ("00" + (epochDate.getMonth() + 1)).slice(-2) + "/" +
    ("00" + epochDate.getDate()).slice(-2) + " " +
    ("00" + epochDate.getHours()).slice(-2) + ":" +
    ("00" + epochDate.getMinutes()).slice(-2) + ":" +
    ("00" + epochDate.getSeconds()).slice(-2);

  return dateTime;
}

function epochToDate(epochTime){
  return epochToDateTime(epochTime).substring(0,10);
}

function epochToTime(epochTime){
  return epochToDateTime(epochTime).substring(11);
}
function getDaySignature(date){
  return date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();
}

function shiftActiveDay(daysOffset){
  activeDayDate.setDate(activeDayDate.getDate() + daysOffset);
  updateIsTodayTheActiveDay();
  loadTracksForActiveDay();
}

// DOM elements
const loginElement = document.querySelector('#login-form');
const contentElement = document.querySelector("#content-sign-in");
const userDetailsElement = document.querySelector('#user-details');
const authBarElement = document.querySelector('#authentication-bar');

const cardsReadingsElement = document.querySelector("#cards-div");
const chartsDivElement = document.querySelector('#charts-div');
const chartGeneralTitle = document.querySelector('#chart-general-title');
const injectionElement = document.getElementById("injection");
const consigneElement = document.getElementById("consigne");
const autoconsoElement = document.getElementById("autoconso");
const updateElement = document.getElementById("lastUpdate");

const buttonPreviousDay = document.getElementById("buttonPreviousDay");
const buttonNextDay = document.getElementById("buttonNextDay");

buttonPreviousDay.addEventListener('click', (e) => {
  shiftActiveDay(-1);
  e.preventDefault();
  return false;
});
buttonNextDay.addEventListener('click', (e) => {
  shiftActiveDay(1);
  e.preventDefault();
  return false;
});


// MANAGE LOGIN/LOGOUT UI
const setupUI = () => {
  if ( firebaseUser == null ) {
    // toggle UI elements (user logged out)
    loginElement.style.display = 'block';
    authBarElement.style.display ='none';
    userDetailsElement.style.display ='none';
    contentElement.style.display = 'none';

  } else{
    //toggle UI elements (user logged in)
    loginElement.style.display = 'none';
    contentElement.style.display = 'block';
    authBarElement.style.display ='block';
    userDetailsElement.style.display ='block';
    userDetailsElement.innerHTML = firebaseUser.email;

    initiateActiveDay();
    updateIsTodayTheActiveDay();

    loadTracksForActiveDay();
    loadRealtimeTracks();
    
  }
}

function updateIsTodayTheActiveDay(){
  isTodayTheActiveDay = (getDaySignature(activeDayDate)==getDaySignature(new Date()));
  buttonNextDay.style.visibility = isTodayTheActiveDay ? 'hidden':'visible';
}

function initiateActiveDay(){
  activeDayDate = new Date()
  const urlParams = new URLSearchParams(window.location.search);
  if(urlParams.has('d')){
    queryDaySignature = urlParams.get('d');
    queryDaySignatureElements = queryDaySignature.split('-');
    activeDayDate.setFullYear(queryDaySignatureElements[0]);
    activeDayDate.setMonth(queryDaySignatureElements[1] - 1);
    activeDayDate.setDate(queryDaySignatureElements[2]);
    activeDayDate.setHours(12);
  }
}
function loadRealtimeTracks(){
  var dbPath = 'UsersData/' + firebaseUser.uid.toString() + '/pvRecords';
  var recordsCollection = firebase.firestore().collection(dbPath);
  //const realtimeQuery = recordsCollection.orderBy("timestamp", "desc")/*.startAfter(lastTimestamp)*/.limit(1);
  //realtimeQuery.onSnapshot(querySnapshot => {
  //  querySnapshot.docChanges().forEach(change => {
  recordsCollection.doc("latest").onSnapshot((doc) => {
    var jsonData = doc.data();

    updateElement.innerHTML = epochToDateTime(null);
    injectionElement.innerHTML = jsonData.Pi;
    consigneElement.innerHTML = jsonData.k;
    autoconsoElement.innerHTML = jsonData.Pac;
    
    if(isTodayTheActiveDay){
      var x = new Date().getTime();
      chartG.series[0].addPoint([x, Math.round(jsonData.Pi )], true, false, true);
      chartG.series[1].addPoint([x, Math.round(jsonData.Pac)], true, false, true);
    }
  });
}

function loadTracksForActiveDay(){

  var rangeMinDate = new Date(activeDayDate);
  rangeMinDate.setHours(0, 0, 0, 0);
  var rangeMinTs = Math.round(rangeMinDate.getTime()/1000);

  var rangeMaxDate = new Date(activeDayDate);
  rangeMaxDate.setHours(23, 59, 59);
  var rangeMaxTs = Math.round(rangeMaxDate.getTime()/1000);
  console.log("Querying between "+rangeMinDate+" and "+rangeMaxDate);
  
  if(chartG != undefined){
    chartG.series.forEach(s => {s.setData([]);}); 
  }else{
    chartG = createGeneralChart();
  }

  //var dbRef = firebase.database().ref(dbPath);
  var dbPath = 'UsersData/' + firebaseUser.uid.toString() + '/pvRecords';
  var recordsCollection = firebase.firestore().collection(dbPath);
  const query = recordsCollection.orderBy("timestamp", "asc").startAt(rangeMinTs).endAt(rangeMaxTs);
  query.get().then(snapshot => {
    var Ei = 0;
    var Eac = 0;
    snapshot.forEach(record => {
        var jsonData = record.data();
        lastTimestamp = jsonData.timestamp;
        Ei  += jsonData.Ei;
        Eac += jsonData.Eac;
        var x = new Date((jsonData.timestamp)*1000).getTime();
        chartG.series[0].addPoint([x, Math.round(jsonData.Pi )], false, false, false);
        chartG.series[1].addPoint([x, Math.round(jsonData.Pac)], false, false, false);
        chartG.series[2].addPoint([x, Math.round(Ei)], false, false, false);
        chartG.series[3].addPoint([x, Math.round(Eac)], false, false, false);
      });
      chartGeneralTitle.innerHTML = epochToDate(lastTimestamp);
      chartG.redraw();
      
  })
  .catch(error => {
    console.error(error);
  });
}
