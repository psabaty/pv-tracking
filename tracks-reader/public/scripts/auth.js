
// global Firebase user
var firebaseUser = null;

document.addEventListener("DOMContentLoaded", function(){
    // listen for auth status changes
    auth.onAuthStateChanged(user => {
        if (user) {
          firebaseUser = user;
          console.log("user logged in. Uid = " + firebaseUser.uid);
          setupUI();
        } else {
          console.log("user logged out");
          firebaseUser = null;
          setupUI();
        }
    });

    // login
    const loginForm = document.querySelector('#login-form');
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        // get user info
        const email = loginForm['input-email'].value;
        const password = loginForm['input-password'].value;
        // log the user in
        auth.signInWithEmailAndPassword(email, password).then((cred) => {
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
