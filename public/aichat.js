document.addEventListener('DOMContentLoaded', () => {
    const submitButton = document.getElementById('submitButton');
    const responseOutput = document.getElementById('responseOutput');
    const apiKeyInput = document.getElementById('apiKeyInput');

    // Load API key from localStorage
    const savedApiKey = localStorage.getItem('apiKey');
    if (savedApiKey) {
        apiKeyInput.value = savedApiKey;
    }

    submitButton.addEventListener('click', async () => {
        const apiKey = apiKeyInput.value.trim();
        const modelInput = document.getElementById('modelInput');
        const model = modelInput.value.trim();
        const prompt = document.getElementById('promptInput').value.trim();

        if (!apiKey || !model || !prompt) {
            alert('Please fill in all fields (API Key, Model, and Prompt).');
            return;
        }

        // Save API key to localStorage
        localStorage.setItem('apiKey', apiKey);

        const requestBody = { apiKey, model, prompt };
        const selectedOption = modelInput.options[modelInput.selectedIndex];
        if (selectedOption.getAttribute('type') === 'image') {
            requestBody.modalities = ["image", "text"];
            requestBody.image_config = { aspect_ratio: "1:1" };
        }

        responseOutput.innerHTML = ''; // Clear previous output
        submitButton.disabled = true;

        try {
            const response = await fetch('/api/ai', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json();
                responseOutput.textContent = `Error: ${errorData.error || 'Unknown error occurred'}`;
                submitButton.disabled = false;
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;
                
                const lines = buffer.split('\n');
                buffer = lines.pop(); // Keep the last incomplete line

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;
                    
                    if (trimmedLine.startsWith('data: ')) {
                        try {
                            const jsonStr = trimmedLine.substring(6);
                            const data = JSON.parse(jsonStr);
                            
                            // Handle simplified text format
                            if (data.text) {
                                responseOutput.appendChild(document.createTextNode(data.text));
                            }
                            
                            // Handle simplified image format
                            if (data.image) {
                                const imgElement = document.createElement('img');
                                imgElement.src = data.image;
                                imgElement.style.maxWidth = '100%';
                                imgElement.style.marginTop = '10px';
                                imgElement.style.display = 'block';
                                responseOutput.appendChild(imgElement);
                            }
                        } catch (e) {
                            console.error('Error parsing SSE:', e);
                        }
                    }
                }
            }

        } catch (error) {
            console.error('Error fetching AI response:', error);
            responseOutput.textContent += '\nFailed to communicate with the server.';
        } finally {
            submitButton.disabled = false;
        }
    });
});
