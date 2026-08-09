# 회의록 자동 작성 웹 애플리케이션

회의록 양식과 녹취 텍스트 파일을 기반으로 회의록을 작성하는 시스템


## 1. 주요 기능

- 회의록 양식 등록 및 관리
- txt 녹취 파일 업로드
- 회의 일시, 장소, 회의 형식, 참석자 입력
- 제목 방식 선택: AI 추천 / 직접 입력
- 지정한 양식 기반 회의록 작성

## 2. 기술 스택

### Backend

- Python
- FastAPI
- Pydantic
- Uvicorn

### Frontend

- React
- TypeScript
- Vite
- lucide-react


### 데이터 저장

- 로컬 JSON 파일
- 업로드 파일 로컬 저장

## 4. 로컬 개발 및 테스트

### Backend

```bash
cd backend
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```