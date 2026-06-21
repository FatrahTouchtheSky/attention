const socket = io();
const params = new URLSearchParams(location.search);

// 1. Get Room ID: dari path (e.g. /raqmiz -> raqmiz) atau fallback ke query param
let room = location.pathname.substring(1).toLowerCase();
if (!room || room === 'meeting.html') {
  room = params.get('room') ? params.get('room').toLowerCase() : null;
}

// 2. Get Name & Role: dari sessionStorage atau fallback ke query param
const name = sessionStorage.getItem('meeting_name') || params.get('name');
const role = sessionStorage.getItem('meeting_role') || params.get('role') || 'participant';

// Get or create unique userId to persist statistics on page refresh
let userId = sessionStorage.getItem('meeting_userId');
if (!userId) {
  userId = Math.random().toString(36).substring(2, 15);
  sessionStorage.setItem('meeting_userId', userId);
}

// 3. Jika nama atau room tidak ada, arahkan ke lobby
if (!name || !room) {
  window.location.href = `/?room=${room || ''}`;
  throw new Error("Missing credentials, redirecting to lobby.");
}


document.getElementById('info').innerHTML =
  // `<i class="fas fa-users"></i> Room: <b id="roomIdText">${room}</b> ` +
  `Room ID: <b id="roomIdText">${room}</b> ` +
  `<i class="fas fa-copy" id="copyRoomBtn" style="cursor:pointer; margin-left: 6px; opacity: 0.8;" title="Copy Room ID"></i>` +
  `<i class="fas fa-share-alt" id="smallShareLinkBtn" style="cursor:pointer; margin-left: 6px; opacity: 0.8;" title="Copy Meeting Link"></i>`;

document.getElementById('copyRoomBtn').addEventListener('click', () => {
  navigator.clipboard.writeText(room).then(() => {
    const btn = document.getElementById('copyRoomBtn');
    btn.className = 'fas fa-check';
    btn.style.color = '#81c995';
    setTimeout(() => {
      btn.className = 'fas fa-copy';
      btn.style.color = '';
    }, 2000);
  });
});

document.getElementById('smallShareLinkBtn').addEventListener('click', () => {
  const link = window.location.origin + '/' + room;
  navigator.clipboard.writeText(link).then(() => {
    const btn = document.getElementById('smallShareLinkBtn');
    btn.className = 'fas fa-check';
    btn.style.color = '#81c995';
    if (typeof showToast === 'function') {
      showToast("Tautan meeting disalin ke clipboard!");
    } else {
      alert("Tautan meeting disalin ke clipboard!");
    }
    setTimeout(() => {
      btn.className = 'fas fa-share-alt';
      btn.style.color = '';
    }, 2000);
  }).catch(err => {
    console.error("Could not copy text: ", err);
  });
});

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
const peerRoles = {};  // peerId -> role peserta
const peerMediaStatus = {}; // peerId -> { mic: boolean, cam: boolean }

let allVideoBoxes = [];
let currentPage = 1;

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
  updateParticipantsList();
  socket.emit('media-status', {
    mic: localStream.getAudioTracks()[0]?.enabled,
    cam: track.enabled
  });
};

micBtn.onclick = () => {
  if (!localStream) return;
  const track = localStream.getAudioTracks()[0];
  if (!track) return;
  track.enabled = !track.enabled;
  micBtn.querySelector('i').className = track.enabled ? 'fas fa-microphone' : 'fas fa-microphone-slash';
  micBtn.classList.toggle('off', !track.enabled);
  updateParticipantsList();
  socket.emit('media-status', {
    mic: track.enabled,
    cam: localStream.getVideoTracks()[0]?.enabled
  });
};

shareBtn.onclick = async () => {
  if (!localStream) return;
  if (!screenStream) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      alert("Browser perangkat Anda tidak mendukung fitur Share Screen.");
      return;
    }

    try {
      const displayConstraints = {
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: true
      };

      try {
        screenStream = await navigator.mediaDevices.getDisplayMedia(displayConstraints);
      } catch (err) {
        // Fallback untuk perangkat HP/browser yang tidak mendukung share audio
        screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 }
          }
        });
      }

      const screenTrack = screenStream.getVideoTracks()[0];
      if (screenTrack && 'contentHint' in screenTrack) {
        screenTrack.contentHint = 'detail'; // Memprioritaskan detail & teks tajam
      }
      const screenAudioTrack = screenStream.getAudioTracks()[0];

      let audioTrackToSend = localStream.getAudioTracks()[0];

      if (screenAudioTrack) {
        if (!window.audioContext) window.audioContext = new AudioContext();
        window.audioDest = window.audioContext.createMediaStreamDestination();

        window.micSource = window.audioContext.createMediaStreamSource(new MediaStream([localStream.getAudioTracks()[0]]));
        window.micSource.connect(window.audioDest);

        window.sysSource = window.audioContext.createMediaStreamSource(new MediaStream([screenAudioTrack]));
        window.sysSource.connect(window.audioDest);

        audioTrackToSend = window.audioDest.stream.getAudioTracks()[0];
      }

      for (let id in peers) {
        const vidSender = peers[id].pc.getSenders().find(s => s.track?.kind === 'video');
        if (vidSender) vidSender.replaceTrack(screenTrack);

        if (screenAudioTrack) {
          const audSender = peers[id].pc.getSenders().find(s => s.track?.kind === 'audio');
          if (audSender) audSender.replaceTrack(audioTrackToSend);
        }
      }

      screenTrack.onended = stopScreenShare;
      socket.emit('screen-share-start');
      activateShareLayout(screenTrack);
      shareBtn.classList.add('off');
      shareBtn.querySelector('i').className = 'fas fa-stop-circle';
    } catch (e) {
      console.log('Share dibatalkan atau gagal', e);
      if (e.name !== 'NotAllowedError' && e.name !== 'AbortError') {
        alert("Gagal memulai Share Screen: " + e.message);
      }
    }
  } else {
    stopScreenShare();
  }
};

const summarySidebar = document.getElementById('summarySidebar');
const closeSummarySidebarBtn = document.getElementById('closeSummarySidebarBtn');

leaveBtn.onclick = () => {
  location.href = '/';
};

if (closeSummarySidebarBtn) {
  closeSummarySidebarBtn.onclick = () => {
    document.body.classList.remove('sidebar-open');
    summarySidebar.classList.remove('open');
  };
}

const downloadSummaryBtn = document.getElementById('downloadSummaryBtn');
if (downloadSummaryBtn) {
  downloadSummaryBtn.onclick = () => {
    let csvContent = "data:text/csv;charset=utf-8,Participant Name,Focus Level,Status\n";
    const items = document.querySelectorAll('#summaryList .participant-item');
    items.forEach(item => {
      const name = item.querySelector('.participant-name').innerText.replace(/,/g, ' ');
      const focus = item.querySelector('.participant-role').innerText;
      const status = item.querySelector('.participant-status').innerText;
      csvContent += `"${name}","${focus}","${status}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Attention_Summary_${room}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
}

/* =================================================
   PARTICIPANTS SIDEBAR
================================================= */
const moreOptionsBtn = document.getElementById('moreOptionsBtn');
const optionsMenu = document.getElementById('optionsMenu');
const participantsBtnMenu = document.getElementById('participantsBtnMenu');
const summaryBtnMenu = document.getElementById('summaryBtnMenu');
const participantsSidebar = document.getElementById('participantsSidebar');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');
const participantSearch = document.getElementById('participantSearch');

// Toggle Menu
if (moreOptionsBtn) {
  moreOptionsBtn.onclick = (e) => {
    e.stopPropagation();
    optionsMenu.classList.toggle('show');
  };
}

// Close menu if clicked outside
document.addEventListener('click', (e) => {
  if (optionsMenu && optionsMenu.classList.contains('show') && !optionsMenu.contains(e.target) && e.target !== moreOptionsBtn) {
    optionsMenu.classList.remove('show');
  }
});

// Participants Sidebar Logic
if (participantsBtnMenu) {
  participantsBtnMenu.onclick = () => {
    optionsMenu.classList.remove('show');
    if (summarySidebar) summarySidebar.classList.remove('open');
    document.body.classList.add('sidebar-open');
    participantsSidebar.classList.add('open');
    updateParticipantsList();
  };
}

// Summary Sidebar Logic
if (role === 'moderator' && summaryBtnMenu) {
  summaryBtnMenu.style.display = 'flex';
  summaryBtnMenu.onclick = async () => {
    optionsMenu.classList.remove('show');
    try {
      const res = await fetch(`/room-summary?room=${room}`, {
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      });
      const result = await res.json();

      if (result.success && result.data) {
        const list = document.getElementById('summaryList');
        list.innerHTML = '';
        const stats = result.data;
        let hasData = false;

        for (const peerId in stats) {
          const userStat = stats[peerId];
          const focusPercent = userStat.total > 0 ? Math.round((userStat.focused / userStat.total) * 100) : 0;
          const item = document.createElement('div');
          item.className = 'participant-item';

          let color = '#ea4335';
          let statusText = 'Kurang';
          if (focusPercent >= 80) { color = '#34a853'; statusText = 'Baik'; }
          else if (focusPercent >= 50) { color = '#fbbc04'; statusText = 'Cukup'; }

          const initial = (userStat.name || '?').charAt(0).toUpperCase();

          item.innerHTML = `
            <div class="participant-avatar">${initial}</div>
            <div class="participant-info">
                <div class="participant-name">${userStat.name || 'Unknown'}</div>
                <div class="participant-role">Focus Level: ${focusPercent}%</div>
            </div>
            <div class="participant-status" style="color: ${color}; font-weight: 600;">
                ${statusText}
            </div>
          `;
          list.appendChild(item);
          hasData = true;
        }

        if (hasData) {
          if (participantsSidebar) participantsSidebar.classList.remove('open');
          document.body.classList.add('sidebar-open');
          summarySidebar.classList.add('open');
        } else {
          alert('Belum ada data kefokusan yang terkumpul (AI mungkin belum aktif).');
        }
      } else {
        alert('Tidak ada data rangkuman untuk ruangan ini.');
      }
    } catch (e) {
      console.error('Gagal mengambil summary attention', e);
      alert('Gagal mengambil data: ' + e.message + '\n\nPastikan Anda sudah merefresh browser secara HARD REFRESH (Ctrl+Shift+R).');
    }
  };
}

closeSidebarBtn.onclick = () => {
  document.body.classList.remove('sidebar-open');
  participantsSidebar.classList.remove('open');
};

participantSearch.addEventListener('input', () => {
  updateParticipantsList();
});

function getInitials(nameString) {
  if (!nameString) return '?';
  const parts = nameString.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return nameString.substring(0, 2).toUpperCase();
}

function updateParticipantsList() {
  const listContainer = document.getElementById('participantsList');
  const countEl = document.getElementById('participantsCount');
  if (!listContainer || !countEl) return;

  const query = participantSearch.value.toLowerCase();

  // Kumpulkan semua peserta
  const allParticipants = [];

  // 1. Local User
  const localRoleStr = role === 'moderator' ? ' (Host)' : ' (Me)';
  allParticipants.push({
    id: 'local',
    name: name,
    displayName: `${name}${localRoleStr}`,
    role: role === 'moderator' ? 'Host' : 'Participant',
    isLocal: true
  });

  // 2. Remote Users
  for (const id in peers) {
    const pName = peerNames[id] || 'Unknown';
    const pRole = peerRoles[id] || 'participant';
    const isHost = pRole === 'moderator';

    allParticipants.push({
      id: id,
      name: pName,
      displayName: isHost ? `${pName} (Host)` : pName,
      role: isHost ? 'Host' : 'Participant',
      isLocal: false
    });
  }

  countEl.innerText = `Participants (${allParticipants.length})`;

  // Filter by search
  const filtered = allParticipants.filter(p => p.name.toLowerCase().includes(query));

  listContainer.innerHTML = '';

  filtered.forEach(p => {
    // Generate warna avatar berdasarkan nama (simple hash)
    const colors = ['#1a73e8', '#ea4335', '#fbbc04', '#34a853', '#8b5cf6', '#ec4899'];
    const colorIndex = p.name.length % colors.length;
    const bgColor = colors[colorIndex];

    // Status mic/cam. (Catatan: Untuk remote, kita butuh sinkronisasi status mic/cam via socket jika ingin akurat.
    // Sementara kita mock merah jika remote, dan cek track lokal untuk 'local')
    let micOn = false;
    let camOn = false;

    if (p.isLocal && localStream) {
      const micTrack = localStream.getAudioTracks()[0];
      if (micTrack) micOn = micTrack.enabled;
      const camTrack = localStream.getVideoTracks()[0];
      if (camTrack) camOn = camTrack.enabled;
    } else if (!p.isLocal && peerMediaStatus[p.id]) {
      micOn = peerMediaStatus[p.id].mic;
      camOn = peerMediaStatus[p.id].cam;
    } else if (!p.isLocal) {
      // Default assume on if not known yet
      micOn = true;
      camOn = true;
    }

    const micIcon = micOn ? 'fas fa-microphone on' : 'fas fa-microphone-slash off';
    const camIcon = camOn ? 'fas fa-video on' : 'fas fa-video-slash off';

    const item = document.createElement('div');
    item.className = 'participant-item';
    item.innerHTML = `
      <div class="participant-avatar" style="background-color: ${bgColor}">
          ${getInitials(p.name)}
      </div>
      <div class="participant-info">
          <div class="participant-name">${p.displayName}</div>
      </div>
      <div class="participant-status">
          <i class="${micIcon}" style="${!micOn ? 'color: #ea4335;' : ''}"></i>
          <i class="${camIcon}" style="${!camOn ? 'color: #ea4335;' : ''}"></i>
      </div>
    `;
    listContainer.appendChild(item);
  });
}


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
  if (role === 'participant') {
    try {
      const res = await fetch(`/check-room?room=${room}`);
      if (!res.ok) {
        console.warn("API check-room tidak tersedia, mungkin server belum direstart.");
      } else {
        try {
          const data = await res.json();
          if (!data.exists) {
            alert("Gagal: Room tidak ditemukan atau sudah ditutup.");
            window.location.href = '/';
            return;
          }
        } catch (jsonErr) {
          console.warn("Bukan respons JSON, mengabaikan pengecekan.");
        }
      }
    } catch (e) {
      console.warn("Gagal mengecek room", e);
    }
  }

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
    socket.emit('join-room', room, name);
    socket.emit('set-name', { name, role, userId });
    updateParticipantsList();

    socket.on('all-users', users => {
      users.forEach(id => createPeer(id, true));
    });

    // Terima nama semua user yang sudah ada
    socket.on('peer-names', names => {
      names.forEach(({ id, name: pName, role: pRole }) => {
        if (pName) {
          peerNames[id] = pName;
          peerRoles[id] = pRole;
          const el = document.getElementById('name-' + id);
          if (el) el.innerText = pName;
        }
      });
    });

    // Terima nama user baru yang join
    socket.on('peer-name', data => {
      peerNames[data.id] = data.name;
      peerRoles[data.id] = data.role;
      const el = document.getElementById('name-' + data.id);
      if (el) el.innerText = data.name;
      updateParticipantsList();

      showToast(`${data.name} telah bergabung ke ruang meeting.`);
    });

    socket.on('user-connected', id => {
      createPeer(id, false);
    });

    socket.on('user-disconnected', id => {
      if (peers[id]) { peers[id].pc.close(); delete peers[id]; }
      delete peerStreamType[id];
      const leftName = peerNames[id] || 'Peserta';
      delete peerNames[id];
      delete peerRoles[id];
      delete peerMediaStatus[id];
      clearUnfocusedTimer(id);
      delete unfocusedUsers[id];
      updateNotifUI();

      allVideoBoxes = allVideoBoxes.filter(b => b.id !== id);
      const el = document.getElementById(id);
      if (el) el.remove();
      if (currentSharingPeerId === id) deactivateShareLayout();
      updatePagination();
      updateParticipantsList();

      // Tampilkan toast notification
      showToast(`${leftName} telah meninggalkan ruang meeting.`);
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
        label.style.color = data.status === 'Memperhatikan' ? '#81c995' : '#f28b82';
      }

      if (role === 'moderator') {
        const notFocused = ['Tidak Memperhatikan', 'Tidak ada Wajah', 'Kamera Mati'].includes(data.status);
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
          label.style.color = status === 'Memperhatikan' ? '#81c995' : '#f28b82';
        }
      });
    });

    socket.on('current-media-statuses', statuses => {
      statuses.forEach(({ id, mic, cam }) => {
        peerMediaStatus[id] = { mic, cam };
      });
      updateParticipantsList();
    });

    socket.on('media-status-changed', ({ id, mic, cam }) => {
      peerMediaStatus[id] = { mic, cam };
      updateParticipantsList();
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

    // Mulai deteksi siapa yang bersuara
    startSpeakerDetection();

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
   ACTIVE SPEAKER DETECTION
================================================= */
function startSpeakerDetection() {
  // Local monitoring via Web Audio API
  if (localStream && localStream.getAudioTracks().length > 0) {
    try {
      const audioCtx = window.audioContext || new (window.AudioContext || window.webkitAudioContext)();
      if (!window.audioContext) window.audioContext = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;

      const source = audioCtx.createMediaStreamSource(localStream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;

        const localBox = allVideoBoxes.find(b => b.id === 'local')?.element;
        if (localBox) {
          const track = localStream.getAudioTracks()[0];
          if (track && track.enabled && average > 10) {
            localBox.classList.add('speaking');
          } else {
            localBox.classList.remove('speaking');
          }
        }
      }, 150);

      const resumeAudio = () => {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        document.removeEventListener('click', resumeAudio);
      };
      document.addEventListener('click', resumeAudio);
    } catch (e) {
      console.warn("Local speaker detection error", e);
    }
  }

  // Remote monitoring via WebRTC Stats
  setInterval(() => {
    for (const id in peers) {
      const pc = peers[id].pc;
      if (!pc) continue;

      pc.getStats(null).then(stats => {
        let isSpeaking = false;
        stats.forEach(report => {
          if (report.type === 'inbound-rtp' && report.kind === 'audio') {
            if (report.audioLevel > 0.02) {
              isSpeaking = true;
            }
          }
        });

        const box = document.getElementById(id);
        if (box) {
          if (isSpeaking) box.classList.add('speaking');
          else box.classList.remove('speaking');
        }
      }).catch(() => { }); // ignore errors if connection is closed
    }
  }, 200);
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

    // Selalu buat/update video box peserta agar DOM-nya tersimpan di layout
    const existingBox = document.getElementById(id);
    if (existingBox) {
      const vid = existingBox.querySelector('video');
      if (vid) {
        // Force the video element to re-evaluate the stream
        vid.srcObject = null;
        vid.srcObject = stream;
        vid.play().catch(console.error);
      }
    } else {
      addVideo(stream, false, id);
    }

    // Jika sedang share screen, tampilkan juga di area presentation stage
    if (peerStreamType[id] === 'screen') {
      if (track.kind === 'video') handleRemoteScreenTrack(stream, id, track);
    }
  };

  let videoTrack = localStream.getVideoTracks()[0];
  let audioTrack = localStream.getAudioTracks()[0];

  if (screenStream) {
    const sVid = screenStream.getVideoTracks()[0];
    if (sVid && sVid.readyState === 'live') {
      videoTrack = sVid;
    }
    if (window.audioDest) {
      const sAud = window.audioDest.stream.getAudioTracks()[0];
      if (sAud && sAud.readyState === 'live') {
        audioTrack = sAud;
      }
    }
  }

  if (videoTrack) pc.addTrack(videoTrack, localStream);
  if (audioTrack) pc.addTrack(audioTrack, localStream);

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

  // Berlakukan mirror (scaleX(-1)) untuk semua video peserta (lokal maupun remote)
  video.style.transform = 'scaleX(-1)';

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

  allVideoBoxes.push({ id: peerId || 'local', element: box });
  videoGrid.appendChild(box);

  updatePagination();
  if (local) initFocus(video, status);
}

/* =================================================
   PAGINATION LOGIC
================================================= */
function updatePagination() {
  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');
  const itemsPerPage = window.innerWidth <= 768 ? 6 : 9;

  const isSharing = document.body.classList.contains('sharing-active');
  const presentationBox = document.getElementById('presentationBox');

  let totalPages = Math.ceil(allVideoBoxes.length / itemsPerPage) || 1;
  if (isSharing) {
    totalPages += 1; // Page 1 is the screen share presentation
  }

  if (currentPage > totalPages) currentPage = totalPages;

  if (isSharing) {
    if (currentPage === 1) {
      if (presentationBox) presentationBox.style.display = '';
      allVideoBoxes.forEach(b => { b.element.style.display = 'none'; });
      videoGrid.className = 'layout-1';
    } else {
      if (presentationBox) presentationBox.style.display = 'none';
      const startIndex = (currentPage - 2) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      let visibleCount = 0;
      allVideoBoxes.forEach((b, index) => {
        if (index >= startIndex && index < endIndex) {
          b.element.style.display = '';
          visibleCount++;
        } else {
          b.element.style.display = 'none';
        }
      });
      videoGrid.className = `layout-${visibleCount}`;
    }
  } else {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    let visibleCount = 0;
    allVideoBoxes.forEach((b, index) => {
      if (index >= startIndex && index < endIndex) {
        b.element.style.display = '';
        visibleCount++;
      } else {
        b.element.style.display = 'none';
      }
    });
    videoGrid.className = `layout-${visibleCount}`;
  }

  if (totalPages > 1) {
    if (prevBtn) prevBtn.style.display = currentPage > 1 ? 'flex' : 'none';
    if (nextBtn) nextBtn.style.display = currentPage < totalPages ? 'flex' : 'none';
  } else {
    if (prevBtn) prevBtn.style.display = 'none';
    if (nextBtn) nextBtn.style.display = 'none';
  }
}

document.getElementById('prevPageBtn')?.addEventListener('click', () => {
  if (currentPage > 1) { currentPage--; updatePagination(); }
});
document.getElementById('nextPageBtn')?.addEventListener('click', () => {
  const itemsPerPage = window.innerWidth <= 768 ? 6 : 9;
  let totalPages = Math.ceil(allVideoBoxes.length / itemsPerPage) || 1;
  if (document.body.classList.contains('sharing-active')) {
    totalPages += 1;
  }
  if (currentPage < totalPages) { currentPage++; updatePagination(); }
});

window.addEventListener('resize', updatePagination);

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
  let presentation = document.getElementById('presentationBox');
  if (!presentation) {
    presentation = document.createElement('div');
    presentation.className = 'presentation-container';
    presentation.id = 'presentationBox';
    videoGrid.insertBefore(presentation, videoGrid.firstChild);
  }

  if (screenVideo) {
    presentation.innerHTML = '';
    presentation.appendChild(screenVideo);
  }

  currentPage = 1;
  updatePagination();
}

function deactivateShareLayout() {
  const sharingId = currentSharingPeerId;
  currentSharingPeerId = null;
  document.body.classList.remove('sharing-active');

  const pb = document.getElementById('presentationBox');
  if (pb) pb.remove();

  if (currentPage > 1) currentPage--;

  updatePagination();
}

function stopScreenShare() {
  const camTrack = localStream.getVideoTracks()[0];
  const origMicTrack = localStream.getAudioTracks()[0];

  for (let id in peers) {
    const vidSender = peers[id].pc.getSenders().find(s => s.track?.kind === 'video');
    if (vidSender) vidSender.replaceTrack(camTrack);

    const audSender = peers[id].pc.getSenders().find(s => s.track?.kind === 'audio');
    if (audSender) audSender.replaceTrack(origMicTrack);
  }

  if (screenStream) screenStream.getTracks().forEach(t => t.stop());
  screenStream = null;

  if (window.micSource) { window.micSource.disconnect(); window.micSource = null; }
  if (window.sysSource) { window.sysSource.disconnect(); window.sysSource = null; }

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

  const CALIB_FRAMES = 30; // 3.0 detik kalibrasi (pada 10 FPS)
  const EAR_BLINK_RATIO = 0.75;
  const GAZE_TOLERANCE = 0.25;
  const YAW_TOLERANCE = 0.35;
  const PITCH_TOLERANCE = 0.08; // Diperketat agar sensitif terhadap tundukan kepala
  const VERTICAL_GAZE_TOLERANCE = 0.15; // Toleransi untuk bola mata naik/turun

  let calibDone = false;
  let calibCount = 0;
  let earSum = 0, gazeSum = 0, yawSum = 0, pitchSum = 0, vGazeSum = 0;
  let earThreshold = 0.20;
  let gazeCenter = 0.50;
  let yawCenter = 0.50;
  let pitchCenter = 0.50;
  let vGazeCenter = 0.50;

  // Anti-flicker / false positive logic
  let consecutiveEyesClosed = 0;
  let consecutiveNotFocused = 0;
  let consecutiveNoFace = 0;
  let consecutiveFocusing = 0;

  const EYES_CLOSED_FRAMES = 5;  // ~0.5s mata tertutup (mengabaikan kedipan normal)
  const NOT_FOCUSED_FRAMES = 8;  // ~0.8s tidak fokus/melihat ke arah lain
  const NO_FACE_FRAMES = 5;      // ~0.5s tidak ada wajah terdeteksi
  const FOCUSING_FRAMES = 2;      // ~0.2s kembali fokus untuk memulihkan status

  let lastReportedStatus = 'Calibrating...';

  function safeUpdateStatus(newStatus, color) {
    if (lastReportedStatus !== newStatus) {
      lastReportedStatus = newStatus;
      updateAndBroadcastStatus(status, newStatus, color);
    }
  }

  status.innerHTML = 'Calibrating...';
  status.style.color = '#fbbc04';

  faceMesh.onResults(res => {
    if (!res.multiFaceLandmarks?.length) {
      if (calibDone) {
        consecutiveNoFace++;
        consecutiveFocusing = 0;
        if (consecutiveNoFace >= NO_FACE_FRAMES) {
          safeUpdateStatus('Tidak ada Wajah', 'orange');
        }
      }
      return;
    }

    consecutiveNoFace = 0;
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

    // Kalkulasi Pitch (atas/bawah kepala)
    const topFace = lm[10];
    const bottomFace = lm[152];
    const dTop = Math.abs(noseTip.y - topFace.y);
    const dBot = Math.abs(noseTip.y - bottomFace.y);
    const pitch = dTop / (dTop + dBot);

    // Kalkulasi Vertical Gaze (bola mata atas/bawah)
    const vGaze = (
      (lm[468].y - lm[159].y) / (lm[145].y - lm[159].y) +
      (lm[473].y - lm[386].y) / (lm[374].y - lm[386].y)
    ) / 2;

    if (!calibDone) {
      earSum += ear; gazeSum += gaze; yawSum += yaw; pitchSum += pitch; vGazeSum += vGaze;
      calibCount++;
      const pct = Math.round((calibCount / CALIB_FRAMES) * 100);
      status.innerHTML = `Calibrating ${pct}%`;
      status.style.color = '#fbbc04';
      if (calibCount >= CALIB_FRAMES) {
        earThreshold = (earSum / CALIB_FRAMES) * EAR_BLINK_RATIO;
        gazeCenter = gazeSum / CALIB_FRAMES;
        yawCenter = yawSum / CALIB_FRAMES;
        pitchCenter = pitchSum / CALIB_FRAMES;
        vGazeCenter = vGazeSum / CALIB_FRAMES;
        calibDone = true;
      }
      return;
    }

    let currentStatus = 'Focusing';

    if (ear < earThreshold) {
      currentStatus = 'Eyes Closed';
    } else if (yaw < yawCenter - YAW_TOLERANCE || yaw > yawCenter + YAW_TOLERANCE) {
      currentStatus = 'Not Focused';
    } else if (pitch < pitchCenter - PITCH_TOLERANCE || pitch > pitchCenter + PITCH_TOLERANCE) {
      currentStatus = 'Not Focused';
    } else if (gaze < gazeCenter - GAZE_TOLERANCE || gaze > gazeCenter + GAZE_TOLERANCE) {
      currentStatus = 'Not Focused';
    } else if (vGaze < vGazeCenter - VERTICAL_GAZE_TOLERANCE || vGaze > vGazeCenter + VERTICAL_GAZE_TOLERANCE) {
      currentStatus = 'Not Focused';
    }

    if (currentStatus === 'Eyes Closed') {
      consecutiveEyesClosed++;
      consecutiveNotFocused = 0;
      consecutiveFocusing = 0;
      if (consecutiveEyesClosed >= EYES_CLOSED_FRAMES) {
        safeUpdateStatus('Tidak Memperhatikan', '#f28b82');
      }
    } else if (currentStatus === 'Not Focused') {
      consecutiveNotFocused++;
      consecutiveEyesClosed = 0;
      consecutiveFocusing = 0;
      if (consecutiveNotFocused >= NOT_FOCUSED_FRAMES) {
        safeUpdateStatus('Tidak Memperhatikan', '#f28b82');
      }
    } else {
      consecutiveFocusing++;
      consecutiveEyesClosed = 0;
      consecutiveNotFocused = 0;
      if (consecutiveFocusing >= FOCUSING_FRAMES) {
        safeUpdateStatus('Memperhatikan', '#81c995');
      }
    }
  });

  let lastProcessedTime = 0;
  const PROCESS_INTERVAL_MS = 100; // Batasi pemanggilan model FaceMesh maksimal 10 FPS (100ms sekali)

  async function processVideo() {
    try {
      const track = localStream.getVideoTracks()[0];
      if (track?.enabled && video.readyState === 4 && video.videoWidth > 0) {
        const now = Date.now();
        if (now - lastProcessedTime >= PROCESS_INTERVAL_MS) {
          lastProcessedTime = now;
          await faceMesh.send({ image: video });
        }
      } else if (!track?.enabled) {
        safeUpdateStatus('Kamera Mati', '#808080');
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
    box.innerHTML = `<strong><i class="fas fa-exclamation-triangle"></i> ${users.join(', ')} tidak memperhatikan.</strong>`;
  } else {
    box.style.display = 'none';
  }
}

let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('toastNotif');
  if (!toast) return;
  toast.innerHTML = `<i class="fas fa-info-circle"></i> ${msg}`;
  toast.style.display = 'block';

  // Restart animation
  toast.style.animation = 'none';
  toast.offsetHeight; /* trigger reflow */
  toast.style.animation = null;

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.style.display = 'none';
  }, 3000);
}

/* =================================================
   FPS COUNTER
================================================= */
let lastFrameTime = performance.now();
let frameCount = 0;
const fpsCounter = document.getElementById('fpsCounter');

function measureFPS() {
  const now = performance.now();
  frameCount++;
  if (now >= lastFrameTime + 1000) {
    const fps = Math.round((frameCount * 1000) / (now - lastFrameTime));
    if (fpsCounter) {
      fpsCounter.innerText = `FPS: ${fps}`;
    }
    frameCount = 0;
    lastFrameTime = now;
  }
  requestAnimationFrame(measureFPS);
}
measureFPS();