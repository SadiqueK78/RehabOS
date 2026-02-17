// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAsFrqHebrTaQ_6ePKBsBH1NNepF9chfGc",
  authDomain: "exersights-local.firebaseapp.com",
  projectId: "exersights-local",
  storageBucket: "exersights-local.firebasestorage.app",
  messagingSenderId: "650154214450",
  appId: "1:650154214450:web:3ec4cfb0e9ad1b6b0a682b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const analytics = getAnalytics(app);
