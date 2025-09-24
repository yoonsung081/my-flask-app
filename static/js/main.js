// --- 기본 설정 ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });

renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('globe-container').appendChild(renderer.domElement);

// --- 지구본 생성 ---
const geometry = new THREE.SphereGeometry(5, 32, 32);
const texture = new THREE.TextureLoader().load('https://raw.githubusercontent.com/dataarts/webgl-globe/master/globe/world.jpg');
const material = new THREE.MeshBasicMaterial({ map: texture });
const earth = new THREE.Mesh(geometry, material);
scene.add(earth);

camera.position.z = 15;

// --- 애니메이션 ---
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

animate();

// --- 창 크기 조절 ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- 공항 데이터 로드 및 UI 설정 ---
let airportsData = {};

fetch('/airports')
    .then(response => response.json())
    .then(data => {
        const originSelect = document.getElementById('origin');
        const destinationSelect = document.getElementById('destination');
        data.forEach(airport => {
            airportsData[airport.iata_code] = airport;
            const option = new Option(`${airport.airport_name} (${airport.iata_code})`, airport.iata_code);
            originSelect.add(option.cloneNode(true));
            destinationSelect.add(option);
        });
    });

// --- 경로 계산 ---
document.getElementById('calculate').addEventListener('click', () => {
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
            if (data.path) {
                visualizePath(data.path);
            }
        });
    }
});

// --- 위도/경도를 3D 좌표로 변환 ---
function latLonToVector3(lat, lon, radius) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);

    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);

    return new THREE.Vector3(x, y, z);
}

function visualizePath(path) {
    // 이전 경로 및 비행기 삭제
    const oldPath = scene.getObjectByName('flightPath');
    if (oldPath) {
        scene.remove(oldPath);
        oldPath.geometry.dispose();
        oldPath.material.dispose();
    }
    if (airplane) {
        scene.remove(airplane);
        airplane.geometry.dispose();
        airplane.material.dispose();
        airplane = null;
    }
    flightPathCurve = null;
    flightProgress = 0;

    const points = [];
    for (const iata of path) {
        const airport = airportsData[iata];
        if (airport) {
            points.push(latLonToVector3(airport.latitude, airport.longitude, 5));
        }
    }

    if (points.length > 1) {
        const curvePoints = [];
        for (let i = 0; i < points.length - 1; i++) {
            const start = points[i];
            const end = points[i+1];
            
            const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
            const distance = start.distanceTo(end);
            mid.setLength(5 + distance * 0.2); // 호의 높이를 조절

            const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
            curvePoints.push(...curve.getPoints(50));
        }

        // 전체 경로를 하나의 커브로 만듦
        flightPathCurve = new THREE.CatmullRomCurve3(curvePoints);

        const geometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
        const material = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2 });
        const flightPathLine = new THREE.Line(geometry, material);
        flightPathLine.name = 'flightPath';
        scene.add(flightPathLine);

        // 비행기 생성
        const planeGeometry = new THREE.ConeGeometry(0.1, 0.3, 8);
        planeGeometry.rotateX(Math.PI / 2);
        const planeMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
        airplane = new THREE.Mesh(planeGeometry, planeMaterial);
        scene.add(airplane);
    }
}