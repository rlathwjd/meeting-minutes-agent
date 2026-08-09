from typing import Any, Dict


MINUTES_JSON_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "title": {"type": "string"},
        "summary": {"type": "string"},
        "agenda": {
            "type": "array",
            "items": {"type": "string"},
        },
        "decisions": {
            "type": "array",
            "items": {"type": "string"},
        },
        "action_items": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "task": {"type": "string"},
                    "owner": {"type": "string"},
                    "due_date": {"type": "string"},
                },
                "required": ["task", "owner", "due_date"],
            },
        },
        "notes": {
            "type": "array",
            "items": {"type": "string"},
        },
    },
    "required": ["title", "summary", "agenda", "decisions", "action_items", "notes"],
}


def build_minutes_prompt(payload: Dict[str, Any], transcript_text: str) -> str:
    attendees = payload.get("attendees_by_company", [])
    attendee_lines = []
    for row in attendees:
        company = row.get("company", "")
        names = ", ".join(row.get("attendees", []))
        attendee_lines.append(f"- {company}: {names}".strip())

    title_instruction = (
        f"사용자가 직접 입력한 제목을 그대로 사용하세요: {payload.get('manual_title')}"
        if payload.get("manual_title")
        else (
            "title은 녹취록의 주요 내용을 먼저 요약한 뒤, 가장 중요한 안건/결정사항/후속조치가 드러나도록 생성하세요. "
            "단순히 '정기 회의'처럼 일반적인 제목을 쓰지 말고, 회의의 핵심 주제가 제목만 봐도 이해되게 작성하세요. "
            "제목은 20자 안팎의 한국어 명사형 문장으로 간결하게 작성하세요."
        )
    )

    return f"""
당신은 한국어 회의록 작성 담당자입니다.
녹취록을 읽고 아래 지정된 Word 회의록 양식에 바로 들어갈 내용을 간결하고 업무적으로 정리하세요.

사용할 양식 구조:
- 제    목: title 값이 들어갑니다.
- 일    시 / 장    소 / 참 석 자 / 형    식 / 작성자: 사용자가 입력한 기본 정보가 들어갑니다.
- 회의내용: summary, agenda, decisions, notes를 조합해 들어갑니다.
- 실제 Action Item: action_items 값이 들어갑니다.

작성 원칙:
- 추측하지 말고 녹취록에서 확인되는 내용만 작성합니다.
- 중복 발언과 군더더기는 제거합니다.
- 결정사항과 후속조치는 구분합니다.
- 후속조치 담당자나 기한이 불명확하면 빈 문자열로 둡니다.
- 모든 문장은 한국어 존댓말이 아닌 회의록 문체로 작성합니다.
- title을 작성하기 전에 summary, agenda, decisions, action_items를 기준으로 회의의 핵심을 파악합니다.
- {title_instruction}

회의내용 칸 작성 기준:
- summary는 회의 전체 흐름을 2~4문장으로 요약합니다.
- agenda는 실제 논의된 주요 안건만 2~5개로 정리합니다.
- decisions는 확정된 결정사항만 작성합니다. 결정된 내용이 없으면 빈 배열로 둡니다.
- notes는 참고사항, 이슈, 리스크, 다음 논의 필요사항만 작성합니다.
- 회의내용 칸에 들어갔을 때 읽기 쉽도록 각 항목은 짧고 명확하게 작성합니다.

실제 Action Item 칸 작성 기준:
- action_items에는 실행이 필요한 일만 작성합니다.
- task는 구체적인 동작으로 작성합니다.
- owner는 가능하면 회사명과 담당자명을 함께 적습니다. 예: "CSLEE 김소정"
- due_date는 녹취록에 명시된 기한만 적고, 없으면 빈 문자열로 둡니다.
- 담당자별 할 일이 없으면 action_items는 빈 배열로 둡니다.

회의 정보:
- 회의 일시: {payload.get("meeting_datetime", "")}
- 회의 장소: {payload.get("location", "")}
- 작성자: {payload.get("author", "")}
- 회의 형식: {payload.get("meeting_type", "")}
- 참석자:
{chr(10).join(attendee_lines) if attendee_lines else "- 참석자 정보 없음"}

녹취록:
{transcript_text.strip() or "녹취 내용이 비어 있습니다."}
""".strip()
