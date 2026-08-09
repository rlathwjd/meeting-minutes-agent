import React from "react";
import ReactDOM from "react-dom/client";
import { Download, FileText, Plus, Trash2, Upload } from "lucide-react";
import "./styles.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

type View = "compose" | "templates";
type MeetingType = "in_person" | "remote";
type TitleMode = "ai" | "manual";

type Template = {
  id: string;
  name: string;
  description: string;
  original_filename: string;
  size: number;
  created_at: string;
};

type CompanyAttendees = {
  company: string;
  attendeesText: string;
};

function App() {
  const [view, setView] = React.useState<View>("compose");
  const [templates, setTemplates] = React.useState<Template[]>([]);
  const [templateName, setTemplateName] = React.useState("");
  const [templateDescription, setTemplateDescription] = React.useState("");
  const [templateFile, setTemplateFile] = React.useState<File | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = React.useState("");
  const [transcriptFile, setTranscriptFile] = React.useState<File | null>(null);
  const [meetingDatetime, setMeetingDatetime] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [meetingType, setMeetingType] = React.useState<MeetingType>("in_person");
  const [attendees, setAttendees] = React.useState<CompanyAttendees[]>([{ company: "", attendeesText: "" }]);
  const [titleMode, setTitleMode] = React.useState<TitleMode>("ai");
  const [manualTitle, setManualTitle] = React.useState("");
  const [notice, setNotice] = React.useState("");

  const loadTemplates = React.useCallback(async () => {
    const response = await fetch(`${API_BASE}/api/templates`);
    if (!response.ok) {
      throw new Error("양식 목록을 불러오지 못했습니다.");
    }
    const data = (await response.json()) as Template[];
    setTemplates(data);
    setSelectedTemplateId((current) => current || data[0]?.id || "");
  }, []);

  React.useEffect(() => {
    loadTemplates().catch((error: Error) => setNotice(error.message));
  }, [loadTemplates]);

  async function uploadTemplate(event: React.FormEvent) {
    event.preventDefault();
    if (!templateName || !templateFile) {
      setNotice("양식명과 .docx 파일을 입력하세요.");
      return;
    }

    const form = new FormData();
    form.append("name", templateName);
    form.append("description", templateDescription);
    form.append("file", templateFile);

    const response = await fetch(`${API_BASE}/api/templates`, { method: "POST", body: form });
    if (!response.ok) {
      setNotice("양식 업로드에 실패했습니다.");
      return;
    }

    setTemplateName("");
    setTemplateDescription("");
    setTemplateFile(null);
    setNotice("양식이 등록되었습니다.");
    await loadTemplates();
  }

  async function deleteTemplate(templateId: string) {
    const response = await fetch(`${API_BASE}/api/templates/${templateId}`, { method: "DELETE" });
    if (!response.ok) {
      setNotice("양식을 삭제하지 못했습니다.");
      return;
    }
    setNotice("양식이 삭제되었습니다.");
    await loadTemplates();
  }

  async function createDraft(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedTemplateId || !transcriptFile || !meetingDatetime || !location) {
      setNotice("양식, 녹취 파일, 회의 일시, 장소를 입력하세요.");
      return;
    }

    const payload = {
      template_id: selectedTemplateId,
      transcript_filename: transcriptFile.name,
      meeting_datetime: new Date(meetingDatetime).toISOString(),
      location,
      meeting_type: meetingType,
      attendees_by_company: attendees
        .filter((row) => row.company.trim())
        .map((row) => ({
          company: row.company.trim(),
          attendees: row.attendeesText
            .split(",")
            .map((name) => name.trim())
            .filter(Boolean),
        })),
      title_mode: titleMode,
      manual_title: titleMode === "manual" ? manualTitle : null,
    };

    const form = new FormData();
    form.append("payload", JSON.stringify(payload));
    form.append("transcript", transcriptFile);

    const response = await fetch(`${API_BASE}/api/minutes/drafts`, { method: "POST", body: form });
    if (!response.ok) {
      setNotice("회의록 초안 요청을 저장하지 못했습니다.");
      return;
    }

    setNotice("회의록 작성 요청이 저장되었습니다. AI 작성과 Word 생성은 다음 단계에서 연결됩니다.");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <FileText size={28} />
          <div>
            <strong>회의록 자동 작성</strong>
            <span>Minutes Agent</span>
          </div>
        </div>
        <nav>
          <button className={view === "compose" ? "active" : ""} onClick={() => setView("compose")}>
            회의록 작성
          </button>
          <button className={view === "templates" ? "active" : ""} onClick={() => setView("templates")}>
            회의록 양식 관리
          </button>
        </nav>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <h1>{view === "compose" ? "회의록 작성" : "회의록 양식 관리"}</h1>
            <p>OpenAI API 호출과 Word 생성 전, 입력 흐름과 API 데이터를 먼저 정리합니다.</p>
          </div>
        </header>

        {notice && <div className="notice">{notice}</div>}

        {view === "compose" ? (
          <ComposeForm
            templates={templates}
            selectedTemplateId={selectedTemplateId}
            setSelectedTemplateId={setSelectedTemplateId}
            setTranscriptFile={setTranscriptFile}
            meetingDatetime={meetingDatetime}
            setMeetingDatetime={setMeetingDatetime}
            location={location}
            setLocation={setLocation}
            meetingType={meetingType}
            setMeetingType={setMeetingType}
            attendees={attendees}
            setAttendees={setAttendees}
            titleMode={titleMode}
            setTitleMode={setTitleMode}
            manualTitle={manualTitle}
            setManualTitle={setManualTitle}
            createDraft={createDraft}
          />
        ) : (
          <TemplateManager
            templates={templates}
            templateName={templateName}
            setTemplateName={setTemplateName}
            templateDescription={templateDescription}
            setTemplateDescription={setTemplateDescription}
            setTemplateFile={setTemplateFile}
            uploadTemplate={uploadTemplate}
            deleteTemplate={deleteTemplate}
          />
        )}
      </main>
    </div>
  );
}

function ComposeForm(props: {
  templates: Template[];
  selectedTemplateId: string;
  setSelectedTemplateId: (value: string) => void;
  setTranscriptFile: (file: File | null) => void;
  meetingDatetime: string;
  setMeetingDatetime: (value: string) => void;
  location: string;
  setLocation: (value: string) => void;
  meetingType: MeetingType;
  setMeetingType: (value: MeetingType) => void;
  attendees: CompanyAttendees[];
  setAttendees: (value: CompanyAttendees[]) => void;
  titleMode: TitleMode;
  setTitleMode: (value: TitleMode) => void;
  manualTitle: string;
  setManualTitle: (value: string) => void;
  createDraft: (event: React.FormEvent) => void;
}) {
  return (
    <form className="workspace" onSubmit={props.createDraft}>
      <section className="panel">
        <h2>기본 정보</h2>
        <div className="form-grid">
          <label>
            등록된 양식
            <select value={props.selectedTemplateId} onChange={(event) => props.setSelectedTemplateId(event.target.value)}>
              <option value="">양식을 선택하세요</option>
              {props.templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            txt 녹취 파일
            <input type="file" accept=".txt,text/plain" onChange={(event) => props.setTranscriptFile(event.target.files?.[0] ?? null)} />
          </label>
          <label>
            회의 일시
            <input type="datetime-local" value={props.meetingDatetime} onChange={(event) => props.setMeetingDatetime(event.target.value)} />
          </label>
          <label>
            회의 장소
            <input value={props.location} onChange={(event) => props.setLocation(event.target.value)} placeholder="예: 본사 7층 회의실" />
          </label>
        </div>

        <fieldset>
          <legend>회의 형식</legend>
          <div className="segmented">
            <button type="button" className={props.meetingType === "in_person" ? "selected" : ""} onClick={() => props.setMeetingType("in_person")}>
              대면
            </button>
            <button type="button" className={props.meetingType === "remote" ? "selected" : ""} onClick={() => props.setMeetingType("remote")}>
              비대면
            </button>
          </div>
        </fieldset>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>회사별 참석자</h2>
          <button
            type="button"
            className="icon-button"
            title="참석자 행 추가"
            onClick={() => props.setAttendees([...props.attendees, { company: "", attendeesText: "" }])}
          >
            <Plus size={18} />
          </button>
        </div>
        <div className="attendee-list">
          {props.attendees.map((row, index) => (
            <div className="attendee-row" key={index}>
              <input
                value={row.company}
                onChange={(event) => updateAttendee(props, index, "company", event.target.value)}
                placeholder="회사명"
              />
              <input
                value={row.attendeesText}
                onChange={(event) => updateAttendee(props, index, "attendeesText", event.target.value)}
                placeholder="참석자명, 쉼표로 구분"
              />
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>제목</h2>
        <fieldset>
          <legend>제목 방식</legend>
          <div className="segmented">
            <button type="button" className={props.titleMode === "ai" ? "selected" : ""} onClick={() => props.setTitleMode("ai")}>
              AI 추천
            </button>
            <button type="button" className={props.titleMode === "manual" ? "selected" : ""} onClick={() => props.setTitleMode("manual")}>
              직접 입력
            </button>
          </div>
        </fieldset>
        {props.titleMode === "manual" && (
          <label>
            직접 입력 제목
            <input value={props.manualTitle} onChange={(event) => props.setManualTitle(event.target.value)} placeholder="회의록 제목" />
          </label>
        )}
      </section>

      <div className="actions">
        <button className="primary" type="submit">
          <Upload size={18} />
          작성 요청 저장
        </button>
      </div>
    </form>
  );
}

function updateAttendee(
  props: { attendees: CompanyAttendees[]; setAttendees: (value: CompanyAttendees[]) => void },
  index: number,
  field: keyof CompanyAttendees,
  value: string,
) {
  props.setAttendees(props.attendees.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)));
}

function TemplateManager(props: {
  templates: Template[];
  templateName: string;
  setTemplateName: (value: string) => void;
  templateDescription: string;
  setTemplateDescription: (value: string) => void;
  setTemplateFile: (file: File | null) => void;
  uploadTemplate: (event: React.FormEvent) => void;
  deleteTemplate: (templateId: string) => void;
}) {
  return (
    <div className="workspace two-column">
      <form className="panel" onSubmit={props.uploadTemplate}>
        <h2>.docx 양식 업로드</h2>
        <label>
          양식명
          <input value={props.templateName} onChange={(event) => props.setTemplateName(event.target.value)} placeholder="예: 주간 회의록" />
        </label>
        <label>
          설명
          <textarea
            value={props.templateDescription}
            onChange={(event) => props.setTemplateDescription(event.target.value)}
            placeholder="양식 용도나 포함 항목"
          />
        </label>
        <label>
          .docx 파일
          <input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => props.setTemplateFile(event.target.files?.[0] ?? null)} />
        </label>
        <button className="primary" type="submit">
          <Upload size={18} />
          업로드
        </button>
      </form>

      <section className="panel">
        <h2>양식 목록</h2>
        <div className="template-list">
          {props.templates.length === 0 ? (
            <p className="empty">등록된 양식이 없습니다.</p>
          ) : (
            props.templates.map((template) => (
              <article className="template-card" key={template.id}>
                <div>
                  <strong>{template.name}</strong>
                  <p>{template.description || "설명 없음"}</p>
                  <span>{template.original_filename}</span>
                </div>
                <div className="card-actions">
                  <a className="icon-button" title="양식 다운로드" href={`${API_BASE}/api/templates/${template.id}/download`}>
                    <Download size={18} />
                  </a>
                  <button className="icon-button danger" title="양식 삭제" type="button" onClick={() => props.deleteTemplate(template.id)}>
                    <Trash2 size={18} />
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
