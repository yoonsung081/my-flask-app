# app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import heapq

app = Flask(__name__)
CORS(app, origins=["http://127.0.0.1:5500"])

# Aviationstack API 키
API_KEY = "65fa732d276f09315de84bcb146023d8"

# 공항 데이터 가져오기 (외부 API)
def fetch_airports(country=None):
    url = f"http://api.aviationstack.com/v1/airports?access_key={API_KEY}"
    if country:
        url += f"&country_name={country}"
    try:
        response = requests.get(url, timeout=5)
        response.raise_for_status()
        data = response.json()
        airports = [
            {
                "code": item["iata_code"],
                "name": item["airport_name"],
                "city": item["city"],
                "country": item["country_name"]
            }
            for item in data.get("data", [])
            if item.get("iata_code")
        ]
        return airports
    except requests.RequestException as e:
        print("API 요청 실패:", e)
        return []

# 예시 그래프 (실제 거리 데이터로 대체 필요)
# key: 출발 공항, value: {도착 공항: 거리}
graph = {
    "ICN": {"GMP": 30, "PUS": 50},
    "GMP": {"ICN": 30, "PUS": 70},
    "PUS": {"ICN": 50, "GMP": 70},
}

# Dijkstra 알고리즘
def dijkstra(start, end):
    heap = [(0, start, [start])]
    visited = set()
    while heap:
        cost, node, path = heapq.heappop(heap)
        if node == end:
            return {"cost": cost, "path": path}
        if node in visited:
            continue
        visited.add(node)
        for neighbor, weight in graph.get(node, {}).items():
            if neighbor not in visited:
                heapq.heappush(heap, (cost + weight, neighbor, path + [neighbor]))
    return None

# 공항 검색 API
@app.route("/airports", methods=["GET"])
def airports():
    country = request.args.get("country")  # Korea, Japan 등
    airports = fetch_airports(country)
    return jsonify(airports)

# 최적 경로 API
@app.route("/route", methods=["GET"])
def route():
    start = request.args.get("start")  # 출발 공항 코드
    end = request.args.get("end")      # 도착 공항 코드
    if not start or not end:
        return jsonify({"error": "start, end 파라미터 필요"}), 400
    result = dijkstra(start, end)
    if not result:
        return jsonify({"error": "경로를 찾을 수 없음"}), 404
    return jsonify(result)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
