const firebaseConfig = {
  apiKey: "AIzaSyDJOPYNMFRPjxlWBwbaUZBxF4HTVaNVPKo",
  authDomain: "AIzaSyDJOPYNMFRPjxlWBwbaUZBxF4HTVaNVPKo.firebaseapp.com",
  projectId: "AIzaSyDJOPYNMFRPjxlWBwbaUZBxF4HTVaNVPKo",
  storageBucket: "AIzaSyDJOPYNMFRPjxlWBwbaUZBxF4HTVaNVPKo.appspot.com",
  messagingSenderId: "AIzaSyDJOPYNMFRPjxlWBwbaUZBxF4HTVaNVPKo",
  appId: "AIzaSyDJOPYNMFRPjxlWBwbaUZBxF4HTVaNVPKo"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
