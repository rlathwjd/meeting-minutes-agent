# 회의록 자동 작성 웹 애플리케이션

회의록 양식과 녹취 파일을 기반으로 회의록 작성을 준비하는 React + TypeScript 프론트엔드와 FastAPI 백엔드 기반 시스템

현재 단계에서는 기본 UI, 데이터 모델, API 구조를 우선 구현했으며 OpenAI API 호출 및 Word 문서 생성 기능은 아직 포함하지 않았습니다.

## 1. 주요 기능

- 회의록 양식 등록 및 관리
- txt 녹취 파일 업로드
- 회의 일시, 장소, 회의 형식, 참석자 입력
- 제목 방식 선택: AI 추천 / 직접 입력
- 지정한 양식 기반 회의록 작성

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

## 4. 로컬 개발 및 테스트

### 백엔드 실행

```bash
cd backend
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### 프론트엔드 실행

```bash
cd frontend
npm install
npm run dev
```