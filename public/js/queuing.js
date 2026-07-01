document.addEventListener('DOMContentLoaded', () => {
  const queueBody = document.getElementById('queueBody');

  // Initialize Real-time Data Sync Stream 
  function fetchQueueData() {
    // API_URL maps directly from your system proxy layers inside config.js
    fetch(`${API_URL}?action=getRequestedDocuments`)
      .then(res => res.json())
      .then(data => {
        if (!Array.isArray(data)) {
          console.error("Queue system parsing failure:", data);
          return;
        }
        renderQueue(data);
      })
      .catch(err => {
        console.error("Queue synchronization terminal broken:", err);
        queueBody.innerHTML = `
          <tr class="h-full flex items-center justify-center">
            <td class="text-center text-red-500 text-xl font-bold">
              <i class="fas fa-exclamation-triangle mr-2"></i> Connection Lost. Retrying link...
            </td>
          </tr>`;
      });
  }

  function renderQueue(requests) {
    // Parse timestamp matching to local operational system time (YYYY-MM-DD format)
    const todayStr = new Date().toISOString().split('T')[0];

    // Filter rules: Only today's records + explicitly (ON PROCESS, COMPLETED, READY FOR RELEASE)
    let processedList = requests.filter(item => {
      if (!item.dateAndTime) return false;
      
      const itemDateStr = new Date(item.dateAndTime).toISOString().split('T')[0];
      const currentStatus = (item.status || "").toUpperCase().trim();
      
      return itemDateStr === todayStr && (currentStatus === "ON PROCESS" || currentStatus === "COMPLETED" || currentStatus === "READY FOR RELEASE");
    });

    if (processedList.length === 0) {
      queueBody.innerHTML = `
        <tr class="h-full flex items-center justify-center flex-grow">
          <td class="text-center text-slate-500 text-xl italic font-medium">
            No document requests recorded on the system database today.
          </td>
        </tr>`;
      return;
    }

    // Sort strategy: Sort descending by row index (most recent entry first)
    processedList.sort((a, b) => parseInt(b.index, 10) - parseInt(a.index, 10));

    // Priority sort: Render 'ON PROCESS' / 'READY FOR RELEASE' ahead of 'COMPLETED'
    processedList.sort((a, b) => {
      const statusA = (a.status || "").toUpperCase().trim();
      const statusB = (b.status || "").toUpperCase().trim();
      
      if (statusA === "COMPLETED" && statusB !== "COMPLETED") return 1;
      if (statusA !== "COMPLETED" && statusB === "COMPLETED") return -1;
      return 0;
    });

    // Enforce strict output viewing layout constraint (limit up to 10 entries)
    const displayLimitList = processedList.slice(0, 10);
    queueBody.innerHTML = "";

    displayLimitList.forEach(item => {
      const tr = document.createElement('tr');
      tr.className = "flex items-center text-left py-4 px-6 flex-grow transition-all duration-300 hover:bg-slate-900/20";
      
      const statusText = (item.status || "ON PROCESS").toUpperCase().trim();
      
      let pillColors = "bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse";
      if (statusText === "COMPLETED") {
        pillColors = "bg-blue-500/10 text-blue-400 border border-blue-500/30";
      } else if (statusText === "READY FOR RELEASE") {
        pillColors = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30";
      }

      tr.innerHTML = `
        <td class="w-1/4 font-black tracking-wider text-slate-200 text-3xl font-mono">${item.trackingNumber || '---'}</td>
        <td class="w-1/2 text-slate-300 font-semibold text-2xl truncate pr-4">${item.requestedDocuments || item.requestedDocument || '---'}</td>
        <td class="w-1/4 flex justify-center">
          <span class="px-6 py-2 rounded-xl text-lg font-black tracking-widest text-center uppercase ${pillColors} min-w-[200px]">
            ${statusText}
          </span>
        </td>
      `;
      queueBody.appendChild(tr);
    });
  }

  // Live High Visibility Board Clock Handler
  function updateClock() {
    const now = new Date();
    document.getElementById('liveClock').textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    document.getElementById('liveDate').textContent = now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  // Active Intervals Loop
  updateClock();
  setInterval(updateClock, 1000);
  fetchQueueData();
  setInterval(fetchQueueData, 8000); // Poll tracking source array records every 8 seconds
});
