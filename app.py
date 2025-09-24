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
    print("서버 초기화: 공항 데이터 로드 및 그래프 생성 시작...")

    # 1. 공항 데이터 로드
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    AIRPORTS_FILE_PATH = os.path.join(BASE_DIR, 'airports.csv')
    temp_airports_list = []
    try:
        with open(AIRPORTS_FILE_PATH, mode='r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            for row in reader:
                # 데이터 유효성 검사 및 형 변환
                if all(k in row for k in ['iata_code', 'latitude', 'longitude']) and row['iata_code']:
                    try:
                        row['latitude'] = float(row['latitude'])
                        row['longitude'] = float(row['longitude'])
                        airports_data[row['iata_code']] = row
                        temp_airports_list.append(row)
                    except (ValueError, TypeError):
                        continue # 좌표값이 숫자가 아니면 무시
    except FileNotFoundError:
        print(f"치명적 오류: '{AIRPORTS_FILE_PATH}' 파일을 찾을 수 없습니다.")
        return

    # 2. 가상 항공 네트워크(그래프) 구축
    max_dist = 1000  # 직항으로 간주할 최대 거리 (km)
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
                airport_graph[iata1].append((iata2, dist))
                airport_graph[iata2].append((iata1, dist))
    
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

    path, total_distance = a_star_search(origin_iata, destination_iata)

    if path:
        return jsonify({"path": path, "total_distance": total_distance})
    else:
        # A*가 경로를 찾지 못한 경우, 직접 연결을 시도 (대권 항로)
        dist = calculate_haversine_distance(airports_data[origin_iata]['latitude'], airports_data[origin_iata]['longitude'], airports_data[destination_iata]['latitude'], airports_data[destination_iata]['longitude'])
        return jsonify({"path": [origin_iata, destination_iata], "total_distance": dist, "message": "직항 경로만 찾았습니다 (A* 경로 없음)"})

# --- 서버 실행 --- #

if __name__ == "__main__":
    load_airports_and_build_graph()
    app.run(host="0.0.0.0", port=5000, debug=True)
