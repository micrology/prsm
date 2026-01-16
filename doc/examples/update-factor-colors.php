<?php
/**
 * Update factor colors in a PRSM map
 * Finds all factors with a specific background color and updates them to a new color
 */

const ROOM_ID = 'VXB-BJN-TAS-YOP';
const BASE_URL = 'http://localhost:3001/api/map';
const OLD_COLOR = 'rgb(219, 165, 66)';
const NEW_COLOR = 'rgb(255, 0, 0)';

/**
 * Normalize color string by removing all whitespace
 */
function normalizeColor($color) {
    return preg_replace('/\s+/', '', $color);
}

/**
 * Make an HTTP request using cURL
 */
function makeRequest($url, $method = 'GET', $data = null) {
    $ch = curl_init();
    
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    
    if ($data !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    }
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    
    if ($error) {
        throw new Exception("cURL error: $error");
    }
    
    $decoded = json_decode($response, true);
    
    if ($httpCode >= 400) {
        $errorMsg = isset($decoded['error']) ? $decoded['error'] : 'Unknown error';
        throw new Exception("HTTP $httpCode: $errorMsg");
    }
    
    return $decoded;
}

function main() {
    try {
        echo "Fetching map data for room " . ROOM_ID . "...\n";
        
        // Get the map data to retrieve all factor IDs
        $mapData = makeRequest(BASE_URL . '/' . ROOM_ID);
        
        $factorIds = array_filter(
            array_map(function($node) { return isset($node['id']) ? $node['id'] : null; }, $mapData['nodes']),
            function($id) { return !empty($id); }
        );
        
        echo "Found " . count($factorIds) . " factors in the map\n";
        
        // Fetch details for each factor to check its background color
        $factorsToUpdate = [];
        
        foreach ($factorIds as $factorId) {
            echo "Checking factor $factorId...\n";
            
            try {
                $factorData = makeRequest(BASE_URL . '/' . ROOM_ID . '/factor/' . $factorId);
                
                // Check if the background color matches the old color
                if (isset($factorData['color']['background'])) {
                    $currentColor = normalizeColor($factorData['color']['background']);
                    $targetColor = normalizeColor(OLD_COLOR);
                    
                    if ($currentColor === $targetColor) {
                        $factorsToUpdate[] = [
                            'id' => $factorId,
                            'label' => $factorData['label']
                        ];
                    }
                }
            } catch (Exception $e) {
                echo "Failed to fetch factor $factorId, skipping...\n";
                continue;
            }
        }
        
        echo "\nFound " . count($factorsToUpdate) . " factors with background color " . OLD_COLOR . "\n";
        
        // Update each matching factor
        foreach ($factorsToUpdate as $factor) {
            echo "Updating factor \"{$factor['label']}\" ({$factor['id']})...\n";
            
            try {
                $updatedFactor = makeRequest(
                    BASE_URL . '/' . ROOM_ID . '/factor/' . $factor['id'],
                    'PATCH',
                    [
                        'update' => [
                            'color' => [
                                'background' => NEW_COLOR
                            ]
                        ]
                    ]
                );
                
                echo "✓ Updated \"{$updatedFactor['label']}\" to " . NEW_COLOR . "\n";
            } catch (Exception $e) {
                echo "Failed to update factor {$factor['id']}: {$e->getMessage()}\n";
                continue;
            }
        }
        
        echo "\nComplete! Updated " . count($factorsToUpdate) . " factors.\n";
        
    } catch (Exception $e) {
        echo "Error: {$e->getMessage()}\n";
        exit(1);
    }
}

main();
