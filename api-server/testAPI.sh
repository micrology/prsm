#! /bin/bash
echo -e "Get factor"
curl -H "Content-Type: application/json" -X GET http://localhost:3001/api/map/VXB-BJN-TAS-YOP/factor/c184317c-1046-44c0-acbd-246ae6c06c21
echo -e "\n\nUpdate factor"
curl -H "Content-Type: application/json" -X PATCH -d '{"update": {"color": {"background": "rgb(0,0,255)"}}}' http://localhost:3001/api/map/VXB-BJN-TAS-YOP/factor/c184317c-1046-44c0-acbd-246ae6c06c21
echo -e "\n\nCreate factor"
curl -H "Content-Type: application/json" -X POST -d '{"spec": {"label": "New factor", "color": {"background": "rgb(0,255,0)"}}}' http://localhost:3001/api/map/VXB-BJN-TAS-YOP/factor/80a484e8-c2c0-4a57-a12a-newfactor
echo -e "\n\nUpdate factor"
curl -H "Content-Type: application/json" -X PATCH -d '{"update": {"label": "XXX"}}' http://localhost:3001/api/map/VXB-BJN-TAS-YOP/factor/80a484e8-c2c0-4a57-a12a-newfactor
echo -e "\n\nGet updated factor"
curl -H "Content-Type: application/json" -X GET http://localhost:3001/api/map/VXB-BJN-TAS-YOP/factor/80a484e8-c2c0-4a57-a12a-newfactor
echo -e "\n\nSleeping"
sleep 3
echo -e "\n\nDelete factor"
curl -H "Content-Type: application/json" -X DELETE  http://localhost:3001/api/map/VXB-BJN-TAS-YOP/factor/80a484e8-c2c0-4a57-a12a-newfactor
echo -e "\n\nTry to get deleted factor - should fail"
curl -H "Content-Type: application/json" -X GET http://localhost:3001/api/map/VXB-BJN-TAS-YOP/factor/80a484e8-c2c0-4a57-a12a-newfactor
echo -e "\n\nGet a map with ill-formed room id - should fail"
curl -H "Content-Type: application/json" -X GET http://localhost:3001/api/map/XXXX
echo -e "\n\nGet a non-existent map - should fail"
curl -H "Content-Type: application/json" -X GET http://localhost:3001/api/map/NOP-NOP-NOP-NOP
echo -e "\n\nFinished."