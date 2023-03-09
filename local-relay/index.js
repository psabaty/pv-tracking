
/**
 * This script listens to a serial port for a json-encoded object.
 * Once recieved, the object is sent to a Firebase Real-time database (RTDB)
 * 
 * USAGE : connect an arduino with pv-tracking* running on /dev/ttyACM0
 * (*) https://github.com/psabaty/arduino-pv-tracking
 * 
 * DEBUG :
 * use "socat" to simulate arduino messages :
 *   socat -d -d pty,raw,echo=0 pty,raw,echo=0
 * then run this script with first port (/dev/pts/4)
 * and send it messages with the second port
 *   echo '{"Pi":80,"Pac":1000,"k":20}' > /dev/pts/5
 */

import {SerialPort} from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline'

// /!\ ATTENTION /compat/ for using v9 this way (for auth)
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth'
import 'firebase/compat/database'



const firebaseConfig = {
    apiKey: "AIzaSyAipdhH2BwB2XchSqFRNqinx9hni9SxL_A",
    authDomain: "pv-tracking.firebaseapp.com",
    projectId: "pv-tracking",
    storageBucket: "pv-tracking.appspot.com",
    messagingSenderId: "718490163889",
    appId: "1:718490163889:web:5aa7d293a85b288062e090",
    databaseURL: "https://pv-tracking-default-rtdb.europe-west1.firebasedatabase.app",
    // Option  1 : credential par service account créé depuis GCP/IAM, 
    // source : https://console.firebase.google.com/project/pv-tracking/settings/serviceaccounts/adminsdk
    // credential: firebase.credential.cert(require("/home/psabaty/w/service-account-firebase-pv-tracking-27002915406d.json")),
  
    // Option  2 : credential using  GOOGLE_APPLICATION_CREDENTIALS=/home/psabaty/w/service-account-firebase-pv-tracking-27002915406d.json 
    // source : https://firebase.google.com/docs/admin/setup#initialize_the_sdk_in_non-google_environments
    // credential: firebase.credential.applicationDefault()

    // Option  3 : credential from user email/passwd ???
    // source : https://stackoverflow.com/questions/37811684/how-to-create-credential-object-needed-by-firebase-web-user-reauthenticatewith
    // credential: firebase.auth.EmailAuthProvider.credential('phil@psabaty.work','lalalilala35140;')
};

const app = firebase.initializeApp(firebaseConfig);
const { user } = await firebase.auth().signInWithEmailAndPassword('phil@psabaty.work','lalalilala35140;');
const firebaseDbPath = 'UsersData/' + user.uid + '/pvTracks'
const firebaseDbRef = firebase.database().ref(firebaseDbPath)
console.log('firebaseDbPath = '+firebaseDbPath);

const serialPortPath = '/dev/ttyACM0';
//const serialPortPath = '/dev/pts/4';

const port = new SerialPort({path: serialPortPath,  baudRate: 9600 });
const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));// Read the port data
port.on("open", () => {
  console.log('serial port open');
});
parser.on('data', data =>{
    if('' != data) {sendToFirebase(data);}
  //console.log('got word from serial : ', data);
});

process.on('SIGINT', function() {
    console.log("Closing Firebase connections");
    firebase.database().goOffline();
    firebase.auth().signOut();
    app.delete();

    process.exit();
});

/**
 * Object in json will be stored at firebaseDbPath[ timestamp ]
 * 
 * @param {"Pi":80,"Pac":1000,"k":20} jsonStringFromTracker 
 */
const sendToFirebase = jsonStringFromTracker => {
    try{   
        let jsonObject = JSON.parse(jsonStringFromTracker);

        if(    jsonObject.Pi  == undefined
            || jsonObject.Pac == undefined
            || jsonObject.k   == undefined) {
                throw new Error('jsonStringFromTracker should have members (Pi, Pac, k)')
            }
        // add timestamp
        jsonObject.timestamp = Math.round(Date.now()/1000).toString();

        console.log("Sending to firebase: " + JSON.stringify(jsonObject));
        firebaseDbRef.child(jsonObject.timestamp).set(jsonObject);
        
    }catch(e){
        if(e.name == "SyntaxError"){
            console.error('Not a Json string : '+jsonStringFromTracker);
        }else{
            console.error(e.name+' : '+e.message);
        }

    }
}

//startApp();
