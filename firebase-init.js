(function initFirebaseApp() {
  if (typeof window === 'undefined') {
    return;
  }

  if (!window.firebase || typeof window.firebase.initializeApp !== 'function') {
    console.error('[Firebase] Firebase SDK not loaded before firebase-init.js');
    return;
  }

  const firebaseConfig = {
    apiKey: 'AIzaSyBtW158zoZryKPQySz4gUCkjf31GlHFJtk',
    authDomain: 'smart-bed-admission-planner.firebaseapp.com',
    projectId: 'smart-bed-admission-planner',
    storageBucket: 'smart-bed-admission-planner.firebasestorage.app',
    messagingSenderId: '38104640050',
    appId: '1:38104640050:web:79f1302ee4982e1665ea2b',
    measurementId: 'G-FDXV9GS6CT'
  };

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  const app = firebase.app();
  const firestore = firebase.firestore();
  firestore.settings({ ignoreUndefinedProperties: true });

  window.sbpFirebase = {
    app,
    firestore
  };
})();
