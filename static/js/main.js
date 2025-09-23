/* --- 전역 변수 및 상수 --- */
let airportsData = {};
let airportList = []; // 시뮬레이션을 위한 공항 배열
let map;
let routeLayer; // 경로 탐색 모드용 레이어
let simulationLayer; // 시뮬레이션 모드용 레이어

// 모드 관리
let currentMode = 'sim'; // 'sim' 또는 'search'

// 시뮬레이션 상태
let isSimRunning = false;
let airplanes = [];
let simLoopId;
const MAX_AIRPLANES = 50;
let logCounter = 0;
let simulationSpeedMultiplier = 1; // 시뮬레이션 속도 배율

// --- 초기화 --- //
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    initUI();
    loadAirports();
});

function initMap() {
    map = L.map('map', { zoomControl: false }).setView([20, 0], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);
    simulationLayer = L.layerGroup().addTo(map);
}

function initUI() {
    document.getElementById('mode-sim').addEventListener('click', () => switchMode('sim'));
    document.getElementById('mode-search').addEventListener('click', () => switchMode('search'));
    document.getElementById('calculate').addEventListener('click', calculateRoute);
    document.getElementById('toggle-sim').addEventListener('click', toggleSimulation);
    document.getElementById('airplane-count').addEventListener('input', e => {
        const count = e.target.value;
        document.getElementById('airplane-count-label').textContent = count;
        adjustAirplaneCount(parseInt(count, 10));
    });
    document.getElementById('sim-speed').addEventListener('input', e => {
        const speed = parseFloat(e.target.value);
        document.getElementById('sim-speed-label').textContent = `${speed.toFixed(1)}x`;
        simulationSpeedMultiplier = speed;
    });
    log('[System] UI 초기화 완료.');
}

async function loadAirports() {
    log('[System] 공항 데이터 로딩 시작...');
    try {
        const response = await fetch('/airports');
        if (!response.ok) throw new Error(`HTTP 오류!`);
        const data = await response.json();
        
        airportList = data.filter(a => a.iata_code && a.airport_name && a.country_name);
        airportList.sort((a, b) => a.airport_name.localeCompare(b.airport_name));

        const originSelect = document.getElementById('origin');
        const destinationSelect = document.getElementById('destination');
        originSelect.innerHTML = '<option selected disabled>공항 선택...</option>';
        destinationSelect.innerHTML = '<option selected disabled>공항 선택...</option>';

        airportList.forEach(airport => {
            airportsData[airport.iata_code] = airport;
            const option = document.createElement('option');
            option.value = airport.iata_code;
            option.textContent = `${airport.airport_name} (${airport.iata_code}) - ${airport.country_name}`;
            originSelect.appendChild(option.cloneNode(true));
            destinationSelect.appendChild(option);
        });

        log(`[System] ${airportList.length}개 공항 데이터 로드 완료.`);
        adjustAirplaneCount(parseInt(document.getElementById('airplane-count').value, 10));

    } catch (error) {
        log(`[Error] 공항 데이터 로드 실패: ${error.message}`);
        console.error(error);
    }
}

// --- 로깅 --- //
function log(message) {
    const logPanel = document.getElementById('sim-log-panel');
    const timestamp = new Date().toLocaleTimeString();
    const newMessage = document.createElement('p');
    newMessage.innerHTML = `<code>[${timestamp}]</code> ${message}`;
    logPanel.appendChild(newMessage);
    // 로그가 너무 많아지면 스크롤을 맨 아래로 이동
    logPanel.scrollTop = logPanel.scrollHeight;
}

// --- 모드 전환 --- //
function switchMode(mode) {
    currentMode = mode;
    // ... (이하 기존 코드와 동일)
}

// --- 시뮬레이션 관리 --- //
function toggleSimulation() {
    isSimRunning = !isSimRunning;
    const button = document.getElementById('toggle-sim');
    if (isSimRunning) {
        log('[System] 시뮬레이션 시작됨.');
        button.textContent = '시뮬레이션 정지';
        button.classList.replace('btn-success', 'btn-danger');
        simulationLoop();
    } else {
        log('[System] 시뮬레이션 정지됨.');
        button.textContent = '시뮬레이션 시작';
        button.classList.replace('btn-danger', 'btn-success');
        if (simLoopId) cancelAnimationFrame(simLoopId);
    }
}

function adjustAirplaneCount(count) {
    const difference = count - airplanes.length;
    log(`[System] 항공기 수를 ${count}개로 조정합니다.`);
    if (difference > 0) {
        for (let i = 0; i < difference; i++) {
            if (airplanes.length < MAX_AIRPLANES) {
                airplanes.push(new Airplane(airplanes.length + 1));
            }
        }
    } else {
        for (let i = 0; i < -difference; i++) {
            const airplane = airplanes.pop();
            if (airplane) airplane.remove();
        }
    }
}

function simulationLoop() {
    if (!isSimRunning) return;
    logCounter++;
    airplanes.forEach((airplane, index) => {
        airplane.update();
        // 모든 비행기를 로그에 남기면 너무 많으므로, 0번 인덱스 비행기만 60프레임마다 로그
        if (index === 0 && logCounter % 60 === 0) {
            airplane.logStatus();
        }
    });

    simLoopId = requestAnimationFrame(simulationLoop);
}

// --- 항공기 클래스 --- //
class Airplane {
    constructor(id) {
        this.id = id;
        this.marker = null;
        this.trail = null;
        this.reset();
    }

    reset() {
        if (this.marker) this.remove();

        this.origin = airportList[Math.floor(Math.random() * airportList.length)];
        this.destination = airportList[Math.floor(Math.random() * airportList.length)];

        while (this.origin.iata_code === this.destination.iata_code) {
            this.destination = airportList[Math.floor(Math.random() * airportList.length)];
        }

        log(`[Airplane #${this.id}] 새 경로 할당: ${this.origin.iata_code} → ${this.destination.iata_code}`);

        this.path = getGreatCirclePoints(
            [this.origin.latitude, this.origin.longitude],
            [this.destination.latitude, this.destination.longitude]
        );
        this.progress = 0;
        this.speed = 0.001 + Math.random() * 0.004; // 속도 약간 줄임

        this.createMarker();
        this.trail = L.polyline([], { color: '#ff00ff', weight: 1, opacity: 0.3, className: 'airplane-trail' }).addTo(simulationLayer);
    }

    createMarker() {
        const icon = L.divIcon({
            html: `<svg class="airplane-icon" width="24" height="24"><use href="#airplane-symbol"></use></svg>`,
            className: '',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });
        this.marker = L.marker([this.origin.latitude, this.origin.longitude], { icon }).addTo(simulationLayer);
    }

    update() {
        this.progress += this.speed * simulationSpeedMultiplier;
        if (this.progress >= 1) {
            log(`[Airplane #${this.id}] 목적지 ${this.destination.iata_code} 도착. `);
            this.reset();
            return;
        }

        const pathIndex = Math.floor(this.progress * (this.path.length - 1));
        const nextIndex = pathIndex + 1 < this.path.length ? pathIndex + 1 : pathIndex;
        
        const currentPos = this.path[pathIndex];
        const nextPos = this.path[nextIndex];

        this.marker.setLatLng(currentPos);
        this.trail.addLatLng(currentPos);

        const angle = Math.atan2(nextPos[0] - currentPos[0], nextPos[1] - currentPos[1]) * 180 / Math.PI;
        if (this.marker._icon) {
            this.marker._icon.style.transformOrigin = 'center';
            this.marker._icon.style.transform = `rotate(${angle + 90}deg)`;
        }
    }

    logStatus() {
        if (!this.marker) return;
        const pos = this.marker.getLatLng();
        log(`[Airplane #${this.id}] Status: ${(this.progress * 100).toFixed(1)}% | Pos: ${pos.lat.toFixed(2)}, ${pos.lng.toFixed(2)}`);
    }

    remove() {
        if (this.marker) simulationLayer.removeLayer(this.marker);
        if (this.trail) simulationLayer.removeLayer(this.trail);
        this.marker = null;
        this.trail = null;
    }
}

// --- 기존 경로 탐색 함수들 (수정 없음) --- //
// ... calculateRoute, drawRoutePath, getFullPathPoints, getGreatCirclePoints ...
// (이 부분은 이전 버전과 동일하여 생략합니다)

// --- 기존 코드 붙여넣기 --- //

function switchMode(mode) {
    currentMode = mode;
    const simButton = document.getElementById('mode-sim');
    const searchButton = document.getElementById('mode-search');
    const simControls = document.getElementById('sim-controls');
    const searchPanel = document.getElementById('search-panel');
    const resultDiv = document.getElementById('result');

    if (mode === 'sim') {
        simButton.classList.add('active');
        searchButton.classList.remove('active');
        simControls.style.display = 'block';
        searchPanel.style.display = 'none';
        resultDiv.innerHTML = '';
        if (routeLayer) routeLayer.clearLayers();
        simulationLayer.addTo(map); // 시뮬레이션 레이어 보이기
    } else { // search 모드
        simButton.classList.remove('active');
        searchButton.classList.add('active');
        simControls.style.display = 'none';
        searchPanel.style.display = 'block';
        if (isSimRunning) toggleSimulation(); // 시뮬레이션 자동 정지
        simulationLayer.removeFrom(map); // 시뮬레이션 레이어 숨기기
    }
}

async function calculateRoute() {
    const origin = document.getElementById('origin').value;
    const destination = document.getElementById('destination').value;
    const resultDiv = document.getElementById('result');
    const calculateBtn = document.getElementById('calculate');

    if (!origin || !destination || origin === '공항 선택...' || destination === '공항 선택...') return;

    resultDiv.innerHTML = '';
    calculateBtn.disabled = true;
    calculateBtn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> A* 탐색 중...`;

    try {
        const response = await fetch('/calculate_route', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ origin, destination })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `HTTP 오류!`);

        const pathInfo = data.path.length > 2 ? `${data.path.length - 2}곳을 경유하는` : '직항';
        resultDiv.innerHTML = `<div class="alert alert-success"><strong>탐색 완료!</strong> ${pathInfo} 최단 경로의 총 거리는 <strong>${Math.round(data.total_distance)}km</strong> 입니다.</div>`;
        drawRoutePath(data.path);

    } catch (error) {
        resultDiv.innerHTML = `<div class="alert alert-danger"><strong>오류:</strong> 경로 탐색에 실패했습니다. ${error.message}</div>`;
    } finally {
        calculateBtn.disabled = false;
        calculateBtn.innerHTML = '경로 계산';
    }
}

function drawRoutePath(path) {
    if (!routeLayer) {
        routeLayer = L.layerGroup().addTo(map);
    } else {
        routeLayer.clearLayers();
    }
    if (simLoopId) cancelAnimationFrame(simLoopId); // 경로 탐색 시 애니메이션 정지

    const pathCoords = path.map(iata => {
        const airport = airportsData[iata];
        return [airport.latitude, airport.longitude];
    });

    path.forEach((iata, index) => {
        const airport = airportsData[iata];
        let markerPopup = `<b>${airport.airport_name}</b>`;
        if (index === 0) markerPopup = `<b>출발:</b> ${airport.airport_name}`;
        else if (index === path.length - 1) markerPopup = `<b>도착:</b> ${airport.airport_name}`;
        else markerPopup = `<b>경유:</b> ${airport.airport_name}`;

        L.marker([airport.latitude, airport.longitude]).addTo(routeLayer).bindPopup(markerPopup);
    });

    const fullPathPoints = getFullPathPoints(pathCoords);
    
    L.polyline(fullPathPoints, { color: '#87cefa', weight: 3 }).addTo(routeLayer);
    
    map.fitBounds(pathCoords, { padding: [50, 50] });
}

function getFullPathPoints(pathCoords) {
    let allPoints = [];
    for (let i = 0; i < pathCoords.length - 1; i++) {
        const segmentPoints = getGreatCirclePoints(pathCoords[i], pathCoords[i+1]);
        allPoints = allPoints.concat(segmentPoints);
    }
    return allPoints;
}

function getGreatCirclePoints(start, end) {
    const latlngs = [];
    const startLat = start[0] * Math.PI / 180, startLng = start[1] * Math.PI / 180;
    const endLat = end[0] * Math.PI / 180, endLng = end[1] * Math.PI / 180;
    const d = 2 * Math.asin(Math.sqrt(Math.pow(Math.sin((startLat - endLat) / 2), 2) + Math.cos(startLat) * Math.cos(endLat) * Math.pow(Math.sin((startLng - endLng) / 2), 2)));
    const steps = 100; // 경로를 더 부드럽게

    for (let i = 0; i <= steps; i++) {
        const f = i / steps;
        if (Math.sin(d) === 0) {
            const lat = (start[0] + f * (end[0] - start[0]));
            const lng = (start[1] + f * (end[1] - start[1]));
            latlngs.push([lat, lng]);
            continue;
        }
        const A = Math.sin((1 - f) * d) / Math.sin(d);
        const B = Math.sin(f * d) / Math.sin(d);
        const x = A * Math.cos(startLat) * Math.cos(startLng) + B * Math.cos(endLat) * Math.cos(endLng);
        const y = A * Math.cos(startLat) * Math.sin(startLng) + B * Math.cos(endLat) * Math.sin(endLng);
        const z = A * Math.sin(startLat) + B * Math.sin(endLat);
        const lat = Math.atan2(z, Math.sqrt(x*x + y*y)) * 180 / Math.PI;
        const lng = Math.atan2(y, x) * 180 / Math.PI;
        latlngs.push([lat, lng]);
    }
    return latlngs;
}
