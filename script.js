import { initializeApp } from
    "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";

import {
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
    onAuthStateChanged, signOut, updateProfile, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

import {
    getFirestore, collection, addDoc, getDocs, deleteDoc, doc,
    query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// Firebase web configuration from your existing project.
const firebaseConfig = {
    apiKey: "AIzaSyCNyRHnAX2X_Jito5_09ibDy0owAl8rFao",
    authDomain: "my-personal-login.firebaseapp.com",
    projectId: "my-personal-login",
    storageBucket: "my-personal-login.firebasestorage.app",
    messagingSenderId: "982370760859",
    appId: "1:982370760859:web:2f6ce41e552aafbafe6e3e",
    measurementId: "G-RF5413TL3P"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = id => document.getElementById(id);

function showPage(page) {
    ["signupPage", "loginPage", "dashboardPage"].forEach(id =>
        $(id).classList.add("hidden")
    );
    $(page).classList.remove("hidden");
}

function message(id, text, success = false) {
    $(id).textContent = text;
    $(id).style.color = success ? "green" : "red";
}

function getFirebaseError(error) {
    const messages = {
        "auth/email-already-in-use": "This email is already registered.",
        "auth/invalid-email": "Please enter a valid email address.",
        "auth/weak-password": "Choose a stronger password (at least 6 characters).",
        "auth/invalid-credential": "Incorrect email or password.",
        "auth/too-many-requests": "Too many attempts. Please wait and try again.",
        "auth/network-request-failed": "Network error. Check your internet connection.",
        "auth/operation-not-allowed": "Enable Email/Password in Firebase Authentication.",
        "auth/unauthorized-domain": "Add this website domain in Firebase Authentication → Settings → Authorized domains.",
        "permission-denied": "Firestore denied access. Publish the security rules supplied with this project.",
        "failed-precondition": "Check the Firestore database setup in Firebase Console."
    };
    return messages[error.code] || `${error.code || "Error"}: ${error.message || "Something went wrong."}`;
}

// Sign up
$("signupForm").addEventListener("submit", async event => {
    event.preventDefault();
    const username = $("signupUsername").value.trim();
    const email = $("signupEmail").value.trim();
    const password = $("signupPassword").value;
    const confirm = $("confirmPassword").value;

    if (username.length < 3)
        return message("signupMessage", "Username must have at least 3 characters.");
    if (password !== confirm)
        return message("signupMessage", "Passwords do not match.");

    try {
        message("signupMessage", "Creating your account...", true);
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(result.user, { displayName: username });
        $("signupForm").reset();
        message("signupMessage", "Account created successfully!", true);
    } catch (error) {
        console.error("Firebase signup error:", error);
        message("signupMessage", getFirebaseError(error));
    }
});

// Login
$("loginForm").addEventListener("submit", async event => {
    event.preventDefault();
    const email = $("loginEmail").value.trim();
    const password = $("loginPassword").value;

    try {
        message("loginMessage", "Logging in...", true);
        await signInWithEmailAndPassword(auth, email, password);
        $("loginForm").reset();
    } catch (error) {
        console.error("Firebase login error:", error);
        message("loginMessage", getFirebaseError(error));
    }
});

// Keep the page in sync with Firebase login state.
onAuthStateChanged(auth, async user => {
    if (user) {
        $("displayUsername").textContent = user.displayName || user.email;
        showPage("dashboardPage");
        await loadNotes(user.uid);
    } else {
        showPage("loginPage");
        $("notesList").replaceChildren();
    }
});

// Password reset
$("forgotPassword").addEventListener("click", async event => {
    event.preventDefault();
    const email = $("loginEmail").value.trim();
    if (!email)
        return message("loginMessage", "Enter your email address first.");

    try {
        await sendPasswordResetEmail(auth, email);
        message("loginMessage", "Password reset email sent. Check your inbox.", true);
    } catch (error) {
        console.error("Password reset error:", error);
        message("loginMessage", getFirebaseError(error));
    }
});

// Logout
$("logoutButton").addEventListener("click", async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Logout error:", error);
        alert(getFirebaseError(error));
    }
});

// Switch between signup and login
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

// Firestore notes path: users/{Firebase UID}/notes/{note document ID}
function notesCollection(uid) {
    return collection(db, "users", uid, "notes");
}

async function loadNotes(uid) {
    const list = $("notesList");
    list.replaceChildren();
    const loading = document.createElement("p");
    loading.textContent = "Loading your notes...";
    list.appendChild(loading);

    try {
        const notesQuery = query(notesCollection(uid), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(notesQuery);

        // Do not render stale results if the signed-in user changed.
        if (!auth.currentUser || auth.currentUser.uid !== uid) return;

        list.replaceChildren();
        if (snapshot.empty) {
            const empty = document.createElement("p");
            empty.textContent = "No saved notes yet.";
            list.appendChild(empty);
            return;
        }

        snapshot.forEach(noteDoc => {
            const note = noteDoc.data();
            const item = document.createElement("div");
            item.className = "note-item";

            const text = document.createElement("p");
            text.textContent = note.text || "";

            const date = document.createElement("small");
            date.textContent = note.createdAt?.toDate
                ? note.createdAt.toDate().toLocaleString()
                : "Recently saved";

            const del = document.createElement("button");
            del.className = "delete-note";
            del.textContent = "Delete";
            del.addEventListener("click", () => deleteNote(uid, noteDoc.id));

            item.append(text, date, del);
            list.appendChild(item);
        });
    } catch (error) {
        console.error("Firestore load notes error:", error);
        list.replaceChildren();
        const errorText = document.createElement("p");
        errorText.textContent = getFirebaseError(error);
        list.appendChild(errorText);
    }
}

// Save note online
$("saveNote").addEventListener("click", async () => {
    const user = auth.currentUser;
    const noteText = $("noteInput").value.trim();

    if (!user) return message("noteMessage", "Please log in again.");
    if (!noteText) return message("noteMessage", "Write something first.");

    const button = $("saveNote");
    button.disabled = true;

    try {
        message("noteMessage", "Saving note...", true);
        await addDoc(notesCollection(user.uid), {
            text: noteText,
            createdAt: serverTimestamp()
        });
        $("noteInput").value = "";
        message("noteMessage", "Note saved online successfully!", true);
        await loadNotes(user.uid);
    } catch (error) {
        console.error("Firestore save note error:", error);
        message("noteMessage", getFirebaseError(error));
    } finally {
        button.disabled = false;
    }
});

// Delete note online
async function deleteNote(uid, noteId) {
    if (!auth.currentUser || auth.currentUser.uid !== uid)
        return message("noteMessage", "Please log in again.");

    try {
        await deleteDoc(doc(db, "users", uid, "notes", noteId));
        message("noteMessage", "Note deleted.", true);
        await loadNotes(uid);
    } catch (error) {
        console.error("Firestore delete note error:", error);
        message("noteMessage", getFirebaseError(error));
    }
}
