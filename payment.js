document.addEventListener('DOMContentLoaded', function () {
  // Initialize Stripe
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

  var cardNumber = elements.create('cardNumber', { style: style });
  cardNumber.mount('#cardNumber');

  var cardExpiry = elements.create('cardExpiry', { style: style });
  cardExpiry.mount('#expDate');

  var cardCvc = elements.create('cardCvc', { style: style });
  cardCvc.mount('#CVC');

  let cardNumberFilled = false;
  let expDateFilled = false;
  let cvcFilled = false;

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

  document.getElementById('cardName').addEventListener('input', () => {
    updateFlipState();
  });

  // IndexedDB Logic for Payment Page
  const request = indexedDB.open('ItemsDB', 2);

  request.onsuccess = function (event) {
    const db = event.target.result;
    const transaction = db.transaction(['items'], 'readonly');
    const objectStore = transaction.objectStore('items');
    const itemsContainer = document.getElementById('indexeddb-items');

    itemsContainer.innerHTML = '';

    const getRequest = objectStore.getAll();

    getRequest.onsuccess = function () {
      const items = getRequest.result;
      if (items.length === 0) {
        itemsContainer.innerHTML = '<p>No items available.</p>';
        return;
      }
      items.forEach(item => {
        const label = document.createElement('label');
        label.innerHTML = `
          <input type="checkbox" name="indexeddb-items" value="${item.articleId}" ${item.boxCheck ? 'checked' : ''}>
          ${item.name} ($${item.price.toFixed(2)})
        `;
        itemsContainer.appendChild(label);
        itemsContainer.appendChild(document.createElement('br'));
      });
    };

    getRequest.onerror = function () {
      console.error('Error retrieving items:', getRequest.error);
    };
  };

  request.onerror = function (event) {
    console.error('Database error:', event.target.errorCode);
  };

  // Form submission
  document.getElementById('payment-form').addEventListener('submit', async function(event) {
    event.preventDefault();

    const selectedItems = Array.from(document.querySelectorAll('input[name="indexeddb-items"]:checked'))
      .map(item => item.value);

    if (selectedItems.length === 0) {
      document.getElementById('card-errors').textContent = 'Please select at least one item to proceed.';
      return;
    }

    const cardName = document.getElementById('cardName').value.trim();
    const firstNameMatch = cardName.match(/^[^ ]+/);
    const lastNameMatch = cardName.match(/[^ ]+$/);
    const firstName = firstNameMatch ? firstNameMatch[0] : 'Unknown';
    const lastName = lastNameMatch ? lastNameMatch[0] : 'Unknown';

    // Get total from /api/total
    const totalResponse = await fetch('http://localhost:3000/api/total', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleIds: JSON.stringify(selectedItems) })
    });

    if (!totalResponse.ok) {
      const errorData = await totalResponse.json();
      document.getElementById('card-errors').textContent = errorData.error || 'Failed to calculate total';
      return;
    }

    const totalData = await totalResponse.json();
    const totalAmount = totalData.totalAmount;

    const { paymentMethod, error } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardNumber,
      billing_details: { name: cardName }
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
            totalAmount: totalAmount,
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
          window.location.href = data.redirectUrl; // Redirects to selectOption.html
        }
      } catch (fetchError) {
        document.getElementById('card-errors').textContent = `Payment failed: ${fetchError.message}`;
        console.error('Fetch error:', fetchError);
      }
    }
  });
});