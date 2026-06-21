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
      headers: { 'Content-Type': 'application/json' }
    };
    
    if (req.method !== 'GET' && req.body) {
      const bodyData = { ...req.body };
      if (req.query.action) {
        bodyData.action = req.query.action;
      }
      fetchOptions.body = JSON.stringify(bodyData);
    }
    
    const response = await fetch(targetUrl.toString(), fetchOptions);
    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/admin/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'tracker.html'));
});

app.use((req, res) => {
  res.status(404).send('<h1>404 Asset Resource Matrix Not Found</h1>');
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`\nDPRM-OneRequest Environment Active`);
    console.log(`Client Workspace:   http://localhost:${PORT}`);
    console.log(`Admin Gateway:      http://localhost:${PORT}/admin\n`);
  });
}

module.exports = app;
