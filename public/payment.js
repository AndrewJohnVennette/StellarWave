// Initialize Stripe with your public API key
var stripe = Stripe('pk_test_51QkE43C1UqQhFhw44FBwsaPxexyTd3KbAAdIkEf1eWCsBtdKk4FTQ04JQil8zGQ3BMkFTsIW34zpO4ICVGeXOdgm001REg2tXE');
var elements = stripe.elements();

var style = {
  base: {
    fontSize: '16px',
    color: '#fff',
    fontFamily: '"Poppins", sans-serif',
    '::placeholder': { color: 'rgba(255, 255, 255, 0.7)' }
  },
  invalid: { color: '#fa755a' }
};

// Create and mount individual Stripe elements
var cardNumber = elements.create('cardNumber', { style: style });
cardNumber.mount('#cardNumber');

var cardExpiry = elements.create('cardExpiry', { style: style });
cardExpiry.mount('#expDate');

var cardCvc = elements.create('cardCvc', { style: style });
cardCvc.mount('#CVC');

// Track field completion states
let cardNumberFilled = false;
let expDateFilled = false;
let cvcFilled = false;

// Function to update flip state
function updateFlipState() {
  const cardName = document.getElementById('cardName').value.trim();
  const container = document.querySelector('.container');
  const frontFieldsFilled = cardNumberFilled && cardName !== '' && expDateFilled;

  if (frontFieldsFilled && !cvcFilled && !container.classList.contains('flipped')) {
    container.classList.add('flipped');
  } else if (frontFieldsFilled && cvcFilled && container.classList.contains('flipped')) {
    container.classList.remove('flipped');
  } else if (!frontFieldsFilled && container.classList.contains('flipped')) {
    container.classList.remove('flipped');
  }
}

// Event listeners for Stripe elements
cardNumber.on('change', (event) => {
  cardNumberFilled = event.complete;
  document.getElementById('card-errors').textContent = event.error ? event.error.message : '';
  updateFlipState();
});

cardExpiry.on('change', (event) => {
  expDateFilled = event.complete;
  document.getElementById('card-errors').textContent = event.error ? event.error.message : '';
  updateFlipState();
});

cardCvc.on('change', (event) => {
  cvcFilled = event.complete;
  document.getElementById('card-errors').textContent = event.error ? event.error.message : '';
  updateFlipState();
});

// Event listener for cardName
document.getElementById('cardName').addEventListener('input', () => {
  updateFlipState();
});

// Form submission with Stripe and product selection
document.getElementById('payment-form').addEventListener('submit', async function(event) {
  event.preventDefault();

  const selectedItems = Array.from(document.querySelectorAll('input[name="items"]:checked'))
    .map(item => item.value);

  // Check if items are selected
  if (selectedItems.length === 0) {
    document.getElementById('card-errors').textContent = 'Please select at least one product to proceed.';
    return; // Stop submission
  }

  const cardName = document.getElementById('cardName').value.trim();

  // Regex to extract firstName (before first space) and lastName (after last space)
  const firstNameMatch = cardName.match(/^[^ ]+/);
  const lastNameMatch = cardName.match(/[^ ]+$/);

  const firstName = firstNameMatch ? firstNameMatch[0] : 'Unknown';
  const lastName = lastNameMatch ? lastNameMatch[0] : 'Unknown';

  const { paymentMethod, error } = await stripe.createPaymentMethod({
    type: 'card',
    card: cardNumber,
    billing_details: {
      name: cardName
    }
  });

  if (error) {
    document.getElementById('card-errors').textContent = error.message;
  } else {
    try {
      const response = await fetch('http://localhost:3000/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethodId: paymentMethod.id,
          items: selectedItems,
          firstName: firstName,
          lastName: lastName
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server responded with status: ${response.status}`);
      }

      const data = await response.json();
      if (data.error) {
        document.getElementById('card-errors').textContent = data.error;
      } else {
        window.location.href = data.redirectUrl;
      }
    } catch (fetchError) {
      document.getElementById('card-errors').textContent = `Payment failed: ${fetchError.message}`;
      console.error('Fetch error:', fetchError);
    }
  }
});