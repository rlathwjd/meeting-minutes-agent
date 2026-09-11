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

## 3. 환경 변수 설정

```env
# .env.example을 .env로 복사한 뒤 필요한 값을 채웁니다.
OPENAI_API_KEY=api_key
DATABASE_URL=
```

`DATABASE_URL`을 비워두면 로컬 SQLite DB(`backend/data/meeting_minutes.db`)를 사용합니다.


### 백엔드

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
if (!(Test-Path ..\.env)) { Copy-Item ..\.env.example ..\.env }
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### 프론트엔드

```powershell
cd frontend
npm install
npm run dev
```

프론트엔드는 기본으로 `http://127.0.0.1:8000` API 서버에 연결합니다. 다른 주소를 사용할 때는 `frontend/.env.example`을 `frontend/.env`로 복사한 뒤 `VITE_API_BASE_URL`을 수정합니다.

### API 경로

Swagger 문서: `http://127.0.0.1:8000/docs`
