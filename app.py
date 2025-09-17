import csv
from flask import Flask, render_template, jsonify
from flask_cors import CORS

app = Flask(__name__)

# CORS 설정 (로컬에서 API를 호출할 수 있도록 설정)
CORS(app, origins=["http://127.0.0.1:5500"])

# 공항 데이터 파일 경로 (CSV)
AIRPORTS_FILE_PATH = 'airports.csv'

# CSV에서 공항 데이터 로드하는 함수
def load_airports_from_csv():
    airports = []
    try:
        # CSV 파일 읽기
        with open(AIRPORTS_FILE_PATH, mode='r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            for row in reader:
                airports.append(row)  # CSV에서 읽어온 데이터를 공항 리스트에 추가
    except Exception as e:
        print(f"CSV 파일 읽기 중 오류가 발생했습니다: {e}")
    return airports

# 홈 페이지 경로 (index.html 렌더링)
@app.route("/")
def home():
    return render_template("index.html")  # templates 폴더에 있는 index.html 파일을 렌더링

# 공항 데이터 제공 경로
@app.route("/airports", methods=["GET"])
def get_airports():
    airports = load_airports_from_csv()  # CSV에서 공항 데이터 불러오기
    if airports:
        return jsonify(airports)  # 공항 데이터를 JSON 형식으로 반환
    else:
        return jsonify({"error": "공항 데이터를 불러올 수 없습니다."}), 500

# 앱 실행
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
