/api/models wich returns a json with name, send_name, think: ture/false, inputs (img/txt) and outputs (img/txt)

curl -N -X POST http://localhost:3000/api/title -H "Content-Type: application/json" -d "{\"apiKey\": \"sk-hc-v1-905f7e777a34415ba100daf12a26199a31043810d2c8481793feae19679264e7\", \"prompt\": \"Hello world, how are you?\"}"