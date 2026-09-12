import React from "react";
import { FileText, Trash2 } from "lucide-react";

import { api } from "../lib/api";
import type { ManagedMinute } from "../types";

export function MinutesPage(props: { onEditMinute: (minuteId: string) => void }) {
  const [minutes, setMinutes] = React.useState<ManagedMinute[]>([]);
  const [selectedMinuteId, setSelectedMinuteId] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState("");
  const selectedMinute = minutes.find((minute) => minute.id === selectedMinuteId) ?? null;

  const loadMinutes = React.useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const data = await api<ManagedMinute[]>("/api/v1/meeting-minutes");
      setMinutes(data);
      setSelectedMinuteId((current) => (current && data.some((minute) => minute.id === current) ? current : null));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "회의록 목록을 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  async function deleteMinute(event: React.MouseEvent, minuteId: string) {
    event.stopPropagation();
    if (!window.confirm("회의록을 삭제할까요?")) {
      return;
    }
    try {
      await api<void>(`/api/v1/meeting-minutes/${minuteId}`, { method: "DELETE" });
      setSelectedMinuteId((current) => (current === minuteId ? null : current));
      await loadMinutes();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "회의록을 삭제하지 못했습니다.");
    }
  }

  function editMinute(event: React.MouseEvent, minuteId: string) {
    event.stopPropagation();
    props.onEditMinute(minuteId);
  }

  React.useEffect(() => {
    loadMinutes();
  }, [loadMinutes]);

  return (
    <section className="workspace minutes-workspace">
      <div className="panel minutes-list-panel">
        <div className="panel-heading">
          <div>
            <h2>회의록 목록</h2>
          </div>
        </div>

        {errorMessage ? <p className="preview-empty">{errorMessage}</p> : null}

        {minutes.length === 0 && !isLoading ? (
          <p className="empty minutes-empty">저장된 회의록이 없습니다.</p>
        ) : (
          <div className="project-list minute-list">
            {minutes.map((minute) => (
              <article
                className={selectedMinuteId === minute.id ? "project-row minute-list-card selected" : "project-row minute-list-card"}
                key={minute.id}
                onClick={() => setSelectedMinuteId(minute.id)}
              >
                <div>
                  <strong>{minute.title}</strong>
                  <p>{minute.project_name}</p>
                  <span>{formatDateTime(minute.meeting_at)}</span>
                </div>
                <div className="card-actions">
                  <button className="secondary compact-text-button" type="button" onClick={(event) => editMinute(event, minute.id)}>
                    수정
                  </button>
                  <button className="danger-button" title="회의록 삭제" type="button" onClick={(event) => deleteMinute(event, minute.id)}>
                    <Trash2 size={18} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <MinuteDetail minute={selectedMinute} />
    </section>
  );
}

function MinuteDetail(props: { minute: ManagedMinute | null }) {
  if (!props.minute) {
    return (
      <aside className="panel minute-detail-panel">
        <div className="empty-detail">
          <FileText size={28} />
          <p>목록에서 회의록을 선택하세요.</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="panel minute-detail-panel">
      <h2>회의록 상세</h2>
      <div className="detail-grid">
        <DetailItem label="제목" value={props.minute.title} />
        <DetailItem label="프로젝트" value={props.minute.project_name} />
        <DetailItem label="사용한 양식" value={props.minute.template_name || "양식 없음"} />
        <DetailItem label="회의 일시" value={formatDateTime(props.minute.meeting_at)} />
        <DetailItem label="참석자" value={formatAttendees(props.minute.attendees)} />
        <DetailItem label="상태" value={props.minute.status} />
        <DetailItem label="작성일" value={formatDateTime(props.minute.created_at)} />
        <DetailItem label="수정일" value={formatDateTime(props.minute.updated_at)} />
      </div>
      <div className="content-block">
        <strong>content</strong>
        <pre>{JSON.stringify(props.minute.content, null, 2)}</pre>
      </div>
    </aside>
  );
}

function DetailItem(props: { label: string; value: string }) {
  return (
    <div className="detail-item">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
}

function formatAttendees(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    return "-";
  }
  const names = value.flatMap((item) => {
    if (typeof item === "string") {
      return item;
    }
    if (item && typeof item === "object" && "attendees" in item) {
      const attendees = (item as { attendees?: unknown }).attendees;
      return Array.isArray(attendees) ? attendees.map(String) : [];
    }
    return [];
  });
  return names.length ? names.join(", ") : "-";
}
