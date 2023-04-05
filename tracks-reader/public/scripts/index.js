
import { collection, query, getDocs, getCountFromServer, limit, orderBy, startAt, endAt, onSnapshot } from 'https://www.gstatic.com/firebasejs/9.19.0/firebase-firestore.js'
import { onAuthStateChanged, signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/9.19.0/firebase-auth.js'

// Globals
var firebaseUser = null;
var activeDayDate = new Date();
var chartAccuracy = false;
var viewFullDay = false;
var isTodayTheActiveDay = true;
var lastTimestamp = 0;
var firestore = null;
var chartG = null;

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

const chartGeneralTitle = document.querySelector('#chart-general-title');
const injectionElement = document.getElementById("injection");
const consigneElement = document.getElementById("consigne");
const autoconsoElement = document.getElementById("autoconso");
const updateElement = document.getElementById("lastUpdate");

const buttonPreviousDay = document.getElementById("buttonPreviousDay");
const buttonNextDay = document.getElementById("buttonNextDay");
const buttonAccurate = document.getElementById("buttonAccurate");
const buttonFullDay = document.getElementById("buttonFullDay");

buttonPreviousDay.addEventListener('click', (e) => {
  chartAccuracy = false;
  shiftActiveDay(-1);
  e.preventDefault();
  return false;
});
buttonNextDay.addEventListener('click', (e) => {
  chartAccuracy = false;
  shiftActiveDay(1);
  e.preventDefault();
  return false;
});
buttonAccurate.addEventListener('click', (e) => {
  chartAccuracy = !chartAccuracy;
  loadTracksForActiveDay();
  e.preventDefault();
  return false;
});
buttonFullDay.addEventListener('click', (e) => {
  chartAccuracy = isTodayTheActiveDay;
  viewFullDay = !viewFullDay;
  updateViewFulleDay();
  loadTracksForActiveDay();
  e.preventDefault();
  return false;
});


// MANAGE LOGIN/LOGOUT UI
export function setupUI(_firestore){
  firestore = _firestore;
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

    chartG = createGeneralChart();
    initiateActiveDay();
    updateIsTodayTheActiveDay();
    updateViewFulleDay();

    loadTracksForActiveDay();
    loadRealtimeTracks();
    
  }
}

function updateIsTodayTheActiveDay(){
  isTodayTheActiveDay = (getDaySignature(activeDayDate)==getDaySignature(new Date()));
  // automatically switch to accuracy when reading today's records.
  chartAccuracy = isTodayTheActiveDay;
  buttonNextDay.style.visibility = isTodayTheActiveDay ? 'hidden':'visible';
}

function updateViewFulleDay(){
  buttonFullDay.innerHTML = viewFullDay?'8h - 20h':'0h - 24h';  
}

function initiateActiveDay(){
  activeDayDate = new Date()
  const urlParams = new URLSearchParams(window.location.search);
  if(urlParams.has('d')){
    const queryDaySignature = urlParams.get('d');
    const queryDaySignatureElements = queryDaySignature.split('-');
    activeDayDate.setFullYear(queryDaySignatureElements[0]);
    activeDayDate.setMonth(queryDaySignatureElements[1] - 1);
    activeDayDate.setDate(queryDaySignatureElements[2]);
    activeDayDate.setHours(12);
  }
}
async function loadRealtimeTracks(){
  var dbPath = 'UsersData/' + firebaseUser.uid.toString() + '/pvRecords';
  //var recordsCollection = firebase.firestore().collection(dbPath);
  var recordsCollection = collection(firestore, dbPath);

  //recordsCollection.doc("latest").onSnapshot((doc) => {
  //const realtimeQuery = recordsCollection.orderBy("timestamp", "desc").limit(1);
  const realtimeQuery = query(recordsCollection, orderBy("timestamp", "desc"), limit(1));
  //const querySnapshot = await getDocs(realtimeQuery);
  onSnapshot(realtimeQuery, (querySnapshot) => {
    querySnapshot.docChanges().forEach(change => {
    // querySnapshot.forEach(doc => {

      var jsonData = change.doc.data();
      updateElement.innerHTML = epochToDateTime(jsonData.timestamp);
      injectionElement.innerHTML = jsonData.Pi;
      consigneElement.innerHTML = jsonData.k;
      autoconsoElement.innerHTML = jsonData.Pac;
      
      if(isTodayTheActiveDay){
        var x = new Date((jsonData.timestamp)*1000).getTime();
        chartG.series[0].addPoint([x, Math.round(jsonData.Pi )], true, false, true);
        chartG.series[1].addPoint([x, Math.round(jsonData.Pac)], true, false, true);
      }
    });
  });
}

async function fillChartFromFirestore(collectionName, startTS, endTS, onlyCounter=false){
  var nbRecords = 0;
  var dbPath = 'UsersData/' + firebaseUser.uid.toString() + '/' + collectionName;
  var recordsCollection = collection(firestore, dbPath);

  const q = query(recordsCollection, orderBy("timestamp", "asc"),startAt(startTS), endAt(endTS));
  if( !onlyCounter ){
    const snapshot = await getDocs(q);
    nbRecords = snapshot.size;
    if( nbRecords>0 ){ 
      var Ei = 0;
      var Eac = 0;
      console.log('snapshot.size='+snapshot.size)
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
    }
    chartG.redraw();
  }else{
  const countSnapshot = await getCountFromServer(q);
  nbRecords = countSnapshot.data().count;
  }
  console.log((onlyCounter?'Counted ':'Read ')+nbRecords+' records in '+collectionName);
  return nbRecords;
}

async function loadTracksForActiveDay(){

  var rangeMinDate = new Date(activeDayDate);
  rangeMinDate.setHours(viewFullDay?0:8, 0, 0, 0);
  var rangeMinTs = Math.round(rangeMinDate.getTime()/1000);

  var rangeMaxDate = new Date(activeDayDate);
  rangeMaxDate.setHours(viewFullDay?24:20, 0, 0);
  var rangeMaxTs = Math.round(rangeMaxDate.getTime()/1000);
  console.log("Querying between "+rangeMinDate+" and "+rangeMaxDate);
  
  chartG.series.forEach(s => {s.setData([]);}); 
  // activeDayDate
  chartGeneralTitle.innerHTML = '<i style="color:#444444">'+epochToDate(activeDayDate.getTime()/1000)+'</i>';

  var collectionName = chartAccuracy ? 'pvRecords' : 'aggregatedRecords';
  var nbRecords = await fillChartFromFirestore(collectionName, rangeMinTs, rangeMaxTs);
  if( !chartAccuracy ){
    var nbAccurateRecords = await fillChartFromFirestore('pvRecords', rangeMinTs, rangeMaxTs, true);
    buttonAccurate.style.visibility = (nbAccurateRecords > 0) ? 'visible' : 'hidden';
  }
}


function tooltipFormatter(points){
  var s = [];
  s.push('<span style="color: black;"><b>'+ epochToTime(Number(points[0].x)/1000) + ' :</b><span>');

  $.each(points, function(i, point) {
      s.push('<span style="color: '+ point.series.color +' ;">'+ point.series.name +' : <b>'+ point.y + '</b><span>');
  });
  return s.join(" <br/>");
}

// Create General Chart
function createGeneralChart() {
  Highcharts.setOptions({
    time: {
        timezone: 'Europe/Paris'
    }
  });

  var chart = new Highcharts.Chart({
    accessibility: {enabled: false},
    chart:{ 
      renderTo:'chart-general',
      type: 'spline',
    },
    series: [
      {
        name: 'Injection',
        color: '#4ebbbf',
        tooltip: {valueSuffix: ' W'},
        yAxis: 0,
      },{
        name: 'AutoConso',
        color: '#8ebf4e',
        tooltip: {valueSuffix: ' W'},
        yAxis: 0,
      },
      {
        name: 'Ei',
        color: '#0099ff',
        tooltip: {valueSuffix: ' Wh'},
        yAxis: 1,
      },{
        name: 'Eac',
        color: '#0dff00',
        tooltip: {valueSuffix: ' Wh'},
        yAxis: 1,
      },
      
    ],
    title: { 
      text: undefined
    },
    plotOptions: {
      line: { 
        animation: false,
        dataLabels: { 
          enabled: true 
        }
      }
    },
    xAxis: {
      type: 'datetime',
      dateTimeLabelFormats: { second: '%H:%M:%S' }
    },
    yAxis: [{
      title: { 
        text: 'Puissance (W)' 
      },
      min:-200,
      max:500,
      alignTicks: false,
      tickInterval: 100,
    },
    {
      title: { 
        text: 'Energie (Wh)',
      },
      opposite:true,
    }
    
    ],
    credits: { 
      enabled: false 
    },
    tooltip: {
      formatter: function() { return tooltipFormatter(this.points);},
      shared: true
    },
  });
  return chart;
}


export function setupApp(auth, firestore){
  // listen for auth status changes
  
  onAuthStateChanged(auth, (user) => {
    if (user) {
      firebaseUser = user;
      console.log("user logged in. Uid = " + firebaseUser.uid);
      setupUI(firestore);
    } else {
      console.log("user logged out");
      firebaseUser = null;
      setupUI(firestore);
    }
  }); 

  document.addEventListener("DOMContentLoaded", function(){
    // login
    const loginForm = document.querySelector('#login-form');
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      // get user info
      const email = loginForm['input-email'].value;
      const password = loginForm['input-password'].value;
      // log the user in
      signInWithEmailAndPassword(auth, email, password).then((cred) => {
        // close the login modal & reset form
        loginForm.reset();
        console.log(email);
      })
      .catch((error) =>{
        const errorCode = error.code;
        const errorMessage = error.message;
        document.getElementById("error-message").innerHTML = errorMessage;
        console.log(errorMessage);
      });
    });

    // logout
    const logout = document.querySelector('#logout-link');
    logout.addEventListener('click', (e) => {
      e.preventDefault();
      auth.signOut();
    });
});  
}