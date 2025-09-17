import csv
from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)

# CORS 설정
CORS(app, origins=["http://127.0.0.1:5500"])  # 로컬 서버에서 접근 허용

# 공항 데이터 파일 경로 (CSV)
AIRPORTS_FILE_PATH = 'airports.csv'

# CSV에서 공항 데이터 로드
def load_airports_from_csv():
    airports = []
    with open(AIRPORTS_FILE_PATH, mode='r', encoding='utf-8') as file:
        reader = csv.DictReader(file)
        for row in reader:
            airports.append(row)  # 각 행을 공항 정보로 추가
    return airports

@app.route("/airports", methods=["GET"])
def get_airports():
    airports = load_airports_from_csv()  # CSV에서 공항 데이터 불러오기
    return jsonify(airports)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
