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
- SQLAlchemy
- SQLite

### Frontend

- React
- TypeScript
- Vite
- lucide-react


### 데이터 저장

- SQLAlchemy + 로컬 SQLite
- 기본 DB 파일: `backend/data/meeting_minutes.db`

### 백엔드

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item ..\.env.example ..\.env
------------------------------------------------
OPENAI_API_KEY=api_key
DATABASE_URL=
------------------------------------------------
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### 프론트엔드

```powershell
cd frontend
npm install
npm run dev
```

### API 경로

Swagger 문서: `http://127.0.0.1:8000/docs`