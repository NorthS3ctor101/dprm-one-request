function showInlineError(msg) {
  const errDiv = document.getElementById('errorMessage');
  const errText = document.getElementById('errorMessageText');
  
  if (errDiv) {
    if (errText) {
      errText.textContent = msg;
    } else {
      errDiv.textContent = msg;
    }
    errDiv.classList.remove('hidden');
  }
}

function login() {
  const apiUrl = window.API_URL || "/api/proxy"; 
  const code = document.getElementById("securityCode")?.value.trim();
  const loginBtn = document.getElementById("submitLoginBtn");
  const errorMessage = document.getElementById("errorMessage");
  
  if (!loginBtn) return;

  const originalText = loginBtn.innerHTML;

  if (!code) {
    showInlineError("Access code is required to proceed.");
    return;
  }

  loginBtn.disabled = true;
  loginBtn.innerHTML = `<div class="animate-spin inline-block rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2 align-middle"></div>Logging in...`;
  if (errorMessage) errorMessage.classList.add('hidden');

  fetch(`${apiUrl}?action=verifySecurityCode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      action: 'verifySecurityCode',
      code: code 
    })
  })
  .then(res => res.json())
  .then(response => {
    if (response && response.success === true) {
      localStorage.setItem('adminLoggedIn', 'true');
      window.location.href = "/admin/dashboard";
    } else {
      throw new Error("Invalid credentials");
    }
  })
  .catch((err) => {
    loginBtn.disabled = false;
    loginBtn.innerHTML = originalText;
    
    showInlineError("Access Denied: Invalid security credentials");
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const loginBtn = document.getElementById("submitLoginBtn");
  const inputField = document.getElementById("securityCode");

  if (loginBtn) {
    loginBtn.addEventListener("click", login);
  } else {
    console.error("CRITICAL: 'submitLoginBtn' not found in DOM.");
  }

  if (inputField) {
    inputField.addEventListener("keypress", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        login();
      }
    });
  }
});
