const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3002;

app.use(cors());
app.use(express.json());

app.post('/api/chat', async (req, res) => {
  console.log('Simple chat endpoint called');
  res.json({ message: "Simple test response", timestamp: new Date().toISOString() });
});

app.post('/api/budget/set', async (req, res) => {
  console.log('Simple budget endpoint called:', req.body);
  res.json({ success: true, budget: req.body });
});

app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
});