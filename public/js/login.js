// /js/login.js
function login() {
  // Use window.API_URL
  const apiUrl = window.API_URL;
  
  if (!apiUrl) {
    alert("Configuration Error: API_URL not found!");
    return;
  }

  const code = document.getElementById("securityCode").value.trim();
  const loginBtn = document.getElementById("submitLoginBtn");
  const errorMessage = document.getElementById("errorMessage");

  if (!code) {
    console.error("No security code provided.");
    return;
  }

  loginBtn.disabled = true;
  loginBtn.innerHTML = `Logging in...`; // Simplified for testing

  fetch(`${apiUrl}?action=verifySecurityCode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'verifySecurityCode', code: code })
  })
  .then(res => res.json())
  .then(response => {
    if (response && response.success === true) {
      localStorage.setItem('adminLoggedIn', 'true');
      window.location.href = "/admin/dashboard";
    } else {
      throw new Error("Invalid Credentials");
    }
  })
  .catch((err) => {
    console.error("Login Error:", err);
    loginBtn.disabled = false;
    loginBtn.innerHTML = "LOGIN";
    errorMessage.classList.remove('hidden');
  });
}
