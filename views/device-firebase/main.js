import firebase from 'firebase/app';
import 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCyKYgrLaUjacbT81vaWiYh1bOToLfYBZM',
  authDomain: 'smila-cloud.firebaseapp.com',
  projectId: 'smila-cloud',
  storageBucket: 'smila-cloud.appspot.com',
  messagingSenderId: '972305707046',
  appId: '1:972305707046:web:b6a2f0016539e384fbb6e7',
  measurementId: 'G-TF3HL6V7ZR',
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
  iceCandidatePoolSize: 2,
};

// Global State
const pc = new RTCPeerConnection(servers);
let localStream = null;
let remoteStream = null;

const urlParams = new URLSearchParams(window.location.search);
const callId = urlParams.get('callId');

let timer;
let seconds = 0;

// HTML elements
const localVideo = document.querySelector('.js-video-local');
const remoteVideo = document.querySelector('.js-video-remote');
const endCallButton = document.querySelector('.js-end-call-button');
const timerDisplay = document.querySelector('.js-timer');

const init = async () => {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    remoteStream = new MediaStream();

    // Push tracks from local stream to peer connection
    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });

    // Pull tracks from remote stream, add to video stream
    pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        remoteStream.addTrack(track);

        if (window.chrome.webview && window.chrome.webview.hostObjects) {
          track.onended = async () => {
            try {
              window.chrome.webview.hostObjects.trackData.Set('ended', track.kind);
            } catch (error) {
              console.error('Error during setting trackData:', error);
            }
          }
        }
      });
    };

    localVideo.srcObject = localStream;
    remoteVideo.srcObject = remoteStream;
    remoteVideo.muted = false;
    remoteVideo.play();

    if (callId) {
      addAnswer(callId)
    }
  } catch (error) {
    console.error('Error during initialization:', error);
  }
};


init();

const addAnswer = async (callId) => {
  try {
    const callDoc = firestore.collection('calls').doc(callId);
    const answerCandidates = callDoc.collection('answerCandidates');
    const offerCandidates = callDoc.collection('offerCandidates');

    pc.onicecandidate = (event) => {
      event.candidate && answerCandidates.add(event.candidate.toJSON());
    };

    const callData = (await callDoc.get()).data();
    if (!callData) {
      endCall();
    }

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

    callDoc.onSnapshot((snapshot) => {
      if (!snapshot.exists) {
        endCall();
      }
    });

    startTimer();
  } catch (error) {
    console.error('Error during adding answer:', error);
  }

}

const endCall = async () => {
  try {

    // Close the peer connection
    pc.close();


    // Stop all local stream tracks
    localStream.getTracks().forEach(track => {
      track.stop();

      if (window.chrome.webview && window.chrome.webview.hostObjects) {
        window.chrome.webview.hostObjects.trackData.Set('ended', track.kind);
      }
    });

    // Remove remote stream tracks
    remoteStream.getTracks().forEach(track => remoteStream.removeTrack(track));

    stopTimer();
  } catch (error) {
    console.error('Error during ending a call:', error);
  }
};

const deleteCallId = async () => {
  if (callId) {
    await firestore.collection('calls').doc(callId).delete();
  }
}


const handleEndCall = async () => {
  await endCall();
  await deleteCallId();
}

const startTimer = () => {
  timer = setInterval(() => {
    seconds++;
    displayTime(seconds);
  }, 1000);
}

const stopTimer = () => {
  clearInterval(timer);
}

const displayTime = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const remainderSeconds = seconds % 60;
  const display = `${minutes < 10 ? '0' : ''}${minutes}:${remainderSeconds < 10 ? '0' : ''}${remainderSeconds}`;
  timerDisplay.textContent = display;
}

endCallButton.addEventListener('click', handleEndCall);
