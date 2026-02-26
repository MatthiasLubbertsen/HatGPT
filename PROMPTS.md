/api/models wich returns a json with name, send_name, think: ture/false, inputs (img/txt) and outputs (img/txt)

curl -N -X POST http://localhost:3000/api/title -H "Content-Type: application/json" -d "{\"apiKey\": \"sk-hc-v1-sk-hc-v1-47f0ff797886421a81d3d16d3ada4091a35144b36d9342bba5cfcee146a36f19\", \"prompt\": \"Hello world, how are you?\"}"