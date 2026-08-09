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

## 3. 환경 변수 설정

```env
OPENAI_API_KEY=api_key
```

LLM 생성 모델은 기본적으로 `gpt-4o-mini`를 사용합니다.

## 4. 로컬 개발 및 테스트

### 백엔드 실행

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### 프론트엔드 실행

```bash
cd frontend
npm install
npm run dev
```

## 5. 향후 구현 예정

- 사이트 내에서 생성된 회의록 문서 관리(DB 연동)
- 생성된 회의록 미리보기
- 사용자 인증 및 권한 관리
- 배포 환경 구성