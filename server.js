require('dotenv').config();

const express = require('express');
const path = require('path');
const app = express();

app.disable('x-powered-by');

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/proxy', async (req, res) => {
  const gasUrl = process.env.API_URL;

  if (!gasUrl) {
    return res.status(500).json({ success: false, error: "System Environment Configuration Missing" });
  }

  try {
    const targetUrl = new URL(gasUrl);
    
    Object.keys(req.query).forEach(key => {
      targetUrl.searchParams.set(key, req.query[key]);
    });

    const fetchOptions = {
      method: req.method,
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      redirect: 'follow' 
    };
    
    if (req.method !== 'GET' && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }
    
    const response = await fetch(targetUrl.toString(), fetchOptions);

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const errorText = await response.text();
      console.error("Upstream returned non-JSON:", errorText);
      return res.status(502).json({ success: false, error: "Upstream server returned invalid format." });
    }

    const data = await response.json();
    return res.status(response.status).json(data);

  } catch (error) {
    console.error("Proxy execution error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/admin/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'tracker.html')));

app.use((req, res) => {
  res.status(404).send('<h1>404 Resource Not Found</h1>');
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`DPRM-OneRequest Active on http://localhost:${PORT}`);
  });
}

module.exports = app;
