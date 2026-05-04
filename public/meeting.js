//=============================================| Lama |=============================================
//=============================================| meeting.js |=============================================
// const socket = io();
// const params = new URLSearchParams(location.search);
// const name   = params.get('name');
// const room   = params.get('room');
// const role   = params.get('role');

// document.getElementById('info').innerHTML =
//   `<i class="fas fa-users"></i> Room: <b>${room}</b> | ` +
//   `<i class="fas fa-user"></i> <b>${name}</b> ${role === 'moderator' ? '(Moderator)' : ''}`;

// /* =================================================
//    STATE
// ================================================= */
// const peers      = {};
// const videoGrid  = document.getElementById('videos');
// let   localStream  = null;
// let   screenStream = null;
// let   iceConfig    = null;
// const unfocusedUsers     = {};  // peerId -> name (sudah melewati delay)
// const unfocusedTimers    = {};  // peerId -> setTimeout id (sedang menunggu delay)
// let   currentSharingPeerId = null;
// const peerStreamType       = {};

// const NOTIF_DELAY_MS = 5000; // 5 detik sebelum notif tampil

// /* =================================================
//    TOMBOL KONTROL
// ================================================= */
// const camBtn   = document.getElementById('camBtn');
// const micBtn   = document.getElementById('micBtn');
// const shareBtn = document.getElementById('shareBtn');
// const leaveBtn = document.getElementById('leaveBtn');

// camBtn.onclick = () => {
//   if (!localStream) return;
//   const track = localStream.getVideoTracks()[0];
//   if (!track) return;
//   track.enabled = !track.enabled;
//   camBtn.querySelector('i').className = track.enabled ? 'fas fa-video' : 'fas fa-video-slash';
//   camBtn.classList.toggle('off', !track.enabled);
// };

// micBtn.onclick = () => {
//   if (!localStream) return;
//   const track = localStream.getAudioTracks()[0];
//   if (!track) return;
//   track.enabled = !track.enabled;
//   micBtn.querySelector('i').className = track.enabled ? 'fas fa-microphone' : 'fas fa-microphone-slash';
//   micBtn.classList.toggle('off', !track.enabled);
// };

// shareBtn.onclick = async () => {
//   if (!localStream) return;
//   if (!screenStream) {
//     try {
//       screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
//       const screenTrack = screenStream.getVideoTracks()[0];
//       for (let id in peers) {
//         const sender = peers[id].pc.getSenders().find(s => s.track?.kind === 'video');
//         if (sender) sender.replaceTrack(screenTrack);
//       }
//       screenTrack.onended = stopScreenShare;
//       socket.emit('screen-share-start');
//       activateShareLayout(screenTrack);
//       shareBtn.classList.add('off');
//       shareBtn.querySelector('i').className = 'fas fa-stop-circle';
//     } catch (e) { console.log('Share dibatalkan'); }
//   } else {
//     stopScreenShare();
//   }
// };

// leaveBtn.onclick = () => { location.href = '/'; };

// /* =================================================
//    PRELOAD AI MODEL
// ================================================= */
// const faceMesh = new FaceMesh({
//   locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`
// });
// faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true });
// faceMesh.initialize();

// /* =================================================
//    INIT
// ================================================= */
// async function init() {
//   try {
//     const res = await fetch('/ice-config');
//     iceConfig  = await res.json();
//   } catch (e) {
//     iceConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
//   }
//   await initMedia();
// }

// init();

// /* =================================================
//    GET USER MEDIA & SOCKET
// ================================================= */
// async function initMedia() {
//   try {
//     localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
//     addVideo(localStream, true);
//     socket.emit('join-room', room);

//     socket.on('all-users', users => {
//       users.forEach(id => createPeer(id, true));
//     });

//     socket.on('user-connected', id => {
//       createPeer(id, false);
//     });

//     socket.on('user-disconnected', id => {
//       if (peers[id]) { peers[id].pc.close(); delete peers[id]; }
//       delete peerStreamType[id];

//       // Bersihkan timer dan status notif jika user disconnect
//       clearUnfocusedTimer(id);
//       delete unfocusedUsers[id];
//       updateNotifUI();

//       const el = document.getElementById(id);
//       if (el) el.remove();
//       if (currentSharingPeerId === id) deactivateShareLayout();
//     });

//     socket.on('user-focus-changed', data => {
//       // Update label status di tile video peer
//       const label = document.getElementById(`status-${data.id}`);
//       if (label) {
//         label.innerHTML   = data.status;
//         label.style.color = data.status === 'Focusing' ? '#81c995' : '#f28b82';
//       }

//       // Logika notifikasi moderator dengan delay 5 detik
//       if (role === 'moderator') {
//         const notFocused = ['Not Focused', 'Eyes Closed', 'No Face', 'Camera Off']
//           .includes(data.status);

//         if (notFocused) {
//           // Jika belum ada timer untuk user ini, mulai timer 5 detik
//           if (!unfocusedTimers[data.id] && !unfocusedUsers[data.id]) {
//             unfocusedTimers[data.id] = setTimeout(() => {
//               // Setelah 5 detik masih tidak fokus → masukkan ke notif
//               unfocusedUsers[data.id] = data.name;
//               delete unfocusedTimers[data.id];
//               updateNotifUI();
//             }, NOTIF_DELAY_MS);
//           }
//         } else {
//           // User kembali fokus → batalkan timer dan hapus dari notif
//           clearUnfocusedTimer(data.id);
//           if (unfocusedUsers[data.id]) {
//             delete unfocusedUsers[data.id];
//             updateNotifUI();
//           }
//         }
//       }
//     });

//     socket.on('current-statuses', statuses => {
//       statuses.forEach(({ id, status }) => {
//         const label = document.getElementById(`status-${id}`);
//         if (label) {
//           label.innerHTML   = status;
//           label.style.color = status === 'Focusing' ? '#81c995' : '#f28b82';
//         }
//       });
//     });

//     socket.on('screen-share-started', peerId => {
//       peerStreamType[peerId] = 'screen'; currentSharingPeerId = peerId;
//     });
//     socket.on('screen-share-stopped', peerId => {
//       peerStreamType[peerId] = 'camera';
//       if (currentSharingPeerId === peerId) deactivateShareLayout();
//     });

//     socket.on('signal', async ({ from, signal }) => {
//       if (!peers[from]) createPeer(from, true);
//       await handleSignal(from, signal);
//     });

//   } catch (err) {
//     console.error('Media error:', err);
//     alert('Camera/Microphone tidak bisa diakses');
//   }
// }

// /* =================================================
//    HELPER: Batalkan timer unfocused untuk satu user
// ================================================= */
// function clearUnfocusedTimer(peerId) {
//   if (unfocusedTimers[peerId]) {
//     clearTimeout(unfocusedTimers[peerId]);
//     delete unfocusedTimers[peerId];
//   }
// }

// /* =================================================
//    CREATE PEER
// ================================================= */
// function createPeer(id, polite) {
//   if (peers[id]) return peers[id];

//   const pc = new RTCPeerConnection(iceConfig);
//   let makingOffer = false;

//   pc.onnegotiationneeded = async () => {
//     if (!polite) return;
//     try {
//       makingOffer = true;
//       await pc.setLocalDescription();
//       socket.emit('signal', { to: id, signal: pc.localDescription });
//     } catch (e) { console.error('[nego]', id, e); }
//     finally { makingOffer = false; }
//   };

//   pc.onicecandidate = ({ candidate }) => {
//     if (candidate) socket.emit('signal', { to: id, signal: candidate });
//   };

//   pc.oniceconnectionstatechange = () => {
//     if (pc.iceConnectionState === 'failed') pc.restartIce();
//   };

//   pc.ontrack = ({ track, streams }) => {
//     if (track.kind !== 'video') return;
//     const stream = streams[0];
//     if (peerStreamType[id] === 'screen') {
//       handleRemoteScreenTrack(stream, id, track); return;
//     }
//     const existingBox = document.getElementById(id);
//     if (existingBox) {
//       const vid = existingBox.querySelector('video');
//       if (vid && vid.srcObject !== stream) { vid.srcObject = stream; vid.play().catch(console.error); }
//     } else {
//       addVideo(stream, false, id);
//     }
//   };

//   localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
//   peers[id] = { pc, polite, getMakingOffer: () => makingOffer };
//   return peers[id];
// }

// /* =================================================
//    HANDLE SIGNAL
// ================================================= */
// async function handleSignal(from, signal) {
//   const entry = peers[from];
//   if (!entry) return;
//   const { pc, polite, getMakingOffer } = entry;

//   try {
//     if (signal.type === 'offer') {
//       const collision = getMakingOffer() || pc.signalingState !== 'stable';
//       if (!polite && collision) return;
//       await pc.setRemoteDescription(new RTCSessionDescription(signal));
//       await pc.setLocalDescription();
//       socket.emit('signal', { to: from, signal: pc.localDescription });
//     } else if (signal.type === 'answer') {
//       if (pc.signalingState === 'have-local-offer')
//         await pc.setRemoteDescription(new RTCSessionDescription(signal));
//     } else if (signal.candidate) {
//       if (pc.remoteDescription) {
//         await pc.addIceCandidate(new RTCIceCandidate(signal)).catch(console.error);
//       } else {
//         const wait = (ms) => new Promise(r => setTimeout(r, ms));
//         for (let i = 0; i < 15; i++) {
//           await wait(200);
//           if (pc.remoteDescription) {
//             await pc.addIceCandidate(new RTCIceCandidate(signal)).catch(console.error);
//             break;
//           }
//         }
//       }
//     }
//   } catch (e) {
//     console.error(`[signal ${from.slice(0,6)}]`, e.message, pc.signalingState);
//   }
// }

// /* =================================================
//    ADD VIDEO
// ================================================= */
// function addVideo(stream, local = false, peerId = null) {
//   if (!local && peerId && document.getElementById(peerId)) {
//     const v = document.querySelector(`#${peerId} video`);
//     if (v) { v.srcObject = stream; v.play().catch(console.error); }
//     return;
//   }

//   const box = document.createElement('div');
//   box.className = 'video-container';
//   if (!local && peerId) box.id = peerId;

//   const video = document.createElement('video');
//   video.srcObject   = stream;
//   video.autoplay    = true;
//   video.playsInline = true;
//   video.muted       = local;
//   video.onloadedmetadata = () =>
//     video.play().catch(() =>
//       document.addEventListener('click', () => video.play(), { once: true })
//     );

//   const status = document.createElement('div');
//   status.className = 'status';
//   status.innerText = 'Detecting...';
//   if (!local && peerId) status.id = `status-${peerId}`;

//   box.appendChild(video);
//   box.appendChild(status);
//   (document.getElementById('videoSidebar') || videoGrid).appendChild(box);

//   if (local) initFocus(video, status);
// }

// /* =================================================
//    SHARE SCREEN LAYOUT
// ================================================= */
// function activateShareLayout(screenTrack) {
//   currentSharingPeerId = 'local';
//   document.body.classList.add('sharing-active');
//   const sv = document.createElement('video');
//   sv.srcObject = new MediaStream([screenTrack]);
//   sv.autoplay = true; sv.playsInline = true; sv.muted = true;
//   sv.style.cssText = 'width:100%;height:100%;object-fit:contain;border-radius:12px;background:#000;';
//   _buildShareDOM(sv);
// }

// function handleRemoteScreenTrack(stream, peerId, track) {
//   if (!document.getElementById('presentationBox')) {
//     document.body.classList.add('sharing-active');
//     _buildShareDOM(null, peerId);
//   }
//   if (!document.getElementById(`present-${peerId}`)) {
//     const box = document.createElement('div');
//     box.id = `present-${peerId}`;
//     box.style.cssText = 'width:100%;height:100%;';
//     const sv = document.createElement('video');
//     sv.srcObject = stream; sv.autoplay = true; sv.playsInline = true; sv.muted = false;
//     sv.style.cssText = 'width:100%;height:100%;object-fit:contain;border-radius:12px;background:#000;';
//     sv.onloadedmetadata = () => sv.play().catch(console.error);
//     box.appendChild(sv);
//     document.getElementById('presentationBox')?.appendChild(box);
//   }
//   track.onended = () => { if (currentSharingPeerId === peerId) deactivateShareLayout(); };
// }

// function _buildShareDOM(screenVideo, sharingPeerId = null) {
//   const presentation = document.createElement('div');
//   presentation.className = 'presentation-container';
//   presentation.id = 'presentationBox';
//   if (screenVideo) presentation.appendChild(screenVideo);
//   const sidebar = document.createElement('div');
//   sidebar.className = 'video-sidebar';
//   sidebar.id = 'videoSidebar';
//   [...videoGrid.querySelectorAll('.video-container')].forEach(c => {
//     if (sharingPeerId && c.id === sharingPeerId) return;
//     sidebar.appendChild(c);
//   });
//   videoGrid.innerHTML = '';
//   videoGrid.appendChild(presentation);
//   videoGrid.appendChild(sidebar);
// }

// function deactivateShareLayout() {
//   currentSharingPeerId = null;
//   document.body.classList.remove('sharing-active');
//   const sidebar = document.getElementById('videoSidebar');
//   if (!sidebar) return;
//   const containers = [...sidebar.querySelectorAll('.video-container')];
//   videoGrid.innerHTML = '';
//   containers.forEach(c => videoGrid.appendChild(c));
// }

// function stopScreenShare() {
//   const camTrack = localStream.getVideoTracks()[0];
//   for (let id in peers) {
//     const sender = peers[id].pc.getSenders().find(s => s.track?.kind === 'video');
//     if (sender) sender.replaceTrack(camTrack);
//   }
//   if (screenStream) screenStream.getTracks().forEach(t => t.stop());
//   screenStream = null;
//   deactivateShareLayout();
//   socket.emit('screen-share-stop');
//   shareBtn.classList.remove('off');
//   shareBtn.querySelector('i').className = 'fas fa-desktop';
// }

// /* =================================================
//    FOCUS DETECTION — ADAPTIVE CALIBRATION
//    3 indikator: EAR + Head Yaw + Gaze
// ================================================= */
// function initFocus(video, status) {
//   const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

//   const CALIB_FRAMES    = 40;
//   const EAR_BLINK_RATIO = 0.75;
//   const GAZE_TOLERANCE  = 0.20;
//   const YAW_TOLERANCE   = 0.30;

//   let calibDone  = false;
//   let calibCount = 0;
//   let earSum = 0, gazeSum = 0, yawSum = 0;
//   let earThreshold = 0.20;
//   let gazeCenter   = 0.50;
//   let yawCenter    = 0.50;

//   status.innerHTML   = 'Calibrating...';
//   status.style.color = '#fbbc04';

//   faceMesh.onResults(res => {
//     if (!res.multiFaceLandmarks?.length) {
//       if (calibDone) updateAndBroadcastStatus(status, 'No Face', 'orange');
//       return;
//     }

//     const lm = res.multiFaceLandmarks[0];

//     // 1. EAR
//     const ear = (
//       (dist(lm[160], lm[144]) + dist(lm[158], lm[153])) / (2 * dist(lm[33],  lm[133])) +
//       (dist(lm[385], lm[380]) + dist(lm[387], lm[373])) / (2 * dist(lm[362], lm[263]))
//     ) / 2;

//     // 2. Gaze
//     const gaze = (
//       (lm[468].x - lm[33].x)  / (lm[133].x - lm[33].x) +
//       (lm[473].x - lm[263].x) / (lm[362].x - lm[263].x)
//     ) / 2;

//     // 3. Head Yaw
//     const noseTip    = lm[1];
//     const leftCheek  = lm[234];
//     const rightCheek = lm[454];
//     const distLeft   = Math.abs(noseTip.x - leftCheek.x);
//     const distRight  = Math.abs(noseTip.x - rightCheek.x);
//     const yaw        = distLeft / (distLeft + distRight);

//     // Fase kalibrasi
//     if (!calibDone) {
//       earSum += ear; gazeSum += gaze; yawSum += yaw;
//       calibCount++;
//       const pct = Math.round((calibCount / CALIB_FRAMES) * 100);
//       status.innerHTML   = `Calibrating ${pct}%`;
//       status.style.color = '#fbbc04';

//       if (calibCount >= CALIB_FRAMES) {
//         earThreshold = (earSum  / CALIB_FRAMES) * EAR_BLINK_RATIO;
//         gazeCenter   =  gazeSum / CALIB_FRAMES;
//         yawCenter    =  yawSum  / CALIB_FRAMES;
//         calibDone    = true;
//         console.log(`[Calib] EAR: ${earThreshold.toFixed(3)} | Gaze center: ${gazeCenter.toFixed(3)} | Yaw center: ${yawCenter.toFixed(3)}`);
//       }
//       return;
//     }

//     // Fase deteksi
//     if (ear < earThreshold) {
//       updateAndBroadcastStatus(status, 'Eyes Closed', '#f28b82'); return;
//     }
//     if (yaw < yawCenter - YAW_TOLERANCE || yaw > yawCenter + YAW_TOLERANCE) {
//       updateAndBroadcastStatus(status, 'Not Focused', '#f28b82'); return;
//     }
//     if (gaze < gazeCenter - GAZE_TOLERANCE || gaze > gazeCenter + GAZE_TOLERANCE) {
//       updateAndBroadcastStatus(status, 'Not Focused', '#f28b82'); return;
//     }

//     updateAndBroadcastStatus(status, 'Focusing', '#81c995');
//   });

//   async function processVideo() {
//     try {
//       const track = localStream.getVideoTracks()[0];
//       if (track?.enabled && video.readyState === 4 && video.videoWidth > 0) {
//         await faceMesh.send({ image: video });
//       } else if (!track?.enabled) {
//         updateAndBroadcastStatus(status, 'Camera Off', '#808080');
//       }
//     } catch (_) {}
//     requestAnimationFrame(processVideo);
//   }
//   processVideo();
// }

// function updateAndBroadcastStatus(el, text, color) {
//   el.innerHTML = text; el.style.color = color;
//   socket.emit('update-focus', { status: text, name });
// }

// /* =================================================
//    NOTIFIKASI MODERATOR — dengan delay 5 detik
   
//    Alur:
//    - User tidak fokus masuk → mulai timer 5 detik
//    - Jika dalam 5 detik kembali fokus → timer dibatalkan, notif tidak muncul
//    - Jika 5 detik penuh tidak fokus → masuk unfocusedUsers → notif tampil
//    - Jika sudah di notif lalu kembali fokus → langsung dihapus dari notif
// ================================================= */
// function updateNotifUI() {
//   const box   = document.getElementById('focusNotif');
//   if (!box) return;
//   const users = Object.values(unfocusedUsers);
//   if (users.length) {
//     box.style.display = 'block';
//     box.innerHTML = `<strong><i class="fas fa-exclamation-triangle"></i> Peringatan Fokus:</strong><br>${users.join(', ')} sedang tidak fokus.`;
//   } else {
//     box.style.display = 'none';
//   }
// }
//=============================================| meeting.js |=============================================
//=============================================| meeting.js |=============================================
const socket = io();
const params = new URLSearchParams(location.search);
const name   = params.get('name');
const room   = params.get('room');
const role   = params.get('role');

document.getElementById('info').innerHTML =
  `<i class="fas fa-users"></i> Room: <b>${room}</b> | ` +
  `<i class="fas fa-user"></i> <b>${name}</b> ${role === 'moderator' ? '(Moderator)' : ''}`;

/* =================================================
   STATE
================================================= */
const peers      = {};
const videoGrid  = document.getElementById('videos');
let   localStream  = null;
let   screenStream = null;
let   iceConfig    = null;
const unfocusedUsers     = {};  // peerId -> name (sudah melewati delay)
const unfocusedTimers    = {};  // peerId -> setTimeout id (sedang menunggu delay)
let   currentSharingPeerId = null;
const peerStreamType       = {};
const peerStreams           = {};  // peerId -> stream terbaru dari peer

const NOTIF_DELAY_MS = 5000; // 5 detik sebelum notif tampil

/* =================================================
   TOMBOL KONTROL
================================================= */
const camBtn   = document.getElementById('camBtn');
const micBtn   = document.getElementById('micBtn');
const shareBtn = document.getElementById('shareBtn');
const leaveBtn = document.getElementById('leaveBtn');

camBtn.onclick = () => {
  if (!localStream) return;
  const track = localStream.getVideoTracks()[0];
  if (!track) return;
  track.enabled = !track.enabled;
  camBtn.querySelector('i').className = track.enabled ? 'fas fa-video' : 'fas fa-video-slash';
  camBtn.classList.toggle('off', !track.enabled);
};

micBtn.onclick = () => {
  if (!localStream) return;
  const track = localStream.getAudioTracks()[0];
  if (!track) return;
  track.enabled = !track.enabled;
  micBtn.querySelector('i').className = track.enabled ? 'fas fa-microphone' : 'fas fa-microphone-slash';
  micBtn.classList.toggle('off', !track.enabled);
};

shareBtn.onclick = async () => {
  if (!localStream) return;
  if (!screenStream) {
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];
      for (let id in peers) {
        const sender = peers[id].pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(screenTrack);
      }
      screenTrack.onended = stopScreenShare;
      socket.emit('screen-share-start');
      activateShareLayout(screenTrack);
      shareBtn.classList.add('off');
      shareBtn.querySelector('i').className = 'fas fa-stop-circle';
    } catch (e) { console.log('Share dibatalkan'); }
  } else {
    stopScreenShare();
  }
};

leaveBtn.onclick = () => { location.href = '/'; };

/* =================================================
   PRELOAD AI MODEL
================================================= */
const faceMesh = new FaceMesh({
  locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`
});
faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true });
faceMesh.initialize();

/* =================================================
   INIT
================================================= */
async function init() {
  try {
    const res = await fetch('/ice-config');
    iceConfig  = await res.json();
  } catch (e) {
    iceConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
  }
  await initMedia();
}

init();

/* =================================================
   GET USER MEDIA & SOCKET
================================================= */
async function initMedia() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    addVideo(localStream, true);
    socket.emit('join-room', room);

    socket.on('all-users', users => {
      users.forEach(id => createPeer(id, true));
    });

    socket.on('user-connected', id => {
      createPeer(id, false);
    });

    socket.on('user-disconnected', id => {
      if (peers[id]) { peers[id].pc.close(); delete peers[id]; }
      delete peerStreamType[id];

      // Bersihkan timer dan status notif jika user disconnect
      clearUnfocusedTimer(id);
      delete unfocusedUsers[id];
      updateNotifUI();

      const el = document.getElementById(id);
      if (el) el.remove();
      if (currentSharingPeerId === id) deactivateShareLayout();
    });

    socket.on('user-focus-changed', data => {
      // Update label status di tile video peer
      const label = document.getElementById(`status-${data.id}`);
      if (label) {
        label.innerHTML   = data.status;
        label.style.color = data.status === 'Focusing' ? '#81c995' : '#f28b82';
      }

      // Logika notifikasi moderator dengan delay 5 detik
      if (role === 'moderator') {
        const notFocused = ['Not Focused', 'Eyes Closed', 'No Face', 'Camera Off']
          .includes(data.status);

        if (notFocused) {
          // Jika belum ada timer untuk user ini, mulai timer 5 detik
          if (!unfocusedTimers[data.id] && !unfocusedUsers[data.id]) {
            unfocusedTimers[data.id] = setTimeout(() => {
              // Setelah 5 detik masih tidak fokus → masukkan ke notif
              unfocusedUsers[data.id] = data.name;
              delete unfocusedTimers[data.id];
              updateNotifUI();
            }, NOTIF_DELAY_MS);
          }
        } else {
          // User kembali fokus → batalkan timer dan hapus dari notif
          clearUnfocusedTimer(data.id);
          if (unfocusedUsers[data.id]) {
            delete unfocusedUsers[data.id];
            updateNotifUI();
          }
        }
      }
    });

    socket.on('current-statuses', statuses => {
      statuses.forEach(({ id, status }) => {
        const label = document.getElementById(`status-${id}`);
        if (label) {
          label.innerHTML   = status;
          label.style.color = status === 'Focusing' ? '#81c995' : '#f28b82';
        }
      });
    });

    socket.on('screen-share-started', peerId => {
      peerStreamType[peerId] = 'screen';
      currentSharingPeerId   = peerId;
      // Coba aktifkan layout sekarang jika stream sudah tersedia
      // Jika belum, ontrack akan menanganinya saat fired
      tryActivateScreenLayout(peerId);
    });

    socket.on('screen-share-stopped', peerId => {
      peerStreamType[peerId] = 'camera';
      if (currentSharingPeerId === peerId) deactivateShareLayout();
    });

    socket.on('signal', async ({ from, signal }) => {
      if (!peers[from]) createPeer(from, true);
      await handleSignal(from, signal);
    });

  } catch (err) {
    console.error('Media error:', err);
    alert('Camera/Microphone tidak bisa diakses');
  }
}

/* =================================================
   HELPER: Batalkan timer unfocused untuk satu user
================================================= */
function clearUnfocusedTimer(peerId) {
  if (unfocusedTimers[peerId]) {
    clearTimeout(unfocusedTimers[peerId]);
    delete unfocusedTimers[peerId];
  }
}

/* =================================================
   CREATE PEER
================================================= */
function createPeer(id, polite) {
  if (peers[id]) return peers[id];

  const pc = new RTCPeerConnection(iceConfig);
  let makingOffer = false;

  pc.onnegotiationneeded = async () => {
    if (!polite) return;
    try {
      makingOffer = true;
      await pc.setLocalDescription();
      socket.emit('signal', { to: id, signal: pc.localDescription });
    } catch (e) { console.error('[nego]', id, e); }
    finally { makingOffer = false; }
  };

  pc.onicecandidate = ({ candidate }) => {
    if (candidate) socket.emit('signal', { to: id, signal: candidate });
  };

  pc.oniceconnectionstatechange = () => {
    if (pc.iceConnectionState === 'failed') pc.restartIce();
  };

  pc.ontrack = ({ track, streams }) => {
    if (track.kind !== 'video') return;
    const stream = streams[0];

    // Selalu simpan stream terbaru dari peer ini
    peerStreams[id] = stream;

    if (peerStreamType[id] === 'screen') {
      // screen-share-started sudah tiba duluan → langsung aktifkan layout
      handleRemoteScreenTrack(stream, id, track);
      return;
    }

    // Tampilkan sebagai kamera biasa
    // Jika screen-share-started tiba belakangan, tryActivateScreenLayout() akan handle
    const existingBox = document.getElementById(id);
    if (existingBox) {
      const vid = existingBox.querySelector('video');
      if (vid && vid.srcObject !== stream) {
        vid.srcObject = stream;
        vid.play().catch(console.error);
      }
    } else {
      addVideo(stream, false, id);
    }
  };

  localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
  peers[id] = { pc, polite, getMakingOffer: () => makingOffer };
  return peers[id];
}

/* =================================================
   HANDLE SIGNAL
================================================= */
async function handleSignal(from, signal) {
  const entry = peers[from];
  if (!entry) return;
  const { pc, polite, getMakingOffer } = entry;

  try {
    if (signal.type === 'offer') {
      const collision = getMakingOffer() || pc.signalingState !== 'stable';
      if (!polite && collision) return;
      await pc.setRemoteDescription(new RTCSessionDescription(signal));
      await pc.setLocalDescription();
      socket.emit('signal', { to: from, signal: pc.localDescription });
    } else if (signal.type === 'answer') {
      if (pc.signalingState === 'have-local-offer')
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
    } else if (signal.candidate) {
      if (pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(signal)).catch(console.error);
      } else {
        const wait = (ms) => new Promise(r => setTimeout(r, ms));
        for (let i = 0; i < 15; i++) {
          await wait(200);
          if (pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(signal)).catch(console.error);
            break;
          }
        }
      }
    }
  } catch (e) {
    console.error(`[signal ${from.slice(0,6)}]`, e.message, pc.signalingState);
  }
}

/* =================================================
   ADD VIDEO
================================================= */
function addVideo(stream, local = false, peerId = null) {
  if (!local && peerId && document.getElementById(peerId)) {
    const v = document.querySelector(`#${peerId} video`);
    if (v) { v.srcObject = stream; v.play().catch(console.error); }
    return;
  }

  const box = document.createElement('div');
  box.className = 'video-container';
  if (!local && peerId) box.id = peerId;

  const video = document.createElement('video');
  video.srcObject   = stream;
  video.autoplay    = true;
  video.playsInline = true;
  video.muted       = local;
  video.onloadedmetadata = () =>
    video.play().catch(() =>
      document.addEventListener('click', () => video.play(), { once: true })
    );

  const status = document.createElement('div');
  status.className = 'status';
  status.innerText = 'Detecting...';
  if (!local && peerId) status.id = `status-${peerId}`;

  box.appendChild(video);
  box.appendChild(status);
  (document.getElementById('videoSidebar') || videoGrid).appendChild(box);

  if (local) initFocus(video, status);
}

/* =================================================
   SHARE SCREEN LAYOUT
================================================= */
function activateShareLayout(screenTrack) {
  currentSharingPeerId = 'local';
  document.body.classList.add('sharing-active');
  const sv = document.createElement('video');
  sv.srcObject = new MediaStream([screenTrack]);
  sv.autoplay = true; sv.playsInline = true; sv.muted = true;
  sv.style.cssText = 'width:100%;height:100%;object-fit:contain;border-radius:12px;background:#000;';
  _buildShareDOM(sv);
}

/* =================================================
   TRY ACTIVATE SCREEN LAYOUT
   Dipanggil dari screen-share-started.
   Jika stream sudah ada di peerStreams, langsung aktifkan.
   Jika belum, poll setiap 300ms sampai stream tersedia (max 5 detik).
================================================= */
function tryActivateScreenLayout(peerId) {
  if (peerStreams[peerId]) {
    // Stream sudah ada, langsung aktifkan
    handleRemoteScreenTrack(peerStreams[peerId], peerId, null);
    return;
  }

  // Stream belum ada — poll sampai tersedia
  let attempts = 0;
  const maxAttempts = 17; // ~5 detik
  const interval = setInterval(() => {
    attempts++;
    if (peerStreams[peerId]) {
      clearInterval(interval);
      // Pastikan masih dalam mode screen (belum stop)
      if (peerStreamType[peerId] === 'screen') {
        handleRemoteScreenTrack(peerStreams[peerId], peerId, null);
      }
    } else if (attempts >= maxAttempts) {
      clearInterval(interval);
      console.warn('[share] stream tidak tersedia setelah 5 detik untuk peer:', peerId);
    }
  }, 300);
}

function handleRemoteScreenTrack(stream, peerId, track) {
  // Sembunyikan tile kamera peer yang sedang share
  const camBox = document.getElementById(peerId);
  if (camBox) camBox.style.display = 'none';

  if (!document.getElementById('presentationBox')) {
    document.body.classList.add('sharing-active');
    _buildShareDOM(null, peerId);
  }

  // Buat atau update video presentasi
  let presentBox = document.getElementById(`present-${peerId}`);
  if (!presentBox) {
    presentBox = document.createElement('div');
    presentBox.id = `present-${peerId}`;
    presentBox.style.cssText = 'width:100%;height:100%;';

    const sv = document.createElement('video');
    sv.id        = `screen-video-${peerId}`;
    sv.srcObject = stream;
    sv.autoplay  = true;
    sv.playsInline = true;
    sv.muted     = false;
    sv.style.cssText = 'width:100%;height:100%;object-fit:contain;border-radius:12px;background:#000;';
    sv.onloadedmetadata = () => sv.play().catch(console.error);
    presentBox.appendChild(sv);
    document.getElementById('presentationBox')?.appendChild(presentBox);
  } else {
    // Update stream jika presentBox sudah ada
    const sv = document.getElementById(`screen-video-${peerId}`);
    if (sv && sv.srcObject !== stream) {
      sv.srcObject = stream;
      sv.play().catch(console.error);
    }
  }

  if (track) {
    track.onended = () => {
      if (currentSharingPeerId === peerId) deactivateShareLayout();
    };
  }
}

function _buildShareDOM(screenVideo, sharingPeerId = null) {
  const presentation = document.createElement('div');
  presentation.className = 'presentation-container';
  presentation.id = 'presentationBox';
  if (screenVideo) presentation.appendChild(screenVideo);
  const sidebar = document.createElement('div');
  sidebar.className = 'video-sidebar';
  sidebar.id = 'videoSidebar';
  [...videoGrid.querySelectorAll('.video-container')].forEach(c => {
    if (sharingPeerId && c.id === sharingPeerId) return;
    sidebar.appendChild(c);
  });
  videoGrid.innerHTML = '';
  videoGrid.appendChild(presentation);
  videoGrid.appendChild(sidebar);
}

function deactivateShareLayout() {
  const sharingId = currentSharingPeerId;
  currentSharingPeerId = null;
  document.body.classList.remove('sharing-active');

  const sidebar = document.getElementById('videoSidebar');
  if (!sidebar) return;

  // Kembalikan semua tile dari sidebar ke grid dan tampilkan kembali
  const containers = [...sidebar.querySelectorAll('.video-container')];
  videoGrid.innerHTML = '';
  containers.forEach(c => {
    c.style.display = '';
    videoGrid.appendChild(c);
  });

  // Hapus presentation box
  const presentBox = document.getElementById(`present-${sharingId}`);
  if (presentBox) presentBox.remove();
}

function stopScreenShare() {
  const camTrack = localStream.getVideoTracks()[0];
  for (let id in peers) {
    const sender = peers[id].pc.getSenders().find(s => s.track?.kind === 'video');
    if (sender) sender.replaceTrack(camTrack);
  }
  if (screenStream) screenStream.getTracks().forEach(t => t.stop());
  screenStream = null;
  deactivateShareLayout();
  socket.emit('screen-share-stop');
  shareBtn.classList.remove('off');
  shareBtn.querySelector('i').className = 'fas fa-desktop';
}

/* =================================================
   FOCUS DETECTION — ADAPTIVE CALIBRATION
   3 indikator: EAR + Head Yaw + Gaze
================================================= */
function initFocus(video, status) {
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  const CALIB_FRAMES    = 40;
  const EAR_BLINK_RATIO = 0.75;
  const GAZE_TOLERANCE  = 0.20;
  const YAW_TOLERANCE   = 0.30;

  let calibDone  = false;
  let calibCount = 0;
  let earSum = 0, gazeSum = 0, yawSum = 0;
  let earThreshold = 0.20;
  let gazeCenter   = 0.50;
  let yawCenter    = 0.50;

  status.innerHTML   = 'Calibrating...';
  status.style.color = '#fbbc04';

  faceMesh.onResults(res => {
    if (!res.multiFaceLandmarks?.length) {
      if (calibDone) updateAndBroadcastStatus(status, 'No Face', 'orange');
      return;
    }

    const lm = res.multiFaceLandmarks[0];

    // 1. EAR
    const ear = (
      (dist(lm[160], lm[144]) + dist(lm[158], lm[153])) / (2 * dist(lm[33],  lm[133])) +
      (dist(lm[385], lm[380]) + dist(lm[387], lm[373])) / (2 * dist(lm[362], lm[263]))
    ) / 2;

    // 2. Gaze
    const gaze = (
      (lm[468].x - lm[33].x)  / (lm[133].x - lm[33].x) +
      (lm[473].x - lm[263].x) / (lm[362].x - lm[263].x)
    ) / 2;

    // 3. Head Yaw
    const noseTip    = lm[1];
    const leftCheek  = lm[234];
    const rightCheek = lm[454];
    const distLeft   = Math.abs(noseTip.x - leftCheek.x);
    const distRight  = Math.abs(noseTip.x - rightCheek.x);
    const yaw        = distLeft / (distLeft + distRight);

    // Fase kalibrasi
    if (!calibDone) {
      earSum += ear; gazeSum += gaze; yawSum += yaw;
      calibCount++;
      const pct = Math.round((calibCount / CALIB_FRAMES) * 100);
      status.innerHTML   = `Calibrating ${pct}%`;
      status.style.color = '#fbbc04';

      if (calibCount >= CALIB_FRAMES) {
        earThreshold = (earSum  / CALIB_FRAMES) * EAR_BLINK_RATIO;
        gazeCenter   =  gazeSum / CALIB_FRAMES;
        yawCenter    =  yawSum  / CALIB_FRAMES;
        calibDone    = true;
        console.log(`[Calib] EAR: ${earThreshold.toFixed(3)} | Gaze center: ${gazeCenter.toFixed(3)} | Yaw center: ${yawCenter.toFixed(3)}`);
      }
      return;
    }

    // Fase deteksi
    if (ear < earThreshold) {
      updateAndBroadcastStatus(status, 'Eyes Closed', '#f28b82'); return;
    }
    if (yaw < yawCenter - YAW_TOLERANCE || yaw > yawCenter + YAW_TOLERANCE) {
      updateAndBroadcastStatus(status, 'Not Focused', '#f28b82'); return;
    }
    if (gaze < gazeCenter - GAZE_TOLERANCE || gaze > gazeCenter + GAZE_TOLERANCE) {
      updateAndBroadcastStatus(status, 'Not Focused', '#f28b82'); return;
    }

    updateAndBroadcastStatus(status, 'Focusing', '#81c995');
  });

  async function processVideo() {
    try {
      const track = localStream.getVideoTracks()[0];
      if (track?.enabled && video.readyState === 4 && video.videoWidth > 0) {
        await faceMesh.send({ image: video });
      } else if (!track?.enabled) {
        updateAndBroadcastStatus(status, 'Camera Off', '#808080');
      }
    } catch (_) {}
    requestAnimationFrame(processVideo);
  }
  processVideo();
}

function updateAndBroadcastStatus(el, text, color) {
  el.innerHTML = text; el.style.color = color;
  socket.emit('update-focus', { status: text, name });
}

/* =================================================
   NOTIFIKASI MODERATOR — dengan delay 5 detik
   
   Alur:
   - User tidak fokus masuk → mulai timer 5 detik
   - Jika dalam 5 detik kembali fokus → timer dibatalkan, notif tidak muncul
   - Jika 5 detik penuh tidak fokus → masuk unfocusedUsers → notif tampil
   - Jika sudah di notif lalu kembali fokus → langsung dihapus dari notif
================================================= */
function updateNotifUI() {
  const box   = document.getElementById('focusNotif');
  if (!box) return;
  const users = Object.values(unfocusedUsers);
  if (users.length) {
    box.style.display = 'block';
    box.innerHTML = `<strong><i class="fas fa-exclamation-triangle"></i> Peringatan Fokus:</strong><br>${users.join(', ')} sedang tidak fokus.`;
  } else {
    box.style.display = 'none';
  }
}