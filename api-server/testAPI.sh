#! /bin/bash
echo -e "Chat"
curl -H "Content-Type: application/json" -X POST -d '{"message": "Hello, how are you?", "systemPrompt": ""}' http://localhost:3001/api/chat/FAK-ERO-OMK-EYX
echo -e "\n\nGet map"
curl -H "Content-Type: application/json" -X GET http://localhost:3001/api/map/VXB-BJN-TAS-YOP | head -c 200
echo -e "\n\nChange map title and background color"
curl -H "Content-Type: application/json" -X PATCH -d '{"update": {"title": "Updated map title", "background": "rgb(200,200,200)"}}' http://localhost:3001/api/map/VXB-BJN-TAS-YOP
echo -e "\n\nGet factor c184317c-1046-44c0-acbd-246ae6c06c21"
curl -H "Content-Type: application/json" -X GET http://localhost:3001/api/map/VXB-BJN-TAS-YOP/factor/c184317c-1046-44c0-acbd-246ae6c06c21
echo -e "\n\nUpdate factor c184317c-1046-44c0-acbd-246ae6c06c21"
curl -H "Content-Type: application/json" -X PATCH -d '{"update": {"color": {"background": "rgb(0,0,255)"}}}' http://localhost:3001/api/map/VXB-BJN-TAS-YOP/factor/c184317c-1046-44c0-acbd-246ae6c06c21
echo -e "\n\nCreate factor 80a484e8-c2c0-4a57-a12a-newfactor"
curl -H "Content-Type: application/json" -X POST -d '{"spec": {"label": "New factor", "color": {"background": "rgb(0,255,0)"}}}' http://localhost:3001/api/map/VXB-BJN-TAS-YOP/factor/80a484e8-c2c0-4a57-a12a-newfactor
echo -e "\n\nUpdate factor 80a484e8-c2c0-4a57-a12a-newfactor"
curl -H "Content-Type: application/json" -X PATCH -d '{"update": {"label": "XXX"}}' http://localhost:3001/api/map/VXB-BJN-TAS-YOP/factor/80a484e8-c2c0-4a57-a12a-newfactor
echo -e "\n\nGet updated factor 80a484e8-c2c0-4a57-a12a-newfactor"
curl -H "Content-Type: application/json" -X GET http://localhost:3001/api/map/VXB-BJN-TAS-YOP/factor/80a484e8-c2c0-4a57-a12a-newfactor
echo -e "\n\nGet link 860a240b-15d5-4d99-bc69-f1a3d01391c4"
curl -H "Content-Type: application/json" -X GET http://localhost:3001/api/map/VXB-BJN-TAS-YOP/link/860a240b-15d5-4d99-bc69-f1a3d01391c4
echo -e "\n\nUpdate link 860a240b-15d5-4d99-bc69-f1a3d01391c4"
curl -H "Content-Type: application/json" -X PATCH -d '{"update": {"color": {"color": "rgb(255,0,255)"}}}' http://localhost:3001/api/map/VXB-BJN-TAS-YOP/link/860a240b-15d5-4d99-bc69-f1a3d01391c4
echo -e "\n\nGet updated link 860a240b-15d5-4d99-bc69-f1a3d01391c4"
curl -H "Content-Type: application/json" -X GET http://localhost:3001/api/map/VXB-BJN-TAS-YOP/link/860a240b-15d5-4d99-bc69-f1a3d01391c4
echo -e "\n\nCreate link 02102d1a-1b34-48d5-be75-f91cb6d44bf0"
curl -H "Content-Type: application/json" -X POST -d '{"spec": {"from": "cc45c4a0-a6f0-4915-8c19-dd45cf4c6bcc", "to": "c184317c-1046-44c0-acbd-246ae6c06c21", "color": {"color": "rgb(0,255,0255)"}, "width": 4, "dashes": "true"}}' http://localhost:3001/api/map/VXB-BJN-TAS-YOP/link/02102d1a-1b34-48d5-be75-f91cb6d44bf0
echo
read -p "Continue? " -n 1 -r
echo 
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    exit 1
fi
echo -e "\n\nUndo link colouring link 860a240b-15d5-4d99-bc69-f1a3d01391c4"
curl -H "Content-Type: application/json" -X PATCH -d '{"update": {"color": {"color": "rgb(0,0,0)"}}}' http://localhost:3001/api/map/VXB-BJN-TAS-YOP/link/860a240b-15d5-4d99-bc69-f1a3d01391c4
echo -e "\n\nDelete factor"
curl -H "Content-Type: application/json" -X DELETE  http://localhost:3001/api/map/VXB-BJN-TAS-YOP/factor/80a484e8-c2c0-4a57-a12a-newfactor
echo -e "\n\nDelete link"
curl -H "Content-Type: application/json" -X DELETE  http://localhost:3001/api/map/VXB-BJN-TAS-YOP/link/02102d1a-1b34-48d5-be75-f91cb6d44bf0
echo -e "\n\nTry to get deleted factor - should fail"
curl -H "Content-Type: application/json" -X GET http://localhost:3001/api/map/VXB-BJN-TAS-YOP/factor/80a484e8-c2c0-4a57-a12a-newfactor
echo -e "\n\nTry to get deleted link - should fail"
curl -H "Content-Type: application/json" -X GET http://localhost:3001/api/map/VXB-BJN-TAS-YOP/link/02102d1a-1b34-48d5-be75-f91cb6d44bf0
echo -e "\n\nGet a map with ill-formed room id - should fail"
curl -H "Content-Type: application/json" -X GET http://localhost:3001/api/map/XXXX
echo -e "\n\nGet a non-existent map - should fail"
curl -H "Content-Type: application/json" -X GET http://localhost:3001/api/map/NOP-NOP-NOP-NOP
echo -e "\n\nFinished."