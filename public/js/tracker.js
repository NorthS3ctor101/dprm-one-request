let allData = [];
let requestMap = {};
let currentPage = 1;
let rowsPerPage = 10;
let previousPendingCount = null;
let filteredData = [];
let selectedRowIndex = null;
let unreadCount = 0;

const channel = new BroadcastChannel('new-request-channel');
channel.onmessage = (e) => { 
  if (e.data && e.data.type === "NEW_PENDING_REQUEST") {
    showNotification(e.data.message); 
    
    if (document.hidden) {
      unreadCount++;
      updateTabBadge();
    }
  } 
};

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

  const currentStatus = row.status ? row.status.toString().toUpperCase().trim() : "";
  const isCompleted = (currentStatus === 'COMPLETED');
  const isProcess = (currentStatus === 'ON PROCESS');
  
  let pillClass = isProcess ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200';

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
      <span class="inline-block px-3 py-1 text-xs font-bold rounded-full border ${pillClass}">${row.status || 'PENDING'}</span>
    </td>
    <td class="px-6 py-4 whitespace-nowrap text-center">
      <div class="inline-flex gap-1.5">
        <button class="view-btn text-cyan-600 bg-cyan-50 border border-cyan-200 p-2 rounded-xl" data-index="${row.index}">
          <span class="fas fa-eye"></span>
        </button>
        <button class="release-btn text-green-600 bg-green-50 border border-green-200 p-2 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed" 
                data-index="${row.index}" 
                ${isCompleted ? 'disabled' : ''}>
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
      const currentPendingCount = sortedData.filter(r => {
        const stat = r.status ? r.status.toUpperCase().trim() : "";
        return stat === "PENDING" || stat === "ON PROCESS";
      }).length;
      
      if (JSON.stringify(sortedData) !== JSON.stringify(allData)) {
        allData = sortedData; 
        filterTable(); 
      }
      
      if (previousPendingCount !== null && currentPendingCount > previousPendingCount) {
        const deltaCount = currentPendingCount - previousPendingCount;
        const msg = `${deltaCount} new document request(s) received.`;
        
        showNotification(msg); 
        triggerSystemDesktopBubble(deltaCount); 
        channel.postMessage({ type: "NEW_PENDING_REQUEST", message: msg });

        if (document.hidden) {
          unreadCount += deltaCount;
          updateTabBadge();
        }
      }
      previousPendingCount = currentPendingCount;
    });
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
    const viewBtn = e.target.closest(".view-btn");
    const relBtn = e.target.closest(".release-btn");
    
    if (viewBtn) {
      viewDetails(viewBtn.dataset.index);
    }
    
    if (relBtn) {
      const originalContent = relBtn.innerHTML;
      relBtn.disabled = true;
      relBtn.innerHTML = `<span class="animate-spin fas fa-spinner"></span>`;
      
      markAsReleased(relBtn.dataset.index);
      
      setTimeout(() => {
        relBtn.disabled = false;
        relBtn.innerHTML = originalContent;
      }, 1000); 
    }
  });

  if (localStorage.getItem('adminLoggedIn') !== 'true') window.location.href = "/admin";
});

function setViewHeight() {
  let vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}

window.addEventListener('resize', setViewHeight);
setViewHeight();
