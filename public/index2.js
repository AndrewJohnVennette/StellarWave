// Initialize Stripe with your public key
var stripe = Stripe('pk_test_51QkE43C1UqQhFhw44FBwsaPxexyTd3KbAAdIkEf1eWCsBtdKk4FTQ04JQil8zGQ3BMkFTsIW34zpO4ICVGeXOdgm001REg2tXE');

// Create an instance of Elements
var elements = stripe.elements();

// Define a style object to match your custom design
var style = {
  base: {
    fontSize: '16px',
    color: '#32325d',
    fontFamily: 'Arial, sans-serif',
    '::placeholder': {
      color: '#aab7c4'
    }
  },
  invalid: {
    color: '#fa755a'
  }
};

// Create a card element and mount it into the #card-element div
var card = elements.create('card', { style: style });
card.mount('#card-element');

// Listen for form submission
document.getElementById('payment-form').addEventListener('submit', async function(event) {
  event.preventDefault();

  // Create a PaymentMethod using the card element
  const { paymentMethod, error } = await stripe.createPaymentMethod({
    type: 'card',
    card: card
  });

  if (error) {
    // Display error message if any
    document.getElementById('card-errors').textContent = error.message;
  } else {
    // Send the PaymentMethod ID to your server to create a PaymentIntent
    const response = await fetch('/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentMethodId: paymentMethod.id })
    });

    const data = await response.json();
    if (data.error) {
      document.getElementById('card-errors').textContent = data.error;
    } else {
      // On success, redirect to the success page
      window.location.href = data.redirectUrl;
    }
  }
});
