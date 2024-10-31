import firebase from 'firebase/app';
import 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCyKYgrLaUjacbT81vaWiYh1bOToLfYBZM",
  authDomain: "smila-cloud.firebaseapp.com",
  projectId: "smila-cloud",
  storageBucket: "smila-cloud.appspot.com",
  messagingSenderId: "972305707046",
  appId: "1:972305707046:web:b6a2f0016539e384fbb6e7",
  measurementId: "G-TF3HL6V7ZR"
};

const translations = {
  endCall: {
    en: "End Call",
    da: "Afslut opkald",
    fi: "Lopeta puhelu",
    de: "Beenden",
    sv: "Avsluta samtal"
  },
  volumeLevel: {
    en: "Volume level",
    da: "Lydstyrke",
    fi: "Äänenvoimakkuuden taso",
    de: "Lautstärke",
    sv: "Volymnivå"
  },
  volume: {
    en: "Volume",
    da: "Lydstyrke",
    fi: "Äänenvoimakkuus",
    de: "Lautstärke",
    sv: "Volym"
  }
}

const maxVolumeLevel = 5;
const minVolumeLevel = 0;

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const firestore = firebase.firestore();

const servers = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"]
    }
  ],
  iceCandidatePoolSize: 2
};

const pc = new RTCPeerConnection(servers);

let localStream = null;
let remoteStream = null;

const urlParams = new URLSearchParams(window.location.search);
const callId = urlParams.get("callId");
console.log('callId: ', callId);
const lang = urlParams.get("lang") || "en";
console.log('lang: ', lang);
let volumeLevel = +urlParams.get("volume");
console.log('volumeLevel: ', volumeLevel);

let timer;
let seconds = 0;

let volumeModalTimer;
const volumeModalDuration = 3000;

const localVideo = document.querySelector(".js-video-local");
const remoteVideo = document.querySelector(".js-video-remote");
const endCallButton = document.querySelector(".js-end-call-button");
const timerDisplay = document.querySelector(".js-timer");
const volumeBar = document.querySelector(".js-volume-bar");
const volumeLevelLabel = document.querySelector(".js-volume-level");
const volumeDownButton = document.querySelector(".js-volume-down-button");
const volumeUpButton = document.querySelector(".js-volume-up-button");
const volumeModal = document.querySelector(".js-volume-modal");

const endCallButtonText = document.querySelector(".js-end-call-button-text");
const volumeModalTitle = document.querySelector(".js-volume-modal-title");
const volumeTitle = document.querySelector(".js-volume-title");

let preferredCameraId = '';

const setTranslation = (target, key) => {
  if (!target || !translations[key]) {
    return;
  }

  const text = target.textContent = translations[key][lang] ? translations[key][lang] : translations[key].en;
  target.textContent = text;
}

const setVolumeLevel = () => {
  if (volumeLevel > maxVolumeLevel) {
    volumeLevel = maxVolumeLevel;
  }
  if (volumeLevel < minVolumeLevel) {
    volumeLevel = minVolumeLevel;
  }

  volumeLevelLabel.textContent = volumeLevel;
  volumeBar.setAttribute('data-level', volumeLevel);

  volumeUpButton.disabled = volumeLevel === maxVolumeLevel;
  volumeDownButton.disabled = volumeLevel === minVolumeLevel;
}

const setInitialValues = () => {
  setTranslation(endCallButtonText, 'endCall');
  setTranslation(volumeModalTitle, 'volumeLevel');
  setTranslation(volumeTitle, 'volume');
  setVolumeLevel();
}

setInitialValues();

const init = async () => {
  try {
    const allDevices = await navigator.mediaDevices.enumerateDevices();

    allDevices.forEach((device) => {
      if (device.kind === 'videoinput') {
        if (device.label.startsWith('PC Camera')) {
          preferredCameraId = device.deviceId;
        }
      }
    });

    let permissions = '';

    await navigator.permissions
      .query({ name: "camera" })
      .then((permission) => {
        permissions += `permission: ${permission.name} = ${permission.state}<br>`;
      });

    await navigator.permissions
      .query({ name: "microphone" })
      .then((permission) => {
        permissions += `permission: ${permission.name} = ${permission.state}<br>`;
      });

    if (preferredCameraId === '') {
      console.error(`"PC Camera" not found. The default camera is using.`);
    }
    localStream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: preferredCameraId }, audio: true });
    remoteStream = new MediaStream();

    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });

    pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        remoteStream.addTrack(track);
        if (window.chrome.webview && window.chrome.webview.hostObjects) {
          track.onended = async () => {
            try {
              window.chrome.webview.hostObjects.trackData.Set("ended", track.kind);
            } catch (error) {
              console.error("Error during track.onended:", error);
            }
          };

          track.onmute = async () => {
            try {
              window.chrome.webview.hostObjects.trackData.Set("mute", track.kind);
            } catch (error) {
              console.error("Error during track.onmute:", error);
            }
          };

          track.onunmute = async () => {
            try {
              window.chrome.webview.hostObjects.trackData.Set("unmute", track.kind);
            } catch (error) {
              console.error("Error during track.onunmute:", error);
            }
          };
        }
      });
    };

    localVideo.srcObject = localStream;
    remoteVideo.srcObject = remoteStream;

    remoteVideo.muted = false;
    remoteVideo.play();

    if (callId) {
      addAnswer(callId);
    }
  } catch (error) {
    console.error("Error during initialization:", error);
  }
};

init();

const addAnswer = async (id) => {
  try {
    const callDoc = firestore.collection("calls").doc(id);
    const answerCandidates = callDoc.collection("answerCandidates");
    const offerCandidates = callDoc.collection("offerCandidates");

    pc.onicecandidate = (event) => {
      console.log('onicecandidate event: ', event);
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
      sdp: answerDescription.sdp
    };
    console.log('answer: ', answer);

    await callDoc.update({ answer });

    offerCandidates.onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          console.log('offerCandidates data: ', data);
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
    console.error("Error during adding answer:", error);
  }

  pc.onconnectionstatechange = async () => {
    window.chrome.webview.hostObjects.connectionData.Set(pc.connectionState);
  }

};

const endCall = async () => {
  try {
    pc.close();

    localStream.getTracks().forEach((track) => {
      track.stop();
      if (window.chrome.webview && window.chrome.webview.hostObjects) {
        window.chrome.webview.hostObjects.trackData.Set("ended", track.kind);
      }
    });

    remoteStream.getTracks().forEach((track) => remoteStream.removeTrack(track));

    stopTimer();
  } catch (error) {
    console.error("Error during ending a call:", error);
  }
};

const deleteCallId = async () => {
  if (callId) {
    await firestore.collection("calls").doc(callId).delete();
  }
};

const handleEndCall = async () => {
  await endCall();
  await deleteCallId();
};

const startTimer = () => {
  timer = setInterval(() => {
    seconds++;
    displayTime(seconds);
  }, 1000);
};

const stopTimer = () => {
  clearInterval(timer);
};

const displayTime = (seconds2) => {
  const minutes = Math.floor(seconds2 / 60);
  const remainderSeconds = seconds2 % 60;
  const display = `${minutes < 10 ? "0" : ""}${minutes}:${remainderSeconds < 10 ? "0" : ""}${remainderSeconds}`;
  timerDisplay.textContent = display;
};

const handleVolume = (action) => {
  if (action === "increase") {
    volumeLevel++;
  }

  if (action === "decrease") {
    volumeLevel--;
  }

  setVolumeLevel();

  if (window.chrome.webview && window.chrome.webview.hostObjects) {
    window.chrome.webview.hostObjects.trackData.setVolume(volumeLevel);
  }

  volumeModal.classList.add("active");

  clearTimeout(volumeModalTimer);
  volumeModalTimer = setTimeout(() => {
    volumeModal.classList.remove("active");
  }, volumeModalDuration);
}

endCallButton.addEventListener("click", handleEndCall);
volumeDownButton.addEventListener("click", () => handleVolume('decrease'));
volumeUpButton.addEventListener("click", () => handleVolume('increase'));
