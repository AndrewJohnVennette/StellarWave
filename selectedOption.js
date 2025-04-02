// Ensure DOM is fully loaded before running any logic
document.addEventListener('DOMContentLoaded', function () {
    // IndexedDB and Item Display Logic
    const request = indexedDB.open('ItemsDB', 3); // Match version from other files

    request.onupgradeneeded = function (event) {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('items')) {
            db.createObjectStore('items', { keyPath: 'articleId' });
        }
        console.log('Database setup complete');
    };

    request.onsuccess = function (event) {
        const db = event.target.result;
        console.log('Database opened successfully');

        // Fetch and display checked items with forms
        displayCheckedItems(db);
    };

    request.onerror = function (event) {
        console.error('Database error:', event.target.errorCode);
    };
});

// Function to display items with boxCheck: true, each with an upload form
function displayCheckedItems(db) {
    const transaction = db.transaction(['items'], 'readonly');
    const objectStore = transaction.objectStore('items');
    const itemsContainer = document.getElementById('items-container');

    // itemsContainer.innerHTML = '<h2>Selected Items</h2>'; // Optional header

    const request = objectStore.getAll();

    request.onsuccess = function (event) {
        const items = event.target.result;
        const checkedItems = items.filter(item => item.boxCheck === true);

        if (checkedItems.length === 0) {
            itemsContainer.innerHTML += '<p>No selected items.</p>';
            return;
        }

        checkedItems.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'checked-item';

            // Create unique IDs for each form and its elements
            const formId = `uploadForm-${item.articleId}-${index}`;
            const fileInputId = `fileInput-${item.articleId}-${index}`;
            const messageId = `message-${item.articleId}-${index}`;

            // Form HTML structure
            div.innerHTML = `
                <h3>${item.name}</h3>
                <form id="${formId}">
                    <div>
                        <label>Select File Type:</label><br>
                        <input type="radio" id="mp3-${index}" name="fileType-${index}" value="mp3" required>
                        <label for="mp3-${index}">MP3 (Max 5GB)</label><br>
                        <input type="radio" id="mp4-${index}" name="fileType-${index}" value="mp4">
                        <label for="mp4-${index}">MP4 (Max 7GB)</label>
                    </div>
                    <br>
                    <div>
                        <label for="${fileInputId}">Choose File:</label>
                        <input type="file" id="${fileInputId}" name="file" accept=".mp3,.mp4" required>
                    </div>
                    <br>
                    <button type="submit">Upload</button>
                </form>
                <div id="${messageId}"></div>
            `;

            itemsContainer.appendChild(div);

            // Add event listener for this specific form
            document.getElementById(formId).addEventListener('submit', async function(event) {
                event.preventDefault();

                const messageDiv = document.getElementById(messageId);
                messageDiv.textContent = '';

                const fileType = document.querySelector(`input[name="fileType-${index}"]:checked`)?.value;
                if (!fileType) {
                    messageDiv.textContent = 'Please select a file type (MP3 or MP4).';
                    messageDiv.className = 'error';
                    return;
                }

                const fileInput = document.getElementById(fileInputId);
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
                    const response = await fetch(`${req.get('host')}/upload`, {
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
        });
    };

    request.onerror = function (event) {
        console.error('Retrieval error:', event.target.errorCode);
    };
}