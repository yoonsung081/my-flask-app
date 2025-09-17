import csv
from flask import Flask, render_template, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# 공항 데이터 파일 경로 (CSV)
AIRPORTS_FILE_PATH = 'airports.csv'

# CSV에서 공항 데이터 로드하는 함수
def load_airports_from_csv():
    airports = []
    try:
        with open(AIRPORTS_FILE_PATH, mode='r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            for row in reader:
                airports.append(row)
    except Exception as e:
        print(f"CSV 파일 읽기 중 오류가 발생했습니다: {e}")
    return airports

# 홈 페이지 경로 (index.html 렌더링)
@app.route("/")
def home():
    return render_template("index.html")

# 공항 데이터 제공 경로
@app.route("/airports", methods=["GET"])
def get_airports():
    airports = load_airports_from_csv()  # CSV에서 공항 데이터 불러오기
    if airports:
        return jsonify(airports)  # 공항 데이터를 JSON 형식으로 반환
    else:
        return jsonify({"error": "공항 데이터를 불러올 수 없습니다."}), 500

# 경로 계산 (간단한 예시로, 출발지와 목적지 간의 직선 거리를 계산하는 방식)
@app.route("/calculate_route", methods=["POST"])
def calculate_route():
    data = request.json
    origin = data.get('origin')
    destination = data.get('destination')

    # 공항 데이터 불러오기
    airports = load_airports_from_csv()

    # 출발지와 목적지 공항 찾기
    origin_airport = next((airport for airport in airports if airport['iata_code'] == origin), None)
    destination_airport = next((airport for airport in airports if airport['iata_code'] == destination), None)

    if not origin_airport or not destination_airport:
        return jsonify({"error": "출발지 또는 목적지가 유효하지 않습니다."}), 400

    # 여기서는 단순히 직선 거리 계산을 예시로 사용
    origin_lat, origin_lon = float(origin_airport['latitude']), float(origin_airport['longitude'])
    dest_lat, dest_lon = float(destination_airport['latitude']), float(destination_airport['longitude'])

    # 두 지점 간의 직선 거리 (단순한 예시: 구면 거리 계산이 필요함)
    distance = calculate_distance(origin_lat, origin_lon, dest_lat, dest_lon)

    return jsonify({"origin": origin, "destination": destination, "distance": distance})

# 두 지점 간의 직선 거리 계산 함수 (단위: 킬로미터)
def calculate_distance(lat1, lon1, lat2, lon2):
    from math import radians, cos, sin, sqrt, atan2

    # 지구 반경 (킬로미터)
    R = 6371.0

    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])

    dlon = lon2 - lon1
    dlat = lat2 - lat1

    a = sin(dlat / 2)**2 + cos(lat1) * cos(lat2) * sin(dlon / 2)**2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))

    distance = R * c
    return distance

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
