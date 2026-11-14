import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  onAuthStateChanged, signOut, updateProfile, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, collection, addDoc, getDocs,
  deleteDoc, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// Your existing Firebase web-app configuration.
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
let accountSetupInProgress = false;

function showPage(page) {
  ["signupPage", "loginPage", "dashboardPage"].forEach(id =>
    $(id).classList.add("hidden"));
  $(page).classList.remove("hidden");
}

function message(id, text, success = false) {
  $(id).textContent = text;
  $(id).style.color = success ? "green" : "red";
}

function friendlyError(error) {
  const map = {
    "auth/email-already-in-use": "This email is already registered.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/weak-password": "Use a stronger password (at least 6 characters).",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/too-many-requests": "Too many attempts. Please wait and try again.",
    "auth/network-request-failed": "Network error. Check your internet connection.",
    "auth/operation-not-allowed": "Enable Email/Password in Firebase Authentication.",
    "auth/unauthorized-domain": "Add this domain in Firebase Authentication → Settings → Authorized domains.",
    "permission-denied": "Firestore denied access. Check that the supplied security rules are published."
  };
  return map[error.code] || `${error.code || "Error"}: ${error.message || "Something went wrong."}`;
}

// Public registration always creates a STUDENT account.
// Do not add a public role selector: users must not promote themselves.
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

  let createdUser = null;
  accountSetupInProgress = true;
  $("signupButton").disabled = true;

  try {
    message("signupMessage", "Creating your account...", true);
    const result = await createUserWithEmailAndPassword(auth, email, password);
    createdUser = result.user;
    await updateProfile(createdUser, { displayName: username });

    // The Firestore rules allow new users to create only role: "student".
    await setDoc(doc(db, "users", createdUser.uid), {
      username,
      email,
      role: "student",
      createdAt: serverTimestamp()
    });

    $("signupForm").reset();
    message("signupMessage", "Account created. Your role is Student.", true);
    accountSetupInProgress = false;
    await loadUserDashboard(createdUser);
  } catch (error) {
    console.error("Signup/profile error:", error);
    accountSetupInProgress = false;
    if (createdUser) {
      try { await signOut(auth); } catch (cleanupError) {
        console.error("Sign-out cleanup error:", cleanupError);
      }
    }
    message("signupMessage", friendlyError(error));
  } finally {
    $("signupButton").disabled = false;
  }
});

// Login
$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;
  $("loginButton").disabled = true;
  try {
    message("loginMessage", "Logging in...", true);
    await signInWithEmailAndPassword(auth, email, password);
    $("loginForm").reset();
  } catch (error) {
    console.error("Login error:", error);
    message("loginMessage", friendlyError(error));
  } finally {
    $("loginButton").disabled = false;
  }
});

// Read the signed-in user's profile and render the correct role interface.
async function loadUserDashboard(user) {
  try {
    const profileRef = doc(db, "users", user.uid);
    let profileSnapshot = await getDoc(profileRef);

    // Existing Auth accounts without a profile are safely created as students.
    if (!profileSnapshot.exists()) {
      await setDoc(profileRef, {
        username: user.displayName || (user.email || "Student").split("@")[0],
        email: user.email || "",
        role: "student",
        createdAt: serverTimestamp()
      });
      profileSnapshot = await getDoc(profileRef);
    }

    if (!auth.currentUser || auth.currentUser.uid !== user.uid) return;
    if (!profileSnapshot.exists()) throw new Error("User profile not found.");

    const profile = profileSnapshot.data();
    const role = String(profile.role || "").toLowerCase();

    $("displayUsername").textContent =
      profile.username || user.displayName || user.email || "User";
    $("roleBadge").textContent = role;
    $("teacherDashboard").classList.add("hidden");
    $("studentDashboard").classList.add("hidden");

    if (role === "teacher") {
      $("dashboardTitle").textContent = "Teacher Workspace";
      $("notesHeading").textContent = "My Teaching Notes";
      $("teacherDashboard").classList.remove("hidden");
    } else if (role === "student") {
      $("dashboardTitle").textContent = "Student Workspace";
      $("notesHeading").textContent = "My Study Notes";
      $("studentDashboard").classList.remove("hidden");
    } else {
      throw new Error("Unknown role. Ask the site administrator to assign student or teacher.");
    }

    showPage("dashboardPage");
    await loadNotes(user.uid);
  } catch (error) {
    console.error("Dashboard/profile error:", error);
    alert(friendlyError(error));
    await signOut(auth);
  }
}

// Firebase remembers the current authenticated user on this browser.
onAuthStateChanged(auth, async user => {
  if (accountSetupInProgress) return;
  if (user) {
    await loadUserDashboard(user);
  } else {
    showPage("loginPage");
    $("teacherDashboard").classList.add("hidden");
    $("studentDashboard").classList.add("hidden");
    $("notesList").replaceChildren();
  }
});

// Password reset
$("forgotPassword").addEventListener("click", async event => {
  event.preventDefault();
  const email = $("loginEmail").value.trim();
  if (!email) return message("loginMessage", "Enter your email address first.");
  try {
    await sendPasswordResetEmail(auth, email);
    message("loginMessage", "Password reset email sent. Check your inbox.", true);
  } catch (error) {
    message("loginMessage", friendlyError(error));
  }
});

// Logout
$("logoutButton").addEventListener("click", async () => {
  try { await signOut(auth); }
  catch (error) { alert(friendlyError(error)); }
});

// Switch signup/login screens
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

// Notes are stored at users/{uid}/notes/{noteId}.
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
    const q = query(notesCollection(uid), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
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
        ? note.createdAt.toDate().toLocaleString() : "Recently saved";
      const del = document.createElement("button");
      del.className = "delete-note";
      del.textContent = "Delete";
      del.addEventListener("click", () => deleteNote(uid, noteDoc.id));
      item.append(text, date, del);
      list.appendChild(item);
    });
  } catch (error) {
    console.error("Load notes error:", error);
    list.replaceChildren();
    const p = document.createElement("p");
    p.textContent = friendlyError(error);
    list.appendChild(p);
  }
}

// Save note to Firestore
$("saveNote").addEventListener("click", async () => {
  const user = auth.currentUser;
  const text = $("noteInput").value.trim();
  if (!user) return message("noteMessage", "Please log in again.");
  if (!text) return message("noteMessage", "Write something first.");

  const button = $("saveNote");
  button.disabled = true;
  try {
    message("noteMessage", "Saving note...", true);
    await addDoc(notesCollection(user.uid), {
      text,
      createdAt: serverTimestamp()
    });
    $("noteInput").value = "";
    message("noteMessage", "Note saved online!", true);
    await loadNotes(user.uid);
  } catch (error) {
    console.error("Save note error:", error);
    message("noteMessage", friendlyError(error));
  } finally {
    button.disabled = false;
  }
});

// Delete note from Firestore
async function deleteNote(uid, noteId) {
  if (!auth.currentUser || auth.currentUser.uid !== uid)
    return message("noteMessage", "Please log in again.");
  try {
    await deleteDoc(doc(db, "users", uid, "notes", noteId));
    message("noteMessage", "Note deleted.", true);
    await loadNotes(uid);
  } catch (error) {
    message("noteMessage", friendlyError(error));
  }
}
