
function login() {
  const apiUrl = window.API_URL || "/api/proxy"; 
  const code = document.getElementById("securityCode").value.trim();
  const loginBtn = document.getElementById("submitLoginBtn");
  const errorMessage = document.getElementById("errorMessage");
  const originalText = loginBtn.innerHTML;

  if (!code) {
    console.error("No security code provided.");
    return;
  }

  loginBtn.disabled = true;
  loginBtn.innerHTML = `<div class="animate-spin inline-block rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2 align-middle"></div>Logging in...`;
  errorMessage.classList.add('hidden');

  // Perform secure fetch request
  fetch(`${apiUrl}?action=verifySecurityCode`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ 
      action: 'verifySecurityCode',
      code: code 
    })
  })
  .then(res => res.json())
  .then(response => {
    if (response && response.success === true) {
      // Success: Redirect to dashboard
      localStorage.setItem('adminLoggedIn', 'true');
      window.location.href = "/admin/dashboard";
    } else {
      throw new Error("Invalid credentials");
    }
  })
  .catch((err) => {
    console.error("Login Error:", err);
    
    // Reset button state
    loginBtn.disabled = false;
    loginBtn.innerHTML = originalText;
    
    // Show error message
    errorMessage.classList.remove('hidden');
  });
}

// Attach Event Listeners to DOM elements
document.addEventListener('DOMContentLoaded', () => {
  const loginBtn = document.getElementById("submitLoginBtn");
  const inputField = document.getElementById("securityCode");

  // Handle Button Click
  if (loginBtn) {
    loginBtn.addEventListener("click", login);
  }

  // Handle "Enter" Key press in input field
  if (inputField) {
    inputField.addEventListener("keypress", function(event) {
      if (event.key === "Enter") {
        event.preventDefault();
        login();
      }
    });
  }
});
