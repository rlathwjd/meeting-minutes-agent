import React from "react";
import { FileText, RefreshCw } from "lucide-react";

import { api } from "../lib/api";
import type { ManagedMinute } from "../types";

export function MinutesPage() {
  const [minutes, setMinutes] = React.useState<ManagedMinute[]>([]);
  const [selectedMinute, setSelectedMinute] = React.useState<ManagedMinute | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState("");

  const loadMinutes = React.useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const data = await api<ManagedMinute[]>("/api/v1/meeting-minutes");
      setMinutes(data);
      setSelectedMinute((current) => data.find((minute) => minute.id === current?.id) ?? data[0] ?? null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "회의록 목록을 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadMinutes();
  }, [loadMinutes]);

  return (
    <section className="workspace minutes-workspace">
      <div className="panel minutes-list-panel">
        <div className="panel-heading">
          <div>
            <h2>회의록 목록</h2>
            <p>DB에 저장된 회의록을 최신 수정 순으로 조회합니다.</p>
          </div>
          <button className="secondary compact-text-button" type="button" onClick={loadMinutes} disabled={isLoading}>
            <RefreshCw size={16} />
            새로고침
          </button>
        </div>

        {errorMessage ? <p className="preview-empty">{errorMessage}</p> : null}

        {minutes.length === 0 && !isLoading ? (
          <p className="empty minutes-empty">저장된 회의록이 없습니다.</p>
        ) : (
          <div className="minutes-table-wrap">
            <table className="minutes-table">
              <thead>
                <tr>
                  <th>회의록 제목</th>
                  <th>프로젝트명</th>
                  <th>회의록 양식명</th>
                  <th>회의 일시</th>
                  <th>참석자</th>
                  <th>상태</th>
                  <th>작성일</th>
                  <th>수정일</th>
                </tr>
              </thead>
              <tbody>
                {minutes.map((minute) => (
                  <tr
                    className={selectedMinute?.id === minute.id ? "selected" : ""}
                    key={minute.id}
                    onClick={() => setSelectedMinute(minute)}
                  >
                    <td>
                      <button className="table-link" type="button" onClick={() => setSelectedMinute(minute)}>
                        {minute.title}
                      </button>
                    </td>
                    <td>{minute.project_name}</td>
                    <td>{minute.template_name || "양식 없음"}</td>
                    <td>{formatDateTime(minute.meeting_at)}</td>
                    <td>{formatAttendees(minute.attendees)}</td>
                    <td>{minute.status}</td>
                    <td>{formatDateTime(minute.created_at)}</td>
                    <td>{formatDateTime(minute.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
