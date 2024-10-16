import firebase from 'firebase/app';
import 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDqnhxRyOsERYshO8rEKY7ipQJXjJnGoP0",
  authDomain: "test-b1f4c.firebaseapp.com",
  projectId: "test-b1f4c",
  storageBucket: "test-b1f4c.appspot.com",
  messagingSenderId: "778062457919",
  appId: "1:778062457919:web:7479a0db129848ad135c8a",
  measurementId: "G-LNRWRK4NRP"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const firestore = firebase.firestore();

const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

// Global State
const pc = new RTCPeerConnection(servers);
let localStream = null;
let remoteStream = null;

const urlParams = new URLSearchParams(window.location.search);
const callId = urlParams.get('callId');

// HTML elements
const localVideo = document.querySelector('.js-video-local');
const remoteVideo = document.querySelector('.js-video-remote');
const container = document.querySelector('.js-container');

const init = async () => {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  remoteStream = new MediaStream();

  // Push tracks from local stream to peer connection
  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
  });

  // Pull tracks from remote stream, add to video stream
  pc.ontrack = (event) => {
    console.log('event: ', event);
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);

    });
  };

  localVideo.srcObject = localStream;
  remoteVideo.srcObject = remoteStream;
  remoteVideo.muted = false;
  remoteVideo.play();

  if (callId) {
    console.log(remoteStream)
    addAnswer(callId)
  }
};

init();

const addAnswer = async (callId) => {
  const callDoc = firestore.collection('calls').doc(callId);
  const answerCandidates = callDoc.collection('answerCandidates');
  const offerCandidates = callDoc.collection('offerCandidates');

  pc.onicecandidate = (event) => {
    event.candidate && answerCandidates.add(event.candidate.toJSON());
  };

  const callData = (await callDoc.get()).data();

  const offerDescription = callData.offer;
  await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

  const answerDescription = await pc.createAnswer();
  await pc.setLocalDescription(answerDescription);

  const answer = {
    type: answerDescription.type,
    sdp: answerDescription.sdp,
  };

  await callDoc.update({ answer });

  offerCandidates.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const data = change.doc.data();
        pc.addIceCandidate(new RTCIceCandidate(data));
      }
    });
  });

  container.classList.add('connected');
}
