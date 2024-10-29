let localStream;
let remoteStream;
let peerConnection;
let offerData = {
  sdp: null,
  type: null,
  candidates: [],
};
let answerData = {
  sdp: null,
  type: null,
  candidates: [],
};

const servers = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun.l.google.com:5349" },
    { urls: "stun:stun1.l.google.com:3478" },
    { urls: "stun:stun1.l.google.com:5349" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:5349" },
    { urls: "stun:stun3.l.google.com:3478" },
    { urls: "stun:stun3.l.google.com:5349" },
    { urls: "stun:stun4.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:5349" },
    {
      urls: 'turn:68.219.124.29:3478',
      username: 'test',
      credential: 'test'
    }
  ],
  iceCandidatePoolSize: 2,
};

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const createOfferButton = document.getElementById('createOfferButton');
const createAnswerButton = document.getElementById('createAnswerButton');
const addAnswerButton = document.getElementById('addAnswerButton');
const offerArea = document.getElementById('offerArea');

const initStreams = async () => {
  peerConnection = new RTCPeerConnection(servers);
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  remoteStream = new MediaStream();

  // Push tracks from local stream to peer connection
  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  // Pull tracks from remote stream, add to video stream
  peerConnection.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };

  localVideo.srcObject = localStream;
  remoteVideo.srcObject = remoteStream;
};

const createOffer = async () => {
  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  offerData.sdp = offer.sdp;
  offerData.type = offer.type;

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      offerData.candidates.push(event.candidate);
      offerArea.value = JSON.stringify(offerData);
    }
  };
}

const createAnswer = async () => {
  const offer = JSON.parse(offerArea.value);

  await peerConnection.setRemoteDescription(new RTCSessionDescription({ sdp: offer.sdp, type: offer.type }));

  const answer = await peerConnection.createAnswer();
  answerData.sdp = answer.sdp;
  answerData.type = answer.type;
  await peerConnection.setLocalDescription(answer);

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      answerData.candidates.push(event.candidate);
      answerArea.value = JSON.stringify(answerData);
    }
  };

  await addCandidates(offer.candidates);
};

const addAnswer = async () => {
  const answer = JSON.parse(answerArea.value);

  await peerConnection.setRemoteDescription(new RTCSessionDescription({ sdp: answer.sdp, type: answer.type }));
}

const addCandidates = async (candidates) => {
  if (candidates && candidates.length > 0) {
    candidates.forEach((candidate) => {
      peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    });
  }
}

initStreams();

createOfferButton.addEventListener('click', createOffer);
createAnswerButton.addEventListener('click', createAnswer);
addAnswerButton.addEventListener('click', addAnswer);



