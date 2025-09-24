import csv
import os
import heapq
from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
from math import radians, cos, sin, sqrt, atan2

app = Flask(__name__)
CORS(app)

# --- 전역 변수 --- #
airports_data = {}
airport_graph = {}

# --- 핵심 계산 함수 --- #

def calculate_haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371.0
    lat1_rad, lon1_rad, lat2_rad, lon2_rad = map(radians, [lat1, lon1, lat2, lon2])
    dlon = lon2_rad - lon1_rad
    dlat = lat2_rad - lat1_rad
    a = sin(dlat / 2)**2 + cos(lat1_rad) * cos(lat2_rad) * sin(dlon / 2)**2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return R * c

# --- 서버 초기화 --- #

def load_airports_and_build_graph():
    global airports_data, airport_graph
    print("서버 초기화: 신규 데이터 로드 및 그래프 생성 시작...")

    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    
    # --- 데이터 파일 경로 ---
    AIRPORTS_FILE = os.path.join(BASE_DIR, 'airports_all.csv')
    RUNWAYS_FILE = os.path.join(BASE_DIR, 'runways.csv')

    # 1. 활주로 데이터 로드 (활주로가 있는 공항 ID를 확인하기 위함)
    runway_airport_ids = set()
    try:
        with open(RUNWAYS_FILE, mode='r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            for row in reader:
                if row.get('airport_ref'):
                    runway_airport_ids.add(row['airport_ref'])
    except FileNotFoundError:
        print(f"경고: '{RUNWAYS_FILE}' 파일을 찾을 수 없습니다. 활주로 데이터를 무시합니다.")

    # 2. 공항 데이터 로드 및 필터링
    temp_airports_list = []
    try:
        with open(AIRPORTS_FILE, mode='r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            for row in reader:
                # 데이터 유효성 검사 및 필터링 조건
                is_valid_type = row.get('type') in ['medium_airport', 'large_airport']
                has_scheduled_service = row.get('scheduled_service') == 'yes'
                has_iata_code = row.get('iata_code')
                has_runway = row.get('id') in runway_airport_ids

                if is_valid_type and has_scheduled_service and has_iata_code and has_runway:
                    try:
                        # 좌표 형 변환 및 데이터 저장
                        row['latitude'] = float(row['latitude_deg'])
                        row['longitude'] = float(row['longitude_deg'])
                        # 필요한 키만 선택하여 저장 (메모리 효율화)
                        filtered_row = {
                            'id': row['id'],
                            'iata_code': row['iata_code'],
                            'name': row['name'],
                            'type': row['type'],
                            'latitude': row['latitude'],
                            'longitude': row['longitude'],
                            'iso_country': row['iso_country'],
                            'continent': row['continent']
                        }
                        airports_data[row['iata_code']] = filtered_row
                        temp_airports_list.append(filtered_row)
                    except (ValueError, TypeError):
                        continue # 좌표값이 숫자가 아니면 무시
    except FileNotFoundError:
        print(f"치명적 오류: '{AIRPORTS_FILE}' 파일을 찾을 수 없습니다.")
        return

    # 3. 가상 항공 네트워크(그래프) 구축
    max_dist = 3000  # 직항 최대 거리 (km)
    efficiency_factor = 0.7  # 효율성 가중치

    for i, airport1 in enumerate(temp_airports_list):
        iata1 = airport1['iata_code']
        if iata1 not in airport_graph:
            airport_graph[iata1] = []
        for j in range(i + 1, len(temp_airports_list)):
            airport2 = temp_airports_list[j]
            iata2 = airport2['iata_code']
            
            dist = calculate_haversine_distance(airport1['latitude'], airport1['longitude'], airport2['latitude'], airport2['longitude'])
            
            if dist <= max_dist:
                if iata2 not in airport_graph:
                    airport_graph[iata2] = []
                efficient_dist = dist * efficiency_factor
                airport_graph[iata1].append((iata2, efficient_dist))
                airport_graph[iata2].append((iata1, efficient_dist))
    
    print(f"초기화 완료: {len(airports_data)}개 공항, {sum(len(v) for v in airport_graph.values()) // 2}개 노선 생성")
    
    print(f"초기화 완료: {len(airports_data)}개 공항, {sum(len(v) for v in airport_graph.values()) // 2}개 노선 생성")

# --- A* 알고리즘 구현 --- #

def a_star_search(start_node, goal_node):
    if start_node not in airport_graph or goal_node not in airport_graph:
        return None, float('inf')

    open_set = [(0, start_node)] # (f_score, node)
    came_from = {}
    g_score = {node: float('inf') for node in airport_graph}
    g_score[start_node] = 0
    f_score = {node: float('inf') for node in airport_graph}
    f_score[start_node] = calculate_haversine_distance(airports_data[start_node]['latitude'], airports_data[start_node]['longitude'], airports_data[goal_node]['latitude'], airports_data[goal_node]['longitude'])

    while open_set:
        _, current = heapq.heappop(open_set)

        if current == goal_node:
            # 경로 재구성
            path = []
            total_distance = g_score[goal_node]
            while current in came_from:
                path.append(current)
                current = came_from[current]
            path.append(start_node)
            return path[::-1], total_distance

        for neighbor, distance in airport_graph.get(current, []):
            tentative_g_score = g_score[current] + distance
            if tentative_g_score < g_score[neighbor]:
                came_from[neighbor] = current
                g_score[neighbor] = tentative_g_score
                h_score = calculate_haversine_distance(airports_data[neighbor]['latitude'], airports_data[neighbor]['longitude'], airports_data[goal_node]['latitude'], airports_data[goal_node]['longitude'])
                f_score[neighbor] = tentative_g_score + h_score
                heapq.heappush(open_set, (f_score[neighbor], neighbor))

    return None, float('inf') # 경로를 찾지 못한 경우

# --- Flask 라우트 --- #

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/airports", methods=["GET"])
def get_airports():
    # airports_data는 딕셔너리이므로, 값들의 리스트를 반환
    return jsonify(list(airports_data.values()))

@app.route("/calculate_route", methods=["POST"])
def calculate_route():
    data = request.json
    origin_iata = data.get('origin')
    destination_iata = data.get('destination')

    if not origin_iata or not destination_iata:
        return jsonify({"error": "출발지 또는 목적지가 유효하지 않습니다."}), 400

    # A* 알고리즘은 '효율성 가중치'가 적용된 비용으로 경로를 탐색
    path, astar_cost = a_star_search(origin_iata, destination_iata)

    # 비교를 위한 순수 직선 거리 계산
    direct_distance = calculate_haversine_distance(
        airports_data[origin_iata]['latitude'], airports_data[origin_iata]['longitude'],
        airports_data[destination_iata]['latitude'], airports_data[destination_iata]['longitude']
    )

    if path:
        return jsonify({
            "path": path, 
            "astar_distance": astar_cost,  # A*가 계산한 효율적인 비용
            "direct_distance": direct_distance # 비교를 위한 실제 직선 거리
        })
    else:
        # A*가 경로를 찾지 못한 경우
        return jsonify({
            "path": [origin_iata, destination_iata], 
            "astar_distance": None, 
            "direct_distance": direct_distance,
            "message": "직항 경로만 찾았습니다 (A* 경로 없음)"
        })

# --- 서버 실행 --- #

if __name__ == "__main__":
    load_airports_and_build_graph()
    app.run(host="0.0.0.0", port=5000, debug=True)
