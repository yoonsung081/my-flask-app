// --- 기본 설정 ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
const controls = new THREE.OrbitControls(camera, renderer.domElement);
document.getElementById('globe-container').appendChild(renderer.domElement);
renderer.setSize(window.innerWidth, window.innerHeight);

camera.position.z = 15;

// --- 조명 ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 3, 5);
scene.add(directionalLight);

// --- 지구본 생성 ---
const earthGeometry = new THREE.SphereGeometry(5, 32, 32);
const earthTexture = new THREE.TextureLoader().load('https://raw.githubusercontent.com/dataarts/webgl-globe/master/globe/world.jpg');
const earthMaterial = new THREE.MeshPhongMaterial({ map: earthTexture });
const earth = new THREE.Mesh(earthGeometry, earthMaterial);
scene.add(earth);

// --- 전역 변수 ---
let airportsData = {};
let currentMode = 'search'; // 'search' or 'sim'
let airplane = null;
let animationFrameId = null;

// --- 애니메이션 루프 ---
function animate() {
    animationFrameId = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// --- 초기화 ---
function init() {
    fetch('/airports')
        .then(response => response.json())
        .then(data => {
            const originSelect = document.getElementById('origin');
            const destinationSelect = document.getElementById('destination');
            data.forEach(airport => {
                if (airport.iata_code) {
                    airportsData[airport.iata_code] = airport;
                    const option = new Option(`${airport.airport_name} (${airport.iata_code})`, airport.iata_code);
                    originSelect.add(option.cloneNode(true));
                    destinationSelect.add(option);
                }
            });
        });

    setupEventListeners();
    animate();
}

// --- 이벤트 리스너 설정 ---
function setupEventListeners() {
    document.getElementById('mode-search').addEventListener('click', () => switchMode('search'));
    document.getElementById('mode-sim').addEventListener('click', () => switchMode('sim'));
    document.getElementById('calculate').addEventListener('click', handleCalculateClick);
    document.getElementById('toggle-sim').addEventListener('click', toggleSimulation);

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

// --- 모드 전환 ---
function switchMode(mode) {
    currentMode = mode;
    clearScene();
    document.getElementById('results-panel').innerHTML = '';

    if (mode === 'search') {
        document.getElementById('search-panel').style.display = 'block';
        document.getElementById('sim-controls').style.display = 'none';
        document.getElementById('mode-search').classList.add('active');
        document.getElementById('mode-sim').classList.remove('active');
    } else {
        document.getElementById('search-panel').style.display = 'none';
        document.getElementById('sim-controls').style.display = 'block';
        document.getElementById('mode-search').classList.remove('active');
        document.getElementById('mode-sim').classList.add('active');
        // 시뮬레이션 모드 로직 (추후 구현)
    }
}

// --- 경로 계산 처리 ---
function handleCalculateClick() {
    const originIata = document.getElementById('origin').value;
    const destinationIata = document.getElementById('destination').value;

    if (originIata && destinationIata) {
        fetch('/calculate_route', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ origin: originIata, destination: destinationIata })
        })
        .then(response => response.json())
        .then(data => {
            clearScene();
            if (data.path) {
                // A* 경로 시각화
                visualizeArc(data.path, 0x28a745, 'astar'); // Green
                
                // 대권 항로 시각화
                const directPath = [originIata, destinationIata];
                const directDistance = haversineDistance(airportsData[originIata], airportsData[destinationIata]);
                visualizeArc(directPath, 0xffc107, 'direct'); // Yellow

                // 결과 표시
                displayResults(data.total_distance, directDistance);
            }
        });
    }
}

// --- 경로 시각화 (호) ---
function visualizeArc(path, color, name) {
    const points = path.map(iata => latLonToVector3(airportsData[iata].latitude, airportsData[iata].longitude, 5));
    
    const curvePoints = [];
    for (let i = 0; i < points.length - 1; i++) {
        const start = points[i];
        const end = points[i+1];
        
        const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        const distance = start.distanceTo(end);
        mid.setLength(5 + distance * 0.2);

        const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
        curvePoints.push(...curve.getPoints(50));
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
    const material = new THREE.LineBasicMaterial({ color: color, linewidth: 2 });
    const arc = new THREE.Line(geometry, material);
    arc.name = name;
    scene.add(arc);
}

// --- 결과 표시 ---
function displayResults(astarDistance, directDistance) {
    const resultsPanel = document.getElementById('results-panel');
    const astarKm = Math.round(astarDistance);
    const directKm = Math.round(directDistance);
    const difference = Math.round(directDistance - astarDistance);

    resultsPanel.innerHTML = `
        <div class="path-result astar-path">
            <strong>A* 경로:</strong> ${astarKm} km
        </div>
        <div class="path-result direct-path">
            <strong>대권 항로:</strong> ${directKm} km
        </div>
        <p class="text-center mt-3">
            A* 알고리즘을 통해 약 <strong>${difference} km</strong> 더 효율적인 경로를 찾았습니다.
        </p>
    `;
}

// --- 유틸리티 함수 ---
function latLonToVector3(lat, lon, radius) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);
    return new THREE.Vector3(x, y, z);
}

function haversineDistance(airport1, airport2) {
    const R = 6371; // km
    const lat1 = airport1.latitude * Math.PI / 180;
    const lon1 = airport1.longitude * Math.PI / 180;
    const lat2 = airport2.latitude * Math.PI / 180;
    const lon2 = airport2.longitude * Math.PI / 180;

    const dlon = lon2 - lon1;
    const dlat = lat2 - lat1;

    const a = Math.sin(dlat / 2)**2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlon / 2)**2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

function clearScene() {
    const astarPath = scene.getObjectByName('astar');
    if (astarPath) scene.remove(astarPath);
    const directPath = scene.getObjectByName('direct');
    if (directPath) scene.remove(directPath);
}

// --- 실행 ---
init();
