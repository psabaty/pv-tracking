
import { createInterface } from "readline";

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
/*
firebase.auth().signInWithEmailAndPassword('phil@psabaty.work','lalalilala35140;')
.then((res) => console.log('then '+JSON.stringify(res)))
.catch((err) => console.log('then '+err.message))
.finally(() => console.log('finally!'))
*/
const { user } = await firebase.auth().signInWithEmailAndPassword('phil@psabaty.work','lalalilala35140;');
const firebaseDbPath = 'UsersData/' + user.uid + '/pvTracks'
const firebaseDbRef = firebase.database().ref(firebaseDbPath)
console.log('firebaseDbPath = '+firebaseDbPath);


const readline = createInterface({
    input: process.stdin,
    output: process.stdout
});

const readLineAsync = msg => {
    return new Promise(resolve => {
        readline.question(msg, userRes => {
            resolve(userRes);
        });
    });
}

const startApp = async () => {
    let input = ''
    do{
        input = await readLineAsync("?> ");
        if('' != input) {sendToFirebase(input);}
    }while('' != input)

    readline.close();
    firebase.database().goOffline();
    firebase.auth().signOut();
    app.delete();
}

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

startApp();
