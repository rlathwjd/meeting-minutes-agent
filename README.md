# 회의록 자동 작성 웹 애플리케이션

회의록 양식과 녹취 파일을 기반으로 회의록 작성을 준비하는 React + TypeScript 프론트엔드와 FastAPI 백엔드 기반 시스템

현재 단계에서는 기본 UI, 데이터 모델, API 구조를 우선 구현했으며 OpenAI API 호출 및 Word 문서 생성 기능은 아직 포함하지 않았습니다.

## 1. 주요 기능

- 회의록 작성 입력 화면
- 등록된 회의록 양식 선택
- txt 녹취 파일 업로드
- 회의 일시, 장소, 회의 형식 입력
- 회사별 참석자 입력
- 제목 방식 선택: AI 추천 / 직접 입력
- 회의록 양식 관리
- .docx 양식 업로드
- 양식명 / 설명 입력
- 양식 목록 조회
- 양식 다운로드
- 양식 삭제

## 2. 기술 스택

### 프론트엔드

- React
- TypeScript
- Vite
- lucide-react

### 백엔드

- Python
- FastAPI
- Pydantic
- Uvicorn

### 데이터 저장

- 로컬 JSON 파일
- 업로드 파일 로컬 저장

## 3. 프로젝트 구조

```text
meeting_minutes_agent/
├─ backend/
│  ├─ app/
│  │  ├─ main.py
│  │  ├─ models.py
│  │  └─ storage.py
│  ├─ data/
│  │  ├─ templates/
│  │  ├─ transcripts/
│  │  ├─ templates.json
│  │  └─ minutes_drafts.json
│  └─ requirements.txt
└─ frontend/
   ├─ src/
   │  ├─ main.tsx
   │  ├─ styles.css
   │  └─ vite-env.d.ts
   ├─ index.html
   ├─ package.json
   └─ vite.config.ts
```

## 4. 환경 변수 설정

현재 단계에서는 필수 환경 변수가 없습니다.

프론트엔드에서 백엔드 API 주소를 변경해야 하는 경우 `.env` 파일에 아래 값을 추가합니다.

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

추후 OpenAI API 및 Word 생성 기능을 연결할 때 다음과 같은 환경 변수를 추가할 예정입니다.

```env
OPENAI_API_KEY=api_key
```

## 5. 로컬 개발 및 테스트

### 백엔드 실행

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

백엔드 확인:

```bash
curl http://127.0.0.1:8000/health
```

### 프론트엔드 실행

```bash
cd frontend
npm install
npm run dev
```

프론트엔드 접속:

```text
http://127.0.0.1:5173
```

### 프론트엔드 빌드

```bash
cd frontend
npm run build
```

## 6. API 구조

### Health Check

- `GET /health`

### 회의록 양식 관리

- `GET /api/templates`
- `POST /api/templates`
- `GET /api/templates/{template_id}/download`
- `DELETE /api/templates/{template_id}`

### 회의록 작성 요청

- `GET /api/minutes/drafts`
- `POST /api/minutes/drafts`

## 7. 현재 구현 범위

- React + TypeScript 기반 기본 화면 구현
- FastAPI 기반 API 구조 구현
- Pydantic 데이터 모델 구현
- .docx 양식 업로드 / 다운로드 / 삭제 구현
- txt 녹취 파일 업로드를 포함한 회의록 작성 요청 저장 구현
- 로컬 JSON 기반 임시 저장소 구현

## 8. 향후 구현 예정

- OpenAI API 기반 회의록 제목 추천
- 녹취록 기반 회의록 본문 생성
- .docx 양식에 맞춘 Word 문서 생성
- 생성된 회의록 다운로드
- 데이터베이스 연동
- 사용자 인증 및 권한 관리
- 배포 환경 구성
