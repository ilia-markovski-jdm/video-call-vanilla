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
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"]
    },
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
const copyOfferButton = document.getElementById('copyOfferButton');
const copyAnswerButton = document.getElementById('copyAnswerButton');

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
  console.log(123)
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

function copyToClipboard(target, el) {
  target.select();
  target.setSelectionRange(0, 99999); // For mobile devices

  // Copy the text inside the text field
  navigator.clipboard.writeText(target.value);
}

initStreams();

createOfferButton.addEventListener('click', createOffer);
createAnswerButton.addEventListener('click', createAnswer);
addAnswerButton.addEventListener('click', addAnswer);
addAnswerButton.addEventListener('click', addAnswer);
copyOfferButton.addEventListener('click', (e) => copyToClipboard(offerArea, e.target));
copyAnswerButton.addEventListener('click', (e) => copyToClipboard(answerArea, e.target));



