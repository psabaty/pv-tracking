// Globals
var activeDayDate = new Date();
var isTodayTheActiveDay = true;


// convert time to human-readable format YYYY/MM/DD HH:MM:SS
function epochToDateTime(epochTime){
  var timezoneOffsetInMinutes = new Date().getTimezoneOffset();
  var tzTimestamp = parseInt(epochTime)+(timezoneOffsetInMinutes*60);
  var epochDate = new Date(tzTimestamp*1000);
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

  var daySignature = getDaySignature(new Date());
  var dbPath = 'UsersData/' + firebaseUser.uid.toString() + '/pvTracks/' + daySignature;
  var dbRef = firebase.database().ref(dbPath);

  // Get the latest readings and display on cards
  dbRef.orderByKey().limitToLast(1).on('child_added', snapshot =>{
    var jsonData = snapshot.toJSON(); // example: {injection: 25.02, consigne: 50.20, autoconso: 1008.48, timestamp:1641317355}
    
    // Update top info
    updateElement.innerHTML = epochToDateTime(jsonData.timestamp);

    // Update cards
    injectionElement.innerHTML = jsonData.Pi;
    consigneElement.innerHTML = jsonData.k;
    autoconsoElement.innerHTML = jsonData.Pac;
    
  });
}

function loadTracksForActiveDay(){
    var daySignature = getDaySignature(activeDayDate);
    var dbPath = 'UsersData/' + firebaseUser.uid.toString() + '/pvTracks/' + daySignature;
    var dbRef = firebase.database().ref(dbPath);

    // CHARTS    
    var chartRange = 288; // 288 = 1day / 5 minutes
    if(chartG != undefined){
      chartG.series.forEach(s => {s.setData([]);}); 
    }else{
      chartG = createGeneralChart();
    }
    
    
    /*
    dbRef.orderByKey().limitToLast(chartRange).on('child_added', snapshot =>{
      var jsonData = snapshot.toJSON(); // example: {Pi: 25.02, k: 50.20, Pac: 1008.48, timestamp:1641317355}
      var x = new Date(jsonData.timestamp*1000).getTime();
      chartG.series[0].addPoint([x, Number(jsonData.Pi )], true, (chartG.series[0].data.length > 40), true);
      chartG.series[1].addPoint([x, Number(jsonData.Pac)], true, (chartG.series[1].data.length > 40), true);
    });
    */
    dbRef.orderByKey().limitToLast(chartRange).once('value', snapshots =>{
      var Ei = 0;
      var Eac = 0;
      var chartTitle = null;
      var lastTimestamp = 0;
      snapshots.forEach((snapshot) => {
        var jsonData = snapshot.toJSON(); 
        lastTimestamp = jsonData.timestamp;
        Ei  += jsonData.Ei;
        Eac += jsonData.Eac;
        var x = new Date(jsonData.timestamp*1000).getTime();
        chartG.series[0].addPoint([x, Math.round(jsonData.Pi )], false, false, false);
        chartG.series[1].addPoint([x, Math.round(jsonData.Pac)], false, false, false);
        chartG.series[2].addPoint([x, Math.round(Ei)], false, false, false);
        chartG.series[3].addPoint([x, Math.round(Eac)], false, false, false);
        if(chartTitle==null){
          chartTitle = epochToDate(jsonData.timestamp);
        }
      });
      chartGeneralTitle.innerHTML = chartTitle;
      chartG.redraw();

      if(isTodayTheActiveDay){
        dbRef.orderByKey().startAfter(lastTimestamp).on('child_added', snapshot =>{
          var jsonData = snapshot.toJSON(); 
          var x = new Date(jsonData.timestamp*1000).getTime();
          chartG.series[0].addPoint([x, Number(jsonData.Pi )], true, false, true);
          chartG.series[1].addPoint([x, Number(jsonData.Pac)], true, false, true);
        });
      }
    });
}
