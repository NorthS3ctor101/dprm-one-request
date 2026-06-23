const sessionStartTime = new Date().getTime();

const channel = new BroadcastChannel('new-request-channel');

channel.onmessage = (e) => { 
  console.log("Channel message received:", e.data);
  if (!e.data) return;

  if (e.data.type === "NEW_PENDING_REQUEST") {
    showNotification(e.data.message); 
  } else if (e.data.type === "CLIENT_FOLLOWUP") {
    triggerFollowupUI(e.data.message);
  }
  
  if (document.hidden) {
    unreadCount++;
    updateTabBadge();
  }
};

let allData = [];
let requestMap = {};
let currentPage = 1;
let rowsPerPage = 10;
let previousPendingCount = null;
let filteredData = [];
let selectedRowIndex = null;
let unreadCount = 0;


function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function setupModalClosers() {
  document.querySelectorAll('.closeModal, .modal-backdrop').forEach(b => {
    b.addEventListener('click', (e) => { 
      const m = e.target.closest('.modal-container'); 
      if (m) m.classList.add('hidden'); 
    });
  });
}

function createRow(row) {
  const tr = document.createElement("tr");
  tr.className = "hover:bg-slate-50/70 transition-colors border-b border-slate-100";
  tr.id = `row-${row.index}`;

  const status = row.status ? row.status.toString().toUpperCase().trim() : "ON PROCESS";
  const isCompleted = (status === 'COMPLETED');
  
  const pillClass = isCompleted 
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
    : 'bg-amber-50 text-amber-700 border-amber-200';

  const disabledAttr = isCompleted ? 'disabled' : '';
  const btnOpacity = isCompleted ? 'opacity-30 cursor-not-allowed' : 'hover:bg-slate-100 cursor-pointer';

  let rawDate = row.dateAndTime || row.timestamp || row.dateRequested || row.date || row.dateTime || "";
  let displayTime = rawDate ? new Date(rawDate).toLocaleString() : "-";
  
  let displayProcTime = (row.processingTime === "Invalid Start Time" || !row.processingTime) 
                        ? "-" 
                        : row.processingTime;

  tr.innerHTML = `
    <td class="px-6 py-4 font-bold text-slate-900">${row.trackingNumber || '-'}</td>
    <td class="px-6 py-4 whitespace-nowrap text-xs text-slate-400">${displayTime}</td>
    <td class="px-6 py-4 font-semibold text-slate-800">${row.nameOfPersonnel || row.clientFullName || '-'}</td>
    <td class="px-6 py-4 text-slate-500">${row.region || '-'}</td>
    <td class="px-6 py-4 max-w-xs truncate text-slate-600">${row.requestedDocuments || row.requestedDocument || '-'}</td>
    <td class="px-6 py-4 text-slate-500">${row.purpose || '-'}</td>
    <td class="px-6 py-4 font-medium text-slate-700">${displayProcTime}</td>
    <td class="px-6 py-4 whitespace-nowrap">
      <span class="inline-block px-3 py-1 text-xs font-bold rounded-full border ${pillClass}">${status}</span>
    </td>
    <td class="px-6 py-4 whitespace-nowrap text-center">
      <div class="inline-flex gap-1.5">
        <button class="followup-btn text-red-600 bg-red-50 border border-red-200 p-2 rounded-xl transition-all ${btnOpacity}" 
                data-index="${row.index}" ${disabledAttr}>
          <span class="fas fa-bell"></span>
        </button>
        <button class="survey-btn text-amber-600 bg-amber-50 border border-amber-200 p-2 rounded-xl hover:bg-amber-100 cursor-pointer" data-index="${row.index}">
          <span class="fas fa-poll"></span>
        </button>
        <button class="view-btn text-cyan-600 bg-cyan-50 border border-cyan-200 p-2 rounded-xl hover:bg-cyan-100 cursor-pointer" data-index="${row.index}">
          <span class="fas fa-eye"></span>
        </button>
        <button class="release-btn text-green-600 bg-green-50 border border-green-200 p-2 rounded-xl transition-all ${btnOpacity}" 
                data-index="${row.index}" ${disabledAttr}>
          <span class="fas fa-check"></span>
        </button>
      </div>
    </td>
  `;
  return tr;
}

function initializeData() {
  fetch(`${API_URL}?action=getRequestedDocuments`)
    .then(res => res.json())
    .then(data => {
      if (!Array.isArray(data)) {
        console.error("Expected array, received:", data);
        return;
      }
      
      allData = data.sort((a, b) => parseInt(b.index, 10) - parseInt(a.index, 10));
      
      previousPendingCount = allData.filter(r => {
        const stat = r.status ? r.status.toUpperCase().trim() : "";
        return stat === "PENDING" || stat === "ON PROCESS";
      }).length;
      
      filterTable();
      checkNotificationPermissionState();
      setInterval(loadRequestedDocuments, 10000);
    }).catch(err => {
      console.error("Database connection error:", err);
      document.getElementById("requestBody").innerHTML = "<tr><td colspan='10' class='text-center text-red-500 py-6 font-medium'>Error loading request streams. Please check API connection.</td></tr>";
    });
}

function loadRequestedDocuments() {
  fetch(`${API_URL}?action=getRequestedDocuments`)
    .then(res => res.json())
    .then(data => {
      if (!Array.isArray(data)) return;
      
      const sortedData = data.sort((a, b) => parseInt(b.index, 10) - parseInt(a.index, 10));
      
      if (allData.length !== sortedData.length || (sortedData[0] && JSON.stringify(sortedData[0]) !== JSON.stringify(allData[0]))) {
        allData = sortedData; 
        filterTable(); 
      }
      
      const currentProcessCount = sortedData.filter(r => (r.status || "").toUpperCase().trim() === "ON PROCESS").length;
      
      if (previousPendingCount !== null && currentProcessCount > previousPendingCount) {
        const deltaCount = currentProcessCount - previousPendingCount;
        const msg = `${deltaCount} new document request(s) received.`;
        
        showNotification(msg); 
        triggerSystemDesktopBubble(deltaCount); 
        
        channel.postMessage({ type: "NEW_PENDING_REQUEST", message: msg });

        if (document.hidden) {
          unreadCount += deltaCount;
          updateTabBadge();
        }
      }
      previousPendingCount = currentProcessCount;

      fetch(`${API_URL}?action=getLatestFollowup`)
      .then(res => res.json())
      .then(response => {
    if (response && response.message) {
      const mySentId = localStorage.getItem("lastSentFollowupId"); 
      const lastAcknowledgedId = localStorage.getItem("lastAcknowledgedFollowupId");
      
      const msgTime = new Date(response.timestamp).getTime();
      
      if (response.id !== mySentId && response.id !== lastAcknowledgedId && msgTime > sessionStartTime) {
        triggerFollowupUI(response.message);
        localStorage.setItem("lastAcknowledgedFollowupId", response.id);
      }
    }
  });
    })
    .catch(err => console.error("Error loading documents:", err));
}

function checkNotificationPermissionState() {
  const banner = document.getElementById('permissionBanner');
  if (!("Notification" in window) || Notification.permission === "granted") {
    banner.classList.add('hidden');
  } else if (Notification.permission !== "denied") {
    banner.classList.remove('hidden');
  }
}

window.requestDesktopNotificationPermission = function() {
  if ("Notification" in window) {
    Notification.requestPermission().then(permission => {
      if (permission === "granted") {
        console.log("Desktop notification pipeline authorized.");
      }
      checkNotificationPermissionState();
    });
  }
};

function triggerSystemDesktopBubble(newCount) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("DPRM OneRequest Portal Alerts", {
      body: `Notice: ${newCount} new client request queue allocations appended to dashboard stream tracking registers.`,
      icon: "https://i.imgur.com/98MR8ae.png"
    });
  }
}

function showNotification(msg) {
  document.getElementById('toastMessage').textContent = msg;
  document.getElementById('pendingToast').classList.remove('hidden');
  
  const sfx = document.getElementById("notificationSound");
  if (sfx) {
    sfx.currentTime = 0;
    sfx.play().catch(e => console.warn("Browser audio execution block context alert:", e));
  }
}

function updateTabBadge() {
  if (document.hidden && unreadCount > 0) {
    document.title = `(${unreadCount}) DPRM-OneRequest Tracker`;
  } else {
    unreadCount = 0;
    document.title = "DPRM-OneRequest Tracker";
  }
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    updateTabBadge();
  }
});

function renderPage() {
  const tbody = document.getElementById("requestBody");
  tbody.innerHTML = "";
  
  const start = (currentPage - 1) * rowsPerPage;
  const end = start + rowsPerPage;
  const pageData = filteredData.slice(start, end);

  if (pageData.length === 0) {
    tbody.innerHTML = "<tr><td colspan='10' class='text-center text-slate-950 py-6 font-medium'>There are no ongoing requests at the moment.</td></tr>";
    document.getElementById("currentPage").textContent = "1";
    document.getElementById("totalPages").textContent = "1";
    document.getElementById("totalRequest").textContent = "0";
    return;
  }

  pageData.forEach(row => {
    requestMap[row.index] = row;
    const tr = createRow(row);
    tbody.appendChild(tr);
  });

  document.getElementById("currentPage").textContent = currentPage;
  document.getElementById("totalPages").textContent = Math.ceil(filteredData.length / rowsPerPage) || 1;
  document.getElementById("totalRequest").textContent = filteredData.length;
}

window.viewDetails = function(rowIndex) {
  const row = requestMap[rowIndex];
  if (!row) return;

  const formatUI = (val) => {
    if (!val || val === "N/A" || val === "" || val === "null" || val === "undefined") return "-";

    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      const d = new Date(val + "T00:00:00"); 
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    }
  
    const d = new Date(val);
    return isNaN(d.getTime()) ? "-" : d.toLocaleDateString(undefined, { 
      year: 'numeric', month: 'short', day: 'numeric', 
      hour: '2-digit', minute: '2-digit' 
    });
  };
  const overlay = document.getElementById("loadingOverlay");
  const tbody = document.getElementById("detailsTableBody");

  tbody.innerHTML = ""; 
  overlay.classList.remove('hidden');
  openModal('viewDetailsModal');

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      fetch(`${API_URL}?action=getRequestDetails&trackingNumber=${encodeURIComponent(row.trackingNumber)}&requestedDocument=${encodeURIComponent(row.requestedDocuments || row.requestedDocument || '')}`)
        .then(res => res.json())
        .then(d => {
          const targetRows = [
            ["Reference Number", d.trackingNumber, "font-bold text-emerald-600 text-base"],
            ["Date of Requested", formatUI(d.dateAndTime)],
            ["Type of Client", d.typeOfClient],
            ["Requested Documents", d.requestedDocuments || d.requestedDocument, "font-semibold text-slate-900"],
            ["Number of Copies", d.copies || d.numberCopies],
            ["Purpose", d.purpose],
            ["Client Name", d.nameOfPersonnel || d.clientFullName, "font-medium text-slate-900"],
            ["Region Assignment", d.region],
            ["Unit/Office", d.jailUnitOffice],
            ["Date of First Appointment", formatUI(d.dateFirstAppointment)],
            ["Date of Separation", formatUI(d.dateRetirementSeparation)],
            ["Client Notes", d.notes, "italic text-slate-400"],
            ["Processor", d.preparedBy],
            ["Completion Timestamp", formatUI(d.dateAndTimeCompleted)],
            ["Processing Time", d.processingTime],
            ["Processor Comments", d.remarks],
            ["Status", d.status, "font-bold text-blue-700"]
          ];

          tbody.innerHTML = targetRows.map(r => `
            <tr class="hover:bg-slate-50/50">
              <th class="w-1/3 bg-slate-50/80 font-semibold text-slate-400 text-xs uppercase tracking-wider text-right pr-4 py-3 border-r border-slate-100">${r[0]}</th>
              <td class="px-5 py-3 ${r[2] || 'text-slate-700'}">${r[1] || '-'}</td>
            </tr>
          `).join("");
          
          overlay.classList.add('hidden');
        })
        .catch((err) => {
          overlay.classList.add('hidden');
          console.error("Error:", err);
          tbody.innerHTML = `<tr><td colspan="2" class="text-center text-red-500 py-6">Error loading details.</td></tr>`;
        });
    });
  });
};

window.viewSurvey = function(rowIndex) {
  const row = requestMap[rowIndex];
  const tbody = document.getElementById("surveyTableBody");
  const overlay = document.getElementById("loadingOverlay");
  
  overlay.classList.remove('hidden');
  openModal('surveyModal');

  fetch(`${API_URL}?action=getSurveyByTracking&trackingNumber=${encodeURIComponent(row.trackingNumber)}`)
    .then(res => res.json())
     .then(d => {
    overlay.classList.add('hidden');
    if (!d.found) {
      tbody.innerHTML = "<tr><td colspan='2' class='text-center py-4 text-slate-500 italic'>No survey submitted.</td></tr>";
    } else {
      const docList = d.requestedDocsList || "Not specified";
      
      let html = `
        <tr class="bg-blue-50 border-b border-blue-100">
          <th class="px-4 py-3 text-right text-xs text-blue-800 uppercase font-bold">Documents Requested</th>
          <td class="px-4 py-3 text-sm font-semibold text-blue-900">${docList}</td>
        </tr>
      `;
        
        html += Object.entries(d.surveyData).map(([key, val]) => `
          <tr class="hover:bg-slate-50 border-b border-slate-50">
            <th class="px-4 py-2 text-right text-xs text-slate-400 uppercase">${key}</th>
            <td class="px-4 py-2 text-sm text-slate-700">${val || '-'}</td>
          </tr>
        `).join("");
        
        tbody.innerHTML = html;
      }
    })
    .catch(err => {
      overlay.classList.add('hidden');
      console.error("Survey Fetch Error:", err);
    });
};

window.markAsReleased = function(rowIndex) {
  const row = requestMap[rowIndex];
  if (!row) return;

  const status = row.status ? row.status.toString().toUpperCase().trim() : "";
  if (status !== "ON PROCESS") {
    alert("Authorization denied: Only requests 'ON PROCESS' can be marked as completed.");
    return;
  }

  selectedRowIndex = rowIndex;
  fetch(`${API_URL}?action=getPreparedByList`)
    .then(res => res.json())
    .then(names => {
      const s = document.getElementById("preparedBySelect");
      s.innerHTML = '<option value="">-- Select Name --</option>';
      names.forEach(n => { 
        const o = document.createElement("option"); 
        o.value = n; o.textContent = n; 
        s.appendChild(o); 
      });
      document.getElementById("preparedByError").classList.add('hidden');
      openModal('preparedByModal');
    });
};

window.submitPreparedBy = function() {
  const n = document.getElementById("preparedBySelect").value;
  const rem = document.getElementById("remarksInput").value.trim();
  const btn = document.getElementById("preparedBySubmitBtn");

  if (!n) { document.getElementById("preparedByError").classList.remove('hidden'); return; }
  document.getElementById("preparedByError").classList.add('hidden');
  
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<div class="animate-spin inline-block rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2 align-middle"></div>Updating...`;
  
  fetch(`${API_URL}?action=markAsReleasedWithPreparedBy`, { 
    method: 'POST', 
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ 
      action: 'markAsReleasedWithPreparedBy',
      rowIndex: parseInt(selectedRowIndex, 10), 
      preparedBy: n, 
      remarks: rem 
    }) 
  })
    .then(res => res.json())
    .then(updated => {
      closeModal('preparedByModal'); 
      btn.disabled = false; 
      btn.innerHTML = originalHtml;
      document.getElementById("remarksInput").value = "";
      
      const idx = allData.findIndex(item => parseInt(item.index, 10) === parseInt(selectedRowIndex, 10));
      if (idx !== -1) {
        allData[idx] = updated;
      }

      filterTable();
    })
    .catch((err) => {
      console.error("Completion update tracking fault:", err);
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    });
};

window.previousPage = function() { if (currentPage > 1) { currentPage--; renderPage(); } };
window.nextPage = function() { if (currentPage * rowsPerPage < filteredData.length) { currentPage++; renderPage(); } };

function filterTable() {
  const i = document.getElementById("searchInput").value.toLowerCase();
  const filter = document.getElementById("statusFilter").value.toUpperCase().trim();
  
  filteredData = allData.filter(r => {
    const status = r.status ? r.status.toUpperCase().trim() : "";
    const matchesSearch = (r.trackingNumber?.toLowerCase().includes(i) || 
                          r.nameOfPersonnel?.toLowerCase().includes(i));
    
    const matchesStatus = (filter === "ALL" || status === filter);
    
    return matchesSearch && matchesStatus;
  });
  
  renderPage();
}

window.generateReport = function() {
  const yr = new Date().getFullYear();
  document.getElementById("reportYearInput").value = yr;
  document.getElementById("reportYear").textContent = yr;
  openModal('reportModal'); 
  fetchReportData();
};

window.fetchReportData = function() {
  const btn = document.getElementById("generateReportBtn");
  const yr = document.getElementById("reportYearInput").value;
  const tbody = document.querySelector("#reportTable tbody");;
  
  if (btn) {
    btn.disabled = true;
  }
  tbody.innerHTML = `<tr><td colspan="14" class="text-center text-slate-400 py-6">Compiling...</td></tr>`;

  fetch(`${API_URL}?action=getInchargeReportData&year=${yr}`)
    .then(res => res.json())
    .then(data => {
      if (btn) btn.disabled = false;
      
      tbody.innerHTML = "";
      if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="14" class="text-center py-6 text-slate-400">No data found.</td></tr>`;
      } else {
        data.forEach(r => {
          const tr = document.createElement("tr");
          tr.className = "hover:bg-slate-50 transition-colors font-medium";
          tr.innerHTML = `<td class="px-4 py-3 text-left font-semibold text-slate-900">${r.name}</td>${r.months.map(m => `<td>${m}</td>`).join("")}<td class="font-bold text-blue-700">${r.total}</td>`;
          tbody.appendChild(tr);
        });
      }
      document.getElementById("reportYear").textContent = yr;
    })
    .catch(err => {
      if (btn) btn.disabled = false;
      console.error(err);
    });
};

window.logout = function() { 
  localStorage.removeItem('adminLoggedIn'); 
  window.location.href = "/admin"; 
};

document.addEventListener('DOMContentLoaded', () => {
  setupModalClosers();
  initializeData();

  const addListener = (id, event, handler) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, handler);
  };

  addListener("reportBtn", "click", generateReport);
  addListener("logoutBtn", "click", logout);
  addListener("enableNotifBtn", "click", requestDesktopNotificationPermission);
  addListener("prevPageBtn", "click", previousPage);
  addListener("nextPageBtn", "click", nextPage);
  addListener("generateReportBtn", "click", fetchReportData);
  addListener("preparedBySubmitBtn", "click", submitPreparedBy);
  addListener("closeToastBtn", "click", () => document.getElementById('pendingToast').classList.add('hidden'));

  addListener("searchInput", "input", filterTable);
  addListener("statusFilter", "change", () => { currentPage = 1; filterTable(); });
  addListener("rowsPerPage", "change", function() { rowsPerPage = parseInt(this.value, 10); currentPage = 1; filterTable(); });

document.getElementById("requestsTable")?.addEventListener("click", (e) => {
  const target = e.target.closest("button");
  if (!target) return;

  const index = target.dataset.index;
  if (!index) return;

  if (target.classList.contains("followup-btn")) {
    handleFollowup(index); 
  } else if (target.classList.contains("survey-btn")) {
    viewSurvey(index);
  } else if (target.classList.contains("view-btn")) {
    viewDetails(index);
  } else if (target.classList.contains("release-btn")) {
    const originalContent = target.innerHTML;
    target.disabled = true;
    target.innerHTML = `<span class="animate-spin fas fa-spinner"></span>`;
    
    markAsReleased(index);
    
    setTimeout(() => {
      target.disabled = false;
      target.innerHTML = originalContent;
    }, 1000);
  }
});

function handleFollowup(index) {
  const row = requestMap[index];
  if (!confirm(`Send follow-up notification for Tracker #${row.trackingNumber}?`)) return;

  const btn = document.querySelector(`button.followup-btn[data-index="${index}"]`);
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="animate-spin fas fa-spinner"></span>`;

  const trackingNumber = row.trackingNumber;
  const requester = row.nameOfPersonnel || row.clientFullName || "N/A";
  const docs = row.requestedDocuments ? row.requestedDocuments.split(",").map(d => d.trim()) : [];
  const docName = docs[4] || docs[0] || "N/A";
  const followUpMsg = `TRACKER #: ${trackingNumber}\nREQUESTER: ${requester}\n\nRequested Document: ${docName}`;
  const clickId = Date.now().toString();

  fetch(`${API_URL}?action=sendFollowup&trackingNumber=${encodeURIComponent(trackingNumber)}&id=${encodeURIComponent(clickId)}&message=${encodeURIComponent(followUpMsg)}`)
    .then(res => res.json())
    .then(() => {
      localStorage.setItem("lastSentFollowupId", clickId);
      btn.innerHTML = `<span class="fas fa-check text-green-600"></span>`;
      
      document.getElementById('toastMessage').textContent = "Success: Follow-up transmitted.";
      document.getElementById('pendingToast').classList.remove('hidden');
      setTimeout(() => document.getElementById('pendingToast').classList.add('hidden'), 3000);

      setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
      }, 2000);
    })
    .catch(err => {
      console.error("Follow-up failed:", err);
      btn.disabled = false;
      btn.innerHTML = originalHtml;
      alert("Transmission failed.");
    });
}

  if (localStorage.getItem('adminLoggedIn') !== 'true') window.location.href = "/admin";
});


document.getElementById('chatToggleBtn').addEventListener('click', () => {
  document.getElementById('chatModal').classList.toggle('hidden');
  loadMessages();
});

document.getElementById('sendChatBtn').addEventListener('click', () => {
  const name = document.getElementById('chatName').value;
  const msg = document.getElementById('chatMsg').value;
  if (!name || !msg) return alert("Please enter name and message.");

  fetch(`${API_URL}?action=saveChatMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'saveChatMessage', name: name, message: msg })
  }).then(() => {
    document.getElementById('chatMsg').value = "";
    loadMessages();
  });
});

function loadMessages() {
  fetch(`${API_URL}?action=getChatMessages`)
    .then(res => res.json())
    .then(data => {
      const box = document.getElementById('chatBox');
      box.innerHTML = data.map(m => `
        <div class="bg-white p-2 rounded-lg shadow-sm border">
          <div class="font-bold text-[10px] text-blue-600">${m.name}</div>
          <div class="text-xs text-slate-700">${m.message}</div>
        </div>
      `).join("");
      box.scrollTop = box.scrollHeight;
    });
}

setInterval(loadMessages, 15000);


function triggerFollowupUI(msg) {
  const modal = document.getElementById('followupModal');
  const content = document.getElementById('followupContent');
  const modalBox = modal.querySelector('.animate-vibrate');

  content.style.whiteSpace = "pre-line";
  
  content.textContent = (typeof msg === 'object') ? (msg.message || "") : msg;
  modal.classList.remove('hidden');
  
  if (modalBox) {
    setTimeout(() => {
      modalBox.classList.remove('animate-vibrate');
    }, 3000);
  }
  
  const sfx = document.getElementById("notificationSound");
  if (sfx) sfx.play().catch(e => console.warn("Audio play blocked", e));
}

function setViewHeight() {
  let vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}

window.addEventListener('resize', setViewHeight);
setViewHeight();
