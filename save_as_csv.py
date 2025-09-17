import requests
import csv

# 외부 API에서 공항 데이터를 받아오는 함수
def get_airports_from_api():
    url = "https://api.aviationstack.com/v1/airports"  # 실제 API URL을 여기에 넣으세요
    params = {
        "access_key": "65fa732d276f09315de84bcb146023d8",  # API 키를 넣어주세요
    }

    try:
        response = requests.get(url, params=params)  # URL에 파라미터를 추가하여 요청
        response.raise_for_status()  # 오류 발생 시 예외 발생
        return response.json()  # 받아온 데이터를 JSON으로 변환하여 반환
    except requests.exceptions.RequestException as e:
        print(f"API 요청 중 오류가 발생했습니다: {e}")
        return None

# 받아온 공항 데이터를 CSV 파일로 저장하는 함수
def save_airports_to_csv(airports_data, filename='airports.csv'):
    # airport_data의 키들을 기반으로 fieldnames 생성
    if not airports_data:
        print("저장할 공항 데이터가 없습니다.")
        return

    # 첫 번째 항목에서 필드를 동적으로 추출하여 fieldnames를 설정
    fieldnames = airports_data[0].keys()  # 첫 번째 항목의 키들을 필드 이름으로 사용

    with open(filename, mode='w', newline='', encoding='utf-8') as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()  # 헤더 작성
        writer.writerows(airports_data)  # 공항 데이터 작성

    print(f"{filename} 파일로 공항 데이터를 저장했습니다.")

# 데이터 받아오기 및 저장
def fetch_and_save_airports():
    airports_data = get_airports_from_api()  # API에서 공항 데이터 받아오기

    if airports_data:
        save_airports_to_csv(airports_data['data'])  # 받아온 데이터를 CSV로 저장 (응답에 data가 포함되어 있음)

# 실행
fetch_and_save_airports()
