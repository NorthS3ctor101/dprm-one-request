document.addEventListener('DOMContentLoaded', () => {
  const queueBody = document.getElementById('queueBody');

  function fetchQueueData() {
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
            <td class="text-center text-red-600 text-xl font-bold">
              <i class="fas fa-exclamation-triangle mr-2"></i> Connection Lost. Retrying link...
            </td>
          </tr>`;
      });
  }

  function renderQueue(requests) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDate = now.getDate();

    let processedList = requests.filter(item => {
      if (!item.dateAndTime) return false;
      
      const itemDate = new Date(item.dateAndTime);
      
      const isToday = itemDate.getFullYear() === currentYear &&
                      itemDate.getMonth() === currentMonth &&
                      itemDate.getDate() === currentDate;
                      
      const currentStatus = (item.status || "").toUpperCase().trim();
      
      return isToday && (currentStatus === "ON PROCESS" || currentStatus === "COMPLETED" || currentStatus === "READY FOR RELEASE");
    });

    if (processedList.length === 0) {
      queueBody.innerHTML = `
        <tr class="h-full flex items-center justify-center flex-grow">
          <td class="text-center text-slate-400 text-xl italic font-medium">
            No active document requests recorded on the system database today.
          </td>
        </tr>`;
      return;
    }

    processedList.sort((a, b) => parseInt(b.index, 10) - parseInt(a.index, 10));

    processedList.sort((a, b) => {
      const statusA = (a.status || "").toUpperCase().trim();
      const statusB = (b.status || "").toUpperCase().trim();
      
      if (statusA === "COMPLETED" && statusB !== "COMPLETED") return 1;
      if (statusA !== "COMPLETED" && statusB === "COMPLETED") return -1;
      return 0;
    });

    const displayLimitList = processedList.slice(0, 10);
    queueBody.innerHTML = "";

    displayLimitList.forEach(item => {
      const tr = document.createElement('tr');
      tr.className = "flex items-center text-left py-4 px-6 flex-grow transition-all duration-300 hover:bg-slate-50";
      
      const statusText = (item.status || "ON PROCESS").toUpperCase().trim();
      
      let pillColors = "bg-amber-100 text-amber-800 border border-amber-200 animate-pulse";
      if (statusText === "COMPLETED") {
        pillColors = "bg-blue-100 text-blue-800 border border-blue-200";
      } else if (statusText === "READY FOR RELEASE") {
        pillColors = "bg-emerald-100 text-emerald-800 border border-emerald-200";
      }

      tr.innerHTML = `
        <td class="w-1/4 font-black tracking-wider text-[#1d3557] text-3xl font-mono">${item.trackingNumber || '---'}</td>
        <td class="w-1/2 text-slate-700 font-bold text-2xl truncate pr-4">${item.requestedDocuments || item.requestedDocument || '---'}</td>
        <td class="w-1/4 flex justify-center">
          <span class="px-6 py-2 rounded-xl text-lg font-black tracking-widest text-center uppercase ${pillColors} min-w-[220px] shadow-xs">
            ${statusText}
          </span>
        </td>
      `;
      queueBody.appendChild(tr);
    });
  }

  function updateClock() {
    const now = new Date();
    document.getElementById('liveClock').textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    document.getElementById('liveDate').textContent = now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }
  
  updateClock();
  setInterval(updateClock, 1000);
  fetchQueueData();
  setInterval(fetchQueueData, 8000); // Poll tracking system source every 8 seconds
});
