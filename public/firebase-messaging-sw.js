importScripts('https://www.gstatic.com/firebasejs/10.13.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.13.1/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: "AIzaSyB85DC_ABNKI8O-UPW0GLnXrZIoYg_IrMg",
  authDomain: "campus-pulse-2a80b.firebaseapp.com",
  projectId: "campus-pulse-2a80b",
  storageBucket: "campus-pulse-2a80b.firebasestorage.app",
  messagingSenderId: "66345650283",
  appId: "1:66345650283:web:d789a4c68d93881592c92e"
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {}
  self.registration.showNotification(title || 'Campus Pulse', {
    body: body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
  })
})