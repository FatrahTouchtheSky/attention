const socket = io();
const params = new URLSearchParams(location.search);
const name = params.get('name');
const room = params.get('room') ? params.get('room').toLowerCase() : null;
const role = params.get('role');

document.getElementById('info').innerHTML =
  `<i class="fas fa-users"></i> Room: <b>${room}</b> | ` +
  `<i class="fas fa-user"></i> <b>${name}</b> ${role === 'moderator' ? '(Moderator)' : ''}`;

/* =================================================
   STATE
================================================= */
const peers = {};
const videoGrid = document.getElementById('videos');
let localStream = null;
let screenStream = null;
let iceConfig = null;
const unfocusedUsers = {};
const unfocusedTimers = {};
let currentSharingPeerId = null;
const peerStreamType = {};
const peerNames = {};  // peerId -> nama peserta

const NOTIF_DELAY_MS = 5000;

/* =================================================
   TOMBOL KONTROL
================================================= */
const camBtn = document.getElementById('camBtn');
const micBtn = document.getElementById('micBtn');
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
    iceConfig = await res.json();
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
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    addVideo(localStream, true);
    socket.emit('join-room', room);
    socket.emit('set-name', name);

    socket.on('all-users', users => {
      users.forEach(id => createPeer(id, true));
    });

    // Terima nama semua user yang sudah ada
    socket.on('peer-names', names => {
      names.forEach(({ id, name: pName }) => {
        if (pName) {
          peerNames[id] = pName;
          const el = document.getElementById('name-' + id);
          if (el) el.innerText = pName;
        }
      });
    });

    // Terima nama user baru yang join
    socket.on('peer-name', ({ id, name: pName }) => {
      if (pName) {
        peerNames[id] = pName;
        const el = document.getElementById('name-' + id);
        if (el) el.innerText = pName;
      }
    });

    socket.on('user-connected', id => {
      createPeer(id, false);
    });

    socket.on('user-disconnected', id => {
      if (peers[id]) { peers[id].pc.close(); delete peers[id]; }
      delete peerStreamType[id];
      delete peerNames[id];
      clearUnfocusedTimer(id);
      delete unfocusedUsers[id];
      updateNotifUI();
      const el = document.getElementById(id);
      if (el) el.remove();
      if (currentSharingPeerId === id) deactivateShareLayout();
    });

    socket.on('user-focus-changed', data => {
      // Update nama jika baru tersedia
      if (data.name && !peerNames[data.id]) {
        peerNames[data.id] = data.name;
        const el = document.getElementById('name-' + data.id);
        if (el) el.innerText = data.name;
      }

      const label = document.getElementById('status-' + data.id);
      if (label) {
        label.innerHTML = data.status;
        label.style.color = data.status === 'Focusing' ? '#81c995' : '#f28b82';
      }

      if (role === 'moderator') {
        const notFocused = ['Not Focused', 'Eyes Closed', 'No Face', 'Camera Off'].includes(data.status);
        if (notFocused) {
          if (!unfocusedTimers[data.id] && !unfocusedUsers[data.id]) {
            unfocusedTimers[data.id] = setTimeout(() => {
              unfocusedUsers[data.id] = data.name;
              delete unfocusedTimers[data.id];
              updateNotifUI();
            }, NOTIF_DELAY_MS);
          }
        } else {
          clearUnfocusedTimer(data.id);
          if (unfocusedUsers[data.id]) {
            delete unfocusedUsers[data.id];
            updateNotifUI();
          }
        }
      }
    });

    socket.on('current-statuses', statuses => {
      statuses.forEach(({ id, status, name: pName }) => {
        if (pName) {
          peerNames[id] = pName;
          const el = document.getElementById('name-' + id);
          if (el) el.innerText = pName;
        }
        const label = document.getElementById('status-' + id);
        if (label) {
          label.innerHTML = status;
          label.style.color = status === 'Focusing' ? '#81c995' : '#f28b82';
        }
      });
    });

    socket.on('screen-share-started', peerId => {
      peerStreamType[peerId] = 'screen';
      currentSharingPeerId = peerId;

      const doActivate = () => {
        const entry = peers[peerId];
        if (!entry) return false;
        // Coba dari tile DOM
        const box = document.getElementById(peerId);
        if (box) {
          const vid = box.querySelector('video');
          if (vid && vid.srcObject && vid.srcObject.getVideoTracks().length > 0) {
            handleRemoteScreenTrack(new MediaStream(vid.srcObject.getTracks()), peerId, null);
            return true;
          }
        }
        // Coba dari RTCRtpReceiver
        const vr = entry.pc.getReceivers().find(r => r.track?.kind === 'video' && r.track.readyState === 'live');
        if (vr) {
          handleRemoteScreenTrack(new MediaStream([vr.track]), peerId, null);
          return true;
        }
        return false;
      };

      if (!doActivate()) {
        let t = 0;
        const iv = setInterval(() => {
          if (doActivate() || peerStreamType[peerId] !== 'screen') clearInterval(iv);
          else if (++t >= 20) clearInterval(iv);
        }, 300);
      }
    });
    socket.on('screen-share-stopped', peerId => {
      peerStreamType[peerId] = 'camera';
      if (currentSharingPeerId === peerId) {
        deactivateShareLayout();
        // Kembalikan srcObject kamera ke tile
        setTimeout(() => {
          const entry = peers[peerId];
          if (!entry) return;
          const receivers = entry.pc.getReceivers();
          const vr = receivers.find(r => r.track && r.track.kind === 'video');
          if (vr) {
            const box = document.getElementById(peerId);
            if (box) {
              const vid = box.querySelector('video');
              if (vid) {
                vid.srcObject = new MediaStream([vr.track]);
                vid.play().catch(console.error);
              }
            }
          }
        }, 500);
      }
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
   HELPER
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
    const stream = streams[0];
    if (peerStreamType[id] === 'screen') {
      if (track.kind === 'video') handleRemoteScreenTrack(stream, id, track);
      return;
    }
    const existingBox = document.getElementById(id);
    if (existingBox) {
      const vid = existingBox.querySelector('video');
      if (vid) {
        // Force the video element to re-evaluate the stream (fixes black screen bug when video track arrives after audio track)
        vid.srcObject = null;
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
        const wait = ms => new Promise(r => setTimeout(r, ms));
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
    console.error('[signal]', e.message, pc.signalingState);
  }
}

/* =================================================
   ADD VIDEO
   ✅ Selalu tampilkan nama + indikator online
================================================= */
function addVideo(stream, local = false, peerId = null) {
  if (!local && peerId && document.getElementById(peerId)) {
    const v = document.querySelector('#' + peerId + ' video');
    if (v) { v.srcObject = stream; v.play().catch(console.error); }
    return;
  }

  const box = document.createElement('div');
  box.className = 'video-container';
  if (!local && peerId) box.id = peerId;

  const video = document.createElement('video');
  video.srcObject = stream;
  video.autoplay = true;
  video.playsInline = true;
  video.muted = local;
  if (local) {
    video.style.transform = 'scaleX(-1)';
  }
  video.onloadedmetadata = () =>
    video.play().catch(() => {
      ['click', 'touchstart'].forEach(evt =>
        document.addEventListener(evt, () => video.play().catch(console.error), { once: true })
      );
    });

  // ✅ Indikator online — titik hijau kanan atas
  const indicator = document.createElement('div');
  indicator.className = 'online-indicator';

  // ✅ Nama peserta — kiri bawah
  const nameTag = document.createElement('div');
  nameTag.className = 'name-tag';
  nameTag.innerText = local ? name : (peerNames[peerId] || '...');
  if (!local && peerId) nameTag.id = 'name-' + peerId;

  // ✅ Status fokus AI — di atas nama
  const status = document.createElement('div');
  status.className = 'status';
  status.innerText = local ? 'Calibrating...' : 'Detecting...';
  if (!local && peerId) status.id = 'status-' + peerId;

  box.appendChild(video);
  box.appendChild(indicator);
  box.appendChild(nameTag);
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

function handleRemoteScreenTrack(stream, peerId, track) {
  const camBox = document.getElementById(peerId);
  if (camBox) camBox.style.display = 'none';

  if (!document.getElementById('presentationBox')) {
    document.body.classList.add('sharing-active');
    _buildShareDOM(null, peerId);
  }
  if (!document.getElementById('present-' + peerId)) {
    const box = document.createElement('div');
    box.id = 'present-' + peerId;
    box.style.cssText = 'width:100%;height:100%;';
    const sv = document.createElement('video');
    sv.srcObject = stream; sv.autoplay = true; sv.playsInline = true; sv.muted = false;
    sv.style.cssText = 'width:100%;height:100%;object-fit:contain;border-radius:12px;background:#000;';
    sv.onloadedmetadata = () => sv.play().catch(console.error);
    box.appendChild(sv);
    document.getElementById('presentationBox')?.appendChild(box);
  }
  if (track) track.onended = () => { if (currentSharingPeerId === peerId) deactivateShareLayout(); };
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
    c.style.display = '';
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
  const containers = [...sidebar.querySelectorAll('.video-container')];
  videoGrid.innerHTML = '';
  containers.forEach(c => {
    c.style.display = '';
    videoGrid.appendChild(c);
  });
  const pb = document.getElementById('present-' + sharingId);
  if (pb) pb.remove();
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
================================================= */
function initFocus(video, status) {
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  const CALIB_FRAMES = 40;
  const EAR_BLINK_RATIO = 0.75;
  const GAZE_TOLERANCE = 0.20;
  const YAW_TOLERANCE = 0.30;

  let calibDone = false;
  let calibCount = 0;
  let earSum = 0, gazeSum = 0, yawSum = 0;
  let earThreshold = 0.20;
  let gazeCenter = 0.50;
  let yawCenter = 0.50;

  status.innerHTML = 'Calibrating...';
  status.style.color = '#fbbc04';

  faceMesh.onResults(res => {
    if (!res.multiFaceLandmarks?.length) {
      if (calibDone) updateAndBroadcastStatus(status, 'No Face', 'orange');
      return;
    }

    const lm = res.multiFaceLandmarks[0];

    const ear = (
      (dist(lm[160], lm[144]) + dist(lm[158], lm[153])) / (2 * dist(lm[33], lm[133])) +
      (dist(lm[385], lm[380]) + dist(lm[387], lm[373])) / (2 * dist(lm[362], lm[263]))
    ) / 2;

    const gaze = (
      (lm[468].x - lm[33].x) / (lm[133].x - lm[33].x) +
      (lm[473].x - lm[263].x) / (lm[362].x - lm[263].x)
    ) / 2;

    const noseTip = lm[1];
    const leftCheek = lm[234];
    const rightCheek = lm[454];
    const dL = Math.abs(noseTip.x - leftCheek.x);
    const dR = Math.abs(noseTip.x - rightCheek.x);
    const yaw = dL / (dL + dR);

    if (!calibDone) {
      earSum += ear; gazeSum += gaze; yawSum += yaw;
      calibCount++;
      const pct = Math.round((calibCount / CALIB_FRAMES) * 100);
      status.innerHTML = `Calibrating ${pct}%`;
      status.style.color = '#fbbc04';
      if (calibCount >= CALIB_FRAMES) {
        earThreshold = (earSum / CALIB_FRAMES) * EAR_BLINK_RATIO;
        gazeCenter = gazeSum / CALIB_FRAMES;
        yawCenter = yawSum / CALIB_FRAMES;
        calibDone = true;
      }
      return;
    }

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
    } catch (_) { }
    requestAnimationFrame(processVideo);
  }
  processVideo();
}

function updateAndBroadcastStatus(el, text, color) {
  el.innerHTML = text; el.style.color = color;
  socket.emit('update-focus', { status: text, name });
}

function updateNotifUI() {
  const box = document.getElementById('focusNotif');
  if (!box) return;
  const users = Object.values(unfocusedUsers);
  if (users.length) {
    box.style.display = 'block';
    box.innerHTML = `<strong><i class="fas fa-exclamation-triangle"></i> Peringatan Fokus:</strong><br>${users.join(', ')} sedang tidak fokus.`;
  } else {
    box.style.display = 'none';
  }
}