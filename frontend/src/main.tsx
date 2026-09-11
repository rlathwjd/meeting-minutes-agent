import React from "react";
import ReactDOM from "react-dom/client";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Download, FileText, GripVertical, Plus, Trash2, Upload, X } from "lucide-react";
import "./styles.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";
const GENERATION_STEPS = [
  "녹취 파일을 읽고 있습니다.",
  "회의 주요 내용을 요약하는 중입니다.",
  "결정사항과 Action Item을 정리하고 있습니다.",
  "회의록 양식에 내용을 채우고 있습니다.",
  "Word 파일을 준비하고 있습니다.",
];

type View = "compose" | "result" | "templates" | "projects";
type MeetingType = "in_person" | "remote";
type TitleMode = "ai" | "manual";
type Meridiem = "AM" | "PM";

type Template = {
  project_id: string;
  template_data: { file?: { original_filename: string; size: number } };
  id: string;
  name: string;
  description: string;
  original_filename: string;
  size: number;
  created_at: string;
};

type Project = {
  id: string;
  name: string;
  description: string;
  template_ids: string[];
  locations: string[];
  companies: string[];
  attendees: string[];
  created_at: string;
};

type CompanyAttendees = {
  company: string;
  attendeesText: string;
};

type GeneratedMinutes = {
  filename: string;
  url: string;
  previewUrl: string;
  size: number;
  mimeType: string;
  titleMode: TitleMode;
  title: string;
};

type Toast = {
  id: number;
  view: View;
  message: string;
};

type SavedMinute = {
  id: string; project_id: string; template_id: string | null; title: string;
  meeting_at: string | null; status: string;
  content: { input?: Record<string, any>; transcript_text?: string; minutes?: Record<string, unknown>;
    document?: { filename: string; preview_url: string } };
};
const MINUTE_STATUS = { DRAFT: "draft", COMPLETED: "completed" } as const;
async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(API_BASE + path, options);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(typeof body?.detail === "string" ? body.detail : "요청을 처리하지 못했습니다.");
  }
  return response.status === 204 ? undefined as T : response.json();
}
function App() {
  const [savedMinutes, setSavedMinutes] = React.useState<SavedMinute[]>([]);
  const [editingMinuteId, setEditingMinuteId] = React.useState<string | null>(null);
  const [storedTranscript, setStoredTranscript] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const mainRef = React.useRef<HTMLElement | null>(null);
  const [view, setView] = React.useState<View>("compose");
  const [templates, setTemplates] = React.useState<Template[]>([]);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = React.useState("");
  const activeProjectId = React.useRef(selectedProjectId);
  activeProjectId.current = selectedProjectId;
  const [templateName, setTemplateName] = React.useState("");
  const [templateDescription, setTemplateDescription] = React.useState("");
  const [templateFile, setTemplateFile] = React.useState<File | null>(null);
  const [editingTemplateId, setEditingTemplateId] = React.useState<string | null>(null);
  const [projectName, setProjectName] = React.useState("");
  const [projectDescription, setProjectDescription] = React.useState("");
  const [projectTemplateIds, setProjectTemplateIds] = React.useState<string[]>([]);
  const [projectLocations, setProjectLocations] = React.useState<string[]>([]);
  const [projectCompanies, setProjectCompanies] = React.useState<string[]>([]);
  const [projectAttendees, setProjectAttendees] = React.useState<string[]>([]);
  const [projectLocationInput, setProjectLocationInput] = React.useState("");
  const [projectCompanyInput, setProjectCompanyInput] = React.useState("");
  const [projectAttendeeInput, setProjectAttendeeInput] = React.useState("");
  const [editingProjectId, setEditingProjectId] = React.useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = React.useState("");
  const [transcriptFile, setTranscriptFile] = React.useState<File | null>(null);
  const [meetingDatetime, setMeetingDatetime] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [author, setAuthor] = React.useState("");
  const [meetingType, setMeetingType] = React.useState<MeetingType>("in_person");
  const [attendees, setAttendees] = React.useState<CompanyAttendees[]>([{ company: "", attendeesText: "" }]);
  const [draggedAttendeeIndex, setDraggedAttendeeIndex] = React.useState<number | null>(null);
  const [attendeeDropIndex, setAttendeeDropIndex] = React.useState<number | null>(null);
  const [titleMode, setTitleMode] = React.useState<TitleMode>("ai");
  const [manualTitle, setManualTitle] = React.useState("");
  const [toast, setToast] = React.useState<Toast | null>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [generationProgress, setGenerationProgress] = React.useState(0);
  const [generationStepIndex, setGenerationStepIndex] = React.useState(0);
  const [generatedMinutes, setGeneratedMinutes] = React.useState<GeneratedMinutes | null>(null);

  function showToast(message: string, toastView: View = view) {
    setToast({ id: Date.now(), view: toastView, message });
  }

  const loadTemplates = React.useCallback(async () => {
    if (!selectedProjectId) { setTemplates([]); return; }
    const data = await api<Template[]>(`/api/v1/projects/${selectedProjectId}/meeting-templates`);
    if (activeProjectId.current !== selectedProjectId) return;
    setTemplates(data.map(item => ({ ...item, original_filename: item.template_data.file?.original_filename || "JSON 양식", size: item.template_data.file?.size || 0 })));
  }, [selectedProjectId]);

  const loadProjects = React.useCallback(async () => {
    const data = await api<Project[]>("/api/v1/projects");
    setProjects(data);
    setSelectedProjectId(current => data.some(item => item.id === current) ? current : data[0]?.id || "");
  }, []);

  const loadMinutes = React.useCallback(async () => {
    if (!selectedProjectId) { setSavedMinutes([]); return; }
    const data = await api<SavedMinute[]>(`/api/v1/projects/${selectedProjectId}/meeting-minutes`);
    if (activeProjectId.current === selectedProjectId) setSavedMinutes(data);
  }, [selectedProjectId]);

  React.useEffect(() => { loadProjects().catch(error => showToast(error.message)); }, [loadProjects]);
  React.useEffect(() => {
    setTemplates([]);
    setSavedMinutes([]);
    setEditingMinuteId(null);
    setSelectedTemplateId("");
    setTranscriptFile(null);
    setStoredTranscript("");
    setManualTitle("");
    setMeetingDatetime("");
    setLocation("");
    setAuthor("");
    setAttendees([{ company: "", attendeesText: "" }]);
    resetTemplateForm();
    loadTemplates().catch(error => showToast(error.message));
    loadMinutes().catch(error => showToast(error.message));
  }, [loadTemplates, loadMinutes]);

  React.useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  React.useEffect(() => {
    if (!isGenerating) {
      return;
    }

    const timer = window.setInterval(() => {
      setGenerationProgress((current) => Math.min(94, current + (current < 55 ? 9 : 4)));
      setGenerationStepIndex((current) => Math.min(GENERATION_STEPS.length - 1, current + 1));
    }, 1200);

    return () => window.clearInterval(timer);
  }, [isGenerating]);

  React.useEffect(() => {
    return () => {
      if (generatedMinutes?.url) {
        URL.revokeObjectURL(generatedMinutes.url);
      }
    };
  }, [generatedMinutes?.url]);

  async function uploadTemplate(event: React.FormEvent) {
    try {
      event.preventDefault();
      if (!templateName || !templateFile) {
        showToast("양식명과 파일을 입력하세요.", "templates");
        return;
      }

      const form = new FormData();
      form.append("name", templateName);
      form.append("description", templateDescription);
      form.append("file", templateFile);

      const response = await fetch(`${API_BASE}/api/v1/projects/${selectedProjectId}/meeting-templates/upload`, { method: "POST", body: form });
      if (!response.ok) {
        showToast("양식 업로드에 실패했습니다.", "templates");
        return;
      }

      setTemplateName("");
      setTemplateDescription("");
      setTemplateFile(null);
      showToast("양식이 등록되었습니다.", "templates");
      await loadTemplates();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "요청을 처리하지 못했습니다.", "templates");
    }
  }

  async function saveTemplate(event: React.FormEvent) {
    try {
      event.preventDefault();
      if (!selectedProjectId || !templateName || (!editingTemplateId && !templateFile)) {
        showToast(editingTemplateId ? "양식명을 입력하세요." : "양식명과 파일을 입력하세요.", "templates");
        return;
      }

      const form = new FormData();
      form.append("name", templateName);
      form.append("description", templateDescription);
      if (templateFile) {
        form.append("file", templateFile);
      }

      const response = await fetch(`${API_BASE}/api/v1/${editingTemplateId ? `meeting-templates/${editingTemplateId}/upload` : `projects/${selectedProjectId}/meeting-templates/upload`}`, {
        method: editingTemplateId ? "PATCH" : "POST",
        body: form,
      });
      if (!response.ok) {
        showToast(editingTemplateId ? "양식 수정에 실패했습니다." : "양식 업로드에 실패했습니다.", "templates");
        return;
      }

      showToast(editingTemplateId ? "양식이 수정되었습니다." : "양식이 등록되었습니다.", "templates");
      resetTemplateForm();
      await loadTemplates();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "요청을 처리하지 못했습니다.", "templates");
    }
  }

  function editTemplate(template: Template) {
    setEditingTemplateId(template.id);
    setTemplateName(template.name);
    setTemplateDescription(template.description || "");
    setTemplateFile(null);
  }

  function resetTemplateForm() {
    setEditingTemplateId(null);
    setTemplateName("");
    setTemplateDescription("");
    setTemplateFile(null);
  }

  async function updateTemplate(templateId: string, name: string, description: string, file: File | null) {
    try {
      if (!name.trim()) {
        showToast("양식명을 입력하세요.", "templates");
        return;
      }

      const form = new FormData();
      form.append("name", name.trim());
      form.append("description", description.trim());
      if (file) {
        form.append("file", file);
      }

      const response = await fetch(`${API_BASE}/api/v1/meeting-templates/${templateId}/upload`, { method: "PATCH", body: form });
      if (!response.ok) {
        showToast("양식 수정에 실패했습니다.", "templates");
        return;
      }

      showToast("양식이 수정되었습니다.", "templates");
      await loadTemplates();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "요청을 처리하지 못했습니다.", "templates");
    }
  }

  async function deleteTemplate(templateId: string) {
    try {
      if (!window.confirm("이 회의록 양식을 삭제할까요?")) {
        return;
      }

      const response = await fetch(`${API_BASE}/api/v1/meeting-templates/${templateId}`, { method: "DELETE" });
      if (!response.ok) {
        showToast("양식을 삭제하지 못했습니다.", "templates");
        return;
      }
      showToast("양식이 삭제되었습니다.", "templates");
      await loadTemplates();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "요청을 처리하지 못했습니다.", "templates");
    }
  }

  function resetProjectForm() {
    setEditingProjectId(null);
    setProjectName("");
    setProjectDescription("");
    setProjectTemplateIds([]);
    setProjectLocations([]);
    setProjectCompanies([]);
    setProjectAttendees([]);
    setProjectLocationInput("");
    setProjectCompanyInput("");
    setProjectAttendeeInput("");
  }

  function editProject(project: Project) {
    setEditingProjectId(project.id);
    setProjectName(project.name);
    setProjectDescription(project.description || "");
    setProjectTemplateIds(project.template_ids || []);
    setProjectLocations(project.locations || []);
    setProjectCompanies(project.companies || []);
    setProjectAttendees(project.attendees || []);
    setProjectLocationInput("");
    setProjectCompanyInput("");
    setProjectAttendeeInput("");
  }

  function toggleProjectTemplate(templateId: string) {
    setProjectTemplateIds((current) =>
      current.includes(templateId) ? current.filter((id) => id !== templateId) : [...current, templateId],
    );
  }

  async function saveProject(event: React.FormEvent) {
    try {
      event.preventDefault();
      if (!projectName.trim()) {
        showToast("프로젝트명을 입력하세요.", "projects");
        return;
      }

      const payload = {
        name: projectName.trim(),
        description: projectDescription.trim(),
        locations: projectLocations,
        companies: projectCompanies,
        attendees: projectAttendees,
      };

      const response = await fetch(`${API_BASE}/api/v1/projects${editingProjectId ? `/${editingProjectId}` : ""}`, {
        method: editingProjectId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        showToast("프로젝트를 저장하지 못했습니다.", "projects");
        return;
      }

      showToast(editingProjectId ? "프로젝트를 수정했습니다." : "프로젝트를 등록했습니다.", "projects");
      resetProjectForm();
      await loadProjects();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "요청을 처리하지 못했습니다.", "projects");
    }
  }

  async function deleteProject(projectId: string) {
    try {
      if (!window.confirm("이 프로젝트를 삭제할까요?")) {
        return;
      }

      const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}`, { method: "DELETE" });
      if (!response.ok) {
        showToast("프로젝트를 삭제하지 못했습니다.", "projects");
        return;
      }

      if (selectedProjectId === projectId) {
        setSelectedProjectId("");
      }
      showToast("프로젝트를 삭제했습니다.", "projects");
      await loadProjects();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "요청을 처리하지 못했습니다.", "projects");
    }
  }

  async function createDraft(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedProjectId || !selectedTemplateId || (!transcriptFile && !storedTranscript) || !meetingDatetime || !location || !author) {
      showToast("양식, 녹취 파일, 회의 일시, 장소, 작성자를 입력하세요.", "compose");
      return;
    }

    setIsGenerating(true);
    setView("compose");
    window.history.replaceState(null, "", window.location.pathname);
    setGenerationProgress(8);
    setGenerationStepIndex(0);
    setGeneratedMinutes(null);

    const payload = {
      template_id: selectedTemplateId,
      transcript_filename: transcriptFile?.name || "saved-transcript.txt",
      meeting_datetime: new Date(meetingDatetime).toISOString(),
      location,
      author,
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
    form.append("transcript", transcriptFile || new File([storedTranscript], "saved-transcript.txt", { type: "text/plain" }));
    form.append("project_id", selectedProjectId);
    if (editingMinuteId) form.append("minute_id", editingMinuteId);

    try {
      const response = await fetch(`${API_BASE}/api/minutes/generate`, { method: "POST", body: form });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        showToast(error?.detail || "회의록 작성에 실패했습니다.", "compose");
        return;
      }

      const savedId = response.headers.get("x-minute-id");
      if (savedId) setEditingMinuteId(savedId);
      const saved = savedId ? await api<SavedMinute>(`/api/v1/meeting-minutes/${savedId}`) : null;
      await loadMinutes();
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const generatedTitle = saved?.title || (titleMode === "manual" ? manualTitle : "회의록");
      const previewPath = response.headers.get("x-preview-url") || "";
      const filename =
        response.headers.get("x-generated-filename") ||
        parseFilenameFromDisposition(disposition) ||
        `${generatedTitle || "generated_minutes"}.doc`;
      const mimeType = blob.type || inferMimeType(filename);
      const previewBlob = mimeType ? new Blob([blob], { type: mimeType }) : blob;
      const url = URL.createObjectURL(previewBlob);
      const result = {
        filename,
        url,
        previewUrl: previewPath ? `${API_BASE}${previewPath}` : "",
        size: blob.size,
        mimeType,
        titleMode,
        title: generatedTitle,
      };

      setIsGenerating(false);
      setGenerationProgress(100);
      setGeneratedMinutes(result);
      setView("result");
      window.history.pushState(null, "", "#download");
      window.requestAnimationFrame(() => {
        mainRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
      });
    } catch (error) {
      showToast(error instanceof Error ? error.message : "회의록 생성에 실패했습니다.", "compose");
    } finally {
      setIsGenerating(false);
    }
  }

  function draftInput() {
    return { template_id: selectedTemplateId || null, meeting_datetime: meetingDatetime, location, author,
      meeting_type: meetingType, title_mode: titleMode, manual_title: manualTitle,
      attendees_by_company: attendees.map(row => ({ company: row.company, attendees: row.attendeesText.split(",").map(name => name.trim()).filter(Boolean) })) };
  }

  async function saveMinute() {
    if (!selectedProjectId) { showToast("프로젝트를 먼저 등록하거나 선택하세요."); return; }
    setIsSaving(true);
    try {
      const input = draftInput();
      const previous = savedMinutes.find(item => item.id === editingMinuteId);
      const payload = { template_id: selectedTemplateId || null, title: manualTitle.trim() || previous?.title || "회의록",
        meeting_at: meetingDatetime ? new Date(meetingDatetime).toISOString() : null,
        attendees: input.attendees_by_company, status: previous?.status || MINUTE_STATUS.DRAFT,
        content: { ...previous?.content, input, transcript_text: transcriptFile ? await transcriptFile.text() : storedTranscript } };
      const saved = await api<SavedMinute>(editingMinuteId ? `/api/v1/meeting-minutes/${editingMinuteId}` : `/api/v1/projects/${selectedProjectId}/meeting-minutes`,
        { method: editingMinuteId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      setEditingMinuteId(saved.id);
      await loadMinutes();
      showToast("회의록을 저장했습니다.");
    } catch (error) { showToast(error instanceof Error ? error.message : "저장 실패"); }
    finally { setIsSaving(false); }
  }

  async function openMinute(id: string) {
    try {
      const minute = await api<SavedMinute>(`/api/v1/meeting-minutes/${id}`);
      const input = minute.content.input || {};
      setEditingMinuteId(minute.id);
      setSelectedTemplateId(templates.some(item => item.id === minute.template_id) ? minute.template_id || "" : "");
      const meetingTime = input.meeting_datetime || minute.meeting_at;
      const date = meetingTime ? new Date(meetingTime) : null;
      setMeetingDatetime(date ? `${formatDateInput(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}` : "");
      setLocation(input.location || ""); setAuthor(input.author || "");
      setMeetingType(input.meeting_type || "in_person"); setTitleMode(input.title_mode || "manual");
      setManualTitle(input.manual_title || minute.title);
      setAttendees((input.attendees_by_company || []).map((row: { company: string; attendees: string[] }) => ({ company: row.company, attendeesText: row.attendees.join(", ") })));
      setTranscriptFile(null); setStoredTranscript(minute.content.transcript_text || "");
      setView("compose");
    } catch (error) { showToast(error instanceof Error ? error.message : "조회 실패"); }
  }

  function downloadGeneratedMinutes() {
    if (!generatedMinutes) {
      return;
    }
    const link = document.createElement("a");
    link.href = generatedMinutes.url;
    link.download = generatedMinutes.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function previewGeneratedMinutes() {
    if (!generatedMinutes) {
      return;
    }
    if (generatedMinutes.previewUrl) {
      window.open(generatedMinutes.previewUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (!canPreviewFile(generatedMinutes)) {
      showToast("미리보기 파일을 찾지 못했습니다. 다운로드로 확인하세요.", "result");
      return;
    }
    window.open(generatedMinutes.url, "_blank", "noopener,noreferrer");
  }

  const selectedProject = projects.find((project) => project.id === selectedProjectId) || null;
  React.useEffect(() => {
    if (templates.length === 0) {
      setSelectedTemplateId("");
      return;
    }
    if (selectedTemplateId && !templates.some((template) => template.id === selectedTemplateId)) {
      setSelectedTemplateId("");
    }
  }, [selectedTemplateId, templates]);

  const pageTitle =
    view === "compose" && isGenerating
      ? "회의록 생성 중"
      : view === "result"
      ? "회의록 생성 완료"
      : view === "compose"
        ? "회의록 작성"
        : view === "templates"
          ? "회의록 양식 관리"
          : "프로젝트 관리";

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
          <button className={view === "projects" ? "active" : ""} onClick={() => setView("projects")}>
            프로젝트 관리
          </button>
        </nav>
      </aside>

      <main ref={mainRef}>
        <header className="topbar">
          <div>
            <h1>{pageTitle}</h1>
          </div>
        </header>

        {view === "result" && generatedMinutes ? (
          <GenerationResult
            result={generatedMinutes}
            onDownload={downloadGeneratedMinutes}
            onPreview={previewGeneratedMinutes}
            onBack={() => {
              setGeneratedMinutes(null);
              setView("compose");
              window.history.replaceState(null, "", window.location.pathname);
            }}
          />
        ) : view === "compose" ? (
          isGenerating ? (
            <GenerationLoading progress={generationProgress} step={GENERATION_STEPS[generationStepIndex]} />
          ) : (
            <ComposeForm
            templates={templates}
            projects={projects}
            selectedProject={selectedProject}
            selectedProjectId={selectedProjectId}
            setSelectedProjectId={setSelectedProjectId}
            selectedTemplateId={selectedTemplateId}
            setSelectedTemplateId={setSelectedTemplateId}
            setTranscriptFile={setTranscriptFile}
            meetingDatetime={meetingDatetime}
            setMeetingDatetime={setMeetingDatetime}
            location={location}
            setLocation={setLocation}
            author={author}
            setAuthor={setAuthor}
            meetingType={meetingType}
            setMeetingType={setMeetingType}
            attendees={attendees}
            setAttendees={setAttendees}
            draggedAttendeeIndex={draggedAttendeeIndex}
            setDraggedAttendeeIndex={setDraggedAttendeeIndex}
            attendeeDropIndex={attendeeDropIndex}
            setAttendeeDropIndex={setAttendeeDropIndex}
            titleMode={titleMode}
            setTitleMode={setTitleMode}
            manualTitle={manualTitle}
            setManualTitle={setManualTitle}
            isGenerating={isGenerating}
            createDraft={createDraft}
          />
          )
        ) : view === "templates" ? (
          <TemplateManager2
            templates={templates}
            templateName={templateName}
            setTemplateName={setTemplateName}
            templateDescription={templateDescription}
            setTemplateDescription={setTemplateDescription}
            setTemplateFile={setTemplateFile}
            saveTemplate={saveTemplate}
            editingTemplateId={editingTemplateId}
            resetTemplateForm={resetTemplateForm}
            updateTemplate={updateTemplate}
            deleteTemplate={deleteTemplate}
          />
        ) : (
          <ProjectManager2
            projects={projects}
            templates={templates}
            projectName={projectName}
            setProjectName={setProjectName}
            projectDescription={projectDescription}
            setProjectDescription={setProjectDescription}
            projectTemplateIds={projectTemplateIds}
            toggleProjectTemplate={toggleProjectTemplate}
            projectLocations={projectLocations}
            setProjectLocations={setProjectLocations}
            projectLocationInput={projectLocationInput}
            setProjectLocationInput={setProjectLocationInput}
            projectCompanies={projectCompanies}
            setProjectCompanies={setProjectCompanies}
            projectCompanyInput={projectCompanyInput}
            setProjectCompanyInput={setProjectCompanyInput}
            projectAttendees={projectAttendees}
            setProjectAttendees={setProjectAttendees}
            projectAttendeeInput={projectAttendeeInput}
            setProjectAttendeeInput={setProjectAttendeeInput}
            editingProjectId={editingProjectId}
            saveProject={saveProject}
            editProject={editProject}
            deleteProject={deleteProject}
            resetProjectForm={resetProjectForm}
          />
        )}

        {toast && toast.view === view && <div className="toast-message">{toast.message}</div>}
      </main>
    </div>
  );
}

function GenerationResult(props: {
  result: GeneratedMinutes;
  onDownload: () => void;
  onPreview: () => void;
  onBack: () => void;
}) {
  return (
    <section className="workspace result-workspace">
      <div className="panel result-panel">
        <div className="result-copy">
          <span className="result-kicker">생성 완료</span>
          <h2>회의록 파일이 준비되었습니다.</h2>
          <strong className="generated-title">{props.result.title}</strong>
          <p>{props.result.titleMode === "ai" ? "AI가 생성한 제목입니다." : "직접 입력한 제목으로 생성했습니다."}</p>
        </div>

        <button className="file-summary file-summary-button" type="button" onClick={props.onPreview}>
          <FileText size={24} />
          <div>
            <strong>{props.result.filename}</strong>
            <span>{formatBytes(props.result.size)} · {props.result.previewUrl ? "PDF 미리보기" : "파일 미리보기"}</span>
          </div>
        </button>

        {props.result.previewUrl ? (
          <div className="preview-frame">
            <iframe title="회의록 미리보기" src={props.result.previewUrl} />
          </div>
        ) : (
          <p className="preview-empty">미리보기 파일을 만들지 못했습니다. 다운로드로 확인하세요.</p>
        )}

        <div className="result-actions">
          <button className="secondary" type="button" onClick={props.onBack}>
            다시 작성
          </button>
          <button className="primary" type="button" onClick={props.onDownload}>
            <Download size={18} />
            다운로드
          </button>
        </div>
      </div>
    </section>
  );
}

function GenerationLoading(props: {
  progress: number;
  step: string;
}) {
  return (
    <section className="workspace result-workspace">
      <div className="panel result-panel loading-panel">
        <div className="result-copy">
          <span className="result-kicker">생성 중</span>
          <h2>회의록을 작성하고 있습니다.</h2>
          <p>{props.step}</p>
        </div>

        <div className="progress-block" aria-label="회의록 생성 진행률">
          <div className="progress-header">
            <span>진행률</span>
            <strong>{props.progress}%</strong>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${props.progress}%` }} />
          </div>
        </div>
      </div>
    </section>
  );
}

function canPreviewFile(file: GeneratedMinutes) {
  const extension = file.filename.split(".").pop()?.toLowerCase() || "";
  return file.mimeType.startsWith("image/") || file.mimeType === "application/pdf" || ["pdf", "txt", "png", "jpg", "jpeg", "gif", "webp"].includes(extension);
}

function parseFilenameFromDisposition(disposition: string) {
  const encodedMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (encodedMatch?.[1]) {
    return decodeURIComponent(encodedMatch[1]);
  }
  const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
  return filenameMatch?.[1] || "";
}

function inferMimeType(filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase() || "";
  const mimeTypes: Record<string, string> = {
    gif: "image/gif",
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    pdf: "application/pdf",
    png: "image/png",
    txt: "text/plain;charset=utf-8",
    webp: "image/webp",
  };
  return mimeTypes[extension] || "";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function ComposeForm(props: {
  templates: Template[];
  projects: Project[];
  selectedProject: Project | null;
  selectedProjectId: string;
  setSelectedProjectId: (value: string) => void;
  selectedTemplateId: string;
  setSelectedTemplateId: (value: string) => void;
  setTranscriptFile: (file: File | null) => void;
  meetingDatetime: string;
  setMeetingDatetime: (value: string) => void;
  location: string;
  setLocation: (value: string) => void;
  author: string;
  setAuthor: (value: string) => void;
  meetingType: MeetingType;
  setMeetingType: (value: MeetingType) => void;
  attendees: CompanyAttendees[];
  setAttendees: (value: CompanyAttendees[]) => void;
  draggedAttendeeIndex: number | null;
  setDraggedAttendeeIndex: (value: number | null) => void;
  attendeeDropIndex: number | null;
  setAttendeeDropIndex: (value: number | null) => void;
  titleMode: TitleMode;
  setTitleMode: (value: TitleMode) => void;
  manualTitle: string;
  setManualTitle: (value: string) => void;
  isGenerating: boolean;
  createDraft: (event: React.FormEvent) => void;
}) {
  const authorOptions = props.selectedProject?.attendees.length
    ? props.selectedProject.attendees
    : getSelectedAttendeeNames(props.attendees);

  return (
    <form className="workspace" onSubmit={props.createDraft}>
      <section className="panel">
        <h2>기본 정보</h2>
        <div className="form-grid">
          <label>
            프로젝트
            <ProjectSelect
              projects={props.projects}
              value={props.selectedProjectId}
              onChange={props.setSelectedProjectId}
            />
          </label>
          <label>
            회의록 양식
            <TemplateSelect
              templates={props.templates}
              value={props.selectedTemplateId}
              onChange={props.setSelectedTemplateId}
            />
          </label>
          <label>
            txt 파일
            <FilePicker accept=".txt,text/plain" helperText="파일 업로드" onChange={props.setTranscriptFile} />
          </label>
          <label>
            회의 일시
            <DateTimePicker value={props.meetingDatetime} onChange={props.setMeetingDatetime} />
          </label>
          <label>
            회의 장소
            {props.selectedProject?.locations.length ? (
              <SimpleSelect
                placeholder="회의 장소를 선택하세요"
                options={props.selectedProject.locations}
                value={props.location}
                onChange={props.setLocation}
              />
            ) : (
              <input value={props.location} onChange={(event) => props.setLocation(event.target.value)} placeholder="예: 본사 7층 회의실" />
            )}
          </label>
          <label>
            작성자
            <SimpleSelect
              placeholder="작성자를 선택하세요"
              emptyText={props.selectedProject ? "등록된 참석자가 없습니다." : "참석자를 먼저 추가하세요"}
              options={authorOptions}
              value={props.author}
              onChange={props.setAuthor}
            />
          </label>
        </div>

        <div className="inline-section">
          <div className="option-grid">
            <div className="option-block">
              <h3>회의 형식</h3>
              <div className="segmented full-width">
                <button type="button" className={props.meetingType === "in_person" ? "selected" : ""} onClick={() => props.setMeetingType("in_person")}>
                  대면
                </button>
                <button type="button" className={props.meetingType === "remote" ? "selected" : ""} onClick={() => props.setMeetingType("remote")}>
                  비대면
                </button>
              </div>
            </div>

            <div className="option-block">
              <h3>제목</h3>
              <fieldset>
                <div className="segmented full-width">
                  <button type="button" className={props.titleMode === "ai" ? "selected" : ""} onClick={() => props.setTitleMode("ai")}>
                    AI 추천
                  </button>
                  <button type="button" className={props.titleMode === "manual" ? "selected" : ""} onClick={() => props.setTitleMode("manual")}>
                    직접 입력
                  </button>
                </div>
              </fieldset>
              {props.titleMode === "manual" && (
                <label className="manual-title-field">
                  회의록 제목
                  <input value={props.manualTitle} onChange={(event) => props.setManualTitle(event.target.value)} placeholder="제목" />
                </label>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>참석자</h2>
            <p>회사명과 참석자를 행 단위로 입력합니다. 입력한 행 순서대로 회의록에 반영됩니다.</p>
          </div>
          <button
            type="button"
            className="icon-button add-attendee"
            title="참석자 행 추가"
            onClick={() => props.setAttendees([...props.attendees, { company: "", attendeesText: "" }])}
          >
            <Plus size={18} />
          </button>
        </div>
        <div
          className="attendee-list"
          onDragOver={(event) => {
            if (props.draggedAttendeeIndex !== null) {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }
          }}
          onDrop={(event) => {
            event.preventDefault();
            if (props.draggedAttendeeIndex !== null) {
              moveAttendee(props, props.draggedAttendeeIndex, props.attendeeDropIndex ?? props.attendees.length);
            }
            props.setDraggedAttendeeIndex(null);
            props.setAttendeeDropIndex(null);
          }}
        >
          {props.attendees.map((row, index) => (
            <React.Fragment key={index}>
              {props.attendeeDropIndex === index && <div className="drop-indicator" />}
              <div
                className={`attendee-row ${props.draggedAttendeeIndex === index ? "dragging" : ""}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  const rect = event.currentTarget.getBoundingClientRect();
                  const isAfterRow = event.clientY > rect.top + rect.height / 2;
                  props.setAttendeeDropIndex(index + (isAfterRow ? 1 : 0));
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (props.draggedAttendeeIndex !== null) {
                    moveAttendee(props, props.draggedAttendeeIndex, props.attendeeDropIndex ?? index);
                  }
                  props.setDraggedAttendeeIndex(null);
                  props.setAttendeeDropIndex(null);
                }}
              >
                <button
                  type="button"
                  className="drag-handle"
                  title="드래그해서 순서 변경"
                  draggable
                  onDragStart={(event) => {
                    props.setDraggedAttendeeIndex(index);
                    props.setAttendeeDropIndex(index);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", String(index));
                  }}
                  onDragEnd={() => {
                    props.setDraggedAttendeeIndex(null);
                    props.setAttendeeDropIndex(null);
                  }}
                >
                  <GripVertical size={18} />
                </button>
                {props.selectedProject?.companies.length ? (
                  <SimpleSelect
                    placeholder="회사를 선택하세요"
                    options={props.selectedProject.companies}
                    value={row.company}
                    onChange={(value) => updateAttendee(props, index, "company", value)}
                  />
                ) : (
                  <input
                    value={row.company}
                    onChange={(event) => updateAttendee(props, index, "company", event.target.value)}
                    placeholder="회사명"
                  />
                )}
                {props.selectedProject?.attendees.length ? (
                  <SimpleSelect
                    placeholder="참석자를 선택하세요"
                    options={props.selectedProject.attendees}
                    value={row.attendeesText}
                    disabledOptions={getSelectedAttendeeNames(props.attendees)}
                    disabledReason="이미 추가되었습니다."
                    onChange={(value) => appendAttendeeNameToRow(props, index, value)}
                  />
                ) : (
                  <input
                    value={row.attendeesText}
                    onChange={(event) => updateAttendee(props, index, "attendeesText", event.target.value)}
                    placeholder="예시) OOO 대리, OOO 사원"
                  />
                )}
                <div className="attendee-controls">
                  <button
                    type="button"
                    className="icon-button attendee-remove"
                    title="참석자 행 삭제"
                    onClick={() => props.setAttendees(props.attendees.filter((_, rowIndex) => rowIndex !== index))}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
            </React.Fragment>
          ))}
          {props.attendeeDropIndex === props.attendees.length && <div className="drop-indicator" />}
        </div>

      </section>

      <div className="actions compose-submit">
        <button className="primary" type="submit" disabled={props.isGenerating}>
          {props.isGenerating ? "작성중입니다..." : "시작"}
        </button>
      </div>
    </form>
  );
}

function FilePicker(props: {
  accept?: string;
  helperText: string;
  onChange: (file: File | null) => void;
}) {
  const [fileName, setFileName] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  function handleFileChange(file: File | null) {
    setFileName(file?.name ?? "");
    props.onChange(file);
  }

  return (
    <div className="file-picker">
      <input
        ref={inputRef}
        type="file"
        accept={props.accept}
        onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
      />
      <button type="button" className="file-trigger" onClick={() => inputRef.current?.click()}>
        <Upload size={17} />
        <span>{fileName || props.helperText}</span>
      </button>
      {fileName && (
        <button
          type="button"
          className="file-clear"
          title="파일 선택 해제"
          onClick={() => {
            if (inputRef.current) {
              inputRef.current.value = "";
            }
            handleFileChange(null);
          }}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}

function DateTimePicker(props: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const pickerRef = React.useRef<HTMLDivElement | null>(null);
  const selectedDate = props.value ? new Date(props.value) : null;
  const today = new Date();
  const initialDisplayTime = toDisplayTime(props.value ? props.value.slice(11, 16) : "09:00");
  const [visibleMonth, setVisibleMonth] = React.useState(
    new Date(selectedDate?.getFullYear() ?? today.getFullYear(), selectedDate?.getMonth() ?? today.getMonth(), 1),
  );
  const [meridiem, setMeridiem] = React.useState<Meridiem>(initialDisplayTime.meridiem);
  const [timeInput, setTimeInput] = React.useState(initialDisplayTime.timeText);

  React.useEffect(() => {
    if (props.value) {
      const nextDate = new Date(props.value);
      const nextTime = toDisplayTime(props.value.slice(11, 16));
      setVisibleMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
      setMeridiem(nextTime.meridiem);
      setTimeInput(nextTime.timeText);
    }
  }, [props.value]);

  React.useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const days = getCalendarDays(visibleMonth);
  const formattedValue = selectedDate
    ? `${selectedDate.getFullYear()}.${String(selectedDate.getMonth() + 1).padStart(2, "0")}.${String(selectedDate.getDate()).padStart(2, "0")} ${formatKoreanTime(props.value.slice(11, 16))}`
    : "회의 일시를 선택하세요";

  function selectDate(day: Date) {
    const datePart = formatDateInput(day);
    props.onChange(`${datePart}T${to24Hour(meridiem, normalizeTimeInput(timeInput) ?? "09:00")}`);
  }

  function updateMeridiem(nextMeridiem: Meridiem) {
    setMeridiem(nextMeridiem);
    const baseDate = selectedDate ?? today;
    props.onChange(`${formatDateInput(baseDate)}T${to24Hour(nextMeridiem, normalizeTimeInput(timeInput) ?? "09:00")}`);
  }

  function updateTimeInput(nextValue: string) {
    setTimeInput(nextValue);
    const normalized = normalizeTimeInput(nextValue);
    if (!normalized) {
      return;
    }

    const baseDate = selectedDate ?? today;
    props.onChange(`${formatDateInput(baseDate)}T${to24Hour(meridiem, normalized)}`);
  }

  function updateTimePart(part: "hour" | "minute", nextValue: string) {
    const digits = nextValue.replace(/\D/g, "").slice(0, 2);
    const [currentHour, currentMinute] = timeInput.split(":");
    updateTimeInput(part === "hour" ? `${digits}:${currentMinute ?? "00"}` : `${currentHour ?? "09"}:${digits}`);
  }

  function normalizeCurrentTime() {
    const normalized = normalizeTimeInput(timeInput) ?? "09:00";
    setTimeInput(normalized);
    const baseDate = selectedDate ?? today;
    props.onChange(`${formatDateInput(baseDate)}T${to24Hour(meridiem, normalized)}`);
  }

  return (
    <div className="date-picker" ref={pickerRef}>
      <button
        type="button"
        className={`date-trigger ${isOpen ? "open" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className={selectedDate ? "" : "placeholder"}>{formattedValue}</span>
        <CalendarDays size={18} />
      </button>

      {isOpen && (
        <div className="date-menu" role="dialog" aria-label="회의 일시 선택">
          <div className="calendar-header">
            <button
              type="button"
              className="icon-button compact"
              title="이전 달"
              onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}
            >
              <ChevronLeft size={17} />
            </button>
            <strong>
              {visibleMonth.getFullYear()}년 {visibleMonth.getMonth() + 1}월
            </strong>
            <button
              type="button"
              className="icon-button compact"
              title="다음 달"
              onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}
            >
              <ChevronRight size={17} />
            </button>
          </div>

          <div className="calendar-weekdays">
            {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="calendar-grid">
            {days.map((day) => {
              const isCurrentMonth = day.getMonth() === visibleMonth.getMonth();
              const isSelected = selectedDate ? isSameDate(day, selectedDate) : false;
              const isToday = isSameDate(day, today);

              return (
                <button
                  type="button"
                  className={`calendar-day ${isCurrentMonth ? "" : "muted"} ${isSelected ? "selected" : ""} ${isToday ? "today" : ""}`}
                  key={day.toISOString()}
                  onClick={() => selectDate(day)}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          <div className="time-field">
            <span>시간</span>
            <div className="time-manual-row">
              <div className="meridiem-toggle">
                <button type="button" className={meridiem === "AM" ? "selected" : ""} onClick={() => updateMeridiem("AM")}>
                  오전
                </button>
                <button type="button" className={meridiem === "PM" ? "selected" : ""} onClick={() => updateMeridiem("PM")}>
                  오후
                </button>
              </div>
              <div className="time-input-group">
                <input
                  aria-label="회의 시간"
                  inputMode="numeric"
                  placeholder="09"
                  value={timeInput.split(":")[0] ?? ""}
                  onBlur={normalizeCurrentTime}
                  onChange={(event) => updateTimePart("hour", event.target.value)}
                />
                <span>:</span>
                <input
                  aria-label="회의 분"
                  inputMode="numeric"
                  placeholder="30"
                  value={timeInput.split(":")[1] ?? ""}
                  onBlur={normalizeCurrentTime}
                  onChange={(event) => updateTimePart("minute", event.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getCalendarDays(month: Date) {
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  start.setDate(start.getDate() - start.getDay());
  end.setDate(end.getDate() + (6 - end.getDay()));

  const length = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;

  return Array.from({ length }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function formatDateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isSameDate(first: Date, second: Date) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function toDisplayTime(value: string): { meridiem: Meridiem; timeText: string } {
  const [rawHour, minute = "00"] = value.split(":");
  const hour24 = Number(rawHour);
  const meridiem = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;

  return {
    meridiem,
    timeText: `${String(hour12).padStart(2, "0")}:${minute.padStart(2, "0")}`,
  };
}

function normalizeTimeInput(value: string) {
  const compact = value.trim();
  const match = compact.match(/^(\d{1,2})(?::?(\d{0,2}))?$/);
  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number((match[2] || "00").padEnd(2, "0"));
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) {
    return null;
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function to24Hour(meridiem: Meridiem, timeText: string) {
  const [hourText, minute] = timeText.split(":");
  const hour12 = Number(hourText);
  const hour24 = meridiem === "AM" ? hour12 % 12 : (hour12 % 12) + 12;

  return `${String(hour24).padStart(2, "0")}:${minute}`;
}

function formatKoreanTime(value: string) {
  const display = toDisplayTime(value);
  return `${display.meridiem === "AM" ? "오전" : "오후"} ${display.timeText}`;
}

function TemplateSelect(props: {
  templates: Template[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const selectedTemplate = props.templates.find((template) => template.id === props.value);
  const selectRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!selectRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  return (
    <div className="custom-select" ref={selectRef}>
      <button
        type="button"
        className={`select-trigger ${isOpen ? "open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className={selectedTemplate ? "" : "placeholder"}>
          {selectedTemplate ? selectedTemplate.name : "양식을 선택하세요"}
        </span>
        <ChevronDown size={18} />
      </button>

      {isOpen && (
        <div className="select-menu" role="listbox">
          {props.templates.length === 0 ? (
            <div className="select-empty">등록된 양식이 없습니다.</div>
          ) : (
            props.templates.map((template) => (
              <button
                type="button"
                className={`select-option ${template.id === props.value ? "selected" : ""}`}
                key={template.id}
                role="option"
                aria-selected={template.id === props.value}
                onClick={() => {
                  props.onChange(template.id);
                  setIsOpen(false);
                }}
              >
                <strong>{template.name}</strong>
                <span>{template.description || template.original_filename}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ProjectSelect(props: {
  projects: Project[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const selectedProject = props.projects.find((project) => project.id === props.value);
  const selectRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!selectRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  return (
    <div className="custom-select" ref={selectRef}>
      <button
        type="button"
        className={`select-trigger ${isOpen ? "open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className={selectedProject ? "" : "placeholder"}>
          {selectedProject ? selectedProject.name : "프로젝트를 선택하세요"}
        </span>
        <ChevronDown size={18} />
      </button>

      {isOpen && (
        <div className="select-menu" role="listbox">
          {props.projects.length === 0 ? (
            <div className="select-empty">등록된 프로젝트가 없습니다.</div>
          ) : (
            props.projects.map((project) => (
              <button
                type="button"
                className={`select-option ${project.id === props.value ? "selected" : ""}`}
                key={project.id}
                role="option"
                aria-selected={project.id === props.value}
                onClick={() => {
                  props.onChange(project.id);
                  setIsOpen(false);
                }}
              >
                <strong>{project.name}</strong>
                <span>{project.description || "설명 없음"}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function SimpleSelect(props: {
  placeholder: string;
  options: string[];
  value: string;
  emptyText?: string;
  disabledOptions?: string[];
  disabledReason?: string;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const selectRef = React.useRef<HTMLDivElement | null>(null);
  const disabledOptions = new Set(props.disabledOptions ?? []);

  React.useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!selectRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  return (
    <div className="custom-select simple-select" ref={selectRef}>
      <button
        type="button"
        className={`select-trigger ${isOpen ? "open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className={props.value ? "" : "placeholder"}>{props.value || props.placeholder}</span>
        <ChevronDown size={18} />
      </button>

      {isOpen && (
        <div className="select-menu" role="listbox">
          {props.options.length === 0 ? (
            <div className="select-empty">{props.emptyText || "선택할 항목이 없습니다."}</div>
          ) : props.options.map((option) => {
            const isDisabled = disabledOptions.has(option);
            return (
              <button
                type="button"
                className={`select-option simple-option ${option === props.value ? "selected" : ""} ${isDisabled ? "disabled" : ""}`}
                disabled={isDisabled}
                key={option}
                role="option"
                aria-selected={option === props.value}
                onClick={() => {
                  props.onChange(option);
                  setIsOpen(false);
                }}
              >
                <strong>{option}</strong>
                {isDisabled && props.disabledReason && <span>{props.disabledReason}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PresetGroup(props: {
  title: string;
  items: string[];
  onSelect: (value: string) => void;
}) {
  return (
    <div className="preset-group">
      <span>{props.title}</span>
      <div className="preset-chips">
        {props.items.map((item) => (
          <button type="button" key={item} onClick={() => props.onSelect(item)}>
            {item}
          </button>
        ))}
      </div>
    </div>
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

function appendAttendeeName(
  props: { attendees: CompanyAttendees[]; setAttendees: (value: CompanyAttendees[]) => void },
  name: string,
) {
  const nextAttendees = props.attendees.length > 0 ? [...props.attendees] : [{ company: "", attendeesText: "" }];
  const targetIndex = Math.max(0, nextAttendees.length - 1);
  const currentNames = nextAttendees[targetIndex].attendeesText
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!currentNames.includes(name)) {
    currentNames.push(name);
  }

  nextAttendees[targetIndex] = {
    ...nextAttendees[targetIndex],
    attendeesText: currentNames.join(", "),
  };
  props.setAttendees(nextAttendees);
}

function appendAttendeeNameToRow(
  props: { attendees: CompanyAttendees[]; setAttendees: (value: CompanyAttendees[]) => void },
  index: number,
  name: string,
) {
  const nextAttendees = [...props.attendees];
  const currentNames = nextAttendees[index].attendeesText
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!currentNames.includes(name)) {
    currentNames.push(name);
  }

  nextAttendees[index] = {
    ...nextAttendees[index],
    attendeesText: currentNames.join(", "),
  };
  props.setAttendees(nextAttendees);
}

function getSelectedAttendeeNames(attendees: CompanyAttendees[]) {
  return attendees.flatMap((row) =>
    row.attendeesText
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function parsePresetLines(value: string) {
  return Array.from(
    new Set(
      value
        .split(/\r?\n|,/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function moveAttendee(
  props: { attendees: CompanyAttendees[]; setAttendees: (value: CompanyAttendees[]) => void },
  fromIndex: number,
  toIndex: number,
) {
  if (toIndex < 0 || toIndex > props.attendees.length || fromIndex === toIndex) {
    return;
  }

  const nextAttendees = [...props.attendees];
  const [movedRow] = nextAttendees.splice(fromIndex, 1);
  const adjustedIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
  nextAttendees.splice(adjustedIndex, 0, movedRow);
  props.setAttendees(nextAttendees);
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
      <form className="panel template-upload-panel" onSubmit={props.uploadTemplate}>
        <h2>회의록 양식 업로드</h2>
        <label>
          양식명
          <input value={props.templateName} onChange={(event) => props.setTemplateName(event.target.value)} placeholder="예: 주간 회의록" />
        </label>
        <label>
          설명
          <input
            value={props.templateDescription}
            onChange={(event) => props.setTemplateDescription(event.target.value)}
            placeholder="예: 주간 회의용"
          />
        </label>
        <label>
          파일
          <FilePicker
            accept=".doc,application/msword"
            helperText="파일 업로드"
            onChange={props.setTemplateFile}
          />
        </label>
        <button className="primary" type="submit">
          <Upload size={18} />
          업로드
        </button>
      </form>

      <section className="panel template-list-panel">
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
                  <a className="icon-button add-attendee" title="양식 다운로드" href={`${API_BASE}/api/v1/meeting-templates/${template.id}/download`}>
                    <Download size={18} />
                  </a>
                  <button className="danger-button" title="양식 삭제" type="button" onClick={() => props.deleteTemplate(template.id)}>
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

function TemplateManager2(props: {
  templates: Template[];
  templateName: string;
  setTemplateName: (value: string) => void;
  templateDescription: string;
  setTemplateDescription: (value: string) => void;
  setTemplateFile: (file: File | null) => void;
  saveTemplate: (event: React.FormEvent) => void;
  editingTemplateId: string | null;
  resetTemplateForm: () => void;
  updateTemplate: (templateId: string, name: string, description: string, file: File | null) => Promise<void>;
  deleteTemplate: (templateId: string) => void;
}) {
  return (
    <div className="workspace two-column">
      <section className="panel template-list-panel">
        <h2>양식 목록</h2>
        <div className="template-list">
          {props.templates.length === 0 ? (
            <p className="empty">등록된 양식이 없습니다.</p>
          ) : (
            props.templates.map((template) => (
              <TemplateListItem
                key={template.id}
                template={template}
                updateTemplate={props.updateTemplate}
                deleteTemplate={props.deleteTemplate}
              />
            ))
          )}
        </div>
      </section>

      <form className="panel template-upload-panel" onSubmit={props.saveTemplate}>
        <h2>{props.editingTemplateId ? "회의록 양식 수정" : "회의록 양식 업로드"}</h2>
        <label>
          양식명
          <input value={props.templateName} onChange={(event) => props.setTemplateName(event.target.value)} placeholder="예: 주간 회의록" />
        </label>
        <label>
          설명
          <input
            value={props.templateDescription}
            onChange={(event) => props.setTemplateDescription(event.target.value)}
            placeholder="예: 주간 회의용"
          />
        </label>
        <label>
          파일
          <FilePicker
            accept=".doc,application/msword"
            key={props.editingTemplateId || "new-template"}
            helperText={props.editingTemplateId ? "새 파일 선택" : "파일 업로드"}
            onChange={props.setTemplateFile}
          />
        </label>
        <div className="form-actions">
          <button className="primary" type="submit">
            {props.editingTemplateId ? "수정" : "업로드"}
          </button>
          {props.editingTemplateId && (
            <button className="secondary" type="button" onClick={props.resetTemplateForm}>
              취소
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function TemplateListItem(props: {
  template: Template;
  updateTemplate: (templateId: string, name: string, description: string, file: File | null) => Promise<void>;
  deleteTemplate: (templateId: string) => void;
}) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [name, setName] = React.useState(props.template.name);
  const [description, setDescription] = React.useState(props.template.description || "");
  const [file, setFile] = React.useState<File | null>(null);

  function cancelEdit() {
    setName(props.template.name);
    setDescription(props.template.description || "");
    setFile(null);
    setIsEditing(false);
  }

  async function saveEdit() {
    await props.updateTemplate(props.template.id, name, description, file);
    setFile(null);
    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <article className="template-card template-card-editing">
        <div className="template-inline-form">
          <label className="inline-edit-field">
            양식명
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="예: 주간 회의록" />
          </label>
          <label className="inline-edit-field">
            설명
            <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="예: 주간 회의용" />
          </label>
          <label className="inline-edit-field">
            파일
            <FilePicker accept=".doc,application/msword" helperText="새 파일 선택" onChange={setFile} />
          </label>
          <span>{props.template.original_filename}</span>
        </div>
        <div className="card-actions">
          <button className="secondary compact-text-button" type="button" onClick={saveEdit}>
            저장
          </button>
          <button className="secondary compact-text-button" type="button" onClick={cancelEdit}>
            취소
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className="template-card">
      <div>
        <strong>{props.template.name}</strong>
        <p>{props.template.description || "설명 없음"}</p>
        <span>{props.template.original_filename}</span>
      </div>
      <div className="card-actions">
        <button className="secondary compact-text-button" type="button" onClick={() => setIsEditing(true)}>
          수정
        </button>
        <a className="icon-button add-attendee" title="양식 다운로드" href={`${API_BASE}/api/v1/meeting-templates/${props.template.id}/download`}>
          <Download size={18} />
        </a>
        <button className="danger-button" title="양식 삭제" type="button" onClick={() => props.deleteTemplate(props.template.id)}>
          <Trash2 size={18} />
        </button>
      </div>
    </article>
  );
}

function ProjectManager(props: {
  projects: Project[];
  templates: Template[];
  projectName: string;
  setProjectName: (value: string) => void;
  projectDescription: string;
  setProjectDescription: (value: string) => void;
  projectTemplateIds: string[];
  toggleProjectTemplate: (templateId: string) => void;
  projectLocations: string;
  setProjectLocations: (value: string) => void;
  projectCompanies: string;
  setProjectCompanies: (value: string) => void;
  projectAttendees: string;
  setProjectAttendees: (value: string) => void;
  editingProjectId: string | null;
  saveProject: (event: React.FormEvent) => void;
  editProject: (project: Project) => void;
  deleteProject: (projectId: string) => void;
  resetProjectForm: () => void;
}) {
  return (
    <div className="workspace two-column project-workspace">
      <form className="panel project-form-panel" onSubmit={props.saveProject}>
        <h2>{props.editingProjectId ? "프로젝트 수정" : "프로젝트 등록"}</h2>
        <label>
          프로젝트명
          <input value={props.projectName} onChange={(event) => props.setProjectName(event.target.value)} placeholder="예: 키움증권 컨시어지" />
        </label>
        <label>
          설명
          <input
            value={props.projectDescription}
            onChange={(event) => props.setProjectDescription(event.target.value)}
            placeholder="예: 컨시어지 구축 프로젝트"
          />
        </label>


        <label>
          회의 장소
          <textarea
            value={props.projectLocations}
            onChange={(event) => props.setProjectLocations(event.target.value)}
            placeholder={"장소를 줄바꿈 또는 쉼표로 입력\n예: 본사 7층 회의실"}
          />
        </label>
        <label>
          회사
          <textarea
            value={props.projectCompanies}
            onChange={(event) => props.setProjectCompanies(event.target.value)}
            placeholder={"회사를 줄바꿈 또는 쉼표로 입력\n예: 키움증권"}
          />
        </label>
        <label>
          참석자
          <textarea
            value={props.projectAttendees}
            onChange={(event) => props.setProjectAttendees(event.target.value)}
            placeholder={"참석자를 줄바꿈 또는 쉼표로 입력\n예: 김소정"}
          />
        </label>

        <div className="form-actions">
          <button className="primary" type="submit">
            {props.editingProjectId ? "수정" : "등록"}
          </button>
          {props.editingProjectId && (
            <button className="secondary" type="button" onClick={props.resetProjectForm}>
              취소
            </button>
          )}
        </div>
      </form>

      <section className="panel project-list-panel">
        <h2>프로젝트 목록</h2>
        <div className="project-list">
          {props.projects.length === 0 ? (
            <p className="empty">등록된 프로젝트가 없습니다.</p>
          ) : (
            props.projects.map((project) => (
              <article className="project-row" key={project.id}>
                <div>
                  <strong>{project.name}</strong>
                  <p>{project.description || "설명 없음"}</p>
                  <span>
                    회사 {project.companies.length}개 · 참석자 {project.attendees.length}명 · 회의 장소 {project.locations.length}개
                  </span>
                </div>
                <div className="card-actions">
                  <button className="secondary compact-text-button" type="button" onClick={() => props.editProject(project)}>
                    수정
                  </button>
                  <button className="danger-button" title="프로젝트 삭제" type="button" onClick={() => props.deleteProject(project.id)}>
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

function ProjectManager2(props: {
  projects: Project[];
  templates: Template[];
  projectName: string;
  setProjectName: (value: string) => void;
  projectDescription: string;
  setProjectDescription: (value: string) => void;
  projectTemplateIds: string[];
  toggleProjectTemplate: (templateId: string) => void;
  projectLocations: string[];
  setProjectLocations: (value: string[]) => void;
  projectLocationInput: string;
  setProjectLocationInput: (value: string) => void;
  projectCompanies: string[];
  setProjectCompanies: (value: string[]) => void;
  projectCompanyInput: string;
  setProjectCompanyInput: (value: string) => void;
  projectAttendees: string[];
  setProjectAttendees: (value: string[]) => void;
  projectAttendeeInput: string;
  setProjectAttendeeInput: (value: string) => void;
  editingProjectId: string | null;
  saveProject: (event: React.FormEvent) => void;
  editProject: (project: Project) => void;
  deleteProject: (projectId: string) => void;
  resetProjectForm: () => void;
}) {
  return (
    <div className="workspace two-column project-workspace">
      <section className="panel project-list-panel">
        <h2>프로젝트 목록</h2>
        <div className="project-list">
          {props.projects.length === 0 ? (
            <p className="empty">등록된 프로젝트가 없습니다.</p>
          ) : (
            props.projects.map((project) => (
              <article className="project-row" key={project.id}>
                <div>
                  <strong>{project.name}</strong>
                  <p>{project.description || "설명 없음"}</p>
                  <span>
                    회사 {project.companies.length}개 · 참석자 {project.attendees.length}명 · 회의 장소 {project.locations.length}개
                  </span>
                </div>
                <div className="card-actions">
                  <button className="secondary compact-text-button" type="button" onClick={() => props.editProject(project)}>
                    수정
                  </button>
                  <button className="danger-button" title="프로젝트 삭제" type="button" onClick={() => props.deleteProject(project.id)}>
                    <Trash2 size={18} />
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <form className="panel project-form-panel" onSubmit={props.saveProject}>
        <h2>{props.editingProjectId ? "프로젝트 수정" : "프로젝트 등록"}</h2>
        <label>
          프로젝트명
          <input value={props.projectName} onChange={(event) => props.setProjectName(event.target.value)} placeholder="예: 키움증권 컨시어지" />
        </label>
        <label>
          설명
          <input
            value={props.projectDescription}
            onChange={(event) => props.setProjectDescription(event.target.value)}
            placeholder="예: 컨시어지 구축 프로젝트"
          />
        </label>


        <EditablePresetList
          title="회사"
          placeholder="예: 키움증권"
          items={props.projectCompanies}
          setItems={props.setProjectCompanies}
          draft={props.projectCompanyInput}
          setDraft={props.setProjectCompanyInput}
        />
        <EditablePresetList
          title="참석자"
          placeholder="예: OOO 사원"
          items={props.projectAttendees}
          setItems={props.setProjectAttendees}
          draft={props.projectAttendeeInput}
          setDraft={props.setProjectAttendeeInput}
        />
        <EditablePresetList
          title="회의 장소"
          placeholder="예: 본사 7층 회의실"
          items={props.projectLocations}
          setItems={props.setProjectLocations}
          draft={props.projectLocationInput}
          setDraft={props.setProjectLocationInput}
        />

        <div className="form-actions">
          <button className="primary" type="submit">
            {props.editingProjectId ? "수정" : "등록"}
          </button>
          {props.editingProjectId && (
            <button className="secondary" type="button" onClick={props.resetProjectForm}>
              취소
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function EditablePresetList(props: {
  title: string;
  placeholder: string;
  items: string[];
  setItems: (items: string[]) => void;
  draft: string;
  setDraft: (value: string) => void;
}) {
  const countLabel = `${props.items.length}${props.title === "참석자" ? "명" : "개"}`;

  function addItem() {
    const value = props.draft.trim();
    if (!value || props.items.includes(value)) {
      props.setDraft("");
      return;
    }
    props.setItems([...props.items, value]);
    props.setDraft("");
  }

  return (
    <section className="editable-preset">
      <div className="editable-preset-header">
        <strong>{props.title}</strong>
        <span>{countLabel}</span>
      </div>
      <div className="preset-add-row">
        <input
          value={props.draft}
          onChange={(event) => props.setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addItem();
            }
          }}
          placeholder={props.placeholder}
        />
        <button className="icon-button add-attendee" title={`${props.title} 추가`} type="button" onClick={addItem}>
          <Plus size={18} />
        </button>
      </div>
      <div className="editable-preset-chip-list">
        {props.items.map((item, index) => (
            <div className="editable-preset-chip" key={`${item}-${index}`}>
              <input
                aria-label={`${props.title} ${index + 1}`}
                value={item}
                onChange={(event) =>
                  props.setItems(props.items.map((current, itemIndex) => (itemIndex === index ? event.target.value : current)))
                }
              />
              <button
                className="danger-button"
                title={`${props.title} 삭제`}
                type="button"
                onClick={() => props.setItems(props.items.filter((_, itemIndex) => itemIndex !== index))}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
      </div>
    </section>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
