document.addEventListener('DOMContentLoaded', function () {
  const submitForm = document.getElementById('submitForm');
  const submitButton = submitForm.querySelector('button[type="submit"]');
  const trackForm = document.getElementById('trackForm');
  const trackResult = document.getElementById('trackResult');
  const tagsInput = document.getElementById('tagsInput');
  const addTagBtn = document.getElementById('addTagBtn');
  
  let customDocs = [];
  let activeTrackingCode = "";

  function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
  function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
  
  document.querySelectorAll('.closeModal, .modal-backdrop').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const activeModal = e.target.closest('.modal-container');
      
      if (activeModal && e.target.classList.contains('modal-backdrop')) {
        if (activeModal.id === 'trackingModal' || activeModal.id === 'feedbackModal') {
          return;
        }
      }

      if (activeModal) activeModal.classList.add('hidden');
    });
  });

  document.getElementById('submitBtn').addEventListener('click', () => openModal('submitModal'));
  document.getElementById('trackBtn').addEventListener('click', () => openModal('trackModal'));

  document.getElementById('ctaSurveyBtn').addEventListener('click', () => {
    closeModal('trackingModal');
    openModal('feedbackModal');
  });

fetch(`${API_URL}?action=getRegions`)
    .then(res => res.json())
    .then(regions => {

      if (!Array.isArray(regions)) {
        console.error("Backend did not return an array. Received:", regions);
        return;
      }

      const regionSelect = document.getElementById('region');
      regions.forEach(region => {
        const option = document.createElement('option');
        option.value = region;
        option.textContent = region;
        regionSelect.appendChild(option);
      });
    }).catch(err => console.error("Error fetching regions:", err));

  document.getElementById('region').addEventListener('change', function() {
    const selectedRegion = this.value;
    const unitSelect = document.getElementById('jailUnitOffice');
    unitSelect.innerHTML = '<option>Loading...</option>';

    if (selectedRegion) {
      fetch(`${API_URL}?action=getUnitsByRegion&region=${encodeURIComponent(selectedRegion)}`)
        .then(res => res.json())
        .then(units => {
          unitSelect.innerHTML = '';
          if (units.length > 0) {
            units.forEach(unit => {
              const option = document.createElement('option');
              option.value = unit;
              option.textContent = unit;
              unitSelect.appendChild(option);
            });
          } else {
            unitSelect.innerHTML = '<option>No units found</option>';
          }
        }).catch(() => { unitSelect.innerHTML = '<option>Error loading units</option>'; });
    } else {
      unitSelect.innerHTML = '<option>Select Region first</option>';
    }
  });

  document.getElementById('docOthers').addEventListener('change', function() {
    const tagsWrapper = document.getElementById('tagsWrapper');
    if (this.checked) {
      tagsWrapper.classList.remove('hidden');
    } else {
      tagsWrapper.classList.add('hidden');
      clearTags();
    }
  });

  function addTagFromInput() {
    const value = tagsInput.value.replace(/,/g, '').trim();
    if (value && !customDocs.includes(value)) {
      customDocs.push(value);
      addTag(value);
      tagsInput.value = '';
    }
  }

  tagsInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addTagFromInput(); } });
  tagsInput.addEventListener('keyup', (e) => { if (e.key === ',') addTagFromInput(); });
  addTagBtn.addEventListener('click', addTagFromInput);

  function addTag(text) {
    const tagEl = document.createElement('div');
    tagEl.className = 'inline-flex items-center bg-slate-100 border border-slate-200 text-slate-700 rounded-lg px-2.5 py-1 text-xs font-medium gap-1.5';
    tagEl.innerHTML = `${text} <span class="hover:text-red-500 font-bold text-sm cursor-pointer" data-tag="${text}">&times;</span>`;
    tagEl.querySelector('span').addEventListener('click', () => removeTag(text));
    document.getElementById('tagsList').appendChild(tagEl);
  }

  function removeTag(text) {
    customDocs = customDocs.filter(tag => tag !== text);
    document.getElementById('tagsList').innerHTML = '';
    customDocs.forEach(addTag);
  }

  function clearTags() { customDocs = []; document.getElementById('tagsList').innerHTML = ''; }

  function getRequestedDocuments() {
    let selectedDocs = [];
    document.querySelectorAll('input[name="requestedDocument"]:checked').forEach(doc => {
      if (doc.value !== "Others") selectedDocs.push(doc.value);
    });
    customDocs.forEach(doc => selectedDocs.push("Other: " + doc));
    return selectedDocs.join(", ");
  }

  function showFormError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.id = 'formError';
    errorDiv.className = 'bg-red-50 text-red-700 border border-red-200 rounded-xl p-4 text-sm font-medium my-3';
    errorDiv.innerText = message;
    submitForm.insertBefore(errorDiv, submitForm.firstChild);
    errorDiv.scrollIntoView({ behavior: 'smooth' });
  }

  submitForm.addEventListener('submit', function (e) {
    e.preventDefault();
    const existingError = document.getElementById('formError');
    if (existingError) existingError.remove();
    let hasError = false;

    if (parseInt(submitForm.numberCopies.value, 10) < 1 || parseInt(submitForm.numberCopies.value, 10) > 5) {
      showFormError("Number of Copies must be between 1 and 5.");
      hasError = true;
    }
    if (document.querySelectorAll('input[name="requestedDocument"]:checked').length === 0) {
      showFormError("Please select at least one document in 'Requested Document(s)'.");
      hasError = true;
    }
    if (document.getElementById('docOthers').checked && customDocs.length === 0) {
      showFormError("Please add at least one custom document for 'Others'.");
      hasError = true;
    }

    const firstAppointmentVal = submitForm.dateFirstAppointment.value;
    if (firstAppointmentVal) {
      const dateApp = new Date(firstAppointmentVal);
      if (dateApp > new Date()) { showFormError("Date of First Appointment cannot exceed current date."); hasError = true; }
      if (dateApp < new Date('1990-01-01')) { showFormError("Date of First Appointment cannot be less than 1990."); hasError = true; }
    }

    if (hasError) return;
    const clientType = document.querySelector('input[name="typeOfClient"]:checked')?.value;
    let nameToAutoFill = "";
    
    if (clientType === "Others") {
      nameToAutoFill = document.getElementById('clientFullName').value.trim();
    } else {
      nameToAutoFill = document.getElementById('rankFullName').value.trim();
    }

    const reqSubmitBtn = document.getElementById('requestSubmitBtn');
    const reqSpinner = document.getElementById('requestBtnSpinner');
    const reqText = document.getElementById('requestBtnText');

    if (reqSubmitBtn) reqSubmitBtn.disabled = true;
    if (reqSpinner) reqSpinner.classList.remove('hidden');
    if (reqText) reqText.innerText = "Submitting...";

    const formDataObj = {
      typeOfClient: clientType || "",
      requestedDocument: getRequestedDocuments(),
      numberCopies: submitForm.numberCopies.value,
      purpose: submitForm.purpose.value,
      clientFullName: document.getElementById('clientFullName').value.trim(),
      rankFullName: document.getElementById('rankFullName').value.trim(),
      region: document.getElementById('region').value,
      jailUnitOffice: document.getElementById('jailUnitOffice').value,
      dateFirstAppointment: submitForm.dateFirstAppointment.value,
      dateRetirementSeparation: submitForm.dateRetirementSeparation.value || "",
      notes: submitForm.notes.value || ""
    };

    fetch(`${API_URL}?action=submitRequest`, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formDataObj) 
    })
      .then(res => res.json())
      .then(result => {
        if (reqSubmitBtn) reqSubmitBtn.disabled = false;
        if (reqSpinner) reqSpinner.classList.add('hidden');
        if (reqText) reqText.innerText = "Submit Request";
        
        activeTrackingCode = result.trackingNumber || result.referenceCode;
        
        const codeDisplay = document.getElementById('trackingNumber');
        if (codeDisplay) {
          codeDisplay.innerText = activeTrackingCode || "ERROR GENERATING CODE";
        }
        
        closeModal('submitModal');
        submitForm.reset();
        clearTags();

        const surveyNameInput = document.querySelector('#surveyForm input[name="name"]');
        if (surveyNameInput) {
          surveyNameInput.value = nameToAutoFill;
          surveyNameInput.readOnly = true;
          
          surveyNameInput.className = "w-full border border-slate-200 bg-slate-100 text-slate-500 rounded-xl px-4 py-2.5 focus:outline-none cursor-not-allowed font-medium";
        }

        openModal('trackingModal');
      })
      .catch(err => {
        if (reqSubmitBtn) reqSubmitBtn.disabled = false;
        if (reqSpinner) reqSpinner.classList.add('hidden');
        if (reqText) reqText.innerText = "Submit Request";
        alert("Error: " + err.message);
      });
  });

  trackForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const trackingNumber = trackForm.querySelector('input[name="trackingNumber"]').value.trim();
    trackResult.innerHTML = '<div class="flex justify-center my-4"><div class="animate-spin rounded-full h-6 w-6 border-2 border-emerald-500 border-t-transparent"></div></div>';
    
    document.getElementById('receivedBtn').classList.add('hidden');

    fetch(`${API_URL}?action=trackRequest&trackingNumber=${encodeURIComponent(trackingNumber)}`)
      .then(res => res.json())
      .then(response => {
        if (!response.found) {
          trackResult.innerHTML = `<div class="bg-red-50 text-red-700 p-4 rounded-xl text-sm font-medium border border-red-100">Reference Number not found.</div>`;
        } else {
          let html = '<h6 class="font-bold text-slate-900 mb-3 text-sm tracking-wide uppercase">Request Status:</h6><div class="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden bg-slate-50/30">';
          
          response.requests.forEach(req => {
            let pillClass = 'bg-slate-100 text-slate-700';
            const statusLower = req.status.toLowerCase();
            
            if (statusLower === 'pending' || statusLower === 'on process') {
              pillClass = 'bg-amber-100 text-amber-800 border border-amber-200/50';
            } else if (statusLower === 'ready for release') {
              pillClass = 'bg-emerald-100 text-emerald-800 border border-emerald-200/50';
            } else if (statusLower === 'completed' || statusLower === 'received') {
              pillClass = 'bg-blue-100 text-blue-800 border border-blue-200/50';
            }

            html += `<div class="p-4 bg-white">
              <div class="flex justify-between items-center mb-1.5 gap-4">
                <span class="font-semibold text-slate-900 text-sm leading-tight">${req.document}</span>
                <span class="px-2.5 py-1 text-[11px] font-bold rounded-md tracking-wide uppercase ${pillClass}">${req.status}</span>
              </div>
              <p class="text-xs text-slate-400">${req.remarks || '<span class="italic opacity-50">No remarks yet</span>'}</p>
            </div>`;
          });
          html += '</div>';
          trackResult.innerHTML = html;
        }
      });
  });

  document.getElementById("surveyForm").addEventListener("submit", function(e) {
    e.preventDefault();
    const ageField = this.querySelector('input[name="age"]');
    const ageValue = ageField ? ageField.value.trim() : "";
    
    if (!ageValue || parseInt(ageValue, 10) < 13) {
      alert("Please provide a valid age before submitting.");
      if (ageField) ageField.focus();
      return;
    }

    const survSubmitBtn = document.getElementById('surveySubmitBtn');
    const survSpinner = document.getElementById('surveyBtnSpinner');
    const survText = document.getElementById('surveyBtnText');

    if (survSubmitBtn) survSubmitBtn.disabled = true;
    if (survSpinner) survSpinner.classList.remove('hidden');
    if (survText) survText.innerText = "Submitting Feedback...";

    const formData = Object.fromEntries(new FormData(this));
    formData.trackingNumber = activeTrackingCode || "NEW_SUBMISSION_SURVEY";

    fetch(`${API_URL}?action=saveSurveyResponse`, { method: 'POST', body: JSON.stringify(formData) })
      .then(res => res.json())
      .then(() => {
        if (survSubmitBtn) survSubmitBtn.disabled = false;
        if (survSpinner) survSpinner.classList.add('hidden');
        if (survText) survText.innerText = "Submit Survey";

        closeModal('feedbackModal');
        document.getElementById("surveyForm").reset();

        const surveyNameInput = document.querySelector('#surveyForm input[name="name"]');
        if (surveyNameInput) {
          surveyNameInput.readOnly = false;
          surveyNameInput.className = "w-full border border-slate-300 rounded-xl px-4 py-2.5 focus:outline-none";
        }
        
        openModal('successModal');
      })
      .catch(err => {
        if (survSubmitBtn) survSubmitBtn.disabled = false;
        if (survSpinner) survSpinner.classList.add('hidden');
        if (survText) survText.innerText = "Submit Survey";
        alert("Error finishing transaction steps: " + err.message);
      });
  });

  const clientTypeRadios = document.querySelectorAll('input[name="typeOfClient"]');
  function toggleClientFields() {
    const selected = document.querySelector('input[name="typeOfClient"]:checked')?.value;
    if (!selected) return;

    const cField = document.getElementById('clientFullNameField');
    const rField = document.getElementById('rankFullNameField');
    const cInput = document.getElementById('clientFullName');
    const rInput = document.getElementById('rankFullName');
    const dateFirst = document.querySelector('input[name="dateFirstAppointment"]').closest('div');
    const retirement = document.getElementById('retirementField');

    if (selected === 'Others') {
      cField.classList.remove('hidden'); rField.classList.add('hidden');
      cInput.setAttribute('required', 'required'); rInput.removeAttribute('required');
      dateFirst.classList.add('hidden'); retirement.classList.add('hidden');
      dateFirst.querySelector('input').required = false; retirement.querySelector('input').required = false;
    } else {
      cField.classList.add('hidden'); rField.classList.remove('hidden');
      rInput.setAttribute('required', 'required'); cInput.removeAttribute('required');
      dateFirst.classList.remove('hidden'); dateFirst.querySelector('input').required = true;
      
      if (selected === 'Retired/Separated Personnel') {
        retirement.classList.remove('hidden'); retirement.querySelector('input').required = true;
      } else {
        retirement.classList.add('hidden'); retirement.querySelector('input').required = false;
      }
    }
  }

  const ageInput = document.querySelector('#surveyForm input[name="age"]');
  if (ageInput) {
    ageInput.setAttribute('type', 'text');
    ageInput.setAttribute('inputmode', 'numeric');
    
    ageInput.addEventListener('input', function() {
      this.value = this.value.replace(/\D/g, '');
      
      if (this.value.length > 2) {
        this.value = this.value.slice(0, 2);
      }
    });
  }

  clientTypeRadios.forEach(r => r.addEventListener('change', toggleClientFields));
  toggleClientFields();
});