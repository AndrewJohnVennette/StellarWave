require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const stripe = require('stripe')(process.env.STRIPE_PRIVATE_KEY);
const multer = require('multer');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// Sample JSON data for item selection with boxCheck
const selectItems = [
  { articleId: '1ght', name: 'Laptop', price: 999.99, boxCheck: false },
  { articleId: '2ght', name: 'Mouse', price: 24.99, boxCheck: false },
  { articleId: '3ght', name: 'Keyboard', price: 59.99, boxCheck: false }
];

// Payment items (unchanged)
// const paymentItems = {
//   "item1": { price: 1500, name: "Product A" },
//   "item2": { price: 2000, name: "Product B" },
//   "item3": { price: 2500, name: "Product C" },
//   "item4": { price: 3000, name: "Product D" },
//   "item5": { price: 3500, name: "Product E" }
// };

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 7 * 1024 * 1024 * 1024 },
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

app.get('/api/items', (req, res) => {
  res.json(selectItems);
});

app.post('/api/total', (req, res) => {
  const selectedArticleIds = JSON.parse(req.body.articleIds);
  let totalPrice = 0;

  selectedArticleIds.forEach(id => {
    const item = selectItems.find(item => item.articleId === id);
    if (item) {
      totalPrice += item.price;
    }
  });

  console.log(`Total Price: $${totalPrice.toFixed(2)}`);
  res.status(200).json({ totalAmount: totalPrice * 100 }); // Convert to cents for Stripe
});

app.post('/create-payment-intent', async (req, res) => {
  try {
        const { firstName, lastName, items: selectedItems, paymentMethodId, totalAmount } = req.body;
        let amount = totalAmount || 0;

        if (!totalAmount && selectedItems) {
          amount = selectedItems.reduce((sum, item) => sum + (paymentItems[item]?.price || 0), 0);
        }
        if (amount === 0) {
          return res.status(400).send({ error: "Invalid item selection or total amount" });
        }

        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: 'usd',
          payment_method: paymentMethodId,
          confirmation_method: 'manual',
          confirm: true,
          //return_url: 'http://localhost:3000/selectedOption.html' // Updated redirect
          // return_url: '/selectedOption.html'
          return_url: `${req.protocol}://${req.get('host')}/selectedOption.html` // Dynamic URL
        });

        res.json({ clientSecret: paymentIntent.client_secret, redirectUrl: '/selectedOption.html' });
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: err.message });
      }
});

app.post('/upload', upload.single('file'), (req, res) => {
  try {
    const fileType = req.body.fileType;
    const fileSize = req.file.size;

    const maxSizeMp3 = 5 * 1024 * 1024 * 1024;
    const maxSizeMp4 = 7 * 1024 * 1024 * 1024;
    const maxSize = fileType === 'mp3' ? maxSizeMp3 : maxSizeMp4;

    if (fileSize > maxSize) {
      return res.status(400).json({ error: `File exceeds ${fileType === 'mp3' ? '5GB' : '7GB'} limit` });
    }

    res.json({ message: `File ${req.file.originalname} uploaded successfully! Size: ${(fileSize / (1024 * 1024)).toFixed(2)}MB` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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