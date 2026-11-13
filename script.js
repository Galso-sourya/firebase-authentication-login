
import { initializeApp } from
"https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";

import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
    updateProfile,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";


// 1. FIREBASE CONFIGURATION

// Import the functions you need from the SDKs you need
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {
    apiKey: "AIzaSyCNyRHnAX2X_Jito5_09ibDy0owAl8rFao",
    authDomain: "my-personal-login.firebaseapp.com",
    projectId: "my-personal-login",
    storageBucket: "my-personal-login.firebasestorage.app",
    messagingSenderId: "982370760859",
    appId: "1:982370760859:web:2f6ce41e552aafbafe6e3e",
    measurementId: "G-RF5413TL3P"
  };


// 2. INITIALIZE FIREBASE

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);


// 3. HELPER FUNCTIONS

const $ = id => document.getElementById(id);

function showPage(page) {
    ["signupPage", "loginPage", "dashboardPage"]
        .forEach(id => $(id).classList.add("hidden"));

    $(page).classList.remove("hidden");
}

function message(id, text, success = false) {
    $(id).textContent = text;
    $(id).style.color = success ? "green" : "red";
}

function getFirebaseError(error) {
    const messages = {
        "auth/email-already-in-use":
            "This email is already registered.",
        "auth/invalid-email":
            "Please enter a valid email address.",
        "auth/weak-password":
            "Choose a stronger password.",
        "auth/invalid-credential":
            "Incorrect email or password.",
        "auth/network-request-failed":
            "Network error. Check your internet connection."
    };

    return messages[error.code] ||
        error.message || "Something went wrong.";
}


// 4. SIGN UP

$("signupForm").addEventListener("submit", async event => {
    event.preventDefault();

    const username = $("signupUsername").value.trim();
    const email = $("signupEmail").value.trim();
    const password = $("signupPassword").value;
    const confirm = $("confirmPassword").value;

    if (username.length < 3) {
        return message("signupMessage",
            "Username must have at least 3 characters.");
    }

    if (password !== confirm) {
        return message("signupMessage",
            "Passwords do not match.");
    }

    try {
        message("signupMessage", "Creating your account...", true);

        const result = await createUserWithEmailAndPassword(
            auth, email, password
        );

        await updateProfile(result.user, {
            displayName: username
        });

        $("signupForm").reset();

        message("signupMessage",
            "Account created successfully!", true);

    } catch (error) {
        message("signupMessage", getFirebaseError(error));
    }
});


// 5. LOGIN

$("loginForm").addEventListener("submit", async event => {
    event.preventDefault();

    const email = $("loginEmail").value.trim();
    const password = $("loginPassword").value;

    try {
        message("loginMessage", "Logging in...", true);

        await signInWithEmailAndPassword(
            auth, email, password
        );

        $("loginForm").reset();

    } catch (error) {
        message("loginMessage", getFirebaseError(error));
    }
});


// 6. AUTHENTICATION STATE

onAuthStateChanged(auth, user => {

    if (user) {
        $("displayUsername").textContent =
            user.displayName || user.email;

        showPage("dashboardPage");

        displayNotes(user.uid);

    } else {
        showPage("loginPage");
    }

});


// 7. PASSWORD RESET

$("forgotPassword").addEventListener("click", async event => {
    event.preventDefault();

    const email = $("loginEmail").value.trim();

    if (!email) {
        return message("loginMessage",
            "Enter your email address first.");
    }

    try {
        await sendPasswordResetEmail(auth, email);

        message("loginMessage",
            "Password reset email sent. Check your inbox.", true);

    } catch (error) {
        message("loginMessage", getFirebaseError(error));
    }
});


// 8. LOGOUT

$("logoutButton").addEventListener("click", async () => {

    try {
        await signOut(auth);
    } catch (error) {
        alert(getFirebaseError(error));
    }

});


// 9. SWITCH PAGES

$("showLogin").addEventListener("click", event => {
    event.preventDefault();

    $("signupForm").reset();
    message("signupMessage", "");

    showPage("loginPage");
});

$("showSignup").addEventListener("click", event => {
    event.preventDefault();

    $("loginForm").reset();
    message("loginMessage", "");

    showPage("signupPage");
});


// 10. PERSONAL NOTES
// These notes are still stored locally in this version.

function getNotes() {
    return JSON.parse(
        localStorage.getItem("firebaseUserNotes") || "{}"
    );
}

function displayNotes(uid) {
    const notes = getNotes();
    const userNotes = notes[uid] || [];

    const list = $("notesList");
    list.replaceChildren();

    if (userNotes.length === 0) {
        const empty = document.createElement("p");
        empty.textContent = "No saved notes yet.";
        list.appendChild(empty);
        return;
    }

    userNotes.forEach(note => {
        const item = document.createElement("div");
        item.className = "note-item";

        const text = document.createElement("p");
        text.textContent = note.text;

        const date = document.createElement("small");
        date.textContent = note.date;

        const del = document.createElement("button");
        del.className = "delete-note";
        del.textContent = "Delete";

        del.addEventListener("click", () => {
            deleteNote(uid, note.id);
        });

        item.append(text, date, del);
        list.appendChild(item);
    });
}


$("saveNote").addEventListener("click", () => {

    const user = auth.currentUser;
    const noteText = $("noteInput").value.trim();

    if (!user) return;

    if (!noteText) {
        return message("noteMessage",
            "Write something first.");
    }

    const notes = getNotes();

    if (!Array.isArray(notes[user.uid])) {
        notes[user.uid] = [];
    }

    notes[user.uid].push({
        id: crypto.randomUUID(),
        text: noteText,
        date: new Date().toLocaleString()
    });

    localStorage.setItem(
        "firebaseUserNotes",
        JSON.stringify(notes)
    );

    $("noteInput").value = "";

    message("noteMessage", "Note saved!", true);

    displayNotes(user.uid);

});


function deleteNote(uid, noteId) {

    const notes = getNotes();

    notes[uid] = (notes[uid] || []).filter(
        note => note.id !== noteId
    );

    localStorage.setItem(
        "firebaseUserNotes",
        JSON.stringify(notes)
    );

    displayNotes(uid);

}
