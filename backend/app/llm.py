import json
from typing import Any, Dict

from openai import OpenAI, OpenAIError

from .config import get_llm_settings
from .prompts import MINUTES_JSON_SCHEMA, build_minutes_prompt


class LLMConfigurationError(RuntimeError):
    pass


class LLMGenerationError(RuntimeError):
    pass


def generate_minutes_content(payload: Dict[str, Any], transcript_text: str) -> Dict[str, Any]:
    settings = get_llm_settings()
    if not settings.api_key:
        raise LLMConfigurationError("OPENAI_API_KEY 또는 LLM_API_KEY를 .env에 설정하세요.")

    if settings.provider not in {"openai", "openai-compatible"}:
        raise LLMConfigurationError("현재 회의록 생성은 openai 또는 openai-compatible provider만 지원합니다.")

    client_kwargs: Dict[str, Any] = {"api_key": settings.api_key}
    if settings.base_url:
        client_kwargs["base_url"] = settings.base_url

    client = OpenAI(**client_kwargs)
    prompt = build_minutes_prompt(payload, transcript_text)

    try:
        response = client.responses.create(
            model=settings.model,
            input=[
                {
                    "role": "system",
                    "content": "You write accurate Korean business meeting minutes from transcripts.",
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
            text={
                "format": {
                    "type": "json_schema",
                    "name": "meeting_minutes",
                    "schema": MINUTES_JSON_SCHEMA,
                    "strict": True,
                }
            },
        )
    except OpenAIError as error:
        raise LLMGenerationError(f"LLM 호출에 실패했습니다: {error}") from error

    try:
        return json.loads(response.output_text)
    except json.JSONDecodeError as error:
        raise LLMGenerationError("LLM 응답을 JSON으로 해석하지 못했습니다.") from error
