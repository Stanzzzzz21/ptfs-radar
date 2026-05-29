const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());

// --- COMPLETE PTFS / ATC24 MAP AIRFIELD DATA ---
const AIRPORTS = {
    IRFD: { name: "Greater Rockford", x: -24500, y: 18000 },
    IPPH: { name: "Perth International", x: 22000, y: -14500 },
    IACY: { name: "Tokyo International", x: -32000, y: -28000 },
    ISAU: { name: "Sauthemptona", x: -10906, y: -23349 },
    ILCA: { name: "Larnaca Airport", x: 14000, y: 25000 },
    IKFK: { name: "Keflavik Airport", x: -5000, y: -5000 },
    IIZL: { name: "Izolirani Airport", x: 35000, y: 5000 },
    IPPH_CG: { name: "Paphos Airport", x: 18500, y: -8000 },
    IMCC: { name: "McConnell AFB", x: -15000, y: 5000 },
    SABA: { name: "Saba Airstrip", x: 8000, y: -22000 },
    ISAB: { name: "Saint Barthélemy", x: 6200, y: -9100 },
    ILUK: { name: "Lukla Airstrip", x: -28000, y: 12000 },
    IBAR: { name: "Barra Beach", x: -18000, y: -18000 },
    IMEL: { name: "Mellor Airfield", x: 2000, y: 32000 },
    IPIN: { name: "Pingeyri Strip", x: -12000, y: -34000 },
    RDBA: { name: "Road Base", x: -2000, y: 19000 },
    AFGY: { name: "Airbase Garry", x: -41000, y: 2000 },
    BLTC: { name: "Boltic Airfield", x: 42000, y: -31000 },
    R97A: { name: "HMS Queen Elizabeth", x: -10000, y: 40000 },
    CVN78: { name: "USS Gerald R. Ford", x: 28000, y: -40000 }
};

let liveAircraft = {};

// Open a streaming pipeline straight to the upstream data network
function connectToDataGrid() {
    console.log('[WebSocket] Connecting upstream to 24data...');

    const ws = new WebSocket('wss://24data.ptfs.app/wss', {
        headers: { Origin: '' } // Strip origin to avoid browser-origin checks
    });

    ws.on('message', (rawData) => {
        try {
            const packet = JSON.parse(rawData);
            if (packet.t === 'ACFT_DATA') {
                // Cache latest frame coordinates
                liveAircraft = packet.d || {};
            }
        } catch (err) {
            // Silently ignore malformed packets
        }
    });

    ws.on('close', () => {
        console.log('[WebSocket] Disconnected. Reconnecting in 3 seconds...');
        setTimeout(connectToDataGrid, 3000);
    });

    ws.on('error', (err) => {
        console.log('[WebSocket] Error:', err.message || err);
        // Let 'close' handler handle reconnection
    });
}

connectToDataGrid();

// Endpoint for your visual frontend map to fetch
app.get('/api/map-state', (req, res) => {
    const planes = Object.entries(liveAircraft).map(([callsign, data]) => {
        if (!data || !data.position) return null;

        let closestAirport = "None";
        let minDistance = Infinity;

        for (const [icao, coord] of Object.entries(AIRPORTS)) {
            const dx = data.position.x - coord.x;
            const dy = data.position.y - coord.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDistance) {
                minDistance = dist;
                closestAirport = icao;
            }
        }

        return {
            callsign,
            aircraft: data.aircraftType,
            x: data.position.x,
            y: data.position.y,
            altitude: data.altitude,
            heading: data.heading,
            groundSpeed: Math.round(data.groundSpeed),
            emergency: data.isEmergencyOccuring || false,
            closestAirport
        };
    }).filter(Boolean); // remove any nulls

    res.json({ airports: AIRPORTS, planes });
});

app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
});
