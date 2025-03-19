require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const stripe = require('stripe')(process.env.STRIPE_PRIVATE_KEY);
const multer = require('multer');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json()); // Replaces bodyParser.json() for consistency

// Sample JSON data for item selection
const selectItems = [
  { articleId: '1ght', name: 'Laptop', price: 999.99 },
  { articleId: '2ght', name: 'Mouse', price: 24.99 },
  { articleId: '3ght', name: 'Keyboard', price: 59.99 }
];

// Payment items (unchanged from priceselection server)
const paymentItems = {
  "item1": { price: 1500, name: "Product A" },
  "item2": { price: 2000, name: "Product B" },
  "item3": { price: 2500, name: "Product C" },
  "item4": { price: 3000, name: "Product D" },
  "item5": { price: 3500, name: "Product E" }
};

// Multer storage configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname); // Keep original filename and extension
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 7 * 1024 * 1024 * 1024 }, // 7GB max
  fileFilter: (req, file, cb) => {
    const fileType = req.body.fileType;
    const ext = path.extname(file.originalname).toLowerCase();
    if (fileType === 'mp3' && ext !== '.mp3') {
      return cb(new Error('File must be an MP3'));
    }
    if (fileType === 'mp4' && ext !== '.mp4') {
      return cb(new Error('File must be an MP4'));
    }
    cb(null, true);
  }
});

// API endpoint to fetch selection items
app.get('/api/items', (req, res) => {
  res.json(selectItems);
});

// POST endpoint to receive articleIds and calculate total price
app.post('/api/total', (req, res) => {
  const selectedArticleIds = JSON.parse(req.body.articleIds); // Parse JSON string of articleIds
  let totalPrice = 0;

  selectedArticleIds.forEach(id => {
    const item = selectItems.find(item => item.articleId === id);
    if (item) {
      totalPrice += item.price;
    }
  });

  console.log(`Total Price: $${totalPrice.toFixed(2)}`);
  res.status(200).send(`Total Price: $${totalPrice.toFixed(2)}`);
});

// Payment Intent Route
app.post('/create-payment-intent', async (req, res) => {
  try {
    const { firstName, lastName, items: selectedItems, paymentMethodId } = req.body;
    let totalAmount = 0;
    if (selectedItems == undefined) {
      totalAmount = 1000000;
    } else {
      totalAmount = selectedItems.reduce((sum, item) => sum + (paymentItems[item]?.price || 0), 0);
    }
    if (totalAmount === 0) {
      return res.status(400).send({ error: "Invalid item selection" });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: 'usd',
      payment_method: paymentMethodId,
      confirmation_method: 'manual',
      confirm: true,
      return_url: 'http://localhost:3000/success.html'
    });

    res.json({ clientSecret: paymentIntent.client_secret, redirectUrl: '/success.html' });
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: err.message });
  }
});

// File Upload Route
app.post('/upload', upload.single('file'), (req, res) => {
  try {
    const fileType = req.body.fileType;
    const fileSize = req.file.size;

    const maxSizeMp3 = 5 * 1024 * 1024 * 1024; // 5GB
    const maxSizeMp4 = 7 * 1024 * 1024 * 1024; // 7GB
    const maxSize = fileType === 'mp3' ? maxSizeMp3 : maxSizeMp4;

    if (fileSize > maxSize) {
      return res.status(400).json({ error: `File exceeds ${fileType === 'mp3' ? '5GB' : '7GB'} limit` });
    }

    res.json({ message: `File ${req.file.originalname} uploaded successfully! Size: ${(fileSize / (1024 * 1024)).toFixed(2)}MB` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Explicit Routes
app.get('/payment.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'payment.html'));
});

app.get('/update.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'update.html'));
});

app.get('/success.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'success.html'));
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server running on port ${process.env.PORT || 3000}`);
});