// Ensure DOM is fully loaded before running any logic
document.addEventListener('DOMContentLoaded', function () {
    // IndexedDB and Item Selection Logic First
    const request = indexedDB.open('ItemsDB', 2);

    request.onupgradeneeded = function (event) {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('items')) {
            db.createObjectStore('items', { keyPath: 'articleId' });
        }
        if (!db.objectStoreNames.contains('check')) {
            db.createObjectStore('check', { keyPath: 'id' });
        }
        console.log('Database setup complete');
    };

    request.onsuccess = function (event) {
        const db = event.target.result;
        console.log('Database opened successfully');

        // Fetch and display items immediately
        fetchItemsAndDisplay(db);

        // Add event listeners for item selection
        document.getElementById('save-button').addEventListener('click', function () {
            saveSelectedItems(db);
        });

        document.getElementById('send-total-button').addEventListener('click', function () {
            sendTotalToServer();
        });

        // File Upload Logic After IndexedDB is Set Up
        document.getElementById('uploadForm').addEventListener('submit', async function(event) {
            event.preventDefault();

            const messageDiv = document.getElementById('message');
            messageDiv.textContent = '';

            const fileType = document.querySelector('input[name="fileType"]:checked')?.value;
            if (!fileType) {
                messageDiv.textContent = 'Please select a file type (MP3 or MP4).';
                messageDiv.className = 'error';
                return;
            }

            const fileInput = document.getElementById('fileInput');
            const file = fileInput.files[0];
            if (!file) {
                messageDiv.textContent = 'Please select a file.';
                messageDiv.className = 'error';
                return;
            }

            const fileExt = file.name.split('.').pop().toLowerCase();
            if (fileType === 'mp3' && fileExt !== 'mp3') {
                messageDiv.textContent = 'Selected file must be an MP3.';
                messageDiv.className = 'error';
                return;
            }
            if (fileType === 'mp4' && fileExt !== 'mp4') {
                messageDiv.textContent = 'Selected file must be an MP4.';
                messageDiv.className = 'error';
                return;
            }

            const maxSizeMp3 = 5 * 1024 * 1024 * 1024; // 5GB
            const maxSizeMp4 = 7 * 1024 * 1024 * 1024; // 7GB
            const maxSize = fileType === 'mp3' ? maxSizeMp3 : maxSizeMp4;

            if (file.size > maxSize) {
                const maxGb = fileType === 'mp3' ? '5GB' : '7GB';
                messageDiv.textContent = `File size exceeds ${maxGb} limit. Your file is ${(file.size / (1024 * 1024 * 1024)).toFixed(2)}GB.`;
                messageDiv.className = 'error';
                return;
            }

            const formData = new FormData();
            formData.append('file', file);
            formData.append('fileType', fileType);

            try {
                const response = await fetch('http://localhost:3000/upload', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Upload failed');
                }

                const result = await response.json();
                messageDiv.textContent = result.message;
                messageDiv.className = 'success';
            } catch (error) {
                messageDiv.textContent = `Error: ${error.message}`;
                messageDiv.className = 'error';
            }
        });
    };

    request.onerror = function (event) {
        console.error('Database error:', event.target.errorCode);
    };
});

function fetchItemsAndDisplay(db) {
    fetch('/api/items')
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch items');
            }
            return response.json();
        })
        .then(data => {
            const transaction = db.transaction(['items'], 'readwrite');
            const objectStore = transaction.objectStore('items');

            data.forEach(item => {
                objectStore.put(item);
            });

            transaction.oncomplete = function () {
                displayItems(db);
            };

            transaction.onerror = function () {
                console.error('Transaction failed');
            };
        })
        .catch(error => console.error('Fetch error:', error));
}

function displayItems(db) {
    const transaction = db.transaction(['items'], 'readonly');
    const objectStore = transaction.objectStore('items');
    const itemsContainer = document.getElementById('items-container');

    itemsContainer.innerHTML = ''; // Clear previous content

    const request = objectStore.getAll();

    request.onsuccess = function (event) {
        const items = event.target.result;
        if (items.length === 0) {
            itemsContainer.innerHTML = '<p>No items available.</p>';
            return;
        }
        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'item';
            div.innerHTML = `
                <input type="checkbox" name="selected-items" id="${item.articleId}" value="${item.articleId}" data-price="${item.price}">
                <span>Name: ${item.name}</span>
                <span>Price: $${item.price.toFixed(2)}</span>
            `;
            itemsContainer.appendChild(div);
        });
    };

    request.onerror = function (event) {
        console.error('Retrieval error:', event.target.errorCode);
    };
}

function saveSelectedItems(db) {
    const selectedCheckboxes = document.querySelectorAll('input[name="selected-items"]:checked');
    if (selectedCheckboxes.length === 0) {
        alert('Please select at least one item!');
        return;
    }

    const selectedArticleIds = [];

    selectedCheckboxes.forEach(checkbox => {
        const articleId = checkbox.id;
        selectedArticleIds.push(articleId);
    });

    const transaction = db.transaction(['check'], 'readwrite');
    const objectStore = transaction.objectStore('check');
    const selectedData = { id: 1, articleIds: selectedArticleIds };
    const request = objectStore.put(selectedData);

    request.onsuccess = function () {
        console.log(`Saved selected items with articleIds: ${selectedArticleIds.join(', ')}`);
        const articleIdsJson = JSON.stringify(selectedArticleIds);
        localStorage.setItem('selectedArticleIds', articleIdsJson);
        // Uncomment if needed: alert(`Selected items saved! IDs: ${selectedArticleIds.join(', ')}`);

        const allCheckboxes = document.querySelectorAll('input[name="selected-items"]');
        allCheckboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
    };

    request.onerror = function (event) {
        console.error('Save error:', event.target.errorCode);
    };
}

function sendTotalToServer() {
    const articleIdsJson = localStorage.getItem('selectedArticleIds');
    if (!articleIdsJson) {
        alert('No selections saved yet! Please save a selection first.');
        return;
    }

    fetch('/api/total', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ articleIds: articleIdsJson }),
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to send total');
        }
        return response.text();
    })
    .then(data => {
        console.log('Server response:', data);
        // Uncomment if needed: alert(`Article IDs sent to server! ${data}`);
    })
    .catch(error => console.error('Send error:', error));
}