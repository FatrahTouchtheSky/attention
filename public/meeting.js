const socket = io();
const params = new URLSearchParams(location.search);
const name = params.get('name');
const room = params.get('room');

document.getElementById('info').innerHTML = 
    `<i class="fas fa-users"></i> Room: <b>${room}</b> | <i class="fas fa-user"></i> <b>${name}</b>`;

socket.emit('join-room', room);

const peers = {};
const videoGrid = document.getElementById('videos');

let localStream = null;
let screenStream = null;

/* =================================================
   GET USER MEDIA
================================================= */
async function initMedia() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });

    addVideo(localStream, true);

    socket.on('user-connected', id => connectPeer(id));
    socket.on('signal', async data => handleSignal(data));

  } catch (err) {
    console.error("Media error:", err);
    alert("Camera/Microphone tidak bisa diakses");
  }
}

initMedia();

/* =================================================
   WEBRTC LOGIC
================================================= */
function createPeer(id) {
  const pc = new RTCPeerConnection();
  peers[id] = pc;

  localStream.getTracks().forEach(track =>
    pc.addTrack(track, localStream)
  );

  pc.ontrack = e => addVideo(e.streams[0]);

  pc.onicecandidate = e => {
    if (e.candidate) {
      socket.emit('signal', e.candidate);
    }
  };

  return pc;
}

async function connectPeer(id) {
  const pc = createPeer(id);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit('signal', offer);
}

async function handleSignal(data) {
  if (!peers[data.from]) createPeer(data.from);
  const pc = peers[data.from];

  if (data.signal.type) {
    await pc.setRemoteDescription(data.signal);

    if (data.signal.type === 'offer') {
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('signal', answer);
    }
  } else if (data.signal.candidate) {
    await pc.addIceCandidate(data.signal);
  }
}
/* =================================================
   ADD VIDEO ELEMENT (DENGAN STATUS DETEKSI)
================================================= */

function addVideo(stream, local = false) {
  // 1. Buat container utama untuk video (seperti kotak peserta di Meet)
  const box = document.createElement('div');
  box.className = 'video-container'; 

  // 2. Buat elemen video
  const video = document.createElement('video');
  video.srcObject = stream;
  video.autoplay = true;
  video.playsInline = true;
  video.muted = local;

  // 3. Buat elemen status (ini yang akan muncul di pojok video)
  const status = document.createElement('div');
  status.className = 'status';
  status.innerText = 'Detecting...'; // Teks awal

  // 4. Susun elemen: masukkan video dan status ke dalam box
  box.appendChild(video);
  box.appendChild(status);
  
  // 5. Masukkan box ke dalam grid utama di HTML
  videoGrid.appendChild(box);

  // 6. Jalankan deteksi wajah jika ini adalah video kita sendiri
  if (local) {
    initFocus(video, status);
  } else {
    // Jika video orang lain, sembunyikan label deteksi (opsional)
    status.style.display = 'none'; 
  }
}
/* =================================================
   KONTROL TOMBOL (LOGIKA BARU DENGAN IKON)
================================================= */
const camBtn = document.getElementById('camBtn');
const micBtn = document.getElementById('micBtn');
const shareBtn = document.getElementById('shareBtn');
const leaveBtn = document.getElementById('leaveBtn');

// Toggle Camera
camBtn.onclick = () => {
  if (!localStream) return;
  const track = localStream.getVideoTracks()[0];
  if (!track) return;

  track.enabled = !track.enabled;
  
  // Update UI
  const icon = camBtn.querySelector('i');
  if (track.enabled) {
    icon.className = 'fas fa-video';
    camBtn.classList.remove('off');
  } else {
    icon.className = 'fas fa-video-slash';
    camBtn.classList.add('off');
  }
};

// Toggle Mic
micBtn.onclick = () => {
  if (!localStream) return;
  const track = localStream.getAudioTracks()[0];
  if (!track) return;

  track.enabled = !track.enabled;

  // Update UI
  const icon = micBtn.querySelector('i');
  if (track.enabled) {
    icon.className = 'fas fa-microphone';
    micBtn.classList.remove('off');
  } else {
    icon.className = 'fas fa-microphone-slash';
    micBtn.classList.add('off');
  }
};

// Share Screen
shareBtn.onclick = async () => {
  if (!localStream) return;

  if (!screenStream) {
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];

      for (let id in peers) {
        const sender = peers[id].getSenders().find(s => s.track.kind === 'video');
        if (sender) sender.replaceTrack(screenTrack);
      }

      screenTrack.onended = stopScreenShare;
      
      // Update UI
      shareBtn.classList.add('off'); 
      shareBtn.querySelector('i').className = 'fas fa-stop-circle';
    } catch (err) {
      console.log("Share screen dibatalkan");
    }
  } else {
    stopScreenShare();
  }
};

function stopScreenShare() {
  const camTrack = localStream.getVideoTracks()[0];

  for (let id in peers) {
    const sender = peers[id].getSenders().find(s => s.track.kind === 'video');
    if (sender) sender.replaceTrack(camTrack);
  }

  if (screenStream) {
    screenStream.getTracks().forEach(t => t.stop());
  }
  screenStream = null;
  
  // Reset UI
  shareBtn.classList.remove('off');
  shareBtn.querySelector('i').className = 'fas fa-desktop';
}

leaveBtn.onclick = () => {
  location.href = '/';
};

// /* =================================================
//    FOCUS DETECTION (TETAP DIPERTAHANKAN)
// ================================================= */
// function initFocus(video, status) {
//   const faceMesh = new FaceMesh({
//     locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`
//   });

//   faceMesh.setOptions({
//     maxNumFaces: 1,
//     refineLandmarks: true
//   });

//   faceMesh.onResults(res => {
//     if (!res.multiFaceLandmarks.length) {
//       status.innerText = "No Face";
//       status.style.color = "orange";
//       status.style.background = "rgba(0,0,0,0.6)";
//       return;
//     }

//     const lm = res.multiFaceLandmarks[0];

//     // Rumus Gaze/Fokus kamu
//     const leftRatio = (lm[468].x - lm[33].x) / (lm[133].x - lm[33].x);
//     const rightRatio = (lm[473].x - lm[263].x) / (lm[362].x - lm[263].x);
//     const gaze = (leftRatio + rightRatio) / 2;

//     if (gaze > 0.4 && gaze < 0.6) {
//       status.innerText = "Focusing";
//       status.style.color = "#00ff00"; // Hijau terang
//     } else {
//       status.innerText = "Not Focused";
//       status.style.color = "#f71515"; // Merah
//     }
//   });

//   const cam = new Camera(video, {
//     onFrame: async () => {
//       await faceMesh.send({ image: video });
//     }
//   });

//   cam.start();
// }

/* =================================================
   FOCUS DETECTION (DIPERBARUI DENGAN DETEKSI MATA TERTUTUP)
================================================= */
function initFocus(video, status) {
  const faceMesh = new FaceMesh({
    locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`
  });

  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true
  });

  // Fungsi bantuan untuk menghitung jarak antara 2 titik
  const getDistance = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);

  faceMesh.onResults(res => {
    if (!res.multiFaceLandmarks.length) {
      status.innerHTML = "No Face";
      status.style.color = "orange";
      return;
    }

    const lm = res.multiFaceLandmarks[0];

    // ==========================================
    // 1. CEK MATA TERTUTUP (EYE ASPECT RATIO / EAR)
    // ==========================================
    
    // Mata Kiri
    const leftV1 = getDistance(lm[160], lm[144]); // Kelopak atas ke bawah
    const leftV2 = getDistance(lm[158], lm[153]); // Kelopak atas ke bawah (sisi sebelahnya)
    const leftH = getDistance(lm[33], lm[133]);   // Sudut mata kiri ke kanan
    const leftEAR = (leftV1 + leftV2) / (2.0 * leftH);

    // Mata Kanan
    const rightV1 = getDistance(lm[385], lm[380]);
    const rightV2 = getDistance(lm[387], lm[373]);
    const rightH = getDistance(lm[362], lm[263]);
    const rightEAR = (rightV1 + rightV2) / (2.0 * rightH);

    // Rata-rata bukaan kedua mata
    const avgEAR = (leftEAR + rightEAR) / 2;

    // Threshold mata tertutup. Jika angkanya di bawah 0.2, mata dianggap tertutup.
    // (Kamu bisa ubah angka 0.20 ini menjadi 0.18 atau 0.22 jika deteksinya kurang pas)
    if (avgEAR < 0.20) {
      status.innerHTML = "Eyes Closed";
      status.style.color = "#f28b82"; // Warna Merah (Not Focused)
      return; // Berhenti di sini, tidak perlu cek fokus bola mata
    }

    // ==========================================
    // 2. CEK FOKUS ARAH PANDANGAN (GAZE RATIO)
    // ==========================================
    const leftRatio = (lm[468].x - lm[33].x) / (lm[133].x - lm[33].x);
    const rightRatio = (lm[473].x - lm[263].x) / (lm[362].x - lm[263].x);
    const gaze = (leftRatio + rightRatio) / 2;

    if (gaze > 0.4 && gaze < 0.6) {
      status.innerHTML = "Focusing";
      status.style.color = "#81c995"; // Warna Hijau Terang
    } else {
      status.innerHTML = "Not Focused";
      status.style.color = "#f28b82"; // Warna Merah
    }
  });

  const cam = new Camera(video, {
    onFrame: async () => {
      await faceMesh.send({ image: video });
    }
  });

  cam.start();
}